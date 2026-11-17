"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuxiliaryData } from "@/app/regulacao/actions";
import CadastroUbs from "./CadastroUbs";
import styles from "../GerenciamentoCadastro.module.css";

const FORM_UBS = { nome: "", cnes: "" };

export default function UbsPage() {
  const [auxData, setAuxData] = useState({
    tiposExame: [],
    procedimentos: [],
    medicos: [],
    ubsList: [],
    pessoas: [],
  });
  const [formUbs, setFormUbs] = useState(FORM_UBS);

  // Mantido para o componente filho invocar após criar/editar registros
  const reloadData = useCallback(async () => {
    const aux = await getAuxiliaryData();
    setAuxData(
      aux || { tiposExame: [], procedimentos: [], medicos: [], ubsList: [], pessoas: [] }
    );
  }, []);

  // Busca inicial isolada no efeito
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      const aux = await getAuxiliaryData();
      if (isMounted) {
        setAuxData(
          aux || { tiposExame: [], procedimentos: [], medicos: [], ubsList: [], pessoas: [] }
        );
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={styles.container}>
      <CadastroUbs
        formUbs={formUbs}
        setFormUbs={setFormUbs}
        auxData={auxData}
        reloadData={reloadData}
      />
    </div>
  );
}