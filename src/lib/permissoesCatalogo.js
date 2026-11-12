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
    [PERFIS.OPERADOR]: {
      novo_pedido: [V, C, E, X],
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
      movimentacoes: [V, C, E],
      documentos: [V, C, X, EXP],
      acompanhamento: [V, E, EXP],
    },
    [PERFIS.SUPERVISOR]: {
      consulta: [V, EXP],
      movimentacoes: [V, C, E],
      documentos: [V, EXP],
      acompanhamento: [V, E, EXP],
    },
    [PERFIS.OPERADOR]: {
      consulta: [V],
      movimentacoes: [V, C, E],
      documentos: [V, C],
    },
    [PERFIS.CONSULTA]: {
      consulta: [V],
    },
    [PERFIS.AUDITOR]: {
      consulta: [V, EXP],
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

/** Perfil padrão de um módulo (usado quando a gestão não escolhe outro). */
export function perfilPadraoDoModulo(modulo) {
  return MODULOS_CATALOGO[modulo] ? PERFIS.OPERADOR : null;
}

/**
 * Valida uma configuração de acesso vinda da interface/API.
 * Devolve { ok, erros[] }. Fail-closed: qualquer item fora do catálogo reprova.
 */
export function validarConfiguracao({ modulo, perfil, servicos, funcionalidades, permissoes }) {
  const erros = [];
  const cat = MODULOS_CATALOGO[modulo];
  if (!cat) return { ok: false, erros: [`Módulo desconhecido: ${modulo}`] };
  if (!PERFIS_INFO[perfil]) erros.push(`Perfil desconhecido: ${perfil}`);

  const servicosValidos = cat.escopoServico ? Object.values(cat.escopoServico) : [];
  for (const s of servicos || []) {
    if (!servicosValidos.includes(s)) {
      erros.push(`Serviço inválido para ${cat.nome}: ${s}`);
    }
  }
  if (cat.escopoServico && (!servicos || servicos.length === 0) && perfil !== PERFIS.ADMINISTRADOR) {
    erros.push(`Informe ao menos um serviço de ${cat.nome}.`);
  }

  const chaves = new Set(cat.funcionalidades.map((f) => f.chave));
  for (const f of funcionalidades || []) {
    if (!chaves.has(f)) erros.push(`Funcionalidade inválida em ${cat.nome}: ${f}`);
  }

  for (const item of permissoes || []) {
    const [func, perm] = String(item).split(':');
    const def = cat.funcionalidades.find((f) => f.chave === func);
    if (!def) {
      erros.push(`Permissão para funcionalidade inexistente: ${item}`);
      continue;
    }
    if (!def.permissoes.includes(perm)) {
      erros.push(`A funcionalidade "${def.nome}" não oferece a permissão "${perm}".`);
    }
  }

  return { ok: erros.length === 0, erros };
}
