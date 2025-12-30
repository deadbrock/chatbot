const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Configurações do Sistema
 * Armazena configurações globais e por módulo
 */
const SystemSetting = sequelize.define('SystemSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Chave única da configuração (ex: system.company_name)'
  },
  
  category: {
    type: DataTypes.ENUM(
      'general',
      'whatsapp',
      'notifications',
      'email',
      'tickets',
      'chat',
      'integrations',
      'security',
      'appearance',
      'birthday',
      'automation',
      'api',
      'advanced'
    ),
    defaultValue: 'general',
    comment: 'Categoria da configuração'
  },
  
  // Valor
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Valor da configuração (JSON string)'
  },
  
  defaultValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Valor padrão'
  },
  
  // Tipo
  type: {
    type: DataTypes.ENUM(
      'string',
      'number',
      'boolean',
      'json',
      'array',
      'date',
      'time',
      'color',
      'url',
      'email',
      'phone',
      'file',
      'image'
    ),
    defaultValue: 'string',
    comment: 'Tipo do valor'
  },
  
  // Metadados da UI
  label: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Rótulo para exibição'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da configuração'
  },
  
  placeholder: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Placeholder para input'
  },
  
  helpText: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Texto de ajuda'
  },
  
  // Validação
  validation: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Regras de validação'
  },
  // Exemplo: { required: true, min: 1, max: 100, pattern: '^[0-9]+$' }
  
  options: {
    type: DataTypes.JSON,
    defaultValue: null,
    comment: 'Opções para select/radio (se aplicável)'
  },
  // Exemplo: [{ value: 'pt-BR', label: 'Português' }, { value: 'en', label: 'English' }]
  
  // Ordem e agrupamento
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Ordem de exibição'
  },
  
  group: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Grupo dentro da categoria'
  },
  
  // Visibilidade e permissões
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Visível na interface'
  },
  
  isReadOnly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Somente leitura'
  },
  
  requiresRestart: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Requer reiniciar o servidor'
  },
  
  requiredPermission: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Permissão necessária para editar'
  },
  
  // Auditoria
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  },
  
  previousValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Valor anterior (para auditoria)'
  },
  
  changeLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Histórico de alterações'
  }
}, {
  tableName: 'system_settings',
  timestamps: true,
  indexes: [
    { fields: ['key'], unique: true },
    { fields: ['category'] },
    { fields: ['group'] },
    { fields: ['order'] }
  ]
});

/**
 * Busca configuração por chave
 */
SystemSetting.get = async function(key, defaultValue = null) {
  const setting = await SystemSetting.findOne({ where: { key } });
  
  if (!setting) return defaultValue;
  
  return parseValue(setting.value, setting.type);
};

/**
 * Define configuração
 */
SystemSetting.set = async function(key, value, userId = null) {
  const setting = await SystemSetting.findOne({ where: { key } });
  
  if (!setting) {
    throw new Error(`Configuração não encontrada: ${key}`);
  }
  
  const stringValue = stringifyValue(value, setting.type);
  
  // Registrar no histórico
  const changeLog = setting.changeLog || [];
  changeLog.unshift({
    timestamp: new Date(),
    userId,
    oldValue: setting.value,
    newValue: stringValue
  });
  
  await setting.update({
    value: stringValue,
    previousValue: setting.value,
    updatedBy: userId,
    changeLog: changeLog.slice(0, 50) // Manter últimos 50
  });
  
  return parseValue(stringValue, setting.type);
};

/**
 * Busca múltiplas configurações por categoria
 */
SystemSetting.getByCategory = async function(category) {
  const settings = await SystemSetting.findAll({
    where: { category, isVisible: true },
    order: [['order', 'ASC'], ['label', 'ASC']]
  });
  
  return settings.map(s => ({
    key: s.key,
    value: parseValue(s.value, s.type),
    label: s.label,
    description: s.description,
    type: s.type,
    category: s.category,
    group: s.group,
    options: s.options,
    validation: s.validation,
    isReadOnly: s.isReadOnly,
    requiresRestart: s.requiresRestart
  }));
};

/**
 * Inicializa configurações padrão
 */
SystemSetting.initializeDefaults = async function() {
  const defaults = [
    // GERAL
    {
      key: 'system.company_name',
      category: 'general',
      type: 'string',
      label: 'Nome da Empresa',
      description: 'Nome da sua empresa',
      value: 'Minha Empresa',
      defaultValue: 'Minha Empresa',
      order: 1
    },
    {
      key: 'system.language',
      category: 'general',
      type: 'string',
      label: 'Idioma',
      value: 'pt-BR',
      defaultValue: 'pt-BR',
      options: [
        { value: 'pt-BR', label: 'Português (Brasil)' },
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Español' }
      ],
      order: 2
    },
    {
      key: 'system.timezone',
      category: 'general',
      type: 'string',
      label: 'Fuso Horário',
      value: 'America/Sao_Paulo',
      defaultValue: 'America/Sao_Paulo',
      order: 3
    },
    
    // WHATSAPP
    {
      key: 'whatsapp.auto_reconnect',
      category: 'whatsapp',
      type: 'boolean',
      label: 'Reconectar Automaticamente',
      description: 'Tentar reconectar automaticamente em caso de desconexão',
      value: 'true',
      defaultValue: 'true',
      order: 1
    },
    {
      key: 'whatsapp.max_reconnect_attempts',
      category: 'whatsapp',
      type: 'number',
      label: 'Máximo de Tentativas de Reconexão',
      value: '5',
      defaultValue: '5',
      validation: { min: 1, max: 20 },
      order: 2
    },
    {
      key: 'whatsapp.message_delay',
      category: 'whatsapp',
      type: 'number',
      label: 'Delay Entre Mensagens (ms)',
      description: 'Tempo de espera entre envio de mensagens para evitar bloqueio',
      value: '1000',
      defaultValue: '1000',
      validation: { min: 500, max: 5000 },
      order: 3
    },
    
    // ANIVERSÁRIO
    {
      key: 'birthday.enabled',
      category: 'birthday',
      type: 'boolean',
      label: 'Mensagens de Aniversário Ativas',
      value: 'false',
      defaultValue: 'false',
      order: 1
    },
    {
      key: 'birthday.message',
      category: 'birthday',
      type: 'string',
      label: 'Mensagem de Aniversário',
      description: 'Use {{nome}} para o nome do contato',
      value: 'Feliz aniversário {{nome}}! 🎉',
      defaultValue: 'Feliz aniversário {{nome}}! 🎉',
      placeholder: 'Digite a mensagem...',
      order: 2
    },
    {
      key: 'birthday.send_time',
      category: 'birthday',
      type: 'time',
      label: 'Horário de Envio',
      value: '09:00',
      defaultValue: '09:00',
      order: 3
    },
    
    // TICKETS
    {
      key: 'tickets.auto_close_hours',
      category: 'tickets',
      type: 'number',
      label: 'Fechar Tickets Inativos (horas)',
      description: 'Fechar automaticamente tickets sem interação (0 = desabilitado)',
      value: '0',
      defaultValue: '0',
      validation: { min: 0, max: 720 },
      order: 1
    },
    {
      key: 'tickets.max_per_contact',
      category: 'tickets',
      type: 'number',
      label: 'Máximo de Tickets por Contato',
      description: 'Limite de tickets abertos por contato (0 = ilimitado)',
      value: '0',
      defaultValue: '0',
      validation: { min: 0, max: 10 },
      order: 2
    },
    
    // NOTIFICAÇÕES
    {
      key: 'notifications.email_enabled',
      category: 'notifications',
      type: 'boolean',
      label: 'Notificações por Email',
      value: 'false',
      defaultValue: 'false',
      order: 1
    },
    {
      key: 'notifications.desktop_enabled',
      category: 'notifications',
      type: 'boolean',
      label: 'Notificações Desktop',
      value: 'true',
      defaultValue: 'true',
      order: 2
    },
    
    // SEGURANÇA
    {
      key: 'security.session_timeout',
      category: 'security',
      type: 'number',
      label: 'Timeout de Sessão (minutos)',
      value: '60',
      defaultValue: '60',
      validation: { min: 5, max: 1440 },
      order: 1
    },
    {
      key: 'security.require_2fa',
      category: 'security',
      type: 'boolean',
      label: 'Exigir 2FA',
      description: 'Autenticação de dois fatores obrigatória',
      value: 'false',
      defaultValue: 'false',
      order: 2
    }
  ];
  
  for (const def of defaults) {
    await SystemSetting.findOrCreate({
      where: { key: def.key },
      defaults: def
    });
  }
  
  console.log('✅ Configurações padrão inicializadas');
};

// Helper: Parse value baseado no tipo
function parseValue(stringValue, type) {
  if (stringValue === null || stringValue === undefined) return null;
  
  switch (type) {
    case 'boolean':
      return stringValue === 'true' || stringValue === true;
    case 'number':
      return Number(stringValue);
    case 'json':
    case 'array':
      try {
        return JSON.parse(stringValue);
      } catch {
        return null;
      }
    default:
      return stringValue;
  }
}

// Helper: Stringify value baseado no tipo
function stringifyValue(value, type) {
  if (value === null || value === undefined) return null;
  
  switch (type) {
    case 'boolean':
      return String(Boolean(value));
    case 'number':
      return String(Number(value));
    case 'json':
    case 'array':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

module.exports = SystemSetting;


