"use client";

import { useState, useEffect, useRef, useId } from "react";
import { documentoPaciente } from "@/app/regulacao/constants";
import styles from "./SeletorPaciente.module.css";

// Converte ISO (yyyy-mm-dd...) em dd/mm/aaaa sem passar por Date (evita bug de fuso).
// Aceita também valores já em dd/mm/aaaa (fontes que formatam no servidor).
const formatarData = (v) => {
  const s = String(v || "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return s;
  return "—";
};

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

// Busca padrão: API de pessoas. A API devolve { success, results }; aceita também { data } e array puro.
async function buscarPadrao(termo) {
  const res = await fetch(`/api/pessoas/buscar?termo=${encodeURIComponent(termo)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const lista = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
  return Array.isArray(lista) ? lista : [];
}

/**
 * Campo de busca de pessoa com dropdown em tabela.
 *
 * Modo padrão (Junta etc.): `value` = pessoa selecionada, `onSelect(pessoa|null)`.
 * Modo controlado (CCZ Tutor): `texto` + `onTextoChange(texto)` controlam o texto do campo,
 * `buscar(termo)` troca a fonte de dados e `buscaAtiva={false}` deixa o campo como input simples.
 */
export default function SeletorPaciente({
  onSelect,
  label = "Paciente",
  placeholder = "Digite nome ou CPF para buscar...",
  required = false,
  value = null, // Paciente já selecionado
  disabled = false,
  texto, // texto controlado (opcional)
  onTextoChange,
  buscar = buscarPadrao, // async (termo) => array de pessoas
  buscaAtiva = true, // false: input simples, sem dropdown
  cpfSelecionado = "", // destaca a linha da pessoa já selecionada
  minCaracteres = 2,
}) {
  const controlado = texto !== undefined;
  const [termoInterno, setTermoInterno] = useState("");
  const termo = controlado ? texto : termoInterno;
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);
  const timerRef = useRef(null);
  const reqRef = useRef(0);
  const digitandoRef = useRef(false);
  const listaId = useId();

  const atualizarTexto = (v) => {
    if (!controlado) setTermoInterno(v);
    onTextoChange?.(v);
  };

  // Sincroniza o texto com a pessoa selecionada (modo padrão).
  useEffect(() => {
    if (controlado) return;
    if (value?.nomeCompleto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com a seleção externa; comportamento intencional
      setTermoInterno(value.nomeCompleto);
    } else if (!digitandoRef.current) {
      setTermoInterno("");
    }
    digitandoRef.current = false;
  }, [value, controlado]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cancela debounce pendente ao desmontar
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Sem busca ativa, garante o dropdown fechado
  useEffect(() => {
    if (!buscaAtiva) {
      clearTimeout(timerRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dropdown quando a busca é desativada
      setDropAberto(false);
      setBuscando(false);
    }
  }, [buscaAtiva]);

  const agendarBusca = (novoTermo) => {
    clearTimeout(timerRef.current);
    const consulta = novoTermo.trim();
    const req = ++reqRef.current;
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
        console.error("Erro ao buscar pacientes:", error);
        if (req === reqRef.current) setResultados([]);
      } finally {
        if (req === reqRef.current) setBuscando(false);
      }
    }, 300);
  };

  const handleSelect = (paciente) => {
    clearTimeout(timerRef.current);
    reqRef.current++;
    setBuscando(false);
    onSelect?.(paciente);
    if (!controlado) setTermoInterno(paciente.nomeCompleto || "");
    setDropAberto(false);
  };

  const handleChange = (e) => {
    const novoTermo = e.target.value;
    atualizarTexto(novoTermo);
    if (!buscaAtiva) return;
    setDropAberto(true);
    // Se o usuário mudar o texto de uma pessoa selecionada, limpa a seleção (modo padrão)
    if (!controlado && value && novoTermo !== value.nomeCompleto) {
      digitandoRef.current = true;
      onSelect?.(null);
    }
    agendarBusca(novoTermo);
  };

  const mostrarDropdown = buscaAtiva && dropAberto && !disabled;
  const cpfAtual = soDigitos(cpfSelecionado || value?.cpf);

  return (
    <div className={styles.container}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>

      {/* Campo único para busca e exibição */}
      <div className={styles.inputWrapper} ref={dropdownRef}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={termo}
            onChange={handleChange}
            onFocus={() => buscaAtiva && !disabled && setDropAberto(true)}
            onKeyDown={(e) => e.key === "Escape" && setDropAberto(false)}
            disabled={disabled}
            required={required}
            autoComplete="off"
            role={buscaAtiva ? "combobox" : undefined}
            aria-expanded={buscaAtiva ? mostrarDropdown : undefined}
            aria-controls={buscaAtiva ? listaId : undefined}
            aria-autocomplete={buscaAtiva ? "list" : undefined}
          />
          {buscaAtiva && buscando && <div className={styles.spinner}></div>}
          {buscaAtiva && (
            <span
              className={styles.arrowIcon}
              aria-hidden="true"
              onClick={() => !disabled && setDropAberto(!dropAberto)}
            >
              {dropAberto ? "▲" : "▼"}
            </span>
          )}
        </div>

        {/* Dropdown em tabela (abre ao focar, mesmo sem digitar) */}
        {mostrarDropdown && (
          <div className={styles.dropdown} id={listaId}>
            <div className={styles.dropdownList}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th scope="col">CPF / CNS</th>
                    <th scope="col">Usuário/Nome</th>
                    <th scope="col">Nome da mãe</th>
                    <th scope="col">Data nasc.</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.length > 0 ? (
                    resultados.map((paciente, index) => (
                      <tr
                        key={paciente.cpf || paciente.cns || index}
                        className={`${styles.linha} ${
                          cpfAtual && soDigitos(paciente.cpf) === cpfAtual ? styles.linhaSelecionada : ""
                        }`}
                        tabIndex={0}
                        onClick={() => handleSelect(paciente)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(paciente);
                          }
                        }}
                      >
                        <td>{documentoPaciente(paciente)}</td>
                        <td className={styles.nomeUsuario}>{paciente.nomeCompleto || "—"}</td>
                        <td>{paciente.nomeMae || "—"}</td>
                        <td>{formatarData(paciente.dataNascimento)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.semDados}>
                        {buscando ? "Buscando pessoas..." : "Nenhuma pessoa encontrada."}
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
