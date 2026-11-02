"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroAnimal.module.css";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import { buscarAnimaisCCZ, salvarProcedimento } from "./actions";

const TIPOS = [
  "Castração",
  "Vacinação",
  "Vermifugação",
  "Cirurgia",
  "Consulta",
  "Exame",
  "Internação",
  "Eutanásia",
];

const STATUS = ["Agendado", "Realizado", "Cancelado"];

const hojeYMD = () => new Date().toISOString().split("T")[0];

const FORM_VAZIO = {
  id: "",
  animalId: "",
  tipo: "",
  dataProcedimento: hojeYMD(),
  veterinario: "",
  status: "Agendado",
  descricao: "",
  medicacaoPrescrita: "",
  temRetorno: "Não",
  dataRetorno: "",
};

export default function CadastroProcedimento({ registroInicial = null, onSalvo }) {
  const confirm = useConfirm();
  const notify = useNotify();

  const editando = Boolean(registroInicial?.id);
  const [form, setForm] = useState(
    registroInicial
      ? {
          ...FORM_VAZIO,
          ...registroInicial,
        }
      : FORM_VAZIO,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [usuarioLogado, setUsuarioLogado] = useState(null);

  // Busca de ANIMAL (dropdown, igual ao seletor de tutor no cadastro de animal).
  const [animalTermo, setAnimalTermo] = useState(registroInicial?.animalLabel || "");
  const [animalResultados, setAnimalResultados] = useState([]);
  const [animalDropAberto, setAnimalDropAberto] = useState(false);
  const [animalBuscando, setAnimalBuscando] = useState(false);
  const animalDropRef = useRef(null);

  // Busca o usuário logado ao carregar o componente
  useEffect(() => {
    async function carregarUsuario() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setUsuarioLogado(data.user);
          // Se não está editando, preenche automaticamente o campo veterinário
          if (!editando && data.user?.nomeCompleto) {
            setForm((prev) => ({ ...prev, veterinario: data.user.nomeCompleto }));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
      }
    }
    carregarUsuario();
  }, [editando]);

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
    // Limpa a seleção anterior até escolher de novo.
    setForm((prev) => ({ ...prev, animalId: "" }));
    if (valor.trim().length < 2) {
      setAnimalDropAberto(false);
      setAnimalResultados([]);
      return;
    }
    setAnimalDropAberto(true);
    setAnimalBuscando(true);
    const res = await buscarAnimaisCCZ(valor.trim());
    setAnimalResultados(res.success ? res.data : []);
    setAnimalBuscando(false);
  };

  const selecionarAnimal = (a) => {
    setForm((prev) => ({ ...prev, animalId: a.id }));
    setAnimalTermo(`${a.nome?.trim() || "Sem nome"} (${a.id})`);
    setAnimalDropAberto(false);
  };

  const handleRetorno = (valor) => {
    setForm((prev) => ({
      ...prev,
      temRetorno: valor,
      dataRetorno: valor === "Sim" ? prev.dataRetorno : "",
    }));
  };

  const limpar = () => {
    setForm({
      ...FORM_VAZIO,
      veterinario: usuarioLogado?.nomeCompleto || "",
    });
    setErro("");
    setAnimalTermo("");
    setAnimalResultados([]);
    setAnimalDropAberto(false);
  };

  const salvar = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: editando ? "Salvar procedimento" : "Cadastrar procedimento",
      message: editando
        ? "Deseja salvar as alterações deste procedimento?"
        : "Deseja confirmar o cadastro deste procedimento?",
      confirmText: "Salvar",
    });
    if (!ok) return;

    setSalvando(true);
    const res = await salvarProcedimento(form);
    setSalvando(false);

    if (res.success) {
      setErro("");
      await notify({
        tipo: "sucesso",
        title: "Pronto",
        message: editando
          ? "Procedimento atualizado com sucesso!"
          : "Procedimento salvo com sucesso!",
      });
      if (editando && onSalvo) {
        onSalvo();
      } else {
        limpar();
      }
    } else {
      setErro(res.error || "Não foi possível salvar o procedimento.");
    }
  };

  const retornoDesabilitado = form.temRetorno !== "Sim";

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <form onSubmit={salvar} className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardHeaderTitle}>
            {editando ? "Editar procedimento" : "Cadastro de procedimento"}
          </h2>
          <button
            type="button"
            className={styles.btnAdicionar}
            onClick={editando && onSalvo ? onSalvo : limpar}
          >
            {editando ? "Voltar à lista" : "Limpar formulário"}
          </button>
        </div>

        <div className={styles.camposBloco}>
          <div className={styles.formSectionTitle}>Dados do procedimento</div>
          <div className={styles.grid}>
            {/* Animal (dropdown de busca) */}
            <div
              className={`${styles.field} ${styles.colLg}`}
              style={{ position: "relative" }}
              ref={animalDropRef}
            >
              <label>Animal *</label>
              <input
                type="text"
                value={animalTermo}
                placeholder="Digite nome, id ou espécie do animal..."
                onChange={(e) => buscarAnimal(e.target.value)}
                autoComplete="off"
                required={!form.animalId}
              />
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

            {/* Tipo de procedimento */}
            <div className={`${styles.field} ${styles.colMd}`}>
              <label>Tipo de procedimento *</label>
              <select
                value={form.tipo}
                onChange={(e) => atualizar("tipo", e.target.value)}
                required
              >
                <option value="">-- Selecione --</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Data do procedimento */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Data do procedimento *</label>
              <input
                type="date"
                value={form.dataProcedimento}
                onChange={(e) => atualizar("dataProcedimento", e.target.value)}
                required
              />
            </div>

            {/* Status */}
            <div className={`${styles.field} ${styles.colSm}`}>
              <label>Status *</label>
              <select
                value={form.status}
                onChange={(e) => atualizar("status", e.target.value)}
                required
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Veterinário */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Veterinário</label>
              <input
                type="text"
                value={form.veterinario}
                disabled
                placeholder="Carregando usuário..."
                style={{ 
                  backgroundColor: '#f8fafc', 
                  cursor: 'not-allowed',
                  color: '#475569'
                }}
              />
            </div>

            {/* Retorno? + data de retorno ao lado */}
            <div className={`${styles.field} ${styles.colLg}`}>
              <label>Retorno?</label>
              <div className={styles.rowComposta}>
                <div className={styles.colControle}>
                  <select
                    value={form.temRetorno}
                    onChange={(e) => handleRetorno(e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={styles.colAnexo}>
                  <input
                    type="date"
                    value={form.dataRetorno}
                    onChange={(e) => atualizar("dataRetorno", e.target.value)}
                    disabled={retornoDesabilitado}
                    required={!retornoDesabilitado}
                  />
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Descrição</label>
              <textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => atualizar("descricao", e.target.value)}
                placeholder="Descreva o procedimento..."
              />
            </div>

            {/* Medicamento receitado */}
            <div className={`${styles.field} ${styles.colFull}`}>
              <label>Medicamento receitado</label>
              <textarea
                rows={3}
                value={form.medicacaoPrescrita}
                onChange={(e) => atualizar("medicacaoPrescrita", e.target.value)}
                placeholder="Informe os medicamentos receitados (se houver)"
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={editando && onSalvo ? onSalvo : limpar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
