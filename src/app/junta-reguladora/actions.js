'use server';

import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { normalizarCpfChave } from '@/lib/cpf';
import {
  requireAcessoModulo,
  requireAdminModulo,
  requireLeituraServicoJuntaPorNome,
  requireEscritaServicoJuntaPorNome,
} from '@/lib/auth';
import {
  MODULOS,
  NIVEIS,
  usuarioEhAdminModulo,
  SERVICO_JUNTA_PARA_NOME,
} from '@/lib/permissions';

// Helper para converter BigInt e Objetos Date sem erro de serialização no Next.js
function serializeData(data) {
  return JSON.parse(JSON.stringify(data));
}

/* ── 1. BUSCA DE PESSOAS NO BANCO (SEM DUPLICAÇÃO DE DADOS) ── */
export async function buscarPessoaExistente(termo) {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);
    const termoClean = String(termo || '').trim();
    const apenasNumeros = termoClean.replace(/\D/g, '');

    // Termo vazio/curto: lista os primeiros registros (para o dropdown já
    // aparecer ao focar o campo, como na Farmácia Judicial).
    // Cadastros absorvidos por unificação (ativo=false) ficam fora da busca.
    const where =
      termoClean.length === 0
        ? { ativo: true }
        : {
            ativo: true,
            OR: [
              { nomeCompleto: { contains: termoClean, mode: 'insensitive' } },
              ...(apenasNumeros.length > 0 ? [{ cpf: { contains: apenasNumeros } }] : []),
            ],
          };

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: { nomeCompleto: 'asc' },
      include: {
        enderecos: {
          where: { enderecoAtual: true },
          take: 1,
        },
        ubsReferencia: true,
        pacienteJunta: {
          include: {
            servicos: { include: { servico: true } },
          },
        },
      },
      take: 10,
    });

    // Formata a data de nascimento como YYYY-MM-DD (string), para a UI exibir dd/mm/aaaa.
    const toYMD = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toISOString().split('T')[0];
    };

    return pessoas.map((p) => {
      const enderecoAtual = p.enderecos?.[0] || {};
      const servicosAtivos = (p.pacienteJunta?.servicos || [])
        .filter((v) => v.ativo !== false && v.servico)
        .map((v) => v.servico.nome);
      return {
        cpf: p.cpf,
        cns: p.cns || '',
        nomeCompleto: p.nomeCompleto,
        nome: p.nomeCompleto,
        sexo: p.sexo || 'Masculino',
        dataNascimento: toYMD(p.dataNascimento),
        nomeMae: p.nomeMae,
        telefone: p.telefone,
        ubsReferencia: p.ubsReferencia?.nome || '',
        logradouro: enderecoAtual.logradouro || '',
        numero: enderecoAtual.numero || '',
        complemento: enderecoAtual.complemento || '',
        bairro: enderecoAtual.bairro || '',
        cidade: enderecoAtual.cidade || 'Muriaé',
        uf: enderecoAtual.uf || 'MG',
        cep: enderecoAtual.cep || '',
        tipoDeficiencia: p.pacienteJunta?.tipoDeficiencia || '',
        servicosAtivos,
      };
    });
  } catch (error) {
    console.error('Erro ao buscar pessoas no banco:', error);
    return [];
  }
}

export async function buscarPessoaPorCpfOuNome(termo) {
  return buscarPessoaExistente(termo);
}

export async function buscarPessoaPorNomeOuCpf(termo) {
  return buscarPessoaExistente(termo);
}

/* ── 2. CADASTRAR OU ATUALIZAR PACIENTE NA JUNTA REGULADORA ── */
export async function cadastrarPacienteJunta(data) {
  try {
    // Cadastro de paciente é ato administrativo da Junta e cria Servico
    // on-the-fly: nunca liberar a OPERADOR (design §2.6).
    const user = await requireAdminModulo(MODULOS.JUNTA);
    const { cpf, tipoDeficiencia, locaisEncaminhados = [] } = data;

    // CPF provisório (T + 10 dígitos) também é uma chave válida de pessoa.
    const cpfClean = normalizarCpfChave(cpf).slice(0, 11);

    if (!cpfClean || cpfClean.length !== 11) {
      return { success: false, error: 'CPF inválido. Deve conter 11 dígitos.' };
    }
    if (!tipoDeficiencia?.trim()) {
      return { success: false, error: 'Informe o tipo de deficiência.' };
    }

    // A pessoa deve estar previamente cadastrada em Gerenciamento > Cadastro de Pessoas.
    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfClean },
      select: { cpf: true, ativo: true },
    });
    if (!pessoa || !pessoa.ativo) {
      return {
        success: false,
        error:
          'Pessoa não encontrada. Cadastre-a primeiro em Gerenciamento > Cadastro de Pessoas.',
      };
    }

    // Transação: apenas dados específicos da Junta (PacienteJunta + vínculos).
    const pacienteJunta = await prisma.$transaction(async (tx) => {
      // 1. Cadastrar ou atualizar o paciente na Junta
      const paciente = await tx.pacienteJunta.upsert({
        where: { pessoaCpf: cpfClean },
        update: { tipoDeficiencia },
        create: { pessoaCpf: cpfClean, tipoDeficiencia },
      });

      // 2. Revincula serviços: limpa e recria
      await tx.pacienteJuntaServico.deleteMany({
        where: { pacienteJuntaId: paciente.id },
      });

      if (locaisEncaminhados.length > 0) {
        const servicoIds = [];
        for (const localNome of locaisEncaminhados) {
          let servico = await tx.servico.findFirst({
            where: { nome: { equals: localNome.trim(), mode: 'insensitive' } },
          });
          if (!servico) {
            servico = await tx.servico.create({
              data: { nome: localNome.trim(), ativo: true },
            });
          }
          servicoIds.push(servico.id);
        }

        await tx.pacienteJuntaServico.createMany({
          data: servicoIds.map((sId) => ({
            pacienteJuntaId: paciente.id,
            servicoId: sId,
            ativo: true,
          })),
        });
      }

      return paciente;
    });

    await registrarAuditoria({
      user,
      acao: 'SALVAR',
      modulo: 'JUNTA',
      entidade: 'PacienteJunta',
      entidadeId: String(pacienteJunta.id),
      descricao: `Paciente #${pacienteJunta.id} da Junta salvo`,
    });

    return { success: true, id: pacienteJunta.id };
  } catch (error) {
    console.error('Erro ao cadastrar paciente na Junta:', error);
    return { success: false, error: error.message };
  }
}

/* ── LISTAR PACIENTES CADASTRADOS NA JUNTA (para o dropdown do prontuário) ── */
export async function listarPacientesJunta(termo) {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);
    const termoClean = String(termo || '').trim();
    const apenasNumeros = termoClean.replace(/\D/g, '');

    const pacientes = await prisma.pacienteJunta.findMany({
      include: {
        pessoa: true,
      },
    });

    // Filtra por nome ou CPF (quando houver termo) e monta a lista do dropdown.
    const lista = pacientes
      .filter((pj) => !!pj.pessoa)
      .filter((pj) => {
        if (!termoClean) return true;
        const nome = (pj.pessoa.nomeCompleto || '').toLowerCase();
        const cpf = (pj.pessoa.cpf || '').replace(/\D/g, '');
        return (
          nome.includes(termoClean.toLowerCase()) ||
          (apenasNumeros && cpf.includes(apenasNumeros))
        );
      })
      .map((pj) => ({
        cpf: pj.pessoa.cpf,
        cns: pj.pessoa.cns || '',
        nomeCompleto: pj.pessoa.nomeCompleto,
        nome: pj.pessoa.nomeCompleto,
        nomeMae: pj.pessoa.nomeMae || '',
        dataNascimento: pj.pessoa.dataNascimento
          ? new Date(pj.pessoa.dataNascimento).toISOString().split('T')[0]
          : '',
      }))
      .sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || '', 'pt-BR'));

    return serializeData(lista);
  } catch (error) {
    console.error('Erro ao listar pacientes da Junta:', error);
    return [];
  }
}

/* ── 3. LISTAR PACIENTES VINCULADOS A UM SERVIÇO ── */
export async function getPacientesPorServico(servicoNome) {
  try {
    if (!servicoNome) return { success: true, data: [] };

    // Autoriza pelo NOME CANÔNICO recebido ANTES de qualquer OR/contains
    // (refinamento #4): operador só-CAEE é barrado (403) em APAE/Ambulatório/etc.
    await requireLeituraServicoJuntaPorNome(servicoNome);

    const termo = String(servicoNome).trim();

    const servico = await prisma.servico.findFirst({
      where: {
        OR: [
          { nome: { equals: termo, mode: 'insensitive' } },
          { nome: { contains: termo, mode: 'insensitive' } },
        ],
      },
    });

    if (!servico) {
      return { success: true, data: [] };
    }

    const vinculos = await prisma.pacienteJuntaServico.findMany({
      where: {
        servicoId: servico.id,
        ativo: true,
      },
    });

    if (vinculos.length === 0) {
      return { success: true, data: [] };
    }

    const pacienteJuntaIds = vinculos.map((v) => v.pacienteJuntaId).filter(Boolean);

    const pacientesJunta = await prisma.pacienteJunta.findMany({
      where: { id: { in: pacienteJuntaIds } },
    });

    const pessoaCpfs = pacientesJunta.map((pj) => pj.pessoaCpf).filter(Boolean);

    const pessoas = await prisma.pessoa.findMany({
      where: { cpf: { in: pessoaCpfs }, ativo: true },
      include: {
        enderecos: {
          where: { enderecoAtual: true },
          take: 1,
        },
      },
    });

    const pessoaDict = pessoas.reduce((acc, p) => {
      acc[p.cpf] = p;
      return acc;
    }, {});

    const pacienteJuntaDict = pacientesJunta.reduce((acc, pj) => {
      acc[pj.id] = pj;
      return acc;
    }, {});

    const data = vinculos
      .map((v) => {
        const pj = pacienteJuntaDict[v.pacienteJuntaId];
        const pessoa = pj ? pessoaDict[pj.pessoaCpf] : null;

        if (!pessoa || !pj) return null;

        const end = pessoa.enderecos?.[0] || {};

        return {
          id: pj.id,
          paciente_junta_id: pj.id,
          cpf: pessoa.cpf || '',
          nome: pessoa.nomeCompleto || '',
          nomeCompleto: pessoa.nomeCompleto || '',
          sexo: pessoa.sexo || 'Masculino',
          nomeMae: pessoa.nomeMae || '',
          telefone: pessoa.telefone || '',
          tipo_deficiencia: pj.tipoDeficiencia || '',
          tipoDeficiencia: pj.tipoDeficiencia || '',
          logradouro: end.logradouro || '',
          numero: end.numero || '',
          bairro: end.bairro || '',
          cidade: end.cidade || '',
          uf: end.uf || '',
          cep: end.cep || '',
        };
      })
      .filter(Boolean);

    data.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao listar pacientes do serviço:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/* ── 4. REGISTRAR PRESENÇA / ATENDIMENTO NO SERVIÇO ── */
export async function registrarAtendimentoServico(data) {
  try {
    const { 
      pacienteJuntaId, 
      pacienteId,
      servico, 
      servicoNome, 
      especialidade, 
      dataAtendimento, 
      data: dataForm, 
      status, 
      observacao, 
      profissional 
    } = data;

    const nomeDoServico = (servicoNome || servico || '').trim();
    const idDoPaciente = pacienteJuntaId || pacienteId;

    if (!nomeDoServico) return { success: false, error: 'Nome do serviço não informado.' };
    if (!idDoPaciente) return { success: false, error: 'Paciente não selecionado.' };

    // Escrita por serviço: nome mapeado exige o sub-serviço; não mapeado exige
    // ADMIN da Junta (operador nunca cria serviço on-the-fly) — design §2.6.
    const user = await requireEscritaServicoJuntaPorNome(nomeDoServico);

    let juntaServico = await prisma.servico.findFirst({
      where: { nome: { equals: nomeDoServico, mode: 'insensitive' } },
    });

    if (!juntaServico) {
      juntaServico = await prisma.servico.create({
        data: { nome: nomeDoServico, ativo: true },
      });
    }

    // Normaliza a data para 'YYYY-MM-DD' e monta o dia em UTC (coluna é @db.Date),
    // evitando divergência de fuso que faria o registro cair em outro dia.
    const dataStr = String(dataAtendimento || dataForm || '').split('T')[0];
    const [ano, mesN, diaN] = (dataStr || '').split('-').map(Number);
    const dataFinal =
      ano && mesN && diaN ? new Date(Date.UTC(ano, mesN - 1, diaN)) : new Date();

    const diaInicio = new Date(dataFinal);
    const diaFim = new Date(dataFinal);
    diaFim.setUTCDate(diaFim.getUTCDate() + 1);

    const espec = especialidade || 'Geral';

    // Já existe um atendimento deste paciente, neste serviço, especialidade e dia?
    const existente = await prisma.juntaAtendimento.findFirst({
      where: {
        pacienteJuntaId: Number(idDoPaciente),
        servicoId: juntaServico.id,
        especialidade: espec,
        dataAtendimento: { gte: diaInicio, lt: diaFim },
      },
    });

    let atendimentoId;
    if (existente) {
      atendimentoId = existente.id;
      // Edição: atualiza o registro existente (não cria outro no relatório).
      await prisma.juntaAtendimento.update({
        where: { id: existente.id },
        data: {
          status: status || 'PRESENCA',
          observacao: observacao || null,
          profissionalResponsavel: profissional || null,
        },
      });
    } else {
      const criado = await prisma.juntaAtendimento.create({
        data: {
          pacienteJuntaId: Number(idDoPaciente),
          servicoId: juntaServico.id,
          especialidade: espec,
          dataAtendimento: dataFinal,
          status: status || 'PRESENCA',
          observacao: observacao || null,
          profissionalResponsavel: profissional || null,
        },
      });
      atendimentoId = criado.id;
    }

    await registrarAuditoria({
      user,
      acao: existente ? 'EDITAR' : 'CRIAR',
      modulo: 'JUNTA',
      entidade: 'Atendimento',
      entidadeId: String(atendimentoId),
      descricao: `Atendimento ${existente ? 'atualizado' : 'registrado'} (${juntaServico.nome})`,
      detalhes: { status: status || 'PRESENCA' },
    });

    revalidatePath('/junta-reguladora');
    return { success: true };
  } catch (error) {
    console.error('Erro ao registrar atendimento:', error);
    return { success: false, error: error.message };
  }
}

/* ── ESPECIALIDADES CADASTRADAS (Gerenciamento > Serviços e Especialidades) ── */
// Retorna as especialidades do serviço cujo nome bate (case-insensitive).
// Se não encontrar um serviço com esse nome, retorna todas as especialidades.
export async function getEspecialidadesPorServico(servicoNome) {
  try {
    const nome = String(servicoNome || '').trim();

    // Nome definido → valida o sub-serviço (refinamento #1).
    if (nome) {
      await requireLeituraServicoJuntaPorNome(nome);

      const servico = await prisma.servico.findFirst({
        where: { nome: { equals: nome, mode: 'insensitive' } },
      });

      const especialidades = await prisma.especialidade.findMany({
        where: servico ? { servicoId: servico.id } : {},
        include: { servico: true },
        orderBy: { nome: 'asc' },
      });

      return serializeData(
        especialidades.map((e) => ({
          id: e.id,
          nome: e.nome,
          servicoNome: e.servico?.nome || '',
        })),
      );
    }

    // Nome vazio → entra no módulo e decide o escopo pelo nível (Finding 3).
    const user = await requireAcessoModulo(MODULOS.JUNTA);

    // "Admin ou gestor" passou a ser: é ADMINISTRADOR do módulo JUNTA. A Gestão
    // Geral não entra mais por ser gestão — se precisar ver tudo da Junta, o
    // vínculo dela com JUNTA recebe o perfil correspondente.
    const ehAdminOuGestor = await usuarioEhAdminModulo(user, MODULOS.JUNTA);

    let where = {};

    if (!ehAdminOuGestor) {
      // OPERADOR: restringe aos sub-serviços efetivamente vinculados, para não
      // vazar especialidades de serviços fora do vínculo (Finding 3).
      const nomesPermitidos = (user.acessos || [])
        .filter(
          (a) =>
            a.modulo === MODULOS.JUNTA &&
            a.nivel === NIVEIS.OPERADOR &&
            a.servicoJunta,
        )
        .map((a) => SERVICO_JUNTA_PARA_NOME[a.servicoJunta])
        .filter(Boolean);

      // Sem nenhum sub-serviço vinculado → retorna vazio.
      if (nomesPermitidos.length === 0) return [];

      const servicosPermitidos = await prisma.servico.findMany({
        where: { nome: { in: nomesPermitidos, mode: 'insensitive' } },
        select: { id: true },
      });
      const idsPermitidos = servicosPermitidos.map((s) => s.id);
      if (idsPermitidos.length === 0) return [];

      where = { servicoId: { in: idsPermitidos } };
    }

    const especialidades = await prisma.especialidade.findMany({
      where,
      include: { servico: true },
      orderBy: { nome: 'asc' },
    });

    return serializeData(
      especialidades.map((e) => ({
        id: e.id,
        nome: e.nome,
        servicoNome: e.servico?.nome || '',
      })),
    );
  } catch (error) {
    console.error('Erro ao buscar especialidades por serviço:', error);
    return [];
  }
}

/* ── 5. CONSULTA DO PRONTUÁRIO UNIFICADO (100% PRISMA ORM DEFINITIVO) ── */
export async function getProntuarioUnificado(termoBusca) {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);
    const termoClean = String(termoBusca).trim();
    const apenasNumeros = termoClean.replace(/\D/g, '');

    // 1. Busca os dados primários da pessoa diretamente pelo Prisma ORM
    const pessoa = await prisma.pessoa.findFirst({
      where: {
        ativo: true,
        OR: [
          { nomeCompleto: { contains: termoClean, mode: 'insensitive' } },
          ...(apenasNumeros.length > 0 ? [{ cpf: { contains: apenasNumeros } }] : []),
        ],
      },
      include: {
        enderecos: {
          where: { enderecoAtual: true },
          take: 1,
        },
      },
    });

    if (!pessoa) {
      return { success: true, data: null };
    }

    // 2. Busca cadastro da pessoa na Junta
    const pacienteJunta = await prisma.pacienteJunta.findFirst({
      where: { pessoaCpf: pessoa.cpf },
    });

    let servicosAtivos = [];
    let servicosAgrupados = [];

    if (pacienteJunta) {
      // Busca vínculos, atendimentos e agendamentos (todos com serviço) em paralelo.
      const [vinculos, atendimentos, agendamentos] = await Promise.all([
        prisma.pacienteJuntaServico.findMany({
          where: { pacienteJuntaId: pacienteJunta.id, ativo: true },
          include: { servico: true },
        }),
        prisma.juntaAtendimento.findMany({
          where: { pacienteJuntaId: pacienteJunta.id },
          orderBy: { dataAtendimento: 'desc' },
          include: { servico: true },
        }),
        prisma.agendamentoJunta.findMany({
          where: { pacienteJuntaId: pacienteJunta.id },
          orderBy: [{ data: 'desc' }, { hora: 'asc' }],
          include: { servico: true },
        }),
      ]);

      servicosAtivos = vinculos
        .map((v) => v.servico?.nome)
        .filter(Boolean);

      // Chave por serviço+especialidade+dia para cruzar agendamento x atendimento.
      const ymd = (d) => new Date(d).toISOString().split('T')[0];
      const chaveAtend = (servNome, espec, dia) =>
        `${servNome}___${(espec || '').trim().toLowerCase()}___${dia}`;

      // Mapa de atendimentos registrados (status/observação) por serviço+espec+dia.
      const atendPorChave = new Map();
      for (const a of atendimentos) {
        const nomeServico = a.servico?.nome || 'Outros';
        atendPorChave.set(
          chaveAtend(nomeServico, a.especialidade, ymd(a.dataAtendimento)),
          a,
        );
      }

      const gruposMap = {};
      const garantirGrupo = (nomeServico, espec) => {
        const chave = `${nomeServico}___${espec}`;
        if (!gruposMap[chave]) {
          gruposMap[chave] = {
            servico: nomeServico,
            especialidade: espec,
            presencas: 0,
            faltas: 0,
            faltasJustificadas: 0,
            datas: [],
          };
        }
        return gruposMap[chave];
      };

      const chavesUsadas = new Set();

      // 1) Linhas vindas dos AGENDAMENTOS (trazem data + hora da agenda).
      for (const ag of agendamentos) {
        const nomeServico = ag.servico?.nome || 'Outros';
        const espec = ag.especialidade || 'Geral';
        const dia = ymd(ag.data);
        const grupo = garantirGrupo(nomeServico, espec);

        const atend = atendPorChave.get(chaveAtend(nomeServico, espec, dia));
        const status = atend?.status || null; // null = agendado, sem registro ainda

        const st = (status || '').toUpperCase();
        if (st === 'PRESENCA') grupo.presencas++;
        else if (st === 'FALTA') grupo.faltas++;
        else if (st === 'FALTA_JUSTIFICADA') grupo.faltasJustificadas++;

        grupo.datas.push({
          id: `ag-${ag.id}`,
          data: ag.data,
          hora: ag.hora,
          status, // pode ser null (apenas agendado)
          observacao: atend?.observacao || ag.observacao || '',
        });

        chavesUsadas.add(chaveAtend(nomeServico, espec, dia));
      }

      // 2) Atendimentos registrados SEM agendamento correspondente (avulsos).
      for (const a of atendimentos) {
        const nomeServico = a.servico?.nome || 'Outros';
        const espec = a.especialidade || 'Geral';
        const dia = ymd(a.dataAtendimento);
        if (chavesUsadas.has(chaveAtend(nomeServico, espec, dia))) continue;

        const grupo = garantirGrupo(nomeServico, espec);
        const st = (a.status || '').toUpperCase();
        if (st === 'PRESENCA') grupo.presencas++;
        else if (st === 'FALTA') grupo.faltas++;
        else if (st === 'FALTA_JUSTIFICADA') grupo.faltasJustificadas++;

        grupo.datas.push({
          id: `at-${a.id}`,
          data: a.dataAtendimento,
          hora: '',
          status: a.status,
          observacao: a.observacao || '',
        });
      }

      servicosAgrupados = Object.values(gruposMap);
    }

    const end = pessoa.enderecos?.[0] || {};

    const pacienteFormatted = {
      paciente_junta_id: pacienteJunta?.id || null,
      cpf: pessoa.cpf,
      nome: pessoa.nomeCompleto,
      sexo: pessoa.sexo || 'Masculino',
      nomeMae: pessoa.nomeMae,
      data_nascimento: pessoa.dataNascimento,
      telefone: pessoa.telefone,
      tipo_deficiencia: pacienteJunta?.tipoDeficiencia || 'Não cadastrado na Junta',
      logradouro: end.logradouro || '',
      numero: end.numero || '',
      bairro: end.bairro || '',
      cidade: end.cidade || '',
      uf: end.uf || '',
      cep: end.cep || '',
      servicos_ativos: servicosAtivos,
    };

    return {
      success: true,
      data: serializeData({
        paciente: pacienteFormatted,
        servicosAgrupados,
      }),
    };
  } catch (error) {
    console.error('Erro ao buscar prontuário:', error);
    return { success: false, error: error.message };
  }
}


/* ── AGENDA POR SERVIÇO (calendário mensal) ── */

// Resolve o id do serviço pelo nome (cria se não existir).
async function resolverServicoIdPorNome(servicoNome) {
  const nome = String(servicoNome || '').trim();
  if (!nome) throw new Error('Serviço não informado.');
  let servico = await prisma.servico.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' } },
  });
  if (!servico) {
    servico = await prisma.servico.create({ data: { nome, ativo: true } });
  }
  return servico.id;
}

// Lista os agendamentos de um serviço num mês/ano (1-12).
export async function getAgendamentosDoMes(servicoNome, ano, mes) {
  try {
    await requireLeituraServicoJuntaPorNome(servicoNome);
    const nome = String(servicoNome || '').trim();
    const servico = nome
      ? await prisma.servico.findFirst({
          where: { nome: { equals: nome, mode: 'insensitive' } },
        })
      : null;
    if (!servico) return [];

    const y = Number(ano);
    const m = Number(mes); // 1-12
    const inicio = new Date(y, m - 1, 1);
    const fim = new Date(y, m, 1); // primeiro dia do mês seguinte

    const rows = await prisma.agendamentoJunta.findMany({
      where: {
        servicoId: servico.id,
        data: { gte: inicio, lt: fim },
      },
      include: {
        pacienteJunta: { include: { pessoa: true } },
      },
      orderBy: [{ data: 'asc' }, { hora: 'asc' }],
    });

    return serializeData(
      rows.map((a) => ({
        id: a.id,
        pacienteJuntaId: a.pacienteJuntaId,
        pacienteNome: a.pacienteJunta?.pessoa?.nomeCompleto || '—',
        especialidade: a.especialidade,
        hora: a.hora,
        observacao: a.observacao || '',
        // 'YYYY-MM-DD' para casar com os dias do calendário no cliente
        data: a.data.toISOString().split('T')[0],
      })),
    );
  } catch (error) {
    console.error('Erro ao buscar agendamentos do mês:', error);
    return [];
  }
}

// Agendamentos de um serviço numa data específica ('YYYY-MM-DD').
export async function getAgendamentosDoDia(servicoNome, dataYMD) {
  try {
    await requireLeituraServicoJuntaPorNome(servicoNome);
    const nome = String(servicoNome || '').trim();
    const servico = nome
      ? await prisma.servico.findFirst({
          where: { nome: { equals: nome, mode: 'insensitive' } },
        })
      : null;
    if (!servico || !dataYMD) return [];

    const [yA, mA, dA] = String(dataYMD).split('-').map(Number);
    const inicio = new Date(Date.UTC(yA, mA - 1, dA));
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 1);

    const rows = await prisma.agendamentoJunta.findMany({
      where: {
        servicoId: servico.id,
        data: { gte: inicio, lt: fim },
      },
      include: { pacienteJunta: { include: { pessoa: true } } },
      orderBy: [{ hora: 'asc' }],
    });

    // Atendimentos já registrados nesse serviço/dia (para marcar o que já foi feito).
    const atendimentos = await prisma.juntaAtendimento.findMany({
      where: {
        servicoId: servico.id,
        dataAtendimento: { gte: inicio, lt: fim },
      },
    });

    const chaveAtend = (pacId, espec) => `${pacId}___${(espec || '').trim().toLowerCase()}`;
    const mapaAtend = new Map();
    for (const at of atendimentos) {
      mapaAtend.set(chaveAtend(at.pacienteJuntaId, at.especialidade), at);
    }

    return serializeData(
      rows.map((a) => {
        const jaRegistrado = mapaAtend.get(chaveAtend(a.pacienteJuntaId, a.especialidade));
        return {
          id: a.id,
          pacienteJuntaId: a.pacienteJuntaId,
          pacienteNome: a.pacienteJunta?.pessoa?.nomeCompleto || '—',
          pacienteCpf: a.pacienteJunta?.pessoa?.cpf || '',
          especialidade: a.especialidade,
          hora: a.hora,
          observacao: a.observacao || '',
          // Dados do atendimento já registrado (se houver).
          registrado: !!jaRegistrado,
          statusRegistrado: jaRegistrado?.status || null,
          observacaoRegistrada: jaRegistrado?.observacao || '',
        };
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar agendamentos do dia:', error);
    return [];
  }
}

// Cria um agendamento (paciente + especialidade + data + hora).
export async function criarAgendamentoJunta(dados) {
  try {
    // Escrita por serviço: valida o sub-serviço antes de resolver/criar o Servico.
    const user = await requireEscritaServicoJuntaPorNome(dados.servicoNome);
    const servicoId = await resolverServicoIdPorNome(dados.servicoNome);

    const pacienteJuntaId = Number(dados.pacienteJuntaId);
    if (!pacienteJuntaId) return { success: false, error: 'Selecione o paciente.' };
    if (!dados.especialidade) return { success: false, error: 'Selecione a especialidade.' };
    if (!dados.data) return { success: false, error: 'Informe a data.' };
    if (!dados.hora) return { success: false, error: 'Informe o horário.' };

    const agendamentoCriado = await prisma.agendamentoJunta.create({
      data: {
        servicoId,
        pacienteJuntaId,
        especialidade: dados.especialidade,
        data: new Date(`${dados.data}T00:00:00`),
        hora: dados.hora,
        observacao: dados.observacao || null,
      },
    });

    await registrarAuditoria({
      user,
      acao: 'CRIAR',
      modulo: 'JUNTA',
      entidade: 'Agendamento',
      entidadeId: String(agendamentoCriado.id),
      descricao: `Agendamento criado (${dados.servicoNome}, ${dados.especialidade})`,
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    return { success: false, error: error.message };
  }
}

// Exclui um agendamento.
export async function excluirAgendamentoJunta(id) {
  try {
    const agId = Number(id);
    if (!agId) return { success: false, error: 'Agendamento inválido.' };

    // Refinamento #2: resolve o serviço pelo id ANTES de excluir e aplica a
    // guarda de escrita por sub-serviço. Impede operador só-CAEE de excluir
    // agendamento de APAE/Ambulatório/Especialidades. Nome não-mapeado cai em
    // requireAdminModulo(JUNTA) dentro de requireEscritaServicoJuntaPorNome.
    const agendamento = await prisma.agendamentoJunta.findUnique({
      where: { id: agId },
      include: { servico: true },
    });
    if (!agendamento) return { success: false, error: 'Agendamento inválido.' };

    const user = await requireEscritaServicoJuntaPorNome(agendamento.servico?.nome || '');

    await prisma.agendamentoJunta.delete({ where: { id: agId } });

    await registrarAuditoria({
      user,
      acao: 'EXCLUIR',
      modulo: 'JUNTA',
      entidade: 'Agendamento',
      entidadeId: String(agId),
      descricao: `Agendamento #${agId} excluído`,
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error);
    return { success: false, error: error.message };
  }
}
