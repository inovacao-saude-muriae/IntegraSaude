"use client";

import { useState, useEffect, useCallback } from "react";
import { getServicosData } from "./servicosActions";
import CadastroServicos from "./CadastroServicos";
import styles from "@/app/gerenciamento/GerenciamentoCadastro.module.css";

export default function ServicosEspecialidadesTab() {
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
    <div className={styles.container}>
      <h2 className={styles.cardTitle}>Serviços e Especialidades</h2>

      <CadastroServicos data={data} reloadData={reloadData} />
    </div>
  );
}
