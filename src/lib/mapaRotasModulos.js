// ═══════════════════════════════════════════════════════════════════════════
// MAPA ROTA → MÓDULO — projeção declarativa da árvore de rotas
// ─────────────────────────────────────────────────────────────────────────
// O proxy (proteção de ENTRADA) precisa saber a qual módulo pertence uma URL
// para negar quem não tem vínculo — inclusive quando a URL é digitada à mão.
//
// Este arquivo NÃO autoriza nada: é só a correspondência entre a árvore de
// `src/app` e as chaves do catálogo (`lib/permissoesCatalogo`). A decisão de
// "tem ou não tem vínculo" continua vindo de `lib/permissions.js`
// (via `lib/contextoProxy.js`), e a autorização definitiva de operações e
// dados continua em `requirePermissao`/`temPermissaoPura`.
//
// Regra de manutenção: rota nova dentro de um módulo entra aqui na mesma
// entrega. Rota não mapeada NÃO é protegida pelo proxy — a proteção continua
// nos layouts e nas guardas do servidor (defesa em profundidade).
// ═══════════════════════════════════════════════════════════════════════════

import { MODULOS } from "./permissoesCatalogo";

/**
 * Cada entrada: { prefixo, modulo, exato? }.
 * A primeira que casar (maior prefixo) vence.
 */
export const MAPA_ROTAS = [
  // ── Regulação ──────────────────────────────────────────────────────────
  { prefixo: "/regulacao", modulo: MODULOS.REGULACAO },

  // ── Câmara Técnica ─────────────────────────────────────────────────────
  // Farmácia Judicial e Processos são módulos distintos, com vínculos
  // distintos — por isso a rota de cada um aponta para o seu módulo.
  { prefixo: "/camara-tecnica/farmacia-judicial", modulo: MODULOS.FARMACIA },
  { prefixo: "/camara-tecnica/processos", modulo: MODULOS.PROCESSOS },
  // Processos Administrativos: mesma área da Câmara Técnica, mesmo módulo.
  { prefixo: "/camara-tecnica/processos-administrativos", modulo: MODULOS.PROCESSOS },
  { prefixo: "/camara-tecnica", modulo: MODULOS.FARMACIA },

  // ── Junta Reguladora ───────────────────────────────────────────────────
  { prefixo: "/junta-reguladora", modulo: MODULOS.JUNTA },

  // ── CCZ ────────────────────────────────────────────────────────────────
  { prefixo: "/ccz", modulo: MODULOS.CCZ },

  // ── Gestão Geral (módulo próprio, sem acesso operacional automático) ────
  { prefixo: "/admin", modulo: MODULOS.GESTAO },
  { prefixo: "/gerenciamento/usuarios", modulo: MODULOS.GESTAO },
  { prefixo: "/gerenciamento/relatorios", modulo: MODULOS.GESTAO },

  // ── Gerenciamento operacional: cada tela pertence ao módulo do seu dado ─
  { prefixo: "/gerenciamento/animais", modulo: MODULOS.CCZ },
  { prefixo: "/gerenciamento/termos", modulo: MODULOS.CCZ },
  { prefixo: "/gerenciamento/medicamentos", modulo: MODULOS.FARMACIA },
  { prefixo: "/gerenciamento/servicos-especialidades", modulo: MODULOS.JUNTA },
  // Catálogo de Especialidades e Procedimentos: aparece no Gerenciamento, mas
  // os dados são do módulo PROCESSOS. A permissão fina de catálogo é checada
  // na página (defesa em profundidade); aqui a exigência é o vínculo.
  {
    prefixo: "/gerenciamento/especialidades-procedimentos",
    modulo: MODULOS.PROCESSOS,
  },
  { prefixo: "/gerenciamento/medicos", modulo: MODULOS.REGULACAO },
  { prefixo: "/gerenciamento/ubs", modulo: MODULOS.REGULACAO },
  // Cadastro único (EMPI): qualquer um dos módulos com a permissão
  // `pessoas:visualizar` entra — por isso a checagem é de "algum destes".
  {
    prefixo: "/gerenciamento/pessoas",
    modulos: [
      MODULOS.GESTAO,
      MODULOS.REGULACAO,
      MODULOS.JUNTA,
      MODULOS.FARMACIA,
      MODULOS.PROCESSOS,
    ],
  },
  {
    prefixo: "/gerenciamento/tutores",
    modulos: [
      MODULOS.GESTAO,
      MODULOS.REGULACAO,
      MODULOS.JUNTA,
      MODULOS.FARMACIA,
      MODULOS.PROCESSOS,
    ],
  },

  // ── Telas autenticadas sem módulo próprio ──────────────────────────────
  // Dashboard e raiz: basta sessão válida (o conteúdo é montado a partir dos
  // vínculos). `trocar-senha` idem.
  { prefixo: "/dashboard", modulo: null },
  { prefixo: "/trocar-senha", modulo: null },
];

/**
 * Devolve a exigência de módulo para um pathname.
 *   { exigencia: null }                 → só sessão válida
 *   { exigencia: { modulos: [...] } }   → precisa de vínculo com UM deles
 */
export function exigenciaDeModulo(pathname) {
  const rota = normalizar(pathname);
  let melhor = null;
  for (const entrada of MAPA_ROTAS) {
    if (!(rota === entrada.prefixo || rota.startsWith(`${entrada.prefixo}/`))) {
      continue;
    }
    if (!melhor || entrada.prefixo.length > melhor.prefixo.length) {
      melhor = entrada;
    }
  }
  if (!melhor) return { exigencia: null, mapeada: false };
  if (!melhor.modulo && !melhor.modulos) return { exigencia: null, mapeada: true };
  return {
    exigencia: { modulos: melhor.modulos || [melhor.modulo] },
    mapeada: true,
  };
}

// Remove barra final e garante a inicial.
function normalizar(pathname) {
  if (!pathname) return "/";
  const limpo = pathname.split("?")[0].split("#")[0];
  if (limpo.length > 1 && limpo.endsWith("/")) return limpo.slice(0, -1);
  return limpo;
}
