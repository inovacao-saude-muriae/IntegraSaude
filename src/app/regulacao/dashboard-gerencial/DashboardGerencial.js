"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA REGULAÇÃO — interface
// Mesmo padrão visual dos dashboards de Processos Judiciais e Farmácia
// Judicial: container único (.paginaContainer/.paginaPainel), cards, gráficos
// em SVG/CSS puro (sem dependência nova) e responsividade própria.
// Todos os números vêm do backend (server actions) — nada é calculado aqui
// além de formatação e proporção das barras.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import styles from "./DashboardGerencial.module.css";
import { obterDashboardGerencial, obterFiltrosDashboardRegulacao } from "./actions";

const FILTROS_VAZIOS = {
  tipoExameId: "",
  procedimentoId: "",
  cota: "",
  entradaInicio: "",
  entradaFim: "",
  liberacaoInicio: "",
  liberacaoFim: "",
  status: "",
};

const ROTULO_STATUS = {
  Aguardando: "Aguardando",
  Liberado: "Liberado",
  Cancelado: "Cancelado",
  Devolvido: "Devolvido",
};

const brl = (v) =>
  `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nf = (v) => Number(v || 0).toLocaleString("pt-BR");
const rotuloMes = (mes) => {
  const [ano, m] = String(mes).split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const nome = nomes[Number(m) - 1] || m;
  return `${nome}/${String(ano).slice(2)}`;
};

function Card({ titulo, valor, nota, variante }) {
  return (
    <div className={`${styles.card} ${variante ? styles[variante] : ""}`}>
      <span className={styles.cardTitulo}>{titulo}</span>
      <strong className={styles.cardValor}>{valor}</strong>
      {nota ? <span className={styles.cardNota}>{nota}</span> : null}
    </div>
  );
}

function Painel({ titulo, nota, children, vazio }) {
  return (
    <div className={styles.painel}>
      <div className={styles.painelTopo}>
        <h3 className={styles.painelTitulo}>{titulo}</h3>
        {nota ? <span className={styles.painelNota}>{nota}</span> : null}
      </div>
      {vazio ? <div className={styles.vazio}>Sem dados para os filtros selecionados.</div> : children}
    </div>
  );
}

// ── Gráfico de barras verticais (entradas × liberações por mês) ────────────
function GraficoColunas({ dados }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.flatMap((d) => [d.entradas, d.liberados]));
  return (
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 760 190" className={styles.svg} role="img" aria-label="Entradas versus liberações">
        <line x1="0" y1="160" x2="760" y2="160" stroke="#e2e8f0" strokeWidth="1" />
        {dados.map((d, i) => {
          const base = i * (760 / dados.length);
          const passo = 760 / dados.length;
          const altE = (d.entradas / maximo) * 140;
          const altL = (d.liberados / maximo) * 140;
          return (
            <g key={d.mes}>
              <rect
                x={base + passo * 0.22}
                y={160 - altE}
                width={passo * 0.26}
                height={Math.max(altE, 0.5)}
                rx="3"
                fill="#2563eb"
              />
              <rect
                x={base + passo * 0.52}
                y={160 - altL}
                width={passo * 0.26}
                height={Math.max(altL, 0.5)}
                rx="3"
                fill="#10b981"
              />
              <text x={base + passo / 2} y="178" textAnchor="middle" className={styles.eixoRotulo}>
                {rotuloMes(d.mes)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.legenda}>
        <span><i className={styles.corEntrada} /> Entradas</span>
        <span><i className={styles.corLiberado} /> Liberações</span>
      </div>
    </div>
  );
}

// ── Linha (evolução mensal das solicitações / valores autorizados) ─────────
function GraficoLinhas({ dados, campo, cor, rotulo }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const valores = dados.map((d) => Number(d[campo]) || 0);
  const maximo = Math.max(1, ...valores);
  const passo = dados.length > 1 ? 720 / (dados.length - 1) : 0;
  const pontos = valores.map((v, i) => `${20 + i * passo},${150 - (v / maximo) * 120}`);
  return (
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 760 180" className={styles.svg} role="img" aria-label={rotulo}>
        <line x1="0" y1="150" x2="760" y2="150" stroke="#e2e8f0" strokeWidth="1" />
        {dados.length > 1 ? (
          <polyline points={pontos.join(" ")} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" />
        ) : null}
        {valores.map((v, i) => (
          <circle key={dados[i].mes} cx={20 + i * passo} cy={150 - (v / maximo) * 120} r="3.5" fill={cor} />
        ))}
        {dados.map((d, i) => (
          <text key={`m-${d.mes}`} x={20 + i * passo} y="170" textAnchor="middle" className={styles.eixoRotulo}>
            {rotuloMes(d.mes)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Barras horizontais com nome + valor ────────────────────────────────────
function GraficoBarras({ dados, valorDe, formatar, cor }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.map((d) => Number(valorDe(d)) || 0));
  return (
    <div className={styles.barras}>
      {dados.map((d) => {
        const valor = Number(valorDe(d)) || 0;
        return (
          <div key={`${d.nome}-${valor}`} className={styles.barraItem}>
            <div className={styles.barraTopo}>
              <span className={styles.barraNome} title={d.nome}>{d.nome}</span>
              <strong className={styles.barraValor}>{formatar(d)}</strong>
            </div>
            <div className={styles.barraTrilho}>
              <div
                className={styles.barraPreenchida}
                style={{ width: `${maximo ? (valor / maximo) * 100 : 0}%`, backgroundColor: cor || "#2563eb" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Rosca (situação dos pedidos) ───────────────────────────────────────────
const CORES_STATUS = ["#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#64748b"];
function GraficoRosca({ dados }) {
  const total = dados.reduce((s, d) => s + Number(d.quantidade || 0), 0);
  if (!total) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const raio = 54;
  const circunferencia = 2 * Math.PI * raio;
  // Offsets pré-calculados (sem reatribuição durante o render).
  const fracoes = dados.map((d) => Number(d.quantidade) / total);
  const inicios = fracoes.map((_, i) => fracoes.slice(0, i).reduce((s, f) => s + f, 0));
  const segmentos = dados.map((d, i) => ({
    nome: d.nome,
    quantidade: Number(d.quantidade),
    cor: CORES_STATUS[i % CORES_STATUS.length],
    dash: `${fracoes[i] * circunferencia} ${circunferencia}`,
    offset: -inicios[i] * circunferencia,
  }));
  return (
    <div className={styles.roscaWrap}>
      <svg viewBox="0 0 140 140" className={styles.rosca} role="img" aria-label="Situação dos pedidos">
        <circle cx="70" cy="70" r={raio} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {segmentos.map((s) => (
          <circle
            key={s.nome}
            cx="70"
            cy="70"
            r={raio}
            fill="none"
            stroke={s.cor}
            strokeWidth="18"
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className={styles.roscaTotal}>{nf(total)}</text>
        <text x="70" y="84" textAnchor="middle" className={styles.roscaRotulo}>pedidos</text>
      </svg>
      <div className={styles.legendaRosca}>
        {segmentos.map((s) => (
          <div key={s.nome} className={styles.legendaLinha}>
            <i style={{ backgroundColor: s.cor }} />
            <span>{ROTULO_STATUS[s.nome] || s.nome}</span>
            <strong>{nf(s.quantidade)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardGerencial() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [catalogo, setCatalogo] = useState({ tiposExame: [], procedimentos: [], cotas: [], status: [] });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);

  const carregar = useCallback(async (aplicados) => {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro("");
    const resposta = await obterDashboardGerencial(aplicados);
    if (id !== requisicao.current) return;
    if (resposta?.success) setDados(resposta);
    else setErro(resposta?.error || "Não foi possível carregar o dashboard.");
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cat] = await Promise.all([obterFiltrosDashboardRegulacao(), carregar(FILTROS_VAZIOS)]);
      if (!ativo) return;
      if (cat?.success) {
        setCatalogo({
          tiposExame: cat.tiposExame || [],
          procedimentos: cat.procedimentos || [],
          cotas: cat.cotas || [],
          status: cat.status || [],
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const alterar = (campo, valor) => {
    setFiltros((atual) => {
      const proximo = { ...atual, [campo]: valor };
      // Procedimento passa a ser restrito ao tipo de exame escolhido.
      if (campo === "tipoExameId" && proximo.procedimentoId) {
        const p = catalogo.procedimentos.find((x) => String(x.id) === String(proximo.procedimentoId));
        if (!p || String(p.tipoExameId) !== String(valor)) proximo.procedimentoId = "";
      }
      return proximo;
    });
  };

  const procedimentosVisiveis = filtros.tipoExameId
    ? catalogo.procedimentos.filter((p) => String(p.tipoExameId) === String(filtros.tipoExameId))
    : catalogo.procedimentos;

  const filtrar = (e) => {
    e?.preventDefault?.();
    carregar(filtros);
  };
  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    carregar(FILTROS_VAZIOS);
  };

  const ind = dados?.indicadores || {};
  const fila = dados?.fila || { risco: [], tipoExame: [], procedimento: [], tempoProcedimento: [], crescimentoProcedimento: [], envelhecimento: [] };
  const fin = dados?.financeiro || { porTipoExame: [], porProcedimento: [], porCota: [], cotasTeto: [] };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* ── 1. FILTROS ─────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h2>FILTROS DO DASHBOARD</h2>
          </div>
          <div className={styles.gridFiltros}>
            <div className={styles.campoFiltro}>
              <label htmlFor="dg-tipo">Tipo de Exame</label>
              <select id="dg-tipo" value={filtros.tipoExameId} onChange={(e) => alterar("tipoExameId", e.target.value)}>
                <option value="">Todos</option>
                {catalogo.tiposExame.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dg-proc">Procedimento</label>
              <select id="dg-proc" value={filtros.procedimentoId} onChange={(e) => alterar("procedimentoId", e.target.value)}>
                <option value="">Todos</option>
                {procedimentosVisiveis.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dg-cota">Cota</label>
              <select id="dg-cota" value={filtros.cota} onChange={(e) => alterar("cota", e.target.value)}>
                <option value="">Todas</option>
                {catalogo.cotas.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período de Entrada</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial da entrada"
                  value={filtros.entradaInicio}
                  onChange={(e) => alterar("entradaInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final da entrada"
                  value={filtros.entradaFim}
                  onChange={(e) => alterar("entradaFim", e.target.value)}
                />
              </div>
            </div>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período de Liberação</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial da liberação"
                  value={filtros.liberacaoInicio}
                  onChange={(e) => alterar("liberacaoInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final da liberação"
                  value={filtros.liberacaoFim}
                  onChange={(e) => alterar("liberacaoFim", e.target.value)}
                />
              </div>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dg-status">Status do Pedido</label>
              <select id="dg-status" value={filtros.status} onChange={(e) => alterar("status", e.target.value)}>
                <option value="">Todos</option>
                {catalogo.status.map((s) => (
                  <option key={s} value={s}>{ROTULO_STATUS[s] || s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.acoesFiltros}>
            <button type="submit" className={styles.btnPrimario} disabled={carregando}>
              <Filter size={16} strokeWidth={2.5} />
              Filtrar
            </button>
            <button type="button" className={styles.btnGhost} onClick={limpar} disabled={carregando}>
              Limpar filtros
            </button>
          </div>
        </form>

        {erro ? <div className={styles.avisoErro}>{erro}</div> : null}

        {carregando && !dados ? (
          <div className={styles.estadoInicial}>
            <Loader2 size={28} className={styles.spinner} />
            <p>Carregando indicadores…</p>
          </div>
        ) : null}

        {dados && !erro ? (
          <>
            {/* ── 2. INDICADORES PRINCIPAIS ────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Indicadores principais</h2>
              <div className={styles.cardsGrid}>
                <Card titulo="Total de solicitações" valor={nf(ind.total)} nota="Pedidos cadastrados" />
                <Card titulo="Aguardando liberação" valor={nf(ind.pendentes)} nota="Fila atual" variante="card_pendente" />
                <Card titulo="Liberadas" valor={nf(ind.liberados)} nota="Com data de liberação" variante="card_ativo" />
                <Card titulo="Concluídas" valor={nf(ind.concluidos)} nota="Status Liberado" variante="card_ativo" />
                <Card
                  titulo="Tempo médio de espera"
                  valor={`${nf(ind.tempoMedioLiberado)} d`}
                  nota="Entrada → liberação"
                />
                <Card
                  titulo="Maior espera pendente"
                  valor={`${nf(ind.maiorEsperaPendente)} d`}
                  nota="Pendente → hoje"
                  variante="card_inativo"
                />
              </div>
            </section>

            {/* ── 3. DEMANDA E EVOLUÇÃO MENSAL ─────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Demanda e evolução mensal</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Evolução mensal das solicitações" nota="Novos pedidos por mês de cadastro" vazio={!dados.evolucao.length}>
                  <GraficoLinhas dados={dados.evolucao} campo="entradas" cor="#2563eb" rotulo="Evolução mensal das solicitações" />
                </Painel>
                <Painel titulo="Entradas versus liberações" nota="Por mês de cadastro" vazio={!dados.evolucao.length}>
                  <GraficoColunas dados={dados.evolucao} />
                </Painel>
              </div>
            </section>

            {/* ── 4. FILA DE ESPERA ────────────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Fila de espera</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Fila por classificação de risco" nota="Pendentes hoje" vazio={!fila.risco.length}>
                  <GraficoBarras
                    dados={fila.risco}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedidos`}
                    cor="#f59e0b"
                  />
                </Painel>
                <Painel titulo="Fila por tipo de exame" nota="Pendentes hoje" vazio={!fila.tipoExame.length}>
                  <GraficoBarras
                    dados={fila.tipoExame}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedidos`}
                  />
                </Painel>
                <Painel titulo="Fila por procedimento" nota="10 maiores filas" vazio={!fila.procedimento.length}>
                  <GraficoBarras
                    dados={fila.procedimento}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedidos`}
                    cor="#8b5cf6"
                  />
                </Painel>
                <Painel titulo="Tempo de espera por procedimento" nota="Média dos pendentes (dias)" vazio={!fila.tempoProcedimento.length}>
                  <GraficoBarras
                    dados={fila.tempoProcedimento}
                    valorDe={(d) => d.dias}
                    formatar={(d) => `${nf(d.dias)} d · ${nf(d.quantidade)} ped.`}
                    cor="#ef4444"
                  />
                </Painel>
                <Painel titulo="Envelhecimento da fila" nota="Pendentes por faixa de espera" vazio={!fila.envelhecimento.length}>
                  <GraficoBarras
                    dados={fila.envelhecimento}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedidos`}
                    cor="#0ea5e9"
                  />
                </Painel>
                <Painel titulo="Situação dos pedidos" nota="Status cadastrados" vazio={!dados.porStatus.length}>
                  <GraficoRosca dados={dados.porStatus} />
                </Painel>
              </div>
            </section>

            {/* ── 5. PRODUTIVIDADE DOS REGULADORES ─────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Produtividade dos reguladores</h2>
              <div className={styles.graficosGridUm}>
                <Painel titulo="Pedidos liberados por regulador" nota="Responsável pela liberação" vazio={!dados.produtividade.length}>
                  <GraficoBarras
                    dados={dados.produtividade}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} ${d.quantidade === 1 ? "liberação" : "liberações"}`}
                    cor="#0f766e"
                  />
                </Painel>
              </div>
            </section>

            {/* ── 6. GESTÃO FINANCEIRA ─────────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Gestão financeira</h2>
              <div className={styles.cardsGrid}>
                <Card titulo="Valor total das solicitações" valor={brl(ind.valorSolicitado)} nota="Procedimento × pedidos" variante="card_financeiro" />
                <Card titulo="Valor dos pedidos liberados" valor={brl(ind.valorLiberado)} nota="Autorizado, não pago" variante="card_ativo" />
                <Card titulo="Valor estimado pendente" valor={brl(ind.valorPendente)} nota="Aguardando/Devolvido" variante="card_pendente" />
              </div>
              <div className={styles.graficosGrid}>
                <Painel titulo="Valores por tipo de exame" nota="Solicitado × liberado" vazio={!fin.porTipoExame.length}>
                  <GraficoBarras
                    dados={fin.porTipoExame}
                    valorDe={(d) => d.liberado}
                    formatar={(d) => `${brl(d.liberado)} liberados · ${brl(d.solicitado)} solicitados`}
                  />
                </Painel>
                <Painel titulo="Valores por cota" nota="Solicitado × liberado" vazio={!fin.porCota.length}>
                  <GraficoBarras
                    dados={fin.porCota}
                    valorDe={(d) => d.liberado}
                    formatar={(d) => `${brl(d.liberado)} · ${nf(d.quantidade)} ped.`}
                    cor="#0f766e"
                  />
                </Painel>
                <Painel titulo="Procedimentos com maior impacto financeiro" nota="Valor liberado" vazio={!fin.porProcedimento.length}>
                  <GraficoBarras
                    dados={fin.porProcedimento}
                    valorDe={(d) => d.liberado}
                    formatar={(d) => `${brl(d.liberado)} · ${nf(d.quantidade)} ped.`}
                    cor="#8b5cf6"
                  />
                </Painel>
                <Painel titulo="Evolução mensal dos valores autorizados" nota="Por data de liberação" vazio={!dados.evolucao.length}>
                  <GraficoLinhas dados={dados.evolucao} campo="valorLiberado" cor="#10b981" rotulo="Valores autorizados por mês" />
                </Painel>
              </div>
              {fin.cotasTeto.length ? (
                <Painel titulo="Utilização das cotas" nota="Teto financeiro por competência">
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Cota</th>
                          <th>Competência</th>
                          <th>Teto</th>
                          <th>Utilizado</th>
                          <th>Saldo</th>
                          <th>Uso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fin.cotasTeto.map((c) => {
                          const teto = Number(c.teto) || 0;
                          const uso = teto > 0 ? (Number(c.utilizado) / teto) * 100 : 0;
                          return (
                            <tr key={`${c.nome}-${c.competencia}`}>
                              <td>{c.nome}</td>
                              <td>{c.competencia}</td>
                              <td>{brl(c.teto)}</td>
                              <td>{brl(c.utilizado)}</td>
                              <td>{brl(teto - Number(c.utilizado || 0))}</td>
                              <td>{uso.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Painel>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
