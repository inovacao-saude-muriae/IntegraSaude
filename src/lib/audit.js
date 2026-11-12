// Helper de auditoria. USO SOMENTE NO SERVIDOR (importa next/headers e Prisma).
// Best-effort: nunca lança erro e nunca deve alterar o resultado da ação auditada.
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const AUDIT_ACOES = [
  "CRIAR",
  "EDITAR",
  "EXCLUIR",
  "LOGIN",
  "ENCERRAR",
  "REABRIR",
  "LIBERAR",
  "DISPENSAR",
  "AJUSTAR",
  "DESATIVAR",
  "REATIVAR",
  "SALVAR",
  "UNIFICAR",
  "NEGAR",
  "OUTRO",
];

export const AUDIT_MODULOS = [
  "CCZ",
  "REGULACAO",
  "FARMACIA_JUDICIAL",
  "JUNTA",
  "GERENCIAMENTO",
  "AUTH",
];

// Chaves que NUNCA podem ir para o log (credenciais, arquivos embutidos e
// justificativas/observações livres que podem conter dado pessoal).
const CHAVES_SENSIVEIS =
  /senha|hash|token|secret|foto|base64|imagem|jwt|justificativa|observacao|observação|relato|descricaoLivre/i;
const MAX_DETALHES_BYTES = 2048;
const MAX_STRING_DETALHE = 200;

function truncar(valor, max) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor);
  return texto.length > max ? texto.slice(0, max) : texto;
}

// Copia rasa apenas de primitivos, removendo chaves sensíveis.
function sanitizarDetalhes(detalhes) {
  if (!detalhes || typeof detalhes !== "object" || Array.isArray(detalhes)) {
    return null;
  }
  const saida = {};
  for (const [chave, valor] of Object.entries(detalhes)) {
    if (CHAVES_SENSIVEIS.test(chave)) continue;
    if (valor === null || valor === undefined) continue;
    const tipo = typeof valor;
    if (tipo === "string") {
      saida[chave] = truncar(valor, MAX_STRING_DETALHE);
    } else if (tipo === "number") {
      if (Number.isFinite(valor)) saida[chave] = valor;
    } else if (tipo === "boolean") {
      saida[chave] = valor;
    } else if (tipo === "bigint") {
      saida[chave] = valor.toString();
    }
  }
  if (Object.keys(saida).length === 0) return null;
  const json = JSON.stringify(saida);
  if (Buffer.byteLength(json, "utf8") > MAX_DETALHES_BYTES) return null;
  return saida;
}

// Mesma lógica de getClientIP em src/app/actions/auth.js (lá não é exportável).
async function getClientIPAudit() {
  try {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const realIP = headersList.get("x-real-ip");
    if (forwarded) return forwarded.split(",")[0].trim();
    if (realIP) return realIP;
    return "127.0.0.1";
  } catch {
    return null;
  }
}

async function resolverUsuarioDaSessao() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    select: { user: { select: { cpf: true, nome: true, ativo: true } } },
  });
  const usuario = session?.user;
  if (!usuario || usuario.ativo === false) return null;
  return { cpf: usuario.cpf, nome: usuario.nome };
}

/**
 * Registra uma entrada de auditoria. Chamar SEMPRE após o sucesso da operação.
 * Retorna true se gravou, false caso contrário. Nunca lança.
 */
export async function registrarAuditoria({
  user,
  acao,
  modulo,
  entidade,
  entidadeId,
  descricao,
  detalhes,
  ip,
} = {}) {
  try {
    let usuario = user && user.cpf ? { cpf: user.cpf, nome: user.nome } : null;
    if (!usuario) {
      usuario = await resolverUsuarioDaSessao();
    }
    if (!usuario || !usuario.cpf) return false;

    const ipFinal = ip ? truncar(ip, 60) : truncar(await getClientIPAudit(), 60);

    await prisma.auditLog.create({
      data: {
        userCpf: truncar(usuario.cpf, 11),
        userNome: truncar(usuario.nome || usuario.cpf, 150),
        acao: truncar(acao || "OUTRO", 30),
        modulo: truncar(modulo || "OUTRO", 40),
        entidade: truncar(entidade || "Desconhecida", 60),
        entidadeId: truncar(entidadeId, 100),
        descricao: truncar(descricao, 500),
        detalhes: sanitizarDetalhes(detalhes) ?? undefined,
        ip: ipFinal,
      },
    });
    return true;
  } catch (error) {
    console.error("[audit] Falha ao registrar auditoria:", error?.message || error);
    return false;
  }
}
