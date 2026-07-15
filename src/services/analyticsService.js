const AnalyticsSnapshot = require('../models/AnalyticsSnapshotSQL');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const Contact = require('../models/ContactSQL');
const User = require('../models/UserSQL');
const Rating = require('../models/RatingSQL');
const logger = require('../utils/logger');
const moment = require('moment-timezone');
const { Op, fn, col, literal } = require('sequelize');
const { formatDateStr } = require('../utils/dbHelpers');

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
        status: { [Op.in]: ['open', 'waiting_human', 'in_progress'] },
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
      attributes: [[fn('AVG', col('score')), 'avg']],
      raw: true,
    });

    return parseFloat((result?.avg || 0).toFixed(2));
  }

  // ==============================================
  // CÁLCULOS DE AGENTES
  // ==============================================

  async countActiveAgents(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        assignedAt: { [Op.between]: [startDate, endDate] },
        assignedTo: { [Op.ne]: null },
      },
      attributes: ['assignedTo'],
      group: ['assignedTo'],
    });

    return tickets.length;
  }

  async countOnlineAgents() {
    return await User.count({
      where: {
        status: 'online',
        role: { [Op.in]: ['agent', 'manager'] },
      },
    });
  }

  async calculateAvgAgentLoad(startDate, endDate) {
    const activeAgents = await this.countActiveAgents(startDate, endDate);
    if (activeAgents === 0) return 0;

    const totalTickets = await this.countTickets(startDate, endDate);
    return parseFloat((totalTickets / activeAgents).toFixed(2));
  }

  async calculateTotalAgentHours(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: {
        assignedAt: { [Op.between]: [startDate, endDate] },
        closedAt: { [Op.ne]: null },
      },
      attributes: ['assignedAt', 'closedAt'],
    });

    const totalMinutes = tickets.reduce((sum, ticket) => {
      return sum + moment(ticket.closedAt).diff(moment(ticket.assignedAt), 'minutes');
    }, 0);

    return parseFloat((totalMinutes / 60).toFixed(2));
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
        assignedTo: { [Op.ne]: null },
      },
      attributes: [
        'assignedTo',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['assignedTo'],
      raw: true,
    });

    const agentIds = tickets.map((t) => t.assignedTo).filter(Boolean);
    const agents = agentIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: agentIds } },
          attributes: ['id', 'name'],
          raw: true,
        })
      : [];
    const agentNames = new Map(agents.map((a) => [a.id, a.name]));

    const breakdown = {};
    for (const ticket of tickets) {
      const label = agentNames.get(ticket.assignedTo) || `Atendente #${ticket.assignedTo}`;
      breakdown[label] = parseInt(ticket.count, 10);
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

    if (snapshots.length > 0) {
      return {
        timeline: snapshots.map((s) => s.getSummary()),
        summary: this.calculateSummary(snapshots),
        trends: this.calculateTrends(snapshots),
        comparison: await this.calculateComparison(startDate, endDate),
        source: 'snapshots',
      };
    }

    const timeline = await this.buildRealtimeTimeline(startDate, endDate);

    return {
      timeline,
      summary: this.calculateSummaryFromTimeline(timeline),
      trends: this.calculateTrendsFromTimeline(timeline),
      comparison: await this.calculateComparison(startDate, endDate),
      source: 'realtime',
    };
  }

  async buildRealtimeTimeline(startDate, endDate) {
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');

    const createdDateExpr = formatDateStr('createdAt');
    const closedDateExpr = formatDateStr('closedAt');
    const messageDateExpr = formatDateStr('timestamp');

    const ratingDateExpr = formatDateStr('createdAt');

    const [createdRows, closedRows, receivedRows, sentRows, ratingRows] = await Promise.all([
      Ticket.findAll({
        attributes: [[createdDateExpr, 'date'], [fn('COUNT', col('id')), 'total']],
        where: { createdAt: { [Op.between]: [start.toDate(), end.toDate()] } },
        group: [createdDateExpr],
        raw: true,
      }),
      Ticket.findAll({
        attributes: [[closedDateExpr, 'date'], [fn('COUNT', col('id')), 'closed']],
        where: {
          status: { [Op.in]: ['closed', 'resolved'] },
          closedAt: { [Op.between]: [start.toDate(), end.toDate()] },
        },
        group: [closedDateExpr],
        raw: true,
      }),
      ChatMessage.findAll({
        attributes: [[messageDateExpr, 'date'], [fn('COUNT', col('id')), 'received']],
        where: {
          timestamp: { [Op.between]: [start.toDate(), end.toDate()] },
          [Op.or]: [{ fromMe: false }, { direction: 'incoming' }],
        },
        group: [messageDateExpr],
        raw: true,
      }),
      ChatMessage.findAll({
        attributes: [[messageDateExpr, 'date'], [fn('COUNT', col('id')), 'sent']],
        where: {
          timestamp: { [Op.between]: [start.toDate(), end.toDate()] },
          [Op.or]: [{ fromMe: true }, { direction: 'outgoing' }],
        },
        group: [messageDateExpr],
        raw: true,
      }),
      Rating.findAll({
        attributes: [
          [ratingDateExpr, 'date'],
          [fn('COUNT', col('id')), 'ratings'],
          [fn('AVG', col('score')), 'avg'],
          [fn('SUM', literal('CASE WHEN score >= 9 THEN 1 ELSE 0 END')), 'promoters'],
          [fn('SUM', literal('CASE WHEN score <= 6 THEN 1 ELSE 0 END')), 'detractors'],
        ],
        where: { createdAt: { [Op.between]: [start.toDate(), end.toDate()] } },
        group: [ratingDateExpr],
        raw: true,
      }),
    ]);

    const toMap = (rows, field) => Object.fromEntries(
      rows.map((row) => [row.date, parseInt(row[field] || 0, 10)])
    );

    const createdMap = toMap(createdRows, 'total');
    const closedMap = toMap(closedRows, 'closed');
    const receivedMap = toMap(receivedRows, 'received');
    const sentMap = toMap(sentRows, 'sent');
    const ratingsByDate = Object.fromEntries(
      ratingRows.map((row) => {
        const count = parseInt(row.ratings || 0, 10);
        const promoters = parseInt(row.promoters || 0, 10);
        const detractors = parseInt(row.detractors || 0, 10);
        const nps = count > 0 ? parseFloat((((promoters - detractors) / count) * 100).toFixed(2)) : 0;
        return [row.date, {
          ratings: count,
          avg: parseFloat((row.avg || 0).toFixed(1)),
          nps,
        }];
      })
    );

    const dates = [];
    const cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
      dates.push(cursor.format('YYYY-MM-DD'));
      cursor.add(1, 'day');
    }

    return dates.map((date) => {
      const received = receivedMap[date] || 0;
      const sent = sentMap[date] || 0;
      const rating = ratingsByDate[date] || { nps: 0, ratings: 0, avg: 0 };
      return {
        date,
        period: 'daily',
        tickets: {
          total: createdMap[date] || 0,
          closed: closedMap[date] || 0,
        },
        messages: {
          total: received + sent,
          received,
          sent,
        },
        satisfaction: {
          nps: rating.nps,
          ratings: rating.ratings,
          avg: rating.avg,
        },
        agents: {
          active: 0,
          avgLoad: 0,
        },
      };
    });
  }

  calculateSummaryFromTimeline(timeline) {
    if (!timeline.length) return null;

    return {
      totalTickets: timeline.reduce((sum, item) => sum + (item.tickets?.total || 0), 0),
      closedTickets: timeline.reduce((sum, item) => sum + (item.tickets?.closed || 0), 0),
      totalMessages: timeline.reduce((sum, item) => sum + (item.messages?.total || 0), 0),
      totalRatings: timeline.reduce((sum, item) => sum + (item.satisfaction?.ratings || 0), 0),
      avgNPS: (() => {
        const ratedDays = timeline.filter((item) => (item.satisfaction?.ratings || 0) > 0);
        if (!ratedDays.length) return 0;
        return ratedDays.reduce((sum, item) => sum + (item.satisfaction?.nps || 0), 0) / ratedDays.length;
      })(),
    };
  }

  calculateTrendsFromTimeline(timeline) {
    if (timeline.length < 2) return null;

    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const calculate = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      tickets: calculate(last.tickets?.total || 0, first.tickets?.total || 0),
      messages: calculate(last.messages?.total || 0, first.messages?.total || 0),
      nps: calculate(last.satisfaction?.nps || 0, first.satisfaction?.nps || 0),
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
      return {
        totalTickets: await this.countTickets(startDate, endDate),
        avgResolutionTime: await this.calculateAvgResolutionTime(startDate, endDate),
        npsScore: await this.calculateNPS(startDate, endDate),
        activeAgents: await this.countOnlineAgents(),
        conversionRate: await this.calculateConversionRate(startDate, endDate),
      };
    }

    const summary = this.calculateSummary(snapshots);
    return {
      totalTickets: summary.totalTickets,
      avgResolutionTime: snapshots.reduce((sum, s) => sum + s.avgResolutionTime, 0) / snapshots.length,
      npsScore: summary.avgNPS,
      activeAgents: await this.countOnlineAgents(),
      conversionRate: snapshots.reduce((sum, s) => sum + s.conversionRate, 0) / snapshots.length,
    };
  }
}

// Singleton
const analyticsService = new AnalyticsService();

module.exports = analyticsService;

