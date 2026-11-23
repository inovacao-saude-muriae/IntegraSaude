"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroLeishmaniose from "./CadastroLeishmaniose";
import ConsultarLeishmaniose from "./ConsultarLeishmaniose";

// CCZ > Zoonoses > Leishmaniose
// Duas abas internas no mesmo padrão das telas de consulta existentes:
// 1. Novo Registro (padrão) / 2. Consultar Registros.
export default function LeishmanioseTab() {
  const [aba, setAba] = useState("NOVO");
  const [chaveNova, setChaveNova] = useState(0);

  const aposSalvar = () => {
    // Volta para Novo Registro limpo, pronto para a próxima fiscalização.
    setChaveNova((k) => k + 1);
    setAba("NOVO");
  };

  return (
    <div className="leishWrapper">
      <div className="paginaAbas">
        <button
          type="button"
          className={`paginaAba ${aba === "NOVO" ? "paginaAbaAtiva" : ""}`}
          onClick={() => setAba("NOVO")}
        >
          <ClipboardPlus size={16} style={{ marginRight: "0.5rem" }} aria-hidden="true" />
          Novo Registro
        </button>
        <button
          type="button"
          className={`paginaAba ${aba === "CONSULTAR" ? "paginaAbaAtiva" : ""}`}
          onClick={() => setAba("CONSULTAR")}
        >
          <Search size={16} style={{ marginRight: "0.5rem" }} aria-hidden="true" />
          Consultar Registros
        </button>
      </div>

      {aba === "NOVO" ? (
        <CadastroLeishmaniose key={chaveNova} onSalvo={aposSalvar} />
      ) : (
        <ConsultarLeishmaniose />
      )}
    </div>
  );
}
