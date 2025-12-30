const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo Avançado de Templates de Mensagem
 * Sistema completo de templates com variáveis, condições e mídia
 */
const MessageTemplateAdvanced = sequelize.define('MessageTemplateAdvanced', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do template'
  },
  
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Identificador único (slug)'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do template'
  },
  
  // Conteúdo
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Conteúdo do template com variáveis'
  },
  
  // Variáveis disponíveis
  variables: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Lista de variáveis disponíveis no template'
  },
  
  // Exemplo: [
  //   { name: 'nome', type: 'string', required: true, default: '' },
  //   { name: 'valor', type: 'number', required: false, default: 0 }
  // ]
  
  // Categorização
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria do template'
  },
  
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags para organização'
  },
  
  // Tipo de template
  type: {
    type: DataTypes.ENUM('text', 'media', 'interactive', 'location', 'contact'),
    defaultValue: 'text',
    comment: 'Tipo de mensagem'
  },
  
  // Mídia (se type = media)
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da mídia padrão'
  },
  
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'document'),
    allowNull: true,
    comment: 'Tipo de mídia'
  },
  
  // Botões interativos (se type = interactive)
  buttons: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Botões de ação'
  },
  
  // Exemplo: [
  //   { id: '1', type: 'url', text: 'Ver Site', url: 'https://...' },
  //   { id: '2', type: 'call', text: 'Ligar', phone: '+55...' },
  //   { id: '3', type: 'reply', text: 'Responder' }
  // ]
  
  // Configurações
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Template ativo'
  },
  
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Template público (visível para todos os usuários)'
  },
  
  requiresApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Requer aprovação antes de usar'
  },
  
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Template aprovado'
  },
  
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Aprovado por (user ID)'
  },
  
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de aprovação'
  },
  
  // Uso e estatísticas
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade de vezes usado'
  },
  
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última vez usado'
  },
  
  successRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de sucesso (0-100)'
  },
  
  // Versão e histórico
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Versão do template'
  },
  
  previousVersionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID da versão anterior'
  },
  
  changeLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Histórico de alterações'
  },
  
  // Condições de uso
  conditions: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Condições para uso do template'
  },
  
  // Exemplo: {
  //   minContactAge: 18,
  //   requiredTags: ['cliente'],
  //   excludedTags: ['bloqueado'],
  //   timeRestrictions: { start: '09:00', end: '18:00' }
  // }
  
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
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  }
}, {
  tableName: 'message_templates_advanced',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['category'] },
    { fields: ['type'] },
    { fields: ['isActive'] },
    { fields: ['isApproved'] },
    { fields: ['createdBy'] },
    { fields: ['usageCount'] }
  ]
});

module.exports = MessageTemplateAdvanced;

