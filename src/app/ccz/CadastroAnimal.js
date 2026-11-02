"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroAnimal.module.css";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import { documentoPaciente } from "@/app/regulacao/constants";
import { buscarPessoasCCZ, salvarAnimal, buscarAnimaisCCZ, obterAnimal } from "./actions";
import { compressImage } from "@/lib/imageCompression";

const MAX_FOTO_BYTES = 5 * 1024 * 1024; // ~5MB

const FORM_VAZIO = {
  fotoUrl: "",
  id: "",
  nome: "",
  especie: "",
  sexo: "",
  porte: "",
  idade: "",
  possuiResponsavel: "Não",
  pessoaCpf: "",
  castrado: "Não",
  doencaCronica: "Não",
  qualDoenca: "",
  apetiteNormal: "Sim",
  sintomasVomitoDiarreia: "Não",
  emTratamento: "Não",
  qualTratamento: "",
  observacoes: "",
};

export default function CadastroAnimal({ animalInicial = null, onSalvo, onCancelar }) {
  const confirm = useConfirm();
  const notify = useNotify();

  const editando = Boolean(animalInicial?.id);
  const [modoEdicao, setModoEdicao] = useState(editando);
  const [animalCarregado, setAnimalCarregado] = useState(animalInicial);
  const [form, setForm] = useState(animalInicial || FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [fotoErro, setFotoErro] = useState("");

  console.log("CadastroAnimal - Estados:", { editando, modoEdicao, animalCarregado: !!animalCarregado });

  // Busca de animal via campo Nome
  const [animaisResultados, setAnimaisResultados] = useState([]);
  const [animaisDropAberto, setAnimaisDropAberto] = useState(false);
  const [animaisBuscando, setAnimaisBuscando] = useState(false);
  const animaisDropRef = useRef(null);

  // Busca de PESSOA para vincular como tutor (campo "Possui tutor? = Sim").
  const [tutorTermo, setTutorTermo] = useState(animalInicial?.tutorNome || "");
  const [tutorNome, setTutorNome] = useState(animalInicial?.tutorNome || "");
  const [tutorResultados, setTutorResultados] = useState([]);
  const [tutorDropAberto, setTutorDropAberto] = useState(false);
  const [tutorBuscando, setTutorBuscando] = useState(false);
  const tutorDropRef = useRef(null);

  // Fecha o dropdown de tutor ao clicar fora.
  useEffect(() => {
    function handleClickOutside(e) {
      if (tutorDropRef.current && !tutorDropRef.current.contains(e.target)) {
        setTutorDropAberto(false);
      }
      if (animaisDropRef.current && !animaisDropRef.current.contains(e.target)) {
        setAnimaisDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca pessoas (nome ou CPF) ao digitar >= 2 caracteres.
  const buscarTutor = async (valor) => {
    setTutorTermo(valor);
    setTutorNome(valor);
    // Ao digitar, limpa a seleção anterior até escolher de novo.
    setForm((prev) => ({ ...prev, pessoaCpf: "" }));
    if (valor.trim().length < 2) {
      setTutorDropAberto(false);
      setTutorResultados([]);
      return;
    }
    setTutorDropAberto(true);
    setTutorBuscando(true);
    const res = await buscarPessoasCCZ(valor.trim());
    setTutorResultados(res.success ? res.data : []);
    setTutorBuscando(false);
  };

  const selecionarTutor = (p) => {
    setForm((prev) => ({ ...prev, pessoaCpf: p.cpf }));
    setTutorNome(p.nomeCompleto || "");
    setTutorTermo(p.nomeCompleto || "");
    setTutorDropAberto(false);
  };

  // Busca animais ao digitar no campo Nome
  const buscarAnimalPorNome = async (valor) => {
    setForm((prev) => ({ ...prev, nome: valor }));
    
    if (modoEdicao || editando) {
      console.log("Busca bloqueada - modoEdicao:", modoEdicao, "editando:", editando);
      return;
    }
    
    // Se o campo estiver vazio, apenas limpa os resultados
    if (!valor || valor.trim().length === 0) {
      setAnimaisResultados([]);
      return;
    }
    
    // Faz a busca somente se houver texto
    console.log("Buscando animais com termo:", valor);
    setAnimaisDropAberto(true);
    setAnimaisBuscando(true);
    const res = await buscarAnimaisCCZ(valor.trim());
    console.log("Resultados da busca:", res);
    setAnimaisResultados(res.success ? res.data : []);
    setAnimaisBuscando(false);
  };

  const selecionarAnimal = async (animal) => {
    setAnimaisDropAberto(false);
    setAnimaisBuscando(true);
    const res = await obterAnimal(animal.id);
    setAnimaisBuscando(false);
    
    if (res.success) {
      setForm(res.data);
      setAnimalCarregado(res.data);
      setTutorNome(res.data.tutorNome || "");
      setTutorTermo(res.data.tutorNome || "");
    }
  };

  const iniciarNovo = () => {
    setForm(FORM_VAZIO);
    setAnimalCarregado(null);
    setModoEdicao(true);
    setTutorNome("");
    setTutorTermo("");
    setErro("");
    setFotoErro("");
  };

  const iniciarEdicao = () => {
    setModoEdicao(true);
  };

  const cancelarOperacao = () => {
    if (animalCarregado) {
      setForm(animalCarregado);
      setModoEdicao(false);
    } else if (onCancelar) {
      onCancelar();
    } else {
      setForm(FORM_VAZIO);
      setModoEdicao(false);
    }
  };

  const atualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  // ── Foto: lê como data URL, comprime e gera preview ───────────────────────
  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    setFotoErro("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFotoErro("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      setFotoErro("A imagem deve ter no máximo 5MB.");
      return;
    }

    try {
      setFotoErro("Processando imagem...");
      const { compressed } = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
      });
      
      // Use compressed image for storage
      atualizar("fotoUrl", compressed);
      setFotoErro("");
    } catch (error) {
      setFotoErro(error.message || "Erro ao processar a imagem.");
    }
  };

  // ── Dropdowns com campo condicional ao lado ───────────────────────────────
  const handlePossuiResponsavel = (valor) => {
    setForm((prev) => ({
      ...prev,
      possuiResponsavel: valor,
      // Limpa o tutor selecionado quando passa para "Não".
      pessoaCpf: valor === "Sim" ? prev.pessoaCpf : "",
    }));
    if (valor !== "Sim") {
      setTutorTermo("");
      setTutorNome("");
      setTutorResultados([]);
      setTutorDropAberto(false);
    }
  };

  const handleDoencaCronica = (valor) => {
    setForm((prev) => ({
      ...prev,
      doencaCronica: valor,
      qualDoenca: valor === "Sim" ? prev.qualDoenca : "",
    }));
  };

  const handleEmTratamento = (valor) => {
    setForm((prev) => ({
      ...prev,
      emTratamento: valor,
      qualTratamento: valor === "Sim" ? prev.qualTratamento : "",
    }));
  };

  const limpar = () => {
    setForm(FORM_VAZIO);
    setErro("");
    setFotoErro("");
    setTutorTermo("");
    setTutorNome("");
    setTutorResultados([]);
    setTutorDropAberto(false);
  };

  const salvar = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: animalCarregado ? "Atualizar animal" : "Cadastrar animal",
      message: animalCarregado
        ? "Deseja salvar as alterações deste animal?"
        : "Deseja confirmar o cadastro deste animal?",
      confirmText: animalCarregado ? "Atualizar" : "Cadastrar",
    });
    if (!ok) return;

    setSalvando(true);
    const res = await salvarAnimal(form);
    setSalvando(false);

    if (res.success) {
      setErro("");
      await notify({
        tipo: "sucesso",
        title: "Pronto",
        message: animalCarregado ? "Animal atualizado com sucesso!" : "Animal salvo com sucesso!",
      });
      if (editando && onSalvo) {
        onSalvo();
      } else {
        setForm(FORM_VAZIO);
        setAnimalCarregado(null);
        setModoEdicao(false);
        setTutorNome("");
        setTutorTermo("");
      }
    } else {
      setErro(res.error || "Não foi possível salvar o animal.");
    }
  };

  const camposDesabilitados = !modoEdicao && !editando;

  const doencaDesabilitada = camposDesabilitados || form.doencaCronica !== "Sim";
  const tratamentoDesabilitado = camposDesabilitados || form.emTratamento !== "Sim";
  const tutorDesabilitado = camposDesabilitados || form.possuiResponsavel !== "Sim";

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <form onSubmit={salvar} className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardHeaderTitle}>
            {editando ? "Editar animal" : animalCarregado ? `${animalCarregado.nome} (${animalCarregado.id})` : "Buscar ou cadastrar animal"}
          </h2>
          {!editando && (
            <button
              type="button"
              className={styles.btnAdicionar}
              onClick={iniciarNovo}
            >
              Novo cadastro
            </button>
          )}
        </div>

        <div className={styles.camposBloco}>
          <div className={styles.formSectionTitle}>Identificação</div>
          <div className={styles.grid}>
            {/* Foto do animal */}
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Foto do animal</label>
              <div className={styles.fotoBloco}>
                {form.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.fotoUrl} alt="Pré-visualização do animal" className={styles.fotoPreview} />
                ) : (
                  <div className={styles.fotoPlaceholder}>Sem foto</div>
                )}
                <div className={styles.fotoControles}>
                  <input type="file" accept="image/*" onChange={handleFoto} />
                  {form.fotoUrl && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => atualizar("fotoUrl", "")}
                    >
                      Remover foto
                    </button>
                  )}
                  {fotoErro && <small className={styles.hintErro}>{fotoErro}</small>}
                </div>
              </div>
            </div>

            {/* Id do animal (campo pequeno) */}
            <div className={`${styles.field} ${styles.colXs}`}>
              <label>Id do animal</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => atualizar("id", e.target.value)}
                placeholder="Gerado se vazio"
                disabled={camposDesabilitados}
              />
            </div>

            {/* Nome do animal - COM BUSCA */}
            <div className={`${styles.field} ${styles.colLg}`} style={{ position: "relative" }} ref={animaisDropRef}>
              <label>Nome do Animal</label>
              <div className={styles.inputWrapperWithIcon}>
                <input
                  type="text"
                  value={form.nome}
                  placeholder={modoEdicao || editando ? "" : "Digite nome ou ID para buscar..."}
                  onChange={(e) => buscarAnimalPorNome(e.target.value)}
                  onFocus={() => {
                    if (!modoEdicao && !editando) {
                      setAnimaisDropAberto(true);
                    }
                  }}
                  autoComplete="off"
                />
                {!modoEdicao && !editando && (
                  <span className={styles.arrowIcon} onClick={() => setAnimaisDropAberto(!animaisDropAberto)}>
                    {animaisDropAberto ? "▲" : "▼"}
                  </span>
                )}
              </div>
              {!modoEdicao && !editando && animaisDropAberto && (
                <div className={styles.tableDropdownMenu}>
                  <div className={styles.tableContainerScroll}>
                    <table className={styles.patientTableDropdown}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Espécie</th>
                          <th>Tutor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {animaisBuscando ? (
                          <tr>
                            <td colSpan="4" className={styles.noDataTd}>Buscando animais...</td>
                          </tr>
                        ) : animaisResultados.length > 0 ? (
                          animaisResultados.map((a) => (
                            <tr
                              key={a.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selecionarAnimal(a);
                              }}
                            >
                              <td>{a.id}</td>
                              <td className={styles.boldName}>{a.nome || "Sem nome"}</td>
                              <td>{a.especie}</td>
                              <td>{a.tutorNome || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className={styles.noDataTd}>
                              {form.nome.trim() ? "Nenhum animal encontrado" : "Digite para buscar animais..."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Idade */}
            <div className={`${styles.field} ${styles.colMd}`}>
              <label>Idade</label>
              <input
                type="text"
                value={form.idade}
                onChange={(e) => atualizar("idade", e.target.value)}
                placeholder="Ex: 2 anos"
                disabled={camposDesabilitados}
              />
            </div>

            {/* Espécie */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Espécie *</label>
              <select
                value={form.especie}
                onChange={(e) => atualizar("especie", e.target.value)}
                required
                disabled={camposDesabilitados}
              >
                <option value="">-- Selecione --</option>
                <option value="Canina">Canina</option>
                <option value="Felina">Felina</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Sexo (exibe Macho/Fêmea; a action persiste M/F) */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Sexo *</label>
              <select
                value={form.sexo}
                onChange={(e) => atualizar("sexo", e.target.value)}
                required
                disabled={camposDesabilitados}
              >
                <option value="">-- Selecione --</option>
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
              </select>
            </div>

            {/* Porte */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Porte *</label>
              <select
                value={form.porte}
                onChange={(e) => atualizar("porte", e.target.value)}
                required
                disabled={camposDesabilitados}
              >
                <option value="">-- Selecione --</option>
                <option value="Grande">Grande</option>
                <option value="Médio">Médio</option>
                <option value="Pequeno">Pequeno</option>
              </select>
            </div>
          </div>

          <div className={styles.formSectionTitle}>Dados clínicos</div>
          <div className={styles.grid}>
            {/* Possui tutor? + seletor de tutor ao lado */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Possui tutor?</label>
              <div className={styles.rowComposta}>
                <div className={styles.colControle}>
                  <select
                    value={form.possuiResponsavel}
                    onChange={(e) => handlePossuiResponsavel(e.target.value)}
                    disabled={camposDesabilitados}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={styles.colAnexo} style={{ position: "relative" }} ref={tutorDropRef}>
                  <input
                    type="text"
                    value={tutorNome}
                    placeholder={tutorDesabilitado ? "—" : "Digite nome ou CPF do tutor..."}
                    onChange={(e) => buscarTutor(e.target.value)}
                    disabled={tutorDesabilitado}
                    autoComplete="off"
                  />
                  {!tutorDesabilitado && tutorDropAberto && (
                    <div className={styles.tableDropdownMenu}>
                      <div className={styles.tableContainerScroll}>
                        <table className={styles.patientTableDropdown}>
                          <thead>
                            <tr>
                              <th>CPF / CNS</th>
                              <th>Nome</th>
                              <th>Nome da mãe</th>
                              <th>Data nasc.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tutorResultados.length > 0 ? (
                              tutorResultados.map((p) => (
                                <tr
                                  key={p.cpf}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    selecionarTutor(p);
                                  }}
                                  className={form.pessoaCpf === p.cpf ? styles.selectedRow : ""}
                                >
                                  <td>{documentoPaciente({ cpf: p.cpf, cns: p.cns })}</td>
                                  <td className={styles.boldName}>{p.nomeCompleto}</td>
                                  <td>{p.nomeMae || "Não informada"}</td>
                                  <td>
                                    {p.dataNascimento
                                      ? p.dataNascimento.split("-").reverse().join("/")
                                      : "-"}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4" className={styles.noDataTd}>
                                  {tutorBuscando ? "Buscando pessoas..." : "Nenhuma pessoa encontrada."}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Castrado */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Castrado</label>
              <select
                value={form.castrado}
                onChange={(e) => atualizar("castrado", e.target.value)}
                disabled={camposDesabilitados}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            {/* Doença Crônica? */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Doença Crônica?</label>
              <select
                value={form.doencaCronica}
                onChange={(e) => handleDoencaCronica(e.target.value)}
                disabled={camposDesabilitados}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            {/* Qual doença (só aparece se "Sim") */}
            {form.doencaCronica === "Sim" && (
              <div className={`${styles.field} ${styles.colMd}`}>
                <label>Qual doença?</label>
                <input
                  type="text"
                  value={form.qualDoenca}
                  onChange={(e) => atualizar("qualDoenca", e.target.value)}
                  placeholder="Ex: diabetes, insuficiência renal, etc."
                  disabled={camposDesabilitados}
                />
              </div>
            )}

            {/* Apetite */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Apetite</label>
              <select
                value={form.apetiteNormal}
                onChange={(e) => atualizar("apetiteNormal", e.target.value)}
                disabled={camposDesabilitados}
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>

            {/* Vômito / Diarreia */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Vômito / Diarreia</label>
              <select
                value={form.sintomasVomitoDiarreia}
                onChange={(e) => atualizar("sintomasVomitoDiarreia", e.target.value)}
                disabled={camposDesabilitados}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            {/* Em tratamento? */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Em tratamento?</label>
              <select
                value={form.emTratamento}
                onChange={(e) => handleEmTratamento(e.target.value)}
                disabled={camposDesabilitados}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            {/* Qual tratamento (só aparece se "Sim") */}
            {form.emTratamento === "Sim" && (
              <div className={`${styles.field} ${styles.colLg}`}>
                <label>Qual tratamento?</label>
                <textarea
                  rows={2}
                  value={form.qualTratamento}
                  onChange={(e) => atualizar("qualTratamento", e.target.value)}
                  placeholder="Descreva o tratamento (medicamentos, frequência, etc.)"
                  disabled={camposDesabilitados}
                />
              </div>
            )}

            {/* Observação */}
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Observação</label>
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) => atualizar("observacoes", e.target.value)}
                disabled={camposDesabilitados}
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          {!editando && !modoEdicao && animalCarregado && (
            <button
              type="button"
              className={styles.btnOutline}
              onClick={iniciarEdicao}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "0.5rem" }}
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
          )}
          {(modoEdicao || editando) && (
            <>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={cancelarOperacao}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                {salvando ? "Salvando..." : animalCarregado ? "Atualizar" : "Salvar"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
