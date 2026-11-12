// Gerado para teste: extrai SÓ as regras puras de permissions.js,
// sem 'server-only' e sem acesso a banco.
import { permissoesPadrao, PERFIS as PERFIS_CATALOGO } from './src/lib/permissoesCatalogo.js';
const MODULOS = { JUNTA: 'JUNTA' };

// ── 4. Funções de decisão PURAS (recebem {acessos}) ────────────────────────
// Isoladas para teste; fail-closed em tudo.
//
// REGRAS DO MODELO DEFINITIVO:
//  • A decisão NUNCA vem de users.role. Vem do vínculo (user_acessos), do
//    perfil do vínculo, do escopo de serviços e das permissões efetivas.
//  • Gestão Geral é um vínculo como qualquer outro (módulo GESTAO) — não
//    curto-circuita nada.
//  • Vinculo com escopo inválido, ou perfil desconhecido, não autoriza.

// Perfis que recebem o pacote padrão quando o vínculo não tem permissões
// gravadas. Importado do catálogo (fonte única) — nunca duplicado aqui.
function vinculosAtivos(ctx, modulo) {
  if (!ctx?.acessos) return [];
  return ctx.acessos.filter(
    (a) => a.modulo === modulo && a.ativo !== false,
  );
}

/**
 * Permissões efetivas de um vínculo.
 * Gravadas no vínculo quando existem; senão, o pacote do perfil.
 * Perfil desconhecido → [] (fail-closed).
 */
function permissoesDoVinculo(vinculo) {
  const gravadas = Array.isArray(vinculo.permissoes) ? vinculo.permissoes : [];
  if (gravadas.length > 0) return gravadas;
  const perfil = vinculo.perfil;
  if (!perfil || !PERFIS_CATALOGO[perfil]) return [];
  return permissoesPadrao(vinculo.modulo, perfil);
}

/**
 * O vínculo alcança o serviço pedido?
 *   TODOS       → sim (servicos vazio)
 *   ESPECIFICOS → só se o serviço estiver em `servicos`
 *   NENHUM      → não
 * Escopo ausente/desconhecido → false.
 */
function escopoAlcancaServico(vinculo, servico) {
  const escopo = vinculo.escopo;
  const servicos = Array.isArray(vinculo.servicos) ? vinculo.servicos : [];

  if (escopo === "TODOS") return servicos.length === 0;
  if (escopo === "ESPECIFICOS") {
    if (servicos.length === 0) return false; // configuração contraditória
    if (!servico) return true; // pergunta sobre o módulo, não sobre o serviço
    return servicos.includes(servico);
  }
  if (escopo === "NENHUM") return false;
  return false; // escopo inválido/ausente: nega
}

// Tem QUALQUER vínculo ativo com o módulo (base para "posso entrar no módulo").
function temAcessoModuloPuro(ctx, modulo) {
  if (!ctx || !modulo) return false;
  return vinculosAtivos(ctx, modulo).length > 0;
}

// É ADMINISTRADOR em algum vínculo ativo do módulo.
// Usado pelas guardas legadas (requireAdminModulo). Na arquitetura definitiva
// o certo é exigir a permissão `gerenciar`; as duas checagens convivem só até
// a migração das server actions terminar.
function ehAdminModuloPuro(ctx, modulo) {
  if (!ctx || !modulo) return false;
  return vinculosAtivos(ctx, modulo).some(
    (a) => a.perfil === PERFIS_CATALOGO.ADMINISTRADOR,
  );
}

// Tem acesso ao sub-serviço da Junta (perfil e serviço são independentes).
function temAcessoServicoJuntaPuro(ctx, servicoJunta) {
  if (!ctx || !servicoJunta) return false;
  return vinculosAtivos(ctx, MODULOS.JUNTA).some((a) =>
    escopoAlcancaServico(a, servicoJunta),
  );
}

// É ADMINISTRADOR em qualquer módulo (usado por getAuxiliaryData).
function ehAdminDeAlgumModuloPuro(ctx) {
  if (!ctx) return false;
  return (ctx.acessos || []).some(
    (a) => a.ativo !== false && a.perfil === PERFIS_CATALOGO.ADMINISTRADOR,
  );
}

/**
 * A decisão central: pode executar `permissao` na `funcionalidade` do módulo?
 * `servico` só é exigido em módulos com escopo por serviço (Junta hoje).
 * Qualquer dúvida → false.
 */
function temPermissaoPura(ctx, modulo, funcionalidade, permissao, servico) {
  if (!ctx || !modulo || !funcionalidade || !permissao) return false;
  const alvo = `${funcionalidade}:${permissao}`;

  return vinculosAtivos(ctx, modulo).some((vinculo) => {
    if (!escopoAlcancaServico(vinculo, servico)) return false;
    return permissoesDoVinculo(vinculo).includes(alvo);
  });
}


export const _puras = {
  temAcessoModuloPuro, ehAdminModuloPuro, temAcessoServicoJuntaPuro,
  ehAdminDeAlgumModuloPuro, temPermissaoPura, permissoesDoVinculo, escopoAlcancaServico,
};
