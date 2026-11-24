"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, SearchX, FileDown } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import {
  listarEsporotricoseConsulta,
  obterFiltrosEsporotricose,
  obterEsporotricose,
} from "./actions";
import { gerarPdfEsporotricose } from "./esporotricosePdf";

// CCZ > Zoonoses > Esporotricose — Consultar Registros
// Mesmo padrão visual e funcional de Leishmaniose > Consultar Registros
// (container de filtros, busca suspensa, estado inicial com lupa, tabela com
// linha clicável, paginação de 100 no backend). Somente leitura.
const FILTROS_VAZIOS = {
  busca: "",
  periodoInicio: "",
  periodoFim: "",
  conclusao: "",
  bairro: "",
};

const CONCLUSAO_LABEL = {
  ENCERRADO: "Encerrado",
  EM_ANDAMENTO: "Em andamento",
};

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "—");

export default function ConsultarEsporotricose() {
  const notify = useNotify();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [bairros, setBairros] = useState([]);

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  useEffect(() => {
    let ativo = true;
    obterFiltrosEsporotricose().then((res) => {
      if (ativo && res?.success) setBairros(res.bairros || []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await listarEsporotricoseConsulta({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar os registros.");
    }
  }, []);

  const alterarFiltro = (campo, valor) =>
    setFiltros((f) => ({ ...f, [campo]: valor }));

  const filtrar = (e) => {
    e.preventDefault();
    consultar(1, filtros);
  };

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setErro("");
  };

  const abrirDetalhe = async (id) => {
    setCarregandoDetalhe(true);
    setDetalhe(null);
    const res = await obterEsporotricose(id);
    setCarregandoDetalhe(false);
    if (res?.success) setDetalhe(res.data);
    else notify.error(res?.error || "Registro não encontrado.");
  };

  const baixarPdf = (registro) => {
    try {
      gerarPdfEsporotricose(registro);
    } catch (e) {
      console.error(e);
      notify.error("Não foi possível gerar o PDF.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {erro && (
          <div className={styles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── FILTROS ─────────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h4>Filtros da Consulta</h4>
          </div>

          <div className={styles.gridFiltros}>
            <div className={`${styles.fieldGroup} ${styles.colBuscaRegistro}`}>
              <label>Buscar Registro</label>
              <input
                value={filtros.busca}
                onChange={(e) => alterarFiltro("busca", e.target.value)}
                placeholder="Digite o nome ou ID do animal, nome ou CPF do tutor..."
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colEspecialidade}`}>
              <label>Conclusão</label>
              <select
                value={filtros.conclusao}
                onChange={(e) => alterarFiltro("conclusao", e.target.value)}
              >
                <option value="">Todas</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="ENCERRADO">Encerrado</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colBuscaRegistro}`}>
              <label>Bairro</label>
              <select
                value={filtros.bairro}
                onChange={(e) => alterarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colPeriodoCadastro}`}>
              <label>Período do Registro</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial do registro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final do registro"
                />
              </div>
            </div>

            <div className={styles.filtrosAcoes}>
              <button type="submit" className={styles.btnPrimario} disabled={consultando}>
                <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
                {consultando ? "Filtrando…" : "Filtrar"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={limpar}
                disabled={consultando}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {/* ── ESTADO INICIAL ──────────────────────────────────────────────── */}
        {!resultado && (
          <div className={styles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhuma consulta realizada</h3>
            <p>
              Selecione os filtros ou clique em Filtrar para consultar todos os
              registros.
            </p>
          </div>
        )}

        {/* ── RESULTADOS ──────────────────────────────────────────────────── */}
        {resultado && (
          <div className={styles.resultados}>
            <div className={styles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1 ? "registro encontrado" : "registros encontrados"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data do Registro</th>
                    <th>Nome do Animal</th>
                    <th>ID CCZ</th>
                    <th>Nome do Tutor</th>
                    <th>Conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.tabelaVazia}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {resultado.data.map((r) => (
                    <tr
                      key={r.id}
                      className={styles.linhaClicavel}
                      onClick={() => abrirDetalhe(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhe(r.id);
                      }}
                      title="Clique para ver o registro completo"
                    >
                      <td>{formatarData(r.dataVisita)}</td>
                      <td>{r.animalNome || "Sem nome"}</td>
                      <td>{r.animalId || "—"}</td>
                      <td>{r.tutorNome || "Sem tutor"}</td>
                      <td>{CONCLUSAO_LABEL[r.encerrado ? "ENCERRADO" : "EM_ANDAMENTO"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.paginacao}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina <= 1 || consultando}
                onClick={() => consultar(resultado.pagina - 1, filtros)}
              >
                ← Anterior
              </button>
              <span>
                Página {resultado.pagina} de {resultado.totalPaginas}
              </span>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina >= resultado.totalPaginas || consultando}
                onClick={() => consultar(resultado.pagina + 1, filtros)}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── VISUALIZAÇÃO COMPLETA (somente leitura) ───────────────────────── */}
      {(carregandoDetalhe || detalhe) && (
        <div
          className={styles.painelFundo}
          role="presentation"
          onClick={() => setDetalhe(null)}
        >
          <div
            className={styles.painelDetalhe}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do registro de esporotricose"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoDetalhe && !detalhe && (
              <p className={styles.vazio}>Carregando registro...</p>
            )}

            {detalhe && (
              <>
                <div className={styles.painelTopo}>
                  <h3>Registro de Esporotricose</h3>
                  <button
                    type="button"
                    className={styles.btnFechar}
                    onClick={() => setDetalhe(null)}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>

                <div className={styles.corpoDetalhe}>
                  <Bloco titulo="1. Informações da Visita" css={styles}>
                    <Campo label="Data da Visita" valor={formatarData(detalhe.dataVisita)} css={styles} />
                    <Campo label="Fiscal Responsável" valor={detalhe.fiscalResponsavel} css={styles} />
                    <Campo
                      label="Conclusão"
                      valor={detalhe.encerrado ? "Encerrado" : "Em andamento"}
                      css={styles}
                    />
                    <Campo label="Encerrado por" valor={detalhe.encerradoPor} css={styles} />
                  </Bloco>

                  <Bloco titulo="2. Identificação do Animal" css={styles}>
                    <Campo label="Nome do Animal" valor={detalhe.animal?.nome || "Sem nome"} css={styles} />
                    <Campo label="ID CCZ" valor={detalhe.animalId} css={styles} />
                    <Campo label="Espécie" valor={detalhe.animal?.especie} css={styles} />
                    <Campo label="Sexo" valor={detalhe.animal?.sexo} css={styles} />
                    <Campo label="Porte" valor={detalhe.animal?.porte} css={styles} />
                    <Campo label="Idade" valor={detalhe.animal?.idade} css={styles} />
                  </Bloco>

                  {detalhe.temTutor && (
                    <Bloco titulo="3. Identificação do Responsável pelo Animal" css={styles}>
                      <Campo label="Nome do tutor" valor={detalhe.tutorNome} css={styles} />
                      <Campo label="CPF" valor={detalhe.tutor?.cpf} css={styles} />
                      <Campo label="Telefone" valor={detalhe.tutor?.telefone} css={styles} />
                      <Campo label="Endereço" valor={detalhe.endereco} css={styles} largo />
                    </Bloco>
                  )}

                  <Bloco titulo="4. Condição Clínica e Tratamento" css={styles}>
                    <Campo label="Apresenta lesões" valor={detalhe.apresentaLesoes} css={styles} />
                    <Campo label="Em tratamento veterinário" valor={detalhe.emTratamentoVeterinario} css={styles} />
                    <Campo label="Interrupção do tratamento" valor={detalhe.interrupcaoTratamento} css={styles} />
                    <Campo label="Retorno veterinário" valor={detalhe.retornoVeterinario} css={styles} />
                    <Campo label="Descrição das lesões" valor={detalhe.descricaoLesoes} css={styles} largo />
                    <Campo label="Descrição do tratamento" valor={detalhe.descricaoTratamentoVet} css={styles} largo />
                    <Campo label="Medicamentos prescritos" valor={detalhe.medicamentosPrescritos} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="5. Manejo e Biossegurança" css={styles}>
                    <Campo label="Isolamento domiciliar" valor={detalhe.isolamentoDomiciliar} css={styles} />
                    <Campo label="Acesso à rua" valor={detalhe.acessoRua} css={styles} />
                    <Campo label="Uso de EPI" valor={detalhe.usoEpi} css={styles} />
                    <Campo label="Quais EPIs" valor={detalhe.quaisEpis} css={styles} />
                    <Campo label="Observações do isolamento" valor={detalhe.observacoesIsolamento} css={styles} largo />
                    <Campo label="Higienização do ambiente" valor={detalhe.higienizacaoAmbiente} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="6. Outros Animais e Pessoas na Residência" css={styles}>
                    <Campo label="Outros animais no domicílio" valor={detalhe.outrosAnimaisResidencia} css={styles} />
                    <Campo label="Pessoas com lesões" valor={detalhe.pessoasComLesoes} css={styles} />
                    <Campo label="Espécies e quantidades" valor={detalhe.outrosAnimaisDescricao} css={styles} largo />
                    <Campo label="Descrição das lesões em pessoas" valor={detalhe.pessoasLesoesDescricao} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="7. Condições do Ambiente" css={styles}>
                    <Campo label="Condições gerais do ambiente" valor={detalhe.condicoesGeraisAmbiente} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="8. Orientações e Comprometimento" css={styles}>
                    <Campo label="Ciente do tratamento contínuo" valor={detalhe.cienteTratamentoContinuo} css={styles} />
                    <Campo label="Ciente da contenção" valor={detalhe.cienteContencao} css={styles} />
                    <Campo label="Ciente do uso de EPI" valor={detalhe.cienteEpi} css={styles} />
                    <Campo label="Ciente dos resíduos" valor={detalhe.cienteResiduos} css={styles} />
                  </Bloco>

                  <Bloco titulo="9. Conclusão da Equipe Técnica" css={styles}>
                    <Campo label="Conclusão técnica" valor={detalhe.conclusaoTecnica} css={styles} largo />
                    <Campo
                      label="Encaminhamentos"
                      valor={[
                        detalhe.encAcompanhamentoCcz && "Acompanhamento pelo CCZ",
                        detalhe.encNotificacaoTutor && "Notificação ao tutor",
                        detalhe.encMinisterioPublico && "Ministério Público",
                        detalhe.encOutrasMedidas && "Outras medidas",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      css={styles}
                      largo
                    />
                    <Campo label="Descrição das outras medidas" valor={detalhe.outrasMedidasDescricao} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="10. Visitas e Encerramento" css={styles}>
                    <Campo
                      label="Visitas registradas"
                      valor={(detalhe.visitas || [])
                        .map((v) => `${formatarData(v.data)}${v.observacao ? ` — ${v.observacao}` : ""}`)
                        .join(" · ")}
                      css={styles}
                      largo
                    />
                    <Campo label="Incinerado" valor={detalhe.incinerado} css={styles} />
                  </Bloco>
                </div>

                <div className={styles.acoesDetalhe}>
                  <button
                    type="button"
                    className={styles.btnPrimario}
                    onClick={() => baixarPdf(detalhe)}
                  >
                    <FileDown size={16} /> Gerar PDF
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setDetalhe(null)}
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <div className={styles.cardSection}>
      <h4 className={styles.sectionHeaderTitle}>{titulo}</h4>
      <div className={styles.grid3}>{children}</div>
    </div>
  );
}

function Campo({ label, valor, largo = false, css }) {
  const texto = valor === null || valor === undefined || valor === "" ? "—" : String(valor);
  if (largo) {
    return (
      <div className={css.campoLeituraLargo}>
        <label>{label}</label>
        <textarea readOnly rows={2} value={texto} />
      </div>
    );
  }
  return (
    <div className={css.campoLeitura}>
      <label>{label}</label>
      <input readOnly value={texto} />
    </div>
  );
}
