export const PERFIS = ["CAIQUE", "DANIELLE"];
export const PERIODOS = [
  { id: "mes", nome: "Este mês" },
  { id: "mesAnt", nome: "Mês passado" },
  { id: "30d", nome: "Últimos 30 dias" },
  { id: "ano", nome: "Este ano" },
  { id: "tudo", nome: "Tudo" },
];

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function iso(data) {
  const d = new Date(data);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
export const hoje = () => iso(new Date());

// "2026-10" (offset 0), mês anterior (offset -1)...
export function mesDe(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return iso(d).slice(0, 7);
}

export function somaDias(dataIso, n) {
  const d = new Date(dataIso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
}

export const dataBR = (s) => s.split("-").reverse().join("/");

// "18.500,00" -> 18500
export function lerValor(texto) {
  const n = Number(String(texto).replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export const soma = (lista) => lista.reduce((s, v) => s + v.valor, 0);

export function resumo(lista) {
  const total = soma(lista);
  const comSeguro = lista.filter((v) => v.seguro);
  return {
    qtd: lista.length,
    total,
    ticket: lista.length ? total / lista.length : 0,
    qtdSeguro: comSeguro.length,
    valorSeguro: soma(comSeguro),
    pctSeguro: lista.length ? Math.round((comSeguro.length / lista.length) * 100) : 0,
    qtdAnalise: lista.filter((v) => statusSeguro(v) === "analise").length,
  };
}

export function noPeriodo(v, periodo) {
  const d = v.data;
  if (periodo === "mes") return d.startsWith(mesDe(0));
  if (periodo === "mesAnt") return d.startsWith(mesDe(-1));
  if (periodo === "30d") return d >= somaDias(hoje(), -30);
  if (periodo === "ano") return d.startsWith(hoje().slice(0, 4));
  return true;
}

// "sim" | "analise" | "nao" (vendas antigas só tinham seguro verdadeiro/falso)
export function statusSeguro(v) {
  return v?.seguroStatus || (v?.seguro ? "sim" : "nao");
}

export function nomeMoto(v) {
  const p = (v.potencia || "").trim();
  if (!p || (v.modelo || "").toLowerCase().includes(p.toLowerCase())) return v.modelo;
  return `${v.modelo} ${p}`;
}

// Campos extras do formulário: [grupo, campo, rótulo, exemplo, tipo]
export const EXTRAS_FORM = [
  ["venda", "potencia", "Potência", "Ex.: 1000W"],
  ["venda", "cor", "Cor", "Ex.: Preta"],
  ["venda", "chassi", "Chassi", ""],
  ["venda", "valorTotal", "Valor total (com frete e extras)", "Ex.: 9.200,00", "numero"],
  ["venda", "acessorioPago", "Acessório pago", "Ex.: Não"],
  ["venda", "formaPagamento", "Forma de pagamento", "Ex.: 12x cartão"],
  ["venda", "entrega", "Entrega", "Ex.: Sim"],
  ["venda", "frete", "Frete", "Ex.: Grátis"],
  ["venda", "nf", "Nota fiscal", "Ex.: NF 731"],
  ["venda", "brinde", "Brinde", "Ex.: Capacete"],
  ["venda", "origem", "Como conheceu a loja", "Ex.: Instagram"],
  ["cliente", "telefone2", "Telefone 2", ""],
  ["cliente", "email", "E-mail", ""],
  ["cliente", "cpf", "CPF", ""],
  ["cliente", "nascimento", "Data de nascimento", "Ex.: 07/08/1990"],
  ["cliente", "cep", "CEP", ""],
  ["cliente", "endereco", "Endereço", ""],
  ["cliente", "bairro", "Bairro", ""],
  ["cliente", "cidade", "Cidade", ""],
  ["cliente", "referencia", "Ponto de referência", ""],
  ["obs", "obs", "Observações", "", "texto"],
];

// Planilha organizada: [título, campo, tipo, largura]
const COLUNAS_EXCEL = [
  ["Data", "data", "data", 12], ["Vendedor", "vendedor", "txt", 12], ["Cliente", "cliente", "txt", 28],
  ["Telefone", "telefone", "txt", 16], ["Telefone 2", "telefone2", "txt", 16], ["E-mail", "email", "txt", 28],
  ["CPF", "cpf", "txt", 16], ["Nascimento", "nascimento", "txt", 13], ["CEP", "cep", "txt", 11],
  ["Endereço", "endereco", "txt", 32], ["Bairro", "bairro", "txt", 18], ["Cidade", "cidade", "txt", 18],
  ["Ponto de referência", "referencia", "txt", 30],
  ["Moto", "modelo", "txt", 18], ["Potência", "potencia", "txt", 10], ["Cor", "cor", "txt", 12], ["Chassi", "chassi", "txt", 20],
  ["Valor da moto", "valor", "moeda", 15], ["Acessório pago", "acessorioPago", "txt", 14],
  ["Forma de pagamento", "formaPagamento", "txt", 24], ["Frete", "frete", "txt", 10], ["Valor total", "valorTotal", "moeda", 15],
  ["Seguro", "seguroStatus", "seguro", 14], ["Como conheceu a loja", "origem", "txt", 20], ["Entrega", "entrega", "txt", 10],
  ["Nota fiscal", "nf", "txt", 14], ["Brinde", "brinde", "txt", 18], ["Comissão estimada", null, "comissao", 16],
  ["Observações", "obs", "txt", 40],
];

export async function exportarExcel(lista, comissaoPct) {
  const XLSX = await import("xlsx");
  const rotulo = { sim: "Com seguro", analise: "Em análise", nao: "Sem seguro" };
  const ordenada = [...lista].sort((a, b) => a.data.localeCompare(b.data));
  const linhas = ordenada.map((v) => COLUNAS_EXCEL.map(([, k, tipo]) => {
    if (tipo === "data") { const [a, m, d] = v.data.split("-").map(Number); return new Date(a, m - 1, d, 12); }
    if (tipo === "moeda") return typeof v[k] === "number" ? v[k] : null;
    if (tipo === "seguro") return rotulo[statusSeguro(v)];
    if (tipo === "comissao") return Math.round(v.valor * comissaoPct) / 100;
    if (k === "modelo") return v.modelo;
    return v[k] ?? "";
  }));
  const moeda = '"R$" #,##0.00';

  const ws = XLSX.utils.aoa_to_sheet([COLUNAS_EXCEL.map((c) => c[0]), ...linhas], { cellDates: true });
  ws["!cols"] = COLUNAS_EXCEL.map((c) => ({ wch: c[3] }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: COLUNAS_EXCEL.length - 1 } }) };
  COLUNAS_EXCEL.forEach(([, , tipo], c) => {
    const fmt = tipo === "data" ? "dd/mm/yyyy" : tipo === "moeda" || tipo === "comissao" ? moeda : null;
    if (!fmt) return;
    for (let r = 1; r <= linhas.length; r++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel) cel.z = fmt;
    }
  });

  const resumoLinhas = [["Vendedor", "Motos vendidas", "Total vendido", "Com seguro", "Em análise", "Sem seguro", "Comissão estimada"]];
  const parte = (nome, l) => {
    const t = soma(l);
    return [nome, l.length, t, l.filter((v) => statusSeguro(v) === "sim").length,
      l.filter((v) => statusSeguro(v) === "analise").length, l.filter((v) => statusSeguro(v) === "nao").length,
      Math.round(t * comissaoPct) / 100];
  };
  for (const p of PERFIS) resumoLinhas.push(parte(p, lista.filter((v) => v.vendedor === p)));
  resumoLinhas.push(parte("TOTAL", lista));
  const rs = XLSX.utils.aoa_to_sheet(resumoLinhas);
  rs["!cols"] = [14, 16, 16, 12, 12, 12, 18].map((wch) => ({ wch }));
  for (let r = 1; r < resumoLinhas.length; r++) for (const c of [2, 6]) {
    const cel = rs[XLSX.utils.encode_cell({ r, c })];
    if (cel) cel.z = moeda;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendas");
  XLSX.utils.book_append_sheet(wb, rs, "Resumo");
  XLSX.writeFile(wb, `vendas-${hoje()}.xlsx`, { cellDates: true });
}

export const PRAZO_SEGURO = 30; // dias para fechar o seguro com preço de moto nova

export function diasAte(dataIso) {
  const a = new Date(hoje() + "T12:00:00"), b = new Date(dataIso + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

// Link do WhatsApp com a mensagem de seguro já escrita (você edita antes de enviar)
export function linkWhatsApp(v) {
  let n = (v.telefone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (n.length <= 11) n = "55" + n;
  if (n.length < 12 || n.length > 13) return null;
  const nome = (v.cliente || "").trim().split(" ")[0];
  const eu = v.vendedor.charAt(0) + v.vendedor.slice(1).toLowerCase();
  const limite = dataBR(somaDias(v.data, PRAZO_SEGURO));
  const abre = `Olá${nome ? ", " + nome : ""}! Aqui é ${eu}, da Moto Chefe Petrópolis. Tudo bem? `;
  const texto = statusSeguro(v) === "analise"
    ? abre + `Passando para saber se você conseguiu avaliar o seguro da sua ${nomeMoto(v)}. ` +
      `Você pode contratar até ${limite}, com o preço de moto nova. Posso te ajudar a fechar? 😊`
    : abre + `Passando para lembrar que você pode contratar o seguro da sua ${nomeMoto(v)} até ${limite}, ` +
      `com o preço de moto nova. Se quiser, faço uma simulação para você agora. 😊`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
