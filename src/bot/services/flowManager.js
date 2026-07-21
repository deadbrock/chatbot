/**
 * Gerenciador de Fluxo de Conversação
 * Processa mensagens e navega pelos fluxos definidos
 */

const logger = require('../../utils/logger');
const { getFlowDefinitions } = require('../flows/getFlowDefinitions');
const UserSession = require('../../models/UserSessionSQL');
const scheduleService = require('./scheduleService');

class FlowManager {
  constructor() {
    // carregar definições efetivas (base + override). Atualizamos também por mensagem.
    this.flows = getFlowDefinitions().effective;
  }

  /**
   * Primeiro step de um fluxo com steps (muitos fluxos não usam 'start')
   */
  resolveInitialStep(flow) {
    if (!flow?.steps) return 'start';
    if (flow.steps.start) return 'start';
    return Object.keys(flow.steps)[0];
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
      // Recarregar (permite editar via UI sem restart)
      this.flows = getFlowDefinitions().effective;
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
        const nextFlow = this.flows[option.next];
        session.currentStep = this.resolveInitialStep(nextFlow);
        await session.save();

        if (nextFlow?.steps) {
          return await this.processFlowSteps(session, nextFlow, '', whatsappClient);
        }

        if (nextFlow?.message) {
          return {
            message: nextFlow.message,
            next: option.next
          };
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
      // Rastrear progresso da coleta (NÃO modificar o step original!)
      let collectionIndex = session.collectionIndex || 0;
      
      // Coletar o dado atual
      const currentField = step.collect[collectionIndex];
      formData[currentField] = userMessage;
      
      // Salvar dados específicos na sessão
      if (currentField === 'name') session.name = userMessage;
      if (currentField === 'email') session.email = userMessage;
      // IMPORTANTE: não sobrescrever `session.phone` (identificador único da sessão = WhatsApp).
      // O telefone informado pelo usuário deve ficar apenas em `formData.phone`.
      if (currentField === 'cpf') session.cpf = userMessage;
      if (currentField === 'company') session.company = userMessage;
      if (currentField === 'contract') session.contract = userMessage;
      
      // Avançar para o próximo campo
      collectionIndex++;
      
      if (collectionIndex < step.collect.length) {
        // Ainda há campos para coletar
        session.formData = formData;
        session.collectionIndex = collectionIndex;
        await session.save();
        
        const nextField = step.collect[collectionIndex];
        const fieldLabels = {
          'name': '📝 Nome',
          'phone': '📞 Telefone',
          'email': '📧 Email',
          'contract': '🏢 Qual contrato',
          'cpf': '🆔 CPF',
          'company': '🏢 Empresa'
        };
        
        return {
          message: `✅ Obrigado! Agora informe:\n\n${fieldLabels[nextField] || nextField}`,
          collecting: true
        };
      } else {
        // Todos os campos coletados
        session.formData = formData;
        session.collectionIndex = 0; // Resetar para próxima coleta
        if (step.next) {
          session.currentStep = step.next;
        }
        await session.save();
        
        logger.info(`✅ Dados coletados: ${JSON.stringify(formData)}`);
        
        // Retornar mensagem do próximo step (se houver)
        const nextStep = this.flows[session.currentFlow]?.steps?.[session.currentStep];
        if (nextStep && nextStep.message) {
          const message = typeof nextStep.message === 'function' 
            ? nextStep.message(session.name)
            : nextStep.message;
          return { message, next: session.currentStep };
        }
        
        return {
          message: '✅ Dados coletados com sucesso!',
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
      const nextFlow = this.flows[option.next];
      if (nextFlow) {
        session.currentFlow = option.next;
        session.currentStep = this.resolveInitialStep(nextFlow);
      } else {
        session.currentStep = option.next;
      }
      await session.save();
    }

    // Retornar a mensagem do próximo step/fluxo para evitar "transição silenciosa"
    const nextFlow = this.flows[session.currentFlow];
    if (nextFlow) {
      // Fluxo simples (menu)
      if (!nextFlow.steps && nextFlow.message) {
        return { message: nextFlow.message, next: option.next };
      }

      // Fluxo com steps
      if (nextFlow.steps) {
        const nextStep = nextFlow.steps[session.currentStep];
        if (nextStep) {
          // Se for coleta, apenas instruir (não coletar automaticamente com mensagem vazia)
          if (nextStep.collect && nextStep.message) {
            return { message: nextStep.message, collecting: true, next: option.next };
          }

          if (Array.isArray(nextStep.messages)) {
            return { message: nextStep.messages.join('\n'), next: option.next };
          }

          if (nextStep.message) {
            const msg = typeof nextStep.message === 'function'
              ? nextStep.message(session.name)
              : nextStep.message;
            return { message: msg, next: option.next };
          }
        }
      }
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
        return await this.transferToAgent(session, context);
      
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
  async transferToAgent(session, context = {}) {
    const department = typeof context === 'string' ? context : (context.department || 'Atendimento');
    const topic = typeof context === 'object' ? (context.topic || null) : null;

    session.needsHumanAgent = true;
    session.currentFlow = 'wait_for_agent';
    session.currentStep = 'waiting';

    const formData = session.formData || {};
    formData.department = department;
    formData.dpTopic = topic;
    formData.subject = topic || department;
    session.formData = formData;

    await session.save();

    logger.info(`Transferindo sessão ${session.id} para ${department}${topic ? ` — tema: ${topic}` : ''}`);

    const topicLabel = topic ? `*${topic}*` : `*${department}*`;

    return {
      message: `Aguarde! Nosso time de ${topicLabel} já vai te atender 😊\n\n⏳ _Um atendente especializado responderá em breve._`,
      transferToAgent: true,
      department,
      topic
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

