"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroEsporotricose from "./CadastroEsporotricose";
import ConsultarEsporotricose from "./ConsultarEsporotricose";

// CCZ > Zoonoses > Esporotricose
// Mesmo padrão da Leishmaniose: duas abas internas no container do módulo.
// 1. Novo Registro (padrão) / 2. Consultar Registros.
// O formulário de cadastro (4 etapas) é preservado integralmente.
export default function EsporotricoseTab() {
  const [aba, setAba] = useState("NOVO");
  const [chaveNova, setChaveNova] = useState(0);

  const aposSalvar = () => {
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
        <CadastroEsporotricose key={chaveNova} onSalvo={aposSalvar} />
      ) : (
        <ConsultarEsporotricose />
      )}
    </div>
  );
}
