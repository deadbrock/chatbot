const { Op } = require('sequelize');
const TicketService = require('../services/ticketService');
const Ticket = require('../models/TicketSQL');
const { ok, created, fail } = require('../utils/http');

const ticketService = new TicketService();

async function list(req, res) {
  try {
    const { status, department, limit = 50 } = req.query;

    const where = {};
    if (department) where.departmentId = department;

    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.in]: ['open', 'waiting_human', 'in_progress'] };
    }

    const tickets = await Ticket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10) || 50
    });

    return ok(res, tickets);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function statsSummary(req, res) {
  try {
    const stats = await ticketService.getStats();
    return ok(res, stats);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function get(req, res) {
  try {
    const id = req.params.id;
    const asNumber = Number(id);

    const ticket = Number.isFinite(asNumber) && `${asNumber}` === `${id}`
      ? await Ticket.findByPk(asNumber)
      : await Ticket.findOne({ where: { protocol: id } });

    if (!ticket) return fail(res, 404, 'Ticket não encontrado');
    return ok(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function create(req, res) {
  try {
    const ticket = await ticketService.createTicket(req.body.userId, req.body);
    return created(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function patch(req, res) {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, req.body);
    return ok(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function assign(req, res) {
  try {
    const ticket = await ticketService.assignTicket(req.params.id, req.body.agentId);
    return ok(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function close(req, res) {
  try {
    const ticket = await ticketService.closeTicket(req.params.id, req.body.feedback);
    return ok(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = { list, statsSummary, get, create, patch, assign, close };


