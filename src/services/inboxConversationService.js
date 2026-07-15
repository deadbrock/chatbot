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
  if (schemaReady) return;
  const qi = sequelize.getQueryInterface();

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
      activeTicket: activeTicket ? activeTicket.toJSON() : null,
      ticketStatus: activeTicket?.status || null,
      assignedTo: activeTicket?.assignedTo || null,
      waitingHuman: Boolean(json.metadata?.waitingHuman),
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
    if (conversation.contactId !== contact.id) updates.contactId = contact.id;
    if (Object.keys(updates).length) {
      await conversation.update(updates);
    }
    return { conversation, created };
  }

  conversation = await Conversation.create({
    contactId: contact.id,
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

async function findOrCreateConversation(phone, name, contactId, whatsappJid = null) {
  await ensureSchema();

  const jid = whatsappJid || phone;
  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new Error(`Contato ${contactId} não encontrado`);
  }

  const identity = {
    jid,
    phone,
    displayPhone: phone,
    name
  };

  const { conversation } = await ensureConversation(contact, identity, 'inbound');
  return conversation;
}

async function listConversations({
  page = 1,
  limit = 50,
  filter = 'all',
  search = ''
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
  }

  const statsWhere = buildInboxBaseWhere();

  const [{ count, rows }, stats] = await Promise.all([
    Conversation.findAndCountAll({
      where,
      order: [['lastMessageAt', 'DESC'], ['updatedAt', 'DESC']],
      limit: parsedLimit,
      offset
    }),
    getInboxStats(statsWhere)
  ]);

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

  const contact = await Contact.findByPk(conversation.contactId);
  if (!contact) {
    throw new Error('Contato não encontrado');
  }

  if (contact.source === 'Manual') {
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
      if (existing.status !== 'in_progress' || !existing.assignedTo) {
        existing.assignedTo = loggedUser.id;
        existing.assignedAt = new Date();
        existing.status = 'in_progress';
        await existing.save();
      }
      return { conversation, ticket: existing, created: false };
    }
  }

  const contact = await Contact.findByPk(conversation.contactId);
  const protocol = await Ticket.generateProtocol();

  const ticket = await Ticket.create({
    protocol,
    userId: conversation.contactId,
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

  const metadata = { ...(conversation.metadata || {}), waitingHuman: false };
  await conversation.update({
    activeTicketId: ticket.id,
    metadata
  });

  logger.info(`✅ Ticket ${ticket.protocol} criado ao aceitar conversa ${conversation.id}`);

  return { conversation, ticket, created: true };
}

async function finishConversation(conversationId, loggedUser, { feedback } = {}) {
  await ensureSchema();

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation || !conversation.activeTicketId) {
    throw new Error('Nenhum atendimento ativo nesta conversa');
  }

  const ticket = await Ticket.findByPk(conversation.activeTicketId);
  if (!ticket) {
    throw new Error('Ticket não encontrado');
  }

  if (ticket.assignedTo && ticket.assignedTo !== loggedUser.id && loggedUser.role === 'agent') {
    throw new Error('Este atendimento pertence a outro agente');
  }

  ticket.status = 'resolved';
  ticket.resolvedAt = new Date();
  if (feedback) ticket.feedback = feedback;
  await ticket.save();

  await conversation.update({ activeTicketId: null });

  return { conversation, ticket };
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
  listConversations,
  getConversationById,
  enrichConversations,
  touchConversation,
  acceptConversation,
  finishConversation,
  saveConversationContact,
  markWaitingHuman,
  getUnreadConversationIds
};
