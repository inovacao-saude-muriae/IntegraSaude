// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE AUTORIZAÇÃO — MÓDULO → PERFIL → SERVIÇO → FUNCIONALIDADE → PERMISSÃO
// ─────────────────────────────────────────────────────────────────────────
// Este arquivo é DECLARATIVO: descreve o que existe em cada módulo, quais
// perfis existem, quais permissões cada funcionalidade oferece e qual é o
// pacote padrão de cada perfil.
//
// Ele NÃO autoriza nada por si. A decisão continua em `lib/permissions.js` e
// nas guardas de `lib/auth.js`, que consultam o vínculo gravado no banco.
// Hoje o vínculo é `UserAcesso (modulo, nivel, servicoJunta)`; o catálogo
// descreve o alvo e é consumido pela prévia de conversão e pela futura tela
// de gerenciamento por módulo.
//
// Regra: fail-closed. Funcionalidade, perfil ou permissão fora deste catálogo
// não existe — e o que não existe é negado.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Módulos (espelham o enum ModuloAcesso) ───────────────────────────────
export const MODULOS = {
  REGULACAO: 'REGULACAO',
  FARMACIA: 'FARMACIA',
  PROCESSOS: 'PROCESSOS',
  JUNTA: 'JUNTA',
  CCZ: 'CCZ',
  // Gestão Geral NÃO é módulo operacional: é um conjunto próprio de
  // permissões administrativas, sem acesso automático a dados de módulo.
  GESTAO: 'GESTAO',
};

// ── 2. Serviços por módulo (subdivisão operacional) ─────────────────────────
// A Junta usa o enum ServicoJunta. A Câmara Técnica tem dois serviços com
// operações e dados próprios (Farmácia Judicial e Processos), modelados como
// módulos distintos — por isso FARMACIA e PROCESSOS aparecem aqui sem
// sub-serviço: a separação já existe no enum.
export const SERVICOS_JUNTA = {
  CAEE: 'CAEE',
  APAE: 'APAE',
  AMBULATORIO: 'AMBULATORIO',
  ESPECIALIDADES: 'ESPECIALIDADES',
};

export const SERVICOS = {
  REGULACAO: null, // futuro: UBS (campo preparado, sem ativação)
  FARMACIA: null,
  PROCESSOS: null,
  JUNTA: SERVICOS_JUNTA,
  CCZ: null,
};

// ── 3. Perfis por módulo ────────────────────────────────────────────────────
// Sem hierarquia rígida: cada perfil recebe um pacote explícito de permissões.
// ADMINISTRADOR não herda automaticamente SUPERVISOR, e assim por diante.
export const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  SUPERVISOR: 'SUPERVISOR',
  OPERADOR: 'OPERADOR',
  CONSULTA: 'CONSULTA',
  AUDITOR: 'AUDITOR',
};

export const PERFIS_INFO = {
  [PERFIS.ADMINISTRADOR]: {
    nome: 'Administrador do Módulo',
    descricao:
      'Gerencia configurações e operações do módulo. Não recebe acesso aos outros módulos nem à administração global de segurança.',
  },
  [PERFIS.SUPERVISOR]: {
    nome: 'Supervisor',
    descricao:
      'Acompanha processos, analisa solicitações e executa as aprovações expressamente autorizadas.',
  },
  [PERFIS.OPERADOR]: {
    nome: 'Operador',
    descricao:
      'Executa as atividades operacionais do dia a dia: cadastrar, atualizar e registrar atendimentos.',
  },
  [PERFIS.CONSULTA]: {
    nome: 'Consulta',
    descricao: 'Somente visualização das informações e telas autorizadas.',
  },
  [PERFIS.AUDITOR]: {
    nome: 'Auditor',
    descricao:
      'Acesso de auditoria: consulta o histórico de alterações e relatórios, sem alterar dados operacionais.',
  },
};

// ── 4. Permissões padronizadas ──────────────────────────────────────────────
export const PERMISSOES = {
  VISUALIZAR: 'visualizar',
  CRIAR: 'criar',
  EDITAR: 'editar',
  CANCELAR: 'cancelar',
  EXCLUIR: 'excluir',
  APROVAR: 'aprovar',
  LIBERAR: 'liberar',
  DISPENSAR: 'dispensar',
  EXPORTAR: 'exportar',
  GERENCIAR: 'gerenciar',
};

// Nome legível de cada permissão (para a tela e para os relatórios).
export const PERMISSOES_INFO = {
  [PERMISSOES.VISUALIZAR]: 'Visualizar',
  [PERMISSOES.CRIAR]: 'Criar',
  [PERMISSOES.EDITAR]: 'Editar',
  [PERMISSOES.CANCELAR]: 'Cancelar',
  [PERMISSOES.EXCLUIR]: 'Excluir',
  [PERMISSOES.APROVAR]: 'Aprovar',
  [PERMISSOES.LIBERAR]: 'Liberar',
  [PERMISSOES.DISPENSAR]: 'Dispensar',
  [PERMISSOES.EXPORTAR]: 'Exportar',
  [PERMISSOES.GERENCIAR]: 'Gerenciar',
};

const V = PERMISSOES.VISUALIZAR;
const C = PERMISSOES.CRIAR;
const E = PERMISSOES.EDITAR;
const X = PERMISSOES.EXCLUIR;
const A = PERMISSOES.APROVAR;
const L = PERMISSOES.LIBERAR;
const D = PERMISSOES.DISPENSAR;
const EXP = PERMISSOES.EXPORTAR;
const G = PERMISSOES.GERENCIAR;

// ── 5. Funcionalidades por módulo ───────────────────────────────────────────
// Cada funcionalidade declara APENAS as permissões que existem de fato nela.
// `acoesServidor` documenta o que a funcionalidade executa hoje no backend,
// para que a futura checagem por permissão seja ligada sem achismo.
export const MODULOS_CATALOGO = {
  [MODULOS.REGULACAO]: {
    chave: MODULOS.REGULACAO,
    nome: 'Regulação de Exames',
    escopoServico: null,
    escopoUnidade: 'ubs', // preparado; não ativo nesta fase
    funcionalidades: [
      { chave: 'novo_pedido', nome: 'Novo Pedido', permissoes: [V, C, E, X] },
      { chave: 'lista_espera', nome: 'Lista de Espera', permissoes: [V, E, L, EXP] },
      { chave: 'liberados', nome: 'Liberados', permissoes: [V, E, L] },
      { chave: 'financeiro', nome: 'Financeiro', permissoes: [V, E, EXP] },
      { chave: 'procedimentos', nome: 'Procedimentos', permissoes: [V, C, E, X] },
      { chave: 'medicos', nome: 'Médicos', permissoes: [V, C, E, X] },
      { chave: 'ubs', nome: 'UBS', permissoes: [V, C, E, X] },
      { chave: 'dashboard', nome: 'Dashboard', permissoes: [V, EXP] },
      { chave: 'auditoria', nome: 'Auditoria de Alterações', permissoes: [V, EXP] },
    ],
  },

  [MODULOS.FARMACIA]: {
    chave: MODULOS.FARMACIA,
    nome: 'Farmácia Judicial',
    servicoPai: 'Câmara Técnica',
    escopoServico: null,
    funcionalidades: [
      { chave: 'pacientes', nome: 'Pacientes', permissoes: [V, C, E] },
      { chave: 'medicamentos', nome: 'Medicamentos', permissoes: [V, C, E, X] },
      { chave: 'estoque', nome: 'Estoque', permissoes: [V, C, E, G] },
      { chave: 'dispensacao', nome: 'Dispensação', permissoes: [V, C, D, EXP] },
      { chave: 'relatorios', nome: 'Relatórios', permissoes: [V, EXP] },
      { chave: 'dashboard', nome: 'Dashboard', permissoes: [V, EXP] },
    ],
  },

  [MODULOS.PROCESSOS]: {
    chave: MODULOS.PROCESSOS,
    nome: 'Processos Judiciais',
    servicoPai: 'Câmara Técnica',
    escopoServico: null,
    funcionalidades: [
      { chave: 'novo_processo', nome: 'Novo Processo', permissoes: [C] },
      { chave: 'consulta', nome: 'Consulta de Processos', permissoes: [V, EXP] },
      // Funcionalidade dos PROCESSOS JUDICIAIS (tabela processos_judiciais).
      // Permissões independentes: quem cria não ganha editar nem excluir.
      {
        chave: 'processo_judicial',
        nome: 'Processos Judiciais (consultar, editar, excluir)',
        permissoes: [V, C, E, X],
      },
      // Catálogo PRÓPRIO da área Processos (tabelas processos_especialidades,
      // processos_procedimentos e o vínculo entre eles). Independente da Junta
      // Reguladora: nenhuma permissão daqui abre a Junta, e vice-versa.
      //   C = cadastrar   E = editar   "inativar" = ativar/desativar o item
      //   L = liberar/gerenciar os vínculos especialidade ↔ procedimento
      // (Nada de exclusão: o catálogo nunca apaga um item — inativa.)
      {
        chave: 'catalogo_especialidades',
        nome: 'Especialidades dos Processos',
        permissoes: [V, C, E, X],
      },
      {
        chave: 'catalogo_procedimentos',
        nome: 'Procedimentos dos Processos',
        // "inativar" e "vincular" não usam os códigos X/L: no catálogo central
        // X é "excluir" e L é "liberar". Aqui são permissões próprias e nominais.
        permissoes: [V, C, E, "inativar", "vincular"],
      },
      { chave: 'movimentacoes', nome: 'Movimentações', permissoes: [V, C, E] },
      { chave: 'documentos', nome: 'Documentos', permissoes: [V, C, X, EXP] },
      { chave: 'acompanhamento', nome: 'Acompanhamento e Relatórios', permissoes: [V, E, EXP] },
    ],
  },

  [MODULOS.JUNTA]: {
    chave: MODULOS.JUNTA,
    nome: 'Junta Reguladora',
    escopoServico: SERVICOS_JUNTA,
    funcionalidades: [
      { chave: 'novo_pedido', nome: 'Novo Pedido', permissoes: [V, C, E] },
      { chave: 'servicos', nome: 'Serviços', permissoes: [V, C, E, EXP] },
      { chave: 'agendas', nome: 'Agendas', permissoes: [V, C, E, X] },
      { chave: 'prontuario', nome: 'Prontuário', permissoes: [V, EXP] },
      { chave: 'dashboard', nome: 'Dashboard', permissoes: [V, EXP] },
    ],
  },

  [MODULOS.CCZ]: {
    chave: MODULOS.CCZ,
    nome: 'CCZ',
    escopoServico: null,
    funcionalidades: [
      { chave: 'procedimentos', nome: 'Procedimentos', permissoes: [V, C, E, X] },
      { chave: 'zoonoses', nome: 'Zoonoses', permissoes: [V, C, E] },
      { chave: 'denuncias', nome: 'Denúncias', permissoes: [V, C, E, X] },
      { chave: 'agenda', nome: 'Agenda', permissoes: [V, C, E, X] },
      { chave: 'animais', nome: 'Animais', permissoes: [V, C, E, X] },
      { chave: 'termos', nome: 'Termos', permissoes: [V, C, E, EXP] },
      { chave: 'tutores', nome: 'Tutores', permissoes: [V, C, E] },
      { chave: 'dashboard', nome: 'Dashboard', permissoes: [V, EXP] },
    ],
  },

  [MODULOS.GESTAO]: {
    chave: MODULOS.GESTAO,
    nome: 'Gestão Geral',
    administracao: true,
    escopoServico: null,
    funcionalidades: [
      { chave: 'painel', nome: 'Painel Gerencial', permissoes: [V] },
      { chave: 'indicadores', nome: 'Indicadores Consolidados', permissoes: [V, EXP] },
      { chave: 'usuarios', nome: 'Usuários', permissoes: [V, C, E, G] },
      { chave: 'pessoas', nome: 'Cadastro de Pessoas', permissoes: [V, C, E] },
      { chave: 'acessos', nome: 'Perfis e Acessos', permissoes: [V, C, E, G] },
      { chave: 'relatorios', nome: 'Relatórios Gerais', permissoes: [V, EXP] },
      { chave: 'auditoria', nome: 'Auditoria Global', permissoes: [V, EXP] },
      { chave: 'unidades', nome: 'UBS e Serviços', permissoes: [V, C, E, X] },
    ],
  },
};

// ── 6. Pacote padrão de cada perfil, por módulo ─────────────────────────────
// Mapa: modulo → perfil → { funcionalidade: [permissões] }.
// Funcionalidade ausente = sem acesso àquela funcionalidade.
// `'*'` = todas as permissões declaradas para a funcionalidade.
//
// Estes pacotes reproduzem o comportamento AUTORIZADO hoje (verificado no
// código das server actions) e acrescentam apenas o que a gestão pediu
// (Supervisor, Consulta, Auditor). A conversão da prévia usa estes valores.
const PACOTES = {
  [MODULOS.REGULACAO]: {
    // Hoje: OPERADOR cria/edita pedidos, atualiza comunicação, libera e exclui
    // pedidos; Financeiro é leitura para ele. ADMIN também salva cotas e
    // planejamento, gerencia médicos, UBS e procedimentos.
    [PERFIS.ADMINISTRADOR]: {
      novo_pedido: [V, C, E, X],
      lista_espera: [V, E, L, EXP],
      liberados: [V, E, L],
      financeiro: [V, E, EXP],
      procedimentos: [V, C, E, X],
      medicos: [V, C, E, X],
      ubs: [V, C, E, X],
      dashboard: [V, EXP],
      auditoria: [V, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      novo_pedido: [V, C, E],
      lista_espera: [V, E, L, EXP],
      liberados: [V, E, L],
      financeiro: [V],
      dashboard: [V, EXP],
    },
    // Exclusão definitiva de pedido NÃO é padrão do Operador: cancelar
    // preserva o registro (status Cancelado) e é a operação do dia a dia.
    [PERFIS.OPERADOR]: {
      novo_pedido: [V, C, E],
      lista_espera: [V, E, L],
      liberados: [V, E, L],
      financeiro: [V],
      dashboard: [V],
    },
    [PERFIS.CONSULTA]: {
      novo_pedido: [V],
      lista_espera: [V],
      liberados: [V],
      dashboard: [V],
    },
    [PERFIS.AUDITOR]: {
      novo_pedido: [V],
      lista_espera: [V, EXP],
      liberados: [V],
      financeiro: [V, EXP],
      dashboard: [V, EXP],
      auditoria: [V, EXP],
    },
  },

  [MODULOS.FARMACIA]: {
    // Hoje: ADMIN faz tudo; OPERADOR consulta e registra dispensação.
    [PERFIS.ADMINISTRADOR]: {
      pacientes: [V, C, E],
      medicamentos: [V, C, E, X],
      estoque: [V, C, E, G],
      dispensacao: [V, C, D, EXP],
      relatorios: [V, EXP],
      dashboard: [V, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      pacientes: [V, C, E],
      medicamentos: [V],
      estoque: [V, E],
      dispensacao: [V, C, D, EXP],
      relatorios: [V, EXP],
      dashboard: [V, EXP],
    },
    [PERFIS.OPERADOR]: {
      pacientes: [V],
      medicamentos: [V],
      estoque: [V],
      dispensacao: [V, C, D],
      dashboard: [V],
    },
    [PERFIS.CONSULTA]: {
      pacientes: [V],
      medicamentos: [V],
      estoque: [V],
      dashboard: [V],
    },
    [PERFIS.AUDITOR]: {
      pacientes: [V],
      medicamentos: [V],
      estoque: [V],
      dispensacao: [V, EXP],
      relatorios: [V, EXP],
      dashboard: [V, EXP],
    },
  },

  [MODULOS.PROCESSOS]: {
    // Hoje o módulo está em construção: só ADMIN tem vínculo.
    [PERFIS.ADMINISTRADOR]: {
      novo_processo: [C],
      consulta: [V, EXP],
      // Exclusão definitiva de processo é permissão EXCEPCIONAL: fica com o
      // Administrador do módulo, sempre com confirmação e checagem de vínculos.
      processo_judicial: [V, C, E, X],
      // Administrador do módulo mantém o catálogo completo.
      catalogo_especialidades: [V, C, E, "inativar"],
      catalogo_procedimentos: [V, C, E, "inativar", "vincular"],
      movimentacoes: [V, C, E],
      documentos: [V, C, X, EXP],
      acompanhamento: [V, E, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      consulta: [V, EXP],
      // Supervisor edita, mas NÃO exclui.
      processo_judicial: [V, C, E],
      catalogo_especialidades: [V, C, E, "inativar"],
      catalogo_procedimentos: [V, C, E, "inativar", "vincular"],
      movimentacoes: [V, C, E],
      documentos: [V, EXP],
      acompanhamento: [V, E, EXP],
    },
    [PERFIS.OPERADOR]: {
      consulta: [V],
      // Operador cadastra e corrige; exclusão não é dele.
      processo_judicial: [V, C, E],
      // Operador consulta o catálogo, mas não o altera.
      catalogo_especialidades: [V],
      catalogo_procedimentos: [V],
      movimentacoes: [V, C, E],
      documentos: [V, C],
    },
    [PERFIS.CONSULTA]: {
      consulta: [V],
      processo_judicial: [V],
      catalogo_especialidades: [V],
      catalogo_procedimentos: [V],
    },
    [PERFIS.AUDITOR]: {
      consulta: [V, EXP],
      processo_judicial: [V],
      catalogo_especialidades: [V],
      catalogo_procedimentos: [V],
      acompanhamento: [V, EXP],
    },
  },

  [MODULOS.JUNTA]: {
    // Hoje: ADMIN cadastra paciente, vê prontuário e gerencia serviços; o
    // OPERADOR de sub-serviço lê os dados do seu serviço e cria/registra
    // agendamentos e atendimentos.
    [PERFIS.ADMINISTRADOR]: {
      novo_pedido: [V, C, E],
      servicos: [V, C, E, EXP],
      agendas: [V, C, E, X],
      prontuario: [V, EXP],
      dashboard: [V, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      novo_pedido: [V, C, E],
      servicos: [V, E, EXP],
      agendas: [V, C, E, X],
      prontuario: [V, EXP],
      dashboard: [V, EXP],
    },
    [PERFIS.OPERADOR]: {
      novo_pedido: [V],
      servicos: [V],
      agendas: [V, C, E],
      dashboard: [V],
    },
    [PERFIS.CONSULTA]: {
      servicos: [V],
      agendas: [V],
      dashboard: [V],
    },
    [PERFIS.AUDITOR]: {
      servicos: [V, EXP],
      agendas: [V, EXP],
      prontuario: [V, EXP],
      dashboard: [V, EXP],
    },
  },

  [MODULOS.CCZ]: {
    // Hoje: ADMIN e OPERADOR executam as mesmas 33 ações do módulo (a guarda
    // é só de módulo). O pacote abaixo preserva isso para ADMIN e dá ao
    // OPERADOR o mesmo alcance operacional, sem exclusões destrutivas.
    // Exclusão definitiva é permissão específica (Administrador do CCZ e
    // quem receber `excluir` explicitamente). Operador arquiva/inativa.
    [PERFIS.ADMINISTRADOR]: {
      procedimentos: [V, C, E, X],
      zoonoses: [V, C, E],
      denuncias: [V, C, E, X],
      agenda: [V, C, E, X],
      animais: [V, C, E, X],
      termos: [V, C, E, EXP],
      tutores: [V, C, E],
      dashboard: [V, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      procedimentos: [V, C, E],
      zoonoses: [V, C, E],
      denuncias: [V, C, E],
      agenda: [V, C, E],
      animais: [V, C, E],
      termos: [V, C, EXP],
      tutores: [V, C, E],
      dashboard: [V, EXP],
    },
    [PERFIS.OPERADOR]: {
      procedimentos: [V, C, E],
      zoonoses: [V, C, E],
      denuncias: [V, C, E],
      agenda: [V, C, E],
      animais: [V, C, E],
      termos: [V, C, EXP],
      tutores: [V, C, E],
      dashboard: [V],
    },
    [PERFIS.CONSULTA]: {
      procedimentos: [V],
      zoonoses: [V],
      denuncias: [V],
      agenda: [V],
      animais: [V],
      termos: [V],
      tutores: [V],
      dashboard: [V],
    },
    [PERFIS.AUDITOR]: {
      procedimentos: [V, EXP],
      zoonoses: [V, EXP],
      denuncias: [V, EXP],
      agenda: [V, EXP],
      animais: [V, EXP],
      termos: [V, EXP],
      tutores: [V, EXP],
      dashboard: [V, EXP],
    },
  },

  // Gestão Geral: permissões administrativas nomeadas. Não inclui prontuário,
  // processo judicial nem ficha do CCZ — esses exigem vínculo de módulo.
  [MODULOS.GESTAO]: {
    [PERFIS.ADMINISTRADOR]: {
      painel: [V],
      indicadores: [V, EXP],
      usuarios: [V, C, E, G],
      acessos: [V, C, E, G],
      pessoas: [V, C, E],
      relatorios: [V, EXP],
      auditoria: [V, EXP],
      unidades: [V, C, E, X],
    },
    [PERFIS.SUPERVISOR]: {
      painel: [V],
      indicadores: [V, EXP],
      usuarios: [V],
      acessos: [V],
      pessoas: [V],
      relatorios: [V, EXP],
      auditoria: [V, EXP],
      unidades: [V, E],
    },
    [PERFIS.OPERADOR]: {
      painel: [V],
      indicadores: [V],
      relatorios: [V],
    },
    [PERFIS.CONSULTA]: {
      painel: [V],
      relatorios: [V],
    },
    [PERFIS.AUDITOR]: {
      painel: [V],
      indicadores: [V, EXP],
      relatorios: [V, EXP],
      auditoria: [V, EXP],
    },
  },
};

/**
 * Pacote padrão de um perfil num módulo, como lista plana
 * `["funcionalidade:permissao", ...]`. Desconhecido → [] (fail-closed).
 */
export function permissoesPadrao(modulo, perfil) {
  const doModulo = PACOTES[modulo];
  if (!doModulo) return [];
  const doPerfil = doModulo[perfil];
  if (!doPerfil) return [];
  const lista = [];
  for (const [funcionalidade, permissoes] of Object.entries(doPerfil)) {
    for (const p of permissoes) lista.push(`${funcionalidade}:${p}`);
  }
  return lista.sort();
}

/**
 * Resolve as permissões EFETIVAS de um vínculo.
 *
 *   concedidas → o que está fora do pacote do perfil (coluna `permissoes`)
 *   retiradas  → o que foi removido do pacote do perfil (coluna `removidas`)
 *   efetivas   = (pacote do perfil ∪ concedidas) − retiradas
 *
 * Fonte única desta conta: a decisão de autorização (permissions.js), a tela de
 * gerenciamento e o /api/me usam esta função — não há segunda fórmula.
 * Qualquer item fora do catálogo do módulo é descartado (fail-closed).
 */
export function permissoesEfetivas(modulo, perfil, concedidas, retiradas) {
  const cat = MODULOS_CATALOGO[modulo];
  if (!cat || !PERFIS_INFO[perfil]) return [];

  const validas = new Set();
  for (const f of cat.funcionalidades) {
    for (const p of f.permissoes) validas.add(`${f.chave}:${p}`);
  }

  const pacote = permissoesPadrao(modulo, perfil);
  const efetivas = new Set(pacote);
  for (const item of concedidas || []) {
    if (validas.has(item)) efetivas.add(item);
  }
  for (const item of retiradas || []) {
    efetivas.delete(item); // retirar algo que não está no pacote é inócuo
  }
  return [...efetivas].sort();
}

/**
 * Separa o que é do pacote do perfil do que foi personalizado, para a tela
 * mostrar com clareza (herdada / concedida / retirada).
 */
export function detalharPermissoes(modulo, perfil, concedidas, retiradas) {
  const pacote = permissoesPadrao(modulo, perfil);
  const conjuntoPacote = new Set(pacote);
  const ret = new Set((retiradas || []).filter((i) => conjuntoPacote.has(i)));
  const extra = new Set((concedidas || []).filter((i) => !conjuntoPacote.has(i)));
  return {
    pacote,
    herdadas: pacote.filter((i) => !ret.has(i)),
    removidas: [...ret],
    concedidas: [...extra],
    efetivas: permissoesEfetivas(modulo, perfil, concedidas, retiradas),
  };
}

/**
 * Uma permissão é "operacional" quando não é leitura/exportação de painel.
 * Sem serviço nenhum, permissão operacional não faz sentido.
 */
function temFuncionalidadesOperacionais(permissoes, removidas) {
  const LEITURA = ["visualizar", "exportar"];
  const retiradas = new Set(removidas || []);
  return (permissoes || []).some((item) => {
    if (retiradas.has(item)) return false;
    const perm = String(item).split(":")[1];
    return perm && !LEITURA.includes(perm);
  });
}

/** Perfil padrão de um módulo (usado quando a gestão não escolhe outro). */
export function perfilPadraoDoModulo(modulo) {
  return MODULOS_CATALOGO[modulo] ? PERFIS.OPERADOR : null;
}

/**
 * Valida uma configuração de acesso vinda da interface/API.
 * Devolve { ok, erros[] }. Fail-closed: qualquer item fora do catálogo reprova.
 */
export const ESCOPOS = Object.freeze({
  TODOS: "TODOS",
  ESPECIFICOS: "ESPECIFICOS",
  NENHUM: "NENHUM",
});

/** Observação do escopo, para a interface não inventar texto. */
export const ESCOPOS_INFO = {
  TODOS: {
    nome: "Todos os serviços",
    descricao: "Acesso a todos os serviços do módulo. A lista de serviços fica vazia.",
  },
  ESPECIFICOS: {
    nome: "Serviços específicos",
    descricao: "Acesso somente aos serviços marcados. É preciso marcar ao menos um.",
  },
  NENHUM: {
    nome: "Nenhum serviço",
    descricao: "Sem acesso operacional aos serviços. O vínculo existe, mas não alcança serviço.",
  },
};

/**
 * Valida uma configuração de acesso vinda da interface/API.
 * Devolve { ok, erros[] }. Fail-closed: qualquer item fora do catálogo reprova.
 *
 * Regra de escopo (definitiva): o escopo é declarado, nunca deduzido.
 *  • TODOS / NENHUM → `servicos` tem de estar vazio;
 *  • ESPECIFICOS    → `servicos` tem de ter ao menos um item;
 *  • escopo ausente ou desconhecido → reprova (nada de "vazio = tudo").
 */
export function validarConfiguracao({
  modulo,
  perfil,
  escopo,
  servicos,
  funcionalidades,
  permissoes,
  removidas,
}) {
  const erros = [];
  const cat = MODULOS_CATALOGO[modulo];
  if (!cat) return { ok: false, erros: [`Módulo desconhecido: ${modulo}`] };
  if (!PERFIS_INFO[perfil]) erros.push(`Perfil desconhecido: ${perfil}`);

  const listaServicos = Array.isArray(servicos) ? servicos : [];

  // ── Escopo × serviços (coerência) ────────────────────────────────────────
  if (!ESCOPOS[escopo]) {
    erros.push(`Escopo inválido: ${escopo || "(não informado)"}. Use TODOS, ESPECIFICOS ou NENHUM.`);
  } else {
    if (escopo !== ESCOPOS.TODOS && listaServicos.length > 0) {
      erros.push(`O escopo ${ESCOPOS_INFO[escopo].nome} não pode listar serviços.`);
    }
    if (escopo === ESCOPOS.ESPECIFICOS && listaServicos.length === 0) {
      erros.push("O escopo Serviços específicos exige ao menos um serviço marcado.");
    }
    // NENHUM: o vínculo existe mas não alcança serviço nenhum, então só
    // faz sentido se não sobrar permissão operacional — nem concedida, nem
    // herdada do pacote do perfil. Quem não quer nada escolhe outro perfil ou
    // desliga o módulo.
    if (escopo === ESCOPOS.NENHUM) {
      const efetivas = permissoesEfetivas(modulo, perfil, permissoes, removidas);
      if (temFuncionalidadesOperacionais(efetivas, [])) {
        erros.push(
          "Nenhum serviço: retire as permissões operacionais (do pacote e as concedidas) " +
            "ou escolha um escopo com serviços.",
        );
      }
    }
  }

  // ── Serviços válidos para o módulo ──────────────────────────────────────
  const servicosValidos = cat.escopoServico ? Object.values(cat.escopoServico) : [];
  if (listaServicos.length > 0 && servicosValidos.length === 0) {
    erros.push(`${cat.nome} não é organizado por serviço: a lista deve ficar vazia.`);
  }
  for (const s of listaServicos) {
    if (!servicosValidos.includes(s)) {
      erros.push(`Serviço inválido para ${cat.nome}: ${s}`);
    }
  }

  const chaves = new Set(cat.funcionalidades.map((f) => f.chave));
  for (const f of funcionalidades || []) {
    if (!chaves.has(f)) erros.push(`Funcionalidade inválida em ${cat.nome}: ${f}`);
  }

  const validarItem = (item, rotulo) => {
    const [func, perm] = String(item).split(':');
    const def = cat.funcionalidades.find((f) => f.chave === func);
    if (!def) {
      erros.push(`Permissão para funcionalidade inexistente (${rotulo}): ${item}`);
      return;
    }
    if (!def.permissoes.includes(perm)) {
      erros.push(`A funcionalidade "${def.nome}" não oferece a permissão "${perm}" (${rotulo}).`);
    }
  };
  for (const item of permissoes || []) validarItem(item, "concedida");
  for (const item of removidas || []) validarItem(item, "retirada");

  // Conceder e retirar a mesma permissão é contraditório.
  const conjuntoRemovidas = new Set(removidas || []);
  for (const item of permissoes || []) {
    if (conjuntoRemovidas.has(item)) {
      erros.push(`Permissão simultaneamente concedida e retirada: ${item}`);
    }
  }

  return { ok: erros.length === 0, erros };
}
