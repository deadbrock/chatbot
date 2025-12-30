/**
 * Configuração de todos os departamentos da empresa
 */

const departments = {
  ATENDIMENTO: {
    id: 'atendimento',
    name: 'Atendimento/Recepção',
    emoji: '👋',
    description: 'Atendimento geral e direcionamento',
    keywords: ['atendimento', 'recepção', 'informação', 'ajuda', 'suporte'],
    priority: 1,
    workingHours: {
      start: '08:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5] // Segunda a Sexta
    },
    autoResponses: true,
    transferToHuman: true
  },

  LOGISTICA: {
    id: 'logistica',
    name: 'Logística',
    emoji: '🚚',
    description: 'Rastreamento, entregas e coletas',
    keywords: ['entrega', 'rastreamento', 'logística', 'transporte', 'coleta', 'rastrear'],
    priority: 2,
    workingHours: {
      start: '07:00',
      end: '19:00',
      days: [1, 2, 3, 4, 5, 6]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['tracking', 'scheduling', 'documents']
  },

  MANUTENCAO: {
    id: 'manutencao',
    name: 'Manutenção',
    emoji: '🔧',
    description: 'Abertura de chamados e agendamentos',
    keywords: ['manutenção', 'reparo', 'conserto', 'quebrado', 'defeito', 'chamado'],
    priority: 2,
    workingHours: {
      start: '08:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['tickets', 'scheduling', 'photos']
  },

  GERENCIA: {
    id: 'gerencia',
    name: 'Gerência Administrativa',
    emoji: '👔',
    description: 'Solicitações administrativas',
    keywords: ['gerência', 'administrativo', 'gestão', 'direção'],
    priority: 3,
    workingHours: {
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: false,
    transferToHuman: true,
    requiresAuth: true
  },

  COMERCIAL: {
    id: 'comercial',
    name: 'Comercial',
    emoji: '💼',
    description: 'Vendas, orçamentos e propostas',
    keywords: ['venda', 'comprar', 'orçamento', 'proposta', 'comercial', 'preço'],
    priority: 1,
    workingHours: {
      start: '08:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['quotes', 'catalog', 'payment']
  },

  RH: {
    id: 'rh',
    name: 'Recursos Humanos',
    emoji: '👥',
    description: 'Vagas, benefícios e documentos',
    keywords: ['vaga', 'emprego', 'trabalho', 'currículo', 'rh', 'recursos humanos', 'benefícios'],
    priority: 2,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['jobs', 'documents', 'benefits']
  },

  DP: {
    id: 'dp',
    name: 'Departamento Pessoal',
    emoji: '📋',
    description: 'Folha de pagamento, férias e atestados',
    keywords: ['folha', 'pagamento', 'férias', 'atestado', 'dp', 'departamento pessoal', 'holerite'],
    priority: 2,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    requiresAuth: true,
    features: ['payroll', 'vacation', 'documents']
  },

  TI: {
    id: 'ti',
    name: 'Tecnologia da Informação',
    emoji: '💻',
    description: 'Suporte técnico, senhas e acessos',
    keywords: ['ti', 'suporte', 'técnico', 'senha', 'sistema', 'computador', 'internet', 'email'],
    priority: 1,
    workingHours: {
      start: '08:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['tickets', 'password-reset', 'remote-support']
  },

  FINANCEIRO: {
    id: 'financeiro',
    name: 'Financeiro',
    emoji: '💰',
    description: 'Pagamentos, cobranças e consultas',
    keywords: ['pagamento', 'financeiro', 'cobrança', 'dinheiro', 'pagar', 'débito'],
    priority: 2,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    requiresAuth: true,
    features: ['payment-status', 'invoices', 'billing']
  },

  FATURAMENTO: {
    id: 'faturamento',
    name: 'Faturamento',
    emoji: '📄',
    description: 'Notas fiscais e boletos',
    keywords: ['nota fiscal', 'nf', 'boleto', 'fatura', 'faturamento'],
    priority: 2,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['invoices', 'boletos', 'documents']
  },

  SEGURANCA: {
    id: 'seguranca',
    name: 'Segurança do Trabalho',
    emoji: '🦺',
    description: 'Treinamentos, EPIs e acidentes',
    keywords: ['segurança', 'epi', 'acidente', 'treinamento', 'cipa'],
    priority: 1,
    workingHours: {
      start: '08:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['training', 'incidents', 'epi-request']
  },

  MARKETING: {
    id: 'marketing',
    name: 'Marketing',
    emoji: '📢',
    description: 'Campanhas, materiais e eventos',
    keywords: ['marketing', 'campanha', 'evento', 'divulgação', 'propaganda'],
    priority: 3,
    workingHours: {
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['campaigns', 'materials', 'events']
  },

  COORDENADORIA: {
    id: 'coordenadoria',
    name: 'Coordenadoria',
    emoji: '📊',
    description: 'Gestão de projetos e coordenação',
    keywords: ['coordenação', 'projeto', 'coordenadoria', 'gestão'],
    priority: 3,
    workingHours: {
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    autoResponses: false,
    transferToHuman: true,
    requiresAuth: true
  },

  OPERACOES: {
    id: 'operacoes',
    name: 'Operações',
    emoji: '⚙️',
    description: 'Processos operacionais',
    keywords: ['operação', 'processo', 'operacional', 'produção'],
    priority: 2,
    workingHours: {
      start: '07:00',
      end: '19:00',
      days: [1, 2, 3, 4, 5, 6]
    },
    autoResponses: true,
    transferToHuman: true,
    features: ['processes', 'production', 'quality']
  }
};

/**
 * Retorna todos os departamentos
 */
function getAllDepartments() {
  return Object.values(departments);
}

/**
 * Busca departamento por ID
 */
function getDepartmentById(id) {
  return Object.values(departments).find(dept => dept.id === id);
}

/**
 * Busca departamento por palavras-chave
 */
function findDepartmentByKeywords(message) {
  const messageLower = message.toLowerCase();
  
  for (const dept of Object.values(departments)) {
    for (const keyword of dept.keywords) {
      if (messageLower.includes(keyword)) {
        return dept;
      }
    }
  }
  
  return null;
}

/**
 * Verifica se departamento está em horário de atendimento
 */
function isDepartmentAvailable(departmentId) {
  const dept = getDepartmentById(departmentId);
  if (!dept) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  // Verifica dia da semana
  if (!dept.workingHours.days.includes(currentDay)) {
    return false;
  }

  // Verifica horário
  const [startHour, startMin] = dept.workingHours.start.split(':').map(Number);
  const [endHour, endMin] = dept.workingHours.end.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Gera menu de departamentos
 */
function generateDepartmentMenu() {
  let menu = '*🏢 DEPARTAMENTOS*\n\n';
  menu += 'Digite o *número* do departamento:\n\n';

  const depts = getAllDepartments();
  depts.forEach((dept, index) => {
    const available = isDepartmentAvailable(dept.id) ? '🟢' : '🔴';
    menu += `*${index + 1}*  ${dept.emoji} ${dept.name}  ${available}\n`;
    menu += `_${dept.description}_\n\n`;
  });

  menu += '\n💡 Dica: também pode escrever sua solicitação em 1 frase (ex: “preciso de nota fiscal”).';

  return menu;
}

module.exports = {
  departments,
  getAllDepartments,
  getDepartmentById,
  findDepartmentByKeywords,
  isDepartmentAvailable,
  generateDepartmentMenu
};

