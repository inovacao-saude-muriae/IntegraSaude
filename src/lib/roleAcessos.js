// ═══════════════════════════════════════════════════════════════════════════
// PERFIL (enum Role) ↔ VÍNCULOS (UserAcesso) — FONTE ÚNICA
// ─────────────────────────────────────────────────────────────────────────
// O perfil do usuário (`users.role`) define o PACOTE PADRÃO de vínculos de
// acesso (`user_acessos`), que é o que a autorização de fato consulta.
//
// Esta função existia duplicada em duas rotas de gerenciamento de usuários
// (criar/editar e alterar perfil), com risco de divergirem. Agora há um só
// lugar. Os dois pontos de escrita continuam usando a mesma tabela — nenhuma
// estrutura de banco foi alterada.
//
// Regras do pacote (espelham a regra de perfis acordada com a gestão):
//   GESTOR              → sem vínculos (acessa tudo pela própria role)
//   REGULACAO_ADMIN     → REGULACAO/ADMIN
//   REGULACAO_COMUM     → REGULACAO/OPERADOR
//   FARMACIA_ADMIN      → FARMACIA/ADMIN
//   PROCESSO_ADMIN      → PROCESSOS/ADMIN
//   JUNTA_ADMIN         → JUNTA/ADMIN (todos os sub-serviços)
//   JUNTA_CAEE          → JUNTA/OPERADOR + sub-serviço CAEE
//   JUNTA_EDUCACAO      → JUNTA/OPERADOR + sub-serviço APAE
//   JUNTA_SAUDE         → JUNTA/OPERADOR + sub-serviço AMBULATORIO
//   JUNTA_ASSISTENCIA   → JUNTA/OPERADOR + sub-serviço ESPECIALIDADES
//   CCZ_ADMIN           → CCZ/ADMIN
//   CCZ_COMUM           → CCZ/OPERADOR
// ═══════════════════════════════════════════════════════════════════════════

export const PACOTE_DE_ACESSOS_POR_ROLE = {
  GESTOR: [],
  REGULACAO_ADMIN: [{ modulo: "REGULACAO", nivel: "ADMIN", servicoJunta: null }],
  REGULACAO_COMUM: [{ modulo: "REGULACAO", nivel: "OPERADOR", servicoJunta: null }],
  FARMACIA_ADMIN: [{ modulo: "FARMACIA", nivel: "ADMIN", servicoJunta: null }],
  PROCESSO_ADMIN: [{ modulo: "PROCESSOS", nivel: "ADMIN", servicoJunta: null }],
  JUNTA_ADMIN: [{ modulo: "JUNTA", nivel: "ADMIN", servicoJunta: null }],
  JUNTA_CAEE: [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "CAEE" }],
  JUNTA_EDUCACAO: [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "APAE" }],
  JUNTA_SAUDE: [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "AMBULATORIO" }],
  JUNTA_ASSISTENCIA: [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "ESPECIALIDADES" }],
  CCZ_ADMIN: [{ modulo: "CCZ", nivel: "ADMIN", servicoJunta: null }],
  CCZ_COMUM: [{ modulo: "CCZ", nivel: "OPERADOR", servicoJunta: null }],
};

/**
 * Devolve os vínculos padrão de um perfil.
 * Perfil desconhecido → [] (fail-closed: sem vínculo, sem acesso).
 */
export function mapearRoleParaAcessos(role) {
  return PACOTE_DE_ACESSOS_POR_ROLE[role] || [];
}

/**
 * Verifica se o pacote de um perfil é compatível com os vínculos gravados.
 * Usado para detectar usuários cujo perfil e vínculos divergem (ex.: perfil
 * REGULACAO_ADMIN com vínculo FARMACIA/ADMIN) — divergência não é corrigida
 * automaticamente, apenas reportada.
 */
export function pacoteConfereComAcessos(role, acessos = []) {
  const esperado = mapearRoleParaAcessos(role);
  const normalizar = (lista) =>
    lista
      .map((a) => `${a.modulo}|${a.nivel}|${a.servicoJunta || ""}`)
      .sort()
      .join(",");
  return normalizar(esperado) === normalizar(acessos);
}
