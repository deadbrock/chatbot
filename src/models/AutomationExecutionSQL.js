const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AutomationExecution = sequelize.define('AutomationExecution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'ID único da execução'
    },
    ruleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'automation_rules',
        key: 'id'
      },
      comment: 'ID da regra executada'
    },
    contactId: {
      type: DataTypes.UUID,
      references: {
        model: 'Contacts',
        key: 'id'
      },
      comment: 'ID do contato'
    },
    ticketId: {
      type: DataTypes.UUID,
      references: {
        model: 'Tickets',
        key: 'id'
      },
      comment: 'ID do ticket relacionado'
    },
    
    // STATUS
    status: {
      type: DataTypes.ENUM('started', 'collecting', 'executing', 'completed', 'failed'),
      defaultValue: 'started',
      comment: 'Status da execução'
    },
    
    // SLOTS COLETADOS
    collectedSlots: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Dados coletados durante a execução'
    },
    missingSlots: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Slots ainda não coletados'
    },
    
    // AÇÕES EXECUTADAS
    executedActions: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Lista de ações executadas'
    },
    
    // RESULTADO
    result: {
      type: DataTypes.JSON,
      comment: 'Resultado da execução'
    },
    error: {
      type: DataTypes.TEXT,
      comment: 'Mensagem de erro se houver'
    },
    
    // TIMESTAMPS
    startedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Início da execução'
    },
    completedAt: {
      type: DataTypes.DATE,
      comment: 'Fim da execução'
    },
    
    // METADATA
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Metadados adicionais'
    }
  }, {
    tableName: 'automation_executions',
    timestamps: true,
    indexes: [
      { fields: ['ruleId'] },
      { fields: ['contactId'] },
      { fields: ['ticketId'] },
      { fields: ['status'] }
    ]
  });

  AutomationExecution.associate = (models) => {
    AutomationExecution.belongsTo(models.AutomationRule, {
      foreignKey: 'ruleId',
      as: 'rule'
    });
    AutomationExecution.belongsTo(models.Contact, {
      foreignKey: 'contactId',
      as: 'contact'
    });
    AutomationExecution.belongsTo(models.Ticket, {
      foreignKey: 'ticketId',
      as: 'ticket'
    });
  };

  return AutomationExecution;
};
