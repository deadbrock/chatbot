const logger = require('../utils/logger');
const UserSession = require('../models/UserSessionSQL');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const crypto = require('crypto');

const RATING_TIMEOUT_MS = 10 * 60 * 1000;

const CLOSING_MESSAGE = `🙏 *Obrigado pelo contato!*

Foi um prazer atendê-lo(a) na *FG SERVICES*.

Como você avalia nosso atendimento?

Responda com uma nota de *1 a 5*:
⭐ *1* — Muito insatisfeito
⭐ *2* — Insatisfeito
⭐ *3* — Regular
⭐ *4* — Satisfeito
⭐ *5* — Muito satisfeito`;

const FAREWELL_MESSAGE = `✨ *Até breve!*

Conte sempre conosco.

_FG SERVICES — Excelência para quem faz com excelência_ 🌟`;

function getRatingRequestedAt(session, conversation = null) {
  return session?.formData?.ratingRequestedAt
    || conversation?.metadata?.ratingRequestedAt
    || session?.lastInteraction
    || null;
}

function isRatingExpired(session, conversation = null) {
  if (session?.currentFlow !== 'nps_evaluation') {
    return false;
  }

  const requestedAt = getRatingRequestedAt(session, conversation);
  if (!requestedAt) {
    return false;
  }

  const elapsedMs = Date.now() - new Date(requestedAt).getTime();
  return elapsedMs >= RATING_TIMEOUT_MS;
}

async function clearConversationRatingState(conversation) {
  if (!conversation) return;

  await conversation.update({
    metadata: {
      ...(conversation.metadata || {}),
      awaitingRating: false,
      ratingRequestedAt: null
    }
  });
}

async function expireRatingFlow({ session, conversation = null, reason = 'timeout' } = {}) {
  if (!session) {
    return { expired: false };
  }

  if (session.currentFlow !== 'nps_evaluation') {
    return { expired: false };
  }

  session.currentFlow = 'initial';
  session.currentStep = 'ask_subject';
  session.isActive = true;
  session.needsHumanAgent = false;
  session.formData = {
    ...(session.formData || {}),
    pendingRatingTicketId: null,
    pendingRatingConversationId: null,
    ratingRequestedAt: null,
    ratingExpiredAt: new Date().toISOString(),
    ratingExpireReason: reason
  };
  await session.save();

  if (conversation) {
    await clearConversationRatingState(conversation);
  } else if (session.formData?.pendingRatingConversationId) {
    const Conversation = require('../models/ConversationSQL');
    const linkedConversation = await Conversation.findByPk(session.formData.pendingRatingConversationId);
    if (linkedConversation) {
      await clearConversationRatingState(linkedConversation);
    }
  }

  logger.info(`⏰ Fluxo de avaliação encerrado (${reason}) — sessão ${session.phone}`);

  return { expired: true, session };
}

async function ensureActiveRatingFlow(session, conversation = null) {
  if (session?.currentFlow !== 'nps_evaluation') {
    return false;
  }

  if (!isRatingExpired(session, conversation)) {
    return true;
  }

  await expireRatingFlow({ session, conversation, reason: 'timeout' });
  return false;
}

async function expireStaleRatingSessions() {
  const sessions = await UserSession.findAll({
    where: { currentFlow: 'nps_evaluation' }
  });

  if (!sessions.length) {
    return 0;
  }

  const Conversation = require('../models/ConversationSQL');
  let expiredCount = 0;

  for (const session of sessions) {
    const conversationId = session.formData?.pendingRatingConversationId;
    const conversation = conversationId
      ? await Conversation.findByPk(conversationId)
      : null;

    if (!isRatingExpired(session, conversation)) {
      continue;
    }

    await expireRatingFlow({ session, conversation, reason: 'timeout' });
    expiredCount += 1;
  }

  if (expiredCount > 0) {
    logger.info(`⏰ ${expiredCount} fluxo(s) de avaliação expirado(s) por timeout de 10 minutos`);
  }

  return expiredCount;
}

async function sendWhatsAppMessage(jid, body) {
  try {
    const whatsappClient = require('../bot/whatsapp');
    if (!(await whatsappClient.ensureReadyForSend())) {
      logger.warn('WhatsApp indisponível para enviar mensagem pós-atendimento');
      return false;
    }

    const target = whatsappClient.normalizeChatId
      ? whatsappClient.normalizeChatId(jid)
      : jid;

    await whatsappClient.sendMessage(target, body);
    return true;
  } catch (error) {
    logger.error('Erro ao enviar mensagem pós-atendimento:', error.message);
    return false;
  }
}

async function resolveSessionForConversation(conversation, ticket) {
  const phoneCandidates = [
    conversation.userPhone,
    conversation.whatsappJid?.split('@')[0],
    ticket?.userPhone
  ].filter(Boolean);

  let session = null;
  for (const phone of phoneCandidates) {
    session = await UserSession.findOne({ where: { phone } });
    if (session) break;
  }

  if (!session && phoneCandidates[0]) {
    session = await UserSession.create({
      phone: phoneCandidates[0],
      name: conversation.displayName || ticket?.userName || null
    });
  }

  return session;
}

async function saveBotOutgoingMessage({ conversationId, ticketId, contactId, phone, body }) {
  const messageTimestamp = new Date();
  await ChatMessage.create({
    messageId: `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    conversationId,
    ticketId,
    contactId,
    direction: 'outgoing',
    from: 'bot',
    to: phone,
    fromName: 'Bot',
    body,
    type: 'text',
    status: 'sent',
    fromMe: true,
    timestamp: messageTimestamp,
    createdAt: messageTimestamp,
    updatedAt: messageTimestamp
  });
}

async function startPostAttendanceFlow({ conversation, ticket, initiatedBy = 'agent' }) {
  if (!conversation || !ticket) {
    return { sent: false, reason: 'missing_data' };
  }

  const jid = conversation.whatsappJid;
  if (!jid) {
    return { sent: false, reason: 'missing_jid' };
  }

  const session = await resolveSessionForConversation(conversation, ticket);
  if (!session) {
    return { sent: false, reason: 'missing_session' };
  }

  session.currentFlow = 'nps_evaluation';
  session.currentStep = 'ask_rating';
  session.isActive = true;
  session.needsHumanAgent = false;
  session.agentId = null;
  const ratingRequestedAt = new Date().toISOString();
  session.formData = {
    ...(session.formData || {}),
    pendingRatingTicketId: ticket.id,
    pendingRatingConversationId: conversation.id,
    ratingInitiatedBy: initiatedBy,
    ratingAssignedTo: ticket.assignedTo || null,
    ratingDepartment: ticket.department || null,
    ratingRequestedAt
  };
  await session.save();

  await conversation.update({
    activeTicketId: null,
    metadata: {
      ...(conversation.metadata || {}),
      awaitingRating: true,
      ratingRequestedAt,
      waitingHuman: false,
      pendingAcceptance: false,
      lastFinishedTicketId: ticket.id,
      lastFinishedAt: ratingRequestedAt
    }
  });

  const sent = await sendWhatsAppMessage(jid, CLOSING_MESSAGE);

  if (sent) {
    try {
      await saveBotOutgoingMessage({
        conversationId: conversation.id,
        ticketId: ticket.id,
        contactId: conversation.contactId || null,
        phone: conversation.userPhone || jid.split('@')[0],
        body: CLOSING_MESSAGE
      });
    } catch (error) {
      logger.debug('Falha ao salvar mensagem de encerramento:', error.message);
    }
  }

  return { sent, session };
}

async function submitRating({ session, score, ticketId }) {
  const parsedScore = parseInt(score, 10);
  if (!Number.isFinite(parsedScore) || parsedScore < 1 || parsedScore > 5) {
    throw new Error('Nota inválida. Use um valor de 1 a 5.');
  }

  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    throw new Error('Ticket não encontrado para avaliação');
  }

  if (ticket.rating) {
    return {
      ticket,
      score: ticket.rating,
      alreadyRated: true
    };
  }

  ticket.rating = parsedScore;
  ticket.ratedAt = new Date();
  await ticket.save();

  const linkedConversationId = session?.formData?.pendingRatingConversationId;

  if (session) {
    session.npsScore = parsedScore;
    session.currentFlow = 'initial';
    session.currentStep = 'ask_subject';
    session.isActive = true;
    session.needsHumanAgent = false;
    session.formData = {
      ...(session.formData || {}),
      pendingRatingTicketId: null,
      pendingRatingConversationId: null,
      ratingRequestedAt: null
    };
    await session.save();
  }

  if (linkedConversationId) {
    const Conversation = require('../models/ConversationSQL');
    const linkedConversation = await Conversation.findByPk(linkedConversationId);
    if (linkedConversation) {
      await clearConversationRatingState(linkedConversation);
    }
  }

  logger.info(`⭐ Avaliação registrada: ticket ${ticket.protocol} — nota ${parsedScore}/5`);

  return {
    ticket,
    score: parsedScore,
    alreadyRated: false
  };
}

module.exports = {
  RATING_TIMEOUT_MS,
  CLOSING_MESSAGE,
  FAREWELL_MESSAGE,
  sendWhatsAppMessage,
  startPostAttendanceFlow,
  submitRating,
  isRatingExpired,
  ensureActiveRatingFlow,
  expireRatingFlow,
  expireStaleRatingSessions
};
