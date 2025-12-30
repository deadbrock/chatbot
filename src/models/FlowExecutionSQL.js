const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Execução de Fluxo
 * Rastreia cada contato passando por um fluxo de campanha
 */
const FlowExecution = sequelize.define('FlowExecution', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Relacionamentos
  flowId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID do fluxo de campanha'
  },
  
  contactId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID do contato'
  },
  
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID da campanha (se aplicável)'
  },
  
  // Estado da execução
  currentStepId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID da etapa atual'
  },
  
  status: {
    type: DataTypes.ENUM('pending', 'running', 'waiting', 'completed', 'failed', 'dropped', 'exited'),
    defaultValue: 'pending',
    comment: 'Status da execução'
  },
  
  // Variante A/B (se aplicável)
  abVariant: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Variante do teste A/B (A, B, C, etc)'
  },
  
  // Progresso
  stepsCompleted: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de IDs de etapas completadas'
  },
  
  progress: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Progresso em porcentagem (0-100)'
  },
  
  // Dados contextuais
  variables: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Variáveis específicas desta execução'
  },
  
  // Histórico de etapas
  stepHistory: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Histórico de etapas executadas'
  },
  // Exemplo: [
  //   {
  //     stepId: 'step1',
  //     type: 'wait',
  //     startedAt: '2025-12-15T10:00:00Z',
  //     completedAt: '2025-12-16T10:00:00Z',
  //     result: 'success'
  //   }
  // ]
  
  // Controle de tempo
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Início da execução'
  },
  
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Conclusão da execução'
  },
  
  nextExecutionAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Próxima execução agendada (para steps de espera)'
  },
  
  // Resultado
  exitReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Motivo da saída (se aplicável)'
  },
  
  conversionAchieved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Conversão foi alcançada'
  },
  
  // Métricas
  totalDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Duração total em segundos'
  },
  
  messagesS: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens enviadas'
  },
  
  repliesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Respostas recebidas'
  },
  
  // Erro (se houver)
  error: {
    type: DataTypes.JSON,
    defaultValue: null,
    comment: 'Detalhes do erro (se falhou)'
  },
  
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de tentativas de retry'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'flow_executions',
  timestamps: true,
  indexes: [
    { fields: ['flowId'] },
    { fields: ['contactId'] },
    { fields: ['campaignId'] },
    { fields: ['status'] },
    { fields: ['nextExecutionAt'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = FlowExecution;

