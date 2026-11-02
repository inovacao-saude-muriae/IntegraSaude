"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";

// Cópia local dos códigos de módulo (NÃO importar @/lib/permissions: regra da
// DAL — Client Components não importam esse módulo). Usada só para legibilidade.
const MODULOS_UI = {
  REGULACAO: "REGULACAO",
  FARMACIA: "FARMACIA",
  PROCESSOS: "PROCESSOS",
  JUNTA: "JUNTA",
  CCZ: "CCZ",
};

const menuSections = [
  {
    items: [
      {
        name: "Início",
        path: "/",
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9.5 12 3l9 6.5" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        ),
      },
    ],
  },
  {
    items: [
      {
        name: "Regulação",
        path: "/regulacao",
        isDropdown: true,
        moduloRequerido: "REGULACAO",
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
        subItems: [
          { name: "Novo Pedido", tab: "NOVO_PEDIDO", visivelSe: "REGULACAO" },
          { name: "Lista de Espera", tab: "LISTA_ESPERA", visivelSe: "REGULACAO" },
          { name: "Liberados", tab: "LIBERADOS", visivelSe: "REGULACAO" },
          { name: "Financeiro", tab: "FINANCEIRO", visivelSe: "REGULACAO_ADMIN" },
          { name: "separator", isSeparator: true, visivelSe: "REGULACAO" },
          { name: "Procedimentos", tab: "PROCEDIMENTOS", visivelSe: "REGULACAO" },
          { name: "Médicos", path: "/gerenciamento/medicos", visivelSe: "REGULACAO" },
          { name: "Unidade Básica de Saúde", path: "/gerenciamento/ubs", visivelSe: "REGULACAO" },
          { name: "Dashboard", tab: "DASHBOARD", visivelSe: "REGULACAO" },
        ],
      },
    ],
  },
  {
    items: [
      {
        name: "Câmara Técnica",
        path: "/camara-tecnica",
        isDropdown: true,
        moduloRequerido: null,
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
        ),
        subItems: [
          {
            name: "Farmácia Judicial",
            tab: "FARMACIA_JUDICIAL",
            path: "/camara-tecnica/farmacia-judicial?tab=FARMACIA_JUDICIAL&subTab=DASHBOARD",
            isNestedDropdown: true,
            visivelSe: "FARMACIA",
            nestedItems: [
              { name: "Novo Processo", subTab: "PACIENTES" },
              { name: "Medicamentos", subTab: "MEDICAMENTOS" },
              { name: "Estoque", subTab: "ESTOQUE" },
              { name: "Dispensação", subTab: "DISPENSACAO" },
              { name: "separator", isSeparator: true },
              { name: "Relatórios", subTab: "RELATORIOS" },
              { name: "Dashboard", subTab: "DASHBOARD" },
            ],
          },
          {
            name: "Processos Judiciais",
            tab: "PROCESSOS",
            path: "/camara-tecnica/processos",
            visivelSe: "PROCESSOS",
          },
        ],
      },
    ],
  },
  {
    items: [
      {
        name: "Junta Reguladora",
        path: "/junta-reguladora",
        isDropdown: true,
        moduloRequerido: "JUNTA",
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
        subItems: [
          { name: "Novo Pedido", tab: "CADASTRO", visivelSe: "JUNTA" },
           {
            name: "Serviços",
            tab: "SERVICOS",
            isNestedDropdown: true,
            visivelSe: "JUNTA",
            nestedItems: [
              { name: "CAEE", subTab: "CAEE", visivelSe: "JUNTA_SUBSERVICO", servicoJunta: "CAEE" },
              { name: "APAE", subTab: "APAE", visivelSe: "JUNTA_SUBSERVICO", servicoJunta: "APAE" },
              { name: "Ambulatório", subTab: "AMBULATORIO", visivelSe: "JUNTA_SUBSERVICO", servicoJunta: "AMBULATORIO" },
              { name: "Centro de Especialidades", subTab: "ESPECIALIDADES", visivelSe: "JUNTA_SUBSERVICO", servicoJunta: "ESPECIALIDADES" },
           
            ],
          },
          { name: "separator", isSeparator: true, visivelSe: "JUNTA" },
          { name: "Serviços e Especialidades", tab: "SERVICOS_ESPECIALIDADES", visivelSe: "JUNTA" },
          { name: "Prontuário", tab: "RELATORIO", visivelSe: "JUNTA_ADMIN" },
          { name: "Dashboard", tab: "DASHBOARD", visivelSe: "JUNTA" },
         
        ],
      },
    ],
  },
  {
    items: [
      {
        name: "CCZ",
        path: "/ccz",
        isDropdown: true,
        moduloRequerido: "CCZ",
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="4" r="2" />
            <circle cx="18" cy="8" r="2" />
            <circle cx="20" cy="16" r="2" />
            <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
          </svg>
        ),
        subItems: [
          { name: "Procedimentos", tab: "PROCEDIMENTOS", visivelSe: "CCZ" },
          { name: "Esporotricose", tab: "ESPOROTRICOSE", visivelSe: "CCZ" },
          { name: "Zoonoses", tab: "ZOONOSES", visivelSe: "CCZ" },
          { name: "Denúncias", tab: "DENUNCIAS", visivelSe: "CCZ" },
          { name: "Agenda", tab: "AGENDA", visivelSe: "CCZ" },
          { name: "separator", isSeparator: true, visivelSe: "CCZ" },
          { name: "Animais", tab: "ANIMAIS", visivelSe: "CCZ" },
          { name: "Tutor", tab: "TUTORES", visivelSe: "CCZ" },
          { name: "Termos", tab: "TERMOS", visivelSe: "CCZ" },
          { name: "Dashboard", tab: "DASHBOARD", visivelSe: "CCZ" },
        ],
      },
    ],
  },
  {
    items: [
      {
        name: "Gerenciamento",
        path: "/admin/gerenciamento",
        isDropdown: true,
        moduloRequerido: null,
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        ),
        subItems: [
          {
            name: "Pacientes",
            path: "/gerenciamento/pessoas",
            tab: "PESSOAS",
            visivelSe: "GESTOR",
          },
          {
            name: "Procedimentos",
            path: "/regulacao?tab=PROCEDIMENTOS",
            tab: "PROCEDIMENTOS",
            visivelSe: "GESTOR",
          },
          {
            name: "Médicos",
            path: "/gerenciamento/medicos",
            tab: "MEDICOS",
            visivelSe: "GESTOR",
          },
          {
            name: "Unidade Básica de Saúde",
            path: "/gerenciamento/ubs",
            tab: "UBS",
            visivelSe: "GESTOR",
          },
          {
            name: "Gerenciar Usuários",
            path: "/gerenciamento/usuarios",
            tab: "USUARIOS",
            visivelSe: "GESTOR",
          },
          {
            name: "Relatórios Gerais",
            path: "/gerenciamento/relatorios",
            tab: "RELATORIOS",
            visivelSe: "GESTOR",
          },
        ],
      },
    ],
  },
];

// Ícone pequeno para itens de submenu, escolhido por palavra-chave do nome.
function subIcon(nome = "") {
  const n = nome.toLowerCase();
  const props = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (n.includes("dashboard") || n.includes("painel"))
    return (
      <svg {...props}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
    );
  if (n.includes("novo pedido") || n.includes("cadastrar") || n.includes("cadastro") || n.includes("novo"))
    return (
      <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="M9 15h6" /></svg>
    );
  if (n.includes("lista de espera") || n.includes("espera") || n.includes("exibir") || n.includes("lista"))
    return (
      <svg {...props}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
    );
  if (n.includes("liberad"))
    return (
      <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
    );
  if (n.includes("financeiro") || n.includes("relatório") || n.includes("relatorio"))
    return (
      <svg {...props}><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
    );
  if (n.includes("paciente") || n.includes("pessoa") || n.includes("usuário") || n.includes("usuario") || n.includes("usuario"))
    return (
      <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
    );
  if (n.includes("prontuário") || n.includes("prontuario"))
    return (
      <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    );
  if (n.includes("medicamento") || n.includes("dispensa") || n.includes("farmácia") || n.includes("farmacia"))
    return (
      <svg {...props}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>
    );
  if (n.includes("estoque"))
    return (
      <svg {...props}><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
    );
  if (n.includes("médico") || n.includes("medico"))
    return (
      <svg {...props}><path d="M8 2v4" /><path d="M16 2v4" /><path d="M12 11v6" /><path d="M9 14h6" /><rect x="3" y="4" width="18" height="18" rx="2" /></svg>
    );
  if (n.includes("ubs") || n.includes("unidade") || n.includes("saúde") || n.includes("saude"))
    return (
      <svg {...props}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /><path d="M12 13v4" /><path d="M10 15h4" /></svg>
    );
  if (n.includes("procedimento"))
    return (
      <svg {...props}><path d="M14.5 2 9 7.5l-7 7a2.12 2.12 0 0 0 3 3l7-7L17.5 5" /><path d="m14 7 3 3" /></svg>
    );
  if (n.includes("agenda") || n.includes("calendário") || n.includes("calendario"))
    return (
      <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    );
  // "Serviços de Atendimento" (Junta): grade de serviços oferecidos (CAEE, APAE, Ambulatório...).
  if (n.includes("serviços de atendimento") || n.includes("servicos de atendimento"))
    return (
      <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    );
  // "Serviços e Especialidades" (Gerenciamento): mesma grade de serviços.
  // "Centro de Especialidades" usa o ponto genérico.
  if (n.includes("serviços e especialidades") || n.includes("servicos e especialidades"))
    return (
      <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    );
  if (n.includes("animal") || n.includes("animais"))
    return (
      <svg {...props}><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></svg>
    );
    if (n.includes("denúncia") || n.includes("denuncia") || n.includes("zoonoses")  || n.includes("esporotricose"))
    return (
      <svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    );
  if (n.includes("processo"))
    return (
      <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
    );
    if (n.includes("tutor"))
    return (
      <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
    );
  // Padrão genérico (ponto).
  return (
    <svg {...props}><circle cx="12" cy="12" r="4" /></svg>
  );
}

// A Sidebar VOLTA a filtrar por perfil (revoga o comportamento anterior "não
// filtra mais por papel"): o menu é recortado conforme os vínculos de `/api/me`.
// Isso é camada de APRESENTAÇÃO — a barreira real de autorização continua no
// servidor (layout.js por módulo), que bloqueia o CONTEÚDO via
// <AcessoNegadoModulo/>. O filtro é FAIL-CLOSED: enquanto `/api/me` não
// respondeu (ou falhou), só os itens universais aparecem.

// ── FILTRO POR PERFIL (funções puras locais) ────────────────────────────────
// Reimplementadas inline porque Client Components NÃO importam @/lib/permissions
// (regra da DAL). Espelham a semântica das puras do servidor: GESTOR
// curto-circuita; admin = vínculo nível ADMIN; operador Junta = vínculo com
// servicoJunta. A decisão real continua no servidor.

// Recorta o array estático `menuSections` conforme o perfil `me` desembrulhado
// de /api/me ({ role, isGestor, acessos:[{ modulo, nivel, servicoJunta }] }).
// Com `me === null` (carregando/erro) o resultado é fail-closed: só itens
// universais (Início + Gerenciamento[Pacientes]).
function construirMenu(me) {
  const ehGestor = !!me?.isGestor || me?.role === "GESTOR";
  const temModulo = (m) => ehGestor || (me?.acessos || []).some((a) => a.modulo === m);
  const ehAdminMod = (m) =>
    ehGestor || (me?.acessos || []).some((a) => a.modulo === m && a.nivel === "ADMIN");
  const subServicosOperador = (me?.acessos || [])
    .filter((a) => a.modulo === "JUNTA" && a.nivel === "OPERADOR" && a.servicoJunta)
    .map((a) => a.servicoJunta);

  // switch FAIL-CLOSED: default retorna false. Todo sub-item/nestedItem que
  // deva aparecer PRECISA de visivelSe explícito.
  function subItemVisivel(sub) {
    switch (sub.visivelSe) {
      case "TODOS":
        return true;
      case "REGULACAO":
        return temModulo("REGULACAO");
      case "REGULACAO_ADMIN":
        return ehGestor || ehAdminMod("REGULACAO");
      case "JUNTA":
        return temModulo("JUNTA");
      case "JUNTA_ADMIN":
        return ehGestor || ehAdminMod("JUNTA");
      case "GESTOR":
        return ehGestor;
      case "FARMACIA":
        return temModulo("FARMACIA");
      case "CCZ":
        return temModulo("CCZ");
      case "PROCESSOS":
        return temModulo("PROCESSOS");
      case "JUNTA_SUBSERVICO":
        return (
          ehGestor ||
          ehAdminMod("JUNTA") ||
          subServicosOperador.includes(sub.servicoJunta)
        );
      default:
        return false; // fail-closed
    }
  }

  return menuSections
    .map((section) => {
      const items = section.items
        .map((item) => {
          // Itens de TOPO que NÃO são dropdown (sem subItems) são SEMPRE
          // mantidos — não passam pelo switch nem pela poda (ex.: "Início").
          if (!item.isDropdown) return item;

          // Camada 1 — sub-itens (leaf e nested) por visivelSe.
          let subItens = (item.subItems || []).filter((sub) => subItemVisivel(sub));

          // Camada 2 — recorte de nestedItems dos nested dropdowns sobreviventes.
          subItens = subItens.map((sub) => {
            if (!sub.isNestedDropdown) return sub;
            // Farmácia Judicial: nestedItems herdam a visibilidade do pai
            // (sem regra por nestedItem) → mantidos todos.
            if (sub.visivelSe !== "JUNTA") return sub;
            // Grupo "Serviços" da Junta: recorta nestedItems por JUNTA_SUBSERVICO.
            const nested = (sub.nestedItems || []).filter((n) => subItemVisivel(n));
            return { ...sub, nestedItems: nested };
          });

          // Camada 3.1 — nested dropdown que ficou com zero nestedItems é podado.
          subItens = subItens.filter(
            (sub) => !sub.isNestedDropdown || (sub.nestedItems || []).length > 0,
          );

          // Camada 3.2 — gate de módulo (AND) e poda de dropdown sem sub-itens.
          const moduloOk =
            item.moduloRequerido == null || temModulo(item.moduloRequerido);
          if (!moduloOk || subItens.length === 0) return null;

          return { ...item, subItems: subItens };
        })
        .filter(Boolean);

      return { ...section, items };
    })
    // Camada 3.3 — section sem nenhum item visível é omitida.
    .filter((section) => section.items.length > 0);
}

function MenuContent() {
  const [carregando, setCarregando] = useState(true);
  const [me, setMe] = useState(null);

  // Busca única de /api/me na montagem (fail-closed: só itens universais até
  // responder). Desembrulho OBRIGATÓRIO via json.user.
  useEffect(() => {
    let isMounted = true;
    async function carregarMe() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error("me indisponível");
        const json = await res.json();
        if (isMounted) {
          setMe(json.user ?? null);
          setCarregando(false);
        }
      } catch (err) {
        console.error("Sidebar: falha ao carregar /api/me:", err);
        if (isMounted) {
          setMe(null);
          setCarregando(false);
        }
      }
    }
    carregarMe();
    return () => {
      isMounted = false;
    };
  }, []);

  // Menu recortado por perfil, memoizado. Durante carregamento (ou erro),
  // usa-se construirMenu(null), que por construção resulta em
  // Início + Gerenciamento[Pacientes].
  const menuComPerfil = useMemo(() => construirMenu(me), [me]);
  const menuAtual = carregando ? construirMenu(null) : menuComPerfil;

  return <MenuRender menuSections={menuAtual} />;
}

function MenuRender({ menuSections }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentTab = searchParams.get("tab") || "DASHBOARD";
  const currentSubTab = searchParams.get("subTab") || "";

  const [openGroup, setOpenGroup] = useState({});
  const [openNested, setOpenNested] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  // Monta a URL da primeira aba (padrão) de um módulo, para "resetar" a posição
  // ao reabrir o módulo em vez de ficar na última aba acessada.
  const urlAbaInicial = (item) => {
    // Se o path já tiver uma query string com tab, usa ela diretamente
    if (item.path.includes('?tab=')) return item.path;
    
    // Tenta achar um item com tab "DASHBOARD"
    const dashboardItem = item.subItems?.find(sub => sub.tab === "DASHBOARD");
    if (dashboardItem) {
      if (dashboardItem.path) return dashboardItem.path;
      return `${item.path}?tab=DASHBOARD`;
    }
    
    const primeiro = item.subItems?.[0];
    if (!primeiro) return item.path;
    // Link já pronto (ex.: Gerenciamento usa path próprio por item).
    if (primeiro.path) return primeiro.path;
    // Caso padrão: path do módulo + tab do primeiro sub-item.
    return `${item.path}?tab=${primeiro.tab}`;
  };

  const toggleGroup = (item) => {
    const path = item.path;
    const vaiAbrir = !openGroup[path];
    setOpenGroup((prev) => ({ ...prev, [path]: !prev[path] }));
    
    // Se estiver FECHANDO o grupo, fechar todos os submenus nested dentro dele
    if (!vaiAbrir) {
      const nestedTabsToClose = item.subItems
        ?.filter(sub => sub.isNestedDropdown)
        .map(sub => sub.tab) || [];
      
      if (nestedTabsToClose.length > 0) {
        setOpenNested((prev) => {
          const newState = { ...prev };
          nestedTabsToClose.forEach(tabKey => {
            newState[tabKey] = false;
          });
          return newState;
        });
      }
    }
    
    // Ao abrir o módulo, navega para a aba inicial (zera a posição anterior).
    // Exceção: se o primeiro item for um subgrupo (nestedDropdown), não navega —
    // apenas expande o menu (ex.: Câmara Técnica só mostra conteúdo ao clicar
    // em Farmácia Judicial).
    if (vaiAbrir) {
      const primeiroItem = item.subItems?.[0];
      const ehNestedDropdown = primeiroItem?.isNestedDropdown;
      
      // Se o primeiro item não for nestedDropdown, navega
      if (!ehNestedDropdown) {
        router.push(urlAbaInicial(item));
      }
    }
  };

  const toggleNested = (sub, itemPath) => {
    const tabKey = sub.tab;
    const vaiAbrir = !openNested[tabKey];
    setOpenNested((prev) => ({ ...prev, [tabKey]: !prev[tabKey] }));
    // Ao abrir o subgrupo, navega para o primeiro item dele (zera a posição).
    if (vaiAbrir) {
      const base = sub.path || itemPath;
      
      // Se o path já tiver query string completa (ex: ?tab=X&subTab=Y), usa ela diretamente
      if (base.includes('?tab=') && base.includes('&subTab=')) {
        router.push(base);
      } else {
        // Caso contrário, monta a URL com o primeiro nestedItem
        const primeiro = sub.nestedItems?.[0];
        if (primeiro) {
          router.push(`${base}?tab=${sub.tab}&subTab=${primeiro.subTab}`);
        }
      }
    }
  };

  return (
    <aside className={styles.sidebar}>
      {/* HEADER DA SIDEBAR */}
      <div className={styles.sidebarHeader}>
        <div className={styles.brandLogo}>
          <Image
            src="/img/logos-integra/logointegra.png"
            alt="IntegraSaúde"
            width={180}
            height={60}
            quality={100}
            className={styles.brandImage}
            priority
          />
        </div>
      </div>

      {/* LISTA NAVEGÁVEL */}
      <nav className={styles.menuContentList}>
        {menuSections.map((section, sIdx) => {
          const filteredItems = section.items
            // O recorte por perfil já foi aplicado por construirMenu; aqui só
            // filtramos pelo termo de busca.
            .filter((item) => {
              if (!searchTerm) return true;
              const matchMain = item.name
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
              const matchSub = item.subItems?.some(
                (sub) =>
                  sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  sub.nestedItems?.some((nested) =>
                    nested.name.toLowerCase().includes(searchTerm.toLowerCase()),
                  ),
              );
              return matchMain || matchSub;
            });

          if (filteredItems.length === 0) return null;

          return (
            <div key={sIdx} className={styles.sectionGroup}>
              {filteredItems.map((item) => {
                const isDropdownOpen =
                  Boolean(openGroup[item.path]) || Boolean(searchTerm);

                if (item.isDropdown) {
                  // Sub-itens já recortados por perfil em construirMenu.
                  const subItemsVisiveis = item.subItems || [];
                  if (subItemsVisiveis.length === 0) return null;

                  return (
                    <div key={item.path}>
                      <button
                        type="button"
                        className={styles.menuItemBtn}
                        data-state={isDropdownOpen ? "open" : "closed"}
                        onClick={() => toggleGroup(item)}
                        title={item.name}
                      >
                        <span className={styles.itemIcon}>{item.icon}</span>
                        <span className={styles.itemLabel}>{item.name}</span>
                        <svg
                          className={`${styles.arrowIcon} ${isDropdownOpen ? styles.arrowOpen : ""}`}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      {isDropdownOpen && (
                        <ul className={styles.subMenuList}>
                          {subItemsVisiveis.map((sub, subIndex) => {
                            // Renderiza separador
                            if (sub.isSeparator) {
                              return (
                                <li key={`separator-${subIndex}`} className={styles.menuSeparator}>
                                  <hr />
                                </li>
                              );
                            }

                            if (sub.isNestedDropdown) {
                              const isNestedOpen =
                                Boolean(openNested[sub.tab]) ||
                                Boolean(searchTerm);

                              return (
                                <li key={`${sub.tab}-${subIndex}`}>
                                  <button
                                    type="button"
                                    className={`${styles.nestedBtn} ${isNestedOpen ? styles.nestedBtnOpen : ""}`}
                                    onClick={() => toggleNested(sub, item.path)}
                                  >
                                    <span className={styles.subItemContent}>
                                      <span className={styles.subItemIcon}>{subIcon(sub.name)}</span>
                                      {sub.name}
                                    </span>
                                    <svg
                                      className={`${styles.arrowIcon} ${isNestedOpen ? styles.arrowOpen : ""}`}
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </button>

                                  {isNestedOpen && (
                                    <ul className={styles.nestedMenuList}>
                                      {sub.nestedItems.map((nested, nestedIndex) => {
                                        // Renderiza separador para nestedItems
                                        if (nested.isSeparator) {
                                          return (
                                            <li key={`nested-separator-${nestedIndex}`} className={styles.menuSeparator}>
                                              <hr />
                                            </li>
                                          );
                                        }

                                        // Se tiver path próprio (ex: Cadastrar Paciente), usa ele
                                        let nestedLink;
                                        if (nested.path) {
                                          nestedLink = nested.path;
                                        } else {
                                          const basePath = sub.path || item.path;
                                          if (basePath.includes('?')) {
                                            nestedLink = `${basePath}&subTab=${nested.subTab}`;
                                          } else {
                                            nestedLink = `${basePath}?tab=${sub.tab}&subTab=${nested.subTab}`;
                                          }
                                        }
                                        const isNestedActive = nested.path
                                          ? pathname === nested.path
                                          : pathname === (sub.path || item.path) &&
                                            currentTab === sub.tab &&
                                            currentSubTab === nested.subTab;

                                        return (
                                          <li key={nested.subTab || `nested-${nestedIndex}`}>
                                            <Link
                                              href={nestedLink}
                                              className={`${styles.subMenuItemLink} ${
                                                isNestedActive
                                                  ? styles.activeLink
                                                  : ""
                                              }`}
                                            >
                                              <span className={styles.subItemContent}>
                                                <span className={styles.subItemIcon}>{subIcon(nested.name)}</span>
                                                {nested.name}
                                              </span>
                                            </Link>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            }

                            let subLink;
                            if (sub.path) {
                              subLink = sub.path;
                            } else if (item.path.includes('?')) {
                              subLink = `${item.path}&tab=${sub.tab}`;
                            } else {
                              subLink = `${item.path}?tab=${sub.tab}`;
                            }
                            // Separa o path base da query (ex: /x?subTab=MEDICOS)
                            const [subBasePath, subQuery] = (sub.path || "").split("?");
                            const subQuerySubTab = new URLSearchParams(subQuery || "").get("subTab");
                            const isSubActive = sub.path
                              ? pathname === subBasePath &&
                                (!subQuerySubTab || currentSubTab === subQuerySubTab)
                              : pathname === item.path && currentTab === sub.tab;

                            return (
                              <li key={`${sub.tab || sub.name}-${subIndex}`}>
                                <Link
                                  href={subLink}
                                  className={`${styles.subMenuItemLink} ${
                                    isSubActive ? styles.activeLink : ""
                                  }`}
                                >
                                  <span className={styles.subItemContent}>
                                    <span className={styles.subItemIcon}>{subIcon(sub.name)}</span>
                                    {sub.name}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                }

                const isActive = pathname === item.path;

                return (
                  <div key={item.path}>
                    <Link
                      href={item.path}
                      className={`${styles.menuItemBtn} ${isActive ? styles.activeLink : ""}`}
                      title={item.name}
                    >
                      <span className={styles.itemIcon}>{item.icon}</span>
                      <span className={styles.itemLabel}>{item.name}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <MenuContent />
    </Suspense>
  );
}
