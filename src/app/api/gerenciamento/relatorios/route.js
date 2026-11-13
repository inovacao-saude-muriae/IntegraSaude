import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Relatórios Gerais: EXCLUSIVO do GESTOR (junto com Gerenciar Usuários).
// Antes aceitava admin de qualquer módulo; a regra passou a ser só Gestor.

export async function GET() {
  try {
    await requirePermissaoGestao("relatorios", "visualizar");

    const [
      pessoas,
      pedidos,
      pacientesFarmacia,
      pacientesJunta,
      tutores,
      animais,
    ] = await Promise.all([
      prisma.pessoa.findMany({
        where: { ativo: true },
        orderBy: { nomeCompleto: "asc" },
        select: {
          cpf: true,
          nomeCompleto: true,
          telefone: true,
          dataNascimento: true,
        },
      }),
      prisma.pedidoExame.findMany({
        select: {
          id: true,
          pessoaCpf: true,
          status: true,
          dataSolicitacao: true,
          dataLiberacao: true,
          classificacaoRisco: true,
          procedimento: {
            select: { nome: true, tipoExame: { select: { nome: true } } },
          },
        },
      }),
      prisma.pacienteFarmaciaJudicial.findMany({
        select: {
          pessoaCpf: true,
          numeroPasta: true,
          numeroProcesso: true,
          status: true,
          createdAt: true,
          tratamentos: {
            select: {
              id: true,
              qtdPrescritaMensal: true,
              ativo: true,
              medicamento: { select: { nome: true, dosagem: true } },
              createdAt: true,
            },
          },
        },
      }),
      prisma.pacienteJunta.findMany({
        select: {
          pessoaCpf: true,
          createdAt: true,
          tipoDeficiencia: true,
          servicos: {
            select: {
              servico: { select: { nome: true } },
              dataVinculo: true,
              ativo: true,
            },
          },
        },
      }),
      prisma.tutor.findMany({ select: { pessoaCpf: true, createdAt: true } }),
      prisma.animal.findMany({
        select: {
          id: true,
          pessoaCpf: true,
          nome: true,
          especie: true,
          dataCadastro: true,
          procedimentos: {
            select: {
              id: true,
              tipo: true,
              dataProcedimento: true,
              status: true,
            },
          },
          denuncias: {
            select: {
              id: true,
              dataDenuncia: true,
              logradouro: true,
              numero: true,
              bairro: true,
              cidade: true,
              uf: true,
            },
          },
          esporotricose: {
            select: { id: true, dataVisita: true },
          },
        },
      }),
    ]);

    const eventosPorCpf = new Map(pessoas.map((pessoa) => [pessoa.cpf, []]));
    const adicionarEvento = (cpf, evento) => {
      if (!cpf || !eventosPorCpf.has(cpf)) return;
      eventosPorCpf.get(cpf).push({ id: evento.id, ...evento });
    };

    pedidos.forEach((pedido) => {
      // Relatório considera apenas exames aguardando ou liberados/agendados.
      if (pedido.status !== "Aguardando" && pedido.status !== "Liberado") {
        return;
      }
      const exame = `${pedido.procedimento?.tipoExame?.nome || "Exame"} - ${pedido.procedimento?.nome || "Procedimento"}`;
      const liberado = pedido.status === "Liberado";
      adicionarEvento(pedido.pessoaCpf, {
        id: `regulacao-${pedido.id}`,
        modulo: "Regulação",
        tipo: liberado ? "Exame liberado" : "Exame aguardando",
        descricao: exame,
        status: pedido.status,
        data: liberado ? pedido.dataLiberacao : pedido.dataSolicitacao,
      });
    });

    pacientesFarmacia.forEach((paciente) => {
      adicionarEvento(paciente.pessoaCpf, {
        id: `farmacia-paciente-${paciente.numeroPasta}`,
        modulo: "Farmácia Judicial",
        tipo: "Cadastro judicial",
        descricao: `Pasta ${paciente.numeroPasta} - status ${paciente.status}`,
        data: paciente.createdAt,
      });
      paciente.tratamentos.forEach((tratamento) =>
        adicionarEvento(paciente.pessoaCpf, {
          id: `farmacia-tratamento-${tratamento.id}`,
          modulo: "Farmácia Judicial",
          tipo: "Tratamento cadastrado",
          descricao:
            `${tratamento.medicamento?.nome || "Medicamento"} ${tratamento.medicamento?.dosagem || ""} - ${tratamento.qtdPrescritaMensal}/mês${tratamento.ativo ? "" : " (inativo)"}`.trim(),
          data: tratamento.createdAt,
        }),
      );
    });

    pacientesJunta.forEach((paciente) => {
      adicionarEvento(paciente.pessoaCpf, {
        id: `junta-paciente-${paciente.pessoaCpf}`,
        modulo: "Junta Reguladora",
        tipo: "Cadastro na Junta",
        descricao: paciente.tipoDeficiencia || "Paciente cadastrado",
        data: paciente.createdAt,
      });
      paciente.servicos.forEach((vinculo) => {
        // Default do schema é true; null/undefined é tratado como ativo.
        const ativo = vinculo.ativo === false ? false : true;
        adicionarEvento(paciente.pessoaCpf, {
          id: `junta-servico-${paciente.pessoaCpf}-${vinculo.servico?.nome}`,
          modulo: "Junta Reguladora",
          tipo: "Serviço vinculado",
          descricao: `${vinculo.servico?.nome || "Serviço"} (${ativo ? "Ativo" : "Inativo"})`,
          data: vinculo.dataVinculo,
        });
      });
    });

    const tutoresCcz = new Set(tutores.map((tutor) => tutor.pessoaCpf));
    tutores.forEach((tutor) =>
      adicionarEvento(tutor.pessoaCpf, {
        id: `ccz-tutor-${tutor.pessoaCpf}`,
        modulo: "CCZ",
        tipo: "Cadastro de tutor",
        descricao: "Pessoa cadastrada como tutor",
        data: tutor.createdAt,
      }),
    );
    animais
      .filter((animal) => animal.pessoaCpf && tutoresCcz.has(animal.pessoaCpf))
      .forEach((animal) => {
        const nomeAnimal = animal.nome || animal.especie || "Animal";
        adicionarEvento(animal.pessoaCpf, {
          id: `ccz-animal-${animal.id}`,
          modulo: "CCZ",
          tipo: "Animal cadastrado",
          descricao: nomeAnimal,
          data: animal.dataCadastro,
        });
        animal.procedimentos.forEach((item) =>
          adicionarEvento(animal.pessoaCpf, {
            id: `ccz-procedimento-${item.id}`,
            modulo: "CCZ",
            tipo: "Procedimento realizado",
            descricao: `${nomeAnimal} - ${item.tipo} (${item.status})`,
            data: item.dataProcedimento,
          }),
        );
        animal.denuncias.forEach((item) => {
          // O endereço da denúncia é composto por vários campos (não existe
          // mais uma coluna única "localizacao").
          const partes = [];
          if (item.logradouro) partes.push(item.logradouro);
          if (item.numero) partes.push(`nº ${item.numero}`);
          if (item.bairro) partes.push(item.bairro);
          if (item.cidade) partes.push(item.cidade);
          if (item.uf) partes.push(item.uf);
          const localizacao = partes.length > 0 ? partes.join(", ") : "-";

          adicionarEvento(animal.pessoaCpf, {
            id: `ccz-denuncia-${item.id}`,
            modulo: "CCZ",
            tipo: "Denúncia registrada",
            descricao: `${nomeAnimal} - ${localizacao}`,
            data: item.dataDenuncia,
          });
        });
        animal.esporotricose.forEach((item) =>
          adicionarEvento(animal.pessoaCpf, {
            id: `ccz-esporo-${item.id}`,
            modulo: "CCZ",
            tipo: "Esporotricose registrada",
            descricao: nomeAnimal,
            data: item.dataVisita,
          }),
        );
      });

    const usuarios = pessoas.map((pessoa) => {
      const atividades = eventosPorCpf
        .get(pessoa.cpf)
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
      const modulos = [
        ...new Set(atividades.map((atividade) => atividade.modulo)),
      ];
      const pedidosDaPessoa = pedidos.filter(
        (pedido) => pedido.pessoaCpf === pessoa.cpf,
      );
      const farmaciaDaPessoa = pacientesFarmacia.find(
        (paciente) => paciente.pessoaCpf === pessoa.cpf,
      );
      const juntaDaPessoa = pacientesJunta.find(
        (paciente) => paciente.pessoaCpf === pessoa.cpf,
      );
      const animaisDaPessoa = animais.filter(
        (animal) => animal.pessoaCpf === pessoa.cpf,
      );
      return {
        ...pessoa,
        nome: pessoa.nomeCompleto,
        atividades,
        totalAtividades: atividades.length,
        modulos,
        resumo: {
          regulacao: (() => {
            const mapearExame = (item) =>
              `${item.procedimento?.tipoExame?.nome || "Exame"} - ${item.procedimento?.nome || "Procedimento"}`;
            const aguardando = pedidosDaPessoa
              .filter((item) => item.status === "Aguardando")
              .map((item) => ({
                exame: mapearExame(item),
                data: item.dataSolicitacao,
              }));
            const liberados = pedidosDaPessoa
              .filter((item) => item.status === "Liberado")
              .map((item) => ({
                exame: mapearExame(item),
                data: item.dataLiberacao,
              }));
            return {
              total: aguardando.length + liberados.length,
              totalAguardando: aguardando.length,
              totalLiberados: liberados.length,
              aguardando,
              liberados,
            };
          })(),
          farmacia: farmaciaDaPessoa
            ? {
                status: farmaciaDaPessoa.status,
                pasta: farmaciaDaPessoa.numeroPasta,
                numeroProcesso: farmaciaDaPessoa.numeroProcesso,
                medicamentos: farmaciaDaPessoa.tratamentos.map((item) => ({
                  nome: item.medicamento?.nome || "Medicamento",
                  dosagem: item.medicamento?.dosagem || "",
                  qtdPrescritaMensal: item.qtdPrescritaMensal,
                  ativo: item.ativo,
                })),
              }
            : null,
          junta: juntaDaPessoa
            ? (() => {
                const servicos = juntaDaPessoa.servicos.map((item) => ({
                  nome: item.servico?.nome || "Serviço",
                  ativo: item.ativo === false ? false : true,
                  dataVinculo: item.dataVinculo,
                }));
                return {
                  servicos,
                  totalServicos: servicos.length,
                  ativos: servicos.filter((s) => s.ativo).length,
                };
              })()
            : null,
          ccz: animaisDaPessoa.length
            ? {
                animais: animaisDaPessoa.map(
                  (item) => item.nome || item.especie,
                ),
                procedimentos: animaisDaPessoa.reduce(
                  (total, item) => total + item.procedimentos.length,
                  0,
                ),
              }
            : null,
        },
      };
    });

    return NextResponse.json({
      usuarios,
      atividades: usuarios.flatMap((pessoa) =>
        pessoa.atividades.map((atividade) => ({
          ...atividade,
          cpf: pessoa.cpf,
          nome: pessoa.nomeCompleto,
        })),
      ),
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao carregar relatório geral:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar relatório." },
      { status: 500 },
    );
  }
}
