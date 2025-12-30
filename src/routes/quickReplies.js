const express = require('express');
const router = express.Router();
const QuickReply = require('../models/QuickReplySQL');
const { httpResponse } = require('../utils/http');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * GET /api/quick-replies
 * Lista todas as respostas rápidas
 */
router.get('/', async (req, res) => {
  try {
    const { category, isActive, search, limit = 100, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (category) whereClause.category = category;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    if (search) {
      whereClause[Op.or] = [
        { shortcut: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }

    const quickReplies = await QuickReply.findAll({
      where: whereClause,
      order: [['usageCount', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await QuickReply.count({ where: whereClause });

    httpResponse.ok(res, {
      data: quickReplies,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Erro ao listar respostas rápidas:', error);
    httpResponse.error(res, 'Erro ao listar respostas rápidas');
  }
});

/**
 * GET /api/quick-replies/categories
 * Lista todas as categorias
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await QuickReply.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        category: { [Op.ne]: null }
      },
      group: ['category'],
      raw: true
    });

    httpResponse.ok(res, categories);
  } catch (error) {
    logger.error('Erro ao listar categorias:', error);
    httpResponse.error(res, 'Erro ao listar categorias');
  }
});

/**
 * GET /api/quick-replies/search/:shortcut
 * Busca por atalho específico
 */
router.get('/search/:shortcut', async (req, res) => {
  try {
    const { shortcut } = req.params;
    
    const quickReply = await QuickReply.findOne({
      where: {
        shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
        isActive: true
      }
    });

    if (!quickReply) {
      return httpResponse.notFound(res, 'Resposta rápida não encontrada');
    }

    // Incrementar contador de uso
    await quickReply.incrementUsage();

    httpResponse.ok(res, quickReply);
  } catch (error) {
    logger.error('Erro ao buscar resposta rápida:', error);
    httpResponse.error(res, 'Erro ao buscar resposta rápida');
  }
});

/**
 * GET /api/quick-replies/:id
 * Obter uma resposta rápida por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const quickReply = await QuickReply.findByPk(req.params.id);
    
    if (!quickReply) {
      return httpResponse.notFound(res, 'Resposta rápida não encontrada');
    }

    httpResponse.ok(res, quickReply);
  } catch (error) {
    logger.error('Erro ao obter resposta rápida:', error);
    httpResponse.error(res, 'Erro ao obter resposta rápida');
  }
});

/**
 * POST /api/quick-replies
 * Criar nova resposta rápida
 */
router.post('/', async (req, res) => {
  try {
    const { shortcut, message, category, mediaUrl, mediaType, isActive } = req.body;

    if (!shortcut || !message) {
      return httpResponse.badRequest(res, 'shortcut e message são obrigatórios');
    }

    // Validar formato do atalho
    if (!shortcut.startsWith('/')) {
      return httpResponse.badRequest(res, 'Atalho deve começar com /');
    }

    // Verificar se atalho já existe
    const existingShortcut = await QuickReply.findOne({ where: { shortcut } });
    if (existingShortcut) {
      return httpResponse.badRequest(res, 'Este atalho já está em uso');
    }

    const quickReply = await QuickReply.create({
      shortcut,
      message,
      category,
      mediaUrl,
      mediaType,
      isActive,
      createdBy: req.user?.id
    });

    logger.info(`Resposta rápida criada: ${shortcut}`);
    httpResponse.created(res, quickReply);
  } catch (error) {
    logger.error('Erro ao criar resposta rápida:', error);
    httpResponse.error(res, 'Erro ao criar resposta rápida');
  }
});

/**
 * PUT /api/quick-replies/:id
 * Atualizar resposta rápida
 */
router.put('/:id', async (req, res) => {
  try {
    const { shortcut, message, category, mediaUrl, mediaType, isActive } = req.body;

    const quickReply = await QuickReply.findByPk(req.params.id);
    
    if (!quickReply) {
      return httpResponse.notFound(res, 'Resposta rápida não encontrada');
    }

    // Se mudou o atalho, verificar se novo atalho está disponível
    if (shortcut && shortcut !== quickReply.shortcut) {
      const existingShortcut = await QuickReply.findOne({ 
        where: { 
          shortcut,
          id: { [Op.ne]: req.params.id }
        } 
      });
      
      if (existingShortcut) {
        return httpResponse.badRequest(res, 'Este atalho já está em uso');
      }
    }

    await quickReply.update({
      shortcut: shortcut || quickReply.shortcut,
      message: message || quickReply.message,
      category: category !== undefined ? category : quickReply.category,
      mediaUrl: mediaUrl !== undefined ? mediaUrl : quickReply.mediaUrl,
      mediaType: mediaType !== undefined ? mediaType : quickReply.mediaType,
      isActive: isActive !== undefined ? isActive : quickReply.isActive,
      updatedBy: req.user?.id
    });

    logger.info(`Resposta rápida atualizada: ${quickReply.shortcut}`);
    httpResponse.ok(res, quickReply);
  } catch (error) {
    logger.error('Erro ao atualizar resposta rápida:', error);
    httpResponse.error(res, 'Erro ao atualizar resposta rápida');
  }
});

/**
 * DELETE /api/quick-replies/:id
 * Excluir resposta rápida
 */
router.delete('/:id', async (req, res) => {
  try {
    const quickReply = await QuickReply.findByPk(req.params.id);
    
    if (!quickReply) {
      return httpResponse.notFound(res, 'Resposta rápida não encontrada');
    }

    await quickReply.destroy();
    
    logger.info(`Resposta rápida excluída: ${quickReply.shortcut}`);
    httpResponse.noContent(res);
  } catch (error) {
    logger.error('Erro ao excluir resposta rápida:', error);
    httpResponse.error(res, 'Erro ao excluir resposta rápida');
  }
});

/**
 * POST /api/quick-replies/:id/toggle
 * Ativar/Desativar resposta rápida
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const quickReply = await QuickReply.findByPk(req.params.id);
    
    if (!quickReply) {
      return httpResponse.notFound(res, 'Resposta rápida não encontrada');
    }

    quickReply.isActive = !quickReply.isActive;
    await quickReply.save();

    logger.info(`Resposta rápida ${quickReply.isActive ? 'ativada' : 'desativada'}: ${quickReply.shortcut}`);
    httpResponse.ok(res, quickReply);
  } catch (error) {
    logger.error('Erro ao alternar status:', error);
    httpResponse.error(res, 'Erro ao alternar status');
  }
});

/**
 * GET /api/quick-replies/stats/usage
 * Estatísticas de uso
 */
router.get('/stats/usage', async (req, res) => {
  try {
    const mostUsed = await QuickReply.findAll({
      where: { isActive: true },
      order: [['usageCount', 'DESC']],
      limit: 10
    });

    const totalUsage = await QuickReply.sum('usageCount');
    const totalActive = await QuickReply.count({ where: { isActive: true } });
    const totalInactive = await QuickReply.count({ where: { isActive: false } });

    httpResponse.ok(res, {
      mostUsed,
      totalUsage,
      totalActive,
      totalInactive
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error);
    httpResponse.error(res, 'Erro ao obter estatísticas');
  }
});

module.exports = router;

