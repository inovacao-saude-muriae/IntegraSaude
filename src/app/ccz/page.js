"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import DashboardCCZ from "./dashboard-gerencial/DashboardCcz";
import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import CadastroProcedimento from "./CadastroProcedimento";
import CadastroDenuncia from "./CadastroDenuncia";
import TutoresLista from "./TutoresLista";
import AnimaisTab from "./AnimaisTab";
import ProcedimentosLista from "./ProcedimentosLista";
import EsporotricoseTab from "./EsporotricoseTab";
import DenunciasLista from "./DenunciasLista";
import AgendaCCZ from "./AgendaCCZ";
import TermosEmBranco from "./TermosEmBranco";
import LeishmanioseTab from "./LeishmanioseTab";
import {
  obterProcedimento,
  salvarTutor,
} from "./actions";

import "@/components/cadastros/padraoCadastro.css";
import styles from "./CadastroTutor.module.css";

function CczPageContent() {
  const searchParams = useSearchParams();

  // Permissões efetivas de Animais (CCZ › Animais) vêm de /api/me, que decide
  // no servidor. A tela só mostra "Novo" e o botão Editar para quem pode; o
  // backend (salvarAnimal) revalida com requirePermissao.
  const [permAnimais, setPermAnimais] = useState({ criar: false, editar: false });
  // Situação cadastral da pessoa central: mesmas permissões da Gestão Geral,
  // calculadas no servidor (/api/me) — a tela só exibe; o backend revalida.
  const [permSituacao, setPermSituacao] = useState({
    inativar: false,
    reativar: false,
    editar: false,
  });
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        // Lista plana: ["animais:criar", "animais:editar", ...] do módulo CCZ.
        const lista = data?.user?.permissoes || [];
        const pode = (p) => lista.includes(`animais:${p}`);
        if (ativo) setPermAnimais({ criar: pode("criar"), editar: pode("editar") });
        const podePessoa = (p) => lista.includes(`pessoas:${p}`);
        if (ativo) {
          setPermSituacao({
            inativar: podePessoa("inativar"),
            reativar: podePessoa("reativar"),
            editar: podePessoa("editar"),
          });
        }
      } catch {
        // Sem contexto: a tela fica em modo consulta (fail-closed).
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const router = useRouter();

  const activeTab = (searchParams.get("tab") || "DASHBOARD").toUpperCase();
  const rawSubTab = searchParams.get("subTab") || "";
  
  // Define LISTA como padrão para abas que têm Lista/Cadastrar
  const tabsComLista = [
    "PROCEDIMENTOS",
    "ESPOROTRICOSE",
    "DENUNCIA_AGRESSIVO",
    "DENUNCIA_DOENTE",
    "TUTORES",
    "ANIMAIS",
  ];
  const activeSubTab = rawSubTab.toUpperCase() || (tabsComLista.includes(activeTab) ? "LISTA" : "");

  // Estado de edição vindo das listas.
  const [cpfTutorEdicao, setCpfTutorEdicao] = useState("");
  const [procedimentoEdicao, setProcedimentoEdicao] = useState(null);
  const [carregandoProcedimento, setCarregandoProcedimento] = useState(false);

  // Navega para uma aba/sub-aba preservando o módulo.
  const irPara = (tab, subTab) => {
    // Ao trocar para Lista, limpar os registros em edição
    if (subTab === "LISTA") {
      setCpfTutorEdicao("");
      setProcedimentoEdicao(null);
    }
    router.push(`/ccz?tab=${tab}&subTab=${subTab}`);
  };

  // Ao sair do modo cadastro (troca de aba), limpa os registros em edição.
  useEffect(() => {
    if (activeSubTab !== "CADASTRAR") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
      setCpfTutorEdicao("");
      setProcedimentoEdicao(null);
    }
  }, [activeTab, activeSubTab]);

  // ── Editar tutor: vai para Tutor > Cadastrar com o CPF pré-carregado ──
  const editarTutor = (cpf) => {
    setCpfTutorEdicao(cpf);
    irPara("TUTORES", "CADASTRAR");
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

  // Volta para a lista correspondente após salvar/cancelar edição.
  const voltarListaProcedimentos = () => {
    setProcedimentoEdicao(null);
    irPara("PROCEDIMENTOS", "LISTA");
  };
  let conteudo;
  if (activeTab === "DASHBOARD") {
    conteudo = <DashboardCCZ />;
  } else if (activeTab === "AGENDA") {
    conteudo = <AgendaCCZ onAbrirProcedimento={editarProcedimento} />;
  } else if (activeTab === "TERMOS") {
    conteudo = <TermosEmBranco />;
  } else if (activeTab === "DENUNCIA_AGRESSIVO") {
    if (activeSubTab === "LISTA") {
      conteudo = <DenunciasLista tipo="AGRESSIVO" />;
    } else {
      conteudo = <CadastroDenuncia tipo="AGRESSIVO" />;
    }
  } else if (activeTab === "DENUNCIA_DOENTE") {
    if (activeSubTab === "LISTA") {
      conteudo = <DenunciasLista tipo="DOENTE" />;
    } else {
      conteudo = <CadastroDenuncia tipo="DOENTE" />;
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
    // CCZ > Zoonoses > Esporotricose: abas próprias (Novo Registro /
    // Consultar Registros) no mesmo padrão da Leishmaniose.
    conteudo = <EsporotricoseTab />;
  } else if (activeTab === "LEISHMANIOSE") {
    // CCZ > Zoonoses > Leishmaniose: abas próprias (Novo Registro /
    // Consultar Registros) dentro do container principal do módulo.
    conteudo = <LeishmanioseTab />;
  } else if (activeTab === "ANIMAIS") {
    // CCZ > Zoonoses > Animais: abas próprias (Novo Registro / Consultar
    // Registros) no mesmo padrão da Leishmaniose e da Esporotricose.
    conteudo = <AnimaisTab podeCriar={permAnimais.criar} />;
  } else {
    // TUTORES (padrão)
    if (activeSubTab === "LISTA") {
      conteudo = <TutoresLista onEditar={editarTutor} />;
    } else {
      conteudo = (
        <CadastroPessoas
          key={cpfTutorEdicao || "novo"}
          variante="tutor"
          salvarTutor={salvarTutor}
          podeInativar={permSituacao.inativar}
          podeReativar={permSituacao.reativar}
          podeEditarSituacao={permSituacao.editar}
        />
      );
    }
  }

  // Container principal único (padrão da Lista de Espera da Regulação): engloba
  // as abas (Lista/Novo) e o conteúdo delas. O cabeçalho externo do módulo foi
  // removido — cada tela mantém o próprio título interno.
  // Leishmaniose tem as próprias abas (Novo Registro / Consultar Registros)
  // dentro do mesmo container — não recebe as abas Lista/Novo.
  const mostrarAbas =
    activeTab !== "DASHBOARD" &&
    activeTab !== "AGENDA" &&
    activeTab !== "TERMOS" &&
    activeTab !== "LEISHMANIOSE" &&
    activeTab !== "ESPOROTRICOSE" &&
    activeTab !== "ANIMAIS";

  return (
    <div className="paginaContainer">
      <div className="paginaPainel">
      {mostrarAbas && (
      <div>
      {/* Abas de navegação (Lista / Cadastrar) */}
        <div className="paginaAbas">
          <button
            className={`paginaAba ${activeSubTab === "LISTA" ? "paginaAbaAtiva" : ""}`}
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
          {(activeTab !== "ANIMAIS" || permAnimais.criar) && (
          <button
            className={`paginaAba ${activeSubTab === "CADASTRAR" ? "paginaAbaAtiva" : ""}`}
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
          )}
        </div>
      </div>
      )}

      {conteudo}
      </div>
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
