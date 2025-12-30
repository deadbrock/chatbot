const MessageTemplateAdvanced = require('../models/MessageTemplateAdvancedSQL');
const { Op } = require('sequelize');

/**
 * Controller de Templates de Mensagem Avançados
 * Gerenciamento completo de templates com variáveis e condições
 */

// 1. Listar todos os templates
exports.getAllTemplates = async (req, res) => {
  try {
    const { 
      category,
      type,
      isActive,
      isApproved,
      search,
      page = 1,
      limit = 20,
      sortBy = 'usageCount',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};
    
    if (category) where.category = category;
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (isApproved !== undefined) where.isApproved = isApproved === 'true';
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await MessageTemplateAdvanced.findAndCountAll({
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
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao listar templates',
      error: error.message 
    });
  }
};

// 2. Obter template por ID
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await MessageTemplateAdvanced.findByPk(id);
    
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
};

// 3. Obter template por slug
exports.getTemplateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const template = await MessageTemplateAdvanced.findOne({ where: { slug } });
    
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
};

// 4. Criar template
exports.createTemplate = async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdBy: req.user?.id,
      slug: generateSlug(req.body.name)
    };

    // Extrair variáveis do conteúdo
    if (!templateData.variables || templateData.variables.length === 0) {
      templateData.variables = extractVariables(templateData.content);
    }

    const template = await MessageTemplateAdvanced.create(templateData);

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
};

// 5. Atualizar template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await MessageTemplateAdvanced.findByPk(id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user?.id
    };

    // Se o conteúdo mudou, extrair novas variáveis
    if (req.body.content && req.body.content !== template.content) {
      updateData.variables = extractVariables(req.body.content);
      
      // Incrementar versão
      updateData.version = template.version + 1;
      
      // Adicionar ao changelog
      const changelog = template.changeLog || [];
      changelog.push({
        version: updateData.version,
        changedBy: req.user?.id,
        changedAt: new Date(),
        changes: 'Conteúdo atualizado'
      });
      updateData.changeLog = changelog;
    }

    await template.update(updateData);

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
};

// 6. Deletar template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await MessageTemplateAdvanced.findByPk(id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    await template.destroy();

    res.json({
      success: true,
      message: 'Template excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao excluir template',
      error: error.message 
    });
  }
};

// 7. Renderizar template com variáveis
exports.renderTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;
    
    const template = await MessageTemplateAdvanced.findByPk(id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    if (!template.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Template inativo'
      });
    }

    if (template.requiresApproval && !template.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Template aguardando aprovação'
      });
    }

    const rendered = renderTemplateContent(template.content, variables || {});

    // Atualizar estatísticas
    await template.update({
      usageCount: template.usageCount + 1,
      lastUsedAt: new Date()
    });

    res.json({
      success: true,
      data: {
        original: template.content,
        rendered,
        variables: template.variables
      }
    });
  } catch (error) {
    console.error('Erro ao renderizar template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao renderizar template',
      error: error.message 
    });
  }
};

// 8. Aprovar template
exports.approveTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await MessageTemplateAdvanced.findByPk(id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    await template.update({
      isApproved: true,
      approvedBy: req.user?.id,
      approvedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Template aprovado com sucesso',
      data: template
    });
  } catch (error) {
    console.error('Erro ao aprovar template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao aprovar template',
      error: error.message 
    });
  }
};

// 9. Duplicar template
exports.duplicateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const original = await MessageTemplateAdvanced.findByPk(id);
    
    if (!original) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    const duplicate = await MessageTemplateAdvanced.create({
      ...original.toJSON(),
      id: undefined,
      name: `${original.name} (Cópia)`,
      slug: generateSlug(`${original.name} copia`),
      usageCount: 0,
      lastUsedAt: null,
      isApproved: false,
      approvedBy: null,
      approvedAt: null,
      createdBy: req.user?.id,
      createdAt: undefined,
      updatedAt: undefined
    });

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
};

// 10. Obter estatísticas de templates
exports.getTemplatesStats = async (req, res) => {
  try {
    const total = await MessageTemplateAdvanced.count();
    const active = await MessageTemplateAdvanced.count({ where: { isActive: true } });
    const approved = await MessageTemplateAdvanced.count({ where: { isApproved: true } });
    const pendingApproval = await MessageTemplateAdvanced.count({ 
      where: { requiresApproval: true, isApproved: false } 
    });

    // Templates mais usados
    const mostUsed = await MessageTemplateAdvanced.findAll({
      where: { isActive: true },
      order: [['usageCount', 'DESC']],
      limit: 5,
      attributes: ['id', 'name', 'usageCount', 'category']
    });

    // Templates por categoria
    const byCategory = await MessageTemplateAdvanced.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category']
    });

    res.json({
      success: true,
      data: {
        total,
        active,
        approved,
        pendingApproval,
        mostUsed,
        byCategory
      }
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

// Funções auxiliares

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + '-' + Date.now();
}

function extractVariables(content) {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = [];
  const seen = new Set();
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    if (!seen.has(varName)) {
      seen.add(varName);
      variables.push({
        name: varName,
        type: 'string',
        required: true,
        default: ''
      });
    }
  }
  
  return variables;
}

function renderTemplateContent(content, variables) {
  let rendered = content;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  
  return rendered;
}

module.exports = exports;

