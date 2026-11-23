"use client";

// Dashboard de Processos Judiciais (Procedimentos Cirúrgicos + Bloqueios).
// Todos os números vêm agregados do backend (`obterDashboardProcessos`).
// Estrutura: filtros → indicadores principais → evolução mensal → gráficos por
// procedimento/especialidade → indicadores financeiros e complementares.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, SearchX } from "lucide-react";
import {
  obterDashboardProcessos,
  obterCatalogoDashboardProcessos,
} from "./actions";
import consultaStyles from "../ConsultarProcessos.module.css";
import styles from "./DashboardProcessos.module.css";

// O filtro por procedimento/especialidade usa o NOME: processos antigos podem
// ter `procedimento_id`/`especialidade_id` nulos (catálogo recriado), mas o nome
// de espelho gravado no processo sempre existe. Filtrar por id esconderia esses
// processos da consulta.
const FILTROS_VAZIOS = {
  dataInicio: "",
  dataFim: "",
  especialidade: "",
  procedimento: "",
  status: "todos",
  possuiBloqueio: "todos",
};

// Dinheiro: a API devolve string decimal (NUMERIC) — formata em R$ sem float
// impreciso (centavos a partir dos dígitos).
const formatarMoeda = (valor) => {
  const s = String(valor ?? "0");
  const negativo = s.startsWith("-");
  const [inteiro, decimal = ""] = s.replace("-", "").split(".");
  const centavos = (decimal + "00").slice(0, 2);
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}R$ ${milhares},${centavos}`;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m) => {
  const [ano, mes] = String(m).split("-");
  return `${MESES[Number(mes) - 1] || mes}/${String(ano).slice(2)}`;
};

const ROTULO_STATUS = { ATIVO: "Ativo", INATIVO: "Inativo" };

export default function DashboardProcessos() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [catalogo, setCatalogo] = useState({ especialidades: [], procedimentos: [], vinculos: [] });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (atuais) => {
    setCarregando(true);
    setErro("");
    const res = await obterDashboardProcessos(atuais);
    if (!res?.success) {
      setErro(res?.error || "Não foi possível carregar o dashboard.");
      setDados(null);
    } else {
      setDados(res);
    }
    setCarregando(false);
  }, []);

  // Catálogo dos filtros + primeira carga (sem filtros = todos). O estado só
  // é alterado depois do await, nunca de forma síncrona no efeito.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cat, res] = await Promise.all([
        obterCatalogoDashboardProcessos(),
        obterDashboardProcessos(FILTROS_VAZIOS),
      ]);
      if (!ativo) return;
      if (cat?.success) {
        setCatalogo({
          especialidades: cat.especialidades || [],
          procedimentos: cat.procedimentos || [],
          vinculos: cat.vinculos || [],
        });
      }
      if (res?.success) {
        setDados(res);
        setErro("");
      } else {
        setErro(res?.error || "Não foi possível carregar o dashboard.");
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const alterarFiltro = (campo, valor) =>
    setFiltros((f) => {
      // Ao trocar a especialidade, o procedimento escolhido é descartado se não
      // pertencer ao novo vínculo (evita filtro impossível).
      if (campo === "especialidade" && valor) {
        const nomePorId = new Map(catalogo.procedimentos.map((p) => [String(p.id), p.nome]));
        const permitidos = catalogo.vinculos
          .filter(
            (v) =>
              catalogo.especialidades.find((e) => String(e.id) === String(v.especialidadeId))?.nome ===
              valor,
          )
          .map((v) => nomePorId.get(String(v.procedimentoId)));
        if (f.procedimento && !permitidos.includes(f.procedimento)) {
          return { ...f, especialidade: valor, procedimento: "" };
        }
      }
      return { ...f, [campo]: valor };
    });

  // Procedimentos do filtro: sem especialidade → todos; com especialidade →
  // somente os vinculados a ela. O procedimento pode ser escolhido sozinho.
  const procedimentosVisiveis = useMemo(() => {
    if (!filtros.especialidade) return catalogo.procedimentos;
    const esp = catalogo.especialidades.find((e) => e.nome === filtros.especialidade);
    if (!esp) return catalogo.procedimentos;
    const permitidos = new Set(
      catalogo.vinculos
        .filter((v) => String(v.especialidadeId) === String(esp.id))
        .map((v) => String(v.procedimentoId)),
    );
    return catalogo.procedimentos.filter((p) => permitidos.has(String(p.id)));
  }, [catalogo, filtros.especialidade]);

  const filtrar = (e) => {
    e?.preventDefault?.();
    carregar(filtros);
  };

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    carregar(FILTROS_VAZIOS);
  };

  const ind = dados?.indicadores;
  const semDados = dados && ind && ind.totalProcessos === 0;

  return (
    <div className={consultaStyles.container}>
      <div className={consultaStyles.mainWrapper}>
        <h2 className={styles.titulo}>Dashboard de Processos Judiciais</h2>
        <p className={styles.subtitulo}>
          Indicadores de Procedimentos Cirúrgicos e Bloqueios Judiciais calculados
          diretamente no banco de dados.
        </p>

        {erro && (
          <div className={consultaStyles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── 1. FILTROS GERAIS ───────────────────────────────────────────── */}
        <form className={consultaStyles.cardFiltros} onSubmit={filtrar}>
          <div className={consultaStyles.cardFiltrosHeader}>
            <h4>Filtros do Dashboard</h4>
          </div>

          <div className={`${consultaStyles.gridFiltros} ${styles.gridDashboard}`}>
            <div className={`${consultaStyles.fieldGroup} ${styles.colPeriodo}`}>
              <label>Período do cadastro</label>
              <div className={consultaStyles.periodo}>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
                  aria-label="Data inicial do cadastro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => alterarFiltro("dataFim", e.target.value)}
                  aria-label="Data final do cadastro"
                />
              </div>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${styles.colEspecialidade}`}>
              <label>Especialidade</label>
              <select
                value={filtros.especialidade}
                onChange={(e) => alterarFiltro("especialidade", e.target.value)}
              >
                <option value="">Todas as especialidades</option>
                {catalogo.especialidades.map((esp) => (
                  <option key={esp.id} value={esp.nome}>
                    {esp.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${styles.colProcedimento}`}>
              <label>Procedimento</label>
              <select
                value={filtros.procedimento}
                onChange={(e) => alterarFiltro("procedimento", e.target.value)}
              >
                <option value="">Todos os procedimentos</option>
                {procedimentosVisiveis.map((p) => (
                  <option key={p.id} value={p.nome}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${styles.colStatus}`}>
              <label>Status do Processo</label>
              <select
                value={filtros.status}
                onChange={(e) => alterarFiltro("status", e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${styles.colBloqueio}`}>
              <label>Possui Bloqueio</label>
              <select
                value={filtros.possuiBloqueio}
                onChange={(e) => alterarFiltro("possuiBloqueio", e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            <div className={`${consultaStyles.filtrosAcoes} ${styles.acoesDashboard}`}>
              <button type="submit" className={consultaStyles.btnPrimario} disabled={carregando}>
                <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
                {carregando ? "Filtrando…" : "Filtrar"}
              </button>
              <button
                type="button"
                className={consultaStyles.btnGhost}
                onClick={limpar}
                disabled={carregando}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {/* ── CARREGANDO ──────────────────────────────────────────────────── */}
        {carregando && !dados && (
          <div className={consultaStyles.estadoInicial}>
            <div className={styles.spinner} aria-hidden="true" />
            <h3>Carregando indicadores…</h3>
          </div>
        )}

        {/* ── SEM DADOS PARA OS FILTROS ───────────────────────────────────── */}
        {!carregando && semDados && (
          <div className={consultaStyles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhum processo encontrado</h3>
            <p>Nenhum processo corresponde aos filtros selecionados.</p>
          </div>
        )}

        {/* ── 2. INDICADORES PRINCIPAIS ───────────────────────────────────── */}
        {dados && !semDados && (
          <>
            <div className={styles.cardsGrid}>
              <Card titulo="Total de processos" valor={ind.totalProcessos} />
              <Card titulo="Processos ativos" valor={ind.ativos} tom="ativo" />
              <Card titulo="Processos inativos" valor={ind.inativos} tom="inativo" />
              <Card titulo="Processos com bloqueio" valor={ind.processosComBloqueio} />
              <Card
                titulo="Percentual com bloqueio"
                valor={`${String(ind.percentualComBloqueio).replace(".", ",")}%`}
              />
              <Card titulo="Valor total dos bloqueios" valor={formatarMoeda(ind.valorTotalBloqueios)} tom="financeiro" />
            </div>

            {/* ── 3. EVOLUÇÃO MENSAL ───────────────────────────────────────── */}
            <section className={styles.painel}>
              <h3 className={styles.painelTitulo}>Evolução mensal</h3>
              <p className={styles.painelNota}>
                Processos pelo mês do <strong>cadastro</strong>; bloqueios pelo mês da{" "}
                <strong>data do bloqueio</strong>.
              </p>
              {dados.evolucao.length === 0 ? (
                <p className={styles.vazio}>Sem registros no período.</p>
              ) : (
                <GraficoLinhas dados={dados.evolucao} />
              )}
            </section>

            {/* ── 4. GRÁFICOS POR PROCEDIMENTO E ESPECIALIDADE ─────────────── */}
            <div className={styles.graficosGrid}>
              <section className={styles.painel}>
                <h3 className={styles.painelTitulo}>Processos por procedimento</h3>
                <GraficoBarras
                  dados={dados.porProcedimento}
                  rotuloValor={(v) => String(v)}
                  onClique={(nome) => {
                    const novos = { ...filtros, procedimento: nome };
                    setFiltros(novos);
                    carregar(novos);
                  }}
                />
              </section>

              <section className={styles.painel}>
                <h3 className={styles.painelTitulo}>Processos por especialidade</h3>
                <GraficoBarras
                  dados={dados.porEspecialidade}
                  rotuloValor={(v) => String(v)}
                  onClique={(nome) => {
                    const novos = { ...filtros, especialidade: nome, procedimento: "" };
                    setFiltros(novos);
                    carregar(novos);
                  }}
                />
              </section>

              <section className={styles.painel}>
                <h3 className={styles.painelTitulo}>Situação dos processos</h3>
                <GraficoRosca dados={dados.porStatus} />
              </section>

              <section className={styles.painel}>
                <h3 className={styles.painelTitulo}>Bloqueios por procedimento</h3>
                <p className={styles.painelNota}>Valor acumulado em R$ por procedimento.</p>
                <GraficoBarras
                  dados={dados.bloqueiosPorProcedimento.map((b) => ({
                    nome: b.nome,
                    quantidade: Number(b.valor),
                  }))}
                  rotuloValor={(v) => formatarMoeda(v)}
                  onClique={(nome) => {
                    const novos = { ...filtros, procedimento: nome };
                    setFiltros(novos);
                    carregar(novos);
                  }}
                />
              </section>
            </div>

            {/* ── 5. INDICADORES FINANCEIROS E COMPLEMENTARES ──────────────── */}
            <section className={styles.painel}>
              <h3 className={styles.painelTitulo}>Indicadores complementares</h3>
              <div className={styles.complementares}>
                <Linha rotulo="Quantidade total de bloqueios" valor={ind.totalBloqueios} />
                <Linha
                  rotulo="Média de bloqueios por processo com bloqueio"
                  valor={String(ind.mediaBloqueiosPorProcesso).replace(".", ",")}
                />
                <Linha
                  rotulo="Valor médio por bloqueio"
                  valor={formatarMoeda(ind.valorMedioPorBloqueio)}
                />
                <Linha
                  rotulo="Procedimento com mais processos"
                  valor={ind.procedimentoMaisProcessos || "—"}
                />
                <Linha
                  rotulo="Procedimento com maior valor em bloqueios"
                  valor={ind.procedimentoMaiorValorBloqueios || "—"}
                />
                <Linha rotulo="Pacientes distintos vinculados" valor={ind.pacientesDistintos} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ titulo, valor, nota, tom = "" }) {
  return (
    <div className={`${styles.card} ${tom ? styles[`card_${tom}`] : ""}`}>
      <span className={styles.cardTitulo}>{titulo}</span>
      <strong className={styles.cardValor}>{valor}</strong>
      {nota && <span className={styles.cardNota}>{nota}</span>}
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className={styles.linhaIndicador}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

// Gráfico de linhas em SVG (sem dependências novas): processos e bloqueios.
function GraficoLinhas({ dados }) {
  const largura = 760;
  const altura = 220;
  const pad = { top: 16, right: 16, bottom: 34, left: 36 };
  const max = Math.max(1, ...dados.map((d) => Math.max(d.processos, d.bloqueios)));
  const passoX =
    dados.length > 1 ? (largura - pad.left - pad.right) / (dados.length - 1) : 0;
  const x = (i) => pad.left + i * passoX;
  const y = (v) => pad.top + (altura - pad.top - pad.bottom) * (1 - v / max);
  const linha = (campo) =>
    dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[campo])}`).join(" ");

  return (
    <div className={styles.svgWrap}>
      <svg viewBox={`0 0 ${largura} ${altura}`} className={styles.svg} role="img" aria-label="Evolução mensal">
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={largura - pad.right}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        <path d={linha("processos")} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        <path d={linha("bloqueios")} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="6 4" />
        {dados.map((d, i) => (
          <g key={d.mes}>
            <circle cx={x(i)} cy={y(d.processos)} r="3.5" fill="#2563eb" />
            <circle cx={x(i)} cy={y(d.bloqueios)} r="3.5" fill="#16a34a" />
            <text x={x(i)} y={altura - 12} textAnchor="middle" fontSize="11" fill="#64748b">
              {rotuloMes(d.mes)}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.legenda}>
        <span><i className={styles.corProcesso} /> Processos cadastrados</span>
        <span><i className={styles.corBloqueio} /> Bloqueios registrados</span>
      </div>
    </div>
  );
}

// Gráfico de barras horizontais com valores reais; cada barra é clicável.
function GraficoBarras({ dados, rotuloValor, onClique }) {
  if (!dados || dados.length === 0) return <p className={styles.vazio}>Sem registros.</p>;
  const max = Math.max(1, ...dados.map((d) => d.quantidade));
  return (
    <ul className={styles.barras}>
      {dados.map((d) => (
        <li key={d.nome}>
          <button
            type="button"
            className={styles.barraItem}
            onClick={() => onClique?.(d.nome)}
            title={`Filtrar por ${d.nome}`}
          >
            <span className={styles.barraNome}>{d.nome}</span>
            <span className={styles.barraTrilho}>
              <span
                className={styles.barraPreenchida}
                style={{ width: `${Math.max(2, (d.quantidade / max) * 100)}%` }}
              />
            </span>
            <strong className={styles.barraValor}>{rotuloValor(d.quantidade)}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Rosca (donut) da situação dos processos.
function GraficoRosca({ dados }) {
  const total = dados.reduce((s, d) => s + d.quantidade, 0);
  if (!total) return <p className={styles.vazio}>Sem registros.</p>;
  const raio = 60;
  const circunferencia = 2 * Math.PI * raio;
  const cores = { ATIVO: "#2563eb", INATIVO: "#dc2626" };
  // Posição inicial de cada fatia, calculada antes do JSX (sem reatribuição).
  const offsets = dados.map((d, i) =>
    dados.slice(0, i).reduce((soma, x) => soma + (x.quantidade / total) * circunferencia, 0),
  );

  return (
    <div className={styles.roscaWrap}>
      <svg viewBox="0 0 160 160" className={styles.rosca} role="img" aria-label="Situação dos processos">
        <circle cx="80" cy="80" r={raio} fill="none" stroke="#e2e8f0" strokeWidth="20" />
        {dados.map((d, i) => {
          const dash = (d.quantidade / total) * circunferencia;
          return (
            <circle
              key={d.nome}
              cx="80"
              cy="80"
              r={raio}
              fill="none"
              stroke={cores[d.nome] || "#94a3b8"}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circunferencia - dash}`}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 80 80)"
            />
          );
        })}
        <text x="80" y="78" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fill="#64748b">
          processos
        </text>
      </svg>
      <ul className={styles.legendaRosca}>
        {dados.map((d) => (
          <li key={d.nome}>
            <i style={{ background: cores[d.nome] || "#94a3b8" }} />
            {ROTULO_STATUS[d.nome] || d.nome}: <strong>{d.quantidade}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
