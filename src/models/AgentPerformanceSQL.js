const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * AGENT PERFORMANCE MODEL
 * Armazena métricas de performance de agentes
 */

const AgentPerformance = sequelize.define('AgentPerformance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  
  userId: {
    type: DataTypes.INTEGER, // CORRIGIDO: User usa INTEGER, não UUID
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    comment: 'ID do agente',
  },
  
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Data da performance',
  },
  
  period: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
    defaultValue: 'daily',
  },
  
  // ==============================================
  // MÉTRICAS DE PRODUTIVIDADE
  // ==============================================
  
  totalTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de tickets atendidos',
  },
  
  openTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets abertos',
  },
  
  closedTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets fechados',
  },
  
  inProgressTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets em andamento',
  },
  
  // ==============================================
  // MÉTRICAS DE TEMPO
  // ==============================================
  
  avgFirstResponseTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de primeira resposta (minutos)',
  },
  
  avgResolutionTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de resolução (minutos)',
  },
  
  totalResponseTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo total de resposta (minutos)',
  },
  
  // ==============================================
  // TAXA DE RESOLUÇÃO
  // ==============================================
  
  firstContactResolution: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets resolvidos no primeiro contato',
  },
  
  firstContactResolutionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de resolução no primeiro contato (%)',
  },
  
  // ==============================================
  // SATISFAÇÃO
  // ==============================================
  
  npsScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Score NPS do agente',
  },
  
  totalRatings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de avaliações recebidas',
  },
  
  avgRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média das avaliações (0-10)',
  },
  
  promoters: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  passives: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  detractors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // ==============================================
  // ATIVIDADE
  // ==============================================
  
  hoursOnline: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Horas online',
  },
  
  messagesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens recebidas',
  },
  
  messagesSent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens enviadas',
  },
  
  // ==============================================
  // PRODUTIVIDADE
  // ==============================================
  
  ticketsPerHour: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Tickets por hora',
  },
  
  avgTicketsPerDay: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média de tickets por dia',
  },
  
  // ==============================================
  // QUALIDADE
  // ==============================================
  
  reopenedTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets reabertos',
  },
  
  reopenRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de reabertura (%)',
  },
  
  transferredTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets transferidos',
  },
  
  transferRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de transferência (%)',
  },
  
  // ==============================================
  // RANKING
  // ==============================================
  
  rankPosition: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Posição no ranking',
  },
  
  rankScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Score do ranking',
  },
  
  // ==============================================
  // METADADOS
  // ==============================================
  
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  
}, {
  tableName: 'agent_performance',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'date', 'period'],
      unique: true,
    },
    {
      fields: ['date'],
    },
    {
      fields: ['rankPosition'],
    },
  ],
});

// ==============================================
// MÉTODOS DE INSTÂNCIA
// ==============================================

/**
 * Retorna resumo da performance
 */
AgentPerformance.prototype.getSummary = function() {
  return {
    userId: this.userId,
    date: this.date,
    totalTickets: this.totalTickets,
    closedTickets: this.closedTickets,
    avgResolutionTime: this.avgResolutionTime,
    npsScore: this.npsScore,
    ticketsPerHour: this.ticketsPerHour,
    rankPosition: this.rankPosition,
  };
};

/**
 * Calcula score de eficiência
 */
AgentPerformance.prototype.getEfficiencyScore = function() {
  // Score baseado em múltiplas métricas
  const productivityScore = this.ticketsPerHour * 10;
  const qualityScore = this.firstContactResolutionRate;
  const satisfactionScore = ((this.npsScore + 100) / 2); // Normalizar -100/100 para 0/100
  const speedScore = Math.max(0, 100 - (this.avgResolutionTime / 10));
  
  return parseFloat((
    (productivityScore * 0.3) +
    (qualityScore * 0.3) +
    (satisfactionScore * 0.2) +
    (speedScore * 0.2)
  ).toFixed(2));
};

// ==============================================
// MÉTODOS ESTÁTICOS
// ==============================================

/**
 * Busca performance por agente e período
 */
AgentPerformance.findByAgent = async function(userId, startDate, endDate) {
  return await this.findAll({
    where: {
      userId,
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
    },
    order: [['date', 'ASC']],
  });
};

/**
 * Ranking de agentes
 */
AgentPerformance.getRanking = async function(date, period = 'daily', limit = 10) {
  return await this.findAll({
    where: {
      date,
      period,
    },
    order: [['rankPosition', 'ASC']],
    limit,
    include: [
      {
        model: sequelize.models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'avatar'],
      },
    ],
  });
};

/**
 * Top performers
 */
AgentPerformance.getTopPerformers = async function(startDate, endDate, limit = 5) {
  const performances = await this.findAll({
    where: {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
    },
    attributes: [
      'userId',
      [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('rankScore')), 'avgScore'],
      [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('totalTickets')), 'totalTickets'],
    ],
    group: ['userId'],
    order: [[sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('rankScore')), 'DESC']],
    limit,
    raw: true,
  });
  
  return performances;
};

/**
 * Agentes abaixo da média
 */
AgentPerformance.getBelowAverage = async function(date, period = 'daily') {
  const avg = await this.findOne({
    where: { date, period },
    attributes: [[sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('rankScore')), 'avgScore']],
    raw: true,
  });
  
  if (!avg || !avg.avgScore) return [];
  
  return await this.findAll({
    where: {
      date,
      period,
      rankScore: {
        [sequelize.Sequelize.Op.lt]: avg.avgScore,
      },
    },
    order: [['rankScore', 'ASC']],
  });
};

module.exports = AgentPerformance;

