"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  listarProcessosFarmacia,
  obterProcessoFarmacia,
  excluirProcessoFarmacia,
} from "./actions";
import styles from "./ConsultarProcessos.module.css";

// Situação na Farmácia Judicial: operacional (ATIVO/INATIVO). Valores legados
// fora destes dois são exibidos como Inativo, nunca convertidos no banco.
const situacaoDe = (v) => (String(v || "").trim().toUpperCase() === "ATIVO" ? "Ativo" : "Inativo");

// ISO (yyyy-mm-dd) → dd/mm/aaaa sem passar por Date (evita efeito de fuso).
const formatarData = (v) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "—";
};

const FILTROS_VAZIOS = {
  dataInicio: "",
  dataFim: "",
  medicamentoId: "",
  situacao: "todos",
};

/**
 * Aba "Consultar Processos" da Farmácia Judicial.
 * Filtros → Filtrar (backend, paginado em 100) → tabela de 3 colunas com a
 * linha inteira clicável → visualização completa (somente leitura) com a
 * exclusão disponível apenas nessa tela e sujeita às permissões.
 */
export default function ConsultarProcessos({ catalogo = [], podeExcluir = false }) {
  const confirm = useConfirm();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null); // null = tabela oculta
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const alterarFiltro = (campo, valor) =>
    setFiltros((f) => ({ ...f, [campo]: valor }));

  async function consultar(pagina = 1, atuais = filtros) {
    setConsultando(true);
    setErro("");
    try {
      const res = await listarProcessosFarmacia({
        dataInicio: atuais.dataInicio,
        dataFim: atuais.dataFim,
        medicamentoId: atuais.medicamentoId,
        situacao: atuais.situacao,
        pagina,
      });
      if (!res.success) {
        setErro(res.error || "Não foi possível consultar os processos.");
        setResultado(null);
        return;
      }
      setResultado(res);
      setAviso("");
    } finally {
      setConsultando(false);
    }
  }

  // Filtrar sem nenhum campo preenchido devolve todos os registros.
  const filtrar = (e) => {
    e?.preventDefault?.();
    consultar(1, filtros);
  };

  // Limpar filtros: zera os campos E oculta a tabela de resultados.
  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setErro("");
    setAviso("");
  };

  async function abrirDetalhe(numeroPasta) {
    setCarregandoDetalhe(true);
    setErro("");
    try {
      const res = await obterProcessoFarmacia(numeroPasta);
      if (!res.success) {
        setErro(res.error || "Não foi possível abrir o processo.");
        return;
      }
      setDetalhe(res.processo);
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function excluir() {
    if (!detalhe) return;
    const ok = await confirm({
      title: "Excluir processo",
      message: `Deseja excluir o processo ${detalhe.numeroProcesso} (pasta ${detalhe.numeroPasta})? Esta ação não poderá ser desfeita.`,
      confirmText: "Excluir",
    });
    if (!ok) return;

    setExcluindo(true);
    const res = await excluirProcessoFarmacia(detalhe.numeroPasta, { confirmado: true });
    setExcluindo(false);
    if (!res.success) {
      setErro(res.error || "Não foi possível excluir o processo.");
      return;
    }
    setDetalhe(null);
    setAviso("Processo excluído com sucesso.");
    // Refaz a consulta atual (mantém filtros e página).
    consultar(resultado?.pagina || 1, filtros);
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {aviso && (
          <div className={styles.avisoSucesso} role="status">
            {aviso}
            <button type="button" onClick={() => setAviso("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}
        {erro && (
          <div className={styles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── FILTROS ─────────────────────────────────────────────────────── */}
        <form className={styles.filtros} onSubmit={filtrar}>
          <div className={styles.filtrosGrid}>
            <div className={styles.campoFiltro}>
              <label>Data do Cadastro — inicial</label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
              />
            </div>
            <div className={styles.campoFiltro}>
              <label>Data do Cadastro — final</label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => alterarFiltro("dataFim", e.target.value)}
              />
            </div>
            <div className={styles.campoFiltro}>
              <label>Medicamento</label>
              <select
                value={filtros.medicamentoId}
                onChange={(e) => alterarFiltro("medicamentoId", e.target.value)}
              >
                <option value="">Todos os medicamentos</option>
                {catalogo.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.nome} ({m.dosagem})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.campoFiltro}>
              <label>Situação na Farmácia Judicial</label>
              <select
                value={filtros.situacao}
                onChange={(e) => alterarFiltro("situacao", e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativo</option>
                <option value="inativos">Inativo</option>
              </select>
            </div>
          </div>

          <div className={styles.filtrosAcoes}>
            <button type="submit" className={styles.btnPrimario} disabled={consultando}>
              {consultando ? "Consultando..." : "Filtrar"}
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
        </form>

        {/* ── RESULTADOS (só após consultar) ──────────────────────────────── */}
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
                    <th>Data do Cadastro</th>
                    <th>Nome do Paciente</th>
                    <th>Número do Processo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.registros.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.tabelaVazia}>
                        Nenhum processo encontrado para os filtros informados.
                      </td>
                    </tr>
                  )}
                  {resultado.registros.map((r) => (
                    <tr
                      key={r.numeroPasta}
                      className={styles.linhaClicavel}
                      onClick={() => abrirDetalhe(r.numeroPasta)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhe(r.numeroPasta);
                      }}
                      title="Clique para visualizar o processo completo"
                    >
                      <td>{formatarData(r.dataCadastro)}</td>
                      <td>{r.patientName || "—"}</td>
                      <td>{r.numeroProcesso || "—"}</td>
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

      {/* ── VISUALIZAÇÃO COMPLETA DO PROCESSO ─────────────────────────────── */}
      {(carregandoDetalhe || detalhe) && (
        <div className={styles.painelFundo} role="dialog" aria-modal="true">
          <div className={styles.painelDetalhe}>
            {carregandoDetalhe && !detalhe && (
              <p className={styles.vazio}>Carregando processo...</p>
            )}

            {detalhe && (
              <>
                <div className={styles.painelTopo}>
                  <h3>Processo {detalhe.numeroProcesso}</h3>
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
                  {/* 1. IDENTIFICAÇÃO DO PACIENTE */}
                  <div className={styles.cardSection}>
                    <h4 className={styles.sectionHeaderTitle}>1. Identificação do Paciente</h4>
                    <div className={styles.grid3}>
                      <div className={styles.campoLeitura}>
                        <label>Nome do Paciente</label>
                        <input readOnly value={detalhe.patientName || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>CPF</label>
                        <input readOnly value={detalhe.cpf || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>CNS (Cartão SUS)</label>
                        <input readOnly value={detalhe.cns || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Data de Nascimento</label>
                        <input readOnly value={formatarData(detalhe.dataNascimento)} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Sexo</label>
                        <input readOnly value={detalhe.sexo || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Telefone</label>
                        <input readOnly value={detalhe.telefone || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Nome da Mãe</label>
                        <input readOnly value={detalhe.motherName || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>UBS de referência</label>
                        <input readOnly value={detalhe.ubsReferencia || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Endereço</label>
                        <input
                          readOnly
                          value={[
                            detalhe.logradouro,
                            detalhe.numero,
                            detalhe.complemento,
                            detalhe.bairro,
                            detalhe.cidade && detalhe.uf
                              ? `${detalhe.cidade}/${detalhe.uf}`
                              : detalhe.cidade || detalhe.uf,
                            detalhe.cep,
                          ]
                            .filter(Boolean)
                            .join(" - ") || "—"}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. INFORMAÇÕES DO PROCESSO */}
                  <div className={styles.cardSection}>
                    <h4 className={styles.sectionHeaderTitle}>2. Informações do Processo</h4>
                    <div className={styles.grid3}>
                      <div className={styles.campoLeitura}>
                        <label>Número do Processo</label>
                        <input readOnly value={detalhe.numeroProcesso || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Número da Pasta</label>
                        <input readOnly value={detalhe.numeroPasta || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Situação na Farmácia Judicial</label>
                        <input
                          readOnly
                          value={situacaoDe(detalhe.status)}
                          className={
                            situacaoDe(detalhe.status) === "Inativo"
                              ? styles.situacaoInativa
                              : styles.situacaoAtiva
                          }
                        />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Data do Cadastro</label>
                        <input
                          readOnly
                          value={`${formatarData(detalhe.dataCadastro)}${
                            detalhe.horaCadastro ? ` às ${detalhe.horaCadastro}` : ""
                          }`}
                        />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Dispensações registradas</label>
                        <input readOnly value={String(detalhe.totalDispensacoes ?? 0)} />
                      </div>
                    </div>

                    {detalhe.justificativaInativacao && (
                      <div className={styles.campoLeituraLargo}>
                        <label>Justificativa da Inativação</label>
                        <textarea readOnly rows={2} value={detalhe.justificativaInativacao} />
                      </div>
                    )}
                  </div>

                  {/* 3. MEDICAMENTOS VINCULADOS */}
                  <div className={styles.cardSection}>
                    <h4 className={styles.sectionHeaderTitle}>3. Medicamentos Vinculados</h4>
                    {detalhe.medicamentos.length === 0 ? (
                      <p className={styles.vazio}>Nenhum medicamento vinculado.</p>
                    ) : (
                      <div className={styles.tabelaWrapper}>
                        <table className={styles.tabela}>
                          <thead>
                            <tr>
                              <th>Medicamento</th>
                              <th>Tipo</th>
                              <th>Dosagem</th>
                              <th>Qtd. Prescrita Mensal</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalhe.medicamentos.map((m, i) => (
                              <tr key={`${m.nome}-${i}`}>
                                <td>{m.nome}</td>
                                <td>{m.tipo || "—"}</td>
                                <td>{m.dosagem || "—"}</td>
                                <td>{m.qtdPrescritaMensal}</td>
                                <td>{m.medicamentoAtivo ? "Ativo" : "Inativo"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.acoesDetalhe}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setDetalhe(null)}
                  >
                    Fechar
                  </button>
                  {podeExcluir && (
                    <button
                      type="button"
                      className={styles.btnPerigo}
                      onClick={excluir}
                      disabled={excluindo}
                    >
                      {excluindo ? "Excluindo..." : "Excluir"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
