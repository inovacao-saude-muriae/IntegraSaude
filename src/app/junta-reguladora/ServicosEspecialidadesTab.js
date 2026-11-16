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
      {/* Cabeçalho no mesmo padrão de "Exames e Procedimentos" e
          "Especialidades e Procedimentos" (padraoCadastro.css). */}
      <div className="cadPaginaCabecalho">
        <div>
          <h1 className="cadPaginaTitulo">Serviços e Especialidades</h1>
          <p className="cadPaginaSubtitulo">
            Serviços da Junta Reguladora e as especialidades de cada um. Os
            serviços cadastrados aqui são a fonte oficial das opções de escopo
            de acesso dos usuários.
          </p>
        </div>
      </div>

      <CadastroServicos
        data={data}
        reloadData={reloadData}
        podeInativar={podeInativar}
      />
    </div>
  );
}
