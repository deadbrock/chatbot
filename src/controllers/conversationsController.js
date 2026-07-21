const inboxConversationService = require('../services/inboxConversationService');
const { ok, fail } = require('../utils/http');

async function list(req, res) {
  try {
    const { page, limit, filter, search } = req.query;
    const result = await inboxConversationService.listConversations({
      page,
      limit,
      filter,
      search,
      loggedUser: req.user
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function pending(req, res) {
  try {
    const loggedUser = req.user;
    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    if (loggedUser.role === 'admin') {
      return ok(res, []);
    }

    const items = await inboxConversationService.listPendingForAgent(loggedUser.id);
    return ok(res, items);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function get(req, res) {
  try {
    const conversation = await inboxConversationService.getConversationById(req.params.id);
    if (!conversation) {
      return fail(res, 404, 'Conversa não encontrada');
    }
    return ok(res, conversation);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function accept(req, res) {
  try {
    const loggedUser = req.user;
    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const { conversation, ticket, created } = await inboxConversationService.acceptConversation(
      req.params.id,
      loggedUser
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_accepted', {
        ticketId: ticket.id,
        conversationId: conversation.id,
        protocol: ticket.protocol,
        agentId: loggedUser.id,
        agentName: loggedUser.name
      });
      io.emit('conversation_updated', {
        conversationId: conversation.id,
        conversation
      });
    }

    return ok(res, {
      conversation,
      ticket,
      created,
      message: `Atendimento iniciado por ${loggedUser.name}`
    });
  } catch (error) {
    const status = error.message.includes('não encontrada') ? 404 : 500;
    return fail(res, status, error.message);
  }
}

async function finish(req, res) {
  try {
    const loggedUser = req.user;
    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const { conversation, ticket, postAttendance } = await inboxConversationService.finishConversation(
      req.params.id,
      loggedUser,
      { feedback: req.body?.feedback, initiatedBy: 'agent' }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_finished', {
        ticketId: ticket.id,
        conversationId: conversation.id
      });
      io.emit('conversation_updated', {
        conversationId: conversation.id,
        conversation
      });
    }

    return ok(res, {
      conversation,
      ticket,
      postAttendance,
      message: 'Atendimento finalizado. Cliente receberá solicitação de avaliação.'
    });
  } catch (error) {
    const status = error.message.includes('não encontrado') || error.message.includes('Nenhum')
      ? 400
      : 500;
    return fail(res, status, error.message);
  }
}

async function saveContact(req, res) {
  try {
    const loggedUser = req.user;
    if (!loggedUser) {
      return fail(res, 401, 'Usuário não autenticado');
    }

    const { conversation, contact, alreadySaved } = await inboxConversationService.saveConversationContact(
      req.params.id,
      loggedUser
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('conversation_updated', {
        conversationId: conversation.id,
        conversation
      });
    }

    return ok(res, {
      conversation,
      contact,
      alreadySaved,
      message: alreadySaved ? 'Contato já está salvo' : 'Contato salvo com sucesso'
    });
  } catch (error) {
    const status = error.message.includes('não encontrad') ? 404 : 500;
    return fail(res, status, error.message);
  }
}

module.exports = { list, get, pending, accept, finish, saveContact };
