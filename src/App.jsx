import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { db, firebaseConfigurado } from "./firebase";

const PERFIS = ["CAIQUE", "DANIELLE"];
const COR = { CAIQUE: "#1d4ed8", DANIELLE: "#e11d74", JUNTOS: "#14232b" };
const COR_SEGURO = "#0f766e";
const COR_SEM = "#cbd5e1";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function hoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// "18.500,00" -> 18500
function lerValor(texto) {
  const limpo = String(texto).replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function resumo(lista) {
  const total = lista.reduce((s, v) => s + v.valor, 0);
  const comSeguro = lista.filter((v) => v.seguro);
  return {
    qtd: lista.length,
    total,
    ticket: lista.length ? total / lista.length : 0,
    qtdSeguro: comSeguro.length,
    valorSeguro: comSeguro.reduce((s, v) => s + v.valor, 0),
    pctSeguro: lista.length ? Math.round((comSeguro.length / lista.length) * 100) : 0,
  };
}

function porMes(lista) {
  const mapa = {};
  for (const v of lista) {
    const chave = v.data.slice(0, 7);
    if (!mapa[chave]) {
      const [ano, mes] = chave.split("-");
      mapa[chave] = { chave, mes: `${mes}/${ano.slice(2)}`, CAIQUE: 0, DANIELLE: 0 };
    }
    mapa[chave][v.vendedor] += v.valor;
  }
  return Object.values(mapa).sort((a, b) => a.chave.localeCompare(b.chave));
}

function dataBR(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function App() {
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [vista, setVista] = useState("JUNTOS");

  useEffect(() => {
    if (!db) { setCarregando(false); return; }
    const q = query(collection(db, "vendas"), orderBy("data", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setVendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCarregando(false);
      },
      (e) => {
        setErro("Não foi possível carregar as vendas. Confira as regras do Firestore e as variáveis do Firebase.");
        console.error(e);
        setCarregando(false);
      }
    );
  }, []);

  const doPerfil = useMemo(
    () => (vista === "JUNTOS" ? vendas : vendas.filter((v) => v.vendedor === vista)),
    [vendas, vista]
  );
  const stats = useMemo(() => resumo(doPerfil), [doPerfil]);
  const meses = useMemo(() => porMes(doPerfil), [doPerfil]);
  const porPessoa = useMemo(
    () => Object.fromEntries(PERFIS.map((p) => [p, resumo(vendas.filter((v) => v.vendedor === p))])),
    [vendas]
  );

  if (!firebaseConfigurado) {
    return (
      <main className="wrap">
        <div className="aviso">
          <h1>Falta conectar o Firebase</h1>
          <p>Copie o arquivo <code>.env.example</code> para <code>.env</code>, preencha com os dados do seu projeto Firebase e reinicie. Na Vercel, cadastre as mesmas variáveis em Settings → Environment Variables.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="topo">
        <p className="marca">Vendas de motos</p>
        <nav className="abas" aria-label="Perfis">
          {["JUNTOS", ...PERFIS].map((p) => (
            <button
              key={p}
              className={"aba" + (vista === p ? " ativa" : "")}
              style={{ "--cor": COR[p] }}
              onClick={() => setVista(p)}
              aria-pressed={vista === p}
            >
              {p === "JUNTOS" ? "Juntos" : p}
            </button>
          ))}
        </nav>
      </header>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="hero" style={{ "--cor": COR[vista] }}>
        <p className="hero-rotulo">
          {vista === "JUNTOS" ? "Total vendido pelos dois" : `Total vendido por ${vista}`}
        </p>
        <p className="hero-valor">{brl.format(stats.total)}</p>
        <dl className="numeros">
          <div><dt>Motos vendidas</dt><dd>{stats.qtd}</dd></div>
          <div><dt>Valor médio</dt><dd>{brl.format(stats.ticket)}</dd></div>
          <div><dt>Com seguro</dt><dd>{stats.qtdSeguro} ({stats.pctSeguro}%)</dd></div>
          <div><dt>Valor com seguro</dt><dd>{brl.format(stats.valorSeguro)}</dd></div>
        </dl>
      </section>

      {vista === "JUNTOS" && (
        <section className="duelo">
          {PERFIS.map((p) => {
            const parte = stats.total ? (porPessoa[p].total / stats.total) * 100 : 0;
            return (
              <button key={p} className="duelo-item" style={{ "--cor": COR[p] }} onClick={() => setVista(p)}>
                <span className="duelo-nome">{p}</span>
                <span className="duelo-valor">{brl.format(porPessoa[p].total)}</span>
                <span className="duelo-sub">{porPessoa[p].qtd} motos · {Math.round(parte)}% do total</span>
                <span className="barra"><span style={{ width: `${parte}%` }} /></span>
              </button>
            );
          })}
        </section>
      )}

      {vista !== "JUNTOS" && <Formulario vendedor={vista} />}

      <section className="graficos">
        {vista === "JUNTOS" && (
          <div className="painel">
            <h2>Total vendido por pessoa</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={PERFIS.map((p) => ({ nome: p, total: porPessoa[p].total }))}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compacto} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => brl.format(v)} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]}>
                  {PERFIS.map((p) => <Cell key={p} fill={COR[p]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="painel">
          <h2>Vendas por mês</h2>
          {meses.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={meses}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compacto} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => brl.format(v)} cursor={{ fill: "#f1f5f9" }} />
                {vista === "JUNTOS" && <Legend />}
                {(vista === "JUNTOS" ? PERFIS : [vista]).map((p) => (
                  <Bar key={p} dataKey={p} name={p} fill={COR[p]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="painel">
          <h2>Com seguro e sem seguro</h2>
          {stats.qtd === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Com seguro", value: stats.qtdSeguro },
                    { name: "Sem seguro", value: stats.qtd - stats.qtdSeguro },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}
                  label={({ value }) => value}
                >
                  <Cell fill={COR_SEGURO} />
                  <Cell fill={COR_SEM} />
                </Pie>
                <Tooltip formatter={(v) => `${v} motos`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="painel lista">
        <h2>{vista === "JUNTOS" ? "Todas as vendas" : `Vendas de ${vista}`}</h2>
        {carregando ? <p className="mudo">Carregando…</p> : doPerfil.length === 0 ? <Vazio /> : (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  {vista === "JUNTOS" && <th>Vendedor</th>}
                  <th>Moto</th>
                  <th>Seguro</th>
                  <th className="num">Valor</th>
                  <th><span className="sr">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {doPerfil.map((v) => (
                  <tr key={v.id}>
                    <td>{dataBR(v.data)}</td>
                    {vista === "JUNTOS" && (
                      <td><span className="ponto" style={{ background: COR[v.vendedor] }} />{v.vendedor}</td>
                    )}
                    <td>{v.modelo}</td>
                    <td><span className={"selo " + (v.seguro ? "sim" : "nao")}>{v.seguro ? "Com seguro" : "Sem seguro"}</span></td>
                    <td className="num">{brl.format(v.valor)}</td>
                    <td>
                      <button className="remover" onClick={() => remover(v)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function compacto(v) {
  return v >= 1000 ? `${Math.round(v / 1000)}k` : v;
}

function Vazio() {
  return <p className="mudo">Nenhuma venda registrada ainda.</p>;
}

async function remover(v) {
  if (!window.confirm(`Excluir a venda "${v.modelo}" de ${v.vendedor}?`)) return;
  await deleteDoc(doc(db, "vendas", v.id));
}

function Formulario({ vendedor }) {
  const [modelo, setModelo] = useState("");
  const [valorTxt, setValorTxt] = useState("");
  const [seguro, setSeguro] = useState(false);
  const [data, setData] = useState(hoje());
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const valor = lerValor(valorTxt);

  async function salvar(e) {
    e.preventDefault();
    setMsg("");
    if (!modelo.trim() || valor <= 0) {
      setMsg("Informe a moto e o valor da venda.");
      return;
    }
    setSalvando(true);
    try {
      await addDoc(collection(db, "vendas"), {
        vendedor, modelo: modelo.trim(), valor, seguro, data, criadoEm: serverTimestamp(),
      });
      setModelo(""); setValorTxt(""); setSeguro(false); setData(hoje());
      setMsg("Venda salva.");
    } catch (err) {
      console.error(err);
      setMsg("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="painel form" onSubmit={salvar} style={{ "--cor": COR[vendedor] }}>
      <h2>Registrar venda de {vendedor}</h2>
      <div className="campos">
        <label>Moto
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Scooter elétrica 2000W" maxLength={99} />
        </label>
        <label>Valor da moto (R$)
          <input value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} inputMode="decimal" placeholder="Ex.: 18.500,00" />
          <small>{valor > 0 ? brl.format(valor) : "\u00a0"}</small>
        </label>
        <label>Data da venda
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={hoje()} />
        </label>
        <fieldset>
          <legend>Seguro</legend>
          <div className="duas">
            <button type="button" className={!seguro ? "on" : ""} onClick={() => setSeguro(false)}>Sem seguro</button>
            <button type="button" className={seguro ? "on" : ""} onClick={() => setSeguro(true)}>Com seguro</button>
          </div>
        </fieldset>
      </div>
      <div className="acoes">
        <button className="salvar" disabled={salvando}>{salvando ? "Salvando…" : "Salvar venda"}</button>
        {msg && <span className="msg" role="status">{msg}</span>}
      </div>
    </form>
  );
}
