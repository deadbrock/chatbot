const Campaign = require('../models/CampaignSQL');
const Contact = require('../models/ContactSQL');
const { Op } = require('sequelize');

/**
 * Controller de Campanhas
 * Gerenciamento completo de campanhas de mensagens em massa
 */

// 1. Listar todas as campanhas
exports.getAllCampaigns = async (req, res) => {
  try {
    const { 
      status, 
      category, 
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};
    
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Campaign.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao listar campanhas',
      error: error.message 
    });
  }
};

// 2. Obter campanha por ID
exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao buscar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar campanha',
      error: error.message 
    });
  }
};

// 3. Criar nova campanha
exports.createCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user?.id,
      status: 'draft'
    };

    // Calcular total de contatos baseado na segmentação
    const totalContacts = await calculateTargetContacts(campaignData);
    campaignData.totalContacts = totalContacts;

    const campaign = await Campaign.create(campaignData);

    res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar campanha',
      error: error.message 
    });
  }
};

// 4. Atualizar campanha
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    // Não permitir edição de campanhas em andamento
    if (['sending', 'completed'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível editar campanhas em andamento ou concluídas'
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user?.id
    };

    // Recalcular total de contatos se a segmentação mudou
    if (req.body.targetType || req.body.targetFilters || req.body.targetContacts) {
      const totalContacts = await calculateTargetContacts(updateData);
      updateData.totalContacts = totalContacts;
    }

    await campaign.update(updateData);

    res.json({
      success: true,
      message: 'Campanha atualizada com sucesso',
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao atualizar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar campanha',
      error: error.message 
    });
  }
};

// 5. Deletar campanha
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    // Não permitir exclusão de campanhas em andamento
    if (campaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir campanhas em andamento. Pause a campanha primeiro.'
      });
    }

    await campaign.destroy();

    res.json({
      success: true,
      message: 'Campanha excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao excluir campanha',
      error: error.message 
    });
  }
};

// 6. Iniciar envio de campanha
exports.startCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Campanha não pode ser iniciada neste status'
      });
    }

    await campaign.update({
      status: 'sending',
      startedAt: new Date()
    });

    // Aqui você integraria com o sistema de envio de mensagens
    // Por enquanto, vamos apenas simular o início
    processCampaignSending(campaign.id);

    res.json({
      success: true,
      message: 'Campanha iniciada com sucesso',
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao iniciar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao iniciar campanha',
      error: error.message 
    });
  }
};

// 7. Pausar campanha
exports.pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    if (campaign.status !== 'sending') {
      return res.status(400).json({
        success: false,
        message: 'Apenas campanhas em envio podem ser pausadas'
      });
    }

    await campaign.update({ status: 'paused' });

    res.json({
      success: true,
      message: 'Campanha pausada com sucesso',
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao pausar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao pausar campanha',
      error: error.message 
    });
  }
};

// 8. Cancelar campanha
exports.cancelCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    if (campaign.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível cancelar campanhas concluídas'
      });
    }

    await campaign.update({ 
      status: 'cancelled',
      completedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Campanha cancelada com sucesso',
      data: campaign
    });
  } catch (error) {
    console.error('Erro ao cancelar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao cancelar campanha',
      error: error.message 
    });
  }
};

// 9. Obter estatísticas da campanha
exports.getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    const stats = {
      totalContacts: campaign.totalContacts,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      read: campaign.readCount,
      failed: campaign.failedCount,
      replies: campaign.repliesCount,
      
      // Taxas percentuais
      deliveryRate: campaign.sentCount > 0 
        ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(2) 
        : 0,
      readRate: campaign.deliveredCount > 0 
        ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(2) 
        : 0,
      replyRate: campaign.deliveredCount > 0 
        ? ((campaign.repliesCount / campaign.deliveredCount) * 100).toFixed(2) 
        : 0,
      failureRate: campaign.sentCount > 0 
        ? ((campaign.failedCount / campaign.sentCount) * 100).toFixed(2) 
        : 0,
      
      // Progresso
      progress: campaign.totalContacts > 0 
        ? ((campaign.sentCount / campaign.totalContacts) * 100).toFixed(2) 
        : 0,
      
      // Tempo
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      duration: campaign.startedAt && campaign.completedAt
        ? Math.round((new Date(campaign.completedAt) - new Date(campaign.startedAt)) / 1000 / 60)
        : null
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao obter estatísticas',
      error: error.message 
    });
  }
};

// 10. Obter contatos da campanha
exports.getCampaignContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    const contacts = await getTargetContacts(campaign, page, limit);

    res.json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Erro ao obter contatos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao obter contatos',
      error: error.message 
    });
  }
};

// 11. Duplicar campanha
exports.duplicateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const original = await Campaign.findByPk(id);
    
    if (!original) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    const duplicate = await Campaign.create({
      ...original.toJSON(),
      id: undefined,
      name: `${original.name} (Cópia)`,
      status: 'draft',
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      repliesCount: 0,
      startedAt: null,
      completedAt: null,
      createdBy: req.user?.id,
      createdAt: undefined,
      updatedAt: undefined
    });

    res.status(201).json({
      success: true,
      message: 'Campanha duplicada com sucesso',
      data: duplicate
    });
  } catch (error) {
    console.error('Erro ao duplicar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao duplicar campanha',
      error: error.message 
    });
  }
};

// 12. Testar campanha (enviar para um contato de teste)
exports.testCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { testContactId } = req.body;
    
    const campaign = await Campaign.findByPk(id);
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campanha não encontrada' 
      });
    }

    const contact = await Contact.findByPk(testContactId);
    
    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contato de teste não encontrado' 
      });
    }

    // Aqui você integraria com o sistema de envio de mensagens
    // Por enquanto, apenas simulamos
    const testResult = {
      sent: true,
      contact: contact.name,
      phone: contact.phone,
      message: replaceVariables(campaign.message, contact)
    };

    res.json({
      success: true,
      message: 'Mensagem de teste enviada com sucesso',
      data: testResult
    });
  } catch (error) {
    console.error('Erro ao testar campanha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao testar campanha',
      error: error.message 
    });
  }
};

// Funções auxiliares

async function calculateTargetContacts(campaignData) {
  try {
    const where = buildContactsWhere(campaignData);
    const count = await Contact.count({ where });
    return count;
  } catch (error) {
    console.error('Erro ao calcular contatos:', error);
    return 0;
  }
}

async function getTargetContacts(campaign, page = 1, limit = 50) {
  try {
    const where = buildContactsWhere(campaign);
    const offset = (page - 1) * limit;
    
    const { count, rows } = await Contact.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']]
    });

    return {
      contacts: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    };
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return { contacts: [], pagination: {} };
  }
}

function buildContactsWhere(campaign) {
  const where = {};

  // Excluir contatos bloqueados se respectOptOut estiver ativo
  if (campaign.respectOptOut) {
    where.isBlocked = false;
  }

  // Aplicar filtros baseados no tipo de segmentação
  switch (campaign.targetType) {
    case 'all':
      // Todos os contatos (já filtrado por isBlocked acima)
      break;
      
    case 'list':
      // Lista específica de contatos
      if (campaign.targetContacts && campaign.targetContacts.length > 0) {
        where.id = { [Op.in]: campaign.targetContacts };
      }
      break;
      
    case 'tags':
      // Filtrar por tags
      if (campaign.targetFilters?.tags && campaign.targetFilters.tags.length > 0) {
        where.tags = { [Op.overlap]: campaign.targetFilters.tags };
      }
      break;
      
    case 'segment':
    case 'custom':
      // Aplicar filtros personalizados
      if (campaign.targetFilters) {
        if (campaign.targetFilters.category) {
          where.category = campaign.targetFilters.category;
        }
        if (campaign.targetFilters.source) {
          where.source = campaign.targetFilters.source;
        }
        if (campaign.targetFilters.tags && campaign.targetFilters.tags.length > 0) {
          where.tags = { [Op.overlap]: campaign.targetFilters.tags };
        }
      }
      break;
  }

  // Excluir contatos específicos
  if (campaign.excludeContacts && campaign.excludeContacts.length > 0) {
    where.id = { 
      ...where.id, 
      [Op.notIn]: campaign.excludeContacts 
    };
  }

  return where;
}

function replaceVariables(message, contact) {
  let processedMessage = message;
  
  // Variáveis padrão
  const variables = {
    '{{nome}}': contact.name || '',
    '{{email}}': contact.email || '',
    '{{telefone}}': contact.phone || '',
    '{{empresa}}': contact.companyName || '',
    '{{cargo}}': contact.jobTitle || ''
  };

  for (const [variable, value] of Object.entries(variables)) {
    processedMessage = processedMessage.replace(new RegExp(variable, 'g'), value);
  }

  return processedMessage;
}

async function processCampaignSending(campaignId) {
  // Esta função seria executada em background
  // Aqui você implementaria a lógica de envio real
  // Por enquanto, apenas um placeholder
  console.log(`Iniciando envio da campanha ${campaignId}`);
  
  // TODO: Implementar fila de envio com controle de velocidade
  // TODO: Integrar com WhatsApp client
  // TODO: Atualizar estatísticas em tempo real
}

module.exports = exports;

