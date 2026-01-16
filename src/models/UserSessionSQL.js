const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Sessão de Usuário - Rastreia estado da conversa
 * Armazena contexto completo para fluxo de chatbot
 */
const UserSession = sequelize.define('UserSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Identificação do usuário
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'Número do WhatsApp (formato: 5511999999999)'
  },
  
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nome do usuário coletado durante conversa'
  },
  
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  cpf: {
    type: DataTypes.STRING(14),
    allowNull: true
  },
  
  company: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Empresa que representa (para fornecedores)'
  },
  
  contract: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Contrato/loja do cliente'
  },
  
  // Estado do fluxo
  currentFlow: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'initial',
    comment: 'Fluxo atual: initial, main_menu, cliente, colaborador, etc.'
  },
  
  currentStep: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'start',
    comment: 'Passo atual no fluxo'
  },
  
  menuPath: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Caminho percorrido no menu (array de escolhas)'
  },
  
  // Dados temporários
  formData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados temporários coletados no formulário'
  },
  
  collectionIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Índice do campo sendo coletado (para fluxos com múltiplos campos)'
  },
  
  // Controle de atendimento
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Sessão ativa ou encerrada'
  },
  
  needsHumanAgent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Necessita transferência para atendente humano'
  },
  
  agentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do atendente que assumiu'
  },
  
  // Avaliação
  npsScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Nota NPS (0-10)'
  },
  
  lastInteraction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Última interação do usuário'
  },
  
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de expiração da sessão (24h inatividade)'
  }
  
}, {
  tableName: 'user_sessions',
  timestamps: true,
  indexes: [
    { fields: ['phone'] },
    { fields: ['isActive'] },
    { fields: ['lastInteraction'] },
    { fields: ['expiresAt'] }
  ]
});

/**
 * Métodos auxiliares
 */
UserSession.prototype.updateLastInteraction = function() {
  this.lastInteraction = new Date();
  this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  return this.save();
};

UserSession.prototype.reset = function() {
  this.currentFlow = 'initial';
  this.currentStep = 'start';
  this.menuPath = [];
  this.formData = null;
  this.needsHumanAgent = false;
  return this.save();
};

UserSession.prototype.addToMenuPath = function(choice) {
  const path = this.menuPath || [];
  path.push(choice);
  this.menuPath = path;
  return this.save();
};

module.exports = UserSession;

