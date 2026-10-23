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

// CSV com ";" e BOM: abre direto no Excel em português
export function exportarCSV(lista, comissaoPct) {
  const aspas = (t) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const num = (n) => n.toFixed(2).replace(".", ",");
  const linhas = [["Data", "Vendedor", "Cliente", "Telefone", "Moto", "Seguro", "Valor", "Comissão estimada"]];
  for (const v of lista) {
    linhas.push([
      dataBR(v.data), v.vendedor, v.cliente || "", v.telefone || "", v.modelo,
      v.seguro ? "Com seguro" : "Sem seguro", num(v.valor), num((v.valor * comissaoPct) / 100),
    ]);
  }
  const csv = "\uFEFF" + linhas.map((l) => l.map(aspas).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `vendas-${hoje()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
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
  const texto =
    `Olá${nome ? ", " + nome : ""}! Aqui é ${eu}, da Moto Chefe Petrópolis. Tudo bem? ` +
    `Passando para lembrar que você pode contratar o seguro da sua ${v.modelo} até ${limite}, ` +
    `com o preço de moto nova. Se quiser, faço uma simulação para você agora. 😊`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
