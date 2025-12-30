const Broadcast = require('../models/BroadcastSQL');
const BroadcastList = require('../models/BroadcastListSQL');
const Contact = require('../models/ContactSQL');
const { Op } = require('sequelize');

/**
 * Controller de Transmissões (Broadcasts)
 * Gerenciamento de envios rápidos em massa
 */

// ==================== BROADCASTS ====================

// 1. Listar todas as transmissões
exports.getAllBroadcasts = async (req, res) => {
  try {
    const { 
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await Broadcast.findAndCountAll({
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
    console.error('Erro ao listar transmissões:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao listar transmissões',
      error: error.message 
    });
  }
};

// 2. Obter transmissão por ID
exports.getBroadcastById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await Broadcast.findByPk(id);
    
    if (!broadcast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transmissão não encontrada' 
      });
    }

    res.json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('Erro ao buscar transmissão:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar transmissão',
      error: error.message 
    });
  }
};

// 3. Criar e enviar transmissão
exports.createBroadcast = async (req, res) => {
  try {
    const broadcastData = {
      ...req.body,
      createdBy: req.user?.id,
      status: 'draft',
      totalRecipients: req.body.recipients?.length || 0
    };

    const broadcast = await Broadcast.create(broadcastData);

    // Se for envio imediato, iniciar processamento
    if (req.body.sendImmediately) {
      await broadcast.update({ status: 'sending', sentAt: new Date() });
      processBroadcastSending(broadcast.id);
    }

    res.status(201).json({
      success: true,
      message: 'Transmissão criada com sucesso',
      data: broadcast
    });
  } catch (error) {
    console.error('Erro ao criar transmissão:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar transmissão',
      error: error.message 
    });
  }
};

// 4. Enviar transmissão
exports.sendBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await Broadcast.findByPk(id);
    
    if (!broadcast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transmissão não encontrada' 
      });
    }

    if (broadcast.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Apenas transmissões em rascunho podem ser enviadas'
      });
    }

    await broadcast.update({ 
      status: 'sending',
      sentAt: new Date()
    });

    // Processar envio em background
    processBroadcastSending(broadcast.id);

    res.json({
      success: true,
      message: 'Transmissão iniciada com sucesso',
      data: broadcast
    });
  } catch (error) {
    console.error('Erro ao enviar transmissão:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao enviar transmissão',
      error: error.message 
    });
  }
};

// 5. Deletar transmissão
exports.deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await Broadcast.findByPk(id);
    
    if (!broadcast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transmissão não encontrada' 
      });
    }

    if (broadcast.status === 'sending') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir transmissões em andamento'
      });
    }

    await broadcast.destroy();

    res.json({
      success: true,
      message: 'Transmissão excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir transmissão:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao excluir transmissão',
      error: error.message 
    });
  }
};

// 6. Obter estatísticas de transmissão
exports.getBroadcastStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await Broadcast.findByPk(id);
    
    if (!broadcast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transmissão não encontrada' 
      });
    }

    const stats = {
      totalRecipients: broadcast.totalRecipients,
      sent: broadcast.sentCount,
      delivered: broadcast.deliveredCount,
      read: broadcast.readCount,
      failed: broadcast.failedCount,
      
      deliveryRate: broadcast.sentCount > 0 
        ? ((broadcast.deliveredCount / broadcast.sentCount) * 100).toFixed(2) 
        : 0,
      readRate: broadcast.deliveredCount > 0 
        ? ((broadcast.readCount / broadcast.deliveredCount) * 100).toFixed(2) 
        : 0,
      
      sentAt: broadcast.sentAt,
      completedAt: broadcast.completedAt
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

// ==================== LISTAS DE TRANSMISSÃO ====================

// 7. Listar todas as listas
exports.getAllLists = async (req, res) => {
  try {
    const { 
      category,
      isActive,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;

    const { count, rows } = await BroadcastList.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']]
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
    console.error('Erro ao listar listas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao listar listas',
      error: error.message 
    });
  }
};

// 8. Obter lista por ID
exports.getListById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await BroadcastList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lista não encontrada' 
      });
    }

    // Buscar detalhes dos contatos
    const contacts = await Contact.findAll({
      where: { id: { [Op.in]: list.contacts } },
      attributes: ['id', 'name', 'phone', 'email']
    });

    res.json({
      success: true,
      data: {
        ...list.toJSON(),
        contactDetails: contacts
      }
    });
  } catch (error) {
    console.error('Erro ao buscar lista:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar lista',
      error: error.message 
    });
  }
};

// 9. Criar lista
exports.createList = async (req, res) => {
  try {
    const listData = {
      ...req.body,
      createdBy: req.user?.id,
      totalContacts: req.body.contacts?.length || 0
    };

    const list = await BroadcastList.create(listData);

    res.status(201).json({
      success: true,
      message: 'Lista criada com sucesso',
      data: list
    });
  } catch (error) {
    console.error('Erro ao criar lista:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar lista',
      error: error.message 
    });
  }
};

// 10. Atualizar lista
exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await BroadcastList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lista não encontrada' 
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user?.id
    };

    if (req.body.contacts) {
      updateData.totalContacts = req.body.contacts.length;
    }

    await list.update(updateData);

    res.json({
      success: true,
      message: 'Lista atualizada com sucesso',
      data: list
    });
  } catch (error) {
    console.error('Erro ao atualizar lista:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar lista',
      error: error.message 
    });
  }
};

// 11. Deletar lista
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await BroadcastList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lista não encontrada' 
      });
    }

    await list.destroy();

    res.json({
      success: true,
      message: 'Lista excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir lista:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao excluir lista',
      error: error.message 
    });
  }
};

// 12. Adicionar contatos à lista
exports.addContactsToList = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;
    
    const list = await BroadcastList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lista não encontrada' 
      });
    }

    // Adicionar novos contatos (evitar duplicatas)
    const currentContacts = list.contacts || [];
    const newContacts = [...new Set([...currentContacts, ...contactIds])];

    await list.update({
      contacts: newContacts,
      totalContacts: newContacts.length,
      updatedBy: req.user?.id
    });

    res.json({
      success: true,
      message: `${contactIds.length} contato(s) adicionado(s) à lista`,
      data: list
    });
  } catch (error) {
    console.error('Erro ao adicionar contatos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao adicionar contatos',
      error: error.message 
    });
  }
};

// 13. Remover contatos da lista
exports.removeContactsFromList = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;
    
    const list = await BroadcastList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lista não encontrada' 
      });
    }

    // Remover contatos
    const currentContacts = list.contacts || [];
    const updatedContacts = currentContacts.filter(c => !contactIds.includes(c));

    await list.update({
      contacts: updatedContacts,
      totalContacts: updatedContacts.length,
      updatedBy: req.user?.id
    });

    res.json({
      success: true,
      message: `${contactIds.length} contato(s) removido(s) da lista`,
      data: list
    });
  } catch (error) {
    console.error('Erro ao remover contatos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao remover contatos',
      error: error.message 
    });
  }
};

// Função auxiliar para processar envio de transmissão
async function processBroadcastSending(broadcastId) {
  console.log(`Iniciando envio da transmissão ${broadcastId}`);
  
  // TODO: Implementar lógica real de envio
  // Por enquanto, apenas simular
  
  setTimeout(async () => {
    try {
      const broadcast = await Broadcast.findByPk(broadcastId);
      if (broadcast) {
        await broadcast.update({
          status: 'completed',
          sentCount: broadcast.totalRecipients,
          deliveredCount: Math.floor(broadcast.totalRecipients * 0.95),
          readCount: Math.floor(broadcast.totalRecipients * 0.7),
          failedCount: Math.floor(broadcast.totalRecipients * 0.05),
          completedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Erro ao processar transmissão:', error);
    }
  }, 5000);
}

module.exports = exports;

