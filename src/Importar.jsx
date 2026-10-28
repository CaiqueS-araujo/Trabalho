import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { lerPdf } from "./lerPdf";
import { PERFIS, brl, dataBR } from "./util";
import { PRINCIPAIS, EXTRAS, ehCabecalho, mapear, converter, chave } from "./converter";

const ROTULO_SEGURO = { sim: "Com seguro", analise: "Em análise", nao: "Sem seguro" };

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
  const [pessoais, setPessoais] = useState(true);
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
      if (todas.length < 2) {
        setErro("Não encontrei vendas nesse arquivo. PDF de foto ou escaneado não dá para ler.");
        return;
      }
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
    () => linhas
      .map((l) => converter(l, mapa, padrao, pessoais))
      .filter((r) => !r.vazia)
      .map((r) => ({ ...r, duplicada: r.ok && existentes.has(chave(r.dados)) })),
    [linhas, mapa, padrao, pessoais, existentes]
  );
  const novos = registros.filter((r) => r.ok && !r.duplicada);
  const duplicadas = registros.filter((r) => r.duplicada).length;
  const comErro = registros.filter((r) => !r.ok);
  const contar = (lista) => Object.entries(lista.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {}));
  const motivos = contar(comErro.flatMap((r) => r.erros));
  const outros = contar(comErro.map((r) => r.outro).filter(Boolean));

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

  const seletor = ([k, rotulo]) => (
    <label key={k}>{rotulo}
      <select value={mapa[k]} onChange={(e) => setMapa({ ...mapa, [k]: Number(e.target.value) })}>
        <option value={-1}>(não tem)</option>
        {cab.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
      </select>
    </label>
  );

  return (
    <details className="painel">
      <summary>Importar planilha (Excel, CSV ou PDF)</summary>
      <div className="importar">
        <p className="mudo">
          Aceita .xlsx, .xls, .csv e PDF com texto. O PDF pode ser uma tabela com títulos nas colunas ou fichas de venda, uma por página
          (Data da venda, Modelo, Valor, Cliente, Seguro?, Vendedor…).
        </p>
        <div className="acoes">
          <label className="arquivo">Escolher arquivo
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
              {PRINCIPAIS.map(seletor)}
              <label>Vendedor quando a linha não tiver
                <select value={padrao} onChange={(e) => setPadrao(e.target.value)}>
                  <option value="">(nenhum)</option>
                  {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <details className="subpainel">
              <summary>Outras colunas (potência, chassi, pagamento, CPF, endereço…)</summary>
              <div className="mapa">{EXTRAS.map(seletor)}</div>
            </details>
            <label className="check">
              <input type="checkbox" checked={pessoais} onChange={(e) => setPessoais(e.target.checked)} />
              <span>Importar também os dados pessoais do cliente (CPF, nascimento, e-mail e endereço)</span>
            </label>

            <p className="resumo-imp">
              <b>{novos.length}</b> prontas para importar
              {duplicadas > 0 && <> · {duplicadas} já cadastradas (serão ignoradas)</>}
              {comErro.length > 0 && <> · <span className="ruim">{comErro.length} com problema (serão ignoradas)</span></>}
            </p>
            {motivos.length > 0 && <p className="mudo">Problemas: {motivos.map(([m, n]) => `${n} × ${m}`).join(" · ")}</p>}
            {outros.length > 0 && (
              <p className="mudo">Vendedores que não existem no sistema: {outros.map(([n, q]) => `${n} (${q})`).join(", ")}. Essas vendas ficam de fora.</p>
            )}

            <div className="tabela-rolagem">
              <table className="cartoes">
                <thead><tr><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Moto</th><th>Seguro</th><th className="num">Valor</th><th>Situação</th></tr></thead>
                <tbody>
                  {registros.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td data-label="Data">{r.dados.data ? dataBR(r.dados.data) : "—"}</td>
                      <td data-label="Vendedor">{r.dados.vendedor || r.outro || "—"}</td>
                      <td data-label="Cliente">{r.dados.cliente || "—"}</td>
                      <td data-label="Moto">{r.dados.modelo || "—"}</td>
                      <td data-label="Seguro">{ROTULO_SEGURO[r.dados.seguroStatus]}</td>
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
