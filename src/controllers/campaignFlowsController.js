const CampaignFlow = require('../models/CampaignFlowSQL');
const FlowExecution = require('../models/FlowExecutionSQL');
const { sendSuccess, sendError, badRequest, notFound } = require('../utils/http');
const { Op } = require('sequelize');

/**
 * Controller de Fluxos de Campanha
 */

// Listar todos os fluxos
exports.listFlows = async (req, res) => {
  try {
    const { status, campaignId, search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: flows } = await CampaignFlow.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    sendSuccess(res, {
      flows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar fluxos:', error);
    sendError(res, error);
  }
};

// Buscar fluxo por ID
exports.getFlow = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Buscar estatísticas de execução
    const executions = await FlowExecution.count({
      where: { flowId: id }
    });
    
    const activeExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'running' }
    });
    
    sendSuccess(res, {
      flow,
      executions: {
        total: executions,
        active: activeExecutions
      }
    });
  } catch (error) {
    console.error('Erro ao buscar fluxo:', error);
    sendError(res, error);
  }
};

// Criar novo fluxo
exports.createFlow = async (req, res) => {
  try {
    const {
      name,
      description,
      campaignId,
      trigger,
      steps,
      executionMode,
      maxExecutions,
      startDate,
      endDate,
      targetFilters,
      allowReentry,
      exitOnReply,
      exitConditions,
      abTestEnabled,
      abTestConfig,
      notifications
    } = req.body;
    
    if (!name || !trigger || !steps || !Array.isArray(steps)) {
      return badRequest(res, 'Nome, gatilho e etapas são obrigatórios');
    }
    
    // Validar estrutura das etapas
    for (const step of steps) {
      if (!step.id || !step.type) {
        return badRequest(res, 'Cada etapa deve ter id e type');
      }
    }
    
    const flow = await CampaignFlow.create({
      name,
      description,
      campaignId,
      trigger,
      steps,
      executionMode: executionMode || 'sequential',
      maxExecutions: maxExecutions || 0,
      startDate,
      endDate,
      targetFilters: targetFilters || {},
      allowReentry: allowReentry || false,
      exitOnReply: exitOnReply || false,
      exitConditions: exitConditions || [],
      abTestEnabled: abTestEnabled || false,
      abTestConfig,
      notifications: notifications || {},
      createdBy: req.user?.id
    });
    
    sendSuccess(res, flow, 'Fluxo criado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao criar fluxo:', error);
    sendError(res, error);
  }
};

// Atualizar fluxo
exports.updateFlow = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Validar etapas se forem atualizadas
    if (updates.steps && Array.isArray(updates.steps)) {
      for (const step of updates.steps) {
        if (!step.id || !step.type) {
          return badRequest(res, 'Cada etapa deve ter id e type');
        }
      }
    }
    
    updates.updatedBy = req.user?.id;
    
    await flow.update(updates);
    
    sendSuccess(res, flow, 'Fluxo atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error);
    sendError(res, error);
  }
};

// Deletar fluxo
exports.deleteFlow = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Verificar se há execuções ativas
    const activeExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'running' }
    });
    
    if (activeExecutions > 0) {
      return badRequest(res, 'Não é possível deletar fluxo com execuções ativas');
    }
    
    await flow.destroy();
    
    sendSuccess(res, null, 'Fluxo deletado com sucesso');
  } catch (error) {
    console.error('Erro ao deletar fluxo:', error);
    sendError(res, error);
  }
};

// Ativar/Pausar fluxo
exports.toggleFlowStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'paused', 'draft', 'completed', 'archived'].includes(status)) {
      return badRequest(res, 'Status inválido');
    }
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    await flow.update({ 
      status,
      updatedBy: req.user?.id 
    });
    
    sendSuccess(res, flow, `Fluxo ${status === 'active' ? 'ativado' : 'pausado'} com sucesso`);
  } catch (error) {
    console.error('Erro ao alterar status do fluxo:', error);
    sendError(res, error);
  }
};

// Duplicar fluxo
exports.duplicateFlow = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    const flowData = flow.toJSON();
    delete flowData.id;
    delete flowData.createdAt;
    delete flowData.updatedAt;
    
    const newFlow = await CampaignFlow.create({
      ...flowData,
      name: `${flowData.name} (Cópia)`,
      status: 'draft',
      currentExecutions: 0,
      stats: {
        totalEntered: 0,
        totalCompleted: 0,
        totalDropped: 0,
        avgCompletionTime: 0,
        conversionRate: 0
      },
      executionLog: [],
      errorLog: [],
      createdBy: req.user?.id
    });
    
    sendSuccess(res, newFlow, 'Fluxo duplicado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao duplicar fluxo:', error);
    sendError(res, error);
  }
};

// Buscar execuções de um fluxo
exports.getFlowExecutions = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    
    const where = { flowId: id };
    if (status) where.status = status;
    
    const offset = (page - 1) * limit;
    
    const { count, rows: executions } = await FlowExecution.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    sendSuccess(res, {
      executions,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar execuções:', error);
    sendError(res, error);
  }
};

// Estatísticas do fluxo
exports.getFlowStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Estatísticas de execução
    const totalExecutions = await FlowExecution.count({
      where: { flowId: id }
    });
    
    const completedExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'completed' }
    });
    
    const failedExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'failed' }
    });
    
    const runningExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'running' }
    });
    
    const droppedExecutions = await FlowExecution.count({
      where: { flowId: id, status: 'dropped' }
    });
    
    // Conversões
    const conversions = await FlowExecution.count({
      where: { flowId: id, conversionAchieved: true }
    });
    
    // Tempo médio de conclusão
    const avgDuration = await FlowExecution.findOne({
      where: { flowId: id, status: 'completed' },
      attributes: [
        [require('sequelize').fn('AVG', require('sequelize').col('totalDuration')), 'avg']
      ],
      raw: true
    });
    
    const stats = {
      total: totalExecutions,
      completed: completedExecutions,
      failed: failedExecutions,
      running: runningExecutions,
      dropped: droppedExecutions,
      conversions,
      completionRate: totalExecutions > 0 ? (completedExecutions / totalExecutions * 100).toFixed(2) : 0,
      conversionRate: totalExecutions > 0 ? (conversions / totalExecutions * 100).toFixed(2) : 0,
      avgDuration: avgDuration?.avg || 0
    };
    
    sendSuccess(res, stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    sendError(res, error);
  }
};

// Testar fluxo (modo dry-run)
exports.testFlow = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactId, variables } = req.body;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    // Simular execução sem realmente executar
    const testResult = {
      flowId: id,
      contactId,
      variables: variables || {},
      steps: [],
      estimatedDuration: 0
    };
    
    let currentStepId = flow.steps[0]?.id;
    let stepIndex = 0;
    
    while (currentStepId && stepIndex < 100) { // Limite de segurança
      const step = flow.steps.find(s => s.id === currentStepId);
      
      if (!step) break;
      
      testResult.steps.push({
        stepId: step.id,
        type: step.type,
        config: step.config,
        willExecute: true
      });
      
      // Simular tempo de espera
      if (step.type === 'wait') {
        const duration = step.config.duration || 0;
        const unit = step.config.unit || 'hours';
        const multiplier = { minutes: 60, hours: 3600, days: 86400, weeks: 604800 };
        testResult.estimatedDuration += duration * (multiplier[unit] || 3600);
      }
      
      currentStepId = step.nextStep;
      stepIndex++;
    }
    
    sendSuccess(res, testResult, 'Teste de fluxo concluído');
  } catch (error) {
    console.error('Erro ao testar fluxo:', error);
    sendError(res, error);
  }
};

// Exportar fluxo
exports.exportFlow = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flow = await CampaignFlow.findByPk(id);
    
    if (!flow) {
      return notFound(res, 'Fluxo não encontrado');
    }
    
    const exportData = {
      version: '1.0',
      exportedAt: new Date(),
      flow: {
        name: flow.name,
        description: flow.description,
        trigger: flow.trigger,
        steps: flow.steps,
        executionMode: flow.executionMode,
        targetFilters: flow.targetFilters,
        allowReentry: flow.allowReentry,
        exitOnReply: flow.exitOnReply,
        exitConditions: flow.exitConditions,
        abTestEnabled: flow.abTestEnabled,
        abTestConfig: flow.abTestConfig,
        notifications: flow.notifications
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=flow-${id}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Erro ao exportar fluxo:', error);
    sendError(res, error);
  }
};

// Importar fluxo
exports.importFlow = async (req, res) => {
  try {
    const { flowData } = req.body;
    
    if (!flowData || !flowData.flow) {
      return badRequest(res, 'Dados do fluxo inválidos');
    }
    
    const flow = await CampaignFlow.create({
      ...flowData.flow,
      status: 'draft',
      currentExecutions: 0,
      stats: {
        totalEntered: 0,
        totalCompleted: 0,
        totalDropped: 0,
        avgCompletionTime: 0,
        conversionRate: 0
      },
      executionLog: [],
      errorLog: [],
      createdBy: req.user?.id
    });
    
    sendSuccess(res, flow, 'Fluxo importado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao importar fluxo:', error);
    sendError(res, error);
  }
};

module.exports = exports;

