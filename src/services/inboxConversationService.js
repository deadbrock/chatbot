const { Op } = require('sequelize');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Conversation = require('../models/ConversationSQL');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const Contact = require('../models/ContactSQL');
const chatMediaUtils = require('../utils/chatMediaUtils');
const contactDisplayUtils = require('../utils/contactDisplayUtils');
const whatsappProfilePicService = require('./whatsappProfilePicService');
const logger = require('../utils/logger');

let schemaReady = false;

async function ensureSchema() {
  const qi = sequelize.getQueryInterface();

  // Sempre verificar colunas incrementais (podem ter sido adicionadas após schemaReady)
  try {
    const contacts = await qi.describeTable('contacts');
    if (contacts && !contacts.contract) {
      await qi.addColumn('contacts', 'contract', {
        type: DataTypes.STRING,
        allowNull: true
      });
      logger.info('✅ Coluna contacts.contract adicionada');
    }
  } catch (err) {
    logger.warn('ensureSchema contacts.contract:', err.message);
  }

  try {
    const cmTypes = await qi.describeTable('chat_messages');
    if (cmTypes?.ticketId?.type && String(cmTypes.ticketId.type).toUpperCase().includes('UUID')) {
      await sequelize.query(`
        ALTER TABLE "chat_messages"
        ALTER COLUMN "ticketId" DROP DEFAULT,
        ALTER COLUMN "ticketId" TYPE INTEGER USING NULL
      `);
      logger.info('✅ Coluna chat_messages.ticketId convertida para INTEGER');
    }

    if (cmTypes?.userId?.type && String(cmTypes.userId.type).toUpperCase().includes('UUID')) {
      await sequelize.query(`
        ALTER TABLE "chat_messages"
        ALTER COLUMN "userId" DROP DEFAULT,
        ALTER COLUMN "userId" TYPE INTEGER USING NULL
      `);
      logger.info('✅ Coluna chat_messages.userId convertida para INTEGER');
    }
  } catch (err) {
    logger.warn('ensureSchema chat_messages types:', err.message);
  }

  if (schemaReady) return;

  try {
    const cm = await qi.describeTable('chat_messages');
    if (cm && !cm.conversationId) {
      await qi.addColumn('chat_messages', 'conversationId', {
        type: DataTypes.UUID,
        allowNull: true
      });
      logger.info('✅ Coluna chat_messages.conversationId adicionada');
    }
  } catch (err) {
    logger.debug('ensureSchema chat_messages:', err.message);
  }

  try {
    const tk = await qi.describeTable('Tickets');
    if (tk && !tk.conversationId) {
      await qi.addColumn('Tickets', 'conversationId', {
        type: DataTypes.UUID,
        allowNull: true
      });
      logger.info('✅ Coluna Tickets.conversationId adicionada');
    }
  } catch (err) {
    logger.debug('ensureSchema Tickets:', err.message);
  }

  try {
    await Conversation.sync({ alter: false });
  } catch (err) {
    logger.debug('ensureSchema conversations:', err.message);
  }

  try {
    const conv = await qi.describeTable('conversations');
    if (conv?.contactId && conv.contactId.allowNull === false) {
      await qi.changeColumn('conversations', 'contactId', {
        type: DataTypes.UUID,
        allowNull: true
      });
      logger.info('✅ conversations.contactId agora aceita NULL');
    }
  } catch (err) {
    logger.debug('ensureSchema conversations.contactId:', err.message);
  }

  schemaReady = true;
}

function buildInboxBaseWhere() {
  return {
    whatsappJid: {
      [Op.and]: [
        { [Op.notLike]: '%status@broadcast%' },
        { [Op.notLike]: '%@broadcast%' },
        { [Op.notLike]: '%@g.us%' }
      ]
    },
    status: 'active'
  };
}

async function getUnreadConversationIds() {
  const rows = await ChatMessage.findAll({
    attributes: ['conversationId'],
    where: {
      direction: 'incoming',
      status: { [Op.ne]: 'read' },
      isDeleted: false,
      conversationId: { [Op.ne]: null }
    },
    group: ['conversationId'],
    raw: true
  });

  return rows.map((row) => row.conversationId).filter(Boolean);
}

async function getInboxStats(where) {
  const [all, unreadIds] = await Promise.all([
    Conversation.count({ where }),
    getUnreadConversationIds()
  ]);

  let unread = 0;
  if (unreadIds.length) {
    unread = await Conversation.count({
      where: {
        ...where,
        id: { [Op.in]: unreadIds }
      }
    });
  }

  const withActiveTicket = await Conversation.count({
    where: {
      ...where,
      activeTicketId: { [Op.ne]: null }
    }
  });

  return { all, unread, open: withActiveTicket };
}

async function enrichConversations(conversations) {
  return Promise.all(conversations.map(async (conversation) => {
    const json = conversation.toJSON();
    const [lastMessage, unreadMessages, contact, activeTicket] = await Promise.all([
      ChatMessage.findOne({
        where: { conversationId: conversation.id, isDeleted: false },
        order: [['timestamp', 'DESC']]
      }),
      ChatMessage.countUnread(conversation.id, { by: 'conversation' }),
      Contact.findByPk(conversation.contactId),
      conversation.activeTicketId
        ? Ticket.findByPk(conversation.activeTicketId)
        : null
    ]);

    let assignedAgent = null;
    if (activeTicket?.assignedTo) {
      const User = require('../models/UserSQL');
      assignedAgent = await User.findByPk(activeTicket.assignedTo, {
        attributes: ['id', 'name', 'email', 'role', 'departmentId']
      });
    }

    const rawPhone = contact?.phone || (json.userPhone || json.whatsappJid || '').split('@')[0];
    const digits = contactDisplayUtils.normalizePhoneDigits(rawPhone);
    const validPhone = contactDisplayUtils.isValidPhoneDigits(digits) ? rawPhone : null;

    const displayName = contactDisplayUtils.resolveContactDisplayName({
      name: contact?.name || json.displayName,
      userName: json.displayName,
      phone: validPhone,
      userPhone: validPhone ? null : json.whatsappJid
    });

    return {
      ...json,
      displayName,
      contact: contact
        ? {
            id: contact.id,
            name: displayName,
            displayName,
            phone: validPhone || contact.phone,
            profilePicUrl: contact.profilePicUrl || null,
            source: contact.source || null
          }
        : { name: displayName, displayName, phone: validPhone },
      activeTicket: activeTicket
        ? {
            ...activeTicket.toJSON(),
            assignedAgent: assignedAgent
              ? { id: assignedAgent.id, name: assignedAgent.name, email: assignedAgent.email }
              : null
          }
        : null,
      ticketStatus: activeTicket?.status || null,
      assignedTo: activeTicket?.assignedTo || null,
      assignedAgent: assignedAgent
        ? { id: assignedAgent.id, name: assignedAgent.name, email: assignedAgent.email }
        : null,
      waitingHuman: Boolean(json.metadata?.waitingHuman || json.metadata?.pendingAcceptance),
      lastMessage: lastMessage
        ? {
            body: chatMediaUtils.sanitizeBodyForDisplay(
              lastMessage.body,
              lastMessage.type,
              lastMessage.hasMedia
            ),
            timestamp: lastMessage.timestamp,
            direction: lastMessage.direction,
            type: lastMessage.type,
            hasMedia: lastMessage.hasMedia,
            mediaUrl: lastMessage.mediaUrl
          }
        : null,
      unreadMessages
    };
  }));
}

async function ensureConversation(contact, identity, source = 'inbound') {
  await ensureSchema();

  const { jid, phone, displayPhone, name } = identity;
  const phoneToStore = displayPhone || phone || jid.split('@')[0];
  const contactId = contact?.id || null;

  let conversation = await Conversation.findOne({
    where: { whatsappJid: jid }
  });

  let created = false;

  if (conversation) {
    const updates = {};
    if (name && (!conversation.displayName || conversation.displayName === 'Contato')) {
      updates.displayName = name;
    }
    if (phoneToStore && conversation.userPhone !== phoneToStore) {
      updates.userPhone = phoneToStore;
    }
    if (contactId && conversation.contactId !== contactId) {
      updates.contactId = contactId;
    }
    if (Object.keys(updates).length) {
      await conversation.update(updates);
    }
    return { conversation, created };
  }

  conversation = await Conversation.create({
    contactId,
    whatsappJid: jid,
    userPhone: phoneToStore,
    displayName: name || 'Contato',
    status: 'active',
    source,
    metadata: {}
  });

  created = true;
  return { conversation, created };
}

async function findOrCreateConversationByIdentity(phone, name, whatsappJid = null) {
  await ensureSchema();

  const employeeContactService = require('./employeeContactService');
  const jid = whatsappJid || employeeContactService.buildWhatsappId(phone) || phone;
  const employee = await employeeContactService.findEmployeeByPhone({ phone, whatsappId: jid });

  if (employee) {
    await employeeContactService.linkEmployeeIdentifiers(employee, { phone, whatsappId: jid });
  }

  const identity = {
    jid,
    phone,
    displayPhone: phone,
    name: employee?.name || name
  };

  const { conversation } = await ensureConversation(employee, identity, 'inbound');
  return { conversation, employee: employee || null };
}

async function findOrCreateConversation(phone, name, contactId, whatsappJid = null) {
  await ensureSchema();

  if (contactId) {
    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      throw new Error(`Contato ${contactId} não encontrado`);
    }

    const identity = {
      jid: whatsappJid || contact.whatsappId || phone,
      phone,
      displayPhone: phone,
      name: contact.name || name
    };

    const { conversation } = await ensureConversation(contact, identity, 'inbound');
    return conversation;
  }

  const { conversation } = await findOrCreateConversationByIdentity(phone, name, whatsappJid);
  return conversation;
}

async function listConversations({
  page = 1,
  limit = 50,
  filter = 'all',
  search = '',
  loggedUser = null
} = {}) {
  await ensureSchema();

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(20, parseInt(limit, 10) || 50));
  const offset = (parsedPage - 1) * parsedLimit;
  const searchText = String(search || '').trim();

  let where = buildInboxBaseWhere();

  if (searchText) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { displayName: { [Op.like]: `%${searchText}%` } },
          { whatsappJid: { [Op.like]: `%${searchText}%` } },
          { userPhone: { [Op.like]: `%${searchText}%` } }
        ]
      }
    ];
  }

  if (filter === 'unread') {
    const unreadIds = await getUnreadConversationIds();
    where.id = {
      [Op.in]: unreadIds.length
        ? unreadIds
        : ['00000000-0000-0000-0000-000000000000']
    };
  } else if (filter === 'open') {
    where.activeTicketId = { [Op.ne]: null };
  } else if (filter === 'pending' && loggedUser?.id && loggedUser.role !== 'admin') {
    const pendingItems = await listPendingForAgent(loggedUser.id);
    const pendingConversationIds = pendingItems
      .map((item) => item.conversationId)
      .filter(Boolean);

    where.id = {
      [Op.in]: pendingConversationIds.length
        ? pendingConversationIds
        : ['00000000-0000-0000-0000-000000000000']
    };
  }

  const statsWhere = buildInboxBaseWhere();

  const [{ count, rows }, statsBase] = await Promise.all([
    Conversation.findAndCountAll({
      where,
      order: [['lastMessageAt', 'DESC'], ['updatedAt', 'DESC']],
      limit: parsedLimit,
      offset
    }),
    getInboxStats(statsWhere)
  ]);

  const stats = { ...statsBase };
  if (loggedUser?.id && loggedUser.role !== 'admin') {
    const pendingItems = await listPendingForAgent(loggedUser.id);
    stats.pending = pendingItems.length;
  } else {
    stats.pending = 0;
  }

  const enriched = await enrichConversations(rows);
  enriched.sort((a, b) => {
    const tsA = new Date(a.lastMessage?.timestamp || a.lastMessageAt || a.updatedAt || 0).getTime();
    const tsB = new Date(b.lastMessage?.timestamp || b.lastMessageAt || b.updatedAt || 0).getTime();
    return tsB - tsA;
  });

  const pages = Math.max(1, Math.ceil(count / parsedLimit));

  return {
    data: enriched,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: count,
      pages,
      hasMore: parsedPage < pages
    },
    stats
  };
}

async function getConversationById(id, { refreshProfilePic = true } = {}) {
  await ensureSchema();
  const conversation = await Conversation.findByPk(id);
  if (!conversation) return null;

  if (refreshProfilePic && conversation.contactId) {
    try {
      const contact = await Contact.findByPk(conversation.contactId);
      if (contact && whatsappProfilePicService.isProfilePicStale(contact)) {
        await whatsappProfilePicService.refreshContactProfilePic(
          contact.id,
          conversation.whatsappJid
        );
      }
    } catch (err) {
      logger.debug(`Falha ao atualizar foto de perfil da conversa ${id}: ${err.message}`);
    }
  }

  const [enriched] = await enrichConversations([conversation]);
  return enriched;
}

async function saveConversationContact(conversationId, loggedUser) {
  await ensureSchema();

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  const contact = conversation.contactId
    ? await Contact.findByPk(conversation.contactId)
    : null;

  if (!contact) {
    throw new Error('Esta conversa ainda não possui funcionário cadastrado. Cadastre o colaborador em Contatos com o telefone do WhatsApp.');
  }

  if (contact.source === 'Manual' || contact.source === 'Importação') {
    return { conversation, contact, alreadySaved: true };
  }

  await contact.update({
    source: 'Manual',
    updatedBy: loggedUser?.id || null,
    metadata: {
      ...(contact.metadata || {}),
      savedFromConversation: conversationId,
      savedAt: new Date().toISOString(),
      savedBy: loggedUser?.id || null
    }
  });

  const [enriched] = await enrichConversations([conversation]);
  return { conversation: enriched, contact, alreadySaved: false };
}

async function touchConversation(conversationId, timestamp = new Date()) {
  await Conversation.update(
    { lastMessageAt: timestamp },
    { where: { id: conversationId } }
  );
}

async function acceptConversation(conversationId, loggedUser) {
  await ensureSchema();

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  if (conversation.activeTicketId) {
    const existing = await Ticket.findByPk(conversation.activeTicketId);
    if (existing && ['waiting_human', 'in_progress', 'open'].includes(existing.status)) {
      const isAgent = loggedUser.role === 'agent';
      const isAdmin = loggedUser.role === 'admin';

      if (existing.assignedTo && Number(existing.assignedTo) !== Number(loggedUser.id)) {
        if (isAgent || isAdmin) {
          throw new Error('Este atendimento está atribuído a outro atendente');
        }
        existing.assignedTo = loggedUser.id;
        existing.assignedAt = new Date();
      }

      if (existing.status === 'waiting_human') {
        if (!existing.assignedTo) {
          existing.assignedTo = loggedUser.id;
          existing.assignedAt = new Date();
        }
        existing.status = 'in_progress';
        await existing.save();
      } else if (
        existing.status === 'in_progress'
        && existing.assignedTo
        && Number(existing.assignedTo) !== Number(loggedUser.id)
        && isAgent
      ) {
        throw new Error('Este atendimento pertence a outro agente');
      }

      const metadata = {
        ...(conversation.metadata || {}),
        waitingHuman: false,
        pendingAcceptance: false
      };
      await conversation.update({ metadata });

      const enriched = await getConversationById(conversation.id);
      return { conversation: enriched || conversation, ticket: existing, created: false };
    }
  }

  const contact = conversation.contactId
    ? await Contact.findByPk(conversation.contactId)
    : null;
  const protocol = await Ticket.generateProtocol();

  const ticket = await Ticket.create({
    protocol,
    userId: conversation.contactId || conversation.id,
    userName: conversation.displayName || contact?.name || 'Contato',
    userPhone: conversation.whatsappJid,
    conversationId: conversation.id,
    department: 'Atendimento',
    status: 'in_progress',
    priority: 'medium',
    subject: 'Atendimento via WhatsApp',
    description: 'Atendimento humano iniciado pelo painel',
    assignedTo: loggedUser.id,
    assignedAt: new Date(),
    messages: [],
    attachments: []
  });

  const metadata = { ...(conversation.metadata || {}), waitingHuman: false, pendingAcceptance: false };
  await conversation.update({
    activeTicketId: ticket.id,
    metadata
  });

  logger.info(`✅ Ticket ${ticket.protocol} criado ao aceitar conversa ${conversation.id}`);

  return { conversation, ticket, created: true };
}

async function finishConversation(conversationId, loggedUser, { feedback, initiatedBy = 'agent' } = {}) {
  await ensureSchema();

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation || !conversation.activeTicketId) {
    throw new Error('Nenhum atendimento ativo nesta conversa');
  }

  const ticket = await Ticket.findByPk(conversation.activeTicketId);
  if (!ticket) {
    throw new Error('Ticket não encontrado');
  }

  if (
    initiatedBy !== 'customer'
    && ticket.assignedTo
    && ticket.assignedTo !== loggedUser?.id
    && loggedUser?.role === 'agent'
  ) {
    throw new Error('Este atendimento pertence a outro agente');
  }

  ticket.status = 'resolved';
  ticket.resolvedAt = new Date();
  if (feedback) ticket.feedback = feedback;
  await ticket.save();

  const metadata = {
    ...(conversation.metadata || {}),
    waitingHuman: false,
    pendingAcceptance: false
  };

  let postAttendance = { sent: false };
  try {
    const postAttendanceService = require('./postAttendanceService');
    postAttendance = await postAttendanceService.startPostAttendanceFlow({
      conversation,
      ticket,
      initiatedBy
    });
  } catch (error) {
    logger.error('Erro ao iniciar fluxo de avaliação pós-atendimento:', error.message);
    await conversation.update({ activeTicketId: null, metadata });
  }

  const refreshed = await getConversationById(conversation.id);
  return {
    conversation: refreshed || conversation,
    ticket,
    postAttendance
  };
}

async function listPendingForAgent(userId) {
  await ensureSchema();

  const parsedUserId = parseInt(userId, 10);
  if (!parsedUserId) return [];

  const ticketMap = new Map();

  const assignedTickets = await Ticket.findAll({
    where: {
      status: 'waiting_human',
      assignedTo: parsedUserId
    },
    order: [['assignedAt', 'ASC'], ['createdAt', 'ASC']]
  });

  for (const ticket of assignedTickets) {
    ticketMap.set(ticket.id, ticket);
  }

  const conversations = await Conversation.findAll({
    where: {
      ...buildInboxBaseWhere(),
      activeTicketId: { [Op.ne]: null }
    }
  });

  const extraTicketIds = [];
  for (const conversation of conversations) {
    const metadata = conversation.metadata || {};
    const suggestedAgentId = Number(metadata.suggestedAgentId);
    const isPending = metadata.pendingAcceptance || metadata.waitingHuman;

    if (
      isPending
      && suggestedAgentId === parsedUserId
      && conversation.activeTicketId
      && !ticketMap.has(conversation.activeTicketId)
    ) {
      extraTicketIds.push(conversation.activeTicketId);
    }
  }

  if (extraTicketIds.length) {
    const extraTickets = await Ticket.findAll({
      where: {
        id: { [Op.in]: extraTicketIds },
        status: 'waiting_human'
      }
    });

    for (const ticket of extraTickets) {
      if (!ticket.assignedTo) {
        ticket.assignedTo = parsedUserId;
        await ticket.save();
      }
      ticketMap.set(ticket.id, ticket);
    }
  }

  const tickets = Array.from(ticketMap.values()).sort((a, b) => {
    const dateA = new Date(a.assignedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.assignedAt || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  if (!tickets.length) {
    return [];
  }

  const conversationIds = tickets
    .map((ticket) => ticket.conversationId)
    .filter(Boolean);

  const matchedConversations = conversationIds.length
    ? await Conversation.findAll({
        where: {
          id: { [Op.in]: conversationIds },
          ...buildInboxBaseWhere()
        }
      })
    : [];

  const conversationById = new Map(matchedConversations.map((item) => [item.id, item]));
  const enriched = await enrichConversations(matchedConversations);

  return tickets.map((ticket) => {
    const conversation = conversationById.get(ticket.conversationId);
    const enrichedConversation = enriched.find((item) => item.id === ticket.conversationId) || null;

    return {
      ticketId: ticket.id,
      protocol: ticket.protocol,
      subject: ticket.subject,
      department: ticket.department,
      assignedAt: ticket.assignedAt,
      conversationId: ticket.conversationId,
      conversation: enrichedConversation || conversation,
      waitingHumanReason: enrichedConversation?.metadata?.waitingHumanReason
        || conversation?.metadata?.waitingHumanReason
        || ticket.subject
    };
  });
}

async function markWaitingHuman(conversation, reason = 'Solicitação de atendimento') {
  const metadata = {
    ...(conversation.metadata || {}),
    waitingHuman: true,
    waitingHumanReason: reason,
    waitingHumanAt: new Date().toISOString()
  };
  await conversation.update({ metadata });
  return conversation;
}

module.exports = {
  ensureSchema,
  ensureConversation,
  findOrCreateConversation,
  findOrCreateConversationByIdentity,
  listConversations,
  getConversationById,
  enrichConversations,
  touchConversation,
  acceptConversation,
  finishConversation,
  saveConversationContact,
  markWaitingHuman,
  listPendingForAgent,
  getUnreadConversationIds
};
