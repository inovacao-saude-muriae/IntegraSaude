"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroDenuncia from "./CadastroDenuncia";
import ConsultarDenuncias from "./ConsultarDenuncias";

// CCZ > Denúncias (animais agressivos / doentes)
// Mesmo padrão de Leishmaniose, Esporotricose, Procedimentos e Animais: duas
// abas internas no container do módulo.
// 1. Novo Registro (padrão) / 2. Consultar Registros.
// O formulário de cadastro da denúncia é preservado integralmente.
export default function DenunciasTab({ tipo = "AGRESSIVO" }) {
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
        <CadastroDenuncia key={`${tipo}-${chaveNova}`} tipo={tipo} onSalvo={aposSalvar} />
      ) : (
        <ConsultarDenuncias tipoDenuncia={tipo} />
      )}
    </div>
  );
}
