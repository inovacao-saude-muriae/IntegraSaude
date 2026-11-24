"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroAnimal from "./CadastroAnimal";
import ConsultarAnimais from "./ConsultarAnimais";

// CCZ > Zoonoses > Animais
// Mesmo padrão da Leishmaniose/Esporotricose: duas abas internas no container
// do módulo. 1. Novo Registro (padrão) / 2. Consultar Registros.
export default function AnimaisTab({ podeCriar = true }) {
  const [aba, setAba] = useState("NOVO");
  const [chaveNova, setChaveNova] = useState(0);

  const aposSalvar = () => {
    setChaveNova((k) => k + 1);
    setAba("NOVO");
  };

  return (
    <div className="leishWrapper">
      <div className="paginaAbas">
        {podeCriar && (
          <button
            type="button"
            className={`paginaAba ${aba === "NOVO" ? "paginaAbaAtiva" : ""}`}
            onClick={() => setAba("NOVO")}
          >
            <ClipboardPlus size={16} style={{ marginRight: "0.5rem" }} aria-hidden="true" />
            Novo Registro
          </button>
        )}
        <button
          type="button"
          className={`paginaAba ${aba === "CONSULTAR" ? "paginaAbaAtiva" : ""}`}
          onClick={() => setAba("CONSULTAR")}
        >
          <Search size={16} style={{ marginRight: "0.5rem" }} aria-hidden="true" />
          Consultar Registros
        </button>
      </div>

      {aba === "NOVO" && podeCriar ? (
        <CadastroAnimal key={chaveNova} onSalvo={aposSalvar} onCancelar={() => setAba("CONSULTAR")} />
      ) : (
        <ConsultarAnimais />
      )}
    </div>
  );
}
