const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Conexões WhatsApp
 * Gerenciamento de múltiplas instâncias WhatsApp
 */
const WhatsAppConnection = sequelize.define('WhatsAppConnection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome da conexão'
  },
  
  instanceId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'ID único da instância'
  },
  
  // Número
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número do WhatsApp conectado'
  },
  
  phoneNumberFormatted: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número formatado para exibição'
  },
  
  // QR Code
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'QR Code base64 para conexão'
  },
  
  qrCodeExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Expiração do QR Code'
  },
  
  // Status da conexão
  status: {
    type: DataTypes.ENUM(
      'disconnected',
      'connecting',
      'qr_ready',
      'authenticated',
      'connected',
      'paused',
      'error'
    ),
    defaultValue: 'disconnected',
    comment: 'Status da conexão'
  },
  
  // Informações do dispositivo
  deviceInfo: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Informações do dispositivo conectado'
  },
  // Exemplo: { platform: 'android', version: '2.23.1', model: 'Galaxy S21' }
  
  // Informações da conta
  accountInfo: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Informações da conta WhatsApp'
  },
  // Exemplo: { name: 'João Silva', pushname: 'João', profilePicUrl: '...' }
  
  // Configurações
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 10000,
      messageDelay: 1000
    },
    comment: 'Configurações da conexão'
  },
  
  // Filas e departamentos
  defaultQueue: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Fila padrão para novos tickets'
  },
  
  allowedQueues: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'IDs de filas permitidas'
  },
  
  // Horário de funcionamento
  businessHours: {
    type: DataTypes.JSON,
    defaultValue: {
      enabled: false,
      timezone: 'America/Sao_Paulo',
      schedule: {
        monday: { enabled: true, start: '09:00', end: '18:00' },
        tuesday: { enabled: true, start: '09:00', end: '18:00' },
        wednesday: { enabled: true, start: '09:00', end: '18:00' },
        thursday: { enabled: true, start: '09:00', end: '18:00' },
        friday: { enabled: true, start: '09:00', end: '18:00' },
        saturday: { enabled: false, start: '09:00', end: '13:00' },
        sunday: { enabled: false, start: '09:00', end: '13:00' }
      }
    },
    comment: 'Horário de funcionamento'
  },
  
  outOfHoursMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem fora do horário'
  },
  
  // Mensagens automáticas
  welcomeMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de boas-vindas'
  },
  
  farewellMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de despedida'
  },
  
  // Webhook
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL para envio de webhooks'
  },
  
  webhookEvents: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Eventos a enviar via webhook'
  },
  
  // Limites
  maxConcurrentChats: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Máximo de chats simultâneos (0 = ilimitado)'
  },
  
  maxMessagesPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Máximo de mensagens por dia (0 = ilimitado)'
  },
  
  // Estatísticas
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalMessages: 0,
      messagesToday: 0,
      totalChats: 0,
      activeChats: 0,
      lastMessageAt: null
    },
    comment: 'Estatísticas da conexão'
  },
  
  // Reconexão
  reconnectAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tentativas de reconexão'
  },
  
  lastReconnectAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última tentativa de reconexão'
  },
  
  // Erro
  lastError: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Último erro ocorrido'
  },
  
  errorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de erros'
  },
  
  // Logs
  connectionLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de conexões (últimos 50)'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros'
  },
  
  // Prioridade
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Prioridade da conexão (maior = mais importante)'
  },
  
  // Ativo/Inativo
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Conexão ativa'
  },
  
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Conexão padrão do sistema'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  lastConnectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última conexão bem-sucedida'
  },
  
  lastDisconnectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última desconexão'
  }
}, {
  tableName: 'whatsapp_connections',
  timestamps: true,
  indexes: [
    { fields: ['instanceId'], unique: true },
    { fields: ['phoneNumber'] },
    { fields: ['status'] },
    { fields: ['isActive'] },
    { fields: ['isDefault'] },
    { fields: ['priority'] }
  ]
});

/**
 * Atualiza status da conexão
 */
WhatsAppConnection.prototype.updateStatus = async function(status, details = {}) {
  const log = {
    timestamp: new Date(),
    oldStatus: this.status,
    newStatus: status,
    details
  };
  
  const connectionLog = this.connectionLog || [];
  connectionLog.unshift(log);
  
  const updates = {
    status,
    connectionLog: connectionLog.slice(0, 50)
  };
  
  if (status === 'connected') {
    updates.lastConnectedAt = new Date();
    updates.reconnectAttempts = 0;
  } else if (status === 'disconnected') {
    updates.lastDisconnectedAt = new Date();
  }
  
  await this.update(updates);
};

/**
 * Registra erro
 */
WhatsAppConnection.prototype.logError = async function(error) {
  const errorEntry = {
    timestamp: new Date(),
    message: error.message || error,
    stack: error.stack,
    type: error.name
  };
  
  const errorLog = this.errorLog || [];
  errorLog.unshift(errorEntry);
  
  await this.update({
    lastError: errorEntry,
    errorCount: this.errorCount + 1,
    errorLog: errorLog.slice(0, 50)
  });
};

/**
 * Verifica se está no horário de funcionamento
 */
WhatsAppConnection.prototype.isBusinessHours = function() {
  if (!this.businessHours.enabled) return true;
  
  const now = new Date();
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const schedule = this.businessHours.schedule[day];
  
  if (!schedule || !schedule.enabled) return false;
  
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return currentTime >= schedule.start && currentTime <= schedule.end;
};

/**
 * Atualiza estatísticas
 */
WhatsAppConnection.prototype.updateStats = async function(updates) {
  await this.update({
    stats: {
      ...this.stats,
      ...updates
    }
  });
};

module.exports = WhatsAppConnection;


