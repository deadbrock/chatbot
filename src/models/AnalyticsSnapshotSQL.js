const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * ANALYTICS SNAPSHOT MODEL
 * Armazena snapshots de métricas para análises rápidas
 */

const AnalyticsSnapshot = sequelize.define('AnalyticsSnapshot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  
  // Período
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Data do snapshot',
  },
  
  period: {
    type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly'),
    defaultValue: 'daily',
    comment: 'Período do snapshot',
  },
  
  // ==============================================
  // MÉTRICAS DE TICKETS
  // ==============================================
  
  totalTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de tickets no período',
  },
  
  openTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets abertos no final do período',
  },
  
  closedTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tickets fechados no período',
  },
  
  avgResolutionTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de resolução em minutos',
  },
  
  avgResponseTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tempo médio de primeira resposta em minutos',
  },
  
  slaCompliance: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de cumprimento de SLA (%)',
  },
  
  // ==============================================
  // MÉTRICAS DE MENSAGENS
  // ==============================================
  
  totalMessages: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de mensagens',
  },
  
  receivedMessages: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens recebidas',
  },
  
  sentMessages: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens enviadas',
  },
  
  avgMessagesPerTicket: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média de mensagens por ticket',
  },
  
  // ==============================================
  // MÉTRICAS DE CONTATOS
  // ==============================================
  
  totalContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de contatos no final do período',
  },
  
  newContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Novos contatos no período',
  },
  
  activeContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contatos ativos (com interação)',
  },
  
  blockedContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contatos bloqueados',
  },
  
  // ==============================================
  // MÉTRICAS DE SATISFAÇÃO (NPS)
  // ==============================================
  
  npsScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Score NPS (-100 a 100)',
  },
  
  totalRatings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de avaliações',
  },
  
  promoters: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de promotores (9-10)',
  },
  
  passives: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de passivos (7-8)',
  },
  
  detractors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de detratores (0-6)',
  },
  
  avgRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média das avaliações (0-10)',
  },
  
  // ==============================================
  // MÉTRICAS DE AGENTES
  // ==============================================
  
  activeAgents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Agentes ativos no período',
  },
  
  avgAgentLoad: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Carga média por agente (tickets)',
  },
  
  totalAgentHours: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Total de horas trabalhadas',
  },
  
  avgTicketsPerAgent: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Média de tickets por agente',
  },
  
  // ==============================================
  // MÉTRICAS DE CONVERSÃO
  // ==============================================
  
  conversionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Taxa de conversão (%)',
  },
  
  // ==============================================
  // BREAKDOWN DETALHADO
  // ==============================================
  
  breakdown: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Breakdown detalhado por dimensões',
    /*
    Estrutura:
    {
      byQueue: {
        'queue-id': { tickets: 10, avgTime: 20, ... },
        ...
      },
      byAgent: {
        'agent-id': { tickets: 5, avgTime: 15, ... },
        ...
      },
      byStatus: {
        'open': 5,
        'closed': 10,
        ...
      },
      byHour: {
        '0': 2,
        '1': 1,
        ...
      },
      byWeekday: {
        '0': 10, // Domingo
        '1': 15, // Segunda
        ...
      }
    }
    */
  },
  
  // ==============================================
  // METADADOS
  // ==============================================
  
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais',
  },
  
  calculatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Quando foi calculado',
  },
  
}, {
  tableName: 'analytics_snapshots',
  timestamps: true,
  indexes: [
    {
      fields: ['date', 'period'],
      unique: true,
    },
    {
      fields: ['date'],
    },
    {
      fields: ['period'],
    },
  ],
});

// ==============================================
// MÉTODOS DE INSTÂNCIA
// ==============================================

/**
 * Retorna resumo do snapshot
 */
AnalyticsSnapshot.prototype.getSummary = function() {
  return {
    date: this.date,
    period: this.period,
    tickets: {
      total: this.totalTickets,
      open: this.openTickets,
      closed: this.closedTickets,
      avgResolutionTime: this.avgResolutionTime,
    },
    messages: {
      total: this.totalMessages,
      received: this.receivedMessages,
      sent: this.sentMessages,
    },
    satisfaction: {
      nps: this.npsScore,
      ratings: this.totalRatings,
      avg: this.avgRating,
    },
    agents: {
      active: this.activeAgents,
      avgLoad: this.avgAgentLoad,
    },
  };
};

/**
 * Calcula variação em relação a outro snapshot
 */
AnalyticsSnapshot.prototype.calculateVariation = function(previousSnapshot) {
  if (!previousSnapshot) {
    return null;
  }
  
  const calculate = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  return {
    tickets: calculate(this.totalTickets, previousSnapshot.totalTickets),
    messages: calculate(this.totalMessages, previousSnapshot.totalMessages),
    nps: calculate(this.npsScore, previousSnapshot.npsScore),
    contacts: calculate(this.newContacts, previousSnapshot.newContacts),
    avgResolutionTime: calculate(this.avgResolutionTime, previousSnapshot.avgResolutionTime),
  };
};

// ==============================================
// MÉTODOS ESTÁTICOS
// ==============================================

/**
 * Busca snapshot por data e período
 */
AnalyticsSnapshot.findByDateAndPeriod = async function(date, period = 'daily') {
  return await this.findOne({
    where: { date, period },
  });
};

/**
 * Busca snapshots em um intervalo
 */
AnalyticsSnapshot.findInRange = async function(startDate, endDate, period = 'daily') {
  return await this.findAll({
    where: {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
      period,
    },
    order: [['date', 'ASC']],
  });
};

/**
 * Obtém último snapshot
 */
AnalyticsSnapshot.getLatest = async function(period = 'daily') {
  return await this.findOne({
    where: { period },
    order: [['date', 'DESC']],
  });
};

/**
 * Calcula médias de um período
 */
AnalyticsSnapshot.calculateAverages = async function(startDate, endDate, period = 'daily') {
  const snapshots = await this.findInRange(startDate, endDate, period);
  
  if (snapshots.length === 0) {
    return null;
  }
  
  const sum = snapshots.reduce((acc, snap) => ({
    totalTickets: acc.totalTickets + snap.totalTickets,
    avgResolutionTime: acc.avgResolutionTime + snap.avgResolutionTime,
    npsScore: acc.npsScore + snap.npsScore,
    totalRatings: acc.totalRatings + snap.totalRatings,
    activeAgents: acc.activeAgents + snap.activeAgents,
  }), {
    totalTickets: 0,
    avgResolutionTime: 0,
    npsScore: 0,
    totalRatings: 0,
    activeAgents: 0,
  });
  
  const count = snapshots.length;
  
  return {
    avgTicketsPerDay: sum.totalTickets / count,
    avgResolutionTime: sum.avgResolutionTime / count,
    avgNPS: sum.npsScore / count,
    totalRatings: sum.totalRatings,
    avgActiveAgents: sum.activeAgents / count,
  };
};

/**
 * Limpa snapshots antigos
 */
AnalyticsSnapshot.cleanup = async function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const deleted = await this.destroy({
    where: {
      date: {
        [sequelize.Sequelize.Op.lt]: cutoffDate,
      },
    },
  });
  
  return deleted;
};

/**
 * Obtém estatísticas globais
 */
AnalyticsSnapshot.getGlobalStats = async function() {
  const latest = await this.getLatest('daily');
  const lastWeek = await this.findInRange(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
    'daily'
  );
  
  return {
    latest: latest ? latest.getSummary() : null,
    lastWeek: {
      snapshots: lastWeek.length,
      averages: await this.calculateAverages(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date(),
        'daily'
      ),
    },
  };
};

module.exports = AnalyticsSnapshot;

