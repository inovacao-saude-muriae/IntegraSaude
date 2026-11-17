"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuxiliaryData } from "@/app/regulacao/actions";
import CadastroMedicos from "./CadastroMedicos";
import styles from "../GerenciamentoCadastro.module.css";

const FORM_MEDICO = {
  nome: "",
  crm: "",
  ufCrm: "MG",
  especialidade: "",
  tipo: "Solicitante",
};

export default function MedicosPage() {
  const [auxData, setAuxData] = useState({
    tiposExame: [],
    procedimentos: [],
    medicos: [],
    ubsList: [],
    pessoas: [],
  });
  const [formMedico, setFormMedico] = useState(FORM_MEDICO);

  // Função para recarregar manualmente (passada para os filhos)
  const reloadData = useCallback(async () => {
    const aux = await getAuxiliaryData();
    setAuxData(
      aux || { tiposExame: [], procedimentos: [], medicos: [], ubsList: [], pessoas: [] }
    );
  }, []);

  // Carregamento inicial com sinalizador para evitar vazamento de memória e re-renders em cascata
  useEffect(() => {
    let active = true;

    async function loadData() {
      const aux = await getAuxiliaryData();
      if (active) {
        setAuxData(
          aux || { tiposExame: [], procedimentos: [], medicos: [], ubsList: [], pessoas: [] }
        );
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.container}>
      <CadastroMedicos
        formMedico={formMedico}
        setFormMedico={setFormMedico}
        auxData={auxData}
        reloadData={reloadData}
      />
    </div>
  );
}