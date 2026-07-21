const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const {
  ChatMessage,
  Attachment,
  Conversation,
  Ticket,
  Contact,
  Rating,
  TicketTag,
  Schedule
} = require('../models');

function emitSocket(event, data) {
  try {
    const io = global.io || require('../server').io;
    if (io) io.emit(event, data);
  } catch (err) {
    logger.debug(`Socket não disponível para ${event}:`, err.message);
  }
}

async function safeDestroy(model, options, label) {
  if (!model || typeof model.destroy !== 'function') {
    logger.debug(`Purge: ignorando ${label} (modelo indisponível)`);
    return 0;
  }

  try {
    return await model.destroy(options);
  } catch (error) {
    logger.warn(`Purge: falha ao apagar ${label}: ${error.message}`);
    return 0;
  }
}

class ChatDataPurgeService {
  /**
   * Remove todas as conversas e mensagens do painel de chat.
   * Não remove contatos manuais (apenas source=whatsapp_sync).
   */
  async purgeAll() {
    const transaction = await sequelize.transaction();

    try {
      const stats = {
        messagesDeleted: 0,
        attachmentsDeleted: 0,
        ratingsDeleted: 0,
        ticketTagsDeleted: 0,
        schedulesDeleted: 0,
        automationExecutionsDeleted: 0,
        conversationsDeleted: 0,
        ticketsDeleted: 0,
        contactsDeleted: 0
      };

      stats.messagesDeleted = await ChatMessage.destroy({ where: {}, transaction });
      stats.attachmentsDeleted = await Attachment.destroy({ where: {}, transaction });
      stats.ratingsDeleted = await Rating.destroy({ where: {}, transaction });
      stats.ticketTagsDeleted = await TicketTag.destroy({ where: {}, transaction });
      stats.schedulesDeleted = await Schedule.destroy({
        where: { ticketId: { [Op.ne]: null } },
        transaction
      });

      stats.ticketsDeleted = await Ticket.destroy({ where: {}, transaction });
      stats.conversationsDeleted = await Conversation.destroy({ where: {}, transaction });
      stats.contactsDeleted = await Contact.destroy({
        where: { source: 'whatsapp_sync' },
        transaction
      });

      await transaction.commit();

      logger.warn(
        `🗑️ Conversas apagadas: ${stats.conversationsDeleted} conversas, ${stats.ticketsDeleted} tickets, ${stats.messagesDeleted} mensagens`
      );

      emitSocket('conversations_purged', stats);
      return stats;
    } catch (error) {
      await transaction.rollback();
      logger.error('❌ Erro ao apagar conversas:', error);
      throw error;
    }
  }
}

module.exports = new ChatDataPurgeService();
