"use client";

// Busca de processo da Farmácia Judicial no MESMO modelo do SeletorPaciente do
// container de Identificação do Paciente: input único + tabela suspensa.
// Diferente do SeletorPaciente apenas na fonte (processos, não pessoas) e nas
// colunas da tabela. A busca é feita no backend a cada digitação (debounce).
import { useState, useEffect, useRef, useId } from "react";
import styles from "./SeletorPaciente.module.css";

/**
 * @param {object}   props
 * @param {object}   props.selecionado  processo selecionado ({numeroPasta,...}) ou null
 * @param {function} props.onSelect     recebe o processo escolhido
 * @param {function} props.buscar       async (termo) => array de processos
 * @param {function} props.onTextoChange (opcional) avisa quando o texto muda
 */
export default function SeletorProcesso({
  label = "Buscar Registro",
  placeholder = "Digite o nome, número do processo ou pasta...",
  selecionado = null,
  onSelect = () => {},
  buscar,
  onTextoChange,
  minCaracteres = 1,
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);
  const timerRef = useRef(null);
  const reqRef = useRef(0);
  const listaId = useId();

  // Fecha a tabela suspensa ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Limpa o texto quando a seleção é removida por fora (ex.: Limpar filtros).
  useEffect(() => {
    if (selecionado) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com a seleção externa (Limpar filtros)
    setTermo("");
    setResultados([]);
  }, [selecionado]);

  const agendarBusca = (novoTermo) => {
    clearTimeout(timerRef.current);
    const consulta = novoTermo.trim();
    const req = ++reqRef.current;
    // Campo vazio: abre a tabela sem registros (nada é carregado).
    if (consulta.length < minCaracteres) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const lista = await buscar(consulta);
        if (req === reqRef.current) setResultados(Array.isArray(lista) ? lista : []);
      } catch (error) {
        console.error("Erro ao buscar processos:", error);
        if (req === reqRef.current) setResultados([]);
      } finally {
        if (req === reqRef.current) setBuscando(false);
      }
    }, 300);
  };

  const selecionar = (processo) => {
    clearTimeout(timerRef.current);
    reqRef.current++;
    setBuscando(false);
    setTermo(processo.patientName || processo.numeroPasta || "");
    setDropAberto(false);
    onSelect(processo);
  };

  const alterar = (e) => {
    const valor = e.target.value;
    setTermo(valor);
    onTextoChange?.(valor);
    setDropAberto(true);
    if (selecionado) onSelect(null); // digitou de novo: descarta a seleção
    agendarBusca(valor);
  };

  const limpar = () => {
    clearTimeout(timerRef.current);
    reqRef.current++;
    setTermo("");
    setResultados([]);
    setBuscando(false);
    setDropAberto(false);
    onTextoChange?.("");
    onSelect(null);
  };

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>

      <div className={styles.inputWrapper} ref={dropdownRef}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={termo}
            onChange={alterar}
            onFocus={() => setDropAberto(true)}
            onKeyDown={(e) => e.key === "Escape" && setDropAberto(false)}
            autoComplete="off"
            role="combobox"
            aria-expanded={dropAberto}
            aria-controls={listaId}
            aria-autocomplete="list"
          />
          {buscando && <div className={styles.spinner}></div>}
          <span
            className={styles.arrowIcon}
            aria-hidden="true"
            onClick={() => (selecionado ? limpar() : setDropAberto(!dropAberto))}
            title={selecionado ? "Limpar seleção" : undefined}
          >
            {selecionado ? "×" : dropAberto ? "▲" : "▼"}
          </span>
        </div>

        {dropAberto && (
          <div className={styles.dropdown} id={listaId}>
            <div className={styles.dropdownList}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th scope="col">Nome do Paciente</th>
                    <th scope="col">Número da Pasta</th>
                    <th scope="col">Número do Processo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.length > 0 ? (
                    resultados.map((p) => (
                      <tr
                        key={p.numeroPasta}
                        className={`${styles.linha} ${
                          selecionado?.numeroPasta === p.numeroPasta
                            ? styles.linhaSelecionada
                            : ""
                        }`}
                        tabIndex={0}
                        onClick={() => selecionar(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selecionar(p);
                          }
                        }}
                      >
                        <td className={styles.nomeUsuario}>{p.patientName || "—"}</td>
                        <td>{p.numeroPasta || "—"}</td>
                        <td>{p.numeroProcesso || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.semDados}>
                        {buscando
                          ? "Buscando processos..."
                          : termo.trim().length < minCaracteres
                            ? "Digite para buscar um processo."
                            : "Nenhum processo encontrado."}
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
  );
}
