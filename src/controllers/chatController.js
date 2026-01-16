const ChatMessage = require('../models/ChatMessageSQL');
const Attachment = require('../models/AttachmentSQL');
const Ticket = require('../models/TicketSQL');
const Contact = require('../models/ContactSQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Controller de Chat em Tempo Real
 * Gerencia mensagens, anexos e histórico de conversas
 */

/**
 * Lista mensagens de um ticket
 * GET /api/chat/tickets/:ticketId/messages
 */
async function getTicketMessages(req, res) {
  try {
    const { ticketId } = req.params;
    const { limit = 50, offset = 0, before, after } = req.query;
    
    logger.info(`🔍 [GET_MESSAGES] ticketId: ${ticketId}, limit: ${limit}, offset: ${offset}`);
    
    const where = {
      ticketId: parseInt(ticketId) // Garantir que é número
      // Removido isDeleted temporariamente para debug
    };
    
    logger.info(`🔍 [GET_MESSAGES] WHERE:`, JSON.stringify(where));
    
    // Filtro por data
    if (before) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.lt]: new Date(before) };
    }
    if (after) {
      where.timestamp = { [ChatMessage.sequelize.Sequelize.Op.gt]: new Date(after) };
    }
    
    const messages = await ChatMessage.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Attachment,
          as: 'attachments',
          where: { status: 'ready' },
          required: false
        }
      ]
    });
    
    logger.info(`🔍 [GET_MESSAGES] Encontradas ${messages.length} mensagens`);
    
    // Contar não lidas
    const unreadCount = await ChatMessage.countUnread(ticketId);
    
    return sendSuccess(res, {
      messages: messages.reverse(), // Reverter para ordem cronológica
      total: messages.length,
      unreadCount,
      hasMore: messages.length === parseInt(limit)
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
      ticketId,
      contactId,
      to,
      body,
      type = 'text',
      quotedMessageId
    } = req.body;
    
    if (!to || (!body && type === 'text')) {
      return badRequest(res, 'Destinatário e mensagem são obrigatórios');
    }
    
    // Buscar ticket
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return notFound(res, 'Ticket não encontrado');
    }
    
    // Gerar ID único
    const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Criar mensagem
    const message = await ChatMessage.create({
      messageId,
      ticketId,
      contactId: contactId || ticket.contactId,
      userId: req.user?.id,
      direction: 'outgoing',
      from: ticket.whatsappId || 'system',
      to,
      fromName: req.user?.name || 'Sistema',
      body,
      type,
      status: 'pending',
      fromMe: true,
      timestamp: new Date(),
      quotedMessageId
    });
    
    // 📱 ENVIAR MENSAGEM VIA WHATSAPP
    try {
      logger.info('🔍 [CHAT] Iniciando envio via WhatsApp...');
      logger.info(`🔍 [CHAT] Para: ${to}`);
      logger.info(`🔍 [CHAT] Mensagem: ${body.substring(0, 50)}...`);
      
      const whatsappClient = require('../bot/whatsapp');
      logger.info(`🔍 [CHAT] Cliente WhatsApp (WPPConnect) carregado. isReady: ${whatsappClient.isReady}`);
      
      // Se já tem @, usar como está. Caso contrário, adicionar @c.us (WPPConnect)
      const formattedNumber = to.includes('@') ? to : `${to}@c.us`;
      logger.info(`🔍 [CHAT] Número original: ${to}`);
      logger.info(`🔍 [CHAT] Número formatado: ${formattedNumber}`);
      
      // Adicionar timeout de 10 segundos
      const sendPromise = whatsappClient.sendMessage(formattedNumber, body);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao enviar mensagem')), 10000)
      );
      
      logger.info('🔍 [CHAT] Aguardando envio...');
      await Promise.race([sendPromise, timeoutPromise]);
      
      // Atualizar status como enviado
      await message.updateStatus('sent', 1);
      
      logger.info(`✅ [CHAT] Mensagem enviada via WhatsApp para ${to}`);
    } catch (whatsappError) {
      logger.error(`❌ [CHAT] Erro ao enviar via WhatsApp: ${whatsappError.message}`);
      logger.error(`❌ [CHAT] Stack completo: ${whatsappError.stack}`);
      logger.error(`❌ [CHAT] isReady no momento do erro: ${require('../bot/whatsapp').isReady}`);
      // Mesmo que falhe, continuar (mensagem já está salva no banco)
      // Marcar como 'pending' para reprocessamento posterior
    }
    
    // Emitir via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`ticket_${ticketId}`).emit('new_message', message);
    }
    
    return created(res, {
      message,
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
    const { messageIds, ticketId } = req.body;
    
    if (!messageIds && !ticketId) {
      return badRequest(res, 'IDs de mensagens ou ticket são obrigatórios');
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
    if (io && ticketId) {
      io.to(`ticket_${ticketId}`).emit('messages_read', { updated });
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
    
    return created(res, {
      attachment,
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

