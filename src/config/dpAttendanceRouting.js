/**
 * Roteamento do Departamento Pessoal — FG Services
 * Cada tema possui atendentes responsáveis e palavras-chave para classificação.
 */

const DP_TOPICS = {
  beneficios: {
    id: 'beneficios',
    label: 'Benefícios',
    agents: ['dp-3@fgservices.com.br', 'dp-6@fgservices.com.br'],
    keywords: [
      'benefício', 'benefícios', 'beneficio', 'beneficios',
      'vale transporte', 'vale-transporte', 'vt',
      'vale alimentação', 'vale alimentacao', 'va',
      'vale refeição', 'vale refeicao', 'vr',
      'plano de saúde', 'plano de saude', 'plano odontológico', 'plano odontologico',
      'convênio', 'convenio', 'cesta básica', 'cesta basica'
    ]
  },
  juridico_arquivo: {
    id: 'juridico_arquivo',
    label: 'Jurídico e Arquivo',
    agents: ['dp-4@fgservices.com.br', 'dp-12@fgservices.com.br'],
    keywords: [
      'jurídico', 'juridico', 'arquivo', 'documentação', 'documentacao',
      'processo trabalhista', 'ação', 'acao', 'petição', 'peticao',
      'certidão', 'certidao', 'atestado de antecedentes'
    ]
  },
  rescisoes: {
    id: 'rescisoes',
    label: 'Rescisões',
    agents: ['dp-5@fgservices.com.br'],
    keywords: [
      'rescisão', 'rescisao', 'rescisões', 'rescisoes',
      'demissão', 'demissao', 'desligamento', 'aviso prévio', 'aviso previo',
      'homologação', 'homologacao', 'trct', 'seguro desemprego'
    ]
  },
  folha_transferencias: {
    id: 'folha_transferencias',
    label: 'Folha e Transferências',
    agents: ['dp-7@fgservices.com.br', 'dp-11@fgservices.com.br'],
    keywords: [
      'folha', 'pagamento', 'holerite', 'contracheque', 'salário', 'salario',
      'férias', 'ferias', '13º', 'décimo terceiro', 'decimo terceiro',
      'transferência', 'transferencia', 'mudança de loja', 'mudanca de loja',
      'encargos', 'inss', 'fgts', 'esocial'
    ]
  },
  admissao: {
    id: 'admissao',
    label: 'Admissão',
    agents: ['dp-8@fgservices.com.br', 'dp-10@fgservices.com.br'],
    keywords: [
      'admissão', 'admissao', 'admitir', 'contratação', 'contratacao',
      'novo colaborador', 'nova contratação', 'nova contratacao',
      'documentos admissionais', 'exame admissional', 'aso'
    ]
  },
  outros_afastamentos: {
    id: 'outros_afastamentos',
    label: 'Outros e Afastamentos',
    agents: ['dp-9@fgservices.com.br'],
    keywords: [
      'afastamento', 'afastamentos', 'licença', 'licenca',
      'maternidade', 'paternidade', 'doença', 'doenca', 'acidente de trabalho',
      'atestado', 'inss', 'auxílio doença', 'auxilio doenca',
      'outros', 'outro assunto', 'dúvida geral', 'duvida geral'
    ]
  },
  gestao_dp: {
    id: 'gestao_dp',
    label: 'Gestão do Departamento Pessoal',
    agents: ['gestaodp@fgservices.com.br'],
    keywords: [
      'gestão', 'gestao', 'coordenador', 'coordenação', 'coordenacao',
      'gerência', 'gerencia', 'escalação', 'escalacao', 'reclamação', 'reclamacao',
      'urgente', 'diretoria dp', 'supervisor dp'
    ]
  }
};

/** Leonildo compartilha tema com Johnatan — e-mail informado repetido (dp-11); busca por nome no roteamento */
const JURIDICO_EXTRA_AGENT_NAMES = ['leonildo'];

const DEPARTMENT_TOPIC_MAP = {
  'dp - benefícios': 'beneficios',
  'dp - beneficios': 'beneficios',
  'dp - afastamentos': 'outros_afastamentos',
  'dp - rescisões': 'rescisoes',
  'dp - rescisoes': 'rescisoes',
  'dp - admissão': 'admissao',
  'dp - admissao': 'admissao',
  'dp - folha': 'folha_transferencias',
  'dp - folha e transferências': 'folha_transferencias',
  'dp - jurídico': 'juridico_arquivo',
  'dp - arquivo': 'juridico_arquivo',
  'departamento pessoal': 'outros_afastamentos',
  dp: 'outros_afastamentos'
};

const MENU_TOPIC_MAP = {
  Admissão: 'admissao',
  Admissões: 'admissao',
  Benefícios: 'beneficios',
  'Folha e Transferências': 'folha_transferencias',
  'Férias': 'folha_transferencias',
  'Folha de Pagamento': 'folha_transferencias',
  Encargos: 'folha_transferencias',
  Rescisões: 'rescisoes',
  Rescisão: 'rescisoes',
  Afastamentos: 'outros_afastamentos',
  'Outros e Afastamentos': 'outros_afastamentos',
  Outros: 'outros_afastamentos',
  'Jurídico e Arquivo': 'juridico_arquivo',
  'Gestão do Departamento Pessoal': 'gestao_dp'
};

function normalizeText(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveTopicFromKeywords(text = '') {
  const normalized = normalizeText(text);
  let bestTopic = null;
  let bestScore = 0;

  for (const topic of Object.values(DP_TOPICS)) {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (normalized.includes(normalizeText(keyword))) {
        score += 10;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic.id;
    }
  }

  return bestTopic;
}

function resolveDPTopic({ topic, department, subject, userMessage, description } = {}) {
  if (topic && DP_TOPICS[topic]) {
    return DP_TOPICS[topic];
  }

  const menuTopic = MENU_TOPIC_MAP[topic] || MENU_TOPIC_MAP[subject];
  if (menuTopic && DP_TOPICS[menuTopic]) {
    return DP_TOPICS[menuTopic];
  }

  if (department) {
    const mapped = DEPARTMENT_TOPIC_MAP[normalizeText(department)];
    if (mapped && DP_TOPICS[mapped]) {
      return DP_TOPICS[mapped];
    }
  }

  const fromText = resolveTopicFromKeywords(
    [subject, description, userMessage, department, topic].filter(Boolean).join(' ')
  );
  if (fromText && DP_TOPICS[fromText]) {
    return DP_TOPICS[fromText];
  }

  return DP_TOPICS.outros_afastamentos;
}

function getAgentEmailsForTopic(topicConfig) {
  return [...(topicConfig?.agents || [])];
}

module.exports = {
  DP_TOPICS,
  DEPARTMENT_TOPIC_MAP,
  MENU_TOPIC_MAP,
  JURIDICO_EXTRA_AGENT_NAMES,
  resolveDPTopic,
  resolveTopicFromKeywords,
  getAgentEmailsForTopic
};
