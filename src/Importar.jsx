import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { lerPdf } from "./lerPdf";
import { PERFIS, brl, hoje, iso, dataBR } from "./util";

// campo, rótulo, nomes de coluna aceitos (sem acento, minúsculo)
const CAMPOS = [
  ["data", "Data", ["data", "dia", "datavenda", "datadavenda"]],
  ["vendedor", "Vendedor", ["vendedor", "vendedora", "consultor", "responsavel"]],
  ["cliente", "Cliente", ["cliente", "nome", "comprador", "nomedocliente"]],
  ["telefone", "Telefone", ["telefone", "celular", "whatsapp", "fone", "contato"]],
  ["modelo", "Moto", ["moto", "modelo", "produto", "veiculo", "item"]],
  ["valor", "Valor", ["valor", "preco", "total", "valordavenda", "valordamoto"]],
  ["seguro", "Seguro", ["seguro", "comseguro", "temseguro"]],
];

const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

function mapear(cab) {
  const n = cab.map(norm);
  const mapa = {};
  for (const [k, , nomes] of CAMPOS) {
    let i = n.findIndex((c) => nomes.includes(c));
    if (i < 0) i = n.findIndex((c) => c && nomes.some((a) => a.length >= 4 && c.includes(a)));
    mapa[k] = i;
  }
  return mapa;
}

function valida(a, m, d) {
  const mm = m.padStart(2, "0"), dd = d.padStart(2, "0");
  const x = new Date(`${a}-${mm}-${dd}T12:00:00`);
  return x.getMonth() + 1 === Number(m) && x.getDate() === Number(d) ? `${a}-${mm}-${dd}` : "";
}

function lerData(v) {
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getTime() + 6 * 3600e3));
  if (typeof v === "number" && v > 20000 && v < 80000)
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) return valida(m[3].length === 2 ? "20" + m[3] : m[3], m[2], m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? valida(m[1], m[2], m[3]) : "";
}

function lerValor(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function lerVendedor(v) {
  const s = norm(v);
  if (!s) return "";
  if (s.includes("caique")) return "CAIQUE";
  if (s.includes("daniel")) return "DANIELLE";
  return null;
}

function lerSeguro(v) {
  if (typeof v === "number") return v > 0;
  const s = norm(v);
  return ["s", "x", "1", "y", "true", "ok", "seguro"].includes(s) ||
    s.startsWith("sim") || s.startsWith("com") || s.startsWith("yes");
}

const NOMES = CAMPOS.flatMap((c) => c[2]);
const ehCabecalho = (cels) => cels.filter((c) => NOMES.includes(norm(c))).length >= 2;

const texto = (v) => (typeof v === "number" ? String(Math.round(v)) : String(v ?? "").trim());

function converter(l, mapa, padrao) {
  const g = (k) => (mapa[k] >= 0 ? l[mapa[k]] : undefined);
  const erros = [];
  const data = mapa.data >= 0 ? lerData(g("data")) : hoje();
  if (!data) erros.push("data inválida");
  let vendedor = mapa.vendedor >= 0 ? lerVendedor(g("vendedor")) : "";
  if (vendedor === null) { erros.push("vendedor não reconhecido"); vendedor = ""; }
  else if (!vendedor) vendedor = padrao;
  if (!vendedor && !erros.includes("vendedor não reconhecido")) erros.push("sem vendedor");
  const modelo = texto(g("modelo"));
  if (!modelo) erros.push("sem moto");
  const valor = lerValor(g("valor"));
  if (valor <= 0) erros.push("valor inválido");
  const dados = {
    vendedor, modelo: modelo.slice(0, 99), valor, data,
    cliente: texto(g("cliente")).slice(0, 99),
    telefone: texto(g("telefone")).slice(0, 29),
    seguro: mapa.seguro >= 0 ? lerSeguro(g("seguro")) : false,
  };
  return { dados, erros, ok: erros.length === 0 };
}

const chave = (d) => [d.vendedor, d.data, d.modelo.toLowerCase(), d.valor, (d.cliente || "").toLowerCase()].join("|");

function baixarModelo() {
  const csv = "\uFEFFData;Vendedor;Cliente;Telefone;Moto;Seguro;Valor\r\n" +
    "05/10/2026;CAIQUE;João Silva;24999999999;Scooter elétrica 2000W;Sim;18500,00\r\n" +
    "12/10/2026;DANIELLE;Maria Souza;24988888888;Bike elétrica urbana;Não;9800,00\r\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "modelo-importacao.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Importar({ vendas, vista }) {
  const [arquivo, setArquivo] = useState("");
  const [cab, setCab] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [mapa, setMapa] = useState({});
  const [padrao, setPadrao] = useState(vista === "JUNTOS" ? "" : vista);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function abrir(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(""); setResultado("");
    try {
      const buf = await file.arrayBuffer();
      let todas;
      if (/\.pdf$/i.test(file.name)) {
        todas = await lerPdf(buf, ehCabecalho);
      } else {
        let wb;
        if (/\.csv$/i.test(file.name)) {
          let txt;
          try { txt = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
          catch { txt = new TextDecoder("windows-1252").decode(buf); }
          const primeira = txt.split(/\r?\n/)[0];
          const FS = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",";
          wb = XLSX.read(txt, { type: "string", FS, cellDates: true });
        } else {
          wb = XLSX.read(buf, { type: "array", cellDates: true });
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        todas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
          .filter((l) => l.some((c) => String(c).trim() !== ""));
      }
      if (todas.length < 2) { setErro("Não encontrei uma tabela de vendas nesse arquivo. Precisa ter uma linha de títulos e ao menos uma venda. PDF de foto ou escaneado não dá para ler."); return; }
      const titulos = todas[0].map((c) => String(c).trim());
      setCab(titulos); setLinhas(todas.slice(1)); setMapa(mapear(titulos)); setArquivo(file.name);
    } catch (err) {
      console.error(err);
      setErro("Não consegui ler esse arquivo. Use .xlsx, .xls, .csv ou .pdf.");
    }
    e.target.value = "";
  }

  const existentes = useMemo(() => new Set(vendas.map((v) => chave({ ...v, cliente: v.cliente || "" }))), [vendas]);
  const registros = useMemo(
    () => linhas.map((l) => {
      const r = converter(l, mapa, padrao);
      return { ...r, duplicada: r.ok && existentes.has(chave(r.dados)) };
    }),
    [linhas, mapa, padrao, existentes]
  );
  const novos = registros.filter((r) => r.ok && !r.duplicada);
  const comErro = registros.filter((r) => !r.ok).length;
  const duplicadas = registros.filter((r) => r.duplicada).length;

  async function importar() {
    setSalvando(true); setErro("");
    try {
      for (let i = 0; i < novos.length; i += 400) {
        const lote = writeBatch(db);
        for (const r of novos.slice(i, i + 400)) {
          lote.set(doc(collection(db, "vendas")), { ...r.dados, posVenda: {}, criadoEm: serverTimestamp(), importado: true });
        }
        await lote.commit();
      }
      setResultado(`${novos.length} vendas importadas.`);
      setLinhas([]); setCab([]); setArquivo("");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível importar. Confira as regras do Firestore e tente de novo.");
    } finally { setSalvando(false); }
  }

  return (
    <details className="painel">
      <summary>Importar planilha (Excel, CSV ou PDF)</summary>
      <div className="importar">
        <p className="mudo">
          Aceita .xlsx, .xls, .csv e PDF com texto (exportado de planilha ou documento). A primeira linha da tabela deve ter os títulos das colunas (Data, Vendedor, Cliente, Telefone, Moto, Seguro, Valor).
        </p>
        <div className="acoes">
          <label className="arquivo">Escolher planilha
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={abrir} />
          </label>
          <button type="button" className="sec" onClick={baixarModelo}>Baixar planilha modelo</button>
          {arquivo && <span className="msg">{arquivo}</span>}
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {resultado && <p className="ok" role="status">{resultado}</p>}

        {cab.length > 0 && (
          <>
            <h3>Confira as colunas</h3>
            <div className="mapa">
              {CAMPOS.map(([k, rotulo]) => (
                <label key={k}>{rotulo}
                  <select value={mapa[k]} onChange={(e) => setMapa({ ...mapa, [k]: Number(e.target.value) })}>
                    <option value={-1}>(não tem)</option>
                    {cab.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
              <label>Vendedor quando a linha não tiver
                <select value={padrao} onChange={(e) => setPadrao(e.target.value)}>
                  <option value="">(nenhum)</option>
                  {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <p className="resumo-imp">
              <b>{novos.length}</b> prontas para importar
              {duplicadas > 0 && <> · {duplicadas} já cadastradas (serão ignoradas)</>}
              {comErro > 0 && <> · <span className="ruim">{comErro} com problema (serão ignoradas)</span></>}
            </p>

            <div className="tabela-rolagem">
              <table className="cartoes">
                <thead><tr><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Moto</th><th>Seguro</th><th className="num">Valor</th><th>Situação</th></tr></thead>
                <tbody>
                  {registros.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td data-label="Data">{r.dados.data ? dataBR(r.dados.data) : "—"}</td>
                      <td data-label="Vendedor">{r.dados.vendedor || "—"}</td>
                      <td data-label="Cliente">{r.dados.cliente || "—"}</td>
                      <td data-label="Moto">{r.dados.modelo || "—"}</td>
                      <td data-label="Seguro">{r.dados.seguro ? "Com seguro" : "Sem seguro"}</td>
                      <td className="num" data-label="Valor">{r.dados.valor > 0 ? brl.format(r.dados.valor) : "—"}</td>
                      <td data-label="Situação" className={r.ok ? "" : "ruim"}>{!r.ok ? r.erros.join(", ") : r.duplicada ? "Já cadastrada" : "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {registros.length > 10 && <p className="mudo">Mostrando as 10 primeiras de {registros.length} linhas.</p>}

            <div className="acoes">
              <button className="salvar" disabled={salvando || novos.length === 0} onClick={importar}>
                {salvando ? "Importando…" : `Importar ${novos.length} vendas`}
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
