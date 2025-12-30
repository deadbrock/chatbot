/**
 * Gerenciador de Fluxo de Conversação
 * Processa mensagens e navega pelos fluxos definidos
 */

const logger = require('../../utils/logger');
const flows = require('../flows/flowDefinitions');
const UserSession = require('../../models/UserSessionSQL');
const scheduleService = require('./scheduleService');

class FlowManager {
  constructor() {
    this.flows = flows;
  }

  /**
   * Processa uma mensagem do usuário
   * @param {Object} session - Sessão do usuário
   * @param {string} userMessage - Mensagem enviada
   * @param {Object} whatsappClient - Cliente WhatsApp
   * @returns {Object} Resposta processada
   */
  async processMessage(session, userMessage, whatsappClient) {
    try {
      await session.updateLastInteraction();

      // Obter fluxo e passo atual
      const currentFlow = this.flows[session.currentFlow];
      
      if (!currentFlow) {
        logger.error(`Fluxo não encontrado: ${session.currentFlow}`);
        return this.handleError(session);
      }

      // Verificar se é um fluxo simples ou com steps
      if (currentFlow.steps) {
        return await this.processFlowSteps(session, currentFlow, userMessage, whatsappClient);
      } else {
        return await this.processSimpleFlow(session, currentFlow, userMessage, whatsappClient);
      }

    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
      return this.handleError(session);
    }
  }

  /**
   * Processa fluxo com steps
   */
  async processFlowSteps(session, flow, userMessage, whatsappClient) {
    const currentStep = flow.steps[session.currentStep];
    
    if (!currentStep) {
      logger.error(`Step não encontrado: ${session.currentStep} no fluxo ${flow.id}`);
      return this.handleError(session);
    }

    // Verificar action especial
    if (currentStep.action) {
      return await this.executeAction(currentStep.action, session, currentStep, whatsappClient);
    }

    // Verificar se está coletando dados
    if (currentStep.collect) {
      return await this.collectData(session, currentStep, userMessage);
    }

    // Verificar opções
    if (currentStep.options) {
      return await this.processOptions(session, currentStep, userMessage, whatsappClient);
    }

    // Mensagem simples com próximo passo
    if (currentStep.message) {
      const message = typeof currentStep.message === 'function' 
        ? currentStep.message(session.name)
        : currentStep.message;
      
      if (currentStep.next) {
        session.currentStep = currentStep.next;
        await session.save();
      }
      
      return { message, next: currentStep.next };
    }

    return this.handleError(session);
  }

  /**
   * Processa fluxo simples (menu)
   */
  async processSimpleFlow(session, flow, userMessage, whatsappClient) {
    const cleanMessage = userMessage.trim().toLowerCase();
    
    // Verificar se é uma opção válida
    if (flow.options && flow.options[userMessage.trim()]) {
      const option = flow.options[userMessage.trim()];
      
      // Adicionar ao caminho do menu
      await session.addToMenuPath({
        flow: flow.id,
        option: userMessage.trim(),
        label: option.label || ''
      });

      // Executar action se existir
      if (option.action) {
        return await this.executeAction(option.action, session, option, whatsappClient);
      }

      // Navegar para próximo fluxo
      if (option.next) {
        session.currentFlow = option.next;
        session.currentStep = 'start';
        await session.save();
        
        // Obter próximo fluxo
        const nextFlow = this.flows[option.next];
        if (nextFlow && nextFlow.message) {
          return { 
            message: nextFlow.message,
            next: option.next
          };
        }
        
        // Se próximo fluxo tem steps, processar primeiro step
        if (nextFlow && nextFlow.steps) {
          return await this.processFlowSteps(session, nextFlow, '', whatsappClient);
        }
      }
    }

    // Opção inválida
    return {
      message: '❌ Opção inválida. Por favor, escolha uma das opções do menu.',
      showMenu: true,
      currentFlow: flow
    };
  }

  /**
   * Coleta dados do usuário
   */
  async collectData(session, step, userMessage) {
    const formData = session.formData || {};
    
    if (Array.isArray(step.collect)) {
      // Coletar múltiplos dados
      const currentField = step.collect[0];
      formData[currentField] = userMessage;
      
      // Remover campo coletado
      step.collect.shift();
      
      if (step.collect.length > 0) {
        // Ainda há campos para coletar
        session.formData = formData;
        await session.save();
        
        return {
          message: step.messages ? step.messages[0] : `Por favor, informe ${step.collect[0]}`,
          collecting: true
        };
      } else {
        // Todos os campos coletados
        session.formData = formData;
        if (step.next) {
          session.currentStep = step.next;
        }
        await session.save();
        
        return {
          message: 'Dados coletados com sucesso!',
          next: step.next
        };
      }
    } else {
      // Coletar um único dado
      const fieldName = step.collect;
      
      // Validar se necessário
      if (step.validate && !step.validate(userMessage)) {
        return {
          message: step.errorMessage || 'Valor inválido. Tente novamente.',
          collecting: true
        };
      }
      
      formData[fieldName] = userMessage;
      
      // Salvar em campos específicos da sessão
      if (fieldName === 'name') session.name = userMessage;
      if (fieldName === 'email') session.email = userMessage;
      if (fieldName === 'cpf') session.cpf = userMessage;
      if (fieldName === 'company') session.company = userMessage;
      if (fieldName === 'contract') session.contract = userMessage;
      if (fieldName === 'nps_score') session.npsScore = parseInt(userMessage);
      
      session.formData = formData;
      
      if (step.next) {
        session.currentStep = step.next;
      }
      
      await session.save();
      
      return {
        message: step.successMessage || 'Obrigado!',
        next: step.next
      };
    }
  }

  /**
   * Processa opções de um menu
   */
  async processOptions(session, step, userMessage, whatsappClient) {
    const cleanMessage = userMessage.trim().toLowerCase();
    const option = step.options[userMessage.trim()] || 
                  step.options[cleanMessage] ||
                  Object.values(step.options).find(opt => 
                    opt.keywords && opt.keywords.includes(cleanMessage)
                  );
    
    if (!option) {
      return {
        message: '❌ Opção inválida. Por favor, escolha uma das opções do menu.',
        showMenu: true
      };
    }

    // Salvar valor se definido
    if (option.value && step.collect) {
      const formData = session.formData || {};
      formData[step.collect] = option.value;
      session.formData = formData;
    }

    // Executar action se existir
    if (option.action) {
      return await this.executeAction(option.action, session, option, whatsappClient);
    }

    // Navegar para próximo step/flow
    if (option.next) {
      // Verificar se é um fluxo ou step
      if (this.flows[option.next]) {
        session.currentFlow = option.next;
        session.currentStep = 'start';
      } else {
        session.currentStep = option.next;
      }
      await session.save();
    }

    return { success: true, next: option.next };
  }

  /**
   * Executa uma action especial
   */
  async executeAction(actionName, session, context, whatsappClient) {
    logger.info(`Executando action: ${actionName}`);

    switch (actionName) {
      case 'check_business_hours':
        return await this.checkBusinessHours(session);
      
      case 'collect_client_data':
        return await this.collectClientData(session);
      
      case 'collect_prospect_data':
        return await this.collectProspectData(session);
      
      case 'send_job_link':
        return await this.sendJobLink(session);
      
      case 'transfer_to_agent':
        return await this.transferToAgent(session, context.department);
      
      case 'transfer_to_human':
        return await this.transferToHuman(session);
      
      case 'close_session':
        return await this.closeSession(session);
      
      default:
        logger.warn(`Action não implementada: ${actionName}`);
        return { message: 'Processando sua solicitação...' };
    }
  }

  /**
   * Verifica horário de atendimento
   */
  async checkBusinessHours(session) {
    const schedule = scheduleService.isBusinessHours();
    
    if (schedule.isOpen) {
      session.currentStep = 'welcome_message';
      await session.save();
      return {
        success: true,
        isOpen: true,
        next: 'welcome_message'
      };
    } else {
      session.currentStep = 'out_of_hours_message';
      await session.save();
      
      const nextOpenFormatted = scheduleService.formatNextOpen(schedule.nextOpen);
      
      return {
        success: false,
        isOpen: false,
        message: schedule.message,
        nextOpen: nextOpenFormatted,
        next: 'out_of_hours_message'
      };
    }
  }

  /**
   * Coleta dados do cliente
   */
  async collectClientData(session) {
    session.currentFlow = 'client_flow';
    session.currentStep = 'collect_data';
    await session.save();
    
    return {
      message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\n📝 Nome\n📞 Telefone\n📧 Email\n🏢 Qual contrato',
      collecting: true
    };
  }

  /**
   * Coleta dados do prospect
   */
  async collectProspectData(session) {
    session.currentFlow = 'prospect_flow';
    session.currentStep = 'collect_data';
    await session.save();
    
    return {
      message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\n📝 Nome\n📞 Telefone\n📧 Email\n📍 Qual seu estado?',
      collecting: true
    };
  }

  /**
   * Envia link de trabalhe conosco
   */
  async sendJobLink(session) {
    const message = `🎯 *TRABALHE CONOSCO*\n\nConheça a FG Services e candidate-se às nossas vagas:\n\n🔗 https://trabalhe-conosco.vercel.app/#nossa-historia\n\nBoa sorte! 🍀`;
    
    // Voltar ao menu principal
    session.currentFlow = 'main_menu';
    session.currentStep = 'start';
    await session.save();
    
    return {
      message,
      showMainMenu: true
    };
  }

  /**
   * Transfere para atendente humano
   */
  async transferToAgent(session, department) {
    session.needsHumanAgent = true;
    session.currentFlow = 'wait_for_agent';
    session.currentStep = 'waiting';
    
    // Salvar departamento no formData
    const formData = session.formData || {};
    formData.department = department;
    session.formData = formData;
    
    await session.save();
    
    logger.info(`Transferindo sessão ${session.id} para departamento: ${department}`);
    
    return {
      message: `Aguarde que nosso time de *${department}* já vai te atender 😊`,
      transferToAgent: true,
      department
    };
  }

  /**
   * Transfere para humano (genérico)
   */
  async transferToHuman(session) {
    session.needsHumanAgent = true;
    session.currentFlow = 'agent_conversation';
    await session.save();
    
    return {
      message: 'Aguarde que nosso time já vai te atender 😊',
      transferToAgent: true
    };
  }

  /**
   * Encerra sessão
   */
  async closeSession(session) {
    session.isActive = false;
    await session.save();
    
    return {
      message: '✨ Sessão encerrada. Até breve!',
      closed: true
    };
  }

  /**
   * Trata erros
   */
  handleError(session) {
    return {
      message: '⚠️ Desculpe, ocorreu um erro. Vou te redirecionar ao menu principal.',
      error: true,
      resetToMainMenu: true
    };
  }

  /**
   * Obtém mensagem de boas-vindas
   */
  getWelcomeMessage(session) {
    const name = session.name ? session.name : '';
    return `Olá ${name} 😊, seja bem vindo(a) ao atendimento da *FG SERVICES*\n_Excelência para quem faz com excelência_`;
  }

  /**
   * Obtém menu principal
   */
  getMainMenu() {
    return this.flows.main_menu.message;
  }
}

module.exports = new FlowManager();

