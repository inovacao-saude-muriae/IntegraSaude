"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroAnimal.module.css";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import { buscarAnimaisCCZ, salvarEsporotricose } from "./actions";

const hojeYMD = () => new Date().toISOString().split("T")[0];

const formatarDiaBR = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "");

const FORM_VAZIO = {
  id: "",
  animalId: "",
  temTutor: false,
  tutorNome: "",
  // Identificação
  dataVisita: hojeYMD(),
  fiscalResponsavel: "",
  // Condição clínica
  apresentaLesoes: "Não",
  descricaoLesoes: "",
  emTratamentoVeterinario: "Não",
  descricaoTratamentoVet: "",
  // Tratamento
  medicamentosPrescritos: "",
  interrupcaoTratamento: "Não",
  retornoVeterinario: "Não",
  // Manejo domiciliar (tutor-only)
  isolamentoDomiciliar: "Não",
  observacoesIsolamento: "",
  acessoRua: "Não",
  usoEpi: "Não",
  quaisEpis: "",
  higienizacaoAmbiente: "",
  // Outros animais e pessoas (tutor-only)
  outrosAnimaisResidencia: "Não",
  outrosAnimaisDescricao: "",
  pessoasComLesoes: "Não",
  pessoasLesoesDescricao: "",
  // Ciência do responsável (tutor-only)
  cienteTratamentoContinuo: "Não",
  cienteContencao: "Não",
  cienteEpi: "Não",
  cienteResiduos: "Não",
  // Avaliação
  condicoesGeraisAmbiente: "",
  conclusaoTecnica: "",
  // Encaminhamentos
  encAcompanhamentoCcz: false,
  encNotificacaoTutor: false,
  encMinisterioPublico: false,
  encOutrasMedidas: false,
  outrasMedidasDescricao: "",
  // Agenda de acompanhamento
  visitas: [],
};

export default function CadastroEsporotricose({ registroInicial = null, onSalvo }) {
  const confirm = useConfirm();
  const notify = useNotify();

  const editando = Boolean(registroInicial?.id);
  const [form, setForm] = useState(
    registroInicial ? { ...FORM_VAZIO, ...registroInicial } : FORM_VAZIO,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Nova visita de acompanhamento (data a adicionar na lista).
  const [novaVisitaData, setNovaVisitaData] = useState("");

  // Busca de ANIMAL (dropdown, igual ao seletor de Procedimentos).
  const [animalTermo, setAnimalTermo] = useState(registroInicial?.animalLabel || "");
  const [animalResultados, setAnimalResultados] = useState([]);
  const [animalDropAberto, setAnimalDropAberto] = useState(false);
  const [animalBuscando, setAnimalBuscando] = useState(false);
  const animalDropRef = useRef(null);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function handleClickOutside(e) {
      if (animalDropRef.current && !animalDropRef.current.contains(e.target)) {
        setAnimalDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const atualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const buscarAnimal = async (valor) => {
    setAnimalTermo(valor);
    
    // Se limpar o campo, limpa o ID selecionado
    if (!valor || valor.trim() === "") {
      setForm((prev) => ({ ...prev, animalId: "" }));
    }
    
    // Se for apenas espaço (buscar todos) ou tem 2+ caracteres
    const deveConsultar = valor === " " || valor.trim().length >= 2;
    
    if (!deveConsultar) {
      setAnimalDropAberto(false);
      setAnimalResultados([]);
      return;
    }
    
    setAnimalDropAberto(true);
    setAnimalBuscando(true);
    // Se for espaço, passa string vazia para buscar todos
    const res = await buscarAnimaisCCZ(valor === " " ? "" : valor.trim());
    setAnimalResultados(res.success ? res.data : []);
    setAnimalBuscando(false);
  };

  const selecionarAnimal = (a) => {
    setForm((prev) => ({
      ...prev,
      animalId: a.id,
      temTutor: Boolean(a.tutorNome),
      tutorNome: a.tutorNome || "",
    }));
    setAnimalTermo(`${a.nome?.trim() || "Sem nome"} (${a.id})`);
    setAnimalDropAberto(false);
  };

  // Sim/Não com limpeza do campo dependente quando volta para "Não".
  const handleCondicional = (campo, campoDep, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
      [campoDep]: valor === "Sim" ? prev[campoDep] : "",
    }));
  };

  // Marca/desmarca um encaminhamento. Ao desmarcar o acompanhamento periódico,
  // limpa as visitas de agenda (não fazem sentido sem o encaminhamento).
  const toggleEnc = (campo, checked) => {
    setForm((prev) => ({
      ...prev,
      [campo]: checked,
      ...(campo === "encAcompanhamentoCcz" && !checked ? { visitas: [] } : {}),
    }));
  };

  const adicionarVisita = () => {
    if (!novaVisitaData) return;
    setForm((prev) => ({
      ...prev,
      visitas: [...prev.visitas, { data: novaVisitaData, observacao: "" }],
    }));
    setNovaVisitaData("");
  };

  const atualizarVisita = (idx, valor) => {
    setForm((prev) => ({
      ...prev,
      visitas: prev.visitas.map((v, i) => (i === idx ? { ...v, observacao: valor } : v)),
    }));
  };

  const removerVisita = (idx) => {
    setForm((prev) => ({
      ...prev,
      visitas: prev.visitas.filter((_, i) => i !== idx),
    }));
  };

  const limpar = () => {
    setForm(FORM_VAZIO);
    setErro("");
    setAnimalTermo("");
    setAnimalResultados([]);
    setAnimalDropAberto(false);
    setNovaVisitaData("");
  };

  const salvar = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: editando ? "Atualizar esporotricose" : "Cadastrar esporotricose",
      message: editando
        ? "Deseja salvar as alterações deste registro?"
        : "Deseja confirmar o cadastro deste registro de esporotricose?",
      confirmText: editando ? "Atualizar" : "Cadastrar",
    });
    if (!ok) return;

    setSalvando(true);
    const res = await salvarEsporotricose(form);
    setSalvando(false);

    if (res.success) {
      setErro("");
      await notify({
        tipo: "sucesso",
        title: "Pronto",
        message: editando
          ? "Registro atualizado com sucesso!"
          : "Registro de esporotricose salvo com sucesso!",
      });
      
      // Se estiver editando, chama callback para recarregar lista
      if (editando && typeof onSalvo === "function") {
        onSalvo();
      } else {
        // Se for novo cadastro, limpa o form
        limpar();
      }
    } else {
      setErro(res.error || "Não foi possível salvar o registro.");
    }
  };

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <form onSubmit={salvar} className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardHeaderTitle}>
            {editando ? "Editar esporotricose" : "Cadastro de esporotricose"}
          </h2>
        </div>

        <div className={styles.camposBloco}>
          {/* ── IDENTIFICAÇÃO ── */}
          <div className={styles.formSectionTitle}>Identificação</div>
          <div className={styles.grid}>
            {/* Animal (dropdown de busca) */}
            <div
              className={`${styles.field} ${styles.colLg}`}
              style={{ position: "relative" }}
              ref={animalDropRef}
            >
              <label>Animal *</label>
              <div className={styles.inputWrapperWithIcon}>
                <input
                  type="text"
                  value={animalTermo}
                  placeholder="Digite nome, id ou espécie do animal..."
                  onChange={(e) => buscarAnimal(e.target.value)}
                  onFocus={() => {
                    setAnimalDropAberto(true);
                    // Se não há resultados e não tem termo, busca todos
                    if (animalResultados.length === 0 && !animalTermo) {
                      buscarAnimal(" ");
                    }
                  }}
                  autoComplete="off"
                  required={!form.animalId}
                />
                <span 
                  className={styles.arrowIcon}
                  onClick={() => {
                    setAnimalDropAberto(!animalDropAberto);
                    // Se está abrindo e não tem resultados, busca todos
                    if (!animalDropAberto && animalResultados.length === 0 && !animalTermo) {
                      buscarAnimal(" ");
                    }
                  }}
                >
                  {animalDropAberto ? "▲" : "▼"}
                </span>
              </div>
              {animalDropAberto && (
                <div className={styles.tableDropdownMenu}>
                  <div className={styles.tableContainerScroll}>
                    <table className={styles.patientTableDropdown}>
                      <thead>
                        <tr>
                          <th>Id</th>
                          <th>Nome</th>
                          <th>Espécie</th>
                          <th>Tutor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {animalResultados.length > 0 ? (
                          animalResultados.map((a) => (
                            <tr
                              key={a.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selecionarAnimal(a);
                              }}
                              className={form.animalId === a.id ? styles.selectedRow : ""}
                            >
                              <td>{a.id}</td>
                              <td className={styles.boldName}>{a.nome || "Sem nome"}</td>
                              <td>{a.especie || "-"}</td>
                              <td>{a.tutorNome || "Sem tutor"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className={styles.noDataTd}>
                              {animalBuscando
                                ? "Buscando animais..."
                                : "Nenhum animal encontrado."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Tutor (exibido quando animal tem tutor) */}
            {form.temTutor && form.tutorNome && (
              <div className={`${styles.field} ${styles.colLg}`}>
                <label>Tutor</label>
                <input
                  type="text"
                  value={form.tutorNome}
                  disabled
                  style={{
                    backgroundColor: "#f8fafc",
                    color: "#1e293b",
                    fontWeight: "500",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            )}

            {/* Data da visita */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Data da visita *</label>
              <input
                type="date"
                value={form.dataVisita}
                onChange={(e) => atualizar("dataVisita", e.target.value)}
                required
              />
            </div>

            {/* Fiscal responsável */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Fiscal responsável</label>
              <input
                type="text"
                value={form.fiscalResponsavel}
                onChange={(e) => atualizar("fiscalResponsavel", e.target.value)}
                placeholder="Nome do(a) fiscal responsável"
              />
            </div>
          </div>

          {/* ── CONDIÇÃO CLÍNICA ── */}
          <div className={styles.formSectionTitle}>Condição clínica</div>
          <div className={styles.grid}>
            {/* Apresenta lesões? + qual */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Animal apresenta lesões compatíveis com esporotricose?</label>
              <div className={styles.rowComposta}>
                <div className={styles.colControle}>
                  <select
                    value={form.apresentaLesoes}
                    onChange={(e) =>
                      handleCondicional("apresentaLesoes", "descricaoLesoes", e.target.value)
                    }
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={styles.colAnexo}>
                  <input
                    type="text"
                    value={form.descricaoLesoes}
                    onChange={(e) => atualizar("descricaoLesoes", e.target.value)}
                    placeholder="Qual?"
                    disabled={form.apresentaLesoes !== "Sim"}
                  />
                </div>
              </div>
            </div>

            {/* Em tratamento veterinário? + descrição */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Animal em tratamento veterinário?</label>
              <div className={styles.rowComposta}>
                <div className={styles.colControle}>
                  <select
                    value={form.emTratamentoVeterinario}
                    onChange={(e) =>
                      handleCondicional(
                        "emTratamentoVeterinario",
                        "descricaoTratamentoVet",
                        e.target.value,
                      )
                    }
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={styles.colAnexo}>
                  <textarea
                    rows={1}
                    value={form.descricaoTratamentoVet}
                    onChange={(e) => atualizar("descricaoTratamentoVet", e.target.value)}
                    placeholder="Descrição do tratamento"
                    disabled={form.emTratamentoVeterinario !== "Sim"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── TRATAMENTO ── */}
          <div className={styles.formSectionTitle}>Tratamento</div>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Medicamentos prescritos</label>
              <textarea
                rows={2}
                value={form.medicamentosPrescritos}
                onChange={(e) => atualizar("medicamentosPrescritos", e.target.value)}
                placeholder="Informe os medicamentos prescritos (se houver)"
              />
            </div>

            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Houve interrupção do tratamento?</label>
              <select
                value={form.interrupcaoTratamento}
                onChange={(e) => atualizar("interrupcaoTratamento", e.target.value)}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Há registro de retorno ao veterinário?</label>
              <select
                value={form.retornoVeterinario}
                onChange={(e) => atualizar("retornoVeterinario", e.target.value)}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>
          </div>

          {/* ── BLOCOS TUTOR-ONLY ── */}
          {form.temTutor && (
            <>
              {/* Manejo domiciliar */}
              <div className={styles.formSectionTitle}>Manejo domiciliar</div>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>Animal em isolamento domiciliar?</label>
                  <div className={styles.rowComposta}>
                    <div className={styles.colControle}>
                      <select
                        value={form.isolamentoDomiciliar}
                        onChange={(e) =>
                          handleCondicional(
                            "isolamentoDomiciliar",
                            "observacoesIsolamento",
                            e.target.value,
                          )
                        }
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>
                    <div className={styles.colAnexo}>
                      <textarea
                        rows={1}
                        value={form.observacoesIsolamento}
                        onChange={(e) => atualizar("observacoesIsolamento", e.target.value)}
                        placeholder="Observações sobre o isolamento"
                        disabled={form.isolamentoDomiciliar !== "Sim"}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.field} ${styles.colSm}`}>
                  <label>Acesso à rua / contato com outros animais?</label>
                  <select
                    value={form.acessoRua}
                    onChange={(e) => atualizar("acessoRua", e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>Uso de EPI durante o manejo?</label>
                  <div className={styles.rowComposta}>
                    <div className={styles.colControle}>
                      <select
                        value={form.usoEpi}
                        onChange={(e) =>
                          handleCondicional("usoEpi", "quaisEpis", e.target.value)
                        }
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>
                    <div className={styles.colAnexo}>
                      <input
                        type="text"
                        value={form.quaisEpis}
                        onChange={(e) => atualizar("quaisEpis", e.target.value)}
                        placeholder="Quais EPIs utilizados?"
                        disabled={form.usoEpi !== "Sim"}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.field} ${styles.colFull}`}>
                  <label>Como é realizada a higienização do ambiente?</label>
                  <textarea
                    rows={1}
                    value={form.higienizacaoAmbiente}
                    onChange={(e) => atualizar("higienizacaoAmbiente", e.target.value)}
                    placeholder="Descreva a higienização do ambiente"
                  />
                </div>
              </div>

              {/* Outros animais e pessoas */}
              <div className={styles.formSectionTitle}>Outros animais e pessoas na residência</div>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.colFull}`}>
                  <label>Há outros animais na residência?</label>
                  <div className={styles.rowComposta}>
                    <div className={styles.colControle}>
                      <select
                        value={form.outrosAnimaisResidencia}
                        onChange={(e) =>
                          handleCondicional(
                            "outrosAnimaisResidencia",
                            "outrosAnimaisDescricao",
                            e.target.value,
                          )
                        }
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>
                    <div className={styles.colAnexo}>
                      <textarea
                        rows={1}
                        value={form.outrosAnimaisDescricao}
                        onChange={(e) => atualizar("outrosAnimaisDescricao", e.target.value)}
                        placeholder="Quais? Quantos? Apresentam sintomas?"
                        disabled={form.outrosAnimaisResidencia !== "Sim"}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.field} ${styles.colFull}`}>
                  <label>Há pessoas com lesões suspeitas de esporotricose?</label>
                  <div className={styles.rowComposta}>
                    <div className={styles.colControle}>
                      <select
                        value={form.pessoasComLesoes}
                        onChange={(e) =>
                          handleCondicional(
                            "pessoasComLesoes",
                            "pessoasLesoesDescricao",
                            e.target.value,
                          )
                        }
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>
                    <div className={styles.colAnexo}>
                      <textarea
                        rows={1}
                        value={form.pessoasLesoesDescricao}
                        onChange={(e) => atualizar("pessoasLesoesDescricao", e.target.value)}
                        placeholder="Descreva as lesões suspeitas"
                        disabled={form.pessoasComLesoes !== "Sim"}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ciência do responsável */}
              <div className={styles.formSectionTitle}>Ciência do responsável</div>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.colMd}`}>
                  <label>Ciente da necessidade de tratamento contínuo e prolongado?</label>
                  <select
                    value={form.cienteTratamentoContinuo}
                    onChange={(e) => atualizar("cienteTratamentoContinuo", e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.colMd}`}>
                  <label>Ciente da importância da contenção domiciliar?</label>
                  <select
                    value={form.cienteContencao}
                    onChange={(e) => atualizar("cienteContencao", e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.colMd}`}>
                  <label>Ciente do uso obrigatório de luvas/EPI?</label>
                  <select
                    value={form.cienteEpi}
                    onChange={(e) => atualizar("cienteEpi", e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.colMd}`}>
                  <label>Ciente da correta destinação de resíduos contaminados?</label>
                  <select
                    value={form.cienteResiduos}
                    onChange={(e) => atualizar("cienteResiduos", e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── AVALIAÇÃO ── */}
          <div className={styles.formSectionTitle}>Avaliação</div>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Condições gerais do ambiente</label>
              <textarea
                rows={2}
                value={form.condicoesGeraisAmbiente}
                onChange={(e) => atualizar("condicoesGeraisAmbiente", e.target.value)}
                placeholder="Descreva as condições gerais do ambiente"
              />
            </div>
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Conclusão da equipe técnica</label>
              <textarea
                rows={2}
                value={form.conclusaoTecnica}
                onChange={(e) => atualizar("conclusaoTecnica", e.target.value)}
                placeholder="Conclusão da equipe técnica"
              />
            </div>
          </div>

          {/* ── ENCAMINHAMENTOS SUGERIDOS ── */}
          <div className={styles.formSectionTitle}>Encaminhamentos sugeridos</div>
          <div className={styles.grid}>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={form.encAcompanhamentoCcz}
                  onChange={(e) => toggleEnc("encAcompanhamentoCcz", e.target.checked)}
                />
                Acompanhamento periódico pelo CCZ
              </label>
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={form.encNotificacaoTutor}
                  onChange={(e) => toggleEnc("encNotificacaoTutor", e.target.checked)}
                />
                Notificação formal ao tutor
              </label>
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={form.encMinisterioPublico}
                  onChange={(e) => toggleEnc("encMinisterioPublico", e.target.checked)}
                />
                Encaminhamento ao Ministério Público
              </label>
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={form.encOutrasMedidas}
                  onChange={(e) => toggleEnc("encOutrasMedidas", e.target.checked)}
                />
                Outras medidas sanitárias
              </label>
            </div>

            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Descreva as outras medidas / observações</label>
              <textarea
                rows={2}
                value={form.outrasMedidasDescricao}
                onChange={(e) => atualizar("outrasMedidasDescricao", e.target.value)}
                placeholder="Outras medidas / observações"
              />
            </div>
          </div>

          {/* ── AGENDA DE ACOMPANHAMENTO (condicional) ── */}
          {form.encAcompanhamentoCcz && (
            <>
              <div className={styles.formSectionTitle}>Agenda de acompanhamento</div>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>Definir os dias de visita de acompanhamento</label>
                  <div className={styles.rowComposta}>
                    <div className={styles.colControle}>
                      <input
                        type="date"
                        value={novaVisitaData}
                        onChange={(e) => setNovaVisitaData(e.target.value)}
                      />
                    </div>
                    <div className={styles.colAnexo}>
                      <button
                        type="button"
                        className={styles.btnAdicionar}
                        onClick={adicionarVisita}
                        disabled={!novaVisitaData}
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                {form.visitas.length > 0 && (
                  <div className={styles.visitaLista}>
                    {form.visitas.map((v, idx) => (
                      <div key={`${v.data}-${idx}`} className={styles.visitaItem}>
                        <div className={styles.visitaHeader}>
                          <span className={styles.visitaData}>{formatarDiaBR(v.data)}</span>
                          <button
                            type="button"
                            className={styles.btnRemover}
                            onClick={() => removerVisita(idx)}
                          >
                            Remover
                          </button>
                        </div>
                        <textarea
                          className={styles.visitaObsTextarea}
                          value={v.observacao}
                          onChange={(e) => atualizarVisita(idx, e.target.value)}
                          placeholder="Observação da visita (opcional)"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={editando && onSalvo ? onSalvo : limpar}
            disabled={salvando}
          >
            {editando ? "Voltar" : "Limpar"}
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
