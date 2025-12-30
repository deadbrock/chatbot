const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Agendamentos
 * Agenda mensagens e follow-ups automáticos
 */
const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('message', 'follow_up', 'reminder', 'campaign'),
    allowNull: false,
    comment: 'Tipo de agendamento',
  },
  scheduledFor: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Data e hora agendada para envio',
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'sent', 'failed', 'cancelled'),
    defaultValue: 'pending',
    comment: 'Status do agendamento',
  },
  recipientId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID do destinatário (WhatsApp ID)',
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do ticket relacionado (se aplicável)',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mensagem a ser enviada (pode conter variáveis)',
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL de mídia anexa (se houver)',
  },
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'document'),
    allowNull: true,
    comment: 'Tipo de mídia anexa',
  },
  repeat: {
    type: DataTypes.ENUM('none', 'daily', 'weekly', 'monthly'),
    defaultValue: 'none',
    comment: 'Recorrência do agendamento',
  },
  repeatUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data final para recorrência',
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data e hora efetiva do envio',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de erro (se falhou)',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que criou o agendamento',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados adicionais (variáveis, configurações, etc.)',
  },
}, {
  tableName: 'schedules',
  timestamps: true,
  indexes: [
    { fields: ['scheduledFor'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['recipientId'] },
    { fields: ['ticketId'] },
    { fields: ['createdBy'] },
  ],
});

/**
 * Verifica se o agendamento está pronto para ser processado
 */
Schedule.prototype.isReady = function() {
  return this.status === 'pending' && new Date() >= this.scheduledFor;
};

/**
 * Marca como enviado
 */
Schedule.prototype.markAsSent = async function() {
  this.status = 'sent';
  this.sentAt = new Date();
  await this.save();
};

/**
 * Marca como falhou
 */
Schedule.prototype.markAsFailed = async function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  await this.save();
};

/**
 * Cancela agendamento
 */
Schedule.prototype.cancel = async function() {
  this.status = 'cancelled';
  await this.save();
};

/**
 * Cria próxima recorrência (se aplicável)
 */
Schedule.prototype.createNextOccurrence = async function() {
  if (this.repeat === 'none') return null;

  const nextDate = new Date(this.scheduledFor);

  switch (this.repeat) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  // Verificar se passou da data final de recorrência
  if (this.repeatUntil && nextDate > this.repeatUntil) {
    return null;
  }

  // Criar nova ocorrência
  const nextSchedule = await Schedule.create({
    type: this.type,
    scheduledFor: nextDate,
    status: 'pending',
    recipientId: this.recipientId,
    ticketId: this.ticketId,
    message: this.message,
    mediaUrl: this.mediaUrl,
    mediaType: this.mediaType,
    repeat: this.repeat,
    repeatUntil: this.repeatUntil,
    createdBy: this.createdBy,
    metadata: this.metadata
  });

  return nextSchedule;
};

module.exports = Schedule;

