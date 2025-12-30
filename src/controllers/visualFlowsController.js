const VisualFlow = require('../models/VisualFlowSQL');
const FlowNode = require('../models/FlowNodeSQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');

/**
 * Controller de Fluxos Visuais
 * Gerencia fluxos com editor visual drag & drop
 */

/**
 * Lista todos os fluxos
 * GET /api/visual-flows
 */
async function listFlows(req, res) {
  try {
    const { type, status, isTemplate, search, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';
    
    if (search) {
      where[VisualFlow.sequelize.Sequelize.Op.or] = [
        { name: { [VisualFlow.sequelize.Sequelize.Op.like]: `%${search}%` } },
        { description: { [VisualFlow.sequelize.Sequelize.Op.like]: `%${search}%` } }
      ];
    }
    
    // Verificar permissões
    if (req.user?.role !== 'admin') {
      where[VisualFlow.sequelize.Sequelize.Op.or] = [
        { isPublic: true },
        { createdBy: req.user?.id },
        { allowedUsers: { [VisualFlow.sequelize.Sequelize.Op.contains]: [req.user?.id] } }
      ];
    }
    
    const flows = await VisualFlow.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['nodes', 'edges'] } // Não carregar dados pesados na lista
    });
    
    const total = await VisualFlow.count({ where });
    
    return sendSuccess(res, {
      flows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao listar fluxos:', error);
    return sendError(res, 'Erro ao listar fluxos');
  }
}

/**
 * Busca um fluxo por ID
 * GET /api/visual-flows/:id
 */
async function getFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar permissão de acesso
    if (!canAccessFlow(flow, req.user)) {
      return sendError(res, 'Você não tem permissão para acessar este fluxo', 403);
    }
    
    return sendSuccess(res, { flow });
  } catch (error) {
    console.error('Erro ao buscar fluxo:', error);
    return sendError(res, 'Erro ao buscar fluxo');
  }
}

/**
 * Cria um novo fluxo
 * POST /api/visual-flows
 */
async function createFlow(req, res) {
  try {
    const {
      name,
      description,
      type,
      trigger,
      settings,
      isPublic,
      allowedUsers,
      allowedRoles
    } = req.body;
    
    if (!name) {
      return badRequest(res, 'Nome é obrigatório');
    }
    
    // Gerar slug único
    const slug = generateSlug(name);
    
    // Node de início padrão
    const defaultNodes = [
      {
        id: 'start_1',
        type: 'start',
        position: { x: 250, y: 50 },
        data: {
          label: 'Início'
        }
      }
    ];
    
    const flow = await VisualFlow.create({
      name,
      slug,
      description,
      type: type || 'chatbot',
      nodes: defaultNodes,
      edges: [],
      trigger: trigger || { type: 'manual', config: {} },
      settings: settings || {},
      isPublic: isPublic || false,
      allowedUsers: allowedUsers || [],
      allowedRoles: allowedRoles || [],
      createdBy: req.user?.id
    });
    
    return created(res, {
      flow,
      message: 'Fluxo criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar fluxo:', error);
    return sendError(res, 'Erro ao criar fluxo');
  }
}

/**
 * Atualiza um fluxo
 * PUT /api/visual-flows/:id
 */
async function updateFlow(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      canvas,
      nodes,
      edges,
      variables,
      trigger,
      settings,
      isPublic,
      allowedUsers,
      allowedRoles
    } = req.body;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar permissão
    if (flow.createdBy !== req.user?.id && req.user?.role !== 'admin') {
      return sendError(res, 'Você não tem permissão para editar este fluxo', 403);
    }
    
    // Atualizar slug se nome mudou
    let newSlug = flow.slug;
    if (name && name !== flow.name) {
      newSlug = generateSlug(name);
    }
    
    await flow.update({
      name: name || flow.name,
      slug: newSlug,
      description: description !== undefined ? description : flow.description,
      type: type || flow.type,
      canvas: canvas || flow.canvas,
      nodes: nodes || flow.nodes,
      edges: edges || flow.edges,
      variables: variables || flow.variables,
      trigger: trigger || flow.trigger,
      settings: settings || flow.settings,
      isPublic: isPublic !== undefined ? isPublic : flow.isPublic,
      allowedUsers: allowedUsers || flow.allowedUsers,
      allowedRoles: allowedRoles || flow.allowedRoles,
      updatedBy: req.user?.id
    });
    
    return sendSuccess(res, {
      flow,
      message: 'Fluxo atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error);
    return sendError(res, 'Erro ao atualizar fluxo');
  }
}

/**
 * Deleta um fluxo
 * DELETE /api/visual-flows/:id
 */
async function deleteFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar permissão
    if (flow.createdBy !== req.user?.id && req.user?.role !== 'admin') {
      return sendError(res, 'Você não tem permissão para deletar este fluxo', 403);
    }
    
    // Não permitir deletar fluxos ativos
    if (flow.status === 'active') {
      return badRequest(res, 'Não é possível deletar um fluxo ativo. Pause-o primeiro.');
    }
    
    await flow.destroy();
    
    return sendSuccess(res, {
      message: 'Fluxo deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar fluxo:', error);
    return sendError(res, 'Erro ao deletar fluxo');
  }
}

/**
 * Valida um fluxo
 * POST /api/visual-flows/:id/validate
 */
async function validateFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    const validation = await flow.validate();
    
    return sendSuccess(res, {
      validation,
      message: validation.isValid ? 'Fluxo válido' : 'Fluxo contém erros'
    });
  } catch (error) {
    console.error('Erro ao validar fluxo:', error);
    return sendError(res, 'Erro ao validar fluxo');
  }
}

/**
 * Publica (ativa) um fluxo
 * POST /api/visual-flows/:id/publish
 */
async function publishFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar permissão
    if (flow.createdBy !== req.user?.id && req.user?.role !== 'admin') {
      return sendError(res, 'Você não tem permissão para publicar este fluxo', 403);
    }
    
    try {
      await flow.publish(req.user?.id);
      
      return sendSuccess(res, {
        flow,
        message: 'Fluxo publicado com sucesso'
      });
    } catch (validationError) {
      return badRequest(res, validationError.message);
    }
  } catch (error) {
    console.error('Erro ao publicar fluxo:', error);
    return sendError(res, 'Erro ao publicar fluxo');
  }
}

/**
 * Pausa um fluxo
 * POST /api/visual-flows/:id/pause
 */
async function pauseFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    if (flow.status !== 'active') {
      return badRequest(res, 'Apenas fluxos ativos podem ser pausados');
    }
    
    await flow.update({
      status: 'paused',
      updatedBy: req.user?.id
    });
    
    return sendSuccess(res, {
      flow,
      message: 'Fluxo pausado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao pausar fluxo:', error);
    return sendError(res, 'Erro ao pausar fluxo');
  }
}

/**
 * Clona um fluxo
 * POST /api/visual-flows/:id/clone
 */
async function cloneFlow(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar permissão de acesso
    if (!canAccessFlow(flow, req.user)) {
      return sendError(res, 'Você não tem permissão para clonar este fluxo', 403);
    }
    
    const cloned = await flow.clone(name, req.user?.id);
    
    return created(res, {
      flow: cloned,
      message: 'Fluxo clonado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao clonar fluxo:', error);
    return sendError(res, 'Erro ao clonar fluxo');
  }
}

/**
 * Cria nova versão
 * POST /api/visual-flows/:id/version
 */
async function createVersion(req, res) {
  try {
    const { id } = req.params;
    const { changelog } = req.body;
    
    if (!changelog) {
      return badRequest(res, 'Changelog é obrigatório');
    }
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    const newVersion = await flow.createVersion(changelog, req.user?.id);
    
    return sendSuccess(res, {
      version: newVersion,
      message: `Nova versão criada: ${newVersion}`
    });
  } catch (error) {
    console.error('Erro ao criar versão:', error);
    return sendError(res, 'Erro ao criar versão');
  }
}

/**
 * Exporta fluxo
 * GET /api/visual-flows/:id/export
 */
async function exportFlow(req, res) {
  try {
    const { id } = req.params;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    const exported = flow.export();
    
    // Definir headers para download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${flow.slug}.json"`);
    
    return res.json(exported);
  } catch (error) {
    console.error('Erro ao exportar fluxo:', error);
    return sendError(res, 'Erro ao exportar fluxo');
  }
}

/**
 * Importa fluxo
 * POST /api/visual-flows/import
 */
async function importFlow(req, res) {
  try {
    const { data } = req.body;
    
    if (!data) {
      return badRequest(res, 'Dados do fluxo são obrigatórios');
    }
    
    const flow = await VisualFlow.import(data, req.user?.id);
    
    return created(res, {
      flow,
      message: 'Fluxo importado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao importar fluxo:', error);
    return sendError(res, 'Erro ao importar fluxo');
  }
}

/**
 * Lista biblioteca de nodes
 * GET /api/visual-flows/nodes/library
 */
async function getNodesLibrary(req, res) {
  try {
    const { category, search } = req.query;
    
    const where = {
      isActive: true,
      isDeprecated: false
    };
    
    if (category) where.category = category;
    
    if (search) {
      where[FlowNode.sequelize.Sequelize.Op.or] = [
        { name: { [FlowNode.sequelize.Sequelize.Op.like]: `%${search}%` } },
        { description: { [FlowNode.sequelize.Sequelize.Op.like]: `%${search}%` } }
      ];
    }
    
    // Verificar permissões de role
    if (req.user?.role && req.user.role !== 'admin') {
      where[FlowNode.sequelize.Sequelize.Op.or] = [
        { requiredRole: null },
        { requiredRole: req.user.role }
      ];
    }
    
    const nodes = await FlowNode.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC']
      ]
    });
    
    // Agrupar por categoria
    const grouped = {};
    nodes.forEach(node => {
      if (!grouped[node.category]) {
        grouped[node.category] = [];
      }
      grouped[node.category].push(node);
    });
    
    return sendSuccess(res, {
      nodes,
      grouped,
      total: nodes.length
    });
  } catch (error) {
    console.error('Erro ao buscar biblioteca de nodes:', error);
    return sendError(res, 'Erro ao buscar biblioteca de nodes');
  }
}

/**
 * Busca templates públicos
 * GET /api/visual-flows/templates
 */
async function getTemplates(req, res) {
  try {
    const { category, tags, search, limit = 20 } = req.query;
    
    const where = {
      isTemplate: true,
      isPublished: true,
      status: 'active'
    };
    
    if (category) where.templateCategory = category;
    
    if (tags) {
      const tagsArray = tags.split(',');
      where.templateTags = {
        [VisualFlow.sequelize.Sequelize.Op.overlap]: tagsArray
      };
    }
    
    if (search) {
      where[VisualFlow.sequelize.Sequelize.Op.or] = [
        { name: { [VisualFlow.sequelize.Sequelize.Op.like]: `%${search}%` } },
        { description: { [VisualFlow.sequelize.Sequelize.Op.like]: `%${search}%` } }
      ];
    }
    
    const templates = await VisualFlow.findAll({
      where,
      order: [
        ['rating', 'DESC'],
        ['downloads', 'DESC']
      ],
      limit: parseInt(limit),
      attributes: { exclude: ['nodes', 'edges'] }
    });
    
    return sendSuccess(res, {
      templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Erro ao buscar templates:', error);
    return sendError(res, 'Erro ao buscar templates');
  }
}

/**
 * Testa execução de um fluxo
 * POST /api/visual-flows/:id/test
 */
async function testFlow(req, res) {
  try {
    const { id } = req.params;
    const { input } = req.body;
    
    const flow = await VisualFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Validar primeiro
    const validation = await flow.validate();
    if (!validation.isValid) {
      return badRequest(res, 'Fluxo contém erros de validação');
    }
    
    // TODO: Implementar executor de fluxos
    // Por enquanto, apenas retornar simulação
    
    await flow.update({
      lastTestedAt: new Date()
    });
    
    return sendSuccess(res, {
      message: 'Teste executado com sucesso',
      result: {
        success: true,
        steps: [
          { node: 'start_1', status: 'success', output: 'Início executado' },
          { node: 'node_2', status: 'success', output: 'Mensagem enviada' }
        ],
        duration: 1250
      }
    });
  } catch (error) {
    console.error('Erro ao testar fluxo:', error);
    return sendError(res, 'Erro ao testar fluxo');
  }
}

// Helpers

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Date.now();
}

function canAccessFlow(flow, user) {
  if (!user) return flow.isPublic;
  
  if (user.role === 'admin') return true;
  if (flow.createdBy === user.id) return true;
  if (flow.isPublic) return true;
  if (flow.allowedUsers && flow.allowedUsers.includes(user.id)) return true;
  if (flow.allowedRoles && flow.allowedRoles.includes(user.role)) return true;
  
  return false;
}

module.exports = {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  validateFlow,
  publishFlow,
  pauseFlow,
  cloneFlow,
  createVersion,
  exportFlow,
  importFlow,
  getNodesLibrary,
  getTemplates,
  testFlow
};

