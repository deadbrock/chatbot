const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * ================================================================================
 * FASE 6F: MODEL - CUSTOM REPORT BUILDER
 * ================================================================================
 * 
 * Modelo para relatórios personalizados configuráveis pelo usuário
 */

const CustomReport = sequelize.define('CustomReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true
  },
  
  // Informações básicas
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do relatório'
  },
  
  description: {
    type: DataTypes.TEXT,
    comment: 'Descrição do relatório'
  },
  
  category: {
    type: DataTypes.STRING,
    defaultValue: 'custom',
    comment: 'Categoria: custom, performance, satisfaction, conversation, forecast'
  },
  
  // Configuração do relatório
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: `Configuração completa do relatório:
    {
      dataSource: 'tickets' | 'messages' | 'ratings' | 'agents',
      metrics: ['count', 'avg_rating', 'response_time'],
      dimensions: ['date', 'agent', 'queue'],
      filters: [{ field: 'status', operator: '=', value: 'closed' }],
      groupBy: ['date'],
      sortBy: [{ field: 'date', order: 'DESC' }],
      limit: 100,
      dateRange: { start: 'date', end: 'date' },
      charts: [
        { type: 'line', metric: 'count', title: 'Tickets por dia' },
        { type: 'bar', metric: 'avg_rating', title: 'Satisfação média' }
      ]
    }`
  },
  
  // SQL Query gerada (somente leitura)
  generatedQuery: {
    type: DataTypes.TEXT,
    comment: 'Query SQL gerada automaticamente'
  },
  
  // Formato de saída
  outputFormat: {
    type: DataTypes.STRING,
    defaultValue: 'table',
    comment: 'Formato: table, chart, dashboard, pdf, excel'
  },
  
  // Agendamento
  scheduled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Se o relatório é agendado'
  },
  
  schedule: {
    type: DataTypes.JSON,
    comment: `Configuração de agendamento:
    {
      frequency: 'daily' | 'weekly' | 'monthly',
      time: '09:00',
      dayOfWeek: 1, // Para weekly
      dayOfMonth: 1, // Para monthly
      recipients: ['email@example.com'],
      format: 'pdf'
    }`
  },
  
  lastRunAt: {
    type: DataTypes.DATE,
    comment: 'Última vez que o relatório foi executado'
  },
  
  nextRunAt: {
    type: DataTypes.DATE,
    comment: 'Próxima execução agendada'
  },
  
  // Permissões e visibilidade
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Se o relatório é público para todos os usuários'
  },
  
  sharedWith: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'IDs de usuários/papéis com acesso: ["user-uuid", "role:admin"]'
  },
  
  // Estatísticas de uso
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de vezes que o relatório foi visualizado'
  },
  
  exportCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de vezes que o relatório foi exportado'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    comment: 'Usuário que criou o relatório'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    comment: 'Último usuário que atualizou'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags para categorização e busca'
  },
  
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Se é favorito do usuário'
  },
  
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'custom_reports',
  timestamps: true,
  indexes: [
    { fields: ['createdBy'] },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['scheduled'] },
    { fields: ['nextRunAt'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = CustomReport;

