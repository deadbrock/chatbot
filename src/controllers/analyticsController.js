const { Op, fn, col, literal } = require('sequelize');
const Ticket = require('../models/TicketSQL');
const Session = require('../models/SessionSQL');
const User = require('../models/UserSQL');
const Contact = require('../models/ContactSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const { ok, fail } = require('../utils/http');
const { formatDateStr, dateDiffMinutes, dateDiffMillis, rawExtractHourSQL } = require('../utils/dbHelpers');

const userPresenceService = require('../services/userPresenceService');

const STAFF_ROLES = ['agent', 'manager'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildStaffUserWhere({ onlineOnly = false } = {}) {
  const where = {
    active: true,
    role: { [Op.in]: STAFF_ROLES }
  };

  if (onlineOnly) {
    where.status = 'online';
  }

  return where;
}

async function countStaffUsers(options = {}) {
  return userPresenceService.countStaffUsers(options);
}

function buildFinishedTodayWhere(today, tomorrow) {
  return {
    status: { [Op.in]: ['closed', 'resolved'] },
    [Op.or]: [
      { closedAt: { [Op.gte]: today, [Op.lt]: tomorrow } },
      { resolvedAt: { [Op.gte]: today, [Op.lt]: tomorrow } }
    ]
  };
}

async function dashboard(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ticketsToday = await Ticket.count({ where: { createdAt: { [Op.gte]: today } } });
    const ticketsOpen = await Ticket.count({
      where: { status: { [Op.in]: ['open', 'waiting_human', 'in_progress'] } }
    });
    const sessionsActive = await Session.count({ where: { active: true } });
    const agentsOnline = await countStaffUsers({ onlineOnly: true });

    const avgRatingRow = await Ticket.findOne({
      attributes: [[fn('AVG', col('rating')), 'avg']],
      where: { rating: { [Op.ne]: null } },
      raw: true
    });

    const avgResponseTimeRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMillis('assignedAt', 'createdAt')), 'avg']],
      where: { assignedAt: { [Op.ne]: null }, createdAt: { [Op.ne]: null } },
      raw: true
    });

    return ok(res, {
      ticketsToday,
      ticketsOpen,
      sessionsActive,
      agentsOnline,
      avgRating: Number(avgRatingRow?.avg || 0),
      avgResponseTime: Number(avgResponseTimeRow?.avg || 0)
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function ticketsByDepartment(req, res) {
  try {
    const rows = await Ticket.findAll({
      attributes: [
        [col('department'), '_id'],
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', literal("CASE WHEN status IN ('open','waiting_human','in_progress') THEN 1 ELSE 0 END")), 'open'],
        [fn('SUM', literal("CASE WHEN status = 'closed' THEN 1 ELSE 0 END")), 'closed']
      ],
      group: ['department'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });
    return ok(res, rows);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function ticketsByStatus(req, res) {
  try {
    const rows = await Ticket.findAll({
      attributes: [[col('status'), '_id'], [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });
    return ok(res, rows);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function ticketsTimeline(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const groupExpr = formatDateStr('createdAt');
    const rows = await Ticket.findAll({
      attributes: [[groupExpr, '_id'], [fn('COUNT', col('id')), 'count']],
      where: { createdAt: { [Op.gte]: startDate } },
      group: [groupExpr],
      order: [[groupExpr, 'ASC']],
      raw: true
    });
    return ok(res, rows);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function ratings(req, res) {
  try {
    const rows = await Ticket.findAll({
      attributes: [[col('rating'), '_id'], [fn('COUNT', col('id')), 'count']],
      where: { rating: { [Op.ne]: null } },
      group: ['rating'],
      order: [[col('rating'), 'ASC']],
      raw: true
    });

    const countByRating = new Map(rows.map((row) => [Number(row._id), Number(row.count || 0)]));
    const data = [1, 2, 3, 4, 5].map((rating) => ({
      _id: rating,
      count: countByRating.get(rating) || 0
    }));

    return ok(res, data);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function agentsPerformance(req, res) {
  try {
    const rows = await Ticket.findAll({
      attributes: [
        ['assignedTo', '_id'],
        [fn('COUNT', col('id')), 'totalTickets'],
        [fn('AVG', col('rating')), 'avgRating'],
        [fn('SUM', literal("CASE WHEN status = 'resolved' THEN 1 ELSE 0 END")), 'resolved']
      ],
      where: { assignedTo: { [Op.ne]: null } },
      group: ['assignedTo'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    const agentIds = rows.map(r => Number(r._id)).filter(n => Number.isFinite(n));
    const agents = await User.findAll({
      where: { id: { [Op.in]: agentIds } },
      attributes: ['id', 'name'],
      raw: true
    });
    const agentById = new Map(agents.map(a => [a.id, a.name]));

    const data = rows.map(r => ({
      ...r,
      agentName: agentById.get(Number(r._id)) || `Agente #${r._id}`,
      totalTickets: Number(r.totalTickets || 0),
      resolved: Number(r.resolved || 0),
      avgRating: Number(r.avgRating || 0)
    }));

    return ok(res, data);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

// ============================================
// NOVAS MÉTRICAS AMANDA-STYLE
// ============================================

/**
 * Métricas Estendidas - 11 Cards
 * GET /api/analytics/metrics/extended
 */
async function extendedMetrics(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const ticketsAtendimento = await Ticket.count({
      where: { status: 'in_progress' }
    });

    const ticketsAguardando = await Ticket.count({
      where: { status: { [Op.in]: ['open', 'waiting_human'] } }
    });

    const ticketsFinalizados = await Ticket.count({
      where: buildFinishedTodayWhere(today, tomorrow)
    });

    const msgsRecebidas = await ChatMessage.count({
      where: {
        timestamp: { [Op.gte]: today, [Op.lt]: tomorrow },
        [Op.or]: [{ fromMe: false }, { direction: 'incoming' }]
      }
    });

    const msgsEnviadas = await ChatMessage.count({
      where: {
        timestamp: { [Op.gte]: today, [Op.lt]: tomorrow },
        [Op.or]: [{ fromMe: true }, { direction: 'outgoing' }]
      }
    });

    const avgAtendimentoResolvedRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMinutes('resolvedAt', 'assignedAt')), 'avg']],
      where: { resolvedAt: { [Op.ne]: null }, assignedAt: { [Op.ne]: null } },
      raw: true
    });

    const avgAtendimentoClosedRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMinutes('closedAt', 'assignedAt')), 'avg']],
      where: {
        closedAt: { [Op.ne]: null },
        assignedAt: { [Op.ne]: null },
        resolvedAt: null
      },
      raw: true
    });

    const avgResolved = Number(avgAtendimentoResolvedRow?.avg || 0);
    const avgClosed = Number(avgAtendimentoClosedRow?.avg || 0);
    const tempoAtendimento = Math.round(avgResolved && avgClosed
      ? (avgResolved + avgClosed) / 2
      : (avgResolved || avgClosed || 0));

    const avgEsperaRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMinutes('assignedAt', 'createdAt')), 'avg']],
      where: { assignedAt: { [Op.ne]: null }, createdAt: { [Op.ne]: null } },
      raw: true
    });

    const novosContatos = await Contact.count({
      where: { createdAt: { [Op.gte]: today, [Op.lt]: tomorrow } }
    });

    const atendentesOnline = await countStaffUsers({ onlineOnly: true });
    const atendentesTotal = await countStaffUsers();

    return ok(res, {
      ticketsAtendimento,
      ticketsAguardando,
      ticketsFinalizados,
      msgsRecebidas,
      msgsEnviadas,
      tempoAtendimento,
      tempoEspera: Math.round(avgEsperaRow?.avg || 0),
      novosContatos,
      atendentesAtivos: `${atendentesOnline}/${atendentesTotal}`
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Ranking de Contatos - Top 10
 */
async function contactsRanking(req, res) {
  try {
    const { limit = 10 } = req.query;

    const rankings = await Ticket.findAll({
      attributes: [
        'userId',
        [fn('COUNT', col('id')), 'ticketCount'],
        [col('department'), 'department'],
        [fn('SUM', dateDiffMinutes('closedAt', 'createdAt')), 'totalTime']
      ],
      where: { userId: { [Op.ne]: null } },
      group: ['userId', 'department'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: parseInt(limit, 10),
      raw: true
    });

    const contactIds = rankings.map((r) => r.userId).filter((id) => UUID_RE.test(String(id)));
    const contacts = contactIds.length
      ? await Contact.findAll({
          where: { id: { [Op.in]: contactIds } },
          attributes: ['id', 'name', 'phone'],
          raw: true
        })
      : [];
    const contactMap = new Map(contacts.map((c) => [String(c.id), c]));

    const formattedRankings = rankings.map((r) => {
      const contact = contactMap.get(String(r.userId));
      return {
        userId: r.userId,
        name: contact?.name || r.userId,
        ticketCount: parseInt(r.ticketCount, 10),
        department: r.department || 'Sem departamento',
        totalTime: Math.round(r.totalTime || 0)
      };
    });

    return ok(res, formattedRankings);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Ranking de Atendentes
 */
async function agentsRanking(req, res) {
  try {
    const rankings = await Ticket.findAll({
      attributes: [
        'assignedTo',
        [fn('COUNT', col('id')), 'ticketCount'],
        [fn('AVG', col('rating')), 'avgRating'],
        [fn('AVG', dateDiffMinutes('closedAt', 'assignedAt')), 'avgTime']
      ],
      where: { assignedTo: { [Op.ne]: null } },
      group: ['assignedTo'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });

    const agentIds = rankings.map(r => r.assignedTo);
    const agents = await User.findAll({
      where: { id: { [Op.in]: agentIds } },
      attributes: ['id', 'name', 'email', 'status'],
      raw: true
    });

    const agentsMap = {};
    agents.forEach(a => { agentsMap[a.id] = a; });

    const formattedRankings = rankings.map(r => ({
      agentId: r.assignedTo,
      name: agentsMap[r.assignedTo]?.name || 'Desconhecido',
      email: agentsMap[r.assignedTo]?.email,
      status: agentsMap[r.assignedTo]?.status,
      ticketCount: parseInt(r.ticketCount),
      avgRating: parseFloat((r.avgRating || 0).toFixed(1)),
      avgTime: Math.round(r.avgTime || 0)
    }));

    return ok(res, formattedRankings);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Métricas de Tempo
 */
async function timeMetrics(req, res) {
  try {
    const avgAtendimentoRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMinutes('closedAt', 'assignedAt')), 'avg']],
      where: { closedAt: { [Op.ne]: null }, assignedAt: { [Op.ne]: null } },
      raw: true
    });

    const avgEsperaRow = await Ticket.findOne({
      attributes: [[fn('AVG', dateDiffMinutes('assignedAt', 'createdAt')), 'avg']],
      where: { assignedAt: { [Op.ne]: null }, createdAt: { [Op.ne]: null } },
      raw: true
    });

    const outgoingMessages = await ChatMessage.findAll({
      attributes: ['ticketId', 'timestamp'],
      where: {
        ticketId: { [Op.ne]: null },
        [Op.or]: [{ fromMe: true }, { direction: 'outgoing' }]
      },
      order: [['timestamp', 'ASC']],
      raw: true
    });

    const firstByTicket = new Map();
    for (const msg of outgoingMessages) {
      if (!firstByTicket.has(msg.ticketId)) {
        firstByTicket.set(msg.ticketId, msg.timestamp);
      }
    }

    let tempoPrimeiraResposta = 0;
    if (firstByTicket.size > 0) {
      const tickets = await Ticket.findAll({
        where: { id: { [Op.in]: [...firstByTicket.keys()] } },
        attributes: ['id', 'createdAt'],
        raw: true
      });

      const responseMinutes = tickets.map((ticket) => {
        const firstAt = firstByTicket.get(ticket.id);
        if (!firstAt || !ticket.createdAt) return null;
        return Math.max(0, Math.round((new Date(firstAt) - new Date(ticket.createdAt)) / 60000));
      }).filter((v) => v !== null);

      tempoPrimeiraResposta = responseMinutes.length
        ? Math.round(responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length)
        : 0;
    }

    const tempoAtendimento = Math.round(avgAtendimentoRow?.avg || 0);
    const tempoEspera = Math.round(avgEsperaRow?.avg || 0);

    return ok(res, {
      tempoAtendimento,
      tempoEspera,
      tempoPrimeiraResposta,
      total: tempoAtendimento + tempoEspera + tempoPrimeiraResposta
    });
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return fail(res, 500, error.message);
  }
}

/**
 * Atividade por Hora (0h-23h)
 */
async function hourlyActivity(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hourExpr = literal(rawExtractHourSQL('createdAt'));
    const hourlyData = await Ticket.findAll({
      attributes: [
        [hourExpr, 'hour'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { createdAt: { [Op.gte]: today } },
      group: [hourExpr],
      order: [[hourExpr, 'ASC']],
      raw: true
    });

    const fullHours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    hourlyData.forEach(item => {
      if (item.hour !== null) {
        fullHours[item.hour].count = parseInt(item.count);
      }
    });

    const maxCount = Math.max(...fullHours.map(h => h.count));
    const peakHours = fullHours.filter(h => h.count === maxCount);
    const peak = peakHours.length > 0
      ? `Entre ${peakHours[0].hour}h e ${peakHours[peakHours.length - 1].hour}h (${maxCount})`
      : 'N/A';

    return ok(res, { hourly: fullHours, peak });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Distribuição por Canal
 */
async function channelDistribution(req, res) {
  try {
    // Como não temos coluna 'channel', retornar apenas WhatsApp por enquanto
    const total = await Ticket.count();
    
    const distribution = [
      {
        channel: 'whatsapp',
        count: total,
        percentage: 100
      }
    ];

    return ok(res, { channels: distribution, totalChannels: 1, total });
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return fail(res, 500, error.message);
  }
}

/**
 * Distribuição por Departamento
 */
async function departmentDistribution(req, res) {
  try {
    const departments = await Ticket.findAll({
      attributes: [
        [col('department'), 'department'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['department'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });

    const total = departments.reduce((sum, d) => sum + parseInt(d.count), 0);
    const distribution = departments.map(d => ({
      department: d.department || 'Sem departamento',
      count: parseInt(d.count),
      percentage: total > 0 ? Math.round((parseInt(d.count) / total) * 100) : 0
    }));

    return ok(res, { departments: distribution, totalDepartments: departments.length, total });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = { 
  dashboard, 
  ticketsByDepartment, 
  ticketsByStatus, 
  ticketsTimeline, 
  ratings, 
  agentsPerformance,
  // Novas métricas Amanda
  extendedMetrics,
  contactsRanking,
  agentsRanking,
  timeMetrics,
  hourlyActivity,
  channelDistribution,
  departmentDistribution
};


