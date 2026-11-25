"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, SearchX, FileDown, Ban, FileText } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  listarLeishmaniose,
  obterLeishmaniose,
  obterFiltrosLeishmaniose,
  encerrarCasoLeishmaniose,
} from "./leishmanioseActions";
import { gerarPdfLeishmaniose } from "./leishmaniosePdf";
import { gerarTermoLeishmaniose } from "./termoLeishmaniosePdf";

const FILTROS_VAZIOS = {
  busca: "",
  periodoInicio: "",
  periodoFim: "",
  situacaoGeral: "",
  situacaoCaso: "",
  bairro: "",
};

const SITUACOES_CASO = [
  { valor: "EM_ACOMPANHAMENTO", rotulo: "Em acompanhamento" },
  { valor: "ENCERRADO", rotulo: "Encerrado" },
];

const DESFECHOS = ["Curado", "Incinerado"];

const rotuloCaso = (v) =>
  SITUACOES_CASO.find((s) => s.valor === v)?.rotulo || "Em acompanhamento";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "—");

export default function ConsultarLeishmaniose() {
  const notify = useNotify();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [opcoes, setOpcoes] = useState({ situacoes: [], bairros: [] });

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const confirm = useConfirm();
  const [encerrando, setEncerrando] = useState(false);
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);
  const [formEncerramento, setFormEncerramento] = useState({
    desfecho: "",
    dataEncerramento: "",
    justificativa: "",
  });

  useEffect(() => {
    let ativo = true;
    obterFiltrosLeishmaniose().then((res) => {
      if (ativo && res?.success) {
        setOpcoes({ situacoes: res.situacoes || [], bairros: res.bairros || [] });
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await listarLeishmaniose({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar as fiscalizações.");
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
    const res = await obterLeishmaniose(id);
    setCarregandoDetalhe(false);
    if (res?.success) setDetalhe(res.data);
    else await notify({ tipo: "erro", message: res?.error || "Fiscalização não encontrada." });
  };

  // Mesmas regras do backend: desfecho, data válida e justificativa 15–500.
  const encerramentoValido =
    ["Curado", "Incinerado"].includes(formEncerramento.desfecho) &&
    /^\d{4}-\d{2}-\d{2}$/.test(formEncerramento.dataEncerramento) &&
    formEncerramento.justificativa.trim().length >= 15 &&
    formEncerramento.justificativa.trim().length <= 500;

  const abrirEncerramento = () => {
    setFormEncerramento({
      desfecho: "",
      dataEncerramento: new Date().toISOString().slice(0, 10),
      justificativa: "",
    });
    setEncerrando(true);
  };

  const confirmarEncerramento = async () => {
    if (salvandoEncerramento || !encerramentoValido) return;
    setSalvandoEncerramento(true);
    const res = await encerrarCasoLeishmaniose({ id: detalhe.id, ...formEncerramento });
    setSalvandoEncerramento(false);
    if (!res?.success) {
      await notify({ tipo: "erro", message: res?.error || "Não foi possível encerrar o caso." });
      return;
    }
    await notify({ tipo: "sucesso", message: "Caso encerrado com sucesso." });
    setEncerrando(false);
    const atualizado = await obterLeishmaniose(detalhe.id);
    if (atualizado?.success) setDetalhe(atualizado.data);
    if (resultado) await consultar(resultado.pagina, filtros);
  };

  const baixarTermo = async (registro) => {
    try {
      await gerarTermoLeishmaniose(registro);
    } catch (e) {
      console.error(e);
      await notify({ tipo: "erro", message: "Não foi possível gerar o termo." });
    }
  };

  const baixarPdf = async (registro) => {
    try {
      await gerarPdfLeishmaniose(registro);
    } catch (e) {
      console.error(e);
      await notify({ tipo: "erro", message: "Não foi possível gerar o PDF." });
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
              <label>Situação Geral</label>
              <select
                value={filtros.situacaoGeral}
                onChange={(e) => alterarFiltro("situacaoGeral", e.target.value)}
              >
                <option value="">Todas</option>
                {opcoes.situacoes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colStatus}`}>
              <label>Situação do Caso</label>
              <select
                value={filtros.situacaoCaso}
                onChange={(e) => alterarFiltro("situacaoCaso", e.target.value)}
              >
                <option value="">Todas</option>
                {SITUACOES_CASO.map((s2) => (
                  <option key={s2.valor} value={s2.valor}>
                    {s2.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colBuscaRegistro}`}>
              <label>Bairro</label>
              <select
                value={filtros.bairro}
                onChange={(e) => alterarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {opcoes.bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colPeriodoCadastro}`}>
              <label>Período da Fiscalização</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial da fiscalização"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final da fiscalização"
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
              Selecione os filtros ou clique em Filtrar para consultar todas as
              fiscalizações.
            </p>
          </div>
        )}

        {/* ── RESULTADOS ──────────────────────────────────────────────────── */}
        {resultado && (
          <div className={styles.resultados}>
            <div className={styles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1
                  ? "registro encontrado"
                  : "registros encontrados"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data da Fiscalização</th>
                    <th>Nome do Animal</th>
                    <th>ID CCZ</th>
                    <th>Nome do Tutor</th>
                    <th>Situação do Caso</th>
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
                      title="Clique para ver a fiscalização completa"
                    >
                      <td>{formatarData(r.dataFiscalizacao)}</td>
                      <td>{r.animalNome || "Sem nome"}</td>
                      <td>{r.animalId}</td>
                      <td>{r.tutorNome || "Sem tutor"}</td>
                      <td>
                        <span
                          className={
                            r.situacaoCaso === "ENCERRADO" ? styles.badgeEncerrado : styles.badgeAcompanhamento
                          }
                        >
                          {rotuloCaso(r.situacaoCaso)}
                        </span>
                        {r.situacaoCaso === "ENCERRADO" && r.desfecho && (
                          <span className={styles.badgeDesfecho}>{r.desfecho}</span>
                        )}
                      </td>
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
            aria-label="Detalhes da fiscalização"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoDetalhe && !detalhe && (
              <p className={styles.vazio}>Carregando fiscalização...</p>
            )}

            {detalhe && (
              <>
                <div className={styles.painelTopo}>
                  <h3>Fiscalização de Leishmaniose</h3>
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
                  <Bloco titulo="1. Informações da Fiscalização" css={styles}>
                    <Campo label="Data da Fiscalização" valor={formatarData(detalhe.dataFiscalizacao)} css={styles} />
                    <Campo label="Responsável pela Fiscalização" valor={detalhe.responsavelNome} css={styles} />
                    <Campo label="Cargo/Função" valor={detalhe.responsavelCargo} css={styles} />
                    <Campo
                      label="Equipe técnica"
                      valor={(detalhe.equipe || [])
                        .map((e) => `${e.nome}${e.cargo ? ` (${e.cargo})` : ""}`)
                        .join(" · ")}
                      css={styles}
                      largo
                    />
                  </Bloco>

                  <Bloco titulo="2. Identificação do Animal" css={styles}>
                    <Campo label="Nome do Animal" valor={detalhe.animalNome || "Sem nome"} css={styles} />
                    <Campo label="ID CCZ" valor={detalhe.animalId} css={styles} />
                    <Campo label="Espécie" valor={detalhe.animalEspecie} css={styles} />
                    <Campo label="Sexo" valor={detalhe.animalSexo} css={styles} />
                    <Campo label="Idade estimada" valor={detalhe.animalIdade} css={styles} />
                    <Campo label="Raça/Pelagem" valor={detalhe.animalRacaPelagem} css={styles} />
                    <Campo label="Possui identificação" valor={detalhe.animalIdentificacao} css={styles} />
                  </Bloco>

                  {detalhe.tutorNome && (
                    <Bloco titulo="3. Identificação do Responsável pelo Animal" css={styles}>
                      <Campo label="Nome do tutor" valor={detalhe.tutorNome} css={styles} />
                      <Campo label="CPF" valor={detalhe.tutorCpf} css={styles} />
                      <Campo label="Telefone" valor={detalhe.tutorTelefone} css={styles} />
                      <Campo label="Endereço" valor={detalhe.tutorEndereco} css={styles} largo />
                    </Bloco>
                  )}

                  <Bloco titulo="4. Condição Clínica e Tratamento" css={styles}>
                    <Campo label="Apresenta lesões" valor={detalhe.apresentaLesoes} css={styles} />
                    <Campo label="Quais lesões" valor={detalhe.quaisLesoes} css={styles} />
                    <Campo label="Em tratamento veterinário" valor={detalhe.emTratamento} css={styles} />
                    <Campo label="Início do tratamento" valor={formatarData(detalhe.tratamentoInicio)} css={styles} />
                    <Campo label="Profissional/Serviço de referência" valor={detalhe.profissionalRef} css={styles} />
                    <Campo label="Posologia administrada corretamente" valor={detalhe.posologiaCorreta} css={styles} />
                    <Campo label="Interrupção do tratamento" valor={detalhe.interrupcao} css={styles} />
                    <Campo label="Motivo da interrupção" valor={detalhe.interrupcaoMotivo} css={styles} />
                    <Campo label="Retorno veterinário" valor={detalhe.retornoVeterinario} css={styles} />
                    <Campo label="Data do retorno" valor={formatarData(detalhe.retornoData)} css={styles} />
                    <Campo label="Medicamentos prescritos" valor={detalhe.medicamentos} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="5. Manejo e Biossegurança" css={styles}>
                    <Campo label="Coleira repelente" valor={detalhe.coleiraRepelente} css={styles} />
                    <Campo label="Intervalo de troca" valor={detalhe.coleiraTroca} css={styles} />
                    <Campo label="Frequência da higienização" valor={detalhe.frequenciaHigiene} css={styles} />
                    <Campo label="Acesso a áreas periurbanas/mata" valor={detalhe.acessoAreaRural} css={styles} />
                    <Campo label="Deslocamento para outro município" valor={detalhe.deslocamento} css={styles} />
                    <Campo label="Quando ocorreu" valor={detalhe.deslocamentoQuando} css={styles} />
                    <Campo label="Produtos de higienização" valor={detalhe.produtosHigiene} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="6. Outros Animais e Pessoas na Residência" css={styles}>
                    <Campo label="Outros animais no domicílio" valor={detalhe.outrosAnimais} css={styles} />
                    <Campo label="Outros animais com lesões" valor={detalhe.outrosComLesoes} css={styles} />
                    <Campo label="Pessoas com lesões suspeitas" valor={detalhe.pessoasComLesoes} css={styles} />
                    <Campo label="Pessoas orientadas" valor={detalhe.pessoasOrientadas} css={styles} />
                    <Campo label="Espécies e quantidades" valor={detalhe.outrosAnimaisDesc} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="7. Condições do Ambiente" css={styles}>
                    <Campo label="Condições sanitárias" valor={detalhe.condicoesSanitarias} css={styles} />
                    <Campo label="Risco de disseminação" valor={detalhe.riscoDisseminacao} css={styles} />
                    <Campo label="Risco à saúde pública" valor={detalhe.riscoSaudePublica} css={styles} />
                    <Campo label="Observações" valor={detalhe.condicoesObs} css={styles} largo />
                    <Campo label="Descrição dos riscos" valor={detalhe.riscoDescricao} css={styles} largo />
                  </Bloco>

                  {detalhe.tutorNome && (
                    <Bloco titulo="8. Orientações e Comprometimento" css={styles}>
                      <Campo label="Sobre a zoonose e transmissão" valor={detalhe.orientZoonose} css={styles} />
                      <Campo label="Sobre tratamento contínuo" valor={detalhe.orientTratamento} css={styles} />
                      <Campo label="Sobre a coleira repelente" valor={detalhe.orientColeira} css={styles} />
                      <Campo label="Contatar o CCZ em novas lesões" valor={detalhe.orientNovasLesoes} css={styles} />
                      <Campo label="Obrigações sanitárias e terapêuticas" valor={detalhe.orientObrigacoes} css={styles} />
                      <Campo label="Comprometimento do tutor" valor={detalhe.comprometimento} css={styles} />
                    </Bloco>
                  )}

                  <Bloco titulo="9. Conclusão da Equipe Técnica" css={styles}>
                    <Campo label="Conduta do tutor" valor={detalhe.condutaTutor} css={styles} />
                    <Campo label="Situação geral" valor={detalhe.situacaoGeral} css={styles} />
                    <Campo
                      label="Encaminhamentos"
                      valor={[
                        detalhe.encAcompanhamento && "Acompanhamento periódico pelo CCZ",
                        detalhe.encNotificacao && "Notificação formal ao tutor",
                        detalhe.encOutrasMedidas && "Outras medidas sanitárias",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      css={styles}
                      largo
                    />
                    <Campo label="Descrição das outras medidas" valor={detalhe.encOutrasDescricao} css={styles} largo />
                  </Bloco>

                  <Bloco titulo="10. Assinaturas e Responsáveis Técnicos" css={styles}>
                    <Campo label="Responsável pela Fiscalização" valor={detalhe.responsavelNome} css={styles} />
                    <Campo
                      label="Médicos Veterinários do CCZ"
                      valor={(detalhe.veterinarios || [])
                        .map(
                          (v) =>
                            `${v.nome}${v.registro ? ` — ${v.registro}` : ""}${
                              v.cargo ? ` (${v.cargo})` : ""
                            }`,
                        )
                        .join(" · ")}
                      css={styles}
                      largo
                    />
                    <Campo label="Coordenador e Responsável Técnico" valor={detalhe.coordenadorNome} css={styles} />
                    <Campo label="Cargo/Função do Coordenador" valor={detalhe.coordenadorCargo} css={styles} />
                  </Bloco>

                  <Bloco titulo="11. Situação do Caso" css={styles}>
                    <Campo
                      label="Situação do Caso"
                      valor={
                        <span
                          className={
                            detalhe.situacaoCaso === "ENCERRADO"
                              ? styles.badgeEncerrado
                              : styles.badgeAcompanhamento
                          }
                        >
                          {rotuloCaso(detalhe.situacaoCaso)}
                        </span>
                      }
                      css={styles}
                    />
                    {detalhe.situacaoCaso === "ENCERRADO" && (
                      <>
                        <Campo
                          label="Desfecho do Caso"
                          valor={<span className={styles.badgeDesfecho}>{detalhe.desfecho || "—"}</span>}
                          css={styles}
                        />
                        <Campo label="Data do Encerramento" valor={formatarData(detalhe.dataEncerramento)} css={styles} />
                        <Campo label="Encerrado por" valor={detalhe.encerradoPorNome} css={styles} />
                        <Campo
                          label="Observação / Justificativa do Encerramento"
                          valor={detalhe.justificativaEncerramento}
                          css={styles}
                          largo
                        />
                      </>
                    )}
                  </Bloco>
                </div>

                <div className={styles.acoesDetalhe}>
                  {detalhe.situacaoCaso !== "ENCERRADO" && (
                    <button type="button" className={styles.btnEncerrar} onClick={abrirEncerramento}>
                      <Ban size={16} /> Encerrar Caso
                    </button>
                  )}
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
                    onClick={() => baixarTermo(detalhe)}
                  >
                    <FileText size={16} /> Gerar Termo
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

      {/* ── ENCERRAR CASO ─────────────────────────────────────────────────── */}
      {encerrando && detalhe && (
        <div
          className={styles.painelFundo}
          role="presentation"
          onClick={() => setEncerrando(false)}
        >
          <div
            className={styles.painelDetalhe}
            role="dialog"
            aria-modal="true"
            aria-label="Encerrar caso de leishmaniose"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.painelTopo}>
              <h3>Encerrar Caso</h3>
              <button
                type="button"
                className={styles.btnFechar}
                onClick={() => setEncerrando(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.corpoDetalhe}>
              <div className={styles.cardSection}>
                <h4 className={styles.sectionHeaderTitle}>Encerramento do Acompanhamento</h4>
                <div className={styles.grid3}>
                  <div className={styles.fieldGroup}>
                    <label>Desfecho do Caso *</label>
                    <select
                      className={styles.selectFicha}
                      value={formEncerramento.desfecho}
                      onChange={(e) => setFormEncerramento((f) => ({ ...f, desfecho: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {DESFECHOS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Data do Encerramento *</label>
                    <input
                      type="date"
                      className={styles.selectFicha}
                      value={formEncerramento.dataEncerramento}
                      onChange={(e) =>
                        setFormEncerramento((f) => ({ ...f, dataEncerramento: e.target.value }))
                      }
                    />
                  </div>
                  <div className={`${styles.fieldGroup} ${styles.campoLeituraLargo}`}>
                    <label>Observação / Justificativa do Encerramento *</label>
                    <textarea
                      className={styles.textareaFicha}
                      rows={4}
                      maxLength={500}
                      placeholder="Descreva o motivo do encerramento (15 a 500 caracteres)..."
                      value={formEncerramento.justificativa}
                      onChange={(e) =>
                        setFormEncerramento((f) => ({ ...f, justificativa: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.acoesDetalhe}>
              <button
                type="button"
                className={styles.btnEncerrar}
                disabled={!encerramentoValido || salvandoEncerramento}
                aria-disabled={!encerramentoValido || salvandoEncerramento}
                onClick={async () => {
                  if (!encerramentoValido || salvandoEncerramento) return;
                  const ok = await confirm({
                    title: "Encerrar caso",
                    message:
                      "O acompanhamento será encerrado. As fiscalizações registradas são preservadas e não poderão ser encerradas novamente.",
                    confirmText: "Encerrar",
                  });
                  if (ok) await confirmarEncerramento();
                }}
              >
                <Ban size={16} /> {salvandoEncerramento ? "Encerrando..." : "Confirmar Encerramento"}
              </button>
              <button type="button" className={styles.btnGhost} onClick={() => setEncerrando(false)}>
                Cancelar
              </button>
            </div>
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

// Campo de leitura da ficha — mesmo componente visual da Ficha do Animal:
// rótulo em caixa alta, valor em bloco único. Campos extensos ocupam a linha
// inteira pela própria grade (campoLeituraLargo), sem margem artificial.
function Campo({ label, valor, largo = false }) {
  // Aceita ReactNode (badges) sem converter objeto em string.
  const vazio = valor === null || valor === undefined || valor === "";
  const conteudo = vazio ? "—" : typeof valor === "object" ? valor : String(valor);
  return (
    <div className={`${styles.campoLeitura} ${largo ? styles.campoLeituraLargo : ""}`}>
      <label>{label}</label>
      <div className={styles.campoValorBadge}>{conteudo}</div>
    </div>
  );
}
