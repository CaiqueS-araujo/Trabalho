// Lê a tabela de um PDF com texto (não funciona com foto/escaneado).
// Devolve uma matriz: a primeira linha é o cabeçalho, as demais são as vendas.

// paginas: [[{ s, x, y, w, h }]] (texto com posição). Separado para poder testar sem o pdf.js.
export function montarTabela(paginas, ehCabecalho) {
  const linhas = [];
  for (const itens of paginas) {
    const textos = itens
      .filter((i) => i.s && i.s.trim() !== "")
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos = [];
    for (const t of textos) {
      const g = grupos.find((g) => Math.abs(g.y - t.y) <= Math.max(2, t.h * 0.4));
      if (g) g.itens.push(t); else grupos.push({ y: t.y, itens: [t] });
    }
    for (const g of grupos) {
      g.itens.sort((a, b) => a.x - b.x);
      const cels = [];
      let fim = null;
      for (const t of g.itens) {
        const folga = fim === null ? Infinity : t.x - fim;
        if (cels.length && folga <= t.h * 0.6) {
          const c = cels[cels.length - 1];
          c.t += (folga > t.h * 0.15 ? " " : "") + t.s;
          c.x1 = t.x + t.w;
        } else {
          cels.push({ t: t.s, x0: t.x, x1: t.x + t.w });
        }
        fim = t.x + t.w;
      }
      for (const c of cels) c.t = c.t.replace(/\s+/g, " ").trim();
      linhas.push(cels.filter((c) => c.t));
    }
  }

  let hi = linhas.findIndex((l) => ehCabecalho(l.map((c) => c.t)));
  if (hi < 0) hi = linhas.findIndex((l) => l.length >= 3);
  if (hi < 0) return [];
  const cab = linhas[hi];

  // coloca cada texto na coluna do cabeçalho com que mais se sobrepõe (células vazias não deslocam as colunas)
  const coluna = (c) => {
    let melhor = -1, ov = 0;
    cab.forEach((h, i) => {
      const o = Math.min(h.x1, c.x1) - Math.max(h.x0, c.x0);
      if (o > ov) { ov = o; melhor = i; }
    });
    if (melhor >= 0) return melhor;
    const cx = (c.x0 + c.x1) / 2;
    let d = Infinity;
    cab.forEach((h, i) => {
      const dd = Math.abs((h.x0 + h.x1) / 2 - cx);
      if (dd < d) { d = dd; melhor = i; }
    });
    return melhor;
  };

  const titulos = cab.map((c) => c.t);
  const saida = [titulos];
  for (const l of linhas.slice(hi + 1)) {
    if (l.length < 2) continue;
    const linha = Array(cab.length).fill("");
    for (const c of l) {
      const i = coluna(c);
      linha[i] = linha[i] ? linha[i] + " " + c.t : c.t;
    }
    if (linha.join("|") === titulos.join("|")) continue; // cabeçalho repetido em outra página
    saida.push(linha);
  }
  return saida;
}

export async function lerPdf(buf, ehCabecalho) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const paginas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    paginas.push(
      items.map((i) => ({
        s: i.str, x: i.transform[4], y: i.transform[5], w: i.width,
        h: Math.abs(i.transform[3]) || i.height || 10,
      }))
    );
  }
  return montarTabela(paginas, ehCabecalho);
}
