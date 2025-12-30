const express = require('express');
const router = express.Router();
const Flow = require('../models/FlowSQL');

/**
 * GET /api/flows
 * Listar todos os fluxos
 */
router.get('/', async (req, res) => {
  try {
    const { status, department } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (department) where.department = department;

    const flows = await Flow.findAll({
      where,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: flows
    });
  } catch (error) {
    console.error('Erro ao listar fluxos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar fluxos',
      error: error.message
    });
  }
});

/**
 * GET /api/flows/active
 * Listar apenas fluxos ativos
 */
router.get('/active', async (req, res) => {
  try {
    const flows = await Flow.getActiveFlows();
    res.json({
      success: true,
      data: flows
    });
  } catch (error) {
    console.error('Erro ao listar fluxos ativos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar fluxos ativos',
      error: error.message
    });
  }
});

/**
 * GET /api/flows/:id
 * Detalhes de um fluxo
 */
router.get('/:id', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    console.error('Erro ao buscar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar fluxo',
      error: error.message
    });
  }
});

/**
 * POST /api/flows
 * Criar novo fluxo
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      trigger,
      triggerType,
      steps,
      variables,
      department,
      priority
    } = req.body;

    // Validações
    if (!name || !trigger || !steps) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: name, trigger, steps'
      });
    }

    const flow = await Flow.create({
      name,
      description,
      trigger,
      triggerType: triggerType || 'keyword',
      steps: Array.isArray(steps) ? steps : [],
      variables: variables || {},
      department,
      priority: priority || 0,
      status: 'draft',
      createdBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Fluxo criado com sucesso',
      data: flow
    });
  } catch (error) {
    console.error('Erro ao criar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar fluxo',
      error: error.message
    });
  }
});

/**
 * PUT /api/flows/:id
 * Atualizar fluxo
 */
router.put('/:id', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    const {
      name,
      description,
      trigger,
      triggerType,
      steps,
      variables,
      department,
      priority,
      status
    } = req.body;

    // Atualizar campos
    if (name !== undefined) flow.name = name;
    if (description !== undefined) flow.description = description;
    if (trigger !== undefined) flow.trigger = trigger;
    if (triggerType !== undefined) flow.triggerType = triggerType;
    if (steps !== undefined) flow.steps = steps;
    if (variables !== undefined) flow.variables = variables;
    if (department !== undefined) flow.department = department;
    if (priority !== undefined) flow.priority = priority;
    if (status !== undefined) flow.status = status;
    
    flow.updatedBy = req.user?.id;

    await flow.save();

    res.json({
      success: true,
      message: 'Fluxo atualizado com sucesso',
      data: flow
    });
  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar fluxo',
      error: error.message
    });
  }
});

/**
 * PATCH /api/flows/:id/activate
 * Ativar fluxo
 */
router.patch('/:id/activate', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    await flow.activate();

    res.json({
      success: true,
      message: 'Fluxo ativado com sucesso',
      data: flow
    });
  } catch (error) {
    console.error('Erro ao ativar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar fluxo',
      error: error.message
    });
  }
});

/**
 * PATCH /api/flows/:id/archive
 * Arquivar fluxo
 */
router.patch('/:id/archive', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    await flow.archive();

    res.json({
      success: true,
      message: 'Fluxo arquivado com sucesso',
      data: flow
    });
  } catch (error) {
    console.error('Erro ao arquivar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao arquivar fluxo',
      error: error.message
    });
  }
});

/**
 * POST /api/flows/:id/duplicate
 * Duplicar fluxo
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    const newName = req.body.name || `${flow.name} (cópia)`;
    const duplicate = await flow.duplicate(newName);

    res.status(201).json({
      success: true,
      message: 'Fluxo duplicado com sucesso',
      data: duplicate
    });
  } catch (error) {
    console.error('Erro ao duplicar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao duplicar fluxo',
      error: error.message
    });
  }
});

/**
 * DELETE /api/flows/:id
 * Deletar fluxo
 */
router.delete('/:id', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    await flow.destroy();

    res.json({
      success: true,
      message: 'Fluxo deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar fluxo',
      error: error.message
    });
  }
});

/**
 * POST /api/flows/:id/test
 * Testar fluxo
 */
router.post('/:id/test', async (req, res) => {
  try {
    const flow = await Flow.findByPk(req.params.id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Fluxo não encontrado'
      });
    }

    // Validar estrutura
    const valid = flow.validateSteps();

    res.json({
      success: true,
      message: valid ? 'Fluxo válido' : 'Fluxo possui erros',
      data: {
        valid,
        steps: flow.steps.length,
        variables: Object.keys(flow.variables || {}).length
      }
    });

  } catch (error) {
    console.error('Erro ao testar fluxo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar fluxo',
      error: error.message
    });
  }
});

module.exports = router;
