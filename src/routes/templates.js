const express = require('express');
const router = express.Router();
const MessageTemplate = require('../models/MessageTemplateSQL');

/**
 * GET /api/templates
 * Listar todos os templates
 */
router.get('/', async (req, res) => {
  try {
    const { category, department, status } = req.query;
    
    const where = {};
    if (category) where.category = category;
    if (department) where.department = department;
    if (status) where.status = status;

    const templates = await MessageTemplate.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar templates',
      error: error.message
    });
  }
});

/**
 * GET /api/templates/active
 * Listar apenas templates ativos
 */
router.get('/active', async (req, res) => {
  try {
    const templates = await MessageTemplate.getActiveTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Erro ao listar templates ativos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar templates ativos',
      error: error.message
    });
  }
});

/**
 * GET /api/templates/categories
 * Listar categorias disponíveis
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { value: 'greeting', label: 'Saudação' },
      { value: 'closing', label: 'Despedida' },
      { value: 'info', label: 'Informação' },
      { value: 'error', label: 'Erro' },
      { value: 'confirmation', label: 'Confirmação' },
      { value: 'question', label: 'Pergunta' },
      { value: 'offer', label: 'Oferta' },
      { value: 'reminder', label: 'Lembrete' },
      { value: 'general', label: 'Geral' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar categorias',
      error: error.message
    });
  }
});

/**
 * GET /api/templates/:id
 * Detalhes de um template
 */
router.get('/:id', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Erro ao buscar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar template',
      error: error.message
    });
  }
});

/**
 * POST /api/templates
 * Criar novo template
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category,
      content,
      variables,
      mediaType,
      mediaUrl,
      department,
      tags
    } = req.body;

    // Validações
    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: name, content'
      });
    }

    const template = await MessageTemplate.create({
      name,
      category: category || 'general',
      content,
      variables: Array.isArray(variables) ? variables : [],
      mediaType: mediaType || 'text',
      mediaUrl,
      department,
      tags: Array.isArray(tags) ? tags : [],
      status: 'active',
      createdBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Template criado com sucesso',
      data: template
    });
  } catch (error) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar template',
      error: error.message
    });
  }
});

/**
 * PUT /api/templates/:id
 * Atualizar template
 */
router.put('/:id', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    const {
      name,
      category,
      content,
      variables,
      mediaType,
      mediaUrl,
      department,
      tags,
      status
    } = req.body;

    // Atualizar campos
    if (name !== undefined) template.name = name;
    if (category !== undefined) template.category = category;
    if (content !== undefined) template.content = content;
    if (variables !== undefined) template.variables = variables;
    if (mediaType !== undefined) template.mediaType = mediaType;
    if (mediaUrl !== undefined) template.mediaUrl = mediaUrl;
    if (department !== undefined) template.department = department;
    if (tags !== undefined) template.tags = tags;
    if (status !== undefined) template.status = status;
    
    template.updatedBy = req.user?.id;

    await template.save();

    res.json({
      success: true,
      message: 'Template atualizado com sucesso',
      data: template
    });
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar template',
      error: error.message
    });
  }
});

/**
 * POST /api/templates/:id/duplicate
 * Duplicar template
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    const newName = req.body.name || `${template.name} (cópia)`;
    const duplicate = await template.duplicate(newName);

    res.status(201).json({
      success: true,
      message: 'Template duplicado com sucesso',
      data: duplicate
    });
  } catch (error) {
    console.error('Erro ao duplicar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao duplicar template',
      error: error.message
    });
  }
});

/**
 * POST /api/templates/:id/render
 * Renderizar template com variáveis
 */
router.post('/:id/render', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    const variables = req.body.variables || {};
    const rendered = template.render(variables);

    res.json({
      success: true,
      data: { rendered }
    });
  } catch (error) {
    console.error('Erro ao renderizar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao renderizar template',
      error: error.message
    });
  }
});

/**
 * POST /api/templates/:id/validate
 * Validar template
 */
router.post('/:id/validate', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    const validation = template.validate();

    res.json({
      success: true,
      message: validation.valid ? 'Template válido' : 'Template com avisos',
      data: validation
    });
  } catch (error) {
    console.error('Erro ao validar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar template',
      error: error.message
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Deletar template
 */
router.delete('/:id', async (req, res) => {
  try {
    const template = await MessageTemplate.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    await template.destroy();

    res.json({
      success: true,
      message: 'Template deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar template',
      error: error.message
    });
  }
});

module.exports = router;
