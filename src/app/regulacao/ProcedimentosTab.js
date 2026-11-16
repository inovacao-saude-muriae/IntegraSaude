"use client";

import { useState, useEffect, useCallback } from "react";
import { getProcedimentosData } from "./procedimentosActions";
import CadastroProcedimentos from "./CadastroProcedimentos";
import "@/components/cadastros/padraoCadastro.css";

export default function ProcedimentosTab({ podeInativar = false }) {
  const [data, setData] = useState({ tiposExame: [], linhas: [] });

  // Mantido para o componente filho invocar após criar/editar registros
  const reloadData = useCallback(async () => {
    const res = await getProcedimentosData();
    setData(res || { tiposExame: [], linhas: [] });
  }, []);

  // Busca inicial isolada no efeito
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      const res = await getProcedimentosData();
      if (isMounted) {
        setData(res || { tiposExame: [], linhas: [] });
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="cadCadastro">
      {/* Cabeçalho no mesmo padrão de "Serviços e Especialidades" e
          "Especialidades e Procedimentos" (padraoCadastro.css). */}
      <div className="cadPaginaCabecalho">
        <div>
          <h1 className="cadPaginaTitulo">Exames e Procedimentos</h1>
          <p className="cadPaginaSubtitulo">
            Cadastro dos tipos de exame (ex.: Imagem) e seus procedimentos
            (ex.: Ultrassonografia).
          </p>
        </div>
      </div>

      <CadastroProcedimentos
        data={data}
        reloadData={reloadData}
        podeInativar={podeInativar}
      />
    </div>
  );
}
