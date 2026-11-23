"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DO CCZ
// Mesmo padrão visual dos dashboards da Regulação, Junta, Processos Judiciais
// e Farmácia Judicial: filtros na 1ª linha, botões na 2ª à direita, cards,
// gráficos em SVG/CSS puro. Todos os números vêm do backend.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2, SearchX } from "lucide-react";
import styles from "@/app/regulacao/dashboard-gerencial/DashboardGerencial.module.css";
import { obterDashboardCcz, obterFiltrosDashboardCcz } from "./actions";

const FILTROS_VAZIOS = {
  cadastroInicio: "",
  cadastroFim: "",
  bairro: "",
  especie: "",
  sexo: "",
  situacaoAnimal: "",
  situacaoDenuncia: "",
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

function GraficoRosca({ dados, cores }) {
  if (!dados.length) return <div className={styles.vazio}>Sem dados para os filtros selecionados.</div>;
  const total = dados.reduce((s, d) => s + (Number(d.quantidade) || 0), 0) || 1;
  const CORES = cores || ["#2563eb", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
  const fracoes = dados.map((d) => (Number(d.quantidade) || 0) / total);
  const inicios = fracoes.map((_, i) => fracoes.slice(0, i).reduce((s, f) => s + f, 0));
  return (
    <div className={styles.roscaWrap}>
      <svg viewBox="0 0 42 42" className={styles.rosca} role="img" aria-label="Distribuição">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {dados.map((d, i) => (
          <circle
            key={`${d.nome}-${i}`}
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
          <li key={`${d.nome}-${i}`} className={styles.legendaLinha}>
            <i style={{ backgroundColor: CORES[i % CORES.length] }} />
            <span>{d.nome}</span>
            <strong>{nf(d.quantidade)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardCcz() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [catalogo, setCatalogo] = useState({
    bairros: [],
    especies: [],
    sexos: [],
    situacoesAnimal: [],
    situacoesDenuncia: [],
  });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);

  const carregar = useCallback(async (aplicados) => {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro("");
    const resposta = await obterDashboardCcz(aplicados);
    if (id !== requisicao.current) return;
    if (resposta?.success) setDados(resposta);
    else setErro(resposta?.error || "Não foi possível carregar o dashboard.");
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cat] = await Promise.all([obterFiltrosDashboardCcz(), carregar(FILTROS_VAZIOS)]);
      if (!ativo) return;
      if (cat?.success) {
        setCatalogo({
          bairros: cat.bairros || [],
          especies: cat.especies || [],
          sexos: cat.sexos || [],
          situacoesAnimal: cat.situacoesAnimal || [],
          situacoesDenuncia: cat.situacoesDenuncia || [],
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
  const an = dados?.animais || { porEspecie: [], porSexo: [], porSituacao: [], castracao: [], bairros: [], evolucao: [] };
  const de = dados?.denuncias || { porSituacao: [], porBairro: [], porTipo: [], evolucao: [], pendentesPorBairro: [] };
  const ac = dados?.acoes || { porTipo: [], evolucao: [] };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* ── 1. FILTROS ─────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h2>FILTROS DO DASHBOARD</h2>
          </div>
          <div className={styles.gridFiltrosCcz}>
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
              <label htmlFor="dc-bairro">Bairro</label>
              <select id="dc-bairro" value={filtros.bairro} onChange={(e) => alterar("bairro", e.target.value)}>
                <option value="">Todos</option>
                {catalogo.bairros.map((b) => (
                  <option key={b.valor} value={b.valor}>{b.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dc-especie">Espécie do Animal</label>
              <select id="dc-especie" value={filtros.especie} onChange={(e) => alterar("especie", e.target.value)}>
                <option value="">Todas</option>
                {catalogo.especies.map((e) => (
                  <option key={e.valor} value={e.valor}>{e.rotulo}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dc-sexo">Sexo do Animal</label>
              <select id="dc-sexo" value={filtros.sexo} onChange={(e) => alterar("sexo", e.target.value)}>
                <option value="">Todos</option>
                {catalogo.sexos.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dc-sit-animal">Situação do Animal</label>
              <select
                id="dc-sit-animal"
                value={filtros.situacaoAnimal}
                onChange={(e) => alterar("situacaoAnimal", e.target.value)}
              >
                <option value="">Todas</option>
                {catalogo.situacoesAnimal.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label htmlFor="dc-sit-denuncia">Situação da Denúncia</label>
              <select
                id="dc-sit-denuncia"
                value={filtros.situacaoDenuncia}
                onChange={(e) => alterar("situacaoDenuncia", e.target.value)}
              >
                <option value="">Todas</option>
                {catalogo.situacoesDenuncia.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.rotulo}</option>
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
                <Card titulo="Animais cadastrados" valor={nf(ind.animais)} nota="Centro de Controle de Zoonoses" />
                <Card titulo="Tutores distintos" valor={nf(ind.tutores)} nota="Um por pessoa, mesmo com vários animais" />
                <Card titulo="Animais sem tutor" valor={nf(ind.semTutor)} nota="Sem vínculo de tutor" variante="card_inativo" />
                <Card titulo="Denúncias registradas" valor={nf(ind.denuncias)} nota="Todas as situações" />
                <Card titulo="Denúncias pendentes" valor={nf(ind.denunciasPendentes)} nota="Situação Ativa" variante="card_pendente" />
                <Card titulo="Denúncias arquivadas" valor={nf(ind.denunciasArquivadas)} nota="Arquivada ≠ concluída" variante="card_inativo" />
                <Card titulo="Casos de esporotricose" valor={nf(ind.casosEsporotricose)} nota={`${nf(ind.esporotricoseEncerrados)} encerrado(s)`} />
                <Card titulo="Visitas de esporotricose" valor={nf(ind.visitasEsporotricose)} nota="Vistorias registradas" variante="card_ativo" />
              </div>
            </section>

            {/* ── 3. PERFIL DOS ANIMAIS ────────────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Perfil dos animais</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Animais por espécie" nota="Cadastros filtrados" vazio={!an.porEspecie.length}>
                  <GraficoBarras dados={an.porEspecie} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} animal(is)`} cor="#2563eb" />
                </Painel>
                <Painel titulo="Animais por sexo" nota="Inclui não informados" vazio={!an.porSexo.length}>
                  <GraficoRosca dados={an.porSexo} cores={["#2563eb", "#db2777", "#f59e0b", "#94a3b8"]} />
                </Painel>
                <Painel titulo="Animais por situação" nota="Situação registrada no cadastro" vazio={!an.porSituacao.length}>
                  <GraficoRosca dados={an.porSituacao} cores={["#10b981", "#0ea5e9", "#f59e0b", "#94a3b8"]} />
                </Painel>
                <Painel titulo="Castração registrada" nota="Campo do cadastro do animal" vazio={!an.castracao.length}>
                  <GraficoRosca dados={an.castracao} cores={["#8b5cf6", "#94a3b8"]} />
                </Painel>
                <Painel titulo="10 bairros com mais animais" nota="Bairro do endereço atual do tutor" vazio={!an.bairros.length}>
                  <GraficoBarras dados={an.bairros} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} animal(is)`} cor="#0f766e" />
                </Painel>
                <Painel titulo="Evolução dos cadastros" nota="Novos animais por mês" vazio={!an.evolucao.length}>
                  <GraficoColunas dados={an.evolucao} campo="quantidade" formatar={(d) => nf(d.quantidade)} rotulo="Novos animais por mês" cor="#2563eb" />
                </Painel>
              </div>
            </section>

            {/* ── 4. DENÚNCIAS E OCORRÊNCIAS ───────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Denúncias e ocorrências</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Denúncias por situação" nota="Ativa × arquivada" vazio={!de.porSituacao.length}>
                  <GraficoRosca dados={de.porSituacao} cores={["#ef4444", "#94a3b8"]} />
                </Painel>
                <Painel titulo="Denúncias por tipo" nota="Classificação registrada" vazio={!de.porTipo.length}>
                  <GraficoBarras dados={de.porTipo} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} denúncia(s)`} cor="#dc2626" />
                </Painel>
                <Painel titulo="Denúncias por bairro" nota="Bairro do local da ocorrência" vazio={!de.porBairro.length}>
                  <GraficoBarras dados={de.porBairro} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} denúncia(s)`} cor="#f59e0b" />
                </Painel>
                <Painel titulo="Evolução mensal de denúncias" nota="Denúncias recebidas por mês" vazio={!de.evolucao.length}>
                  <GraficoColunas dados={de.evolucao} campo="quantidade" formatar={(d) => nf(d.quantidade)} rotulo="Denúncias por mês" cor="#dc2626" />
                </Painel>
                <Painel titulo="Bairros com mais denúncias pendentes" nota="Somente situação Ativa" vazio={!de.pendentesPorBairro.length}>
                  <GraficoBarras dados={de.pendentesPorBairro} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} pendente(s)`} cor="#b91c1c" />
                </Painel>
                <Painel titulo="Tempo médio para conclusão" nota="Abertura → encerramento" vazio>
                  <div className={styles.vazio}>
                    O sistema não registra conclusão nem data de encerramento de denúncias — apenas arquivamento. Indicador não calculado.
                  </div>
                </Painel>
              </div>
            </section>

            {/* ── 5. ATENDIMENTOS E AÇÕES REALIZADAS ───────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Atendimentos e ações realizadas</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Ações realizadas por tipo" nota="Procedimentos com status Realizado" vazio={!ac.porTipo.length}>
                  <GraficoBarras dados={ac.porTipo} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} realizado(s)`} cor="#0ea5e9" />
                </Painel>
                <Painel titulo="Evolução mensal das ações" nota="Procedimentos realizados por mês" vazio={!ac.evolucao.length}>
                  <GraficoColunas dados={ac.evolucao} campo="quantidade" formatar={(d) => nf(d.quantidade)} rotulo="Ações realizadas por mês" cor="#0ea5e9" />
                </Painel>
              </div>
            </section>

            {/* ── 6. DISTRIBUIÇÃO TERRITORIAL ──────────────────────────── */}
            <section className={styles.secao}>
              <h2 className={styles.secaoTitulo}>Distribuição territorial</h2>
              <div className={styles.graficosGrid}>
                <Painel titulo="Animais por bairro" nota="Bairro do endereço atual do tutor" vazio={!an.bairros.length}>
                  <GraficoBarras dados={an.bairros} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} animal(is)`} cor="#0f766e" />
                </Painel>
                <Painel titulo="Denúncias por bairro" nota="Bairro do local da ocorrência" vazio={!de.porBairro.length}>
                  <GraficoBarras dados={de.porBairro} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} denúncia(s)`} cor="#f59e0b" />
                </Painel>
                <Painel titulo="Denúncias pendentes por bairro" nota="Prioridade de atuação" vazio={!de.pendentesPorBairro.length}>
                  <GraficoBarras dados={de.pendentesPorBairro} valorDe={(d) => d.quantidade} formatar={(d) => `${nf(d.quantidade)} pendente(s)`} cor="#b91c1c" />
                </Painel>
                <Painel titulo="Mapa de ocorrências" nota="Coordenadas geográficas" vazio>
                  <div className={styles.vazio}>
                    Não há coordenadas geográficas registradas no banco. O endereço do tutor não é usado como local da denúncia.
                  </div>
                </Painel>
              </div>
            </section>

          </>
        ) : null}
      </div>
    </div>
  );
}
