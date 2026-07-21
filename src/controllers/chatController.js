const ChatMessage = require('../models/ChatMessageSQL');
const Attachment = require('../models/AttachmentSQL');
const Ticket = require('../models/TicketSQL');
const Conversation = require('../models/ConversationSQL');
const Contact = require('../models/ContactSQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');
const chatMediaUtils = require('../utils/chatMediaUtils');
const chatMediaService = require('../services/chatMediaService');
const User = require('../models/UserSQL');
const {
  formatAgentWhatsAppMessage,
  resolveMessageContactId
} = require('../utils/chatMessageUtils');

/**
 * Controller de Chat em Tempo Real
 * Gerencia mensagens, anexos e histórico de conversas
 */

/**
 * Lista mensagens de uma conversa (inbox WhatsApp)
 * GET /api/chat/conversations/:conversationId/messages
 */
async function getConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { limit = 200, offset = 0, before, after } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 5000);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return notFound(res, 'Conversa não encontrada');
    }

    const where = {
      conversationId,
      isDeleted: false
    };

    if (before) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.lt]: new Date(before) };
    } else if (after) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.gt]: new Date(after) };
    }

    const total = await ChatMessage.count({
      where: { conversationId, isDeleted: false }
    });

    const messages = await ChatMessage.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parsedLimit,
      offset: before || after ? 0 : parsedOffset,
      include: [
        {
          model: Attachment,
          as: 'attachments',
          where: { status: 'ready' },
          required: false
        }
      ]
    });

    const unreadCount = await ChatMessage.countUnread(conversationId, { by: 'conversation' });
    const ordered = messages.reverse();

    return sendSuccess(res, {
      messages: ordered,
      total,
      unreadCount,
      conversationId,
      activeTicketId: conversation.activeTicketId,
      hasMore: before
        ? messages.length === parsedLimit
        : (parsedOffset + messages.length) < total
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens da conversa:', error);
    return sendError(res, 'Erro ao buscar mensagens');
  }
}

/**
 * Lista mensagens de um ticket
 * GET /api/chat/tickets/:ticketId/messages
 */
async function getTicketMessages(req, res) {
  try {
    const { ticketId } = req.params;
    const { limit = 200, offset = 0, before, after } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 5000);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const where = {
      ticketId,
      isDeleted: false
    };

    if (before) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.lt]: new Date(before) };
    } else if (after) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.gt]: new Date(after) };
    }

    const total = await ChatMessage.count({
      where: { ticketId, isDeleted: false }
    });

    const messages = await ChatMessage.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parsedLimit,
      offset: before || after ? 0 : parsedOffset,
      include: [
        {
          model: Attachment,
          as: 'attachments',
          where: { status: 'ready' },
          required: false
        }
      ]
    });

    const unreadCount = await ChatMessage.countUnread(ticketId, { by: 'ticket' });
    const ordered = messages.reverse();

    return sendSuccess(res, {
      messages: ordered,
      total,
      unreadCount,
      hasMore: before
        ? messages.length === parsedLimit
        : (parsedOffset + messages.length) < total
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return sendError(res, 'Erro ao buscar mensagens');
  }
}

/**
 * Envia uma nova mensagem
 * POST /api/chat/messages
 */
async function sendMessage(req, res) {
  try {
    const {
      conversationId,
      ticketId,
      contactId,
      to,
      body,
      type = 'text',
      mediaUrl,
      fileName,
      fileSize,
      quotedMessageId
    } = req.body;

    const hasMedia = Boolean(mediaUrl);
    const isText = type === 'text' && !hasMedia;

    if (!to || (isText && !body)) {
      return badRequest(res, 'Destinatário e mensagem são obrigatórios');
    }

    if (!conversationId && !ticketId) {
      return badRequest(res, 'conversationId ou ticketId é obrigatório');
    }

    let conversation = null;
    let ticket = null;

    if (conversationId) {
      conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        return notFound(res, 'Conversa não encontrada');
      }
      if (conversation.activeTicketId) {
        ticket = await Ticket.findByPk(conversation.activeTicketId);
      }
    }

    if (!conversation && ticketId) {
      ticket = await Ticket.findByPk(ticketId);
      if (!ticket) {
        return notFound(res, 'Ticket não encontrado');
      }
      if (ticket.conversationId) {
        conversation = await Conversation.findByPk(ticket.conversationId);
      }
    }

    const effectiveConversationId = conversation?.id || conversationId || null;
    const effectiveTicketId = ticket?.id || (ticketId ? Number(ticketId) : null) || null;

    const agent = req.user?.id ? await User.findByPk(req.user.id, { attributes: ['id', 'name'] }) : null;
    const agentName = agent?.name || req.user?.name || 'Atendente';
    const resolvedContactId = resolveMessageContactId({ contactId, conversation });

    const inboxConversationService = require('../services/inboxConversationService');
    await inboxConversationService.ensureSchema();

    const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const displayBody = hasMedia
      ? (body?.trim() || chatMediaUtils.getMediaPreviewLabel(type, true))
      : body;
    const whatsappBody = formatAgentWhatsAppMessage(agentName, displayBody);

    const message = await ChatMessage.create({
      messageId,
      conversationId: effectiveConversationId,
      ticketId: effectiveTicketId,
      contactId: resolvedContactId,
      userId: agent?.id || req.user?.id || null,
      direction: 'outgoing',
      from: 'agent',
      to,
      fromName: agentName,
      body: displayBody,
      type: hasMedia ? type : 'text',
      status: 'pending',
      fromMe: true,
      hasMedia,
      mediaUrl: mediaUrl || null,
      mediaFilename: fileName || null,
      mediaSize: fileSize || null,
      timestamp: new Date(),
      quotedMessageId,
      metadata: {
        agentName,
        whatsappBody: whatsappBody !== displayBody ? whatsappBody : undefined
      }
    });

    const whatsappClient = require('../bot/whatsapp');

    if (!(await whatsappClient.ensureReadyForSend())) {
      await message.updateStatus('failed');
      return sendError(res, 'WhatsApp não está conectado. Vá em Administração → Conexões e reconecte.', 503);
    }

    const rawTarget = conversation?.whatsappJid || to;
    const formattedNumber = String(rawTarget).includes('@')
      ? String(rawTarget).trim()
      : whatsappClient.normalizeChatId(to);
    logger.info(`🔍 [CHAT] Enviando para: ${formattedNumber}`);

    try {
      if (hasMedia) {
        const filePath = chatMediaService.resolveLocalPathFromPublicUrl(mediaUrl);
        if (!filePath) {
          throw new Error('Arquivo de mídia não encontrado');
        }

        if (type === 'image') {
          await whatsappClient.client.sendImage(
            formattedNumber,
            filePath,
            fileName || 'imagem.jpg',
            formatAgentWhatsAppMessage(agentName, body || '')
          );
        } else if (type === 'ptt' || type === 'voice') {
          await whatsappClient.sendVoiceMessage(
            formattedNumber,
            filePath,
            fileName || 'audio.ogg'
          );
        } else {
          await whatsappClient.client.sendFile(formattedNumber, filePath, {
            caption: formatAgentWhatsAppMessage(agentName, body || ''),
            filename: fileName || path.basename(filePath)
          });
        }
      } else {
        await whatsappClient.sendMessage(formattedNumber, whatsappBody);
      }

      await message.updateStatus('sent', 1);
      logger.info(`✅ [CHAT] Mensagem enviada via WhatsApp para ${formattedNumber}`);
    } catch (whatsappError) {
      logger.error(`❌ [CHAT] Erro ao enviar via WhatsApp: ${whatsappError.message}`);
      await message.updateStatus('failed');
      return sendError(res, `Não foi possível enviar pelo WhatsApp: ${whatsappError.message}`, 502);
    }

    await message.reload();
    if (effectiveConversationId) {
      const inboxConversationService = require('../services/inboxConversationService');
      await inboxConversationService.touchConversation(effectiveConversationId);
    }
    if (effectiveTicketId) {
      await Ticket.update({ updatedAt: new Date() }, { where: { id: effectiveTicketId } });
    }

    const io = req.app.get('io');
    const payload = {
      conversationId: effectiveConversationId,
      ticketId: effectiveTicketId,
      message: message.toJSON(),
      direction: 'outgoing'
    };

    if (io) {
      if (effectiveTicketId) {
        io.to(`ticket_${effectiveTicketId}`).emit('new_message', payload);
      }
      if (effectiveConversationId) {
        io.to(`conversation_${effectiveConversationId}`).emit('new_message', payload);
      }
      io.emit('new_message', payload);
      if (effectiveTicketId && ticket) {
        io.emit('ticket_updated', {
          ticketId: effectiveTicketId,
          ticket: { ...ticket.toJSON(), updatedAt: new Date() }
        });
      }
      if (effectiveConversationId && conversation) {
        io.emit('conversation_updated', {
          conversationId: effectiveConversationId,
          conversation: { ...conversation.toJSON(), updatedAt: new Date() }
        });
      }
    }

    return created(res, {
      message: message.toJSON(),
      whatsappSent: true,
      success: true
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return sendError(res, 'Erro ao enviar mensagem');
  }
}

/**
 * Marca mensagens como lidas
 * POST /api/chat/messages/read
 */
async function markAsRead(req, res) {
  try {
    const { messageIds, ticketId, conversationId } = req.body;
    
    if (!messageIds && !ticketId && !conversationId) {
      return badRequest(res, 'IDs de mensagens, conversationId ou ticketId são obrigatórios');
    }
    
    let updated = 0;
    
    if (messageIds && Array.isArray(messageIds)) {
      // Marcar mensagens específicas
      for (const msgId of messageIds) {
        const message = await ChatMessage.findOne({
          where: { messageId: msgId }
        });
        if (message) {
          await message.markAsRead();
          updated++;
        }
      }
    } else if (conversationId) {
      const messages = await ChatMessage.findAll({
        where: {
          conversationId,
          direction: 'incoming',
          status: { [ChatMessage.sequelize.Sequelize.Op.ne]: 'read' }
        }
      });

      for (const message of messages) {
        await message.markAsRead();
        updated++;
      }
    } else if (ticketId) {
      // Marcar todas as mensagens do ticket
      const messages = await ChatMessage.findAll({
        where: {
          ticketId,
          direction: 'incoming',
          status: { [ChatMessage.sequelize.Sequelize.Op.ne]: 'read' }
        }
      });
      
      for (const message of messages) {
        await message.markAsRead();
        updated++;
      }
    }
    
    // Emitir via Socket.IO
    const io = req.app.get('io');
    if (io && (ticketId || conversationId)) {
      const payload = { updated };
      if (ticketId) {
        io.to(`ticket_${ticketId}`).emit('messages_read', payload);
      }
      if (conversationId) {
        io.to(`conversation_${conversationId}`).emit('messages_read', payload);
      }
    }
    
    return sendSuccess(res, {
      updated,
      message: `${updated} mensagens marcadas como lidas`
    });
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    return sendError(res, 'Erro ao marcar mensagens como lidas');
  }
}

/**
 * Adiciona reação a uma mensagem
 * POST /api/chat/messages/:messageId/react
 */
async function reactToMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return badRequest(res, 'Emoji é obrigatório');
    }
    
    const message = await ChatMessage.findOne({
      where: { messageId }
    });
    
    if (!message) {
      return notFound(res, 'Mensagem não encontrada');
    }
    
    await message.addReaction(emoji, req.user?.id);
    
    // Emitir via Socket.IO
    const io = req.app.get('io');
    if (io && message.ticketId) {
      io.to(`ticket_${message.ticketId}`).emit('message_reaction', {
        messageId,
        emoji,
        userId: req.user?.id
      });
    }
    
    return sendSuccess(res, {
      message: 'Reação adicionada',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Erro ao reagir à mensagem:', error);
    return sendError(res, 'Erro ao reagir à mensagem');
  }
}

/**
 * Marca/desmarca mensagem como favorita
 * POST /api/chat/messages/:messageId/star
 */
async function toggleStar(req, res) {
  try {
    const { messageId } = req.params;
    
    const message = await ChatMessage.findOne({
      where: { messageId }
    });
    
    if (!message) {
      return notFound(res, 'Mensagem não encontrada');
    }
    
    await message.toggleStar();
    
    return sendSuccess(res, {
      message: message.isStarred ? 'Mensagem favoritada' : 'Mensagem desfavoritada',
      isStarred: message.isStarred
    });
  } catch (error) {
    console.error('Erro ao favoritar mensagem:', error);
    return sendError(res, 'Erro ao favoritar mensagem');
  }
}

/**
 * Deleta uma mensagem
 * DELETE /api/chat/messages/:messageId
 */
async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    
    const message = await ChatMessage.findOne({
      where: { messageId }
    });
    
    if (!message) {
      return notFound(res, 'Mensagem não encontrada');
    }
    
    // Verificar permissão (só pode deletar mensagens próprias ou ser admin)
    if (message.userId !== req.user?.id && req.user?.role !== 'admin') {
      return badRequest(res, 'Você não tem permissão para deletar esta mensagem');
    }
    
    await message.softDelete();
    
    // Emitir via Socket.IO
    const io = req.app.get('io');
    if (io && message.ticketId) {
      io.to(`ticket_${message.ticketId}`).emit('message_deleted', { messageId });
    }
    
    return sendSuccess(res, {
      message: 'Mensagem deletada'
    });
  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    return sendError(res, 'Erro ao deletar mensagem');
  }
}

/**
 * Busca histórico de conversas
 * GET /api/chat/history
 */
async function getHistory(req, res) {
  try {
    const { contactId, startDate, endDate, search, limit = 100 } = req.query;
    
    const where = {
      isDeleted: false
    };
    
    if (contactId) {
      where.contactId = contactId;
    }
    
    if (startDate && endDate) {
      where.timestamp = {
        [ChatMessage.sequelize.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (search) {
      where.body = {
        [ChatMessage.sequelize.Sequelize.Op.like]: `%${search}%`
      };
    }
    
    const messages = await ChatMessage.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });
    
    return sendSuccess(res, {
      messages,
      total: messages.length
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return sendError(res, 'Erro ao buscar histórico');
  }
}

/**
 * Upload de arquivo/mídia
 * POST /api/chat/upload
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return badRequest(res, 'Nenhum arquivo enviado');
    }
    
    const { ticketId, messageId } = req.body;
    const file = req.file;
    
    // Criar registro do anexo
    const attachment = await Attachment.create({
      messageId,
      ticketId,
      filename: file.originalname,
      storedFilename: file.filename,
      filepath: file.path,
      mimetype: file.mimetype,
      mediaType: getMediaType(file.mimetype),
      size: file.size,
      status: 'processing',
      uploadedBy: req.user?.id
    });
    
    // Gerar URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    attachment.url = attachment.generateUrl(baseUrl);
    attachment.downloadUrl = attachment.generateDownloadUrl(baseUrl);
    await attachment.save();
    
    // TODO: Processar arquivo (gerar thumbnail, comprimir, etc)
    await attachment.markAsReady();

    const publicUrl = `/uploads/chat/${file.filename}`;

    return created(res, {
      attachment,
      publicUrl,
      downloadUrl: attachment.downloadUrl,
      message: 'Arquivo enviado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return sendError(res, 'Erro ao fazer upload');
  }
}

/**
 * Download de arquivo
 * GET /api/chat/attachments/:id/download
 */
async function downloadFile(req, res) {
  try {
    const { id } = req.params;
    
    const attachment = await Attachment.findByPk(id);
    
    if (!attachment) {
      return notFound(res, 'Arquivo não encontrado');
    }
    
    if (attachment.status !== 'ready') {
      return badRequest(res, 'Arquivo não está pronto para download');
    }
    
    // Verificar se arquivo existe
    const exists = await attachment.fileExists();
    if (!exists) {
      return notFound(res, 'Arquivo físico não encontrado');
    }
    
    // Registrar download
    await attachment.recordDownload();
    
    // Enviar arquivo
    res.download(attachment.filepath, attachment.filename);
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    return sendError(res, 'Erro ao fazer download');
  }
}

/**
 * Lista anexos de um ticket
 * GET /api/chat/tickets/:ticketId/attachments
 */
async function getTicketAttachments(req, res) {
  try {
    const { ticketId } = req.params;
    const { mediaType, limit, offset } = req.query;
    
    const attachments = await Attachment.findByTicket(ticketId, {
      mediaType,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    
    return sendSuccess(res, {
      attachments,
      total: attachments.length
    });
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    return sendError(res, 'Erro ao buscar anexos');
  }
}

/**
 * Busca estatísticas de armazenamento
 * GET /api/chat/storage/stats
 */
async function getStorageStats(req, res) {
  try {
    const stats = await Attachment.getTotalSize();
    
    // Estatísticas por tipo
    const byType = {};
    const types = ['image', 'video', 'audio', 'voice', 'document'];
    
    for (const type of types) {
      byType[type] = await Attachment.getTotalSize({ mediaType: type });
    }
    
    return sendSuccess(res, {
      total: stats,
      byType
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return sendError(res, 'Erro ao buscar estatísticas');
  }
}

// Helper
function getMediaType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

module.exports = {
  getConversationMessages,
  getTicketMessages,
  sendMessage,
  markAsRead,
  reactToMessage,
  toggleStar,
  deleteMessage,
  getHistory,
  uploadFile,
  downloadFile,
  getTicketAttachments,
  getStorageStats
};

