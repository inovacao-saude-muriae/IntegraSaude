"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import {
  cadastrarPacienteJunta,
  getPacientesPorServico,
  registrarAtendimentoServico,
  getProntuarioUnificado,
} from "./actions";

import CadastroPacienteJunta from "./CadastroPacienteJunta";
import AtendimentoServico from "./AtendimentoServico";
import AgendaServico from "./AgendaServico";
import ProntuarioRelatorio from "./ProntuarioRelatorio";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import ServicosEspecialidadesTab from "./ServicosEspecialidadesTab";
import PacientesTab from "./PacientesTab";
import Dashboard from "./Dashboard";
import { usePermissoesJunta } from "./PermissoesJuntaContext";
import { useNotify } from "@/components/ConfirmDialog";

import styles from "./page.module.css";

// Mapeia os códigos de subTab da URL para os nomes exatos gravados no banco
const MAPA_SERVICOS = {
  CAEE: "CAEE",
  APAE: "APAE",
  AMBULATORIO: "Ambulatório",
  ESPECIALIDADES: "Centro de Especialidades",
};

function JuntaReguladoraPageContent() {
  const searchParams = useSearchParams();
  const notify = useNotify();

  const { subServicosPermitidos, ehAdminJunta } = usePermissoesJunta();

  const activeTab = searchParams.get("tab") || "CADASTRO";
  const activeSubTab = searchParams.get("subTab") || "CAEE";

  // Nome formatado do serviço atual (Ex: "AMBULATORIO" -> "Ambulatório")
  const servicoNomeFormatado =
    MAPA_SERVICOS[activeSubTab.toUpperCase()] || activeSubTab;

  const subTabAtivo = activeSubTab.toUpperCase();
  const servicoLiberado =
    ehAdminJunta || subServicosPermitidos.includes(subTabAtivo);

  const [pacientesServico, setPacientesServico] = useState([]);
  const [prontuarioData, setProntuarioData] = useState(null);
  const [loadingServico, setLoadingServico] = useState(false);
  const [abaServico, setAbaServico] = useState("ATENDIMENTO");

  // Reset direto de estado derivado do serviço/aba sem precisar de useEffect
  const [prevServico, setPrevServico] = useState(servicoNomeFormatado);
  const [prevTab, setPrevTab] = useState(activeTab);

  if (prevServico !== servicoNomeFormatado || prevTab !== activeTab) {
    setPrevServico(servicoNomeFormatado);
    setPrevTab(activeTab);
    setAbaServico("ATENDIMENTO");
  }

  // Busca de pacientes no banco ao selecionar/mudar de serviço
  useEffect(() => {
    let isMounted = true;

    if (activeTab === "SERVICOS" && servicoLiberado) {
      async function loadPacientes() {
        setLoadingServico(true);
        try {
          const res = await getPacientesPorServico(servicoNomeFormatado);
          if (isMounted) {
            if (res && res.success && Array.isArray(res.data)) {
              setPacientesServico(res.data);
            } else {
              setPacientesServico([]);
            }
          }
        } catch (err) {
          console.error("Erro ao carregar pacientes:", err);
          if (isMounted) setPacientesServico([]);
        } finally {
          if (isMounted) setLoadingServico(false);
        }
      }

      loadPacientes();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, servicoNomeFormatado, servicoLiberado]);

  // Função para recarregar lista após um cadastro ou atendimento
  const recarregarPacientes = async () => {
    if (activeTab === "SERVICOS" && servicoLiberado) {
      setLoadingServico(true);
      try {
        const res = await getPacientesPorServico(servicoNomeFormatado);
        if (res && res.success && Array.isArray(res.data)) {
          setPacientesServico(res.data);
        } else {
          setPacientesServico([]);
        }
      } catch (err) {
        console.error("Erro ao recarregar pacientes:", err);
        setPacientesServico([]);
      } finally {
        setLoadingServico(false);
      }
    }
  };

  const handleCadastrarPaciente = async (formData) => {
    const res = await cadastrarPacienteJunta(formData);
    if (res.success) {
      await notify({ tipo: "sucesso", title: "Pronto", message: "Dados da Junta salvos com sucesso!" });
      recarregarPacientes();
    } else {
      await notify({ tipo: "erro", title: "Erro", message: "Erro ao salvar paciente: " + (res.error || "Erro desconhecido") });
    }
    return res;
  };

  const handleRegistrarAtendimento = async (atendimentoData) => {
    const res = await registrarAtendimentoServico(atendimentoData);
    if (res.success) {
      await notify({ tipo: "sucesso", title: "Pronto", message: "Registro gravado com sucesso!" });
    } else {
      await notify({ tipo: "erro", title: "Erro", message: "Erro ao registrar atendimento: " + (res.error || "Erro desconhecido") });
    }
    return res;
  };

  const handleBuscarProntuario = async (termo) => {
    const res = await getProntuarioUnificado(termo);
    if (res && res.success) {
      if (!res.data) {
        await notify({ tipo: "info", message: "Nenhum paciente encontrado com este Nome ou CPF." });
      }
      setProntuarioData(res.data);
    } else {
      await notify({ tipo: "erro", title: "Erro", message: "Erro na busca do prontuário: " + (res.error || "Erro no banco") });
      setProntuarioData(null);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Junta Reguladora</h1>
          <p>
            Gestão Multidisciplinar, Recepção de Serviços e Prontuário Unificado
          </p>
        </div>
      </header>

      {activeTab === "DASHBOARD" && <Dashboard />}

      {/* Aba "Pacientes": tela GERAL de pessoas (model Pessoa), reaproveitada do
          Gerenciamento. subTab "PESSOAS" é distinto de "CADASTRO" (paciente da
          Junta / PacienteJunta) para não colidir com as abas existentes. */}
      {activeTab === "PESSOAS" && <PacientesTab />}

      {activeTab === "CADASTRO" && (
        <CadastroPacienteJunta onCadastrar={handleCadastrarPaciente} />
      )}

      {activeTab === "SERVICOS" && !servicoLiberado && (
        <AcessoNegadoModulo
          modulo={servicoNomeFormatado}
          mensagem="Você não tem acesso a este serviço da Junta Reguladora."
        />
      )}

      {activeTab === "SERVICOS" && servicoLiberado && (
        <>
          {/* Alternância: Recepção/Atendimento ou Agenda */}
          <div className={styles.servicoTabs}>
            <button
              type="button"
              className={`${styles.servicoTab} ${abaServico === "ATENDIMENTO" ? styles.servicoTabActive : ""}`}
              onClick={() => setAbaServico("ATENDIMENTO")}
            >
              Recepção / Atendimento
            </button>
            <button
              type="button"
              className={`${styles.servicoTab} ${abaServico === "AGENDA" ? styles.servicoTabActive : ""}`}
              onClick={() => setAbaServico("AGENDA")}
            >
              Agenda
            </button>
          </div>

          {abaServico === "AGENDA" ? (
            <AgendaServico servicoNome={servicoNomeFormatado} />
          ) : (
            <AtendimentoServico
              servicoNome={servicoNomeFormatado}
              onRegistrar={handleRegistrarAtendimento}
            />
          )}
        </>
      )}

      {activeTab === "SERVICOS_ESPECIALIDADES" && <ServicosEspecialidadesTab />}

      {activeTab === "RELATORIO" && (
        <ProntuarioRelatorio
          prontuarioData={prontuarioData}
          onBuscar={handleBuscarProntuario}
        />
      )}
    </div>
  );
}

export default function JuntaReguladoraPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "#64748b",
            fontWeight: 500,
          }}
        >
          Carregando página...
        </div>
      }
    >
      <JuntaReguladoraPageContent />
    </Suspense>
  );
}