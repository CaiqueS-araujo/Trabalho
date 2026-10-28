// Regras de leitura de linhas de planilha/PDF -> vendas. Sem React nem Firebase (dá para testar no Node).
import { hoje, iso, dataBR } from "./util.js";

export const PRINCIPAIS = [
  ["data", "Data", ["data", "dia", "datavenda", "datadavenda"]],
  ["vendedor", "Vendedor", ["vendedor", "vendedora", "consultor", "responsavel"]],
  ["cliente", "Cliente", ["cliente", "nome", "comprador", "nomedocliente"]],
  ["telefone", "Telefone", ["telefone", "celular", "whatsapp", "fone", "contato"]],
  ["modelo", "Moto", ["moto", "modelo", "produto", "veiculo", "item"]],
  ["valor", "Valor da moto", ["valor", "preco", "total", "valordavenda", "valordamoto"]],
  ["seguro", "Seguro", ["seguro", "comseguro", "temseguro"]],
];
export const EXTRAS = [
  ["potencia", "Potência", ["potencia"]],
  ["cor", "Cor", ["cor"]],
  ["chassi", "Chassi", ["chassi"]],
  ["acessorioPago", "Acessório pago", ["acessoriopago"]],
  ["formaPagamento", "Forma de pagamento", ["formadepagamento", "formapagamento", "pagamento"]],
  ["origem", "Como conheceu a loja", ["comoconheceualoja", "comoconheceu", "origem"]],
  ["cpf", "CPF", ["cpf"]],
  ["nascimento", "Data de nascimento", ["datadenascimento", "nascimento"]],
  ["telefone2", "Telefone 2", ["telefone2", "fone2", "celular2"]],
  ["email", "E-mail", ["email"]],
  ["cep", "CEP", ["cep"]],
  ["endereco", "Endereço", ["endereco", "rua"]],
  ["bairro", "Bairro", ["bairro"]],
  ["cidade", "Cidade", ["cidade"]],
  ["referencia", "Ponto de referência", ["pontodereferencia", "referencia"]],
  ["entrega", "Entrega", ["entrega"]],
  ["frete", "Frete", ["frete"]],
  ["valorTotal", "Valor total", ["valortotal"]],
  ["nf", "Nota fiscal", ["jatemnf", "nf", "notafiscal"]],
  ["brinde", "Brinde", ["brinde"]],
  ["obs", "Observações", ["obs", "observacao", "observacoes"]],
];
export const CAMPOS = [...PRINCIPAIS, ...EXTRAS];
// dados pessoais do cliente: só entram se você marcar a opção na importação
export const PESSOAIS = ["cpf", "nascimento", "email", "cep", "endereco", "bairro", "cidade", "referencia"];

export const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const NOMES = CAMPOS.flatMap((c) => c[2]);
export const ehCabecalho = (cels) => cels.filter((c) => NOMES.includes(norm(c))).length >= 2;

export function mapear(cab) {
  const n = cab.map(norm);
  const mapa = {};
  const usadas = new Set();
  for (const [k, , nomes] of CAMPOS) {
    const i = n.findIndex((c, idx) => !usadas.has(idx) && nomes.includes(c));
    mapa[k] = i;
    if (i >= 0) usadas.add(i);
  }
  for (const [k, , nomes] of CAMPOS) {
    if (mapa[k] >= 0) continue;
    const i = n.findIndex((c, idx) => c && !usadas.has(idx) && nomes.some((a) => a.length >= 4 && c.includes(a)));
    mapa[k] = i;
    if (i >= 0) usadas.add(i);
  }
  return mapa;
}

function valida(a, m, d) {
  const mm = m.padStart(2, "0"), dd = d.padStart(2, "0");
  const x = new Date(`${a}-${mm}-${dd}T12:00:00`);
  return x.getMonth() + 1 === Number(m) && x.getDate() === Number(d) ? `${a}-${mm}-${dd}` : "";
}

export function lerData(v) {
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getTime() + 6 * 3600e3));
  if (typeof v === "number" && v > 20000 && v < 80000)
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) return valida(m[3].length === 2 ? "20" + m[3] : m[3], m[2], m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? valida(m[1], m[2], m[3]) : "";
}

// "R$ 8.904,00", "8904,00", "9.490", "11,990", "11,990$" -> número
export function lerValor(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// "" = vazio, null = nome que não é CAIQUE nem DANIELLE
export function lerVendedor(v) {
  const s = norm(v);
  if (!s) return "";
  if (s.includes("caique")) return "CAIQUE";
  if (s.includes("daniel")) return "DANIELLE";
  return null;
}

// "sim" | "analise" | "nao"
export function lerSeguro(v) {
  if (typeof v === "number") return v > 0 ? "sim" : "nao";
  const s = norm(v);
  if (!s) return "nao";
  if (/(analis|cotad|aguard|pens|avali)/.test(s)) return "analise";
  if (["s", "x", "1", "y", "true", "ok", "seguro"].includes(s) || s.startsWith("sim") || s.startsWith("com") || s.startsWith("yes")) return "sim";
  return "nao";
}

export const texto = (v) => (typeof v === "number" ? String(Math.round(v)) : String(v ?? "").trim());

export function converter(l, mapa, padrao, pessoais = true) {
  const g = (k) => (mapa[k] >= 0 ? l[mapa[k]] : undefined);
  const modelo = texto(g("modelo")), cliente = texto(g("cliente"));
  if (!texto(g("data")) && !modelo && !texto(g("valor")) && !cliente) return { vazia: true, ok: false, erros: [], dados: {} };

  const erros = [];
  const data = mapa.data >= 0 ? lerData(g("data")) : hoje();
  if (!data) erros.push("data inválida");
  let vendedor = mapa.vendedor >= 0 ? lerVendedor(g("vendedor")) : "";
  let outro = "";
  if (vendedor === null) { outro = texto(g("vendedor")); erros.push("vendedor fora do sistema"); vendedor = ""; }
  else if (!vendedor) vendedor = padrao;
  if (!vendedor && !outro) erros.push("sem vendedor");
  if (!modelo) erros.push("sem moto");
  const valor = lerValor(g("valor"));
  if (valor <= 0) erros.push("valor inválido");

  const st = mapa.seguro >= 0 ? lerSeguro(g("seguro")) : "nao";
  const dados = {
    vendedor, modelo: modelo.slice(0, 99), valor, data, cliente: cliente.slice(0, 99),
    telefone: texto(g("telefone")).slice(0, 29), seguroStatus: st, seguro: st === "sim",
  };
  for (const [k] of EXTRAS) {
    if (!pessoais && PESSOAIS.includes(k)) continue;
    const bruto = g(k);
    if (k === "valorTotal") { const n = lerValor(bruto); if (n > 0) dados.valorTotal = n; continue; }
    const t = bruto instanceof Date ? dataBR(lerData(bruto)) : texto(bruto);
    if (t) dados[k] = t.slice(0, k === "obs" ? 500 : 200);
  }
  return { dados, erros, ok: erros.length === 0, outro };
}

export const chave = (d) =>
  [d.vendedor, d.data, d.modelo.toLowerCase(), d.valor, (d.cliente || "").toLowerCase(), d.chassi || ""].join("|");
