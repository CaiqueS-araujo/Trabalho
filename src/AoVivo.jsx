import { useEffect, useMemo, useState } from "react";
import { PERFIS, brl, statusSeguro, nomeMoto } from "./util";

const COR = { CAIQUE: "#1d4ed8", DANIELLE: "#e11d74" };
const ROTULO = { sim: "Com seguro", analise: "Em análise", nao: "Sem seguro" };

function atras(ms, agora) {
  const s = Math.max(0, Math.round((agora - ms) / 1000));
  if (s < 45) return "agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

// Painel da administração: quem está preenchendo agora + últimas vendas registradas (tempo real)
export default function AoVivo({ rascunhos, vendas, idsIniciais }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const recentes = useMemo(
    () => [...vendas].sort((a, b) => (b.criadoMs || 0) - (a.criadoMs || 0) || b.data.localeCompare(a.data)).slice(0, 8),
    [vendas]
  );

  return (
    <section className="painel aovivo">
      <h2>Ao vivo</h2>
      <p className="mudo">Atualiza sozinho, sem precisar recarregar a página.</p>

      <div className="vivos">
        {PERFIS.map((p) => {
          const r = rascunhos[p];
          const ativo = r && agora - r.ms < 3 * 60 * 1000;
          return (
            <div key={p} className={"vivo" + (ativo ? " ativo" : "")} style={{ "--cor": COR[p] }}>
              <p className="vivo-nome">
                {p} {ativo ? <span className="pulso" aria-hidden="true" /> : null}
              </p>
              {ativo ? (
                <>
                  <p className="vivo-status">Preenchendo uma venda · {atras(r.ms, agora)}</p>
                  <dl className="vivo-dados">
                    <div><dt>Cliente</dt><dd>{r.cliente || "—"}</dd></div>
                    <div><dt>Moto</dt><dd>{r.modelo || "—"}</dd></div>
                    <div><dt>Valor</dt><dd>{r.valor > 0 ? brl.format(r.valor) : "—"}</dd></div>
                    <div><dt>Seguro</dt><dd>{ROTULO[r.seguroStatus] || "—"}</dd></div>
                  </dl>
                </>
              ) : (
                <p className="mudo">Nenhum registro em andamento.</p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="recentes-titulo">Últimas vendas registradas</h3>
      {recentes.length === 0 ? <p className="mudo">Nenhuma venda registrada ainda.</p> : (
        <ul className="recentes">
          {recentes.map((v) => (
            <li key={v.id}>
              <span className="ponto" style={{ background: COR[v.vendedor] }} />
              <span className="rec-txt">
                <b>{v.vendedor}</b> · {v.cliente || "Cliente sem nome"} · {nomeMoto(v)}
                <small>
                  {v.criadoMs ? atras(v.criadoMs, agora) : "—"} · {ROTULO[statusSeguro(v)]}
                  {idsIniciais && !idsIniciais.has(v.id) && <span className="nova">Nova</span>}
                </small>
              </span>
              <span className="rec-valor">{brl.format(v.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
