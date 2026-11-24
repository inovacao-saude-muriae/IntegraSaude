"use server";

// ═══════════════════════════════════════════════════════════════════════════
// LEISHMANIOSE (CCZ > Zoonoses) — server actions
// ─────────────────────────────────────────────────────────────────────────
// Uma linha em ccz_leishmaniose = UMA fiscalização. O mesmo animal pode ter
// várias; nada é sobrescrito.
//
// SNAPSHOT HISTÓRICO: ao salvar, os dados de identificação do animal e do
// tutor (Pessoa central) e os nomes/funções da equipe são COPIADOS para o
// registro. Alterações posteriores nos cadastros não reescrevem a ficha nem
// o PDF.
//
// RESPONSÁVEL: vem SEMPRE da sessão autenticada (users.cpf + users.nome).
// O cliente nunca informa quem é o responsável.
//
// PERMISSÕES: consulta exige CCZ > zoonoses > visualizar; criação exige
// criar; correção de registro existente exige editar.
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo, requirePermissao } from "@/lib/auth";
import { MODULOS, usuarioTemPermissao } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";
import { Prisma } from "@prisma/client";

const FUNCIONALIDADE = "zoonoses";
const PAGINA_TAMANHO = 100;
const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

const texto = (v) => String(v ?? "").trim();
const opcional = (v) => {
  const t = texto(v);
  return t === "" ? null : t;
};

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 400 && status < 500) {
    return { success: false, error: erro?.message || "Requisição inválida.", status };
  }
  console.error("[Leishmaniose] erro:", erro);
  return { success: false, error: "Erro ao processar a solicitação.", status: 500 };
}

function dataOuNull(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(valor));
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diaLocalParaUtc(valor, limite) {
  const d = dataOuNull(valor);
  if (!d) return null;
  return new Date(d.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 86400000 - 1 : 0));
}

function formatarEndereco(e) {
  if (!e) return "";
  const partes = [];
  if (e.logradouro) partes.push(e.logradouro);
  if (e.numero) partes.push(e.numero);
  if (e.complemento) partes.push(e.complemento);
  if (e.bairro) partes.push(e.bairro);
  if (e.cidade && e.uf) partes.push(`${e.cidade}/${e.uf}`);
  if (e.cep) partes.push(`CEP: ${e.cep}`);
  return partes.join(", ");
}

const SIM_NAO = (v, permitidos) => {
  const t = texto(v);
  return permitidos.includes(t) ? t : null;
};

// ── CATÁLOGOS DO FORMULÁRIO ────────────────────────────────────────────────
// Responsável (usuário autenticado) e se ele é médico veterinário — sem
// presumir que todo usuário seja.
export async function obterDadosFormularioLeishmaniose() {
  try {
    const user = await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "visualizar");

    const registro = await prisma.user.findUnique({
      where: { cpf: user.cpf },
      select: { cpf: true, nome: true, cargo: true },
    });

    const podeCriar = await usuarioTemPermissao(user, MODULOS.CCZ, FUNCIONALIDADE, "criar");
    const podeEditar = await usuarioTemPermissao(user, MODULOS.CCZ, FUNCIONALIDADE, "editar");

    return {
      success: true,
      responsavel: {
        cpf: registro?.cpf || user.cpf,
        nome: registro?.nome || user.nome || "",
        cargo: registro?.cargo || "",
      },
      podeCriar,
      podeEditar,
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Animais do CCZ com o tutor vinculado (dados da Pessoa central).
export async function buscarAnimaisLeishmaniose(termo = "") {
  try {
    await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "visualizar");

    const t = texto(termo);
    const animais = await prisma.animal.findMany({
      where: t
        ? {
            OR: [
              { nome: { contains: t, mode: "insensitive" } },
              { id: { contains: t, mode: "insensitive" } },
              { especie: { contains: t, mode: "insensitive" } },
              { tutor: { pessoa: { nomeCompleto: { contains: t, mode: "insensitive" } } } },
              { tutor: { pessoa: { cpf: { contains: t.replace(/\D/g, "") } } } },
            ],
          }
        : {},
      orderBy: { dataCadastro: "desc" },
      take: 50,
      include: {
        tutor: {
          include: {
            pessoa: { include: { enderecos: { where: { enderecoAtual: true } } } },
          },
        },
      },
    });

    return {
      success: true,
      data: animais.map((a) => {
        const pessoa = a.tutor?.pessoa || null;
        const endereco = pessoa?.enderecos?.[0] || null;
        return {
          id: a.id,
          nome: a.nome || "",
          especie: a.especie || "",
          sexo: a.sexo === "F" ? "Fêmea" : a.sexo === "M" ? "Macho" : "",
          idade: a.idade || "",
          porte: a.porte || "",
          // Raça/Pelagem e identificação vêm do cadastro central do animal.
          racaPelagem: a.racaPelagem || "",
          identificacao: a.possuiIdentificacao || "",
          temTutor: Boolean(pessoa),
          tutor: pessoa
            ? {
                nome: pessoa.nomeCompleto || "",
                cpf: pessoa.cpf || "",
                telefone: pessoa.telefone || "",
                endereco: formatarEndereco(endereco),
                bairro: endereco?.bairro || "",
              }
            : null,
        };
      }),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// ── SALVAR ─────────────────────────────────────────────────────────────────
function normalizarEquipe(lista, responsavel) {
  const linhas = Array.isArray(lista) ? lista : [];
  const extras = linhas
    .map((l) => ({ nome: texto(l?.nome), cargo: opcional(l?.cargo) }))
    .filter((l) => l.nome)
    .slice(0, 20)
    .map((l, i) => ({ ...l, ordem: i + 1, usuarioCpf: null, naoRemovivel: false }));

  return [
    {
      nome: responsavel.nome,
      cargo: opcional(responsavel.cargo),
      ordem: 0,
      usuarioCpf: responsavel.cpf,
      naoRemovivel: true,
    },
    ...extras,
  ];
}

function normalizarVeterinarios(lista) {
  const linhas = Array.isArray(lista) ? lista : [];
  return linhas
    .map((l) => ({
      nome: texto(l?.nome),
      registro: opcional(l?.registro),
      cargo: opcional(l?.cargo),
    }))
    .filter((l) => l.nome)
    .slice(0, 10)
    .map((l, i) => ({ ...l, ordem: i, principal: i === 0 }));
}

export async function salvarLeishmaniose(dados = {}) {
  try {
    const user = await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "criar");

    const idExistente = texto(dados.id);
    if (idExistente) {
      // Correção de registro existente: exige permissão de edição.
      await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "editar");
    }

    const animalId = texto(dados.animalId);
    if (!animalId) return { success: false, error: "Selecione o animal da fiscalização." };

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        tutor: {
          include: {
            pessoa: { include: { enderecos: { where: { enderecoAtual: true } } } },
          },
        },
      },
    });
    if (!animal) return { success: false, error: "Animal não encontrado.", status: 404 };

    const dataFiscalizacao = dataOuNull(dados.dataFiscalizacao) || new Date();
    const pessoa = animal.tutor?.pessoa || null;
    const endereco = pessoa?.enderecos?.[0] || null;

    // Responsável SEMPRE da sessão autenticada — nunca do payload.
    const usuario = await prisma.user.findUnique({
      where: { cpf: user.cpf },
      select: { cpf: true, nome: true, cargo: true },
    });
    const responsavel = {
      cpf: usuario?.cpf || user.cpf,
      nome: usuario?.nome || user.nome || "",
      cargo: opcional(dados.responsavelCargo) || usuario?.cargo || null,
    };
    if (!responsavel.nome) {
      return { success: false, error: "Não foi possível identificar o usuário responsável." };
    }

    const semTutor = !pessoa;
    const equipe = normalizarEquipe(dados.equipe, responsavel);
    const veterinarios = normalizarVeterinarios(dados.veterinarios);

    const base = {
      animalId: animal.id,
      pessoaCpf: pessoa?.cpf || null,
      dataFiscalizacao,
      responsavelCpf: responsavel.cpf,
      responsavelNome: responsavel.nome,
      responsavelCargo: responsavel.cargo,
      // Snapshot do tutor (null quando não há tutor vinculado).
      tutorNome: pessoa?.nomeCompleto || null,
      tutorCpf: pessoa?.cpf || null,
      tutorEndereco: formatarEndereco(endereco) || null,
      tutorTelefone: pessoa?.telefone || null,
      tutorBairro: endereco?.bairro || null,
      // Snapshot do animal.
      animalNome: animal.nome || null,
      animalEspecie: animal.especie || null,
      animalSexo: animal.sexo === "F" ? "Fêmea" : animal.sexo === "M" ? "Macho" : animal.sexo || null,
      animalIdade: animal.idade || null,
      // Raça/Pelagem e identificação são dados cadastrais: vêm sempre do
      // cadastro central do animal (nunca editáveis na fiscalização).
      animalRacaPelagem: opcional(animal.racaPelagem),
      animalIdentificacao: SIM_NAO(animal.possuiIdentificacao, ["Sim", "Não"]),

      // 3. Condição clínica
      apresentaLesoes: SIM_NAO(dados.apresentaLesoes, ["Sim", "Não"]),
      quaisLesoes: opcional(dados.quaisLesoes),
      emTratamento: SIM_NAO(dados.emTratamento, ["Sim", "Não"]),
      tratamentoInicio: dataOuNull(dados.tratamentoInicio),
      profissionalRef: opcional(dados.profissionalRef),
      medicamentos: opcional(dados.medicamentos),
      posologiaCorreta: SIM_NAO(dados.posologiaCorreta, ["Sim", "Não", "Parcialmente"]),
      interrupcao: SIM_NAO(dados.interrupcao, ["Sim", "Não"]),
      interrupcaoMotivo: opcional(dados.interrupcaoMotivo),
      retornoVeterinario: SIM_NAO(dados.retornoVeterinario, ["Sim", "Não"]),
      retornoData: dataOuNull(dados.retornoData),

      // 4. Manejo e biossegurança
      coleiraRepelente: SIM_NAO(dados.coleiraRepelente, ["Sim", "Não"]),
      coleiraTroca: opcional(dados.coleiraTroca),
      produtosHigiene: opcional(dados.produtosHigiene),
      frequenciaHigiene: opcional(dados.frequenciaHigiene),
      acessoAreaRural: SIM_NAO(dados.acessoAreaRural, ["Sim", "Não"]),
      deslocamento: SIM_NAO(dados.deslocamento, ["Sim", "Não"]),
      deslocamentoQuando: opcional(dados.deslocamentoQuando),

      // 5. Outros animais e pessoas
      outrosAnimais: SIM_NAO(dados.outrosAnimais, ["Sim", "Não"]),
      outrosAnimaisDesc: opcional(dados.outrosAnimaisDesc),
      outrosComLesoes: SIM_NAO(dados.outrosComLesoes, ["Sim", "Não", "Não Avaliado"]),
      pessoasComLesoes: SIM_NAO(dados.pessoasComLesoes, ["Sim", "Não"]),
      pessoasOrientadas: SIM_NAO(dados.pessoasOrientadas, ["Sim", "Não"]),

      // 6. Condições do ambiente
      condicoesSanitarias: SIM_NAO(dados.condicoesSanitarias, ["Boas", "Regulares", "Ruins"]),
      condicoesObs: opcional(dados.condicoesObs),
      riscoDisseminacao: SIM_NAO(dados.riscoDisseminacao, ["Sim", "Não"]),
      riscoSaudePublica: SIM_NAO(dados.riscoSaudePublica, ["Sim", "Não"]),
      riscoDescricao: opcional(dados.riscoDescricao),

      // 7. Orientações e comprometimento (somente com tutor)
      orientZoonose: semTutor ? null : SIM_NAO(dados.orientZoonose, ["Sim", "Não"]),
      orientTratamento: semTutor ? null : SIM_NAO(dados.orientTratamento, ["Sim", "Não"]),
      orientColeira: semTutor ? null : SIM_NAO(dados.orientColeira, ["Sim", "Não"]),
      orientNovasLesoes: semTutor ? null : SIM_NAO(dados.orientNovasLesoes, ["Sim", "Não"]),
      orientObrigacoes: semTutor ? null : SIM_NAO(dados.orientObrigacoes, ["Sim", "Não"]),
      comprometimento: semTutor ? null : SIM_NAO(dados.comprometimento, ["Sim", "Parcialmente", "Não"]),

      // 8. Conclusão da equipe técnica
      condutaTutor: semTutor ? null : SIM_NAO(dados.condutaTutor, ["Adequada", "Parcialmente adequada", "Inadequada"]),
      situacaoGeral: SIM_NAO(dados.situacaoGeral, [
        "Animal sob tratamento e isolamento adequados",
        "Animal em risco, requer reforço de conduta",
        "Risco à saúde pública, encaminhamentos necessários",
      ]),
      encAcompanhamento: Boolean(dados.encAcompanhamento),
      encNotificacao: semTutor ? false : Boolean(dados.encNotificacao),
      encOutrasMedidas: Boolean(dados.encOutrasMedidas),
      encOutrasDescricao: opcional(dados.encOutrasDescricao),

      // 9. Assinaturas
      coordenadorNome: opcional(dados.coordenadorNome),
      coordenadorCargo: opcional(dados.coordenadorCargo),
      criadoPor: user.cpf,
    };

    const salvo = await prisma.$transaction(async (tx) => {
      let registro;
      if (idExistente) {
        const atual = await tx.leishmaniose.findUnique({ where: { id: idExistente } });
        if (!atual) throw Object.assign(new Error("Fiscalização não encontrada."), { status: 404 });
        registro = await tx.leishmaniose.update({ where: { id: idExistente }, data: base });
        await tx.leishmanioseEquipe.deleteMany({ where: { leishmanioseId: idExistente } });
        await tx.leishmanioseVeterinario.deleteMany({ where: { leishmanioseId: idExistente } });
      } else {
        registro = await tx.leishmaniose.create({ data: { id: randomUUID(), ...base } });
      }

      await tx.leishmanioseEquipe.createMany({
        data: equipe.map((l) => ({ id: randomUUID(), leishmanioseId: registro.id, ...l })),
      });
      if (veterinarios.length) {
        await tx.leishmanioseVeterinario.createMany({
          data: veterinarios.map((l) => ({ id: randomUUID(), leishmanioseId: registro.id, ...l })),
        });
      }
      return registro;
    });

    await registrarAuditoria({
      user,
      acao: idExistente ? "EDITAR" : "CRIAR",
      modulo: "CCZ",
      entidade: "Leishmaniose",
      entidadeId: salvo.id,
      descricao: `Fiscalização de leishmaniose do animal ${salvo.animalId} (${
        idExistente ? "corrigida" : "registrada"
      })`,
      detalhes: {
        animalId: salvo.animalId,
        dataFiscalizacao: salvo.dataFiscalizacao,
        responsavelCpf: salvo.responsavelCpf,
        integrantes: equipe.length,
        veterinarios: veterinarios.length,
      },
    });

    return { success: true, id: salvo.id };
  } catch (erro) {
    return responder(erro);
  }
}

// ── CONSULTA ───────────────────────────────────────────────────────────────
export async function listarLeishmaniose(filtros = {}) {
  try {
    await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "visualizar");

    const condicoes = [];
    const termo = texto(filtros.busca);
    if (termo) {
      condicoes.push(Prisma.sql`(
        f.animal_nome ILIKE ${"%" + termo + "%"} OR
        f.animal_id ILIKE ${"%" + termo + "%"} OR
        f.tutor_nome ILIKE ${"%" + termo + "%"} OR
        replace(replace(replace(COALESCE(f.tutor_cpf, ''), '.', ''), '-', ''), ' ', '') ILIKE ${"%" + termo.replace(/\D/g, "") + "%"})`);
    }
    const de = diaLocalParaUtc(filtros.periodoInicio, "inicio");
    const ate = diaLocalParaUtc(filtros.periodoFim, "fim");
    if (de) condicoes.push(Prisma.sql`f.data_fiscalizacao >= ${de}`);
    if (ate) condicoes.push(Prisma.sql`f.data_fiscalizacao <= ${ate}`);
    const situacao = texto(filtros.situacaoGeral);
    if (situacao) condicoes.push(Prisma.sql`f.situacao_geral = ${situacao}`);
    const bairro = texto(filtros.bairro);
    if (bairro) condicoes.push(Prisma.sql`lower(btrim(COALESCE(f.tutor_bairro, ''))) = lower(${bairro})`);

    const where = condicoes.length ? Prisma.join(condicoes, " AND ") : Prisma.sql`1=1`;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * PAGINA_TAMANHO;

    const [linhas, total] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT f.id, f.data_fiscalizacao, f.animal_nome, f.animal_id, f.tutor_nome, f.situacao_geral
        FROM public.ccz_leishmaniose f
        WHERE ${where}
        ORDER BY f.data_fiscalizacao DESC, f.created_at DESC
        LIMIT ${PAGINA_TAMANHO} OFFSET ${offset}`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM public.ccz_leishmaniose f WHERE ${where}`),
    ]);

    return {
      success: true,
      data: linhas.map((l) => ({
        id: l.id,
        dataFiscalizacao: l.data_fiscalizacao instanceof Date
          ? l.data_fiscalizacao.toISOString().slice(0, 10)
          : String(l.data_fiscalizacao).slice(0, 10),
        animalNome: l.animal_nome || "",
        animalId: l.animal_id,
        tutorNome: l.tutor_nome || "",
        situacaoGeral: l.situacao_geral || "",
      })),
      total: Number(total?.[0]?.total || 0),
      pagina,
      totalPaginas: Math.max(1, Math.ceil(Number(total?.[0]?.total || 0) / PAGINA_TAMANHO)),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Registro completo (para a visualização e para o PDF).
export async function obterLeishmaniose(id) {
  try {
    await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "visualizar");

    const f = await prisma.leishmaniose.findUnique({
      where: { id: texto(id) },
      include: {
        equipe: { orderBy: { ordem: "asc" } },
        veterinarios: { orderBy: { ordem: "asc" } },
      },
    });
    if (!f) return { success: false, error: "Fiscalização não encontrada.", status: 404 };

    const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    return {
      success: true,
      data: {
        ...f,
        dataFiscalizacao: ymd(f.dataFiscalizacao),
        tratamentoInicio: ymd(f.tratamentoInicio),
        retornoData: ymd(f.retornoData),
        createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : null,
        updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : null,
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Histórico de fiscalizações do mesmo animal (mais recente primeiro).
export async function historicoLeishmanioseAnimal(animalId) {
  try {
    await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "visualizar");
    const id = texto(animalId);
    if (!id) return { success: true, data: [] };

    const registros = await prisma.leishmaniose.findMany({
      where: { animalId: id },
      orderBy: [{ dataFiscalizacao: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        dataFiscalizacao: true,
        responsavelNome: true,
        situacaoGeral: true,
      },
    });
    return {
      success: true,
      data: registros.map((r) => ({
        id: r.id,
        dataFiscalizacao: new Date(r.dataFiscalizacao).toISOString().slice(0, 10),
        responsavelNome: r.responsavelNome,
        situacaoGeral: r.situacaoGeral || "",
      })),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Opções dos filtros (situações e bairros já registrados).
export async function obterFiltrosLeishmaniose() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);
    const [situacoes, bairros] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT situacao_geral AS valor FROM public.ccz_leishmaniose
        WHERE btrim(COALESCE(situacao_geral, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(tutor_bairro) AS valor FROM public.ccz_leishmaniose
        WHERE btrim(COALESCE(tutor_bairro, '')) <> '' ORDER BY 1`),
    ]);
    return {
      success: true,
      situacoes: situacoes.map((s) => s.valor),
      bairros: bairros.map((b) => b.valor),
    };
  } catch (erro) {
    return responder(erro);
  }
}
