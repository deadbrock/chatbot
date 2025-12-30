const logger = require('../utils/logger');
const Flow = require('../models/FlowSQL');
const MessageTemplate = require('../models/MessageTemplateSQL');
const SessionManager = require('./sessionManager');

/**
 * Engine para executar fluxos de conversa personalizados
 */
class FlowEngine {
  constructor() {
    this.sessionManager = new SessionManager();
  }

  /**
   * Verificar se existe fluxo para o trigger
   */
  async findFlow(trigger, type = 'keyword') {
    try {
      const flow = await Flow.findByTrigger(trigger, type);
      return flow;
    } catch (error) {
      logger.error('Erro ao buscar fluxo:', error);
      return null;
    }
  }

  /**
   * Iniciar execução de um fluxo
   */
  async startFlow(flowId, userId, context = {}) {
    try {
      const flow = await Flow.findByPk(flowId);
      if (!flow || flow.status !== 'active') {
        throw new Error('Fluxo não encontrado ou inativo');
      }

      // Validar estrutura
      if (!flow.validateSteps()) {
        throw new Error('Fluxo possui estrutura inválida');
      }

      // Inicializar contexto do fluxo na sessão
      await this.sessionManager.updateSession(userId, {
        currentFlow: flowId,
        flowContext: {
          flowId: flow.id,
          flowName: flow.name,
          currentStepIndex: 0,
          variables: { ...flow.variables, ...context },
          history: [],
          startedAt: new Date()
        }
      });

      // Executar primeiro step
      return await this.executeStep(userId, 0);

    } catch (error) {
      logger.error('Erro ao iniciar fluxo:', error);
      throw error;
    }
  }

  /**
   * Executar um step específico do fluxo
   */
  async executeStep(userId, stepIndex) {
    try {
      const session = await this.sessionManager.getSession(userId);
      if (!session || !session.flowContext) {
        throw new Error('Sessão ou contexto de fluxo não encontrado');
      }

      const flow = await Flow.findByPk(session.flowContext.flowId);
      if (!flow) {
        throw new Error('Fluxo não encontrado');
      }

      const step = flow.steps[stepIndex];
      if (!step) {
        // Fluxo terminou
        return await this.endFlow(userId, 'completed');
      }

      // Adicionar ao histórico
      session.flowContext.history.push({
        stepId: step.id,
        stepType: step.type,
        timestamp: new Date()
      });

      // Processar step conforme tipo
      const result = await this.processStep(step, session.flowContext.variables);

      // Atualizar contexto
      session.flowContext.currentStepIndex = stepIndex;
      session.flowContext.lastStepResult = result;
      
      await this.sessionManager.updateSession(userId, {
        flowContext: session.flowContext
      });

      return result;

    } catch (error) {
      logger.error('Erro ao executar step:', error);
      throw error;
    }
  }

  /**
   * Processar um step conforme seu tipo
   */
  async processStep(step, variables) {
    switch (step.type) {
      case 'message':
        return await this.processMessageStep(step, variables);
      
      case 'question':
        return await this.processQuestionStep(step, variables);
      
      case 'options':
        return await this.processOptionsStep(step, variables);
      
      case 'collect':
        return await this.processCollectStep(step, variables);
      
      case 'condition':
        return await this.processConditionStep(step, variables);
      
      case 'action':
        return await this.processActionStep(step, variables);
      
      default:
        logger.warn(`Tipo de step desconhecido: ${step.type}`);
        return { type: 'error', message: 'Tipo de step não suportado' };
    }
  }

  /**
   * Step tipo: message (enviar mensagem)
   */
  async processMessageStep(step, variables) {
    let content = step.content || '';

    // Se tem template, buscar e renderizar
    if (step.templateId) {
      const template = await MessageTemplate.findByPk(step.templateId);
      if (template) {
        content = template.render(variables);
        await template.incrementUsage();
      }
    }

    // Substituir variáveis manualmente
    content = this.replaceVariables(content, variables);

    return {
      type: 'message',
      content,
      delay: step.delay || 0,
      next: step.next || 'auto'
    };
  }

  /**
   * Step tipo: question (fazer pergunta e aguardar resposta)
   */
  async processQuestionStep(step, variables) {
    const question = this.replaceVariables(step.question || '', variables);

    return {
      type: 'question',
      question,
      variableName: step.saveAs || 'response',
      validation: step.validation || null,
      next: step.next || 'auto'
    };
  }

  /**
   * Step tipo: options (menu de opções)
   */
  async processOptionsStep(step, variables) {
    const message = this.replaceVariables(step.message || '', variables);
    
    const options = (step.options || []).map((opt, index) => ({
      number: index + 1,
      label: this.replaceVariables(opt.label, variables),
      value: opt.value,
      next: opt.next
    }));

    const optionsText = options.map(opt => `*${opt.number}.* ${opt.label}`).join('\n');

    return {
      type: 'options',
      message: `${message}\n\n${optionsText}`,
      options,
      next: step.next || 'conditional'
    };
  }

  /**
   * Step tipo: collect (coletar dado do usuário)
   */
  async processCollectStep(step, variables) {
    const prompt = this.replaceVariables(step.prompt || 'Por favor, envie a informação:', variables);

    return {
      type: 'collect',
      prompt,
      variableName: step.saveAs || 'collected',
      dataType: step.dataType || 'text', // text, number, email, phone, date
      validation: step.validation || null,
      next: step.next || 'auto'
    };
  }

  /**
   * Step tipo: condition (decisão condicional)
   */
  async processConditionStep(step, variables) {
    const condition = step.condition || {};
    
    // Avaliar condição
    const result = this.evaluateCondition(condition, variables);

    return {
      type: 'condition',
      result,
      next: result ? step.nextIfTrue : step.nextIfFalse
    };
  }

  /**
   * Step tipo: action (executar ação)
   */
  async processActionStep(step, variables) {
    const action = step.action || 'none';

    // Executar ações específicas
    switch (action) {
      case 'create_ticket':
        // Criar ticket com dados coletados
        break;
      
      case 'transfer_department':
        // Transferir para departamento
        break;
      
      case 'send_email':
        // Enviar email
        break;
      
      case 'save_data':
        // Salvar dados no banco
        break;
      
      case 'call_webhook':
        // Chamar webhook externo
        break;
    }

    return {
      type: 'action',
      action,
      executed: true,
      next: step.next || 'auto'
    };
  }

  /**
   * Processar resposta do usuário no fluxo
   */
  async processUserResponse(userId, userInput) {
    try {
      const session = await this.sessionManager.getSession(userId);
      if (!session || !session.flowContext) {
        return null;
      }

      const flow = await Flow.findByPk(session.flowContext.flowId);
      if (!flow) {
        return null;
      }

      const currentStep = flow.steps[session.flowContext.currentStepIndex];
      const lastResult = session.flowContext.lastStepResult;

      // Processar resposta conforme tipo do step
      if (lastResult.type === 'question' || lastResult.type === 'collect') {
        // Salvar resposta nas variáveis
        const varName = lastResult.variableName;
        session.flowContext.variables[varName] = userInput;

        // Validar se necessário
        if (lastResult.validation) {
          const valid = this.validateInput(userInput, lastResult.validation);
          if (!valid) {
            return {
              type: 'validation_error',
              message: lastResult.validation.errorMessage || 'Entrada inválida. Tente novamente.'
            };
          }
        }

        // Próximo step
        const nextIndex = this.getNextStepIndex(currentStep, lastResult, userInput);
        return await this.executeStep(userId, nextIndex);
      }

      if (lastResult.type === 'options') {
        // Processar opção escolhida
        const chosenOption = lastResult.options.find(opt => 
          opt.number === parseInt(userInput) || 
          opt.value === userInput
        );

        if (!chosenOption) {
          return {
            type: 'validation_error',
            message: '❌ Opção inválida. Por favor, escolha um número da lista.'
          };
        }

        // Salvar opção escolhida
        session.flowContext.variables.lastOption = chosenOption.value;

        // Ir para próximo step (específico da opção ou padrão)
        const nextStepId = chosenOption.next || currentStep.next;
        const nextIndex = this.findStepIndexById(flow.steps, nextStepId);
        
        return await this.executeStep(userId, nextIndex);
      }

      return null;

    } catch (error) {
      logger.error('Erro ao processar resposta do usuário no fluxo:', error);
      return {
        type: 'error',
        message: 'Erro ao processar resposta. Por favor, tente novamente.'
      };
    }
  }

  /**
   * Finalizar fluxo
   */
  async endFlow(userId, reason = 'completed') {
    try {
      const session = await this.sessionManager.getSession(userId);
      if (session && session.flowContext) {
        const duration = new Date() - new Date(session.flowContext.startedAt);
        
        logger.info(`Fluxo finalizado: ${session.flowContext.flowName} (${reason}) - ${duration}ms`);

        // Limpar contexto
        await this.sessionManager.updateSession(userId, {
          currentFlow: null,
          flowContext: null
        });
      }

      return {
        type: 'flow_ended',
        reason,
        message: reason === 'completed' 
          ? '✅ Fluxo concluído com sucesso!'
          : '❌ Fluxo interrompido.'
      };

    } catch (error) {
      logger.error('Erro ao finalizar fluxo:', error);
    }
  }

  /**
   * Helpers
   */

  replaceVariables(text, variables) {
    if (!text) return '';
    
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    
    return result;
  }

  evaluateCondition(condition, variables) {
    const { variable, operator, value } = condition;
    const varValue = variables[variable];

    switch (operator) {
      case 'equals':
        return varValue == value;
      case 'not_equals':
        return varValue != value;
      case 'contains':
        return String(varValue).includes(value);
      case 'greater_than':
        return Number(varValue) > Number(value);
      case 'less_than':
        return Number(varValue) < Number(value);
      case 'exists':
        return varValue !== undefined && varValue !== null;
      default:
        return false;
    }
  }

  validateInput(input, validation) {
    const { type, pattern, min, max } = validation;

    switch (type) {
      case 'number':
        const num = Number(input);
        if (isNaN(num)) return false;
        if (min !== undefined && num < min) return false;
        if (max !== undefined && num > max) return false;
        return true;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);

      case 'phone':
        const phoneRegex = /^\+?[\d\s()-]{10,}$/;
        return phoneRegex.test(input);

      case 'regex':
        if (pattern) {
          return new RegExp(pattern).test(input);
        }
        return true;

      default:
        return true;
    }
  }

  getNextStepIndex(currentStep, lastResult, userInput) {
    // Se tem next específico, usar
    if (lastResult.next && lastResult.next !== 'auto') {
      return this.findStepIndexById(currentStep, lastResult.next);
    }

    // Próximo sequencial
    return (currentStep.index || 0) + 1;
  }

  findStepIndexById(steps, stepId) {
    const index = steps.findIndex(s => s.id === stepId);
    return index >= 0 ? index : 0;
  }
}

module.exports = new FlowEngine();

