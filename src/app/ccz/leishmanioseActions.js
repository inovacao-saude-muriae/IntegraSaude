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
import {
  RETORNO_LEISHMANIOSE,
  agendarRetorno,
  concluirRetorno,
  dataParaYmd,
  ymdParaDataUtc,
} from "./retornosCcz";
import { Prisma } from "@prisma/client";

const FUNCIONALIDADE = "zoonoses";

// Situação do caso (acompanhamento) e desfecho. Todo registro novo nasce
// EM_ACOMPANHAMENTO; o desfecho é SEMPRE informado pelo profissional.
// (Não exportado: arquivo "use server" só pode exportar funções assíncronas.)
const SITUACAO_CASO = {
  EM_ACOMPANHAMENTO: "EM_ACOMPANHAMENTO",
  ENCERRADO: "ENCERRADO",
};
const DESFECHO_CASO = ["Curado", "Incinerado"];
const PAGINA_TAMANHO = 100;
const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

const texto = (v) => String(v ?? "").trim();

// Normalização usada na busca de animais: minúscula e sem acentos, para que
// "jose" encontre "José" (o PostgreSQL do projeto não tem unaccent).
const MAPA_ACENTOS = {
  á: "a",
  à: "a",
  ã: "a",
  â: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  õ: "o",
  ô: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
};
const normalizarBusca = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, (c) => MAPA_ACENTOS[c] || c)
    .trim();
const opcional = (v) => {
  const t = texto(v);
  return t === "" ? null : t;
};

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 400 && status < 500) {
    return {
      success: false,
      error: erro?.message || "Requisição inválida.",
      status,
    };
  }
  console.error("[Leishmaniose] erro:", erro);
  return {
    success: false,
    error: "Erro ao processar a solicitação.",
    status: 500,
  };
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
  return new Date(
    d.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 86400000 - 1 : 0),
  );
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
    const user = await requirePermissao(
      MODULOS.CCZ,
      FUNCIONALIDADE,
      "visualizar",
    );

    const registro = await prisma.user.findUnique({
      where: { cpf: user.cpf },
      select: { cpf: true, nome: true, cargo: true },
    });

    const podeCriar = await usuarioTemPermissao(
      user,
      MODULOS.CCZ,
      FUNCIONALIDADE,
      "criar",
    );
    const podeEditar = await usuarioTemPermissao(
      user,
      MODULOS.CCZ,
      FUNCIONALIDADE,
      "editar",
    );

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

    const t = normalizarBusca(termo);
    const digitos = String(termo || "").replace(/\D/g, "");

    // Busca no PostgreSQL: devolve SOMENTE os animais que correspondem ao
    // texto digitado. A comparação aplica a mesma normalização (minúscula e
    // sem acentos) dos dois lados, porque o banco não tem a extensão
    // unaccent — sem isso "jose" não casaria com "José".
    // Com 3+ caracteres o texto é tratado como ID CCZ e comparado de forma
    // exata, para que digitar o ID não traga vizinhos de mesmo prefixo.
    const porIdExato = t.length >= 3;
    const encontrados = t
      ? await prisma.$queryRaw`
          SELECT a.id
          FROM ccz_animais a
          LEFT JOIN ccz_tutores t ON t.pessoa_cpf = a.pessoa_cpf
          LEFT JOIN pessoa p ON p.cpf = t.pessoa_cpf
          WHERE
            translate(lower(coalesce(a.nome, '')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${"%" + t + "%"}
            OR (${porIdExato} AND lower(a.id) = ${t})
            OR (${!porIdExato} AND lower(a.id) LIKE ${"%" + t + "%"})
            OR translate(lower(coalesce(a.especie, '')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${"%" + t + "%"}
            OR translate(lower(coalesce(p.nome_completo, '')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${"%" + t + "%"}
            OR (${digitos} <> '' AND p.cpf LIKE ${"%" + digitos + "%"})
          ORDER BY a.data_cadastro DESC
          LIMIT 50
        `
      : await prisma.$queryRaw`
          SELECT a.id
          FROM ccz_animais a
          ORDER BY a.data_cadastro DESC
          LIMIT 50
        `;

    const ids = encontrados.map((r) => r.id);
    if (ids.length === 0) return { success: true, data: [] };

    const registros = await prisma.animal.findMany({
      where: { id: { in: ids } },
      orderBy: { dataCadastro: "desc" },
      include: {
        tutor: {
          include: {
            pessoa: {
              include: { enderecos: { where: { enderecoAtual: true } } },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: registros.map((a) => {
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
                sexo: pessoa.sexo || "",
                dataNascimento: pessoa.dataNascimento || null,
                nomeMae: pessoa.nomeMae || "",
                telefone: pessoa.telefone || "",
                cns: pessoa.cns || "",
                situacao: pessoa.situacao || "",
                endereco: endereco
                  ? {
                      logradouro: endereco.logradouro || "",
                      numero: endereco.numero || "",
                      bairro: endereco.bairro || "",
                      cidade: endereco.cidade || "",
                      uf: endereco.uf || "",
                      cep: endereco.cep || "",
                    }
                  : null,
              }
            : null,
        };
      }),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao buscar animais (Leishmaniose):", error);
    return { success: false, error: "Erro ao buscar animais." };
  }
}

// ── SALVAR ─────────────────────────────────────────────────────────────────
function normalizarEquipe(lista, responsavel) {
  const linhas = Array.isArray(lista) ? lista : [];
  const extras = linhas
    .map((l) => ({ nome: texto(l?.nome), cargo: opcional(l?.cargo) }))
    .filter((l) => l.nome)
    .slice(0, 20)
    .map((l, i) => ({
      ...l,
      ordem: i + 1,
      usuarioCpf: null,
      naoRemovivel: false,
    }));

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
    if (!animalId)
      return { success: false, error: "Selecione o animal da fiscalização." };

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        tutor: {
          include: {
            pessoa: {
              include: { enderecos: { where: { enderecoAtual: true } } },
            },
          },
        },
      },
    });
    if (!animal)
      return { success: false, error: "Animal não encontrado.", status: 404 };

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
      return {
        success: false,
        error: "Não foi possível identificar o usuário responsável.",
      };
    }

    // Acompanhamento periódico pelo CCZ exige a data do retorno (ela gera o
    // agendamento na Agenda do CCZ).
    const encAcompanhamento = Boolean(dados.encAcompanhamento);
    const retornoCcz = dataOuNull(dados.retornoData);
    if (encAcompanhamento && !retornoCcz) {
      return {
        success: false,
        error: "Informe a data do retorno ao CCZ.",
        status: 400,
      };
    }

    // Datas da Agenda de Acompanhamento (uma por visita). Somente quando o
    // acompanhamento periódico está marcado.
    const diasAgenda = encAcompanhamento
      ? (Array.isArray(dados.visitas) ? dados.visitas : [])
          .map((v) => ymdParaDataUtc(v?.data))
          .filter(Boolean)
      : [];

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
      animalSexo:
        animal.sexo === "F"
          ? "Fêmea"
          : animal.sexo === "M"
            ? "Macho"
            : animal.sexo || null,
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
      posologiaCorreta: SIM_NAO(dados.posologiaCorreta, [
        "Sim",
        "Não",
        "Parcialmente",
      ]),
      interrupcao: SIM_NAO(dados.interrupcao, ["Sim", "Não"]),
      interrupcaoMotivo: opcional(dados.interrupcaoMotivo),
      retornoVeterinario: SIM_NAO(dados.retornoVeterinario, ["Sim", "Não"]),
      retornoData: retornoCcz,

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
      outrosComLesoes: SIM_NAO(dados.outrosComLesoes, [
        "Sim",
        "Não",
        "Não Avaliado",
      ]),
      outrosComLesoesDesc: opcional(dados.outrosComLesoesDesc),
      pessoasComLesoes: SIM_NAO(dados.pessoasComLesoes, ["Sim", "Não"]),
      pessoasComLesoesDesc: opcional(dados.pessoasComLesoesDesc),
      pessoasOrientadas: SIM_NAO(dados.pessoasOrientadas, ["Sim", "Não"]),
      pessoasOrientadasDesc: opcional(dados.pessoasOrientadasDesc),

      // 6. Condições do ambiente
      condicoesSanitarias: SIM_NAO(dados.condicoesSanitarias, [
        "Boas",
        "Regulares",
        "Ruins",
      ]),
      condicoesObs: opcional(dados.condicoesObs),
      riscoDisseminacao: SIM_NAO(dados.riscoDisseminacao, ["Sim", "Não"]),
      riscoSaudePublica: SIM_NAO(dados.riscoSaudePublica, ["Sim", "Não"]),
      riscoDescricao: opcional(dados.riscoDescricao),

      // 7. Orientações e comprometimento (somente com tutor)
      orientZoonose: semTutor
        ? null
        : SIM_NAO(dados.orientZoonose, ["Sim", "Não"]),
      orientTratamento: semTutor
        ? null
        : SIM_NAO(dados.orientTratamento, ["Sim", "Não"]),
      orientColeira: semTutor
        ? null
        : SIM_NAO(dados.orientColeira, ["Sim", "Não"]),
      orientNovasLesoes: semTutor
        ? null
        : SIM_NAO(dados.orientNovasLesoes, ["Sim", "Não"]),
      orientObrigacoes: semTutor
        ? null
        : SIM_NAO(dados.orientObrigacoes, ["Sim", "Não"]),
      comprometimento: semTutor
        ? null
        : SIM_NAO(dados.comprometimento, ["Sim", "Parcialmente", "Não"]),

      // 8. Conclusão da equipe técnica
      condutaTutor: semTutor
        ? null
        : SIM_NAO(dados.condutaTutor, [
            "Adequada",
            "Parcialmente adequada",
            "Inadequada",
          ]),
      situacaoGeral: SIM_NAO(dados.situacaoGeral, [
        "Animal sob tratamento e isolamento adequados",
        "Animal em risco, requer reforço de conduta",
        "Risco à saúde pública, encaminhamentos necessários",
      ]),
      encAcompanhamento,
      encNotificacao: semTutor ? false : Boolean(dados.encNotificacao),
      encMinisterioPublico: Boolean(dados.encMinisterioPublico),
      encOutrasMedidas: Boolean(dados.encOutrasMedidas),
      encOutrasDescricao: opcional(dados.encOutrasDescricao),

      // 10. Situação do caso — todo registro novo nasce EM ACOMPANHAMENTO.
      // O encerramento só muda pela ação encerrarCasoLeishmaniose.
      ...(idExistente ? {} : { situacaoCaso: SITUACAO_CASO.EM_ACOMPANHAMENTO }),

      // 9. Assinaturas
      coordenadorNome: opcional(dados.coordenadorNome),
      coordenadorCargo: opcional(dados.coordenadorCargo),
      criadoPor: user.cpf,
    };

    const salvo = await prisma.$transaction(async (tx) => {
      let registro;
      if (idExistente) {
        const atual = await tx.leishmaniose.findUnique({
          where: { id: idExistente },
        });
        if (!atual)
          throw Object.assign(new Error("Fiscalização não encontrada."), {
            status: 404,
          });
        registro = await tx.leishmaniose.update({
          where: { id: idExistente },
          data: base,
        });
        await tx.leishmanioseEquipe.deleteMany({
          where: { leishmanioseId: idExistente },
        });
        await tx.leishmanioseVeterinario.deleteMany({
          where: { leishmanioseId: idExistente },
        });
      } else {
        registro = await tx.leishmaniose.create({
          data: { id: randomUUID(), ...base },
        });
      }

      await tx.leishmanioseEquipe.createMany({
        data: equipe.map((l) => ({
          id: randomUUID(),
          leishmanioseId: registro.id,
          ...l,
        })),
      });
      if (veterinarios.length) {
        await tx.leishmanioseVeterinario.createMany({
          data: veterinarios.map((l) => ({
            id: randomUUID(),
            leishmanioseId: registro.id,
            ...l,
          })),
        });
      }

      // AGENDA DO CCZ: cada data da Agenda de Acompanhamento gera um
      // agendamento ligado a ESTA fiscalização (mesmo fluxo da Esporotricose).
      // O vínculo com a origem fica em data_retorno do procedimento; o
      // agendamento é único por animal + tipo + data (sem duplicar).
      if (base.encAcompanhamento) {
        const agora = new Date();
        const hoje = Date.UTC(
          agora.getFullYear(),
          agora.getMonth(),
          agora.getDate(),
        );
        for (const dia of diasAgenda) {
          const ymd = dataParaYmd(dia);
          if (!ymd) continue;
          if (dia.getTime() < hoje) {
            await concluirRetorno(tx, {
              animalId: registro.animalId,
              tipo: RETORNO_LEISHMANIOSE,
              data: ymd,
              origemId: registro.id,
              veterinario: registro.responsavelNome,
              descricao: "Visita de acompanhamento de leishmaniose",
            });
          } else {
            await agendarRetorno(tx, {
              animalId: registro.animalId,
              tipo: RETORNO_LEISHMANIOSE,
              data: ymd,
              origemId: registro.id,
              veterinario: registro.responsavelNome,
              descricao: "Visita de acompanhamento de leishmaniose",
            });
          }
        }
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
    const situacaoCaso = texto(filtros.situacaoCaso);
    if (situacaoCaso)
      condicoes.push(Prisma.sql`f.situacao_caso = ${situacaoCaso}`);
    const bairro = texto(filtros.bairro);
    if (bairro)
      condicoes.push(
        Prisma.sql`lower(btrim(COALESCE(f.tutor_bairro, ''))) = lower(${bairro})`,
      );

    const where = condicoes.length
      ? Prisma.join(condicoes, " AND ")
      : Prisma.sql`1=1`;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * PAGINA_TAMANHO;

    const [linhas, total] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT f.id, f.data_fiscalizacao, f.animal_nome, f.animal_id, f.tutor_nome,
               f.situacao_geral, f.situacao_caso, f.desfecho
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
        dataFiscalizacao:
          l.data_fiscalizacao instanceof Date
            ? l.data_fiscalizacao.toISOString().slice(0, 10)
            : String(l.data_fiscalizacao).slice(0, 10),
        animalNome: l.animal_nome || "",
        animalId: l.animal_id,
        tutorNome: l.tutor_nome || "",
        situacaoGeral: l.situacao_geral || "",
        situacaoCaso: l.situacao_caso || SITUACAO_CASO.EM_ACOMPANHAMENTO,
        desfecho: l.desfecho || "",
      })),
      total: Number(total?.[0]?.total || 0),
      pagina,
      totalPaginas: Math.max(
        1,
        Math.ceil(Number(total?.[0]?.total || 0) / PAGINA_TAMANHO),
      ),
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
    if (!f)
      return {
        success: false,
        error: "Fiscalização não encontrada.",
        status: 404,
      };

    const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    return {
      success: true,
      data: {
        ...f,
        dataFiscalizacao: ymd(f.dataFiscalizacao),
        tratamentoInicio: ymd(f.tratamentoInicio),
        retornoData: ymd(f.retornoData),
        dataEncerramento: ymd(f.dataEncerramento),
        situacaoCaso: f.situacaoCaso || SITUACAO_CASO.EM_ACOMPANHAMENTO,
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
        dataFiscalizacao: new Date(r.dataFiscalizacao)
          .toISOString()
          .slice(0, 10),
        responsavelNome: r.responsavelNome,
        situacaoGeral: r.situacaoGeral || "",
      })),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// ── ENCERRAR CASO ──────────────────────────────────────────────────────────
// Encerra o acompanhamento da fiscalização informada. A fiscalização NÃO é
// excluída nem reescrita: recebem-se apenas a situação, o desfecho, a data e
// a justificativa. O desfecho é sempre informado pelo profissional.
export async function encerrarCasoLeishmaniose(dados = {}) {
  try {
    const user = await requirePermissao(MODULOS.CCZ, FUNCIONALIDADE, "editar");

    const id = texto(dados.id);
    if (!id)
      return {
        success: false,
        error: "Fiscalização não informada.",
        status: 400,
      };

    const desfecho = texto(dados.desfecho);
    if (!DESFECHO_CASO.includes(desfecho)) {
      return {
        success: false,
        error: "Informe o desfecho do caso: Curado ou Incinerado.",
        status: 400,
      };
    }

    const dataEncerramento = dataOuNull(dados.dataEncerramento);
    if (!dataEncerramento) {
      return {
        success: false,
        error: "Informe a data do encerramento.",
        status: 400,
      };
    }

    const justificativa = texto(dados.justificativa);
    if (justificativa.length < 15 || justificativa.length > 500) {
      return {
        success: false,
        error:
          "A justificativa do encerramento deve ter entre 15 e 500 caracteres.",
        status: 400,
      };
    }

    const atual = await prisma.leishmaniose.findUnique({ where: { id } });
    if (!atual)
      return {
        success: false,
        error: "Fiscalização não encontrada.",
        status: 404,
      };
    if (atual.situacaoCaso === SITUACAO_CASO.ENCERRADO) {
      return {
        success: false,
        error: "Este caso já está encerrado.",
        status: 409,
      };
    }

    const salvo = await prisma.leishmaniose.update({
      where: { id },
      data: {
        situacaoCaso: SITUACAO_CASO.ENCERRADO,
        desfecho,
        dataEncerramento,
        justificativaEncerramento: justificativa,
        encerradoPorCpf: user.cpf,
        encerradoPorNome: user.nome || "",
        encerradoEm: new Date(),
      },
    });

    await registrarAuditoria({
      user,
      acao: "ENCERRAR",
      modulo: "CCZ",
      entidade: "Leishmaniose",
      entidadeId: id,
      descricao: `Encerramento do acompanhamento de leishmaniose (${desfecho})`,
      detalhes: {
        desfecho,
        dataEncerramento: dataEncerramento.toISOString().slice(0, 10),
        justificativa,
        situacaoAnterior: atual.situacaoCaso || SITUACAO_CASO.EM_ACOMPANHAMENTO,
        situacaoNova: SITUACAO_CASO.ENCERRADO,
        animalId: salvo.animalId,
      },
    });

    return {
      success: true,
      data: { id, desfecho, situacaoCaso: SITUACAO_CASO.ENCERRADO },
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
