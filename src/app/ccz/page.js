"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import DashboardCCZ from "./DashboardCCZ";
import CadastroTutor from "./CadastroTutor";
import CadastroAnimal from "./CadastroAnimal";
import CadastroProcedimento from "./CadastroProcedimento";
import CadastroEsporotricose from "./CadastroEsporotricose";
import CadastroZoonoses from "./CadastroZoonoses";
import CadastroDenuncia from "./CadastroDenuncia";
import TutoresLista from "./TutoresLista";
import AnimaisLista from "./AnimaisLista";
import ProcedimentosLista from "./ProcedimentosLista";
import EsporotricoseLista from "./EsporotricoseLista";
import ZoonosesLista from "./ZoonosesLista";
import DenunciasLista from "./DenunciasLista";
import AgendaCCZ from "./AgendaCCZ";
import TermosEmBranco from "./TermosEmBranco";
import { obterAnimal, obterProcedimento, obterEsporotricose, obterZoonose } from "./actions";

import styles from "./CadastroTutor.module.css";

function CczPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = (searchParams.get("tab") || "DASHBOARD").toUpperCase();
  const rawSubTab = searchParams.get("subTab") || "";
  
  // Define LISTA como padrão para abas que têm Lista/Cadastrar
  const tabsComLista = ["PROCEDIMENTOS", "ESPOROTRICOSE", "ZOONOSES", "DENUNCIAS", "TUTORES", "ANIMAIS"];
  const activeSubTab = rawSubTab.toUpperCase() || (tabsComLista.includes(activeTab) ? "LISTA" : "");

  // Estado de edição vindo das listas.
  const [cpfTutorEdicao, setCpfTutorEdicao] = useState("");
  const [animalEdicao, setAnimalEdicao] = useState(null);
  const [carregandoAnimal, setCarregandoAnimal] = useState(false);
  const [procedimentoEdicao, setProcedimentoEdicao] = useState(null);
  const [carregandoProcedimento, setCarregandoProcedimento] = useState(false);
  const [esporoEdicao, setEsporoEdicao] = useState(null);
  const [carregandoEsporo, setCarregandoEsporo] = useState(false);
  const [zoonoseEdicao, setZoonoseEdicao] = useState(null);
  const [carregandoZoonose, setCarregandoZoonose] = useState(false);

  // Navega para uma aba/sub-aba preservando o módulo.
  const irPara = (tab, subTab) => {
    // Ao trocar para Lista, limpar os registros em edição
    if (subTab === "LISTA") {
      setCpfTutorEdicao("");
      setAnimalEdicao(null);
      setProcedimentoEdicao(null);
      setEsporoEdicao(null);
      setZoonoseEdicao(null);
    }
    router.push(`/ccz?tab=${tab}&subTab=${subTab}`);
  };

  // Ao sair do modo cadastro (troca de aba), limpa os registros em edição.
  useEffect(() => {
    if (activeSubTab !== "CADASTRAR") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
      setCpfTutorEdicao("");
      setAnimalEdicao(null);
      setProcedimentoEdicao(null);
      setEsporoEdicao(null);
      setZoonoseEdicao(null);
    }
  }, [activeTab, activeSubTab]);

  // ── Editar tutor: vai para Tutor > Cadastrar com o CPF pré-carregado ──
  const editarTutor = (cpf) => {
    setCpfTutorEdicao(cpf);
    irPara("TUTORES", "CADASTRAR");
  };

  // ── Editar animal: carrega o registro e vai para Animais > Cadastrar ──
  const editarAnimal = async (id) => {
    setCarregandoAnimal(true);
    const res = await obterAnimal(id);
    setCarregandoAnimal(false);
    if (res.success) {
      setAnimalEdicao(res.data);
      irPara("ANIMAIS", "CADASTRAR");
    }
  };

  // ── Editar procedimento: carrega o registro e vai para Procedimentos > Cadastrar ──
  const editarProcedimento = async (id) => {
    setCarregandoProcedimento(true);
    const res = await obterProcedimento(id);
    setCarregandoProcedimento(false);
    if (res.success) {
      setProcedimentoEdicao(res.data);
      irPara("PROCEDIMENTOS", "CADASTRAR");
    }
  };

  // ── Editar esporotricose: carrega o registro e vai para Esporotricose > Cadastrar ──
  const editarEsporo = async (id) => {
    setCarregandoEsporo(true);
    const res = await obterEsporotricose(id);
    setCarregandoEsporo(false);
    if (res.success) {
      setEsporoEdicao(res.data);
      irPara("ESPOROTRICOSE", "CADASTRAR");
    }
  };

  // ── Editar zoonose: carrega o registro e vai para Zoonoses > Cadastrar ──
  const editarZoonose = async (id) => {
    setCarregandoZoonose(true);
    const res = await obterZoonose(id);
    setCarregandoZoonose(false);
    if (res.success) {
      setZoonoseEdicao(res.data);
      irPara("ZOONOSES", "CADASTRAR");
    }
  };

  // Volta para a lista correspondente após salvar/cancelar edição.
  const voltarListaTutores = () => {
    setCpfTutorEdicao("");
    irPara("TUTORES", "LISTA");
  };
  const voltarListaAnimais = () => {
    setAnimalEdicao(null);
    irPara("ANIMAIS", "LISTA");
  };
  const voltarListaProcedimentos = () => {
    setProcedimentoEdicao(null);
    irPara("PROCEDIMENTOS", "LISTA");
  };
  const voltarListaEsporo = () => {
    setEsporoEdicao(null);
    irPara("ESPOROTRICOSE", "LISTA");
  };
  const voltarListaZoonose = () => {
    setZoonoseEdicao(null);
    irPara("ZOONOSES", "LISTA");
  };

  let conteudo;
  if (activeTab === "DASHBOARD") {
    conteudo = <DashboardCCZ />;
  } else if (activeTab === "AGENDA") {
    conteudo = <AgendaCCZ onAbrirProcedimento={editarProcedimento} />;
  } else if (activeTab === "TERMOS") {
    conteudo = <TermosEmBranco />;
  } else if (activeTab === "DENUNCIAS") {
    if (activeSubTab === "LISTA") {
      conteudo = <DenunciasLista />;
    } else {
      conteudo = <CadastroDenuncia />;
    }
  } else if (activeTab === "ZOONOSES") {
    if (activeSubTab === "LISTA") {
      conteudo = <ZoonosesLista onEditar={editarZoonose} />;
    } else if (carregandoZoonose) {
      conteudo = <p className={styles.subtitle}>Carregando zoonose...</p>;
    } else {
      conteudo = (
        <CadastroZoonoses
          key={zoonoseEdicao?.id || "novo"}
          registroInicial={zoonoseEdicao}
          onSalvo={voltarListaZoonose}
        />
      );
    }
  } else if (activeTab === "PROCEDIMENTOS") {
    if (activeSubTab === "LISTA") {
      conteudo = <ProcedimentosLista onEditar={editarProcedimento} />;
    } else if (carregandoProcedimento) {
      conteudo = <p className={styles.subtitle}>Carregando procedimento...</p>;
    } else {
      conteudo = (
        <CadastroProcedimento
          key={procedimentoEdicao?.id || "novo"}
          registroInicial={procedimentoEdicao}
          onSalvo={voltarListaProcedimentos}
        />
      );
    }
  } else if (activeTab === "ESPOROTRICOSE") {
    if (activeSubTab === "LISTA") {
      conteudo = <EsporotricoseLista onEditar={editarEsporo} />;
    } else if (carregandoEsporo) {
      conteudo = <p className={styles.subtitle}>Carregando esporotricose...</p>;
    } else {
      conteudo = (
        <CadastroEsporotricose
          key={esporoEdicao?.id || "novo"}
          registroInicial={esporoEdicao}
          onSalvo={voltarListaEsporo}
        />
      );
    }
  } else if (activeTab === "ANIMAIS") {
    if (activeSubTab === "LISTA") {
      conteudo = <AnimaisLista onEditar={editarAnimal} />;
    } else if (carregandoAnimal) {
      conteudo = <p className={styles.subtitle}>Carregando animal...</p>;
    } else {
      conteudo = (
        <CadastroAnimal
          key={animalEdicao?.id || "novo"}
          animalInicial={animalEdicao}
          onSalvo={voltarListaAnimais}
        />
      );
    }
  } else {
    // TUTORES (padrão)
    if (activeSubTab === "LISTA") {
      conteudo = <TutoresLista onEditar={editarTutor} />;
    } else {
      conteudo = (
        <CadastroTutor
          key={cpfTutorEdicao || "novo"}
          cpfInicial={cpfTutorEdicao}
          onVoltarLista={voltarListaTutores}
        />
      );
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>CCZ — Centro de Controle de Zoonoses</h1>
          <p className={styles.subtitle}>
            Cadastro de tutores e animais do Centro de Controle de Zoonoses.
          </p>
        </div>
      </header>

      {/* Abas de navegação (Lista / Cadastrar) - exceto para Dashboard, Agenda e Termos */}
      {activeTab !== "DASHBOARD" && activeTab !== "AGENDA" && activeTab !== "TERMOS" && (
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabButton} ${activeSubTab === "LISTA" ? styles.tabActive : ""}`}
            onClick={() => irPara(activeTab, "LISTA")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "0.5rem" }}
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lista
          </button>
          <button
            className={`${styles.tabButton} ${activeSubTab === "CADASTRAR" ? styles.tabActive : ""}`}
            onClick={() => irPara(activeTab, "CADASTRAR")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "0.5rem" }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo
          </button>
        </div>
      )}

      {conteudo}
    </div>
  );
}

export default function CczPage() {
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
      <CczPageContent />
    </Suspense>
  );
}
