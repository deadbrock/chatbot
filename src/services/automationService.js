const CampaignFlow = require('../models/CampaignFlowSQL');
const FlowExecution = require('../models/FlowExecutionSQL');
const FollowUp = require('../models/FollowUpSQL');
const Trigger = require('../models/TriggerSQL');
const Contact = require('../models/ContactSQL');
const Ticket = require('../models/TicketSQL');
const logger = require('../utils/logger');

/**
 * Serviço de Automação
 * Processa fluxos, follow-ups e gatilhos
 */

class AutomationService {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Inicializa o serviço de automação
   */
  async initialize() {
    logger.info('🤖 Inicializando Serviço de Automação...');
    
    // Processar fluxos pendentes a cada minuto
    setInterval(() => this.processFlowExecutions(), 60000);
    
    // Processar follow-ups a cada 5 minutos
    setInterval(() => this.processFollowUps(), 300000);
    
    logger.info('✅ Serviço de Automação inicializado');
  }

  /**
   * Dispara um gatilho baseado em um evento
   */
  async triggerEvent(eventType, eventData) {
    try {
      logger.info(`🎯 Evento disparado: ${eventType}`);
      
      // Buscar gatilhos ativos para este evento
      const triggers = await Trigger.findAll({
        where: {
          eventType,
          status: 'active'
        },
        order: [['priority', 'DESC']]
      });
      
      if (triggers.length === 0) {
        logger.debug(`Nenhum gatilho encontrado para evento: ${eventType}`);
        return;
      }
      
      // Processar cada gatilho
      for (const trigger of triggers) {
        await this.processTrigger(trigger, eventData);
      }
    } catch (error) {
      logger.error(`Erro ao processar evento ${eventType}:`, error);
    }
  }

  /**
   * Processa um gatilho específico
   */
  async processTrigger(trigger, eventData) {
    try {
      // Verificar condições
      const conditionsMet = this.evaluateConditions(
        trigger.conditions,
        trigger.conditionsOperator,
        eventData
      );
      
      if (!conditionsMet) {
        logger.debug(`Condições não atendidas para gatilho: ${trigger.name}`);
        return;
      }
      
      logger.info(`✨ Executando gatilho: ${trigger.name}`);
      
      // Executar ações
      for (const action of trigger.actions) {
        await this.executeAction(action, eventData, trigger);
      }
      
      // Atualizar estatísticas
      await trigger.update({
        stats: {
          ...trigger.stats,
          totalTriggered: (trigger.stats.totalTriggered || 0) + 1,
          totalExecuted: (trigger.stats.totalExecuted || 0) + 1
        },
        lastTriggeredAt: new Date(),
        lastExecutedAt: new Date()
      });
    } catch (error) {
      logger.error(`Erro ao processar gatilho ${trigger.name}:`, error);
      
      // Atualizar log de erro
      const errorLog = trigger.errorLog || [];
      errorLog.push({
        timestamp: new Date(),
        error: error.message,
        eventData
      });
      
      await trigger.update({
        errorLog: errorLog.slice(-50), // Manter últimos 50 erros
        stats: {
          ...trigger.stats,
          totalFailed: (trigger.stats.totalFailed || 0) + 1
        }
      });
    }
  }

  /**
   * Executa uma ação
   */
  async executeAction(action, eventData, trigger) {
    try {
      logger.debug(`Executando ação: ${action.type}`);
      
      switch (action.type) {
        case 'send_message':
          await this.sendMessage(action.config, eventData);
          break;
        
        case 'add_tag':
          await this.addTag(action.config, eventData);
          break;
        
        case 'remove_tag':
          await this.removeTag(action.config, eventData);
          break;
        
        case 'create_ticket':
          await this.createTicket(action.config, eventData);
          break;
        
        case 'change_status':
          await this.changeTicketStatus(action.config, eventData);
          break;
        
        case 'assign_to_agent':
          await this.assignToAgent(action.config, eventData);
          break;
        
        case 'start_flow':
          await this.startFlow(action.config, eventData);
          break;
        
        case 'webhook':
          await this.callWebhook(action.config, eventData);
          break;
        
        case 'send_email':
          await this.sendEmail(action.config, eventData);
          break;
        
        default:
          logger.warn(`Tipo de ação desconhecido: ${action.type}`);
      }
    } catch (error) {
      logger.error(`Erro ao executar ação ${action.type}:`, error);
      
      if (trigger.onErrorAction === 'stop') {
        throw error;
      }
      // Se for 'continue', apenas loga e segue
    }
  }

  /**
   * Avalia condições
   */
  evaluateConditions(conditions, operator, eventData) {
    if (!conditions || conditions.length === 0) return true;
    
    const results = conditions.map(condition => {
      const { field, operator: op, value } = condition;
      const fieldValue = this.getNestedValue(eventData, field);
      
      switch (op) {
        case 'equals':
          return fieldValue === value;
        case 'not_equals':
          return fieldValue !== value;
        case 'contains':
          return String(fieldValue).includes(value);
        case 'not_contains':
          return !String(fieldValue).includes(value);
        case 'greater_than':
          return Number(fieldValue) > Number(value);
        case 'less_than':
          return Number(fieldValue) < Number(value);
        case 'includes':
          return Array.isArray(fieldValue) && fieldValue.includes(value);
        default:
          return false;
      }
    });
    
    return operator === 'AND'
      ? results.every(r => r === true)
      : results.some(r => r === true);
  }

  /**
   * Processa execuções de fluxo pendentes
   */
  async processFlowExecutions() {
    try {
      logger.debug('⏰ Processando execuções de fluxo...');
      
      const executions = await FlowExecution.findAll({
        where: {
          status: 'waiting',
          nextExecutionAt: {
            [require('sequelize').Op.lte]: new Date()
          }
        },
        limit: 100
      });
      
      for (const execution of executions) {
        await this.processFlowExecution(execution);
      }
      
      if (executions.length > 0) {
        logger.info(`✅ Processadas ${executions.length} execuções de fluxo`);
      }
    } catch (error) {
      logger.error('Erro ao processar execuções de fluxo:', error);
    }
  }

  /**
   * Processa uma execução de fluxo específica
   */
  async processFlowExecution(execution) {
    try {
      const flow = await CampaignFlow.findByPk(execution.flowId);
      
      if (!flow || flow.status !== 'active') {
        await execution.update({ status: 'dropped', exitReason: 'flow_inactive' });
        return;
      }
      
      const contact = await Contact.findByPk(execution.contactId);
      
      if (!contact) {
        await execution.update({ status: 'failed', error: { message: 'Contact not found' } });
        return;
      }
      
      // Encontrar próxima etapa
      const currentStep = flow.steps.find(s => s.id === execution.currentStepId);
      
      if (!currentStep) {
        await execution.update({ status: 'completed', completedAt: new Date() });
        return;
      }
      
      // Executar etapa
      await this.executeFlowStep(execution, flow, currentStep, contact);
    } catch (error) {
      logger.error(`Erro ao processar execução ${execution.id}:`, error);
      
      await execution.update({
        status: 'failed',
        error: { message: error.message, timestamp: new Date() }
      });
    }
  }

  /**
   * Executa uma etapa do fluxo
   */
  async executeFlowStep(execution, flow, step, contact) {
    logger.debug(`Executando etapa ${step.id} do fluxo ${flow.name}`);
    
    switch (step.type) {
      case 'wait':
        // Agendar próxima execução
        const waitMs = this.calculateWaitTime(step.config.duration, step.config.unit);
        await execution.update({
          status: 'waiting',
          nextExecutionAt: new Date(Date.now() + waitMs)
        });
        break;
      
      case 'send_message':
        await this.sendFlowMessage(step.config, contact, execution);
        await this.moveToNextStep(execution, flow, step);
        break;
      
      case 'add_tag':
        await this.addTag({ tagId: step.config.tagId }, { contactId: contact.id });
        await this.moveToNextStep(execution, flow, step);
        break;
      
      case 'condition':
        const conditionMet = this.evaluateStepCondition(step.config, contact, execution);
        const nextStepId = conditionMet ? step.onTrue : step.onFalse;
        await execution.update({ currentStepId: nextStepId, status: 'running' });
        break;
      
      default:
        logger.warn(`Tipo de etapa desconhecido: ${step.type}`);
        await this.moveToNextStep(execution, flow, step);
    }
  }

  /**
   * Move para próxima etapa do fluxo
   */
  async moveToNextStep(execution, flow, currentStep) {
    const nextStepId = currentStep.nextStep;
    
    if (!nextStepId) {
      // Fim do fluxo
      await execution.update({
        status: 'completed',
        completedAt: new Date(),
        progress: 100
      });
      return;
    }
    
    // Calcular progresso
    const completedSteps = [...(execution.stepsCompleted || []), currentStep.id];
    const progress = (completedSteps.length / flow.steps.length) * 100;
    
    await execution.update({
      currentStepId: nextStepId,
      stepsCompleted: completedSteps,
      progress,
      status: 'running'
    });
  }

  /**
   * Processa follow-ups pendentes
   */
  async processFollowUps() {
    try {
      logger.debug('⏰ Processando follow-ups...');
      
      const followUps = await FollowUp.findAll({
        where: { status: 'active' }
      });
      
      for (const followUp of followUps) {
        await this.processFollowUp(followUp);
      }
    } catch (error) {
      logger.error('Erro ao processar follow-ups:', error);
    }
  }

  /**
   * Processa um follow-up específico
   */
  async processFollowUp(followUp) {
    try {
      // Buscar contatos elegíveis
      const contacts = await this.findEligibleContacts(followUp);
      
      if (contacts.length === 0) {
        logger.debug(`Nenhum contato elegível para follow-up: ${followUp.name}`);
        return;
      }
      
      logger.info(`📧 Enviando follow-up "${followUp.name}" para ${contacts.length} contatos`);
      
      for (const contact of contacts) {
        await this.sendFollowUpMessage(followUp, contact);
      }
      
      // Atualizar estatísticas
      await followUp.update({
        stats: {
          ...followUp.stats,
          totalSent: (followUp.stats.totalSent || 0) + contacts.length
        },
        lastExecutedAt: new Date()
      });
    } catch (error) {
      logger.error(`Erro ao processar follow-up ${followUp.name}:`, error);
    }
  }

  /**
   * Busca contatos elegíveis para um follow-up
   */
  async findEligibleContacts(followUp) {
    // TODO: Implementar lógica de busca baseada em trigger e filtros
    return [];
  }

  /**
   * Envia mensagem de follow-up
   */
  async sendFollowUpMessage(followUp, contact) {
    // TODO: Integrar com serviço de mensagens
    logger.debug(`Enviando follow-up para ${contact.phone}`);
  }

  /**
   * Envia mensagem do fluxo
   */
  async sendFlowMessage(config, contact, execution) {
    // TODO: Integrar com serviço de mensagens
    logger.debug(`Enviando mensagem do fluxo para ${contact.phone}`);
  }

  /**
   * Envia mensagem (ação de gatilho)
   */
  async sendMessage(config, eventData) {
    // TODO: Integrar com serviço de mensagens
    logger.debug('Enviando mensagem via gatilho');
  }

  /**
   * Adiciona tag
   */
  async addTag(config, eventData) {
    logger.debug('Adicionando tag');
    // TODO: Implementar
  }

  /**
   * Remove tag
   */
  async removeTag(config, eventData) {
    logger.debug('Removendo tag');
    // TODO: Implementar
  }

  /**
   * Cria ticket
   */
  async createTicket(config, eventData) {
    logger.debug('Criando ticket');
    // TODO: Implementar
  }

  /**
   * Altera status do ticket
   */
  async changeTicketStatus(config, eventData) {
    logger.debug('Alterando status do ticket');
    // TODO: Implementar
  }

  /**
   * Atribui a atendente
   */
  async assignToAgent(config, eventData) {
    logger.debug('Atribuindo a atendente');
    // TODO: Implementar
  }

  /**
   * Inicia fluxo
   */
  async startFlow(config, eventData) {
    logger.debug('Iniciando fluxo');
    // TODO: Implementar
  }

  /**
   * Chama webhook
   */
  async callWebhook(config, eventData) {
    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: config.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.body || eventData)
      });
      
      logger.debug(`Webhook chamado: ${config.url} - Status: ${response.status}`);
    } catch (error) {
      logger.error('Erro ao chamar webhook:', error);
      throw error;
    }
  }

  /**
   * Envia email
   */
  async sendEmail(config, eventData) {
    logger.debug('Enviando email');
    // TODO: Implementar integração com serviço de email
  }

  /**
   * Calcula tempo de espera em milissegundos
   */
  calculateWaitTime(duration, unit) {
    const multipliers = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000
    };
    return duration * (multipliers[unit] || multipliers.hours);
  }

  /**
   * Avalia condição de etapa
   */
  evaluateStepCondition(config, contact, execution) {
    // TODO: Implementar lógica de avaliação de condições
    return true;
  }

  /**
   * Busca valor aninhado em objeto
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Singleton
const automationService = new AutomationService();

module.exports = automationService;

