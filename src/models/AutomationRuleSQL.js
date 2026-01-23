const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AutomationRule = sequelize.define('AutomationRule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'ID único da regra de automação'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nome da regra'
    },
    description: {
      type: DataTypes.TEXT,
      comment: 'Descrição da regra'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Regra ativa ou desativada'
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: 'Prioridade de execução (menor = mais prioritário)'
    },
    
    // TRIGGER: Quando executar
    triggerType: {
      type: DataTypes.ENUM('intent', 'keyword', 'sentiment', 'always'),
      defaultValue: 'intent',
      comment: 'Tipo de gatilho'
    },
    triggerValue: {
      type: DataTypes.STRING,
      comment: 'Valor do gatilho (ex: "salario", "ferias")'
    },
    triggerConditions: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Condições adicionais para executar'
    },
    
    // SLOTS: Dados a coletar
    requiredSlots: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Lista de dados a coletar antes de executar ação'
    },
    slotPrompts: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Mensagens para solicitar cada slot'
    },
    
    // ACTIONS: O que fazer
    actions: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Lista de ações a executar'
    },
    
    // RESPONSES: Mensagens personalizadas
    greetingMessage: {
      type: DataTypes.TEXT,
      comment: 'Mensagem inicial de saudação'
    },
    completionMessage: {
      type: DataTypes.TEXT,
      comment: 'Mensagem ao finalizar coleta de dados'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      comment: 'Mensagem em caso de erro'
    },
    
    // STATISTICS
    executionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Quantas vezes foi executada'
    },
    successCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Quantas vezes foi bem-sucedida'
    },
    lastExecutedAt: {
      type: DataTypes.DATE,
      comment: 'Última execução'
    },
    
    // METADATA
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Metadados adicionais'
    }
  }, {
    tableName: 'automation_rules',
    timestamps: true,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['triggerType'] },
      { fields: ['priority'] }
    ]
  });

  return AutomationRule;
};
