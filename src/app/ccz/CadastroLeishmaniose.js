"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import styles from "./CadastroAnimal.module.css";
import leish from "./Leishmaniose.module.css";
import {
  buscarAnimaisLeishmaniose,
  obterDadosFormularioLeishmaniose,
  salvarLeishmaniose,
} from "./leishmanioseActions";

const hojeYMD = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const FORM_VAZIO = {
  id: null,
  dataFiscalizacao: "",
  responsavelCargo: "",
  // 2. Animal
  animalId: "",
  animalNome: "",
  animalEspecie: "",
  animalSexo: "",
  animalIdade: "",
  animalPorte: "",
  animalRacaPelagem: "",
  animalIdentificacao: "",
  temTutor: false,
  tutor: null,
  // 4. Condição clínica
  apresentaLesoes: "",
  quaisLesoes: "",
  emTratamento: "",
  tratamentoInicio: "",
  profissionalRef: "",
  medicamentos: "",
  posologiaCorreta: "",
  interrupcao: "",
  interrupcaoMotivo: "",
  retornoVeterinario: "",
  retornoData: "",
  // 5. Manejo
  coleiraRepelente: "",
  coleiraTroca: "",
  produtosHigiene: "",
  frequenciaHigiene: "",
  acessoAreaRural: "",
  deslocamento: "",
  deslocamentoQuando: "",
  // 6. Outros animais e pessoas
  outrosAnimais: "",
  outrosAnimaisDesc: "",
  outrosComLesoes: "",
  outrosComLesoesDesc: "",
  pessoasComLesoes: "",
  pessoasComLesoesDesc: "",
  pessoasOrientadas: "",
  pessoasOrientadasDesc: "",
  // 7. Ambiente
  condicoesSanitarias: "",
  condicoesObs: "",
  riscoDisseminacao: "",
  riscoSaudePublica: "",
  riscoDescricao: "",
  // 8. Orientações
  orientZoonose: "",
  orientTratamento: "",
  orientColeira: "",
  orientNovasLesoes: "",
  orientObrigacoes: "",
  comprometimento: "",
  // 9. Conclusão
  condutaTutor: "",
  situacaoGeral: "",
  encAcompanhamento: false,
  encAcompanhamentoData: "",
  visitas: [],
  encMinisterioPublico: false,
  encNotificacao: false,
  encOutrasMedidas: false,
  encOutrasDescricao: "",
  // Equipe técnica (as assinaturas ficam exclusivamente no PDF)
  coordenadorNome: "",
  coordenadorCargo: "",
  equipe: [],
  veterinarios: [],
};

const SIM_NAO = ["Sim", "Não"];

// Campo complementar de cada pergunta condicional: ao sair de "Sim" o
// complemento é limpo (os registros históricos já salvos não são afetados).
const COMPLEMENTARES = {
  coleiraRepelente: "coleiraTroca",
  deslocamento: "deslocamentoQuando",
  outrosAnimais: "outrosAnimaisDesc",
  outrosComLesoes: "outrosComLesoesDesc",
  pessoasComLesoes: "pessoasComLesoesDesc",
};

const formatarDiaBR = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "");

const ETAPAS = [
  { numero: 1, label: "Identificação e Tratamento" },
  { numero: 2, label: "Manejo" },
  { numero: 3, label: "Orientações" },
  { numero: 4, label: "Conclusão" },
];

// Pergunta Sim/Não com o campo complementar SEMPRE visível ao lado — mesma
// estrutura de grupos independentes da Esporotricose (rowComposta: controle
// com largura fixa + complemento flex). O complemento só fica habilitado
// quando a resposta é "Sim"; vazio ou "Não" mantém o campo visível, porém
// desabilitado (fundo cinza, leitura), sem deslocar nenhum outro grupo.
function SimNao({
  label,
  valor,
  onChange,
  opcoes = SIM_NAO,
  obrigatorio = false,
  complemento = null,
  coluna,
}) {
  const classe = `${styles.field} ${coluna ? styles[coluna] : ""}`.trim();
  const habilitado = valor === "Sim";

  return (
    <div className={classe}>
      <label>
        {label} {obrigatorio && <span className={leish.req}>*</span>}
      </label>
      {!complemento ? (
        <select value={valor || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className={styles.rowComposta}>
          <div className={styles.colControle}>
            <select
              value={valor || ""}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {opcoes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.colAnexo}>
            {complemento.tipo === "textarea" ? (
              <textarea
                rows={1}
                value={complemento.valor || ""}
                disabled={!habilitado}
                onChange={(e) => complemento.onChange(e.target.value)}
                placeholder={complemento.placeholder}
              />
            ) : (
              <input
                type={complemento.tipo === "date" ? "date" : "text"}
                value={complemento.valor || ""}
                disabled={!habilitado}
                onChange={(e) => complemento.onChange(e.target.value)}
                placeholder={complemento.placeholder}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CadastroLeishmaniose({
  registroInicial = null,
  onSalvo,
}) {
  const [form, setForm] = useState(
    registroInicial
      ? {
          ...FORM_VAZIO,
          ...registroInicial,
          dataFiscalizacao: registroInicial.dataFiscalizacao || hojeYMD(),
        }
      : { ...FORM_VAZIO, dataFiscalizacao: hojeYMD() },
  );
  const [responsavel, setResponsavel] = useState({
    nome: "",
    cpf: "",
    cargo: "",
  });
  const [cargoUsuario, setCargoUsuario] = useState(
    registroInicial?.responsavelCargo || "",
  );
  const [podeEditar, setPodeEditar] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novaVisitaData, setNovaVisitaData] = useState("");
  const [animalTermo, setAnimalTermo] = useState(
    registroInicial?.animalId
      ? `${registroInicial.animalNome || "Animal"} — ${registroInicial.animalId}`
      : "",
  );
  const [animalResultados, setAnimalResultados] = useState([]);
  const [animalBuscando, setAnimalBuscando] = useState(false);
  const [animalDropAberto, setAnimalDropAberto] = useState(false);
  const animalDropRef = useRef(null);
  const editando = Boolean(registroInicial?.id);

  // Atualiza um campo e, quando ele é uma pergunta Sim/Não com complemento,
  // limpa o complemento ao sair de "Sim" (mesmo comportamento da Esporotricose).
  const atualizar = (campo, valor) =>
    setForm((prev) => {
      const dep = COMPLEMENTARES[campo];
      if (dep && valor !== "Sim" && prev[campo] === "Sim") {
        // sai de "Sim": limpa o complemento no formulário (o registro já
        // salvo não é tocado) e o campo permanece visível, desabilitado
        return { ...prev, [campo]: valor, [dep]: "" };
      }
      return { ...prev, [campo]: valor };
    });

  // ── Agenda de acompanhamento (mesmo fluxo da Esporotricose) ─────────────
  const adicionarVisita = () => {
    if (!novaVisitaData) return;
    setForm((prev) => ({
      ...prev,
      visitas: [...prev.visitas, { data: novaVisitaData, observacao: "" }],
    }));
    setNovaVisitaData("");
  };

  const removerVisita = (idx) =>
    setForm((prev) => ({
      ...prev,
      visitas: prev.visitas.filter((_, i) => i !== idx),
    }));

  const toggleEncAcompanhamento = (checked) =>
    setForm((prev) => ({
      ...prev,
      encAcompanhamento: checked,
      // Desmarcar remove as datas e não gera novos agendamentos.
      ...(checked ? {} : { visitas: [] }),
    }));

  useEffect(() => {
    let ativo = true;
    obterDadosFormularioLeishmaniose().then((res) => {
      if (!ativo || !res?.success) return;
      setResponsavel(res.responsavel || { nome: "", cpf: "", cargo: "" });
      setPodeEditar(Boolean(res.podeEditar));
      // Cargo/Função vem do cadastro do usuário; só preenche se ainda estiver
      // vazio (não sobrescreve um valor já carregado de registro existente).
      const cargo = res.responsavel?.cargo || "";
      setForm((prev) => ({
        ...prev,
        responsavelCargo: prev.responsavelCargo || cargo,
      }));
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const fora = (e) => {
      if (animalDropRef.current && !animalDropRef.current.contains(e.target)) {
        setAnimalDropAberto(false);
      }
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const buscarAnimal = (valor) => {
    setAnimalTermo(valor);
    if (valor === " ") {
      setAnimalResultados([]);
      setAnimalDropAberto(false);
      return;
    }
    if (valor.trim().length < 2) {
      setAnimalResultados([]);
      setAnimalDropAberto(false);
      return;
    }
    setAnimalBuscando(true);
    setAnimalDropAberto(true);
    buscarAnimaisLeishmaniose(valor.trim()).then((res) => {
      setAnimalResultados(res?.success ? res.data : []);
      setAnimalBuscando(false);
    });
  };

  const selecionarAnimal = (a) => {
    setAnimalDropAberto(false);
    setAnimalTermo(`${a.nome || "Sem nome"} — ${a.id}`);
    setForm((prev) => ({
      ...prev,
      animalId: a.id,
      animalNome: a.nome || "",
      animalEspecie: a.especie || "",
      animalSexo: a.sexo || "",
      animalIdade: a.idade || "",
      animalPorte: a.porte || "",
      animalRacaPelagem: a.racaPelagem || "",
      animalIdentificacao: a.identificacao || "",
      temTutor: Boolean(a.tutor),
      tutor: a.tutor || null,
    }));
  };

  // Equipe técnica adicional (o responsável é o usuário autenticado e não
  // pode ser removido).
  const adicionarProfissional = () =>
    setForm((prev) => ({
      ...prev,
      equipe: [...prev.equipe, { nome: "", cargo: "" }],
    }));
  const alterarProfissional = (i, campo, valor) =>
    setForm((prev) => ({
      ...prev,
      equipe: prev.equipe.map((l, idx) =>
        idx === i ? { ...l, [campo]: valor } : l,
      ),
    }));
  const removerProfissional = (i) =>
    setForm((prev) => ({
      ...prev,
      equipe: prev.equipe.filter((_, idx) => idx !== i),
    }));

  // Usuário cujo cargo indica veterinário: usa o mesmo nome no campo do
  // Médico Veterinário do CCZ. Nunca presumido pela simples autenticação.
  const cargoVeterinario = /veterin/i.test(cargoUsuario);
  const veterinariosComUsuario = useMemo(
    () =>
      cargoVeterinario &&
      !form.veterinarios.some((v) => v.nome === responsavel.nome)
        ? [
            {
              nome: responsavel.nome,
              registro: "",
              cargo: cargoUsuario || "Médico Veterinário",
            },
          ]
        : [],
    [cargoVeterinario, form.veterinarios, responsavel.nome, cargoUsuario],
  );

  // ── Navegação por etapas ────────────────────────────────────────────────
  // A data de retorno é obrigatória quando o acompanhamento periódico pelo
  // CCZ está marcado (mesma regra validada no backend).
  // O acompanhamento periódico exige ao menos uma data na Agenda de
  // Acompanhamento (cada data gera um agendamento na Agenda do CCZ).
  const retornoCczInvalido = () =>
    Boolean(form.encAcompanhamento) && form.visitas.length === 0;

  const validarEtapa = (n) => {
    if (n === 1) {
      if (!form.animalId) {
        setErro("Selecione o animal da fiscalização para continuar.");
        return false;
      }
      if (!form.dataFiscalizacao) {
        setErro("Informe a data da fiscalização para continuar.");
        return false;
      }
    }
    if (retornoCczInvalido()) {
      setErro("Adicione ao menos uma data na Agenda de Acompanhamento.");
      return false;
    }
    setErro("");
    return true;
  };

  const avancar = () => {
    if (!validarEtapa(etapa)) return;
    setEtapa((prev) => Math.min(prev + 1, ETAPAS.length));
  };

  const voltar = () => {
    setErro("");
    setEtapa((prev) => Math.max(prev - 1, 1));
  };

  const limpar = () => {
    setForm({
      ...FORM_VAZIO,
      dataFiscalizacao: hojeYMD(),
      responsavelCargo: cargoUsuario,
    });
    setAnimalTermo("");
    setAnimalResultados([]);
    setAnimalDropAberto(false);
    setEtapa(1);
    setErro("");
  };

  const salvar = async () => {
    setErro("");
    if (!validarEtapa(1)) {
      setEtapa(1);
      return;
    }
    if (editando && !podeEditar) {
      setErro("Você não tem permissão para corrigir fiscalizações.");
      return;
    }
    if (retornoCczInvalido()) {
      setErro("Adicione ao menos uma data na Agenda de Acompanhamento.");
      return;
    }
    if (salvando) return;

    setSalvando(true);
    try {
      const res = await salvarLeishmaniose({
        ...form,
        retornoData: form.encAcompanhamento ? form.visitas[0]?.data || "" : "",
        equipe: form.equipe,
        veterinarios: [...veterinariosComUsuario, ...form.veterinarios],
      });
      if (res?.success) {
        onSalvo?.(res.id);
      } else {
        setErro(res?.error || "Não foi possível salvar a fiscalização.");
      }
    } catch (e) {
      setErro(e?.message || "Não foi possível salvar a fiscalização.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={leish.wrapper}>
      <div className={`${styles.card} ${styles.formCard}`}>
        {erro && <div className={styles.alertErro}>{erro}</div>}

        {/* ── INDICADOR DE ETAPAS (mesmo componente da Esporotricose) ── */}
        <div className={styles.wizardProgress}>
          {ETAPAS.map((e, i) => (
            <div key={e.numero} style={{ display: "contents" }}>
              <div
                className={`${styles.wizardStep} ${etapa === e.numero ? styles.active : ""} ${
                  etapa > e.numero ? styles.concluida : ""
                }`}
              >
                <div className={styles.stepNumber}>
                  {etapa > e.numero ? "✓" : e.numero}
                </div>
                <div className={styles.stepLabel}>{e.label}</div>
              </div>
              {i < ETAPAS.length - 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* ══ ETAPA 1: IDENTIFICAÇÃO E TRATAMENTO ══ */}
        {etapa === 1 && (
          <>
            <section className={`${leish.bloco} ${leish.grid3}`}>
              <h3 className={`${leish.blocoTitulo} ${leish.tituloFull}`}>
                Informações da Fiscalização
              </h3>

              {/* Primeira linha: data, responsável e cargo lado a lado */}
              <div className={styles.field}>
                <label>
                  Data da Fiscalização <span className={leish.req}>*</span>
                </label>
                <input
                  type="date"
                  value={form.dataFiscalizacao}
                  onChange={(e) =>
                    atualizar("dataFiscalizacao", e.target.value)
                  }
                />
              </div>
              <div className={styles.field}>
                <label>Responsável pela Fiscalização</label>
                <input
                  className={leish.campoInativo}
                  value={responsavel.nome || "—"}
                  readOnly
                  title="Preenchido com o usuário autenticado"
                />
              </div>
              <div className={styles.field}>
                <label>Cargo/Função</label>
                <input
                  value={form.responsavelCargo}
                  onChange={(e) =>
                    atualizar("responsavelCargo", e.target.value)
                  }
                  placeholder="Cargo ou função"
                />
              </div>

              {/* Segunda linha: equipe técnica adicional */}
              <div className={leish.colFull}>
                <div className={leish.linhaAcao}>
                  <button
                    type="button"
                    className={styles.btnAdicionar}
                    onClick={adicionarProfissional}
                  >
                    <Plus size={16} aria-hidden="true" /> Adicionar profissional
                  </button>
                </div>

                {form.equipe.length > 0 && (
                  <div className={leish.linhas}>
                    {form.equipe.map((l, i) => (
                      <div className={leish.linhaGridProf} key={`prof-${i}`}>
                        <div className={styles.field}>
                          <label>Nome completo</label>
                          <input
                            placeholder="Nome completo do profissional"
                            value={l.nome}
                            onChange={(e) =>
                              alterarProfissional(i, "nome", e.target.value)
                            }
                          />
                        </div>
                        <div className={styles.field}>
                          <label>Cargo/Função</label>
                          <input
                            placeholder="Cargo ou função"
                            value={l.cargo}
                            onChange={(e) =>
                              alterarProfissional(i, "cargo", e.target.value)
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.btnRemover}
                          onClick={() => removerProfissional(i)}
                          title="Remover integrante"
                        >
                          <Trash2 size={16} aria-hidden="true" /> Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={`${leish.bloco} ${leish.grid2}`}>
              <h3 className={`${leish.blocoTitulo} ${leish.tituloFull}`}>
                Identificação do Animal
              </h3>

              {/* Busca suspensa do animal (mesmo componente da Esporotricose) */}
              <div
                className={styles.field}
                style={{ position: "relative" }}
                ref={animalDropRef}
              >
                <label>Animal *</label>
                <div className={styles.inputWrapperWithIcon}>
                  <input
                    type="text"
                    value={animalTermo}
                    placeholder="Digite o nome, o ID CCZ ou o tutor do animal..."
                    onChange={(e) => buscarAnimal(e.target.value)}
                    onFocus={() => {
                      setAnimalDropAberto(true);
                      if (animalResultados.length === 0 && !animalTermo)
                        buscarAnimal(" ");
                    }}
                    autoComplete="off"
                  />
                  <span
                    className={styles.arrowIcon}
                    onClick={() => {
                      setAnimalDropAberto(!animalDropAberto);
                      if (
                        !animalDropAberto &&
                        animalResultados.length === 0 &&
                        !animalTermo
                      ) {
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
                            <th>Nome do Animal</th>
                            <th>ID CCZ</th>
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
                                className={
                                  form.animalId === a.id
                                    ? styles.selectedRow
                                    : ""
                                }
                              >
                                <td className={styles.boldName}>
                                  {a.nome || "Sem nome"}
                                </td>
                                <td>{a.id}</td>
                                <td>{a.especie || "—"}</td>
                                <td>{a.tutor?.nome || "Sem tutor"}</td>
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

              {/* Os dados cadastrais do animal (ID CCZ, espécie, sexo, idade,
                porte, raça/pelagem e identificação) não aparecem aqui: são
                recuperados do cadastro central na gravação, para o PDF. */}
            </section>

            {form.temTutor && form.tutor && (
              <section className={`${leish.bloco} ${leish.grid3}`}>
                <h3 className={`${leish.blocoTitulo} ${leish.tituloFull}`}>
                  Identificação do Tutor
                </h3>
                <div className={styles.field}>
                  <label>Nome completo</label>
                  <input
                    className={leish.campoInativo}
                    value={form.tutor.nome || ""}
                    readOnly
                  />
                </div>
                <div className={styles.field}>
                  <label>CPF</label>
                  <input
                    className={leish.campoInativo}
                    value={form.tutor.cpf || ""}
                    readOnly
                  />
                </div>
                <div className={styles.field}>
                  <label>Telefone</label>
                  <input
                    className={leish.campoInativo}
                    value={form.tutor.telefone || ""}
                    readOnly
                  />
                </div>
                <div className={`${styles.field} ${leish.colFull}`}>
                  <label>Endereço completo</label>
                  <input
                    className={leish.campoInativo}
                    value={form.tutor.endereco || ""}
                    readOnly
                  />
                </div>
              </section>
            )}

            <section className={leish.bloco}>
              <h3 className={leish.blocoTitulo}>
                Condição Clínica e Tratamento
              </h3>
              <div className={leish.grid3}>
                <SimNao
                  label="Ainda apresenta lesões compatíveis com a doença?"
                  valor={form.apresentaLesoes}
                  onChange={(v) => atualizar("apresentaLesoes", v)}
                />
                {form.apresentaLesoes === "Sim" && (
                  <div className={styles.field}>
                    <label>Quais lesões?</label>
                    <input
                      value={form.quaisLesoes}
                      onChange={(e) => atualizar("quaisLesoes", e.target.value)}
                    />
                  </div>
                )}
                <SimNao
                  label="Está em tratamento veterinário contínuo?"
                  valor={form.emTratamento}
                  onChange={(v) => atualizar("emTratamento", v)}
                />
              </div>

              {form.emTratamento === "Sim" && (
                <>
                  <div className={leish.grid3}>
                    <div className={styles.field}>
                      <label>Data de início do tratamento</label>
                      <input
                        type="date"
                        value={form.tratamentoInicio}
                        onChange={(e) =>
                          atualizar("tratamentoInicio", e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Profissional ou serviço de referência</label>
                      <input
                        value={form.profissionalRef}
                        onChange={(e) =>
                          atualizar("profissionalRef", e.target.value)
                        }
                      />
                    </div>
                    <SimNao
                      label="A posologia correta está sendo administrada?"
                      valor={form.posologiaCorreta}
                      opcoes={["Sim", "Não", "Parcialmente"]}
                      onChange={(v) => atualizar("posologiaCorreta", v)}
                    />
                  </div>
                  <div className={leish.grid2}>
                    <div className={styles.field}>
                      <label>Medicamentos prescritos</label>
                      <textarea
                        rows={2}
                        value={form.medicamentos}
                        onChange={(e) =>
                          atualizar("medicamentos", e.target.value)
                        }
                      />
                    </div>
                    <SimNao
                      label="Houve interrupção do tratamento?"
                      valor={form.interrupcao}
                      onChange={(v) => atualizar("interrupcao", v)}
                    />
                  </div>
                  {form.interrupcao === "Sim" && (
                    <div className={styles.field}>
                      <label>Motivo da interrupção</label>
                      <textarea
                        rows={2}
                        value={form.interrupcaoMotivo}
                        onChange={(e) =>
                          atualizar("interrupcaoMotivo", e.target.value)
                        }
                      />
                    </div>
                  )}
                </>
              )}

              <div className={leish.grid3}>
                <SimNao
                  label="Há registro de retorno ou revisão veterinária?"
                  valor={form.retornoVeterinario}
                  onChange={(v) => atualizar("retornoVeterinario", v)}
                />
                {form.retornoVeterinario === "Sim" && (
                  <div className={styles.field}>
                    <label>Data do retorno</label>
                    <input
                      type="date"
                      value={form.retornoData}
                      onChange={(e) => atualizar("retornoData", e.target.value)}
                    />
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ══ ETAPA 2: MANEJO ══ */}
        {etapa === 2 && (
          <>
            <section className={leish.bloco}>
              <h3 className={leish.blocoTitulo}>Manejo e Biossegurança</h3>
              <div className={leish.linhaCampos}>
                <SimNao
                  coluna="colLg"
                  label="O animal é mantido com coleira repelente?"
                  valor={form.coleiraRepelente}
                  onChange={(v) => atualizar("coleiraRepelente", v)}
                  complemento={{
                    tipo: "text",
                    valor: form.coleiraTroca,
                    onChange: (v) => atualizar("coleiraTroca", v),
                    placeholder: "Intervalo de troca (ex.: a cada 4 meses)",
                  }}
                />
                <div className={`${styles.field} ${styles.colSm}`}>
                  <label>
                    Produtos utilizados na higienização e resíduos contaminados
                  </label>
                  <textarea
                    rows={1}
                    value={form.produtosHigiene}
                    onChange={(e) =>
                      atualizar("produtosHigiene", e.target.value)
                    }
                    placeholder="Produtos utilizados"
                  />
                </div>
                <div className={`${styles.field} ${styles.colSm}`}>
                  <label>Frequência da higienização</label>
                  <input
                    value={form.frequenciaHigiene}
                    onChange={(e) =>
                      atualizar("frequenciaHigiene", e.target.value)
                    }
                    placeholder="Ex.: semanal"
                  />
                </div>
                <SimNao
                  coluna="colSm"
                  label="Tem acesso a áreas periurbanas ou mata?"
                  valor={form.acessoAreaRural}
                  onChange={(v) => atualizar("acessoAreaRural", v)}
                />
                <SimNao
                  coluna="colLg"
                  label="Viajou para outro município?"
                  valor={form.deslocamento}
                  onChange={(v) => atualizar("deslocamento", v)}
                  complemento={{
                    tipo: "date",
                    valor: form.deslocamentoQuando,
                    onChange: (v) => atualizar("deslocamentoQuando", v),
                    placeholder: "Data do deslocamento",
                  }}
                />
              </div>
            </section>

            <section className={leish.bloco}>
              <h3 className={leish.blocoTitulo}>
                Outros Animais e Pessoas na Residência
              </h3>
              <div className={leish.linhaCampos}>
                <SimNao
                  coluna="colLg"
                  label="Existem outros animais no domicílio?"
                  valor={form.outrosAnimais}
                  onChange={(v) => atualizar("outrosAnimais", v)}
                  complemento={{
                    tipo: "textarea",
                    valor: form.outrosAnimaisDesc,
                    onChange: (v) => atualizar("outrosAnimaisDesc", v),
                    placeholder: "Quais? Quantos? Apresentam sintomas?",
                  }}
                />
                <SimNao
                  coluna="colLg"
                  label="Os outros animais apresentam lesões suspeitas?"
                  valor={form.outrosComLesoes}
                  opcoes={["Sim", "Não", "Não Avaliado"]}
                  onChange={(v) => atualizar("outrosComLesoes", v)}
                  complemento={{
                    tipo: "textarea",
                    valor: form.outrosComLesoesDesc,
                    onChange: (v) => atualizar("outrosComLesoesDesc", v),
                    placeholder: "Descreva as lesões",
                  }}
                />
                <SimNao
                  coluna="colLg"
                  label="Há pessoas com lesões suspeitas de Leishmaniose Cutânea?"
                  valor={form.pessoasComLesoes}
                  onChange={(v) => atualizar("pessoasComLesoes", v)}
                  complemento={{
                    tipo: "textarea",
                    valor: form.pessoasComLesoesDesc,
                    onChange: (v) => atualizar("pessoasComLesoesDesc", v),
                    placeholder: "Descreva as lesões suspeitas",
                  }}
                />
                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>
                    Essas pessoas foram orientadas a procurar atendimento
                    médico?
                  </label>
                  <select
                    value={form.pessoasOrientadas || ""}
                    disabled={form.pessoasComLesoes !== "Sim"}
                    onChange={(e) =>
                      atualizar("pessoasOrientadas", e.target.value)
                    }
                  >
                    <option value="">Selecione...</option>
                    {SIM_NAO.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className={leish.bloco}>
              <h3 className={leish.blocoTitulo}>Condições do Ambiente</h3>
              <div className={leish.linha3}>
                <div className={`${styles.field} ${styles.colMd}`}>
                  <label>Condições sanitárias gerais</label>
                  <select
                    value={form.condicoesSanitarias || ""}
                    onChange={(e) =>
                      atualizar("condicoesSanitarias", e.target.value)
                    }
                  >
                    <option value="">Selecione...</option>
                    {["Boas", "Regulares", "Ruins"].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <SimNao
                  coluna="colMd"
                  label="O ambiente oferece risco de disseminação da doença?"
                  valor={form.riscoDisseminacao}
                  onChange={(v) => atualizar("riscoDisseminacao", v)}
                />
                <SimNao
                  coluna="colMd"
                  label="Há risco à saúde pública identificado?"
                  valor={form.riscoSaudePublica}
                  onChange={(v) => atualizar("riscoSaudePublica", v)}
                />
              </div>
              <div className={leish.linhaCampos}>
                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>Observações</label>
                  <textarea
                    rows={3}
                    value={form.condicoesObs}
                    onChange={(e) => atualizar("condicoesObs", e.target.value)}
                  />
                </div>
                <div className={`${styles.field} ${styles.colLg}`}>
                  <label>Descrição dos riscos identificados</label>
                  <textarea
                    rows={3}
                    value={form.riscoDescricao}
                    onChange={(e) =>
                      atualizar("riscoDescricao", e.target.value)
                    }
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* ══ ETAPA 3: ORIENTAÇÕES ══ */}
        {etapa === 3 && (
          <section className={leish.bloco}>
            <h3 className={leish.blocoTitulo}>Orientações e Comprometimento</h3>
            {form.temTutor ? (
              <div className={leish.grid3}>
                <SimNao
                  label="Orientado sobre a zoonose e formas de transmissão"
                  valor={form.orientZoonose}
                  onChange={(v) => atualizar("orientZoonose", v)}
                />
                <SimNao
                  label="Orientado sobre a necessidade de tratamento contínuo"
                  valor={form.orientTratamento}
                  onChange={(v) => atualizar("orientTratamento", v)}
                />
                <SimNao
                  label="Orientado sobre o uso correto da coleira repelente"
                  valor={form.orientColeira}
                  onChange={(v) => atualizar("orientColeira", v)}
                />
                <SimNao
                  label="Orientado a contatar o CCZ em caso de novas lesões"
                  valor={form.orientNovasLesoes}
                  onChange={(v) => atualizar("orientNovasLesoes", v)}
                />
                <SimNao
                  label="Ciente da obrigatoriedade das orientações sanitárias e terapêuticas"
                  valor={form.orientObrigacoes}
                  onChange={(v) => atualizar("orientObrigacoes", v)}
                />
                <SimNao
                  label="O tutor demonstra comprometimento com o tratamento e as orientações?"
                  valor={form.comprometimento}
                  opcoes={["Sim", "Parcialmente", "Não"]}
                  onChange={(v) => atualizar("comprometimento", v)}
                />
              </div>
            ) : (
              <p className={leish.aviso}>
                Animal sem tutor vinculado: não há orientações nem
                comprometimento a registrar.
              </p>
            )}
          </section>
        )}

        {/* ══ ETAPA 4: CONCLUSÃO ══ */}
        {etapa === 4 && (
          <>
            <section className={leish.bloco}>
              <h3 className={leish.blocoTitulo}>Conclusão da Equipe Técnica</h3>
              <div className={leish.grid2}>
                {form.temTutor && (
                  <SimNao
                    label="Conduta do tutor"
                    valor={form.condutaTutor}
                    opcoes={["Adequada", "Parcialmente adequada", "Inadequada"]}
                    onChange={(v) => atualizar("condutaTutor", v)}
                  />
                )}
                <SimNao
                  label="Situação geral"
                  valor={form.situacaoGeral}
                  opcoes={[
                    "Animal sob tratamento e isolamento adequados",
                    "Animal em risco, requer reforço de conduta",
                    "Risco à saúde pública, encaminhamentos necessários",
                  ]}
                  onChange={(v) => atualizar("situacaoGeral", v)}
                />
              </div>

              {/* ── ENCAMINHAMENTOS SUGERIDOS (padrão da Esporotricose) ── */}
              <div className={styles.formSectionTitle}>
                Encaminhamentos sugeridos
              </div>
              <div className={styles.grid}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={form.encAcompanhamento}
                      onChange={(e) =>
                        toggleEncAcompanhamento(e.target.checked)
                      }
                    />
                    Acompanhamento periódico pelo CCZ
                  </label>
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={form.encNotificacao}
                      onChange={(e) =>
                        atualizar("encNotificacao", e.target.checked)
                      }
                    />
                    Notificação formal ao tutor
                  </label>
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={form.encMinisterioPublico}
                      onChange={(e) =>
                        atualizar("encMinisterioPublico", e.target.checked)
                      }
                    />
                    Encaminhamento ao Ministério Público
                  </label>
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={form.encOutrasMedidas}
                      onChange={(e) =>
                        atualizar("encOutrasMedidas", e.target.checked)
                      }
                    />
                    Outras medidas sanitárias
                  </label>
                </div>

                <div className={`${styles.field} ${styles.colFull}`}>
                  <label>Descreva as outras medidas / observações</label>
                  <textarea
                    rows={2}
                    value={form.encOutrasDescricao}
                    onChange={(e) =>
                      atualizar("encOutrasDescricao", e.target.value)
                    }
                    placeholder="Outras medidas / observações"
                  />
                </div>
              </div>

              {/* ── AGENDA DE ACOMPANHAMENTO (condicional) ── */}
              {form.encAcompanhamento && (
                <>
                  <div className={styles.formSectionTitle}>
                    Agenda de acompanhamento
                  </div>
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
                          <div
                            key={`${v.data}-${idx}`}
                            className={styles.visitaItem}
                          >
                            <div className={styles.visitaHeader}>
                              <span className={styles.visitaData}>
                                {formatarDiaBR(v.data)}
                              </span>
                              <button
                                type="button"
                                className={styles.btnRemover}
                                onClick={() => removerVisita(idx)}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ── NAVEGAÇÃO ENTRE ETAPAS ── */}
        <div className={styles.wizardActions}>
          <div>
            {etapa > 1 && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={voltar}
                disabled={salvando}
              >
                ← Anterior
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={editando && onSalvo ? onSalvo : limpar}
              disabled={salvando}
            >
              {editando ? "Cancelar" : "Limpar"}
            </button>
            {etapa < ETAPAS.length ? (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={avancar}
              >
                Próximo →
              </button>
            ) : (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={salvar}
                disabled={salvando}
              >
                {salvando
                  ? "Salvando..."
                  : editando
                    ? "Salvar Alterações"
                    : "Salvar Registro"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
