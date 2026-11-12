// src/app/camara-tecnica/farmacia-judicial/actions.js
"use server";

import {
  requireAdminModulo,
  requireAcessoModulo,
  requireUsuarioAutenticado,
} from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { normalizarCpfChave } from "@/lib/cpf";

// Helper para converter tipos especiais do Prisma (BigInt/Dates) para objetos JS simples
function serializeData(data) {
  return JSON.parse(JSON.stringify(data));
}

// ==========================================
// 1. PACIENTES JUDICIAIS
// ==========================================
export async function getPacientesJudiciais() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT 
        pfj.numero_pasta AS "numeroPasta",
        pfj.numero_processo AS "numeroProcesso",
        pfj.status AS status,
        p.cpf AS cpf,
        p.cns AS cns,
        p.nome_completo AS "patientName",
        p.nome_mae AS "motherName",
        p.telefone AS telefone,
        TO_CHAR(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
        COALESCE(
          (
            SELECT STRING_AGG(CONCAT(m.nome, ' (', m.dosagem, ') - Qtd: ', tp.qtd_prescrita_mensal), '; ')
            FROM public.farmacia_tratamentos_pacientes tp
            JOIN public.farmacia_medicamentos m ON tp.medicamento_id = m.id
            WHERE tp.paciente_pasta = pfj.numero_pasta AND tp.ativo = true
          ),
          'Sem medicamentos cadastrados'
        ) AS "medicamentosTratamento"
      FROM public.farmacia_pacientes pfj
      JOIN public.pessoa p ON pfj.pessoa_cpf = p.cpf
      ORDER BY p.nome_completo ASC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar pacientes judiciais:", error);
    return [];
  }
}

function normalizarStatusPaciente(status) {
  const st = (status || "").toUpperCase();
  if (st === "INATIVO") return "INATIVO";
  if (st === "FALECIDO" || st === "ÓBITO" || st === "OBITO") return "ÓBITO";
  return "ATIVO";
}

export async function createPacienteJudicial(data) {
  // CPF provisório (T + 10 dígitos) também é uma chave válida de pessoa.
  const cleanCpf = normalizarCpfChave(data.cpf);

  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    if (cleanCpf.length !== 11) {
      throw new Error("Selecione uma pessoa válida (CPF com 11 dígitos).");
    }
    if (!data.numeroPasta || !data.numeroProcesso) {
      throw new Error("Informe o número da pasta e do processo.");
    }

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cleanCpf },
      select: { cpf: true, ativo: true },
    });
    if (!pessoa || !pessoa.ativo) {
      throw new Error(
        "Pessoa não encontrada. Cadastre-a primeiro em Gerenciamento > Cadastro de Pessoas."
      );
    }

    const statusDb = normalizarStatusPaciente(data.status);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.farmacia_pacientes (numero_pasta, pessoa_cpf, numero_processo, status)
        VALUES (${data.numeroPasta}, ${cleanCpf}, ${data.numeroProcesso}, ${statusDb})
        ON CONFLICT (numero_pasta) DO UPDATE SET
          pessoa_cpf = EXCLUDED.pessoa_cpf,
          numero_processo = EXCLUDED.numero_processo,
          status = EXCLUDED.status
      `;

      await tx.tratamentoPaciente.deleteMany({
        where: { pacientePasta: data.numeroPasta },
      });

      if (Array.isArray(data.medicamentos) && data.medicamentos.length > 0) {
        for (const med of data.medicamentos) {
          if (med.medicamentoId && med.qtdMensal) {
            const ativo =
              (med.statusMedication || "Ativo").toUpperCase() === "ATIVO";
            await tx.tratamentoPaciente.create({
              data: {
                pacientePasta: data.numeroPasta,
                medicamentoId: Number(med.medicamentoId),
                qtdPrescritaMensal: Number(med.qtdMensal),
                ativo,
              },
            });
          }
        }
      }
    });

    await registrarAuditoria({
      user,
      acao: "SALVAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "PacienteJudicial",
      entidadeId: String(data.numeroPasta),
      descricao: `Paciente judicial da pasta ${data.numeroPasta} salvo`,
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao cadastrar paciente judicial:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 2. ESTOQUE E MEDICAMENTOS
// ==========================================
export async function getMedicamentosEEstoque() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT 
        lm.id AS "loteId",
        m.id AS "medicamentoId",
        m.nome AS "medicamentoNome",
        m.tipo AS tipo,
        m.dosagem AS dosagem,
        lm.numero_lote AS "numeroLote",
        lm.fornecedor AS fornecedor,
        lm.qtd_inicial AS "qtdInicial",
        lm.valor_unitario AS "valorUnitario",
        TO_CHAR(lm.data_entrada, 'YYYY-MM-DD') AS "dataEntrada",
        TO_CHAR(lm.data_validade, 'YYYY-MM-DD') AS "dataValidade",
        (lm.qtd_inicial - COALESCE(SUM(dm.qtd_entregue), 0))::integer AS "qtdAtual"
      FROM public.farmacia_lotes_medicamentos lm
      JOIN public.farmacia_medicamentos m ON lm.medicamento_id = m.id
      LEFT JOIN public.farmacia_dispensacoes_medicamentos dm ON lm.id = dm.lote_medicamento_id
      GROUP BY lm.id, m.id, m.nome, m.tipo, m.dosagem, lm.numero_lote, lm.fornecedor, lm.qtd_inicial, lm.valor_unitario, lm.data_entrada, lm.data_validade
      ORDER BY m.nome ASC, lm.data_validade ASC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar estoque de medicamentos:", error);
    return [];
  }
}

export async function getCatalogoMedicamentos() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT id, nome, tipo, dosagem, ativo 
      FROM public.farmacia_medicamentos 
      WHERE ativo = true 
      ORDER BY nome ASC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar catálogo de medicamentos:", error);
    return [];
  }
}

export async function getCatalogoCompleto() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT id, nome, tipo, dosagem
      FROM public.farmacia_medicamentos
      WHERE ativo = true
      ORDER BY nome ASC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar catálogo completo:", error);
    return [];
  }
}

export async function createMedicamento(data) {
  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    await prisma.$executeRaw`
      INSERT INTO public.farmacia_medicamentos (nome, tipo, dosagem, ativo)
      VALUES (${data.nome}, ${data.tipo}, ${data.dosagem}, true)
    `;
    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "Medicamento",
      descricao: `Medicamento '${data.nome}' cadastrado`,
    });
    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao cadastrar medicamento:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMedicamento(id, data) {
  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    const medId = Number(id);
    if (!Number.isSafeInteger(medId) || medId <= 0) {
      throw new Error("Medicamento inválido.");
    }
    if (!data.nome || !data.tipo || !data.dosagem) {
      throw new Error("Informe o nome, a concentração e o tipo.");
    }

    await prisma.$executeRaw`
      UPDATE public.farmacia_medicamentos
      SET nome = ${data.nome}, tipo = ${data.tipo}, dosagem = ${data.dosagem}
      WHERE id = ${medId}
    `;

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "Medicamento",
      entidadeId: String(medId),
      descricao: `Medicamento '${data.nome}' atualizado`,
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar medicamento:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMedicamento(id) {
  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    const medId = Number(id);
    if (!Number.isSafeInteger(medId) || medId <= 0) {
      throw new Error("Medicamento inválido.");
    }

    await prisma.$executeRaw`
      UPDATE public.farmacia_medicamentos
      SET ativo = false
      WHERE id = ${medId}
    `;

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "Medicamento",
      entidadeId: String(medId),
      descricao: `Medicamento #${medId} desativado`,
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir medicamento:", error);
    return { success: false, error: error.message };
  }
}

export async function createLoteMedicamento(data) {
  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    await prisma.$executeRaw`
      INSERT INTO public.farmacia_lotes_medicamentos 
        (medicamento_id, numero_lote, fornecedor, qtd_inicial, valor_unitario, data_entrada, data_validade)
      VALUES (
        ${Number(data.medicamentoId)}, 
        ${data.numeroLote}, 
        ${data.fornecedor}, 
        ${Number(data.qtdInicial)}, 
        ${data.valorUnitario ? Number(data.valorUnitario) : 0}, 
        ${data.dataEntrada}::date, 
        ${data.dataValidade}::date
      )
    `;
    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "LoteMedicamento",
      descricao: `Entrada do lote '${data.numeroLote}' (medicamento #${Number(data.medicamentoId)})`,
      detalhes: { medicamentoId: Number(data.medicamentoId), qtdInicial: Number(data.qtdInicial) },
    });
    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao dar entrada no lote:", error);
    return { success: false, error: error.message };
  }
}

export async function updateLoteMedicamento(loteId, data) {
  try {
    const user = await requireAdminModulo(MODULOS.FARMACIA);

    const id = Number(loteId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Lote inválido.");
    }
    if (!data.numeroLote || !data.fornecedor) {
      throw new Error("Informe o número do lote e o fornecedor.");
    }
    if (!data.dataEntrada || !data.dataValidade) {
      throw new Error("Informe a data de entrada e a validade.");
    }

    const qtdInicial = Number(data.qtdInicial);
    if (!Number.isSafeInteger(qtdInicial) || qtdInicial < 0) {
      throw new Error("Quantidade inválida.");
    }

    const entregas = await prisma.dispensacaoMedicamento.aggregate({
      where: { loteMedicamentoId: id },
      _sum: { qtdEntregue: true },
    });
    const totalEntregue = entregas._sum.qtdEntregue || 0;
    if (qtdInicial < totalEntregue) {
      throw new Error(
        `A quantidade não pode ser menor que o já dispensado (${totalEntregue}).`
      );
    }

    await prisma.$executeRaw`
      UPDATE public.farmacia_lotes_medicamentos
      SET
        numero_lote = ${data.numeroLote},
        fornecedor = ${data.fornecedor},
        qtd_inicial = ${qtdInicial},
        valor_unitario = ${data.valorUnitario ? Number(data.valorUnitario) : 0},
        data_entrada = ${data.dataEntrada}::date,
        data_validade = ${data.dataValidade}::date
      WHERE id = ${id}
    `;

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "LoteMedicamento",
      entidadeId: String(id),
      descricao: `Lote '${data.numeroLote}' atualizado`,
      detalhes: { qtdInicial },
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar lote:", error);
    return { success: false, error: error.message };
  }
}

export async function getEstoqueAgrupado() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT
        m.id AS "medicamentoId",
        m.nome AS "medicamentoNome",
        m.dosagem AS dosagem,
        m.tipo AS tipo,
        (
          COALESCE(SUM(lm.qtd_inicial - COALESCE(entregas.total_entregue, 0)), 0)
          + COALESCE(
              (
                SELECT SUM(a.delta)
                FROM public.farmacia_ajustes_estoque a
                WHERE a.medicamento_id = m.id
              ),
              0
            )
        )::integer AS "qtdTotal",
        COALESCE(
          (
            SELECT lm2.valor_unitario
            FROM public.farmacia_lotes_medicamentos lm2
            WHERE lm2.medicamento_id = m.id
            ORDER BY lm2.data_entrada DESC, lm2.id DESC
            LIMIT 1
          ),
          0
        ) AS "valorUnitario"
      FROM public.farmacia_medicamentos m
      LEFT JOIN public.farmacia_lotes_medicamentos lm ON lm.medicamento_id = m.id
      LEFT JOIN (
        SELECT lote_medicamento_id, SUM(qtd_entregue) AS total_entregue
        FROM public.farmacia_dispensacoes_medicamentos
        GROUP BY lote_medicamento_id
      ) entregas ON entregas.lote_medicamento_id = lm.id
      WHERE m.ativo = true
      GROUP BY m.id, m.nome, m.dosagem, m.tipo
      ORDER BY m.nome ASC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar estoque agrupado:", error);
    return [];
  }
}

// ==========================================
// 3. AJUSTE DE ESTOQUE (SALDO)
// ==========================================
async function calcularSaldoMedicamento(medicamentoId) {
  const rows = await prisma.$queryRaw`
    SELECT (
      COALESCE(
        (
          SELECT SUM(lm.qtd_inicial - COALESCE(e.total, 0))
          FROM public.farmacia_lotes_medicamentos lm
          LEFT JOIN (
            SELECT lote_medicamento_id, SUM(qtd_entregue) AS total
            FROM public.farmacia_dispensacoes_medicamentos
            GROUP BY lote_medicamento_id
          ) e ON e.lote_medicamento_id = lm.id
          WHERE lm.medicamento_id = ${medicamentoId}
        ),
        0
      )
      + COALESCE(
        (SELECT SUM(delta) FROM public.farmacia_ajustes_estoque WHERE medicamento_id = ${medicamentoId}),
        0
      )
    )::integer AS saldo
  `;
  return Number(rows?.[0]?.saldo || 0);
}

export async function ajustarEstoque(medicamentoId, data) {
  try {
    const session = await requireAdminModulo(MODULOS.FARMACIA);

    const id = Number(medicamentoId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Medicamento inválido.");
    }

    const saldoNovo = Number(data.saldoNovo);
    if (!Number.isSafeInteger(saldoNovo) || saldoNovo < 0) {
      throw new Error("Informe um novo saldo válido (número não negativo).");
    }

    const justificativa = (data.justificativa || "").trim();
    if (!justificativa) {
      throw new Error("Informe a justificativa do ajuste.");
    }

    const saldoAnterior = await calcularSaldoMedicamento(id);
    const delta = saldoNovo - saldoAnterior;

    if (delta === 0) {
      throw new Error("O novo saldo é igual ao saldo atual.");
    }

    const responsavel = session?.nome || null;

    await prisma.ajusteEstoque.create({
      data: {
        medicamentoId: id,
        saldoAnterior,
        saldoNovo,
        delta,
        justificativa,
        responsavel,
      },
    });

    await registrarAuditoria({
      user: session,
      acao: "AJUSTAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "Estoque",
      entidadeId: String(id),
      descricao: `Estoque do medicamento #${id} ajustado`,
      detalhes: { saldoAnterior, saldoNovo, delta },
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true };
  } catch (error) {
    console.error("Erro ao ajustar estoque:", error);
    return { success: false, error: error.message };
  }
}

export async function getAjustesEstoque(medicamentoId) {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const id = Number(medicamentoId);
    if (!Number.isSafeInteger(id) || id <= 0) return [];

    const rows = await prisma.$queryRaw`
      SELECT
        id,
        saldo_anterior AS "saldoAnterior",
        saldo_novo AS "saldoNovo",
        delta,
        justificativa,
        responsavel,
        TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') AS "dataAjuste"
      FROM public.farmacia_ajustes_estoque
      WHERE medicamento_id = ${id}
      ORDER BY created_at DESC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar ajustes de estoque:", error);
    return [];
  }
}

// ==========================================
// 4. DISPENSAÇÃO DE MEDICAMENTOS (FEFO)
// ==========================================
export async function getMedicamentosDoPaciente(numeroPasta) {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    if (!numeroPasta) return [];

    const meds = await prisma.$queryRaw`
      SELECT
        tp.medicamento_id AS "medicamentoId",
        m.nome AS "medicamentoNome",
        m.dosagem AS dosagem,
        m.tipo AS tipo,
        tp.qtd_prescrita_mensal AS "qtdPrescritaMensal",
        tp.ativo AS ativo,
        (
          COALESCE(
            (
              SELECT SUM(lm.qtd_inicial - COALESCE(e.total, 0))
              FROM public.farmacia_lotes_medicamentos lm
              LEFT JOIN (
                SELECT lote_medicamento_id, SUM(qtd_entregue) AS total
                FROM public.farmacia_dispensacoes_medicamentos
                GROUP BY lote_medicamento_id
              ) e ON e.lote_medicamento_id = lm.id
              WHERE lm.medicamento_id = tp.medicamento_id
            ),
            0
          )
          + COALESCE(
            (
              SELECT SUM(a.delta)
              FROM public.farmacia_ajustes_estoque a
              WHERE a.medicamento_id = tp.medicamento_id
            ),
            0
          )
        )::integer AS "saldoTotal"
      FROM public.farmacia_tratamentos_pacientes tp
      JOIN public.farmacia_medicamentos m ON tp.medicamento_id = m.id
      WHERE tp.paciente_pasta = ${numeroPasta} AND tp.ativo = true
      ORDER BY m.nome ASC
    `;

    return serializeData({ medicamentos: meds });
  } catch (error) {
    console.error("Erro ao buscar medicamentos do paciente:", error);
    return { medicamentos: [], lotes: [] };
  }
}

export async function registrarDispensacao(data) {
  try {
    // registrarDispensacao é operação do dia a dia: libera OPERADOR (§10.2).
    const usuario = await requireAcessoModulo(MODULOS.FARMACIA);

    if (!Array.isArray(data?.itens) || data.itens.length === 0) {
      throw new Error("Informe os medicamentos para dispensação.");
    }

    const responsavelEntrega = usuario?.nome || "Operador do Sistema";

    await prisma.$transaction(async (tx) => {
      for (const item of data.itens) {
        const medId = Number(item.medicamentoId);
        const qtdSolicitada = Number(item.qtdEntregue);

        if (!medId || qtdSolicitada <= 0) {
          throw new Error("Medicamento ou quantidade inválida.");
        }

        // Lotes com saldo, em ordem FEFO (validade mais próxima primeiro).
        // Obs.: PostgreSQL não permite FOR UPDATE com GROUP BY; por isso o saldo
        // é calculado por subquery (sem agregação na query principal).
        const lotes = await tx.$queryRaw`
          SELECT
            lm.id,
            (
              lm.qtd_inicial - COALESCE(
                (
                  SELECT SUM(dm.qtd_entregue)
                  FROM public.farmacia_dispensacoes_medicamentos dm
                  WHERE dm.lote_medicamento_id = lm.id
                ),
                0
              )
            ) AS saldo_disponivel
          FROM public.farmacia_lotes_medicamentos lm
          WHERE lm.medicamento_id = ${medId}
            AND lm.data_validade >= CURRENT_DATE
            AND (
              lm.qtd_inicial - COALESCE(
                (
                  SELECT SUM(dm.qtd_entregue)
                  FROM public.farmacia_dispensacoes_medicamentos dm
                  WHERE dm.lote_medicamento_id = lm.id
                ),
                0
              )
            ) > 0
          ORDER BY lm.data_validade ASC, lm.id ASC
          FOR UPDATE
        `;

        let restante = qtdSolicitada;

        for (const lote of lotes) {
          if (restante <= 0) break;

          const saldoLote = Number(lote.saldo_disponivel);
          const qtdAEntregar = Math.min(restante, saldoLote);

          await tx.dispensacaoMedicamento.create({
            data: {
              pacientePasta: data.numeroPasta,
              loteMedicamentoId: lote.id,
              qtdEntregue: qtdAEntregar,
              dataDispensacao: new Date(),
              observacao: `Entregue por: ${responsavelEntrega} | Obs: ${data.observacao || 'S/N'}`
            }
          });

          restante -= qtdAEntregar;
        }

        if (restante > 0) {
          throw new Error(`Estoque insuficiente para o medicamento solicitado.`);
        }
      }
    });

    await registrarAuditoria({
      user: usuario,
      acao: "DISPENSAR",
      modulo: "FARMACIA_JUDICIAL",
      entidade: "Dispensacao",
      entidadeId: data.numeroPasta ? String(data.numeroPasta) : undefined,
      descricao: `Dispensação registrada (pasta ${data.numeroPasta ?? "-"})`,
      detalhes: { itens: data.itens.length },
    });

    revalidatePath("/camara-tecnica/farmacia-judicial");
    return { success: true, responsavelEntrega };
  } catch (error) {
    console.error("Erro na transação de dispensação:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 5. RELATÓRIOS
// ==========================================
export async function getRelatorioEntradas() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT 
        lm.id AS "loteId",
        m.nome AS "medicamentoNome",
        m.dosagem AS dosagem,
        m.tipo AS tipo,
        lm.numero_lote AS "numeroLote",
        lm.fornecedor AS fornecedor,
        lm.qtd_inicial AS quantidade,
        lm.valor_unitario AS "valorUnitario",
        (lm.qtd_inicial * lm.valor_unitario) AS "valorTotal",
        TO_CHAR(lm.data_entrada, 'DD/MM/YYYY') AS "dataEntrada",
        TO_CHAR(lm.data_validade, 'DD/MM/YYYY') AS "dataValidade"
      FROM public.farmacia_lotes_medicamentos lm
      JOIN public.farmacia_medicamentos m ON lm.medicamento_id = m.id
      ORDER BY lm.data_entrada DESC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar relatório de entradas:", error);
    return [];
  }
}

export async function getRelatorioSaidas() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT 
        dm.id AS "dispensacaoId",
        pfj.numero_pasta AS "numeroPasta",
        p.nome_completo AS "pacienteNome",
        p.cpf AS cpf,
        m.nome AS "medicamentoNome",
        m.dosagem AS dosagem,
        lm.numero_lote AS "numeroLote",
        dm.qtd_entregue AS quantidade,
        TO_CHAR(dm.data_dispensacao, 'DD/MM/YYYY HH24:MI') AS "dataDispensacao",
        dm.observacao AS observacao
      FROM public.farmacia_dispensacoes_medicamentos dm
      JOIN public.farmacia_pacientes pfj ON dm.paciente_pasta = pfj.numero_pasta
      JOIN public.pessoa p ON pfj.pessoa_cpf = p.cpf
      JOIN public.farmacia_lotes_medicamentos lm ON dm.lote_medicamento_id = lm.id
      JOIN public.farmacia_medicamentos m ON lm.medicamento_id = m.id
      ORDER BY dm.data_dispensacao DESC
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar relatório de saídas:", error);
    return [];
  }
}

export async function getRelatorioSaidaPorMedicamento() {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const rows = await prisma.$queryRaw`
      SELECT
        m.id AS "medicamentoId",
        m.nome AS "medicamentoNome",
        m.dosagem AS dosagem,
        m.tipo AS tipo,
        COALESCE(SUM(dm.qtd_entregue), 0)::integer AS "totalSaida",
        COUNT(DISTINCT DATE_TRUNC('month', dm.data_dispensacao))::integer AS "mesesComSaida",
        MIN(TO_CHAR(dm.data_dispensacao, 'DD/MM/YYYY')) AS "primeiraSaida",
        MAX(TO_CHAR(dm.data_dispensacao, 'DD/MM/YYYY')) AS "ultimaSaida"
      FROM public.farmacia_medicamentos m
      JOIN public.farmacia_lotes_medicamentos lm ON lm.medicamento_id = m.id
      JOIN public.farmacia_dispensacoes_medicamentos dm ON dm.lote_medicamento_id = lm.id
      GROUP BY m.id, m.nome, m.dosagem, m.tipo
      HAVING SUM(dm.qtd_entregue) > 0
      ORDER BY "totalSaida" DESC, m.nome ASC
    `;

    return serializeData(rows).map((r) => {
      const meses = Number(r.mesesComSaida) || 1;
      const total = Number(r.totalSaida) || 0;
      return {
        ...r,
        mediaMensal: Math.round((total / meses) * 100) / 100,
      };
    });
  } catch (error) {
    console.error("Erro ao buscar saída por medicamento:", error);
    return [];
  }
}

// ==========================================
// 6. DASHBOARD
// ==========================================
// FILTRO DE ANO (parâmetro opcional `ano`):
//   • number (ex.: 2026) → filtra aquele ano;
//   • "todos" ou null    → sem filtro de data;
//   • undefined          → sem filtro (comportamento anterior; outras telas
//                          que chamam sem parâmetro não mudam).
// Janela em UTC [1º jan, 1º jan do ano seguinte), igual ao CCZ.
//
// REGRA DE DATA DE CADA INDICADOR:
//   • Catálogo de Medicamentos (ativos) → POSIÇÃO ATUAL (não filtra por ano)
//   • Estoque Físico Total (saldo dos lotes) → POSIÇÃO ATUAL (não filtra)
//   • Pacientes (ativos/inativos/óbito/base) → PacienteFarmaciaJudicial.createdAt
//     (pacientes cadastrados no ano, separados pelo status atual)
//   • Entradas de lotes (unidades e nº de lotes) → LoteMedicamento.dataEntrada
//   • Dispensações (unidades e nº de registros) → DispensacaoMedicamento.dataDispensacao
export async function getDashboardMetrics(ano) {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);
    const filtrar = !(ano === undefined || ano === null || ano === "todos");
    const y = filtrar ? Number(ano) || new Date().getFullYear() : null;
    // timestamptz (created_at, data_dispensacao)
    const tsIni = y === null ? null : new Date(Date.UTC(y, 0, 1));
    const tsFim = y === null ? null : new Date(Date.UTC(y + 1, 0, 1));
    // date (data_entrada)
    const dIni = y === null ? null : `${y}-01-01`;
    const dFim = y === null ? null : `${y + 1}-01-01`;

    const resMedsCat = await prisma.$queryRaw`
      SELECT COUNT(*)::integer AS total FROM public.farmacia_medicamentos WHERE ativo = true
    `;

    const resEntradas = await prisma.$queryRaw`
      SELECT COUNT(*)::integer AS lotes, COALESCE(SUM(qtd_inicial), 0)::integer AS unidades
      FROM public.farmacia_lotes_medicamentos
      WHERE (${dIni}::date IS NULL OR (data_entrada >= ${dIni}::date AND data_entrada < ${dFim}::date))
    `;

    const resDispensacoes = await prisma.$queryRaw`
      SELECT COUNT(*)::integer AS registros, COALESCE(SUM(qtd_entregue), 0)::integer AS unidades
      FROM public.farmacia_dispensacoes_medicamentos
      WHERE (${tsIni}::timestamptz IS NULL
             OR (data_dispensacao >= ${tsIni}::timestamptz AND data_dispensacao < ${tsFim}::timestamptz))
    `;

    const resEstoque = await prisma.$queryRaw`
      SELECT COALESCE(SUM(lm.qtd_inicial - COALESCE(sub.total_entregue, 0)), 0)::integer AS total
      FROM public.farmacia_lotes_medicamentos lm
      LEFT JOIN (
        SELECT lote_medicamento_id, SUM(qtd_entregue) AS total_entregue
        FROM public.farmacia_dispensacoes_medicamentos
        GROUP BY lote_medicamento_id
      ) sub ON lm.id = sub.lote_medicamento_id
    `;

    const resPacientes = await prisma.$queryRaw`
      SELECT status, COUNT(*)::integer AS total
      FROM public.farmacia_pacientes
      WHERE (${tsIni}::timestamptz IS NULL
             OR (created_at >= ${tsIni}::timestamptz AND created_at < ${tsFim}::timestamptz))
      GROUP BY status
    `;

    let ativos = 0;
    let inativos = 0;
    let obitos = 0;

    const formattedPacientes = serializeData(resPacientes);
    formattedPacientes.forEach((row) => {
      const st = (row.status || "").toUpperCase();
      if (st === "ATIVO") ativos += Number(row.total);
      else if (st === "INATIVO") inativos += Number(row.total);
      else if (st === "ÓBITO" || st === "OBITO") obitos += Number(row.total);
      else ativos += Number(row.total);
    });

    const catObj = serializeData(resMedsCat);
    const estObj = serializeData(resEstoque);

    return {
      totalMedicamentosCadastrados: Number(catObj[0]?.total || 0),
      totalEstoqueUnidades: Number(estObj[0]?.total || 0),
      pacientesAtivos: ativos,
      pacientesInativos: inativos,
      pacientesObito: obitos,
      entradasLotes: Number(serializeData(resEntradas)[0]?.lotes || 0),
      entradasUnidades: Number(serializeData(resEntradas)[0]?.unidades || 0),
      dispensacoesRegistros: Number(serializeData(resDispensacoes)[0]?.registros || 0),
      dispensacoesUnidades: Number(serializeData(resDispensacoes)[0]?.unidades || 0),
    };
  } catch (error) {
    console.error("Erro ao buscar métricas do dashboard:", error);
    return {
      totalMedicamentosCadastrados: 0,
      totalEstoqueUnidades: 0,
      pacientesAtivos: 0,
      pacientesInativos: 0,
      pacientesObito: 0,
      entradasLotes: 0,
      entradasUnidades: 0,
      dispensacoesRegistros: 0,
      dispensacoesUnidades: 0,
    };
  }
}
// src/app/camara-tecnica/farmacia-judicial/actions.js

// ... (todas as outras funções que você já tem no arquivo) ...

// ==========================================
// 7. BUSCA DE PESSOA NO BANCO (PESSOAS)
// ==========================================
export async function buscarPessoaExistente(termo) {
  // Cadastro único (EMPI): busca aberta a qualquer usuário logado, nunca anônima.
  await requireUsuarioAutenticado();
  try {
    const searchTerm = `%${(termo || "").trim()}%`;
    const rows = await prisma.$queryRaw`
      SELECT 
        p.cpf AS cpf,
        p.cns AS cns,
        p.nome_completo AS "nomeCompleto",
        p.sexo AS sexo,
        TO_CHAR(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
        p.nome_mae AS "nomeMae",
        p.telefone AS telefone,
        u.nome AS "ubsReferencia",
        e.logradouro AS logradouro,
        e.numero AS numero,
        e.complemento AS complemento,
        e.bairro AS bairro,
        e.cidade AS cidade,
        e.uf AS uf,
        e.cep AS cep
      FROM public.pessoa p
      LEFT JOIN public.pessoa_endereco e ON p.cpf = e.pessoa_cpf AND e.endereco_atual = true
      LEFT JOIN public.regula_ubs u ON p.ubs_referencia_id = u.id
      WHERE p.cpf ILIKE ${searchTerm} 
         OR p.nome_completo ILIKE ${searchTerm}
      LIMIT 10
    `;
    return serializeData(rows);
  } catch (error) {
    console.error("Erro ao buscar pessoa existente:", error);
    return [];
  }
}