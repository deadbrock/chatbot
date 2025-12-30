const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Fluxo de Conversa
 * Permite criar fluxos personalizados sem código
 */
const Flow = sequelize.define('Flow', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do fluxo (ex: "Onboarding", "Suporte Técnico")'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do que o fluxo faz'
  },
  
  trigger: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'O que ativa o fluxo (keyword, command, department, etc.)'
  },
  
  triggerType: {
    type: DataTypes.ENUM('keyword', 'command', 'department', 'intent', 'manual'),
    defaultValue: 'keyword',
    comment: 'Tipo de gatilho'
  },
  
  steps: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Array de steps do fluxo [{type, content, options, next}]'
  },
  
  variables: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Variáveis do fluxo (ex: {userName, orderId})'
  },
  
  status: {
    type: DataTypes.ENUM('active', 'draft', 'archived'),
    defaultValue: 'draft',
    comment: 'Status do fluxo'
  },
  
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Prioridade (maior = executa primeiro)'
  },
  
  department: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Departamento associado (opcional)'
  },
  
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do usuário que criou'
  },
  
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do último usuário que editou'
  },
  
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Metadados extras (analytics, tags, etc.)'
  }
}, {
  tableName: 'flows',
  timestamps: true,
  indexes: [
    { fields: ['trigger'] },
    { fields: ['triggerType'] },
    { fields: ['status'] },
    { fields: ['department'] }
  ]
});

/**
 * Métodos estáticos
 */

// Buscar fluxos ativos
Flow.getActiveFlows = async function() {
  return await Flow.findAll({
    where: { status: 'active' },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });
};

// Buscar fluxo por trigger
Flow.findByTrigger = async function(trigger, type = 'keyword') {
  return await Flow.findOne({
    where: { 
      trigger,
      triggerType: type,
      status: 'active'
    }
  });
};

// Buscar fluxos por departamento
Flow.findByDepartment = async function(department) {
  return await Flow.findAll({
    where: { 
      department,
      status: 'active'
    },
    order: [['priority', 'DESC']]
  });
};

/**
 * Métodos de instância
 */

// Ativar fluxo
Flow.prototype.activate = async function() {
  this.status = 'active';
  return await this.save();
};

// Arquivar fluxo
Flow.prototype.archive = async function() {
  this.status = 'archived';
  return await this.save();
};

// Validar estrutura dos steps
Flow.prototype.validateSteps = function() {
  if (!Array.isArray(this.steps)) return false;
  
  for (const step of this.steps) {
    if (!step.type || !step.id) return false;
    
    // Validar tipos permitidos
    const validTypes = ['message', 'question', 'options', 'collect', 'condition', 'action'];
    if (!validTypes.includes(step.type)) return false;
  }
  
  return true;
};

// Duplicar fluxo
Flow.prototype.duplicate = async function(newName) {
  const duplicate = await Flow.create({
    name: newName || `${this.name} (cópia)`,
    description: this.description,
    trigger: this.trigger,
    triggerType: this.triggerType,
    steps: JSON.parse(JSON.stringify(this.steps)),
    variables: JSON.parse(JSON.stringify(this.variables)),
    status: 'draft',
    priority: this.priority,
    department: this.department,
    createdBy: this.createdBy
  });
  
  return duplicate;
};

module.exports = Flow;

