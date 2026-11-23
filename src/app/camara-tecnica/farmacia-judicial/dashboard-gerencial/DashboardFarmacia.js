"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA FARMÁCIA JUDICIAL — interface
// Mesmo padrão visual dos dashboards da Regulação e de Processos Judiciais
// (filtros na 1ª linha, ações à direita na 2ª, cards e painéis, SVG/CSS puro).
// Todos os números vêm do backend (server actions); aqui só há formatação.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2, SearchX } from "lucide-react";
import styles from "@/app/regulacao/dashboard-gerencial/DashboardGerencial.module.css";
import { obterDashboardFarmacia, obterFiltrosDashboardFarmacia } from "./actions";

const FILTROS_VAZIOS = {
  cadastroInicio: "",
  cadastroFim: "",
  medicamentoId: "",
  situacao: "",
  dispensacaoInicio: "",
  dispensacaoFim: "",
};

const brl = (v) =>
  `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function GraficoColunas({ dados, campo, formatar, rotulo, cor }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const maximo = Math.max(1, ...dados.map((d) => Number(d[campo]) || 0));
  return (
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 760 190" className={styles.svg} role="img" aria-label={rotulo}>
        <line x1="0" y1="160" x2="760" y2="160" stroke="#e2e8f0" strokeWidth="1" />
        {dados.map((d, i) => {
          const passo = 760 / dados.length;
          const base = i * passo;
          const valor = Number(d[campo]) || 0;
          const altura = (valor / maximo) * 140;
          return (
            <g key={`${d.mes}-${i}`}>
              <rect
                x={base + passo * 0.25}
                y={160 - altura}
                width={passo * 0.5}
                height={Math.max(altura, 0.5)}
                rx="3"
                fill={cor || "#2563eb"}
              />
              <text x={base + passo / 2} y="178" textAnchor="middle" className={styles.eixoRotulo}>
                {rotuloMes(d.mes)}
              </text>
              <text x={base + passo / 2} y={152 - altura} textAnchor="middle" className={styles.eixoRotulo}>
                {formatar(d)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardFarmacia() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [catalogo, setCatalogo] = useState({ medicamentos: [], situacoes: [] });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);

  const carregar = useCallback(async (aplicados) => {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro("");
    const resposta = await obterDashboardFarmacia(aplicados);
    if (id !== requisicao.current) return;
    if (resposta?.success) setDados(resposta);
    else setErro(resposta?.error || "Não foi possível carregar o dashboard.");
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cat] = await Promise.all([obterFiltrosDashboardFarmacia(), carregar(FILTROS_VAZIOS)]);
      if (!ativo) return;
      if (cat?.success) {
        setCatalogo({
          medicamentos: cat.medicamentos || [],
          situacoes: cat.situacoes || [],
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

  const ind = dados?.indicadores || {};
  const disp = dados?.dispensacoes || { porMedicamento: [], evolucao: [] };
  const estoque = dados?.estoque || { saidas: [], vencimento: [] };
  const fin = dados?.financeiro || { comprasMes: [], porMedicamento: [] };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* ── 1. FILTROS ─────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h2>FILTROS DO DASHBOARD</h2>
          </div>
          <div className={styles.gridFiltrosFarmacia}>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período do Cadastro</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial do cadastro"
                  value={filtros.cadastroInicio}
                  onChange={(e) => alterar("cadastroInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final do cadastro"
                  value={filtros.cadastroFim}
                  onChange={(e) => alterar("cadastroFim", e.target.value)}
                />
              </div>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="df-med">Medicamento</label>
              <select id="df-med" value={filtros.medicamentoId} onChange={(e) => alterar("medicamentoId", e.target.value)}>
                <option value="">Todos</option>
                {catalogo.medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="df-situacao">Situação do Processo</label>
              <select id="df-situacao" value={filtros.situacao} onChange={(e) => alterar("situacao", e.target.value)}>
                <option value="">Todas</option>
                {catalogo.situacoes.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoPeriodo}>
              <span className={styles.rotuloPeriodo}>Período da Dispensação</span>
              <div className={styles.periodo}>
                <input
                  type="date"
                  aria-label="Data inicial da dispensação"
                  value={filtros.dispensacaoInicio}
                  onChange={(e) => alterar("dispensacaoInicio", e.target.value)}
                />
                <span className={styles.ate}>até</span>
                <input
                  type="date"
                  aria-label="Data final da dispensação"
                  value={filtros.dispensacaoFim}
                  onChange={(e) => alterar("dispensacaoFim", e.target.value)}
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
                <Card titulo="Processos cadastrados" valor={nf(ind.processos)} nota="Farmácia Judicial" />
                <Card titulo="Processos ativos" valor={nf(ind.ativos)} nota="Situação do processo" variante="card_ativo" />
                <Card titulo="Processos inativos" valor={nf(ind.inativos)} nota="Situação do processo" variante="card_inativo" />
                <Card titulo="Dispensações realizadas" valor={nf(ind.dispensacoes)} nota="Entregas registradas" />
                <Card
                  titulo="Valor total das compras"
                  valor={brl(ind.valorCompras)}
                  nota={`${nf(ind.lotesComprados)} lotes registrados`}
                  variante="card_financeiro"
                />
                <Card
                  titulo="Valor estimado do estoque"
                  valor={brl(ind.valorEstoque)}
                  nota={
                    ind.lotesValorizados > 0
                      ? `${nf(ind.lotesValorizados)} lotes com saldo e validade`
                      : "Sem lotes valorizados"
                  }
                  variante="card_financeiro"
                />
              </div>
            </section>

            {/* ── 3. MEDICAMENTOS E DISPENSAÇÕES ───────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Medicamentos e dispensações</h2>
              <div className={styles.graficosGrid}>
                <Painel
                  titulo="Medicamentos mais dispensados"
                  nota="10 maiores volumes, por apresentação"
                  vazio={!disp.porMedicamento.length}
                >
                  <GraficoBarras
                    dados={disp.porMedicamento}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} un. · ${nf(d.entregas)} entr.`}
                    cor="#0f766e"
                  />
                </Painel>
                <Painel titulo="Evolução mensal das dispensações" nota="Entregas por mês" vazio={!disp.evolucao.length}>
                  <GraficoColunas
                    dados={disp.evolucao}
                    campo="quantidade"
                    formatar={(d) => nf(d.quantidade)}
                    rotulo="Dispensações por mês"
                    cor="#2563eb"
                  />
                </Painel>
                <Painel
                  titulo="Medicamentos mais vinculados aos processos"
                  nota="Processos ativos com o medicamento"
                  vazio={!dados.vinculados.length}
                >
                  <GraficoBarras
                    dados={dados.vinculados}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} ${d.quantidade === 1 ? "processo" : "processos"}`}
                    cor="#8b5cf6"
                  />
                </Painel>
              </div>
            </section>

            {/* ── 4. SITUAÇÃO DO ESTOQUE ───────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Situação do estoque</h2>
              <div className={styles.cardsGrid}>
                <Card titulo="Medicamentos no estoque" valor={nf(ind.medicamentosEstoque)} nota="Cadastrados" />
                <Card
                  titulo="Saldo zerado"
                  valor={nf(ind.medicamentosZerados)}
                  nota="Sem unidades disponíveis"
                  variante="card_inativo"
                />
                <Card titulo="Unidades disponíveis" valor={nf(ind.unidadesDisponiveis)} nota="Saldo consolidado" variante="card_ativo" />
              </div>
              <div className={styles.graficosGrid}>
                <Painel titulo="Maior movimentação de saída" nota="Unidades dispensadas no período" vazio={!estoque.saidas.length}>
                  <GraficoBarras
                    dados={estoque.saidas}
                    valorDe={(d) => d.quantidade}
                    formatar={(d) => `${nf(d.quantidade)} un.`}
                    cor="#ef4444"
                  />
                </Painel>
                <Painel
                  titulo="Próximos do vencimento"
                  nota="Lotes com saldo, validade em até 90 dias"
                  vazio={!estoque.vencimento.length}
                >
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Medicamento</th>
                          <th>Lote</th>
                          <th>Validade</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estoque.vencimento.map((l, i) => (
                          <tr key={`${l.nome}-${l.lote}-${i}`}>
                            <td>{l.nome}</td>
                            <td>{l.lote}</td>
                            <td>{String(l.validade || "").split("-").reverse().join("/")}</td>
                            <td>{nf(l.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Painel>
              </div>
            </section>

            {/* ── 5. GESTÃO FINANCEIRA ─────────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Gestão financeira</h2>
              <div className={styles.cardsGrid}>
                <Card
                  titulo="Valor total de compras"
                  valor={brl(ind.valorCompras)}
                  nota="Entradas de lotes (qtd × valor unitário)"
                  variante="card_financeiro"
                />
                <Card
                  titulo="Valor estimado do estoque disponível"
                  valor={brl(ind.valorEstoque)}
                  nota="Saldo por lote, FEFO, não vencidos"
                  variante="card_financeiro"
                />
              </div>
              <div className={styles.graficosGrid}>
                <Painel titulo="Evolução mensal dos valores de compras" nota="Por mês de entrada do lote" vazio={!fin.comprasMes.length}>
                  <GraficoColunas
                    dados={fin.comprasMes}
                    campo="valor"
                    formatar={(d) => brl(d.valor)}
                    rotulo="Valores de compra por mês"
                    cor="#10b981"
                  />
                </Painel>
                <Painel titulo="Medicamentos com maior valor em compras" nota="Acumulado por medicamento" vazio={!fin.porMedicamento.length}>
                  <GraficoBarras
                    dados={fin.porMedicamento}
                    valorDe={(d) => d.valor}
                    formatar={(d) => `${brl(d.valor)} · ${nf(d.lotes)} lote(s)`}
                    cor="#0ea5e9"
                  />
                </Painel>
              </div>
            </section>

            {/* ── 6. INSIGHTS ──────────────────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Insights da Farmácia Judicial</h2>
              {dados.insights.length ? (
                <ul className={styles.insights}>
                  {dados.insights.map((frase) => (
                    <li key={frase}>{frase}</li>
                  ))}
                </ul>
              ) : (
                <div className={styles.estadoInicial}>
                  <SearchX size={28} />
                  <p>Sem dados suficientes para gerar insights com os filtros selecionados.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
