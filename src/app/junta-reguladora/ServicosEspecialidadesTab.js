"use client";

import { useState, useEffect, useCallback } from "react";
import { getServicosData } from "./servicosActions";
import CadastroServicos from "./CadastroServicos";
import "@/components/cadastros/padraoCadastro.css";

// `podeInativar` vem do servidor (layout da rota, via podeExecutar). A tela
// nunca decide sozinha: só mostra o botão; o backend valida de novo.
export default function ServicosEspecialidadesTab({ podeInativar = false }) {
  const [data, setData] = useState({ servicos: [], linhas: [] });

  // Mantido com useCallback para ser passado ao componente filho sem re-renders desnecessários
  const reloadData = useCallback(async () => {
    const res = await getServicosData();
    setData(res || { servicos: [], linhas: [] });
  }, []);

  // Busca inicial auto-contida para evitar acoplamento de efeito com useCallback
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      const res = await getServicosData();
      if (isMounted) {
        setData(res || { servicos: [], linhas: [] });
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="cadCadastro">

      <CadastroServicos
        data={data}
        reloadData={reloadData}
        podeInativar={podeInativar}
      />
    </div>
  );
}
