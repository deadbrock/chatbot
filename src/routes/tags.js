const express = require('express');
const router = express.Router();
const Tag = require('../models/TagSQL');
const TicketTag = require('../models/TicketTagSQL');
const { httpResponse } = require('../utils/http');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * GET /api/tags
 * Lista todas as tags
 */
router.get('/', async (req, res) => {
  try {
    const { category, isActive, search, limit = 100, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (category) whereClause.category = category;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const tags = await Tag.findAll({
      where: whereClause,
      order: [['usageCount', 'DESC'], ['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Tag.count({ where: whereClause });

    httpResponse.ok(res, {
      data: tags,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Erro ao listar tags:', error);
    httpResponse.error(res, 'Erro ao listar tags');
  }
});

/**
 * GET /api/tags/categories
 * Lista todas as categorias de tags
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Tag.findAll({
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
 * GET /api/tags/:id
 * Obter uma tag por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    
    if (!tag) {
      return httpResponse.notFound(res, 'Tag não encontrada');
    }

    httpResponse.ok(res, tag);
  } catch (error) {
    logger.error('Erro ao obter tag:', error);
    httpResponse.error(res, 'Erro ao obter tag');
  }
});

/**
 * POST /api/tags
 * Criar nova tag
 */
router.post('/', async (req, res) => {
  try {
    const { name, color, description, icon, category, isActive } = req.body;

    if (!name) {
      return httpResponse.badRequest(res, 'Nome é obrigatório');
    }

    // Verificar se tag com mesmo nome já existe
    const existingTag = await Tag.findOne({ where: { name } });
    if (existingTag) {
      return httpResponse.badRequest(res, 'Já existe uma tag com este nome');
    }

    const tag = await Tag.create({
      name,
      color: color || '#6c757d',
      description,
      icon,
      category,
      isActive,
      createdBy: req.user?.id
    });

    logger.info(`Tag criada: ${name}`);
    httpResponse.created(res, tag);
  } catch (error) {
    logger.error('Erro ao criar tag:', error);
    httpResponse.error(res, 'Erro ao criar tag');
  }
});

/**
 * PUT /api/tags/:id
 * Atualizar tag
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, color, description, icon, category, isActive } = req.body;

    const tag = await Tag.findByPk(req.params.id);
    
    if (!tag) {
      return httpResponse.notFound(res, 'Tag não encontrada');
    }

    // Se mudou o nome, verificar se novo nome está disponível
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({ 
        where: { 
          name,
          id: { [Op.ne]: req.params.id }
        } 
      });
      
      if (existingTag) {
        return httpResponse.badRequest(res, 'Já existe uma tag com este nome');
      }
    }

    await tag.update({
      name: name || tag.name,
      color: color || tag.color,
      description: description !== undefined ? description : tag.description,
      icon: icon !== undefined ? icon : tag.icon,
      category: category !== undefined ? category : tag.category,
      isActive: isActive !== undefined ? isActive : tag.isActive,
      updatedBy: req.user?.id
    });

    logger.info(`Tag atualizada: ${tag.name}`);
    httpResponse.ok(res, tag);
  } catch (error) {
    logger.error('Erro ao atualizar tag:', error);
    httpResponse.error(res, 'Erro ao atualizar tag');
  }
});

/**
 * DELETE /api/tags/:id
 * Excluir tag
 */
router.delete('/:id', async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    
    if (!tag) {
      return httpResponse.notFound(res, 'Tag não encontrada');
    }

    // Remover relacionamentos com tickets
    await TicketTag.destroy({ where: { tagId: tag.id } });
    
    await tag.destroy();
    
    logger.info(`Tag excluída: ${tag.name}`);
    httpResponse.noContent(res);
  } catch (error) {
    logger.error('Erro ao excluir tag:', error);
    httpResponse.error(res, 'Erro ao excluir tag');
  }
});

/**
 * POST /api/tags/:id/toggle
 * Ativar/Desativar tag
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    
    if (!tag) {
      return httpResponse.notFound(res, 'Tag não encontrada');
    }

    tag.isActive = !tag.isActive;
    await tag.save();

    logger.info(`Tag ${tag.isActive ? 'ativada' : 'desativada'}: ${tag.name}`);
    httpResponse.ok(res, tag);
  } catch (error) {
    logger.error('Erro ao alternar status:', error);
    httpResponse.error(res, 'Erro ao alternar status');
  }
});

/**
 * GET /api/tags/stats/usage
 * Estatísticas de uso de tags
 */
router.get('/stats/usage', async (req, res) => {
  try {
    const mostUsed = await Tag.findAll({
      where: { isActive: true },
      order: [['usageCount', 'DESC']],
      limit: 10
    });

    const totalUsage = await Tag.sum('usageCount');
    const totalActive = await Tag.count({ where: { isActive: true } });
    const totalInactive = await Tag.count({ where: { isActive: false } });

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

/**
 * POST /api/tags/ticket/:ticketId
 * Adicionar tag a um ticket
 */
router.post('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      return httpResponse.badRequest(res, 'tagId é obrigatório');
    }

    // Verificar se tag existe
    const tag = await Tag.findByPk(tagId);
    if (!tag) {
      return httpResponse.notFound(res, 'Tag não encontrada');
    }

    // Verificar se já existe o relacionamento
    const existingRelation = await TicketTag.findOne({
      where: { ticketId, tagId }
    });

    if (existingRelation) {
      return httpResponse.badRequest(res, 'Tag já adicionada a este ticket');
    }

    // Criar relacionamento
    const ticketTag = await TicketTag.create({
      ticketId,
      tagId,
      addedBy: req.user?.id
    });

    // Incrementar contador de uso
    await tag.incrementUsage();

    logger.info(`Tag ${tag.name} adicionada ao ticket ${ticketId}`);
    httpResponse.created(res, ticketTag);
  } catch (error) {
    logger.error('Erro ao adicionar tag ao ticket:', error);
    httpResponse.error(res, 'Erro ao adicionar tag ao ticket');
  }
});

/**
 * DELETE /api/tags/ticket/:ticketId/:tagId
 * Remover tag de um ticket
 */
router.delete('/ticket/:ticketId/:tagId', async (req, res) => {
  try {
    const { ticketId, tagId } = req.params;

    const ticketTag = await TicketTag.findOne({
      where: { ticketId, tagId }
    });

    if (!ticketTag) {
      return httpResponse.notFound(res, 'Relacionamento não encontrado');
    }

    await ticketTag.destroy();

    // Decrementar contador de uso
    const tag = await Tag.findByPk(tagId);
    if (tag) {
      await tag.decrementUsage();
    }

    logger.info(`Tag removida do ticket ${ticketId}`);
    httpResponse.noContent(res);
  } catch (error) {
    logger.error('Erro ao remover tag do ticket:', error);
    httpResponse.error(res, 'Erro ao remover tag do ticket');
  }
});

/**
 * GET /api/tags/ticket/:ticketId
 * Listar tags de um ticket específico
 */
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticketTags = await TicketTag.findAll({
      where: { ticketId },
      include: [
        {
          model: Tag,
          as: 'tag'
        }
      ]
    });

    httpResponse.ok(res, ticketTags);
  } catch (error) {
    logger.error('Erro ao listar tags do ticket:', error);
    httpResponse.error(res, 'Erro ao listar tags do ticket');
  }
});

module.exports = router;

