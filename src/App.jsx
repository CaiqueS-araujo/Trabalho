import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { db, firebaseConfigurado } from "./firebase";
import {
  PERFIS, PERIODOS, brl, hoje, mesDe, lerValor, resumo, soma, somaDias, dataBR, noPeriodo, exportarCSV,
} from "./util";

const COR = { CAIQUE: "#1d4ed8", DANIELLE: "#e11d74", JUNTOS: "#14232b" };
const COR_SEGURO = "#0f766e";
const COR_SEM = "#cbd5e1";
const DEF = { metaLoja: 0, metaCAIQUE: 0, metaDANIELLE: 0, comissao: 0 };
const PASSOS = [["d7", 7], ["d30", 30], ["d90", 90]];
const compacto = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);
const Vazio = ({ t = "Nenhuma venda registrada ainda." }) => <p className="mudo">{t}</p>;

export default function App() {
  const [vendas, setVendas] = useState([]);
  const [config, setConfig] = useState(DEF);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [vista, setVista] = useState("JUNTOS");
  const [periodo, setPeriodo] = useState("mes");
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    if (!db) { setCarregando(false); return; }
    const falha = (e) => {
      console.error(e);
      setErro("Não foi possível carregar os dados. Confira as regras do Firestore e as variáveis do Firebase.");
      setCarregando(false);
    };
    const u1 = onSnapshot(query(collection(db, "vendas"), orderBy("data", "desc")), (s) => {
      setVendas(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, falha);
    const u2 = onSnapshot(doc(db, "config", "geral"), (s) => setConfig({ ...DEF, ...(s.data() || {}) }), falha);
    return () => { u1(); u2(); };
  }, []);

  const doVendedor = useMemo(
    () => (vista === "JUNTOS" ? vendas : vendas.filter((v) => v.vendedor === vista)),
    [vendas, vista]
  );
  const doPerfil = useMemo(() => doVendedor.filter((v) => noPeriodo(v, periodo)), [doVendedor, periodo]);
  const stats = useMemo(() => resumo(doPerfil), [doPerfil]);
  const porPessoa = useMemo(
    () => Object.fromEntries(PERFIS.map((p) => [p, resumo(doPerfil.filter((v) => v.vendedor === p))])),
    [doPerfil]
  );

  const meses = useMemo(() => {
    const mapa = {};
    for (const v of doPerfil) {
      const k = v.data.slice(0, 7);
      const [a, m] = k.split("-");
      mapa[k] = mapa[k] || { k, mes: `${m}/${a.slice(2)}`, CAIQUE: 0, DANIELLE: 0 };
      mapa[k][v.vendedor] += v.valor;
    }
    return Object.values(mapa).sort((a, b) => a.k.localeCompare(b.k));
  }, [doPerfil]);

  const modelos = useMemo(() => {
    const m = {};
    for (const v of doPerfil) {
      const k = v.modelo.trim().toLowerCase();
      m[k] = m[k] || { nome: v.modelo.trim(), qtd: 0, total: 0 };
      m[k].qtd += 1; m[k].total += v.valor;
    }
    return Object.values(m).sort((a, b) => b.qtd - a.qtd || b.total - a.total).slice(0, 5);
  }, [doPerfil]);

  // Mês atual x anterior, meta e ranking (não dependem do filtro de período)
  const mesAtual = soma(doVendedor.filter((v) => v.data.startsWith(mesDe(0))));
  const mesAnt = soma(doVendedor.filter((v) => v.data.startsWith(mesDe(-1))));
  const variacao = mesAnt > 0 ? Math.round(((mesAtual - mesAnt) / mesAnt) * 100) : null;
  const meta = vista === "JUNTOS" ? config.metaLoja : config["meta" + vista];
  const pctMeta = meta > 0 ? Math.min(100, Math.round((mesAtual / meta) * 100)) : 0;
  const ranking = PERFIS.map((p) => {
    const l = vendas.filter((v) => v.vendedor === p && v.data.startsWith(mesDe(0)));
    return { p, total: soma(l), qtd: l.length };
  }).sort((a, b) => b.total - a.total);
  const comissao = (valor) => (valor * config.comissao) / 100;

  // Pós-venda: 7, 30 e 90 dias; mostra vencidos (até 30 dias atrás) e os próximos 3 dias
  const tarefas = useMemo(() => {
    const ate = somaDias(hoje(), 3), desde = somaDias(hoje(), -30), out = [];
    for (const v of doVendedor) {
      for (const [k, n] of PASSOS) {
        if (v.posVenda?.[k]) continue;
        const quando = somaDias(v.data, n);
        if (quando <= ate && quando >= desde) out.push({ v, k, n, quando });
      }
    }
    return out.sort((a, b) => a.quando.localeCompare(b.quando));
  }, [doVendedor]);

  function editar(v) {
    setVista(v.vendedor);
    setEditando(v);
    setTimeout(() => document.getElementById("form-venda")?.scrollIntoView({ behavior: "smooth" }), 50);
  }
  async function remover(v) {
    if (!window.confirm(`Excluir a venda "${v.modelo}" de ${v.vendedor}?`)) return;
    await deleteDoc(doc(db, "vendas", v.id));
    if (editando?.id === v.id) setEditando(null);
  }

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

  const nomePeriodo = PERIODOS.find((p) => p.id === periodo).nome.toLowerCase();

  return (
    <main className="wrap">
      <header className="topo">
        <p className="marca">Vendas de motos</p>
        <nav className="abas" aria-label="Perfis">
          {["JUNTOS", ...PERFIS].map((p) => (
            <button key={p} className={"aba" + (vista === p ? " ativa" : "")} style={{ "--cor": COR[p] }}
              onClick={() => { setVista(p); setEditando(null); }} aria-pressed={vista === p}>
              {p === "JUNTOS" ? "Juntos" : p}
            </button>
          ))}
        </nav>
      </header>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="filtro">
        <label>Período
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      </div>

      <section className="hero" style={{ "--cor": COR[vista] }}>
        <p className="hero-rotulo">
          {vista === "JUNTOS" ? "Total vendido pelos dois" : `Total vendido por ${vista}`} ({nomePeriodo})
        </p>
        <p className="hero-valor">{brl.format(stats.total)}</p>
        <dl className="numeros">
          <div><dt>Motos vendidas</dt><dd>{stats.qtd}</dd></div>
          <div><dt>Valor médio</dt><dd>{brl.format(stats.ticket)}</dd></div>
          <div><dt>Com seguro</dt><dd>{stats.qtdSeguro} ({stats.pctSeguro}%)</dd></div>
          <div><dt>Comissão estimada</dt><dd>{brl.format(comissao(stats.total))}</dd></div>
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

      <section className="graficos">
        <div className="painel" style={{ "--cor": COR[vista] }}>
          <h2>Este mês</h2>
          <p className="grande">{brl.format(mesAtual)}</p>
          <p className="mudo">
            {variacao === null
              ? "Sem vendas no mês passado para comparar."
              : `${variacao >= 0 ? "▲" : "▼"} ${Math.abs(variacao)}% em relação ao mês passado (${brl.format(mesAnt)})`}
          </p>
          {meta > 0 ? (
            <>
              <p className="meta-txt">Meta {vista === "JUNTOS" ? "da loja" : "de " + vista}: {brl.format(meta)} · {pctMeta}%</p>
              <span className="barra"><span style={{ width: `${pctMeta}%` }} /></span>
              <p className="mudo">{mesAtual >= meta ? "Meta batida." : `Faltam ${brl.format(meta - mesAtual)}.`}</p>
            </>
          ) : <p className="mudo">Defina a meta do mês em “Metas e comissão”.</p>}
        </div>

        <div className="painel">
          <h2>Ranking do mês</h2>
          {ranking.every((r) => r.qtd === 0) ? <Vazio t="Ninguém vendeu neste mês ainda." /> : (
            <ol className="rank">
              {ranking.map((r, i) => (
                <li key={r.p} style={{ "--cor": COR[r.p] }}>
                  <span className="pos">{i + 1}º</span>
                  <span className="rn">{r.p}</span>
                  <span className="rv">{brl.format(r.total)}<small>{r.qtd} motos</small></span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="painel">
          <h2>Pós-venda</h2>
          {tarefas.length === 0 ? <Vazio t="Nenhum contato de pós-venda pendente." /> : (
            <ul className="tarefas">
              {tarefas.map(({ v, k, n, quando }) => (
                <li key={v.id + k}>
                  <span>
                    <b>{v.cliente || "Cliente sem nome"}</b> · {v.modelo}
                    <small>{n} dias · {quando < hoje() ? "atrasado desde" : "para"} {dataBR(quando)}{vista === "JUNTOS" ? ` · ${v.vendedor}` : ""}</small>
                  </span>
                  <button onClick={() => updateDoc(doc(db, "vendas", v.id), { [`posVenda.${k}`]: true })}>Feito</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <MetasForm key={JSON.stringify(config)} config={config} />

      {vista !== "JUNTOS" && (
        <Formulario key={editando?.id || "novo"} vendedor={vista} editando={editando} onFim={() => setEditando(null)} />
      )}

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
          <h2>Modelos mais vendidos</h2>
          {modelos.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={modelos} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" width={130} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, n, p) => [`${v} motos (${brl.format(p.payload.total)})`, "Vendidas"]} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="qtd" fill={COR[vista]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="painel">
          <h2>Com seguro e sem seguro</h2>
          {stats.qtd === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={[{ name: "Com seguro", value: stats.qtdSeguro }, { name: "Sem seguro", value: stats.qtd - stats.qtdSeguro }]}
                  dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} label={({ value }) => value}>
                  <Cell fill={COR_SEGURO} /><Cell fill={COR_SEM} />
                </Pie>
                <Tooltip formatter={(v) => `${v} motos`} /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="painel lista">
        <div className="lista-topo">
          <h2>{vista === "JUNTOS" ? "Todas as vendas" : `Vendas de ${vista}`} ({nomePeriodo})</h2>
          <button className="sec" disabled={!doPerfil.length} onClick={() => exportarCSV(doPerfil, config.comissao)}>
            Baixar para Excel
          </button>
        </div>
        {carregando ? <p className="mudo">Carregando…</p> : doPerfil.length === 0 ? <Vazio t="Nenhuma venda neste período." /> : (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Data</th>{vista === "JUNTOS" && <th>Vendedor</th>}<th>Cliente</th><th>Moto</th><th>Seguro</th>
                  <th className="num">Valor</th><th className="num">Comissão</th><th><span className="sr">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {doPerfil.map((v) => (
                  <tr key={v.id}>
                    <td>{dataBR(v.data)}</td>
                    {vista === "JUNTOS" && <td><span className="ponto" style={{ background: COR[v.vendedor] }} />{v.vendedor}</td>}
                    <td>{v.cliente || "—"}</td>
                    <td>{v.modelo}</td>
                    <td><span className={"selo " + (v.seguro ? "sim" : "nao")}>{v.seguro ? "Com seguro" : "Sem seguro"}</span></td>
                    <td className="num">{brl.format(v.valor)}</td>
                    <td className="num">{brl.format(comissao(v.valor))}</td>
                    <td className="num">
                      <button className="editar" onClick={() => editar(v)}>Editar</button>
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

function MetasForm({ config }) {
  const fmt = (n) => (n ? String(n).replace(".", ",") : "");
  const [f, setF] = useState({
    metaLoja: fmt(config.metaLoja), metaCAIQUE: fmt(config.metaCAIQUE),
    metaDANIELLE: fmt(config.metaDANIELLE), comissao: fmt(config.comissao),
  });
  const [msg, setMsg] = useState("");
  const campo = (k, rotulo, ph) => (
    <label>{rotulo}
      <input value={f[k]} inputMode="decimal" placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  async function salvar(e) {
    e.preventDefault();
    const pct = lerValor(f.comissao);
    if (pct > 100) { setMsg("A comissão deve ficar entre 0 e 100%."); return; }
    try {
      await setDoc(doc(db, "config", "geral"), {
        metaLoja: lerValor(f.metaLoja), metaCAIQUE: lerValor(f.metaCAIQUE),
        metaDANIELLE: lerValor(f.metaDANIELLE), comissao: pct,
      });
      setMsg("Salvo.");
    } catch (err) { console.error(err); setMsg("Não foi possível salvar."); }
  }
  return (
    <details className="painel">
      <summary>Metas e comissão</summary>
      <form onSubmit={salvar}>
        <div className="campos">
          {campo("metaLoja", "Meta mensal da loja (R$)", "Ex.: 150.000,00")}
          {campo("metaCAIQUE", "Meta mensal do CAIQUE (R$)", "Ex.: 80.000,00")}
          {campo("metaDANIELLE", "Meta mensal da DANIELLE (R$)", "Ex.: 70.000,00")}
          {campo("comissao", "Comissão sobre a venda (%)", "Ex.: 2,5")}
        </div>
        <div className="acoes"><button className="salvar">Salvar metas</button>{msg && <span className="msg" role="status">{msg}</span>}</div>
      </form>
    </details>
  );
}

function Formulario({ vendedor, editando, onFim }) {
  const [modelo, setModelo] = useState(editando?.modelo || "");
  const [cliente, setCliente] = useState(editando?.cliente || "");
  const [valorTxt, setValorTxt] = useState(editando ? String(editando.valor).replace(".", ",") : "");
  const [seguro, setSeguro] = useState(editando?.seguro || false);
  const [data, setData] = useState(editando?.data || hoje());
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const valor = lerValor(valorTxt);

  async function salvar(e) {
    e.preventDefault();
    setMsg("");
    if (!modelo.trim() || valor <= 0) { setMsg("Informe a moto e o valor da venda."); return; }
    setSalvando(true);
    const dados = { modelo: modelo.trim(), cliente: cliente.trim(), valor, seguro, data };
    try {
      if (editando) {
        await updateDoc(doc(db, "vendas", editando.id), dados);
        onFim();
      } else {
        await addDoc(collection(db, "vendas"), { ...dados, vendedor, posVenda: {}, criadoEm: serverTimestamp() });
        setModelo(""); setCliente(""); setValorTxt(""); setSeguro(false); setData(hoje());
        setMsg("Venda salva.");
      }
    } catch (err) { console.error(err); setMsg("Não foi possível salvar. Tente de novo."); }
    finally { setSalvando(false); }
  }

  return (
    <form id="form-venda" className="painel form" onSubmit={salvar} style={{ "--cor": COR[vendedor] }}>
      <h2>{editando ? `Editar venda de ${vendedor}` : `Registrar venda de ${vendedor}`}</h2>
      <div className="campos">
        <label>Nome do cliente
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: João Silva" maxLength={99} />
        </label>
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
        <button className="salvar" disabled={salvando}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar venda"}</button>
        {editando && <button type="button" className="sec" onClick={onFim}>Cancelar</button>}
        {msg && <span className="msg" role="status">{msg}</span>}
      </div>
    </form>
  );
}
