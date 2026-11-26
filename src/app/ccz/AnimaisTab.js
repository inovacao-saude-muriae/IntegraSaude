"use client";

import { useState } from "react";
import { ClipboardPlus, Search } from "lucide-react";
import CadastroAnimal from "./CadastroAnimal";
import { obterAnimal } from "./actions";
import ConsultarAnimais from "./ConsultarAnimais";
import FichaAnimalCompleta from "./FichaAnimalCompleta";

// CCZ > Zoonoses > Animais
// Mesmo padrão da Leishmaniose/Esporotricose: duas abas internas no container
// do módulo. 1. Novo Registro (padrão) / 2. Consultar Registros.
export default function AnimaisTab({
  podeCriar = true,
  podeEditar = false,
  podeExcluir = false,
}) {
  const [aba, setAba] = useState("NOVO");
  // A ficha é renderizada aqui (fora da aba) para continuar montada enquanto o
  // formulário de edição abre — clicar em "Editar" não pode fechar a ficha
  // antes de o animal ser carregado.
  const [fichaId, setFichaId] = useState(null);
  // Id do animal em edição: a ficha carrega o registro e o formulário abre
  // dentro da aba, sem remontar a galeria.
  const [editando, setEditando] = useState(null);
  const [animalEdicao, setAnimalEdicao] = useState(null);
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
            <ClipboardPlus
              size={16}
              style={{ marginRight: "0.5rem" }}
              aria-hidden="true"
            />
            Novo Registro
          </button>
        )}
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

      {/* Edição pela ficha: o formulário substitui a galeria, mantendo as abas. */}
      {editando ? (
        <CadastroAnimal
          key={editando}
          animalInicial={animalEdicao}
          podeExcluir={podeExcluir}
          onSalvo={() => {
            setEditando(null);
            setAnimalEdicao(null);
            setChaveNova((k) => k + 1);
            setAba("CONSULTAR");
          }}
          // Sair da edição devolve a galeria (aba de consulta), nunca uma
          // tela intermediária de busca: o registro continua selecionável.
          onCancelar={() => {
            setEditando(null);
            setAnimalEdicao(null);
            setChaveNova((k) => k + 1);
            setAba("CONSULTAR");
          }}
        />
      ) : aba === "NOVO" && podeCriar ? (
        <CadastroAnimal
          key={chaveNova}
          podeExcluir={podeExcluir}
          onSalvo={aposSalvar}
          onCancelar={() => setAba("CONSULTAR")}
        />
      ) : (
        <ConsultarAnimais onAbrirFicha={setFichaId} />
      )}

      {fichaId && (
        <FichaAnimalCompleta
          animalId={fichaId}
          onFechar={() => setFichaId(null)}
          podeEditar={podeEditar}
          onEditar={async (id) => {
            setFichaId(null);
            const res = await obterAnimal(id);
            if (res?.success) {
              setAnimalEdicao(res.data);
              setEditando(id);
            }
          }}
        />
      )}
    </div>
  );
}
