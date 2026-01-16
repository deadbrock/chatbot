const { Op } = require('sequelize');
const TicketService = require('../services/ticketService');
const Ticket = require('../models/TicketSQL');
const { ok, created, fail } = require('../utils/http');

const ticketService = new TicketService();

async function list(req, res) {
  try {
    const { status, department, limit = 50, assignedTo } = req.query;
    const loggedUser = req.user; // Usuário autenticado

    const where = {};
    if (department) where.departmentId = department;

    if (status) {
      // Se status é uma string com vírgulas, transformar em array
      const statusArray = typeof status === 'string' && status.includes(',')
        ? status.split(',').map(s => s.trim())
        : [status];
      
      where.status = statusArray.length > 1 
        ? { [Op.in]: statusArray }
        : statusArray[0];
    } else {
      // Padrão: mostrar apenas tickets ativos
      where.status = { [Op.in]: ['open', 'waiting_human', 'in_progress'] };
    }

    // 🎯 FILTRO POR ATENDENTE:
    // Se o usuário é 'agent', mostrar APENAS seus tickets
    // Se é 'admin' ou 'manager', mostrar TODOS (ou filtrar por assignedTo se especificado)
    if (loggedUser && loggedUser.role === 'agent') {
      where.assignedTo = loggedUser.id;
    } else if (assignedTo) {
      // Admin/Manager pode filtrar por atendente específico via query param
      where.assignedTo = assignedTo;
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

async function transfer(req, res) {
  console.log('🎯 TRANSFER FUNCTION CALLED:', req.params, req.body);
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const loggedUser = req.user;
    
    // 🔐 Verificar permissões (apenas admin ou manager)
    if (loggedUser.role !== 'admin' && loggedUser.role !== 'manager') {
      return fail(res, 403, 'Você não tem permissão para transferir tickets');
    }
    
    if (!agentId) {
      return fail(res, 400, 'ID do atendente é obrigatório');
    }
    
    // Buscar ticket
    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return fail(res, 404, 'Ticket não encontrado');
    }
    
    // Buscar novo atendente
    const User = require('../models/UserSQL');
    const newAgent = await User.findByPk(agentId);
    if (!newAgent) {
      return fail(res, 404, 'Atendente não encontrado');
    }
    
    // Atualizar ticket
    const oldAgentId = ticket.assignedTo;
    ticket.assignedTo = agentId;
    ticket.assignedAt = new Date();
    await ticket.save();
    
    console.log(`✅ Ticket ${ticket.protocol} transferido de ${oldAgentId || 'Ninguém'} para ${newAgent.name} (ID: ${agentId})`);
    
    // TODO: Notificar novo atendente via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_transferred', {
        ticketId: ticket.id,
        protocol: ticket.protocol,
        newAgentId: agentId,
        newAgentName: newAgent.name,
        transferredBy: loggedUser.name
      });
    }
    
    return ok(res, {
      ticket,
      message: `Ticket transferido para ${newAgent.name}`
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Atendente aceita um ticket
 * POST /api/tickets/:id/accept
 */
async function acceptTicket(req, res) {
  try {
    const { id } = req.params;
    const loggedUser = req.user;

    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return fail(res, 404, 'Ticket não encontrado');
    }

    // Verificar se ticket está aguardando atendente
    if (ticket.status !== 'waiting_human' && ticket.status !== 'open') {
      return fail(res, 400, 'Ticket não está disponível para aceitar');
    }

    // Atribuir ticket ao atendente
    ticket.assignedTo = loggedUser.id;
    ticket.assignedAt = new Date();
    ticket.status = 'in_progress';
    await ticket.save();

    console.log(`✅ Ticket ${ticket.protocol} aceito por ${loggedUser.name} (ID: ${loggedUser.id})`);

    // Notificar via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_accepted', {
        ticketId: ticket.id,
        protocol: ticket.protocol,
        agentId: loggedUser.id,
        agentName: loggedUser.name
      });
    }

    return ok(res, {
      ticket,
      message: `Ticket aceito por ${loggedUser.name}`
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Atendente rejeita um ticket (volta para fila ou IA assume)
 * POST /api/tickets/:id/reject
 */
async function rejectTicket(req, res) {
  try {
    const { id } = req.params;
    const loggedUser = req.user;

    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return fail(res, 404, 'Ticket não encontrado');
    }

    // Mudar para 'open' - IA assume
    ticket.status = 'open';
    await ticket.save();

    console.log(`⏭️ Ticket ${ticket.protocol} rejeitado por ${loggedUser.name}. IA assumindo...`);

    // Notificar via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_rejected', {
        ticketId: ticket.id,
        protocol: ticket.protocol,
        rejectedBy: loggedUser.name
      });
    }

    return ok(res, {
      ticket,
      message: 'Ticket rejeitado. IA assumirá o atendimento.'
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Finalizar atendimento (atendente encerra o ticket)
 * POST /api/tickets/:id/finish
 */
async function finishTicket(req, res) {
  try {
    const { id } = req.params;
    const { feedback, rating } = req.body;
    const loggedUser = req.user;

    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return fail(res, 404, 'Ticket não encontrado');
    }

    // Verificar se é o atendente responsável
    if (ticket.assignedTo !== loggedUser.id && loggedUser.role !== 'admin' && loggedUser.role !== 'manager') {
      return fail(res, 403, 'Você não tem permissão para finalizar este ticket');
    }

    // Encerrar ticket
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.resolvedAt = new Date();
    
    if (feedback) {
      ticket.feedback = feedback;
    }
    if (rating) {
      ticket.rating = rating;
    }
    
    await ticket.save();

    console.log(`✅ Ticket ${ticket.protocol} finalizado por ${loggedUser.name}`);

    // Notificar via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_finished', {
        ticketId: ticket.id,
        protocol: ticket.protocol,
        closedBy: loggedUser.name
      });
    }

    return ok(res, {
      ticket,
      message: 'Ticket finalizado com sucesso'
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = { list, statsSummary, get, create, patch, assign, close, transfer, acceptTicket, rejectTicket, finishTicket };


