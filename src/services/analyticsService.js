const AnalyticsSnapshot = require('../models/AnalyticsSnapshotSQL');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const Contact = require('../models/ContactSQL');
const User = require('../models/UserSQL');
const Rating = require('../models/RatingSQL');
const logger = require('../utils/logger');
const moment = require('moment-timezone');
const { Op } = require('sequelize');

/**
 * ANALYTICS SERVICE
 * Serviço completo de análises e métricas
 */

class AnalyticsService {
  constructor() {
    this.timezone = 'America/Sao_Paulo';
  }

  // ==============================================
  // GERAÇÃO DE SNAPSHOTS
  // ==============================================

  /**
   * Gera snapshot diário
   */
  async generateDailySnapshot(date = new Date()) {
    try {
      const startOfDay = moment(date).tz(this.timezone).startOf('day').toDate();
      const endOfDay = moment(date).tz(this.timezone).endOf('day').toDate();

      logger.info(`📸 Gerando snapshot diário para ${moment(date).format('DD/MM/YYYY')}...`);

      const data = {
        date: moment(date).format('YYYY-MM-DD'),
        period: 'daily',

        // Tickets
        totalTickets: await this.countTickets(startOfDay, endOfDay),
        openTickets: await this.countOpenTickets(endOfDay),
        closedTickets: await this.countClosedTickets(startOfDay, endOfDay),
        avgResolutionTime: await this.calculateAvgResolutionTime(startOfDay, endOfDay),
        avgResponseTime: await this.calculateAvgResponseTime(startOfDay, endOfDay),
        slaCompliance: await this.calculateSLACompliance(startOfDay, endOfDay),

        // Mensagens
        totalMessages: await this.countMessages(startOfDay, endOfDay),
        receivedMessages: await this.countReceivedMessages(startOfDay, endOfDay),
        sentMessages: await this.countSentMessages(startOfDay, endOfDay),
        avgMessagesPerTicket: await this.calculateAvgMessagesPerTicket(startOfDay, endOfDay),

        // Contatos
        totalContacts: await this.countAllContacts(endOfDay),
        newContacts: await this.countNewContacts(startOfDay, endOfDay),
        activeContacts: await this.countActiveContacts(startOfDay, endOfDay),
        blockedContacts: await this.countBlockedContacts(endOfDay),

        // NPS
        npsScore: await this.calculateNPS(startOfDay, endOfDay),
        totalRatings: await this.countRatings(startOfDay, endOfDay),
        promoters: await this.countPromoters(startOfDay, endOfDay),
        passives: await this.countPassives(startOfDay, endOfDay),
        detractors: await this.countDetractors(startOfDay, endOfDay),
        avgRating: await this.calculateAvgRating(startOfDay, endOfDay),

        // Agentes
        activeAgents: await this.countActiveAgents(startOfDay, endOfDay),
        avgAgentLoad: await this.calculateAvgAgentLoad(startOfDay, endOfDay),
        totalAgentHours: await this.calculateTotalAgentHours(startOfDay, endOfDay),
        avgTicketsPerAgent: await this.calculateAvgTicketsPerAgent(startOfDay, endOfDay),

        // Conversão
        conversionRate: await this.calculateConversionRate(startOfDay, endOfDay),

        // Breakdown
        breakdown: await this.generateBreakdown(startOfDay, endOfDay),

        calculatedAt: new Date(),
      };

      // Verificar se já existe snapshot para este dia
      const existing = await AnalyticsSnapshot.findByDateAndPeriod(data.date, 'daily');

      let snapshot;
      if (existing) {
        await existing.update(data);
        snapshot = existing;
        logger.info(`✅ Snapshot diário atualizado para ${moment(date).format('DD/MM/YYYY')}`);
      } else {
        snapshot = await AnalyticsSnapshot.create(data);
        logger.info(`✅ Snapshot diário criado para ${moment(date).format('DD/MM/YYYY')}`);
      }

      return snapshot;
    } catch (error) {
      logger.error('Erro ao gerar snapshot diário:', error);
      throw error;
    }
  }

  // ==============================================
  // CÁLCULOS DE TICKETS
  // ==============================================

  async countTickets(startDate, endDate) {
    return await Ticket.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
    });
  }

  async countOpenTickets(date) {
    return await Ticket.count({
      where: {
        status: { [Op.in]: ['open', 'pending', 'waiting'] },
        createdAt: { [Op.lte]: date },
      },
    });
  }

  async countClosedTickets(startDate, endDate) {
    return await Ticket.count({
      where: {
        status: 'closed',
        closedAt: { [Op.between]: [startDate, endDate] },
      },
    });
  }

  async calculateAvgResolutionTime(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        status: 'closed',
        closedAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['createdAt', 'closedAt'],
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, ticket) => {
      const diff = moment(ticket.closedAt).diff(moment(ticket.createdAt), 'minutes');
      return sum + diff;
    }, 0);

    return Math.round(totalMinutes / tickets.length);
  }

  async calculateAvgResponseTime(startDate, endDate) {
    // Buscar primeiro mensagem de cada ticket
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          where: {
            fromMe: true,
          },
          required: false,
          order: [['timestamp', 'ASC']],
          limit: 1,
        },
      ],
    });

    const responseTimes = tickets
      .filter(ticket => ticket.messages && ticket.messages.length > 0)
      .map(ticket => {
        const firstResponse = ticket.messages[0];
        return moment(firstResponse.timestamp).diff(moment(ticket.createdAt), 'minutes');
      });

    if (responseTimes.length === 0) return 0;

    const avgMinutes = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(avgMinutes);
  }

  async calculateSLACompliance(startDate, endDate) {
    const totalTickets = await this.countTickets(startDate, endDate);
    if (totalTickets === 0) return 100;

    // Considerar SLA de 2 horas (120 minutos)
    const SLA_MINUTES = 120;

    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        status: 'closed',
      },
      attributes: ['createdAt', 'closedAt'],
    });

    const compliantTickets = tickets.filter(ticket => {
      const resolutionTime = moment(ticket.closedAt).diff(moment(ticket.createdAt), 'minutes');
      return resolutionTime <= SLA_MINUTES;
    });

    return Math.round((compliantTickets.length / tickets.length) * 100) || 0;
  }

  // ==============================================
  // CÁLCULOS DE MENSAGENS
  // ==============================================

  async countMessages(startDate, endDate) {
    return await ChatMessage.count({
      where: {
        timestamp: { [Op.between]: [startDate, endDate] },
      },
    });
  }

  async countReceivedMessages(startDate, endDate) {
    return await ChatMessage.count({
      where: {
        timestamp: { [Op.between]: [startDate, endDate] },
        fromMe: false,
      },
    });
  }

  async countSentMessages(startDate, endDate) {
    return await ChatMessage.count({
      where: {
        timestamp: { [Op.between]: [startDate, endDate] },
        fromMe: true,
      },
    });
  }

  async calculateAvgMessagesPerTicket(startDate, endDate) {
    const totalTickets = await this.countTickets(startDate, endDate);
    if (totalTickets === 0) return 0;

    const totalMessages = await this.countMessages(startDate, endDate);
    return parseFloat((totalMessages / totalTickets).toFixed(2));
  }

  // ==============================================
  // CÁLCULOS DE CONTATOS
  // ==============================================

  async countAllContacts(date) {
    return await Contact.count({
      where: {
        createdAt: { [Op.lte]: date },
      },
    });
  }

  async countNewContacts(startDate, endDate) {
    return await Contact.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
    });
  }

  async countActiveContacts(startDate, endDate) {
    // Contatos que tiveram tickets no período (usando userPhone como identificador)
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        userPhone: { [Op.ne]: null },
      },
      attributes: ['userPhone'],
      group: ['userPhone'],
    });

    return tickets.length;
  }

  async countBlockedContacts(date) {
    return await Contact.count({
      where: {
        isBlocked: true,
        updatedAt: { [Op.lte]: date },
      },
    });
  }

  // ==============================================
  // CÁLCULOS DE NPS
  // ==============================================

  async calculateNPS(startDate, endDate) {
    const ratings = await Rating.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['score'],
    });

    if (ratings.length === 0) return 0;

    const promoters = ratings.filter(r => r.score >= 9).length;
    const detractors = ratings.filter(r => r.score <= 6).length;
    const total = ratings.length;

    const nps = ((promoters - detractors) / total) * 100;
    return parseFloat(nps.toFixed(2));
  }

  async countRatings(startDate, endDate) {
    return await Rating.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
    });
  }

  async countPromoters(startDate, endDate) {
    return await Rating.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        score: { [Op.gte]: 9 },
      },
    });
  }

  async countPassives(startDate, endDate) {
    return await Rating.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        score: { [Op.between]: [7, 8] },
      },
    });
  }

  async countDetractors(startDate, endDate) {
    return await Rating.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        score: { [Op.lte]: 6 },
      },
    });
  }

  async calculateAvgRating(startDate, endDate) {
    const result = await Rating.findOne({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [[Ticket.sequelize.fn('AVG', Ticket.sequelize.col('score')), 'avg']],
      raw: true,
    });

    return parseFloat((result?.avg || 0).toFixed(2));
  }

  // ==============================================
  // CÁLCULOS DE AGENTES
  // ==============================================

  async countActiveAgents(startDate, endDate) {
    // Agentes que atenderam tickets no período
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        userId: { [Op.ne]: null },
      },
      attributes: ['userId'],
      group: ['userId'],
    });

    return tickets.length;
  }

  async calculateAvgAgentLoad(startDate, endDate) {
    const activeAgents = await this.countActiveAgents(startDate, endDate);
    if (activeAgents === 0) return 0;

    const totalTickets = await this.countTickets(startDate, endDate);
    return parseFloat((totalTickets / activeAgents).toFixed(2));
  }

  async calculateTotalAgentHours(startDate, endDate) {
    // Estimativa baseada em tickets atendidos (assumindo 15min por ticket)
    const totalTickets = await this.countTickets(startDate, endDate);
    return parseFloat((totalTickets * 0.25).toFixed(2)); // 15min = 0.25h
  }

  async calculateAvgTicketsPerAgent(startDate, endDate) {
    return await this.calculateAvgAgentLoad(startDate, endDate);
  }

  // ==============================================
  // CÁLCULOS DE CONVERSÃO
  // ==============================================

  async calculateConversionRate(startDate, endDate) {
    const totalContacts = await this.countActiveContacts(startDate, endDate);
    if (totalContacts === 0) return 0;

    // Considerar conversão como tickets que chegaram a "closed" com sucesso
    const convertedTickets = await Ticket.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        status: 'closed',
      },
    });

    return parseFloat(((convertedTickets / totalContacts) * 100).toFixed(2));
  }

  // ==============================================
  // BREAKDOWN DETALHADO
  // ==============================================

  async generateBreakdown(startDate, endDate) {
    return {
      byQueue: await this.breakdownByQueue(startDate, endDate),
      byAgent: await this.breakdownByAgent(startDate, endDate),
      byStatus: await this.breakdownByStatus(startDate, endDate),
      byHour: await this.breakdownByHour(startDate, endDate),
      byWeekday: await this.breakdownByWeekday(startDate, endDate),
    };
  }

  async breakdownByQueue(startDate, endDate) {
    // Tickets não têm queueId, usando department como alternativa
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'department',
        [Ticket.sequelize.fn('COUNT', Ticket.sequelize.col('id')), 'count'],
      ],
      group: ['department'],
      raw: true,
    });

    const breakdown = {};
    for (const ticket of tickets) {
      breakdown[ticket.department || 'sem-departamento'] = parseInt(ticket.count);
    }

    return breakdown;
  }

  async breakdownByAgent(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'userId',
        [Ticket.sequelize.fn('COUNT', Ticket.sequelize.col('id')), 'count'],
      ],
      group: ['userId'],
      raw: true,
    });

    const breakdown = {};
    for (const ticket of tickets) {
      breakdown[ticket.userId || 'sem-agente'] = parseInt(ticket.count);
    }

    return breakdown;
  }

  async breakdownByStatus(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'status',
        [Ticket.sequelize.fn('COUNT', Ticket.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const breakdown = {};
    for (const ticket of tickets) {
      breakdown[ticket.status] = parseInt(ticket.count);
    }

    return breakdown;
  }

  async breakdownByHour(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['createdAt'],
      raw: true,
    });

    const breakdown = {};
    for (let i = 0; i < 24; i++) {
      breakdown[i] = 0;
    }

    for (const ticket of tickets) {
      // Garantir que createdAt seja uma data válida
      const createdAt = ticket.createdAt instanceof Date 
        ? ticket.createdAt 
        : new Date(ticket.createdAt);
      
      if (!isNaN(createdAt.getTime())) {
        const hour = moment(createdAt).tz(this.timezone).hour();
        breakdown[hour]++;
      }
    }

    return breakdown;
  }

  async breakdownByWeekday(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['createdAt'],
      raw: true,
    });

    const breakdown = {};
    for (let i = 0; i < 7; i++) {
      breakdown[i] = 0;
    }

    for (const ticket of tickets) {
      // Garantir que createdAt seja uma data válida
      const createdAt = ticket.createdAt instanceof Date 
        ? ticket.createdAt 
        : new Date(ticket.createdAt);
      
      if (!isNaN(createdAt.getTime())) {
        const weekday = moment(createdAt).tz(this.timezone).day();
        breakdown[weekday]++;
      }
    }

    return breakdown;
  }

  // ==============================================
  // DASHBOARD DATA
  // ==============================================

  /**
   * Obtém dados completos do dashboard
   */
  async getDashboardData(startDate, endDate, filters = {}) {
    const snapshots = await AnalyticsSnapshot.findInRange(startDate, endDate, filters.period || 'daily');

    return {
      timeline: snapshots.map(s => s.getSummary()),
      summary: this.calculateSummary(snapshots),
      trends: this.calculateTrends(snapshots),
      comparison: await this.calculateComparison(startDate, endDate),
    };
  }

  /**
   * Calcula resumo dos snapshots
   */
  calculateSummary(snapshots) {
    if (snapshots.length === 0) {
      return null;
    }

    const sum = snapshots.reduce(
      (acc, snap) => ({
        totalTickets: acc.totalTickets + snap.totalTickets,
        closedTickets: acc.closedTickets + snap.closedTickets,
        totalMessages: acc.totalMessages + snap.totalMessages,
        totalRatings: acc.totalRatings + snap.totalRatings,
      }),
      { totalTickets: 0, closedTickets: 0, totalMessages: 0, totalRatings: 0 }
    );

    return {
      totalTickets: sum.totalTickets,
      closedTickets: sum.closedTickets,
      totalMessages: sum.totalMessages,
      totalRatings: sum.totalRatings,
      avgNPS: snapshots.reduce((sum, s) => sum + s.npsScore, 0) / snapshots.length,
    };
  }

  /**
   * Calcula tendências
   */
  calculateTrends(snapshots) {
    if (snapshots.length < 2) {
      return null;
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    const calculate = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      tickets: calculate(last.totalTickets, first.totalTickets),
      messages: calculate(last.totalMessages, first.totalMessages),
      nps: calculate(last.npsScore, first.npsScore),
    };
  }

  /**
   * Compara com período anterior
   */
  async calculateComparison(startDate, endDate) {
    const currentPeriod = await AnalyticsSnapshot.findInRange(startDate, endDate, 'daily');

    const duration = moment(endDate).diff(moment(startDate), 'days');
    const previousStart = moment(startDate).subtract(duration, 'days').toDate();
    const previousEnd = moment(startDate).subtract(1, 'day').toDate();

    const previousPeriod = await AnalyticsSnapshot.findInRange(previousStart, previousEnd, 'daily');

    if (currentPeriod.length === 0 || previousPeriod.length === 0) {
      return null;
    }

    const currentSummary = this.calculateSummary(currentPeriod);
    const previousSummary = this.calculateSummary(previousPeriod);

    const calculate = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      tickets: calculate(currentSummary.totalTickets, previousSummary.totalTickets),
      messages: calculate(currentSummary.totalMessages, previousSummary.totalMessages),
      nps: calculate(currentSummary.avgNPS, previousSummary.avgNPS),
    };
  }

  /**
   * Obtém KPIs principais
   */
  async getMainKPIs(startDate, endDate) {
    const snapshots = await AnalyticsSnapshot.findInRange(startDate, endDate, 'daily');

    if (snapshots.length === 0) {
      // Se não há snapshots, calcular em tempo real
      return {
        totalTickets: await this.countTickets(startDate, endDate),
        avgResolutionTime: await this.calculateAvgResolutionTime(startDate, endDate),
        npsScore: await this.calculateNPS(startDate, endDate),
        activeAgents: await this.countActiveAgents(startDate, endDate),
        conversionRate: await this.calculateConversionRate(startDate, endDate),
      };
    }

    const summary = this.calculateSummary(snapshots);
    return {
      totalTickets: summary.totalTickets,
      avgResolutionTime: snapshots.reduce((sum, s) => sum + s.avgResolutionTime, 0) / snapshots.length,
      npsScore: summary.avgNPS,
      activeAgents: snapshots[snapshots.length - 1].activeAgents,
      conversionRate: snapshots.reduce((sum, s) => sum + s.conversionRate, 0) / snapshots.length,
    };
  }
}

// Singleton
const analyticsService = new AnalyticsService();

module.exports = analyticsService;

