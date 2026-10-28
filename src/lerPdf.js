// Lê PDF com texto (não funciona com foto/escaneado). Reconhece dois formatos:
//  1) "fichas": uma venda por página, com linhas "Rótulo: valor"
//  2) tabela: títulos de colunas na primeira linha

// Junta os pedaços de texto de uma página em linhas, e cada linha em células com posição.
function celulasPorLinha(itens) {
  const textos = itens.filter((i) => i.s && i.s.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos = [];
  for (const t of textos) {
    const g = grupos.find((g) => Math.abs(g.y - t.y) <= Math.max(2, t.h * 0.4));
    if (g) g.itens.push(t); else grupos.push({ y: t.y, itens: [t] });
  }
  return grupos.map((g) => {
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
    return cels.filter((c) => c.t);
  });
}

// ---------- fichas (uma venda por página) ----------
const FICHA = [
  ["data", "Data da venda", "Data\\s*da\\s*venda"],
  ["modelo", "Modelo", "Modelo"],
  ["potencia", "Potência", "Pot[eê]ncia"],
  ["cor", "Cor", "Cor"],
  ["chassi", "Chassi", "Chassi"],
  ["valorTotal", "Valor Total", "Valor\\s*Total"],
  ["valor", "Valor", "Valor(?!\\s*Total)"],
  ["acessorioPago", "Acessório pago", "Acess[oó]rio\\s*pago"],
  ["formaPagamento", "Forma de pagamento", "Forma\\s*de\\s*pagamento"],
  ["origem", "Como conheceu a loja", "Como\\s*conheceu\\s*a\\s*loja"],
  ["cliente", "Cliente", "Cliente"],
  ["cpf", "CPF", "CPF"],
  ["nascimento", "Data de nascimento", "Data\\s*de\\s*nascimento"],
  ["telefone2", "Telefone 2", "Telefone\\s*2"],
  ["telefone", "Telefone", "Telefone(?!\\s*2)"],
  ["email", "E-mail", "E-?mail"],
  ["cep", "CEP", "CEP"],
  ["endereco", "Endereço", "Endere[cç]o"],
  ["bairro", "Bairro", "Bairro"],
  ["cidade", "Cidade", "Cidade"],
  ["referencia", "Ponto de referência", "Ponto\\s*de\\s*refer[eê]ncia"],
  ["entrega", "Entrega?", "Entrega"],
  ["frete", "Frete", "Frete"],
  ["seguro", "Seguro?", "Seguro"],
  ["nf", "Já tem NF?", "J[aá]\\s*tem\\s*NF"],
  ["brinde", "Brinde?", "Brinde"],
  ["obs", "OBS", "OBS"],
  ["vendedor", "Vendedor", "Vendedor"],
].map(([k, t, src]) => ({ k, t, re: new RegExp("^[^A-Za-zÀ-ÿ0-9]*(?:" + src + ")\\s*[:?]+\\s*(.*)$", "i") }));

const ORDEM = ["data", "vendedor", "cliente", "telefone", "modelo", "valor", "seguro", "potencia", "cor", "chassi",
  "acessorioPago", "formaPagamento", "origem", "cpf", "nascimento", "telefone2", "email", "cep", "endereco",
  "bairro", "cidade", "referencia", "entrega", "frete", "valorTotal", "nf", "brinde", "obs"];

export function montarFichas(paginas) {
  const registros = [];
  let melhor = 0;
  for (const itens of paginas) {
    const linhas = celulasPorLinha(itens)
      .map((cs) => cs.map((c) => c.t).join(" ").replace(/[\u200b-\u200d\ufeff]/g, "").trim())
      .filter(Boolean);
    const rec = {};
    let atual = null;
    for (const ln of linhas) {
      const hit = FICHA.find((f) => f.re.test(ln));
      if (hit) { rec[hit.k] = ln.match(hit.re)[1].trim(); atual = hit.k; }
      else if (atual) rec[atual] = (rec[atual] + " " + ln).trim();
    }
    const achados = Object.keys(rec).length;
    melhor = Math.max(melhor, achados);
    if (achados >= 4 && (rec.data || rec.modelo || rec.valor || rec.cliente)) registros.push(rec); // ignora fichas em branco
  }
  if (melhor < 4 || registros.length === 0) return [];
  const titulo = (k) => FICHA.find((f) => f.k === k).t;
  return [ORDEM.map(titulo), ...registros.map((r) => ORDEM.map((k) => r[k] ?? ""))];
}

// ---------- tabela ----------
export function montarTabela(paginas, ehCabecalho) {
  const linhas = paginas.flatMap(celulasPorLinha);
  let hi = linhas.findIndex((l) => ehCabecalho(l.map((c) => c.t)));
  if (hi < 0) hi = linhas.findIndex((l) => l.length >= 3);
  if (hi < 0) return [];
  const cab = linhas[hi];

  // coloca cada texto na coluna do cabeçalho com que mais se sobrepõe (célula vazia não desloca as colunas)
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
  const fichas = montarFichas(paginas);
  return fichas.length ? fichas : montarTabela(paginas, ehCabecalho);
}
