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

      <CadastroProcedimentos
        data={data}
        reloadData={reloadData}
        podeInativar={podeInativar}
      />
    </div>
  );
}
