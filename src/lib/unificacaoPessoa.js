// Núcleo da atualização de CPF e da unificação de cadastros de Pessoa (EMPI).
//
// Funções puras de servidor que recebem o cliente Prisma (`db`), sem depender
// de cookies/sessão, para poderem ser testadas fora do Next. A autorização
// (requireAcessoPessoas) e a auditoria genérica ficam nas server actions.
//
// Não use "use server" aqui: este arquivo é um utilitário.

import {
  isCpfProvisorio,
  normalizarCpfChave,
  DATA_NASC_PLACEHOLDER,
} from "@/lib/cpf";
import {
  soDigitos,
  validarCpf,
  normalizarPessoa,
  atualizarPessoaTx,
  gravarEnderecoTx,
} from "@/lib/pessoa";

export const MSG_CONFLITO_CPF =
  "Este CPF já está cadastrado para outro registro. Deseja unificar os históricos?";

// Erro interno de controle: aborta a transação e vira `{ success:false, ... }`.
class UnificacaoErro extends Error {
  constructor(payload) {
    super(payload.error || payload.mensagem || "Erro na unificação.");
    this.payload = payload;
  }
}

const NOMES_MODULOS = {
  JUNTA: "Junta Reguladora",
  FARMACIA_JUDICIAL: "Farmácia Judicial",
  CCZ: "CCZ (tutor)",
};

// ── ATUALIZAÇÃO (com troca opcional de CPF provisório → oficial) ───────────
/**
 * Atualiza uma pessoa. O CPF só pode mudar quando o atual é provisório.
 * Se o CPF novo já pertence a outro cadastro ATIVO, NÃO salva nada e devolve
 * `{ success:false, status:"CPF_DUPLICADO_CONFLITO", pessoa_conflito:{cpf,nome} }`
 * (cpf somente dígitos, sem máscara).
 */
export async function atualizarPessoaComCpf(db, cpfOriginal, data) {
  const cpfAtual = normalizarCpfChave(cpfOriginal);

  const atual = await db.pessoa.findUnique({
    where: { cpf: cpfAtual },
    select: { cpf: true, ativo: true },
  });
  if (!atual) return { success: false, error: "Pessoa não encontrada." };
  if (!atual.ativo) {
    return {
      success: false,
      error: "Este cadastro foi unificado em outro e não pode mais ser editado.",
    };
  }

  const cpfNovo = normalizarCpfChave(data?.cpf);

  // Sem mudança de CPF: fluxo de edição normal.
  if (!cpfNovo || cpfNovo === cpfAtual) {
    await db.$transaction(async (tx) => {
      await atualizarPessoaTx(tx, cpfAtual, { ...data, cpf: cpfAtual });
      await gravarEnderecoTx(tx, cpfAtual, data);
    });
    return { success: true, cpf: cpfAtual, cpfAnterior: cpfAtual, trocouCpf: false };
  }

  if (!isCpfProvisorio(cpfAtual)) {
    return { success: false, error: "O CPF de um cadastro oficial não pode ser alterado." };
  }
  if (!validarCpf(cpfNovo)) {
    return { success: false, error: "CPF inválido. Verifique os dígitos informados." };
  }

  const existente = await db.pessoa.findUnique({
    where: { cpf: cpfNovo },
    select: { cpf: true, nomeCompleto: true, ativo: true },
  });
  if (existente) {
    if (!existente.ativo) {
      return {
        success: false,
        error: "Este CPF pertence a um cadastro que já foi unificado e não pode ser reutilizado.",
      };
    }
    return {
      success: false,
      status: "CPF_DUPLICADO_CONFLITO",
      pessoa_conflito: { cpf: existente.cpf, nome: existente.nomeCompleto },
      mensagem: MSG_CONFLITO_CPF,
    };
  }

  const campos = normalizarPessoa({ ...data, cpf: cpfNovo });
  await db.$transaction(async (tx) => {
    // ON UPDATE CASCADE propaga o novo CPF aos dependentes.
    await tx.pessoa.update({ where: { cpf: cpfAtual }, data: campos });
    await gravarEnderecoTx(tx, cpfNovo, data);
  });
  return { success: true, cpf: cpfNovo, cpfAnterior: cpfAtual, trocouCpf: true };
}

// ── UNIFICAÇÃO ─────────────────────────────────────────────────────────────
const paraJson = (valor) =>
  JSON.parse(
    JSON.stringify(valor, (_chave, v) => (typeof v === "bigint" ? v.toString() : v))
  );

const dataIso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const vazioTexto = (v) => v === null || v === undefined || String(v).trim() === "";
const dataVazia = (d) => !d || dataIso(d) === DATA_NASC_PLACEHOLDER;

// Remove campos pesados (foto base64) do snapshot de animais.
const semFoto = (animais) =>
  animais.map(({ fotoUrl, ...resto }) => ({ ...resto, temFoto: Boolean(fotoUrl) }));

/**
 * Unifica `pessoaOrigemCpf` (provisório) em `pessoaAlvoCpf` (oficial), de forma
 * atômica. Nada é apagado: a origem fica inativa com `unificado_em_cpf`.
 *
 * @param db cliente Prisma
 * @param opts { pessoaAlvoCpf, pessoaOrigemCpf, motivo, dadosFormulario, usuarioCpf, hooks }
 *   hooks.aposMoverPedidos (opcional): usado em testes para simular falha no meio.
 * @returns {success:true, alvo, contagens, pedidosMovidos, origemNome}
 *        | {success:false, error} | {success:false, status:"CONFLITO_MODULO", modulos, mensagem}
 */
export async function unificarPessoas(db, opts = {}) {
  const alvoCpf = normalizarCpfChave(opts.pessoaAlvoCpf);
  const origemCpf = normalizarCpfChave(opts.pessoaOrigemCpf);
  const form = opts.dadosFormulario || {};
  const hooks = opts.hooks || {};

  if (!alvoCpf || !origemCpf) {
    return { success: false, error: "Informe os dois cadastros a unificar." };
  }
  if (alvoCpf === origemCpf) {
    return { success: false, error: "Os cadastros de origem e destino devem ser diferentes." };
  }
  if (isCpfProvisorio(alvoCpf)) {
    return { success: false, error: "O cadastro principal precisa ter CPF oficial." };
  }
  if (!isCpfProvisorio(origemCpf)) {
    return {
      success: false,
      error: "Só é possível absorver cadastros com CPF provisório (sem CPF oficial).",
    };
  }

  try {
    return await db.$transaction(
      async (tx) => {
        // Trava as duas linhas contra unificações concorrentes.
        await tx.$queryRaw`SELECT cpf FROM pessoa WHERE cpf IN (${alvoCpf}, ${origemCpf}) ORDER BY cpf FOR UPDATE`;

        const alvo = await tx.pessoa.findUnique({
          where: { cpf: alvoCpf },
          include: { enderecos: { orderBy: { id: "asc" } } },
        });
        const origem = await tx.pessoa.findUnique({
          where: { cpf: origemCpf },
          include: { enderecos: { orderBy: { id: "asc" } } },
        });
        if (!alvo) throw new UnificacaoErro({ success: false, error: "Cadastro principal não encontrado." });
        if (!origem) throw new UnificacaoErro({ success: false, error: "Cadastro a ser absorvido não encontrado." });
        if (!alvo.ativo) throw new UnificacaoErro({ success: false, error: "O cadastro principal está inativo." });
        if (!origem.ativo) throw new UnificacaoErro({ success: false, error: "O cadastro a ser absorvido já foi unificado." });

        // 1. Dependentes (origem) e existência no alvo.
        const pedidos = await tx.pedidoExame.findMany({ where: { pessoaCpf: origemCpf } });
        const pacienteJunta = await tx.pacienteJunta.findUnique({
          where: { pessoaCpf: origemCpf },
          include: { agendamentos: true, atendimentos: true, servicos: true },
        });
        const pacienteFarmacia = await tx.pacienteFarmaciaJudicial.findUnique({
          where: { pessoaCpf: origemCpf },
          include: { tratamentos: true, dispensacoes: true },
        });
        const tutor = await tx.tutor.findUnique({ where: { pessoaCpf: origemCpf } });
        const animais = tutor
          ? await tx.animal.findMany({ where: { pessoaCpf: origemCpf } })
          : [];

        const [alvoJunta, alvoFarmacia, alvoTutor, alvoPedidos] = await Promise.all([
          tx.pacienteJunta.findUnique({ where: { pessoaCpf: alvoCpf }, select: { id: true } }),
          tx.pacienteFarmaciaJudicial.findUnique({ where: { pessoaCpf: alvoCpf }, select: { numeroPasta: true } }),
          tx.tutor.findUnique({ where: { pessoaCpf: alvoCpf }, select: { pessoaCpf: true } }),
          tx.pedidoExame.count({ where: { pessoaCpf: alvoCpf } }),
        ]);

        // 2. Conflito de módulo: ANTES de qualquer escrita.
        const modulos = [];
        if (pacienteJunta && alvoJunta) modulos.push("JUNTA");
        if (pacienteFarmacia && alvoFarmacia) modulos.push("FARMACIA_JUDICIAL");
        if (tutor && alvoTutor) modulos.push("CCZ");
        if (modulos.length) {
          const nomes = modulos.map((m) => NOMES_MODULOS[m]).join(", ");
          throw new UnificacaoErro({
            success: false,
            status: "CONFLITO_MODULO",
            modulos,
            mensagem: `Os dois cadastros possuem registro no(s) módulo(s): ${nomes}. Resolva manualmente antes de unificar.`,
          });
        }

        // 3. Snapshot (antes de mexer em qualquer coisa).
        const snapshot = paraJson({
          alvo,
          origem,
          alvoContagemPedidos: alvoPedidos,
          dependentes: {
            pedidos,
            enderecos: origem.enderecos,
            pacienteJunta,
            pacienteFarmacia,
            tutor,
            animais: semFoto(animais),
          },
          dadosFormulario: {
            nomeCompleto: form.nomeCompleto ?? null,
            dataNascimento: form.dataNascimento ?? null,
            sexo: form.sexo ?? null,
            nomeMae: form.nomeMae ?? null,
            telefone: form.telefone ?? null,
            cns: form.cns ?? null,
            ubsReferenciaId: form.ubsReferenciaId ?? null,
          },
        });

        // 4. Pedidos.
        const movidos = await tx.pedidoExame.updateMany({
          where: { pessoaCpf: origemCpf },
          data: { pessoaCpf: alvoCpf },
        });
        if (hooks.aposMoverPedidos) await hooks.aposMoverPedidos(tx);

        // 5. Endereços (o endereço atual do alvo prevalece).
        const alvoTemAtual = alvo.enderecos.some((e) => e.enderecoAtual);
        await tx.endereco.updateMany({
          where: { pessoaCpf: origemCpf },
          data: alvoTemAtual
            ? { pessoaCpf: alvoCpf, enderecoAtual: false }
            : { pessoaCpf: alvoCpf },
        });

        // 6. Módulos presentes só na origem.
        if (pacienteJunta) {
          await tx.pacienteJunta.update({ where: { pessoaCpf: origemCpf }, data: { pessoaCpf: alvoCpf } });
        }
        if (pacienteFarmacia) {
          await tx.pacienteFarmaciaJudicial.update({ where: { pessoaCpf: origemCpf }, data: { pessoaCpf: alvoCpf } });
        }
        if (tutor) {
          // ON UPDATE CASCADE leva os animais junto.
          await tx.tutor.update({ where: { pessoaCpf: origemCpf }, data: { pessoaCpf: alvoCpf } });
        }

        // 7. Completa SOMENTE campos vazios do alvo. Fonte: formulário (dado
        // mais recente), depois o cadastro absorvido. Nunca sobrescreve o alvo.
        const preencher = {};
        const textoForm = (v) => (vazioTexto(v) ? "" : String(v).trim());

        if (vazioTexto(alvo.nomeMae)) {
          const v = textoForm(form.nomeMae) || textoForm(origem.nomeMae);
          if (v) preencher.nomeMae = v.slice(0, 150);
        }
        if (vazioTexto(alvo.telefone)) {
          const v = soDigitos(form.telefone) || soDigitos(origem.telefone);
          if (v) preencher.telefone = v.slice(0, 20);
        }
        if (dataVazia(alvo.dataNascimento)) {
          const f = /^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento || "") ? form.dataNascimento : "";
          const o = dataVazia(origem.dataNascimento) ? "" : dataIso(origem.dataNascimento);
          const v = f && f !== DATA_NASC_PLACEHOLDER ? f : o;
          if (v) preencher.dataNascimento = new Date(`${v}T00:00:00Z`);
        }
        if (vazioTexto(alvo.sexo)) {
          const v = textoForm(form.sexo) || textoForm(origem.sexo);
          if (v) preencher.sexo = v.slice(0, 20);
        }
        if (vazioTexto(alvo.ubsReferenciaId)) {
          const n = Number(form.ubsReferenciaId);
          const v = Number.isSafeInteger(n) && n > 0 ? n : origem.ubsReferenciaId;
          if (v) preencher.ubsReferenciaId = v;
        }

        // CNS é unique: libera o da origem antes de repassá-lo ao alvo.
        if (origem.cns) {
          await tx.pessoa.update({ where: { cpf: origemCpf }, data: { cns: null } });
        }
        if (vazioTexto(alvo.cns)) {
          const v = soDigitos(form.cns).slice(0, 15) || (origem.cns || "");
          if (v) preencher.cns = v;
        }
        if (Object.keys(preencher).length) {
          await tx.pessoa.update({ where: { cpf: alvoCpf }, data: preencher });
        }

        // 8. Marca a origem (nunca exclui).
        await tx.pessoa.update({
          where: { cpf: origemCpf },
          data: {
            ativo: false,
            unificadoEmCpf: alvoCpf,
            dataUnificacao: new Date(),
            unificadoPorUsuarioId: opts.usuarioCpf || null,
          },
        });

        // 9. Auditoria específica da unificação.
        await tx.auditoriaUnificacao.create({
          data: {
            pessoaPrincipalCpf: alvoCpf,
            pessoasAbsorvidasCpfs: [origemCpf],
            motivo: opts.motivo ? String(opts.motivo).slice(0, 500) : null,
            usuarioId: opts.usuarioCpf || null,
            snapshotAnterior: snapshot,
          },
        });

        // 10. Dados consolidados do alvo.
        const consolidado = await tx.pessoa.findUnique({
          where: { cpf: alvoCpf },
          include: {
            enderecos: { where: { enderecoAtual: true }, take: 1 },
            ubsReferencia: { select: { nome: true } },
          },
        });
        const [qtdPedidos, qtdEnderecos, junta, farmacia, ccz] = await Promise.all([
          tx.pedidoExame.count({ where: { pessoaCpf: alvoCpf } }),
          tx.endereco.count({ where: { pessoaCpf: alvoCpf } }),
          tx.pacienteJunta.count({ where: { pessoaCpf: alvoCpf } }),
          tx.pacienteFarmaciaJudicial.count({ where: { pessoaCpf: alvoCpf } }),
          tx.tutor.count({ where: { pessoaCpf: alvoCpf } }),
        ]);

        return {
          success: true,
          alvo: consolidado,
          origemNome: origem.nomeCompleto,
          pedidosMovidos: movidos.count,
          camposPreenchidos: Object.keys(preencher),
          contagens: {
            pedidos: qtdPedidos,
            enderecos: qtdEnderecos,
            junta: junta > 0,
            farmaciaJudicial: farmacia > 0,
            ccz: ccz > 0,
          },
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );
  } catch (error) {
    if (error instanceof UnificacaoErro) return error.payload;
    if (error?.code === "P2002") {
      return {
        success: false,
        error: "Conflito de dados únicos (ex.: CNS já cadastrado para outra pessoa). Nada foi alterado.",
      };
    }
    throw error;
  }
}
