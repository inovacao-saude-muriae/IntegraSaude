import "server-only";
import { prisma } from "@/lib/prisma";
import {
  MODULOS_CATALOGO,
  PERFIS,
  ESCOPOS,
  permissoesPadrao,
  validarConfiguracao,
} from "@/lib/permissoesCatalogo";
import { obterContextoEfetivo } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════════════════
// SERVIÇO DE ACESSO — grava e lê a configuração de um usuário por módulo
// ─────────────────────────────────────────────────────────────────────────
// Fonte única da escrita. A tela de gerenciamento manda o que quer, e este
// serviço: valida contra o catálogo, aplica as regras de poder (ninguém concede
// o que não tem), grava em transação, audita e devolve o que FICOU NO BANCO.
//
// Modelo do vínculo (user_acessos):
//   perfil     → pacote de permissões do módulo
//   escopo     → TODOS | ESPECIFICOS | NENHUM (+ `servicos` quando ESPECIFICOS)
//   permissoes → concessões ADICIONAIS fora do pacote
//   removidas  → permissões RETIRADAS do pacote
//   ativo      → vínculo ligado/desligado
// ═══════════════════════════════════════════════════════════════════════════

export class AcessoErro extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AcessoErro";
    this.status = status;
  }
}

// Perfil legado equivalente a cada perfil novo (o enum `NivelAcesso` é
// obrigatório no banco). Só mapeamento de compatibilidade — nada decide
// acesso por ele.
const NIVEL_DO_PERFIL = {
  [PERFIS.ADMINISTRADOR]: "ADMIN",
};

// Linha pronta para gravar, a partir da entrada validada.
function montarVinculo(entrada) {
  return {
    modulo: entrada.modulo,
    perfil: entrada.perfil,
    nivel: NIVEL_DO_PERFIL[entrada.perfil] || "OPERADOR",
    escopo: entrada.escopo,
    servicos: entrada.escopo === ESCOPOS.ESPECIFICOS ? entrada.servicos : [],
    permissoes: entrada.permissoes,
    removidas: entrada.removidas,
    ativo: entrada.ativo !== false,
    // servico_junta não é mais usado para decidir (o escopo substituiu), mas a
    // coluna é parte da chave única; fica nula nos vínculos novos.
    servicoJunta: null,
  };
}

/**
 * Valida e normaliza UMA configuração de módulo.
 * Devolve a entrada pronta para gravar ou lança AcessoErro.
 */
export function validarVinculo(entrada) {
  if (!entrada || typeof entrada !== "object") {
    throw new AcessoErro("Configuração de módulo ausente.");
  }
  const modulo = String(entrada.modulo || "");
  const cat = MODULOS_CATALOGO[modulo];
  if (!cat) throw new AcessoErro(`Módulo desconhecido: ${modulo || "(vazio)"}`);

  const perfil = String(entrada.perfil || "");
  const escopo = String(entrada.escopo || "");
  const servicos = Array.isArray(entrada.servicos) ? [...new Set(entrada.servicos)] : [];
  const permissoes = Array.isArray(entrada.permissoes) ? [...new Set(entrada.permissoes)] : [];
  const removidas = Array.isArray(entrada.removidas) ? [...new Set(entrada.removidas)] : [];

  const { ok, erros } = validarConfiguracao({
    modulo,
    perfil,
    escopo,
    servicos,
    permissoes,
    removidas,
  });
  if (!ok) {
    throw new AcessoErro(`Configuração inválida em ${cat.nome}: ${erros.join(" ")}`);
  }

  return {
    modulo,
    perfil,
    escopo,
    servicos: escopo === ESCOPOS.ESPECIFICOS ? servicos : [],
    permissoes,
    removidas,
    ativo: entrada.ativo !== false,
  };
}

/**
 * Poder de concessão: o administrador só pode atribuir o que ele mesmo possui.
 * Compara as permissões EFETIVAS pretendidas com as do executor, no mesmo
 * módulo. Gestão Geral não é exceção: ela também só concede o que tem.
 */
export function exigirPoderDeConcessao(efetivoDoExecutor, entrada) {
  const moduloDoExecutor = (efetivoDoExecutor?.modulos || {})[entrada.modulo];
  if (!moduloDoExecutor) {
    throw new AcessoErro(
      `Você não tem acesso ao módulo ${MODULOS_CATALOGO[entrada.modulo]?.nome || entrada.modulo} e não pode concedê-lo.`,
      403,
    );
  }
  const possui = new Set(moduloDoExecutor.permissoes);

  // O que a configuração pretende conceder, sem contar o que foi retirado.
  const pretendidas = new Set([
    ...permissoesPadrao(entrada.modulo, entrada.perfil),
    ...entrada.permissoes,
  ]);
  for (const item of entrada.removidas) pretendidas.delete(item);

  const faltando = [...pretendidas].filter((p) => !possui.has(p));
  if (faltando.length > 0) {
    throw new AcessoErro(
      `Você não pode conceder permissões que não possui: ${faltando.join(", ")}.`,
      403,
    );
  }
  return true;
}

/**
 * Grava a configuração completa de acesso de um usuário.
 *
 * @param {object} p
 * @param {string} p.cpf            usuário alvo
 * @param {Array}  p.vinculos       lista de {modulo, perfil, escopo, servicos, permissoes, removidas, ativo}
 * @param {object} p.executor       usuário que está gravando (com perfil GESTAO)
 * @param {string} [p.motivo]       motivo opcional registrado na auditoria
 *
 * Regras:
 *  • módulo que NÃO vem na lista = sem vínculo (é removido) — a tela sempre
 *    envia o estado final desejado;
 *  • autoelevação: o executor não pode aumentar o próprio poder;
 *  • tudo em transação + auditoria por vínculo alterado.
 *
 * Devolve { vinculos: [...] } com o estado persistido (relido do banco).
 */
export async function salvarAcessosUsuario({ cpf, vinculos, executor, motivo }) {
  const cpfLimpo = String(cpf || "").replace(/\D/g, "");
  if (cpfLimpo.length !== 11) throw new AcessoErro("CPF inválido.", 400);

  const usuario = await prisma.user.findUnique({
    where: { cpf: cpfLimpo },
    select: { cpf: true, nome: true, ativo: true },
  });
  if (!usuario) throw new AcessoErro("Usuário não encontrado.", 404);

  // 1. Valida cada módulo enviado.
  const desejados = (vinculos || []).map(validarVinculo);
  const modulosVistos = new Set();
  for (const v of desejados) {
    if (modulosVistos.has(v.modulo)) {
      throw new AcessoErro(`Módulo repetido na configuração: ${v.modulo}.`);
    }
    modulosVistos.add(v.modulo);
  }

  // 2. Poder de concessão do executor.
  const efetivoExecutor = await obterContextoEfetivo({ cpf: executor.cpf });
  for (const v of desejados) exigirPoderDeConcessao(efetivoExecutor, v);

  // 3. Autoelevação: quem grava não pode ficar com mais poder do que já tem.
  const ehProprioUsuario = cpfLimpo === String(executor.cpf).replace(/\D/g, "");
  const efetivasAntes = ehProprioUsuario ? efetivoExecutor : null;
  if (ehProprioUsuario) {
    for (const v of desejados) {
      const antes = (efetivasAntes.modulos || {})[v.modulo];
      const depois = new Set([
        ...permissoesPadrao(v.modulo, v.perfil),
        ...v.permissoes,
      ]);
      for (const item of v.removidas) depois.delete(item);
      const novas = [...depois].filter((p) => !(antes?.permissoes || []).includes(p));
      if (novas.length > 0) {
        throw new AcessoErro(
          `Você não pode aumentar o seu próprio acesso (${novas.join(", ")}). Peça a outro administrador.`,
          403,
        );
      }
    }
  }

  // 4. Estado anterior, para a auditoria dizer o que mudou.
  const anteriores = await prisma.userAcesso.findMany({
    where: { userCpf: cpfLimpo },
    select: {
      id: true,
      modulo: true,
      nivel: true,
      perfil: true,
      escopo: true,
      servicos: true,
      permissoes: true,
      removidas: true,
      ativo: true,
    },
  });
  const mapaAnterior = new Map(anteriores.map((a) => [a.modulo, a]));

  const resumo = (v) =>
    v
      ? `${v.perfil} · ${v.escopo}${v.servicos?.length ? ` (${v.servicos.join(",")})` : ""}${
          v.ativo === false ? " · INATIVO" : ""
        }${v.permissoes?.length ? ` · +${v.permissoes.length}` : ""}${
          v.removidas?.length ? ` · −${v.removidas.length}` : ""
        }`
      : "(sem vínculo)";

  // Módulos que continuam existindo depois da gravação (para a auditoria de
  // vínculos removidos — declarado fora da transação, que só grava).
  const manter = new Set(desejados.map((v) => v.modulo));

  // 5. Gravação.
  await prisma.$transaction(async (tx) => {
    // Remove vínculos de módulos que saíram da configuração. A chave única é
    // (user_cpf, modulo, nivel, servico_junta) — por isso apaga pela chave
    // primária, que não depende dos outros campos.
    for (const antigo of anteriores) {
      if (!manter.has(antigo.modulo)) {
        await tx.userAcesso.delete({ where: { id: antigo.id } });
      }
    }

    for (const v of desejados) {
      const dado = montarVinculo(v);
      const existente = mapaAnterior.get(v.modulo);
      if (existente) {
        await tx.userAcesso.update({
          where: { id: existente.id },
          data: {
            perfil: dado.perfil,
            nivel: dado.nivel,
            escopo: dado.escopo,
            servicos: dado.servicos,
            permissoes: dado.permissoes,
            removidas: dado.removidas,
            ativo: dado.ativo,
            atualizadoPor: executor.cpf,
            atualizadoEm: new Date(),
          },
        });
      } else {
        await tx.userAcesso.create({
          data: {
            userCpf: cpfLimpo,
            ...dado,
            atualizadoPor: executor.cpf,
            atualizadoEm: new Date(),
          },
        });
      }
    }
  });

  // 6. Auditoria (uma entrada por módulo que mudou).
  const { registrarAuditoria } = await import("@/lib/audit");
  for (const v of desejados) {
    const antes = mapaAnterior.get(v.modulo);
    const mudou =
      !antes ||
      antes.perfil !== v.perfil ||
      antes.escopo !== v.escopo ||
      antes.ativo !== (v.ativo !== false) ||
      [...(antes.servicos || [])].sort().join(",") !== [...v.servicos].sort().join(",") ||
      [...(antes.permissoes || [])].sort().join(",") !== [...v.permissoes].sort().join(",") ||
      [...(antes.removidas || [])].sort().join(",") !== [...v.removidas].sort().join(",");
    if (!mudou) continue;
    await registrarAuditoria({
      user: executor,
      acao: antes ? "EDITAR" : "CRIAR",
      modulo: "GESTAO",
      entidade: "UserAcesso",
      entidadeId: `${cpfLimpo}:${v.modulo}`,
      descricao: `Acesso de '${usuario.nome}' em ${v.modulo}: ${resumo(antes)} → ${resumo(v)}`,
      detalhes: {
        alvo: cpfLimpo,
        modulo: v.modulo,
        antes: resumo(antes),
        depois: resumo(v),
        motivo: motivo || null,
      },
    });
  }
  for (const antigo of anteriores) {
    if (manter.has(antigo.modulo)) continue;
    await registrarAuditoria({
      user: executor,
      acao: "DESATIVAR",
      modulo: "GESTAO",
      entidade: "UserAcesso",
      entidadeId: `${cpfLimpo}:${antigo.modulo}`,
      descricao: `Vínculo de '${usuario.nome}' com ${antigo.modulo} removido (${resumo(antigo)})`,
      detalhes: { alvo: cpfLimpo, modulo: antigo.modulo, antes: resumo(antigo) },
    });
  }

  // 7. Devolve o que FICOU no banco — a tela não mostra estado local.
  return listarAcessosUsuario(cpfLimpo);
}

/**
 * Lê do banco a configuração de acesso de um usuário, pronta para a tela:
 * cada vínculo com perfil, escopo, serviços, concessões, retiradas e as
 * permissões EFETIVAS já calculadas.
 */
export async function listarAcessosUsuario(cpf) {
  const cpfLimpo = String(cpf || "").replace(/\D/g, "");
  const [usuario, vinculos] = await Promise.all([
    prisma.user.findUnique({
      where: { cpf: cpfLimpo },
      select: {
        cpf: true,
        nome: true,
        cargo: true,
        ativo: true,
        primeiroAcesso: true,
        ultimoAcesso: true,
        createdAt: true,
      },
    }),
    prisma.userAcesso.findMany({
      where: { userCpf: cpfLimpo },
      orderBy: { modulo: "asc" },
      select: {
        id: true,
        modulo: true,
        perfil: true,
        escopo: true,
        servicos: true,
        permissoes: true,
        removidas: true,
        ativo: true,
        atualizadoPor: true,
        atualizadoEm: true,
      },
    }),
  ]);
  if (!usuario) throw new AcessoErro("Usuário não encontrado.", 404);

  const { detalharPermissoes } = await import("@/lib/permissoesCatalogo");
  const efetivo = await obterContextoEfetivo({ cpf: cpfLimpo });

  return {
    usuario,
    vinculos: vinculos.map((v) => {
      const detalhe = detalharPermissoes(v.modulo, v.perfil, v.permissoes, v.removidas);
      return {
        ...v,
        efetivas: detalhe.efetivas,
        herdadas: detalhe.herdadas,
        totalPacote: detalhe.pacote.length,
      };
    }),
    modulosEfetivos: efetivo.modulos,
  };
}
