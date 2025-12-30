const Trigger = require('../models/TriggerSQL');
const { sendSuccess, sendError, badRequest, notFound } = require('../utils/http');
const { Op } = require('sequelize');

/**
 * Controller de Gatilhos e Ações (Triggers)
 */

// Listar todos os gatilhos
exports.listTriggers = async (req, res) => {
  try {
    const { eventType, status, search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    
    if (eventType) where.eventType = eventType;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: triggers } = await Trigger.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });
    
    sendSuccess(res, {
      triggers,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar gatilhos:', error);
    sendError(res, error);
  }
};

// Buscar gatilho por ID
exports.getTrigger = async (req, res) => {
  try {
    const { id } = req.params;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    sendSuccess(res, trigger);
  } catch (error) {
    console.error('Erro ao buscar gatilho:', error);
    sendError(res, error);
  }
};

// Criar novo gatilho
exports.createTrigger = async (req, res) => {
  try {
    const {
      name,
      description,
      eventType,
      conditions,
      conditionsOperator,
      actions,
      executionMode,
      executionDelay,
      executionSchedule,
      maxExecutionsPerContact,
      cooldownPeriod,
      targetFilters,
      excludeFilters,
      priority,
      onErrorAction,
      maxRetries,
      notifyOnExecution,
      notifyOnError,
      notifyEmails,
      testMode,
      debugEnabled
    } = req.body;
    
    if (!name || !eventType || !actions || !Array.isArray(actions)) {
      return badRequest(res, 'Nome, tipo de evento e ações são obrigatórios');
    }
    
    // Validar estrutura das ações
    for (const action of actions) {
      if (!action.type || !action.config) {
        return badRequest(res, 'Cada ação deve ter type e config');
      }
    }
    
    const trigger = await Trigger.create({
      name,
      description,
      eventType,
      conditions: conditions || [],
      conditionsOperator: conditionsOperator || 'AND',
      actions,
      executionMode: executionMode || 'immediate',
      executionDelay: executionDelay || 0,
      executionSchedule,
      maxExecutionsPerContact: maxExecutionsPerContact || 0,
      cooldownPeriod: cooldownPeriod || 0,
      targetFilters: targetFilters || {},
      excludeFilters: excludeFilters || {},
      priority: priority || 0,
      onErrorAction: onErrorAction || 'stop',
      maxRetries: maxRetries || 3,
      notifyOnExecution: notifyOnExecution || false,
      notifyOnError: notifyOnError !== false,
      notifyEmails: notifyEmails || [],
      testMode: testMode || false,
      debugEnabled: debugEnabled || false,
      createdBy: req.user?.id
    });
    
    sendSuccess(res, trigger, 'Gatilho criado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao criar gatilho:', error);
    sendError(res, error);
  }
};

// Atualizar gatilho
exports.updateTrigger = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    // Validar ações se forem atualizadas
    if (updates.actions && Array.isArray(updates.actions)) {
      for (const action of updates.actions) {
        if (!action.type || !action.config) {
          return badRequest(res, 'Cada ação deve ter type e config');
        }
      }
    }
    
    updates.updatedBy = req.user?.id;
    
    await trigger.update(updates);
    
    sendSuccess(res, trigger, 'Gatilho atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar gatilho:', error);
    sendError(res, error);
  }
};

// Deletar gatilho
exports.deleteTrigger = async (req, res) => {
  try {
    const { id } = req.params;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    await trigger.destroy();
    
    sendSuccess(res, null, 'Gatilho deletado com sucesso');
  } catch (error) {
    console.error('Erro ao deletar gatilho:', error);
    sendError(res, error);
  }
};

// Ativar/Pausar gatilho
exports.toggleTriggerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'paused', 'archived'].includes(status)) {
      return badRequest(res, 'Status inválido');
    }
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    await trigger.update({ 
      status,
      updatedBy: req.user?.id 
    });
    
    sendSuccess(res, trigger, `Gatilho ${status === 'active' ? 'ativado' : 'pausado'} com sucesso`);
  } catch (error) {
    console.error('Erro ao alterar status do gatilho:', error);
    sendError(res, error);
  }
};

// Duplicar gatilho
exports.duplicateTrigger = async (req, res) => {
  try {
    const { id } = req.params;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    const triggerData = trigger.toJSON();
    delete triggerData.id;
    delete triggerData.createdAt;
    delete triggerData.updatedAt;
    
    const newTrigger = await Trigger.create({
      ...triggerData,
      name: `${triggerData.name} (Cópia)`,
      status: 'paused',
      stats: {
        totalTriggered: 0,
        totalExecuted: 0,
        totalFailed: 0,
        successRate: 0,
        avgExecutionTime: 0
      },
      executionLog: [],
      errorLog: [],
      createdBy: req.user?.id
    });
    
    sendSuccess(res, newTrigger, 'Gatilho duplicado com sucesso', 201);
  } catch (error) {
    console.error('Erro ao duplicar gatilho:', error);
    sendError(res, error);
  }
};

// Estatísticas do gatilho
exports.getTriggerStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    sendSuccess(res, trigger.stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    sendError(res, error);
  }
};

// Testar gatilho
exports.testTrigger = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventData } = req.body;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    // Simular verificação de condições
    const conditionsResult = evaluateConditions(trigger.conditions, trigger.conditionsOperator, eventData);
    
    // Simular execução de ações
    const actionsResult = trigger.actions.map(action => ({
      type: action.type,
      config: action.config,
      willExecute: conditionsResult,
      testMode: true
    }));
    
    const testResult = {
      triggerId: id,
      conditionsMet: conditionsResult,
      actions: actionsResult,
      executionMode: trigger.executionMode,
      executionDelay: trigger.executionDelay,
      testMode: true
    };
    
    sendSuccess(res, testResult, 'Teste de gatilho concluído');
  } catch (error) {
    console.error('Erro ao testar gatilho:', error);
    sendError(res, error);
  }
};

// Limpar logs do gatilho
exports.clearTriggerLogs = async (req, res) => {
  try {
    const { id } = req.params;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    await trigger.update({
      executionLog: [],
      errorLog: [],
      updatedBy: req.user?.id
    });
    
    sendSuccess(res, null, 'Logs limpos com sucesso');
  } catch (error) {
    console.error('Erro ao limpar logs:', error);
    sendError(res, error);
  }
};

// Executar gatilho manualmente
exports.executeTriggerManually = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventData } = req.body;
    
    const trigger = await Trigger.findByPk(id);
    
    if (!trigger) {
      return notFound(res, 'Gatilho não encontrado');
    }
    
    if (trigger.status !== 'active') {
      return badRequest(res, 'Gatilho não está ativo');
    }
    
    // Verificar condições
    const conditionsMet = evaluateConditions(trigger.conditions, trigger.conditionsOperator, eventData);
    
    if (!conditionsMet) {
      return badRequest(res, 'Condições do gatilho não foram atendidas');
    }
    
    // Aqui você integraria com o sistema de execução de ações
    // Por enquanto, apenas simulamos
    
    const executionResult = {
      triggerId: id,
      executedAt: new Date(),
      conditionsMet: true,
      actionsExecuted: trigger.actions.length,
      success: true
    };
    
    // Atualizar estatísticas
    await trigger.update({
      stats: {
        ...trigger.stats,
        totalTriggered: trigger.stats.totalTriggered + 1,
        totalExecuted: trigger.stats.totalExecuted + 1
      },
      lastTriggeredAt: new Date(),
      lastExecutedAt: new Date()
    });
    
    sendSuccess(res, executionResult, 'Gatilho executado com sucesso');
  } catch (error) {
    console.error('Erro ao executar gatilho:', error);
    sendError(res, error);
  }
};

// Buscar gatilhos por tipo de evento
exports.getTriggersByEvent = async (req, res) => {
  try {
    const { eventType } = req.params;
    
    const triggers = await Trigger.findAll({
      where: { 
        eventType,
        status: 'active'
      },
      order: [['priority', 'DESC']]
    });
    
    sendSuccess(res, triggers);
  } catch (error) {
    console.error('Erro ao buscar gatilhos por evento:', error);
    sendError(res, error);
  }
};

// Helper: Avaliar condições
function evaluateConditions(conditions, operator, eventData) {
  if (!conditions || conditions.length === 0) return true;
  
  const results = conditions.map(condition => {
    const { field, operator: op, value } = condition;
    const fieldValue = getNestedValue(eventData, field);
    
    switch (op) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(value);
      case 'not_contains':
        return !String(fieldValue).includes(value);
      case 'starts_with':
        return String(fieldValue).startsWith(value);
      case 'ends_with':
        return String(fieldValue).endsWith(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'includes':
        return Array.isArray(fieldValue) && fieldValue.includes(value);
      case 'not_includes':
        return Array.isArray(fieldValue) && !fieldValue.includes(value);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return false;
    }
  });
  
  return operator === 'AND' 
    ? results.every(r => r === true)
    : results.some(r => r === true);
}

// Helper: Buscar valor aninhado em objeto
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

module.exports = exports;

