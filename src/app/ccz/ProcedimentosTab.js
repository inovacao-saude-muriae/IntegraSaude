"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroProcedimento from "./CadastroProcedimento";
import ConsultarProcedimentos from "./ConsultarProcedimentos";

// CCZ > Procedimentos
// Mesmo padrão de Leishmaniose e Esporotricose: duas abas internas no
// container do módulo. 1. Novo Registro (padrão) / 2. Consultar Registros.
// O formulário de cadastro de procedimentos é preservado integralmente.
export default function ProcedimentosTab({ registroInicial = null, onSalvo }) {
  const [aba, setAba] = useState("NOVO");
  const [chaveNova, setChaveNova] = useState(0);

  const aposSalvar = () => {
    setChaveNova((k) => k + 1);
    setAba("NOVO");
    if (onSalvo) onSalvo();
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
        <CadastroProcedimento
          key={chaveNova}
          registroInicial={registroInicial}
          onSalvo={aposSalvar}
        />
      ) : (
        <ConsultarProcedimentos />
      )}
    </div>
  );
}
