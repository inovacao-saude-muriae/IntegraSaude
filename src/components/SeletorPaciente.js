"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./SeletorPaciente.module.css";

const maskCpf = (v) =>
  (v || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function SeletorPaciente({ 
  onSelect, 
  label = "Paciente",
  placeholder = "Digite nome ou CPF para buscar...",
  required = false,
  value = null, // Paciente já selecionado
  disabled = false
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);

  // Atualiza o termo quando o value muda
  useEffect(() => {
    if (value?.nomeCompleto) {
      setTermo(value.nomeCompleto);
    } else {
      setTermo("");
    }
  }, [value]);

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

  // Busca pacientes ao digitar
  useEffect(() => {
    if (!termo.trim() || termo === value?.nomeCompleto) {
      setResultados([]);
      setDropAberto(false);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/pessoas/buscar?termo=${encodeURIComponent(termo)}`);
        if (res.ok) {
          const data = await res.json();
          setResultados(data);
          setDropAberto(true);
        }
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setBuscando(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [termo, value]);

  const handleSelect = (paciente) => {
    onSelect(paciente);
    setTermo(paciente.nomeCompleto);
    setDropAberto(false);
  };

  const handleChange = (e) => {
    const novoTermo = e.target.value;
    setTermo(novoTermo);
    // Se o usuário apagar ou mudar o texto, limpa a seleção
    if (value && novoTermo !== value.nomeCompleto) {
      onSelect(null);
    }
  };

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
            onFocus={() => termo && setDropAberto(true)}
            disabled={disabled}
            required={required}
            autoComplete="off"
          />
          {buscando && (
            <div className={styles.spinner}></div>
          )}
          <span className={styles.arrowIcon} onClick={() => !disabled && setDropAberto(!dropAberto)}>
            ▼
          </span>
        </div>

        {/* Dropdown de resultados */}
        {dropAberto && resultados.length > 0 && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              {resultados.length} paciente(s) encontrado(s)
            </div>
            <div className={styles.dropdownList}>
              {resultados.map((paciente) => (
                <button
                  key={paciente.cpf}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleSelect(paciente)}
                >
                  <div className={styles.itemNome}>{paciente.nomeCompleto}</div>
                  <div className={styles.itemDetalhes}>
                    <span>CPF: {maskCpf(paciente.cpf)}</span>
                    {paciente.dataNascimento && (
                      <span>• {new Date(paciente.dataNascimento).toLocaleDateString()}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem quando não encontra */}
        {dropAberto && termo && !buscando && resultados.length === 0 && (
          <div className={styles.dropdown}>
            <div className={styles.nenhumResultado}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <p>Nenhum paciente encontrado</p>
              <p className={styles.helperText}>
                Cadastre o paciente em <strong>menu lateral → Usuários</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
