"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroLeishmaniose from "./CadastroLeishmaniose";
import ConsultarLeishmaniose from "./ConsultarLeishmaniose";

// CCZ > Zoonoses > Leishmaniose
// Duas abas internas no mesmo padrão das telas de consulta existentes:
// 1. Novo Registro (padrão) / 2. Consultar Registros.
export default function LeishmanioseTab({
  retornoInicial = null,
  onRetornoConcluido,
}) {
  const [aba, setAba] = useState("NOVO");
  const [chaveNova, setChaveNova] = useState(0);

  const aposSalvar = () => {
    // Volta para Novo Registro limpo, pronto para a próxima fiscalização.
    setChaveNova((k) => k + 1);
    setAba("NOVO");
    onRetornoConcluido?.();
  };

  return (
    <div className="leishWrapper">
      <div className="paginaAbas">
        <button
          type="button"
          className={`paginaAba ${aba === "NOVO" ? "paginaAbaAtiva" : ""}`}
          onClick={() => setAba("NOVO")}
        >
          <ClipboardPlus
            size={16}
            style={{ marginRight: "0.5rem" }}
            aria-hidden="true"
          />
          Novo Registro
        </button>
        <button
          type="button"
          className={`paginaAba ${aba === "CONSULTAR" ? "paginaAbaAtiva" : ""}`}
          onClick={() => setAba("CONSULTAR")}
        >
          <Search
            size={16}
            style={{ marginRight: "0.5rem" }}
            aria-hidden="true"
          />
          Consultar Registros
        </button>
      </div>

      {aba === "NOVO" ? (
        // Retorno aberto pela Agenda: mesmo formulário, com o animal e a data
        // da fiscalização pré-selecionados (nenhuma resposta clínica copiada).
        <CadastroLeishmaniose
          key={chaveNova}
          registroInicial={
            retornoInicial
              ? {
                  ...retornoInicial.registroInicial,
                  dataFiscalizacao: retornoInicial.dataAgendada,
                }
              : null
          }
          onSalvo={aposSalvar}
        />
      ) : (
        <ConsultarLeishmaniose />
      )}
    </div>
  );
}
