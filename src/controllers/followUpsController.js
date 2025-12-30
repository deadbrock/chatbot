const FollowUp = require('../models/FollowUpSQL');
const Contact = require('../models/ContactSQL');
const { sendSuccess, sendError, badRequest, notFound } = require('../utils/http');
const { Op } = require('sequelize');

/**
 * Controller de Follow-ups Automáticos
 */

// Listar todos os follow-ups
exports.listFollowUps = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: followUps } = await FollowUp.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });
    
    sendSuccess(res, {
      followUps,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar follow-ups:', error);
    sendError(res, error);
  }
};

// Buscar follow-up por ID
exports.getFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    sendSuccess(res, followUp);
  } catch (error) {
    console.error('Erro ao buscar follow-up:', error);
    sendError(res, error);
  }
};

// Criar novo follow-up
exports.createFollowUp = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      trigger,
      message,
      messageTemplateId,
      mediaUrl,
      mediaType,
      delay,
      delayUnit,
      sendOnlyDuringBusinessHours,
      businessHours,
      sequence,
      targetFilters,
      excludeFilters,
      maxAttempts,
      stopOnReply,
      stopOnConversion,
      priority,
      actionsAfterSend,
      notifyTeam,
      notifyEmails
    } = req.body;
    
    if (!name || !type || !trigger || !message || !delay) {
      return badRequest(res, 'Nome, tipo, gatilho, mensagem e delay são obrigatórios');
    }
    
    const followUp = await FollowUp.create({
      name,
      description,
      type,
      trigger,
      message,
      messageTemplateId,
      mediaUrl,
      mediaType,
      delay,
      delayUnit: delayUnit || 'hours',
      sendOnlyDuringBusinessHours: sendOnlyDuringBusinessHours !== false,
      businessHours: businessHours || {
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5]
      },
      sequence: sequence || [],
      targetFilters: targetFilters || {},
      excludeFilters: excludeFilters || {},
      maxAttempts: maxAttempts || 3,
      stopOnReply: stopOnReply !== false,
      stopOnConversion: stopOnConversion !== false,
      priority: priority || 0,
      actionsAfterSend: actionsAfterSend || [],
      notifyTeam: notifyTeam || false,
      notifyEmails: notifyEmails || [],
      createdBy: req.user?.id
    });
    
    sendSuccess(res, followUp, 'Follow-up criado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao criar follow-up:', error);
    sendError(res, error);
  }
};

// Atualizar follow-up
exports.updateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    updates.updatedBy = req.user?.id;
    
    await followUp.update(updates);
    
    sendSuccess(res, followUp, 'Follow-up atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar follow-up:', error);
    sendError(res, error);
  }
};

// Deletar follow-up
exports.deleteFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    await followUp.destroy();
    
    sendSuccess(res, null, 'Follow-up deletado com sucesso');
  } catch (error) {
    console.error('Erro ao deletar follow-up:', error);
    sendError(res, error);
  }
};

// Ativar/Pausar follow-up
exports.toggleFollowUpStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'paused', 'archived'].includes(status)) {
      return badRequest(res, 'Status inválido');
    }
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    await followUp.update({ 
      status,
      updatedBy: req.user?.id 
    });
    
    sendSuccess(res, followUp, `Follow-up ${status === 'active' ? 'ativado' : 'pausado'} com sucesso`);
  } catch (error) {
    console.error('Erro ao alterar status do follow-up:', error);
    sendError(res, error);
  }
};

// Duplicar follow-up
exports.duplicateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    const followUpData = followUp.toJSON();
    delete followUpData.id;
    delete followUpData.createdAt;
    delete followUpData.updatedAt;
    
    const newFollowUp = await FollowUp.create({
      ...followUpData,
      name: `${followUpData.name} (Cópia)`,
      status: 'paused',
      stats: {
        totalSent: 0,
        totalReplies: 0,
        totalConversions: 0,
        replyRate: 0,
        conversionRate: 0
      },
      executionLog: [],
      errorLog: [],
      createdBy: req.user?.id
    });
    
    sendSuccess(res, newFollowUp, 'Follow-up duplicado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao duplicar follow-up:', error);
    sendError(res, error);
  }
};

// Estatísticas do follow-up
exports.getFollowUpStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    sendSuccess(res, followUp.stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    sendError(res, error);
  }
};

// Testar follow-up
exports.testFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactId } = req.body;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    if (!contactId) {
      return badRequest(res, 'ID do contato é obrigatório');
    }
    
    const contact = await Contact.findByPk(contactId);
    
    if (!contact) {
      return notFound(res, 'Contato não encontrado');
    }
    
    // Renderizar mensagem com variáveis
    let renderedMessage = followUp.message;
    renderedMessage = renderedMessage.replace(/\{\{nome\}\}/g, contact.name || 'Cliente');
    renderedMessage = renderedMessage.replace(/\{\{telefone\}\}/g, contact.phone || '');
    renderedMessage = renderedMessage.replace(/\{\{email\}\}/g, contact.email || '');
    
    const testResult = {
      followUpId: id,
      contactId,
      contact: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email
      },
      renderedMessage,
      mediaUrl: followUp.mediaUrl,
      mediaType: followUp.mediaType,
      willSendAt: new Date(Date.now() + followUp.delay * getDelayMultiplier(followUp.delayUnit)),
      businessHoursCheck: followUp.sendOnlyDuringBusinessHours
    };
    
    sendSuccess(res, testResult, 'Teste de follow-up concluído');
  } catch (error) {
    console.error('Erro ao testar follow-up:', error);
    sendError(res, error);
  }
};

// Listar contatos elegíveis para um follow-up
exports.getEligibleContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    // Buscar contatos que atendem aos filtros
    const where = {};
    
    // Aplicar targetFilters
    if (followUp.targetFilters.tags) {
      where.tags = { [Op.contains]: followUp.targetFilters.tags };
    }
    
    if (followUp.targetFilters.status) {
      where.status = followUp.targetFilters.status;
    }
    
    // Aplicar excludeFilters
    if (followUp.excludeFilters.blocked) {
      where.isBlocked = false;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: contacts } = await Contact.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['lastInteractionAt', 'ASC']]
    });
    
    sendSuccess(res, {
      contacts,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar contatos elegíveis:', error);
    sendError(res, error);
  }
};

// Enviar follow-up manualmente
exports.sendFollowUpManually = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;
    
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return badRequest(res, 'Lista de IDs de contatos é obrigatória');
    }
    
    const followUp = await FollowUp.findByPk(id);
    
    if (!followUp) {
      return notFound(res, 'Follow-up não encontrado');
    }
    
    // Aqui você integraria com o serviço de envio de mensagens
    // Por enquanto, apenas simulamos o envio
    
    const result = {
      total: contactIds.length,
      sent: contactIds.length,
      failed: 0,
      scheduled: true
    };
    
    // Atualizar estatísticas
    await followUp.update({
      stats: {
        ...followUp.stats,
        totalSent: followUp.stats.totalSent + contactIds.length
      },
      lastExecutedAt: new Date()
    });
    
    sendSuccess(res, result, 'Follow-up enviado com sucesso');
  } catch (error) {
    console.error('Erro ao enviar follow-up:', error);
    sendError(res, error);
  }
};

// Helper: Multiplicador de delay
function getDelayMultiplier(unit) {
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000
  };
  return multipliers[unit] || multipliers.hours;
}

module.exports = exports;

