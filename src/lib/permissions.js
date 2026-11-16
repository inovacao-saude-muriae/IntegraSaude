import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { carregarSessao } from "@/lib/auth";
import {
  permissoesEfetivas,
  permissoesPadrao,
  moduloTemEscopoPorServico,
  PERFIS as PERFIS_CATALOGO,
} from "@/lib/permissoesCatalogo";

// ═══════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA DE VERDADE DE AUTORIZAÇÃO (RBAC Etapa 1)
// ─────────────────────────────────────────────────────────────────────────
// Toda decisão de acesso nasce aqui. Client Components NÃO importam este módulo
// (regra da DAL do Next): recebem flags já calculadas via props/context.
// Princípio transversal: fail-closed — qualquer dúvida resulta em negar.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Constantes de domínio (espelham os enums Prisma de FEAT-001) ─────────

export const MODULOS = {
  REGULACAO: "REGULACAO",
  FARMACIA: "FARMACIA",
  PROCESSOS: "PROCESSOS",
  JUNTA: "JUNTA",
  CCZ: "CCZ",
  GESTAO: "GESTAO",
};

export const NIVEIS = { ADMIN: "ADMIN", OPERADOR: "OPERADOR" };

// Serviços da Junta NÃO são uma lista fixa: são registros de `junta_servicos`,
// referenciados pelo `id` em `user_acessos.servicos`. Este objeto existe apenas
// como marcador histórico e não deve ser usado para autorizar nem para montar
// opções de tela — ver `servicosDoCatalogo` em lib/acessoService.

// ── 2. Carregamento dos vínculos (consulta ao banco, memoizada por render) ──

// Carrega {user, acessos} a partir da sessão (cookie). Memoizado por render de
// Server Component via React.cache: várias checagens na mesma renderização = 1
// query. Em API routes/actions (que não são renderizações de componente) NÃO
// se deve contar com a dedupe entre funções — cada guarda roda a query 1x.
// IMPORTANTE: usa include SEM select restritivo, para manter nome/role/cargo
// no `user` retornado (actions existentes consomem user.nome etc.).
// A validação da sessão em si é delegada a `carregarSessao()` (lib/auth.js),
// fonte única: cookie → sessão no banco → expiração real → usuário ativo.
// Aqui só memoizamos por renderização para evitar N queries na mesma árvore.
export const carregarContextoAcesso = cache(async () => {
  const ctx = await carregarSessao();
  if (!ctx) return null;
  return { user: ctx.user, acessos: ctx.user.acessos };
});

// Variante por CPF explícito. Memoizada por render.
export const carregarAcessosPorCpf = cache(async (cpf) => {
  return prisma.userAcesso.findMany({ where: { userCpf: cpf } });
});

// ── 3. Normalização interna do argumento userOuCpf ─────────────────────────
// Aceita: string CPF | { cpf, acessos? }.
// Resolve SEMPRE para { acessos } — não existe mais perfil de usuário fora dos
// vínculos. `users.role` foi removido do banco: o contexto é só o conjunto de
// vínculos (user_acessos).

async function resolverContexto(userOuCpf) {
  if (userOuCpf == null) return null;

  // String CPF → carrega os vínculos do banco.
  if (typeof userOuCpf === "string") {
    const acessos = await carregarAcessosPorCpf(userOuCpf);
    return { acessos: acessos || [] };
  }

  // Objeto user: usa os vínculos embutidos; senão carrega pelo CPF.
  let acessos = userOuCpf.acessos;
  if (!Array.isArray(acessos)) {
    acessos = userOuCpf.cpf ? await carregarAcessosPorCpf(userOuCpf.cpf) : [];
  }
  return { acessos: acessos || [] };
}

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
 * Permissões efetivas de um vínculo, já resolvidas:
 *   (pacote do perfil ∪ concedidas) − retiradas
 * Perfil desconhecido → [] (fail-closed).
 */
function permissoesDoVinculo(vinculo) {
  if (!vinculo) return [];
  // Vínculo antigo pode estar sem perfil gravado (coluna `nivel` é a legada):
  // nesse caso usa o perfil padrão do módulo, que é o que o sistema sempre
  // aplicou por padrão — e nunca um curinga.
  const perfil = vinculo.perfil || perfilPadraoDoModulo(vinculo.modulo);
  if (!perfil) return [];
  const concedidas = Array.isArray(vinculo.permissoes) ? vinculo.permissoes : [];
  const retiradas = Array.isArray(vinculo.removidas) ? vinculo.removidas : [];
  // Sem NENHUMA permissão gravada → pacote padrão do perfil (perfil em branco
  // não pode significar "nenhum acesso": isso bloquearia o Administrador).
  if (concedidas.length === 0 && retiradas.length === 0) {
    return permissoesPadrao(vinculo.modulo, perfil);
  }
  return permissoesEfetivas(vinculo.modulo, perfil, concedidas, retiradas);
}

// Perfil padrão do módulo (o mesmo que a tela de acessos oferece primeiro).
function perfilPadraoDoModulo(modulo) {
  const padrao = PERFIS_CATALOGO.ADMINISTRADOR;
  return modulo ? padrao : null;
}

/**
 * O vínculo alcança o serviço pedido?
 *   TODOS       → sim (servicos vazio)
 *   ESPECIFICOS → só se o serviço estiver em `servicos`
 *   NENHUM      → não
 * Escopo ausente/desconhecido → false.
 */
function escopoAlcancaServico(vinculo, servico) {
  // Escopo só restringe módulo organizado por serviço. Nos demais o vínculo
  // alcança o módulo por inteiro, qualquer que seja o valor gravado — a coluna
  // continua no banco, mas não é exibida nem usada.
  if (vinculo?.modulo && !moduloTemEscopoPorServico(vinculo.modulo)) return true;

  const escopo = vinculo.escopo;
  const servicos = Array.isArray(vinculo.servicos) ? vinculo.servicos : [];

  if (escopo === "TODOS") return servicos.length === 0;
  if (escopo === "ESPECIFICOS") {
    if (servicos.length === 0) return false; // configuração contraditória
    if (!servico) return true; // pergunta sobre o módulo, não sobre o serviço
    // Ids de serviço são texto no banco: compara como texto dos dois lados.
    const alvo = String(servico);
    return servicos.some((s) => String(s) === alvo);
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

// ── 5. Funções de decisão públicas (async; normalizam o argumento) ──────────

// DEPRECIADA — mantida só até a remoção dos 12 perfis legados.
//
// 'GESTOR' é perfil legado (users.role). Na arquitetura definitiva, Gestão
// Geral é o módulo GESTAO com permissões nominais: use
// `usuarioTemPermissao(..., MODULOS.GESTAO, ...)`.
//
// Durante a migração ela significa "tem o vínculo de Gestão Geral", que é o
// que o perfil legado concedia — e é o que as telas de gerenciamento pedem.
// Não decide NADA por users.role, então a remoção do perfil legado não muda
// a resposta.
/**
 * @deprecated `users.role` foi removido. Equivale a "tem vínculo ativo com o
 * módulo GESTAO" e NÃO autoriza nada: nenhuma guarda ou tela deve usá-la.
 * Use `usuarioTemPermissao(user, MODULOS.GESTAO, funcionalidade, permissao)`.
 * Mantida só como leitura de identificação até a limpeza final.
 */
export async function usuarioEhGestor(userOuCpf) {
  const ctx = await resolverContexto(userOuCpf);
  return (ctx?.acessos || []).some(
    (a) => a.modulo === MODULOS.GESTAO && a.ativo !== false,
  );
}

// Existe vínculo ativo com esse `modulo` (qualquer perfil/serviço).
export async function usuarioTemAcessoModulo(userOuCpf, modulo) {
  const ctx = await resolverContexto(userOuCpf);
  return temAcessoModuloPuro(ctx, modulo);
}

// Existe vínculo ativo ADMINISTRADOR no módulo.
export async function usuarioEhAdminModulo(userOuCpf, modulo) {
  const ctx = await resolverContexto(userOuCpf);
  return ehAdminModuloPuro(ctx, modulo);
}

// O vínculo da Junta alcança o serviço `servicoId` (id em junta_servicos)?
// Escopo TODOS alcança qualquer serviço; ESPECIFICOS só os listados; NENHUM
// nenhum. Aceita id numérico ou o código do sub-serviço (legado) — a
// comparação é sempre por texto.
export async function usuarioTemAcessoServicoJunta(userOuCpf, servicoId) {
  const ctx = await resolverContexto(userOuCpf);
  return temAcessoServicoJuntaPuro(ctx, normalizarServicoId(servicoId));
}

// Id do serviço como texto (a coluna user_acessos.servicos é text[]).
export function normalizarServicoId(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

// Existe vínculo ativo ADMINISTRADOR em qualquer módulo.
export async function usuarioEhAdminDeAlgumModulo(userOuCpf) {
  const ctx = await resolverContexto(userOuCpf);
  return ehAdminDeAlgumModuloPuro(ctx);
}

// Export das funções puras (sem I/O) para teste com `node --test`, se desejado.
export const _puras = {
  temAcessoModuloPuro,
  permissoesEfetivas: permissoesDoVinculo,
  ehAdminModuloPuro,
  temAcessoServicoJuntaPuro,
  ehAdminDeAlgumModuloPuro,
  temPermissaoPura,
  permissoesDoVinculo,
  escopoAlcancaServico,
};

// ── 6. Serviços da Junta: por ID do cadastro (não por nome nem por enum) ────
//
// A fonte oficial dos serviços da Junta é a tabela `junta_servicos`
// (Gerenciamento → Serviços e Especialidades). O vínculo de acesso guarda o
// `id` do serviço em `user_acessos.servicos`, como texto. Consequências:
//   • cadastrar um serviço o torna atribuível sem alteração de código;
//   • renomear o serviço não rompe o vínculo (o id não muda);
//   • inativar o serviço mantém o vínculo e bloqueia atribuição nova.
// Não há mais mapa fixo de nomes: nada aqui depende de "CAEE" ou "APAE".

// Normaliza para comparação robusta a acento/caixa. Usado só para EXIBIR e
// para casar nomes de serviço vindos de telas antigas — nunca para autorizar.
export function normalizarNomeServico(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .trim()
    .toLowerCase();
}

// ── 7. Decisão por funcionalidade e permissão (arquitetura definitiva) ──────
//
// Módulo → Perfil → Serviço → Funcionalidade → Permissão.
// É a ÚNICA porta de autorização fina: as guardas de `lib/auth.js`
// (requirePermissao) chamam esta função.

// Versão pública: resolve o contexto (banco) e devolve a decisão.
// `userOuCpf` pode ser {cpf}, {id} ou a string do cpf.
export async function usuarioTemPermissao(
  userOuCpf,
  modulo,
  funcionalidade,
  permissao,
  servico,
) {
  const ctx = await resolverContexto(userOuCpf);
  return temPermissaoPura(ctx, modulo, funcionalidade, permissao, servico);
}

// Conveniência: aceita a string "funcionalidade:permissao".
export async function usuarioTemPermissaoAlvo(userOuCpf, modulo, alvo, servico) {
  const texto = String(alvo || "");
  const i = texto.indexOf(":");
  if (i <= 0) return false; // formato inválido → nega
  return usuarioTemPermissao(
    userOuCpf,
    modulo,
    texto.slice(0, i),
    texto.slice(i + 1),
    servico,
  );
}

/**
 * Contexto efetivo de acesso — base do /api/me e da Sidebar.
 * Devolve, por módulo, o que o usuário PODE fazer: perfis, escopo, serviços e
 * permissões efetivas (já resolvidas, sem depender do cliente recalcular).
 * Vínculos inativos ou incoerentes ficam fora.
 */
export async function obterContextoEfetivo(userOuCpf) {
  const ctx = await resolverContexto(userOuCpf);
  const porModulo = {};

  for (const vinculo of ctx?.acessos || []) {
    if (vinculo.ativo === false) continue;
    const permissoes = permissoesDoVinculo(vinculo);
    if (permissoes.length === 0) continue; // perfil desconhecido → fora
    const escopoOk =
      vinculo.escopo === "TODOS" ||
      vinculo.escopo === "NENHUM" ||
      (vinculo.escopo === "ESPECIFICOS" &&
        Array.isArray(vinculo.servicos) &&
        vinculo.servicos.length > 0);
    if (!escopoOk) continue; // configuração contraditória → fora

    const atual = porModulo[vinculo.modulo] || {
      modulo: vinculo.modulo,
      perfis: [],
      escopo: vinculo.escopo,
      servicos: [],
      permissoes: [],
    };

    if (!atual.perfis.includes(vinculo.perfil)) atual.perfis.push(vinculo.perfil);
    // Mais de um vínculo no mesmo módulo: união das permissões e escopos.
    if (vinculo.escopo === "TODOS") {
      atual.escopo = "TODOS";
      atual.servicos = [];
    } else if (vinculo.escopo === "ESPECIFICOS" && atual.escopo !== "TODOS") {
      atual.escopo = "ESPECIFICOS";
      atual.servicos = Array.from(
        new Set([...atual.servicos, ...(vinculo.servicos || [])]),
      );
    }
    for (const p of permissoes) {
      if (!atual.permissoes.includes(p)) atual.permissoes.push(p);
    }
    porModulo[vinculo.modulo] = atual;
  }

  return {
    usuario: ctx?.user
      ? { cpf: ctx.user.cpf, nome: ctx.user.nome }
      : null,
    modulos: porModulo,
    // Atalho para consumidores que só precisam da lista.
    permissoes: Object.values(porModulo).flatMap((m) => m.permissoes),
  };
}
