'use server';

import { getPrismaClient } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Registra uma alteração no histórico de auditoria de um pedido
 */
export async function registrarHistoricoPedido({
  pedidoId,
  acao,
  campoAlterado = null,
  valorAnterior = null,
  valorNovo = null,
  observacao = null,
}) {
  const prisma = await getPrismaClient();
  
  try {
    const session = await requireAuth();
    const usuario = session.user;

    await prisma.pedidoExameHistorico.create({
      data: {
        pedidoId: parseInt(pedidoId),
        usuarioCpf: usuario.cpf,
        usuarioNome: usuario.nome,
        acao,
        campoAlterado,
        valorAnterior: valorAnterior?.toString() || null,
        valorNovo: valorNovo?.toString() || null,
        observacao,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao registrar histórico:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca o histórico de alterações de um pedido específico
 */
export async function buscarHistoricoPedido(pedidoId) {
  const prisma = await getPrismaClient();
  
  try {
    await requireAuth();

    const historico = await prisma.pedidoExameHistorico.findMany({
      where: {
        pedidoId: parseInt(pedidoId),
      },
      orderBy: {
        dataHora: 'desc',
      },
    });

    return historico.map((h) => ({
      id: h.id,
      usuarioCpf: h.usuarioCpf,
      usuarioNome: h.usuarioNome,
      acao: h.acao,
      campoAlterado: h.campoAlterado,
      valorAnterior: h.valorAnterior,
      valorNovo: h.valorNovo,
      observacao: h.observacao,
      dataHora: h.dataHora.toISOString(),
    }));
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }
}

/**
 * Helper para registrar alteração de campo específico
 */
export async function registrarAlteracaoCampo(pedidoId, campo, valorAnterior, valorNovo, usuario) {
  if (valorAnterior === valorNovo) return;

  const rotulosCampos = {
    status: 'Status do Pedido',
    classificacaoRisco: 'Classificação de Risco',
    tipoCota: 'Tipo de Cota',
    statusComunicacao: 'Status de Comunicação',
    dataComunicacao: 'Data de Comunicação',
    dataLiberacao: 'Data de Liberação',
    medicoResponsavelId: 'Médico Responsável',
    motivoLiberacao: 'Motivo de Liberação',
    observacao: 'Observações',
    competenciaCota: 'Competência da Cota',
  };

  await registrarHistoricoPedido({
    pedidoId,
    acao: 'ALTERACAO',
    campoAlterado: rotulosCampos[campo] || campo,
    valorAnterior,
    valorNovo,
  });
}
