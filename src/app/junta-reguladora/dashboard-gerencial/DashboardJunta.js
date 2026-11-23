"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA JUNTA REGULADORA
// Mesmo padrão visual dos dashboards da Regulação, Processos Judiciais e
// Farmácia Judicial: filtros na 1ª linha, botões na 2ª à direita, cards,
// gráficos em SVG/CSS puro e sem dependência nova.
// Todos os números vêm do backend; aqui só há formatação.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2, SearchX } from "lucide-react";
import styles from "@/app/regulacao/dashboard-gerencial/DashboardGerencial.module.css";
import { obterDashboardJunta, obterFiltrosDashboardJunta } from "./actions";

const FILTROS_VAZIOS = {
  servicoId: "",
  especialidade: "",
  situacao: "",
  entradaInicio: "",
  entradaFim: "",
  movimentacaoInicio: "",
  movimentacaoFim: "",
  responsavel: "",
};

const nf = (v) => Number(v || 0).toLocaleString("pt-BR");
const rotuloMes = (mes) => {
  const [ano, m] = String(mes).split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] || m}/${String(ano).slice(2)}`;
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

function GraficoBarras({ dados, valorDe, formatar, cor }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.map((d) => Number(valorDe(d)) || 0));
  return (
    <div className={styles.barras}>
      {dados.map((d, i) => {
        const valor = Number(valorDe(d)) || 0;
        return (
          <div key={`${d.nome}-${i}`} className={styles.barraItem}>
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

// Evolução mensal: duas séries (entradas × conclusões) em colunas.
function GraficoEntradasConclusoes({ dados }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.flatMap((d) => [Number(d.entradas) || 0, Number(d.concluidos) || 0]));
  const passo = 760 / dados.length;
  return (
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 760 190" className={styles.svg} role="img" aria-label="Entradas e conclusões por mês">
        <line x1="0" y1="160" x2="760" y2="160" stroke="#e2e8f0" strokeWidth="1" />
        {dados.map((d, i) => {
          const base = i * passo;
          const hEntrada = ((Number(d.entradas) || 0) / maximo) * 140;
          const hConcl = ((Number(d.concluidos) || 0) / maximo) * 140;
          return (
            <g key={`${d.mes}-${i}`}>
              <rect x={base + passo * 0.18} y={160 - hEntrada} width={passo * 0.3} height={Math.max(hEntrada, 0.5)} rx="3" fill="#2563eb" />
              <rect x={base + passo * 0.52} y={160 - hConcl} width={passo * 0.3} height={Math.max(hConcl, 0.5)} rx="3" fill="#10b981" />
              <text x={base + passo / 2} y="178" textAnchor="middle" className={styles.eixoRotulo}>{rotuloMes(d.mes)}</text>
            </g>
          );
        })}
      </svg>
      <div className={styles.legenda}>
        <span><i className={styles.corEntrada} /> Entradas</span>
        <span><i className={styles.corLiberado} /> Conclusões</span>
      </div>
    </div>
  );
}

function GraficoColunas({ dados, campo, formatar, rotulo, cor }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.map((d) => Number(d[campo]) || 0));
  const passo = 760 / dados.length;
  return (
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 760 190" className={styles.svg} role="img" aria-label={rotulo}>
        <line x1="0" y1="160" x2="760" y2="160" stroke="#e2e8f0" strokeWidth="1" />
        {dados.map((d, i) => {
          const base = i * passo;
          const valor = Number(d[campo]) || 0;
          const altura = (valor / maximo) * 140;
          return (
            <g key={`${d.mes}-${i}`}>
              <rect x={base + passo * 0.25} y={160 - altura} width={passo * 0.5} height={Math.max(altura, 0.5)} rx="3" fill={cor || "#2563eb"} />
              <text x={base + passo / 2} y="178" textAnchor="middle" className={styles.eixoRotulo}>{rotuloMes(d.mes)}</text>
              <text x={base + passo / 2} y={152 - altura} textAnchor="middle" className={styles.eixoRotulo}>{formatar(d)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GraficoRosca({ dados }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const total = dados.reduce((s, d) => s + (Number(d.quantidade) || 0), 0) || 1;
  const CORES = ["#2563eb", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
  const fracoes = dados.map((d) => (Number(d.quantidade) || 0) / total);
  const inicios = fracoes.map((_, i) => fracoes.slice(0, i).reduce((s, f) => s + f, 0));
  return (
    <div className={styles.roscaWrap}>
      <svg viewBox="0 0 42 42" className={styles.rosca} role="img" aria-label="Distribuição por situação">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {dados.map((d, i) => (
          <circle
            key={d.nome}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={CORES[i % CORES.length]}
            strokeWidth="6"
            strokeDasharray={`${(fracoes[i] * 100).toFixed(2)} ${(100 - fracoes[i] * 100).toFixed(2)}`}
            strokeDashoffset={`${(25 - inicios[i] * 100).toFixed(2)}`}
          />
        ))}
      </svg>
      <ul className={styles.legendaRosca}>
        {dados.map((d, i) => (
          <li key={d.nome} className={styles.legendaLinha}>
            <i style={{ backgroundColor: CORES[i % CORES.length] }} />
            <span>{d.nome}</span>
            <strong>{nf(d.quantidade)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardJunta() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [catalogo, setCatalogo] = useState({ servicos: [], especialidades: [], situacoes: [], responsaveis: [] });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);

  const carregar = useCallback(async (aplicados) => {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro("");
    const resposta = await obterDashboardJunta(aplicados);
    if (id !== requisicao.current) return;
    if (resposta?.success) setDados(resposta);
    else setErro(resposta?.error || "Não foi possível carregar o dashboard.");
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cat] = await Promise.all([obterFiltrosDashboardJunta(), carregar(FILTROS_VAZIOS)]);
      if (!ativo) return;
      if (cat?.success) {
        setCatalogo({
          servicos: cat.servicos || [],
          especialidades: cat.especialidades || [],
          situacoes: cat.situacoes || [],
          responsaveis: cat.responsaveis || [],
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const alterar = (campo, valor) => setFiltros((atual) => ({ ...atual, [campo]: valor }));
  const filtrar = (e) => {
    e?.preventDefault?.();
    carregar(filtros);
  };
  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    carregar(FILTROS_VAZIOS);
  };

  // Especialidade independente do serviço; com serviço escolhido, lista só as dele.
  const especialidadesVisiveis = filtros.servicoId
    ? catalogo.especialidades.filter((e) => String(e.servicoId) === String(filtros.servicoId))
    : catalogo.especialidades;
  const nomesEspecialidades = [...new Set(especialidadesVisiveis.map((e) => e.nome))];

  const ind = dados?.indicadores || {};
  const top10Especialidades = (dados?.porEspecialidade || []).slice(0, 10);

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* ── 1. FILTROS ─────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h2>FILTROS DO DASHBOARD</h2>
          </div>
          <div className={styles.gridFiltrosJunta}>
            <div className={styles.campoFiltro}>
              <label htmlFor="dj-servico">Serviço</label>
              <select
                id="dj-servico"
                value={filtros.servicoId}
                onChange={(e) => {
                  alterar("servicoId", e.target.value);
                  alterar("especialidade", "");
                }}
              >
                <option value="">Todos</option>
                {catalogo.servicos.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dj-especialidade">Especialidade</label>
              <select
                id="dj-especialidade"
                value={filtros.especialidade}
                onChange={(e) => alterar("especialidade", e.target.value)}
              >
                <option value="">Todas</option>
                {nomesEspecialidades.map((nome) => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dj-situacao">Situação do Pedido</label>
              <select id="dj-situacao" value={filtros.situacao} onChange={(e) => alterar("situacao", e.target.value)}>
                <option value="">Todas</option>
                {catalogo.situacoes.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dj-responsavel">Responsável pela Movimentação</label>
              <select
                id="dj-responsavel"
                value={filtros.responsavel}
                onChange={(e) => alterar("responsavel", e.target.value)}
                disabled={!catalogo.responsaveis.length}
                title={catalogo.responsaveis.length ? undefined : "Nenhum responsável registrado nas movimentações"}
              >
                <option value="">Todos</option>
                {catalogo.responsaveis.map((nome) => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período de Entrada</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial de entrada"
                  value={filtros.entradaInicio}
                  onChange={(e) => alterar("entradaInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final de entrada"
                  value={filtros.entradaFim}
                  onChange={(e) => alterar("entradaFim", e.target.value)}
                />
              </div>
            </div>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período de Movimentação</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial da movimentação"
                  value={filtros.movimentacaoInicio}
                  onChange={(e) => alterar("movimentacaoInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final da movimentação"
                  value={filtros.movimentacaoFim}
                  onChange={(e) => alterar("movimentacaoFim", e.target.value)}
                />
              </div>
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
                <Card titulo="Pedidos cadastrados" valor={nf(ind.total)} nota="Junta Reguladora" />
                <Card titulo="Pedidos pendentes" valor={nf(ind.pendentes)} nota="Falta e falta justificada" variante="card_pendente" />
                <Card titulo="Pedidos concluídos" valor={nf(ind.concluidos)} nota="Presença registrada" variante="card_ativo" />
                <Card titulo="Pacientes distintos" valor={nf(ind.pacientes)} nota="Com ao menos um pedido" />
                <Card
                  titulo="Tempo médio de espera"
                  valor={`${nf(ind.tempoMedioPendente)} d`}
                  nota="Pedidos pendentes, até hoje"
                  variante="card_pendente"
                />
                <Card
                  titulo="Tempo médio até a conclusão"
                  valor={`${nf(ind.tempoMedioConcluido)} d`}
                  nota="Entrada até a movimentação"
                  variante="card_ativo"
                />
              </div>
            </section>

            {/* ── 3. DEMANDA POR SERVIÇO E ESPECIALIDADE ───────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Demanda por serviço e especialidade</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Pedidos por serviço" nota="Quantidade de pedidos" vazio={!dados.porServico.length}>
                  <GraficoBarras
                    dados={dados.porServico}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedido(s)`}
                    cor="#2563eb"
                  />
                </Painel>
                <Painel titulo="Pedidos por especialidade" nota="Quantidade de pedidos" vazio={!dados.porEspecialidade.length}>
                  <GraficoBarras
                    dados={dados.porEspecialidade}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedido(s)`}
                    cor="#0f766e"
                  />
                </Painel>
                <Painel titulo="10 especialidades com maior demanda" nota="Maiores volumes" vazio={!top10Especialidades.length}>
                  <GraficoBarras
                    dados={top10Especialidades}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedido(s)`}
                    cor="#8b5cf6"
                  />
                </Painel>
                <Painel titulo="Distribuição por situação" nota="Todos os pedidos filtrados" vazio={!dados.porSituacao.length}>
                  <GraficoRosca dados={dados.porSituacao} />
                </Painel>
                <Painel titulo="Evolução mensal de novos pedidos" nota="Entradas por mês de cadastro" vazio={!dados.evolucao.length}>
                  <GraficoColunas
                    dados={dados.evolucao}
                    campo="entradas"
                    formatar={(d) => nf(d.entradas)}
                    rotulo="Novos pedidos por mês"
                    cor="#2563eb"
                  />
                </Painel>
              </div>
            </section>

            {/* ── 4. TEMPO DE ESPERA E ACÚMULO ─────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Tempo de espera e acúmulo de demanda</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Serviços com mais pedidos pendentes" nota="Falta e falta justificada" vazio={!dados.pendentesServico.length}>
                  <GraficoBarras
                    dados={dados.pendentesServico}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pendente(s)`}
                    cor="#ef4444"
                  />
                </Painel>
                <Painel titulo="Especialidades com maior tempo médio de espera" nota="Pendentes, em dias" vazio={!dados.esperaEspecialidade.length}>
                  <GraficoBarras
                    dados={dados.esperaEspecialidade}
                    valorDe={(d) => d.dias}
                    formatar={(d) => `${nf(d.dias)} d · ${nf(d.quantidade)} pedido(s)`}
                    cor="#f59e0b"
                  />
                </Painel>
                <Painel titulo="Evolução mensal de entradas e conclusões" nota="Por mês de cadastro" vazio={!dados.evolucao.length}>
                  <GraficoEntradasConclusoes dados={dados.evolucao} />
                </Painel>
                <Painel titulo="Pedidos pendentes por faixa de tempo" nota="Espera desde a entrada" vazio={!dados.envelhecimento.some((f) => f.quantidade)}>
                  <GraficoBarras
                    dados={dados.envelhecimento}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} pedido(s)`}
                    cor="#7c3aed"
                  />
                </Painel>
              </div>
            </section>

            {/* ── 5. MOVIMENTAÇÕES E PRODUTIVIDADE ─────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Movimentações e produtividade</h2>
              {dados.produtividade.length ? (
                <Painel titulo="Pedidos concluídos por responsável" nota="Somente a quantidade de conclusões" vazio={false}>
                  <GraficoBarras
                    dados={dados.produtividade}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} concluído(s)`}
                    cor="#0ea5e9"
                  />
                </Painel>
              ) : (
                <div className={styles.estadoInicial}>
                  <SearchX size={28} />
                  <p>Nenhum pedido possui responsável registrado na movimentação. A produtividade não pode ser calculada.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
