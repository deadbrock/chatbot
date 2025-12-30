const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * QUEUE PERFORMANCE MODEL
 * Armazena métricas de performance de filas
 */

const QueuePerformance = sequelize.define('QueuePerformance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  
  queueId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID da fila',
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
  // VOLUME
  // ==============================================
  
  totalTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de tickets',
  },
  
  newTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Novos tickets',
  },
  
  closedTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets fechados',
  },
  
  pendingTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets pendentes',
  },
  
  // ==============================================
  // TEMPO
  // ==============================================
  
  avgWaitTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de espera (minutos)',
  },
  
  avgResolutionTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de resolução (minutos)',
  },
  
  maxWaitTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo máximo de espera (minutos)',
  },
  
  minWaitTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo mínimo de espera (minutos)',
  },
  
  // ==============================================
  // SLA
  // ==============================================
  
  slaTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 120,
    comment: 'Meta de SLA (minutos)',
  },
  
  slaCompliance: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de cumprimento de SLA (%)',
  },
  
  ticketsWithinSLA: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets dentro do SLA',
  },
  
  ticketsOutsideSLA: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets fora do SLA',
  },
  
  // ==============================================
  // TAXA DE ABANDONO
  // ==============================================
  
  abandonedTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets abandonados',
  },
  
  abandonRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de abandono (%)',
  },
  
  // ==============================================
  // TRANSFERÊNCIAS
  // ==============================================
  
  transferredIn: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets transferidos para esta fila',
  },
  
  transferredOut: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets transferidos desta fila',
  },
  
  transferRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de transferência (%)',
  },
  
  // ==============================================
  // DISTRIBUIÇÃO
  // ==============================================
  
  ticketsByHour: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Distribuição por hora {0: 5, 1: 3, ...}',
  },
  
  ticketsByDay: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Distribuição por dia {0: 50, 1: 120, ...}',
  },
  
  peakHour: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Hora de pico (0-23)',
  },
  
  peakDay: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Dia de pico (0-6)',
  },
  
  // ==============================================
  // AGENTES
  // ==============================================
  
  activeAgents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Agentes ativos',
  },
  
  avgAgentLoad: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Carga média por agente',
  },
  
  maxAgentLoad: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Carga máxima de agente',
  },
  
  // ==============================================
  // SATISFAÇÃO
  // ==============================================
  
  npsScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Score NPS da fila',
  },
  
  totalRatings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de avaliações',
  },
  
  avgRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média das avaliações',
  },
  
  // ==============================================
  // METADADOS
  // ==============================================
  
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  
}, {
  tableName: 'queue_performance',
  timestamps: true,
  indexes: [
    {
      fields: ['queueId', 'date', 'period'],
      unique: true,
    },
    {
      fields: ['date'],
    },
    {
      fields: ['slaCompliance'],
    },
  ],
});

// ==============================================
// MÉTODOS DE INSTÂNCIA
// ==============================================

/**
 * Retorna resumo da performance
 */
QueuePerformance.prototype.getSummary = function() {
  return {
    queueId: this.queueId,
    date: this.date,
    totalTickets: this.totalTickets,
    avgWaitTime: this.avgWaitTime,
    slaCompliance: this.slaCompliance,
    abandonRate: this.abandonRate,
    npsScore: this.npsScore,
  };
};

/**
 * Identifica problemas na fila
 */
QueuePerformance.prototype.getIssues = function() {
  const issues = [];
  
  // SLA baixo
  if (this.slaCompliance < 80) {
    issues.push({
      type: 'sla',
      severity: this.slaCompliance < 50 ? 'critical' : 'warning',
      message: `SLA em ${this.slaCompliance.toFixed(1)}%`,
    });
  }
  
  // Taxa de abandono alta
  if (this.abandonRate > 20) {
    issues.push({
      type: 'abandon',
      severity: this.abandonRate > 40 ? 'critical' : 'warning',
      message: `Taxa de abandono em ${this.abandonRate.toFixed(1)}%`,
    });
  }
  
  // Tempo de espera alto
  if (this.avgWaitTime > 60) {
    issues.push({
      type: 'wait_time',
      severity: this.avgWaitTime > 120 ? 'critical' : 'warning',
      message: `Tempo de espera médio de ${this.avgWaitTime} minutos`,
    });
  }
  
  // NPS baixo
  if (this.npsScore < 0) {
    issues.push({
      type: 'satisfaction',
      severity: this.npsScore < -50 ? 'critical' : 'warning',
      message: `NPS baixo: ${this.npsScore.toFixed(1)}`,
    });
  }
  
  return issues;
};

/**
 * Calcula score de eficiência
 */
QueuePerformance.prototype.getEfficiencyScore = function() {
  const slaScore = this.slaCompliance;
  const abandonScore = Math.max(0, 100 - this.abandonRate);
  const speedScore = Math.max(0, 100 - (this.avgWaitTime / 2));
  const satisfactionScore = ((this.npsScore + 100) / 2);
  
  return parseFloat((
    (slaScore * 0.3) +
    (abandonScore * 0.3) +
    (speedScore * 0.2) +
    (satisfactionScore * 0.2)
  ).toFixed(2));
};

// ==============================================
// MÉTODOS ESTÁTICOS
// ==============================================

/**
 * Busca performance por fila e período
 */
QueuePerformance.findByQueue = async function(queueId, startDate, endDate) {
  return await this.findAll({
    where: {
      queueId,
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
    },
    order: [['date', 'ASC']],
  });
};

/**
 * Ranking de filas
 */
QueuePerformance.getRanking = async function(date, period = 'daily', sortBy = 'slaCompliance') {
  return await this.findAll({
    where: {
      date,
      period,
    },
    order: [[sortBy, 'DESC']],
  });
};

/**
 * Filas com problemas
 */
QueuePerformance.getProblematicQueues = async function(date, period = 'daily') {
  return await this.findAll({
    where: {
      date,
      period,
      [sequelize.Sequelize.Op.or]: [
        { slaCompliance: { [sequelize.Sequelize.Op.lt]: 80 } },
        { abandonRate: { [sequelize.Sequelize.Op.gt]: 20 } },
        { avgWaitTime: { [sequelize.Sequelize.Op.gt]: 60 } },
      ],
    },
    order: [['slaCompliance', 'ASC']],
  });
};

/**
 * Filas com melhor performance
 */
QueuePerformance.getTopPerforming = async function(startDate, endDate, limit = 5) {
  const performances = await this.findAll({
    where: {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
    },
    attributes: [
      'queueId',
      [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('slaCompliance')), 'avgSLA'],
      [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('totalTickets')), 'totalTickets'],
    ],
    group: ['queueId'],
    order: [[sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('slaCompliance')), 'DESC']],
    limit,
    raw: true,
  });
  
  return performances;
};

/**
 * Estatísticas globais de filas
 */
QueuePerformance.getGlobalStats = async function(date, period = 'daily') {
  const stats = await this.findOne({
    where: { date, period },
    attributes: [
      [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('slaCompliance')), 'avgSLA'],
      [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('avgWaitTime')), 'avgWaitTime'],
      [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('abandonRate')), 'avgAbandonRate'],
      [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('totalTickets')), 'totalTickets'],
    ],
    raw: true,
  });
  
  return stats || {};
};

module.exports = QueuePerformance;

