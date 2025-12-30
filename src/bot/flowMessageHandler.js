/**
 * Handler de Mensagens Baseado em Fluxo
 * Processa mensagens usando o sistema completo de fluxos definidos
 */

const logger = require('../utils/logger');
const UserSession = require('../models/UserSessionSQL');
const flowManager = require('./services/flowManager');
const scheduleService = require('./services/scheduleService');

class FlowMessageHandler {
  /**
   * Handler principal - Processa mensagem do usuário
   * @param {Object} whatsappClient - Cliente WhatsApp (Baileys)
   * @param {Object} message - Mensagem recebida
   * @param {Object} contact - Contato que enviou
   */
  async handleMessage(whatsappClient, message, contact) {
    try {
      const phone = contact.number || contact.id.split('@')[0];
      const messageBody = message.body || '';
      const name = contact.name || contact.pushName || '';

      logger.info(`📨 Mensagem de ${name} (${phone}): ${messageBody.substring(0, 50)}...`);

      // Obter ou criar sessão
      let session = await UserSession.findOne({ where: { phone } });
      
      if (!session) {
        session = await UserSession.create({
          phone,
          name: name || null,
          currentFlow: 'initial',
          currentStep: 'start',
          menuPath: []
        });
        logger.info(`✅ Nova sessão criada para ${phone}`);
      }

      // Verificar se sessão expirou (24h inatividade)
      if (session.expiresAt && new Date() > session.expiresAt) {
        logger.info(`⏰ Sessão expirada para ${phone}, resetando...`);
        await session.reset();
      }

      // Atualizar última interação
      await session.updateLastInteraction();

      // Processar mensagem baseada no fluxo atual
      const response = await this.processMessageFlow(session, messageBody, whatsappClient);

      // Enviar resposta(s)
      if (response) {
        await this.sendResponse(whatsappClient, phone, response, session);
      }

    } catch (error) {
      logger.error('❌ Erro no flowMessageHandler:', error);
      
      try {
        await whatsappClient.sendMessage(
          message.from,
          '⚠️ Desculpe, ocorreu um erro. Digite *menu* para recomeçar.'
        );
      } catch (sendError) {
        logger.error('❌ Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }

  /**
   * Processa mensagem baseada no fluxo
   */
  async processMessageFlow(session, messageBody, whatsappClient) {
    const currentFlow = session.currentFlow;
    const currentStep = session.currentStep;

    logger.info(`🔄 Processando fluxo: ${currentFlow}, step: ${currentStep}`);

    // FLUXO INICIAL - Verificação de horário
    if (currentFlow === 'initial' && currentStep === 'start') {
      return await this.handleInitialFlow(session);
    }

    // FLUXO INICIAL - Pergunta nome
    if (currentFlow === 'initial' && currentStep === 'ask_name') {
      return await this.handleAskName(session, messageBody);
    }

    // FLUXO INICIAL - Mensagem fora do horário
    if (currentFlow === 'initial' && currentStep === 'collect_offline_message') {
      return await this.handleOfflineMessage(session, messageBody);
    }

    // MENU PRINCIPAL
    if (currentFlow === 'main_menu') {
      return await this.handleMainMenu(session, messageBody, whatsappClient);
    }

    // FLUXO CLIENTE
    if (currentFlow === 'client_flow') {
      return await this.handleClientFlow(session, messageBody, whatsappClient);
    }

    // MENU ADMINISTRATIVO
    if (currentFlow === 'administrative_menu') {
      return await this.handleAdministrativeMenu(session, messageBody, whatsappClient);
    }

    // DEPARTAMENTO PESSOAL
    if (currentFlow === 'dp_menu') {
      return await this.handleDPMenu(session, messageBody, whatsappClient);
    }

    // BENEFÍCIOS
    if (currentFlow === 'benefits_menu') {
      return await this.handleBenefitsMenu(session, messageBody, whatsappClient);
    }

    // AFASTAMENTOS
    if (currentFlow === 'leave_menu') {
      return await this.handleLeaveMenu(session, messageBody, whatsappClient);
    }

    // RESCISÃO
    if (currentFlow === 'termination_flow') {
      return await this.handleTerminationFlow(session, messageBody, whatsappClient);
    }

    // MANUTENÇÃO
    if (currentFlow === 'maintenance_menu') {
      return await this.handleMaintenanceMenu(session, messageBody, whatsappClient);
    }

    // COMPRAS
    if (currentFlow === 'purchasing_menu') {
      return await this.handlePurchasingMenu(session, messageBody, whatsappClient);
    }

    // PEDIDOS DE MATERIAIS
    if (currentFlow === 'materials_request') {
      return await this.handleMaterialsRequest(session, messageBody, whatsappClient);
    }

    // COLABORADOR
    if (currentFlow === 'employee_flow') {
      return await this.handleEmployeeFlow(session, messageBody, whatsappClient);
    }

    // FORNECEDOR
    if (currentFlow === 'supplier_flow') {
      return await this.handleSupplierFlow(session, messageBody, whatsappClient);
    }

    // FATURAMENTO
    if (currentFlow === 'billing_menu') {
      return await this.handleBillingMenu(session, messageBody, whatsappClient);
    }

    // RH
    if (currentFlow === 'hr_menu') {
      return await this.handleHRMenu(session, messageBody, whatsappClient);
    }

    // SEGURANÇA DO TRABALHO
    if (currentFlow === 'safety_menu') {
      return await this.handleSafetyMenu(session, messageBody, whatsappClient);
    }

    // GERÊNCIA ADMINISTRATIVA
    if (currentFlow === 'management_menu') {
      return await this.handleManagementMenu(session, messageBody, whatsappClient);
    }

    // AGUARDANDO ATENDENTE
    if (currentFlow === 'wait_for_agent' || currentFlow === 'agent_conversation') {
      return await this.handleAgentConversation(session, messageBody);
    }

    // AVALIAÇÃO NPS
    if (currentFlow === 'nps_evaluation') {
      return await this.handleNPSEvaluation(session, messageBody);
    }

    // Se chegou aqui, usar flowManager genérico
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Envia resposta ao usuário
   */
  async sendResponse(whatsappClient, phone, response, session) {
    try {
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

      // Validar se response existe
      if (!response) {
        logger.warn('⚠️ Resposta vazia, ignorando envio');
        return;
      }

      // Se é um array de mensagens
      if (Array.isArray(response)) {
        for (const msg of response) {
          // Garantir que msg é string
          const textToSend = String(msg || '');
          if (textToSend.trim()) {
            await whatsappClient.sendMessage(jid, textToSend);
            await this.delay(800); // Delay entre mensagens
          }
        }
        return;
      }

      // Se é um objeto de resposta
      if (typeof response === 'object' && response !== null) {
        if (response.messages && Array.isArray(response.messages)) {
          for (const msg of response.messages) {
            // Garantir que msg é string
            const textToSend = String(msg || '');
            if (textToSend.trim()) {
              await whatsappClient.sendMessage(jid, textToSend);
              await this.delay(800);
            }
          }
        } else if (response.message) {
          // Garantir que message é string
          const textToSend = String(response.message || '');
          if (textToSend.trim()) {
            await whatsappClient.sendMessage(jid, textToSend);
          }
        }
        
        // Se tem próximo fluxo, processar
        if (response.next) {
          await this.delay(1000);
          const nextResponse = await this.processMessageFlow(session, '', whatsappClient);
          if (nextResponse) {
            await this.sendResponse(whatsappClient, phone, nextResponse, session);
          }
        }
        
        return;
      }

      // Se é string simples
      if (typeof response === 'string' && response.trim()) {
        await whatsappClient.sendMessage(jid, response);
      }

    } catch (error) {
      logger.error('❌ Erro ao enviar resposta:', error);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== HANDLERS DE FLUXOS ESPECÍFICOS ====================

  /**
   * Fluxo Inicial
   */
  async handleInitialFlow(session) {
    // Verificar horário de atendimento
    const schedule = scheduleService.isBusinessHours();
    
    if (schedule.isOpen) {
      // Dentro do horário
      session.currentStep = 'ask_name';
      await session.save();
      
      const name = session.name || '';
      return {
        message: `Olá ${name} 😊, seja bem vindo(a) ao atendimento da *FG SERVICES*\n\n_Excelência para quem faz com excelência_`,
        next: true
      };
    } else {
      // Fora do horário
      session.currentStep = 'collect_offline_message';
      await session.save();
      
      const nextOpenFormatted = scheduleService.formatNextOpen(schedule.nextOpen);
      
      return {
        message: `Olá 😊, seja bem vindo(a) ao atendimento da *FG SERVICES*\n\n_Excelência para quem faz com excelência_\n\n⏰ *No momento estamos fora do horário de atendimento.*\n\n📅 Nosso horário:\n• 8h às 12h\n• 13h às 17h\n• Segunda a Sexta\n\n${nextOpenFormatted ? `Retornaremos: ${nextOpenFormatted}` : ''}\n\n💬 Deixe sua mensagem que retornaremos assim que possível!`
      };
    }
  }

  /**
   * Pergunta nome (se não tiver)
   */
  async handleAskName(session, messageBody) {
    if (!session.name || session.name.length < 2) {
      // Primeira interação - pergunta nome
      session.name = messageBody.trim();
      await session.save();
    }
    
    // Ir para menu principal
    session.currentFlow = 'main_menu';
    session.currentStep = 'start';
    await session.save();
    
    return {
      message: `Selecione a opção que indica seu perfil:\n\n1️⃣ Sou Cliente\n2️⃣ Quero ser cliente\n3️⃣ Colaborador\n4️⃣ Atual fornecedor\n5️⃣ Quero ser fornecedor\n6️⃣ Trabalhe Conosco\n7️⃣ Outros`
    };
  }

  /**
   * Mensagem fora do horário
   */
  async handleOfflineMessage(session, messageBody) {
    // Salvar mensagem offline
    const formData = session.formData || {};
    formData.offline_message = messageBody;
    session.formData = formData;
    session.isActive = false;
    await session.save();
    
    logger.info(`📝 Mensagem offline salva de ${session.phone}: ${messageBody}`);
    
    return {
      message: '✅ Mensagem recebida! Retornaremos seu contato assim que possível. Obrigado!'
    };
  }

  /**
   * Menu Principal
   */
  async handleMainMenu(session, messageBody, whatsappClient) {
    // Se step é 'start', mostrar o menu
    if (session.currentStep === 'start') {
      session.currentStep = 'waiting_option';
      await session.save();
      return {
        message: `Selecione a opção que indica seu perfil:\n\n1️⃣ Sou Cliente\n2️⃣ Quero ser cliente\n3️⃣ Colaborador\n4️⃣ Atual fornecedor\n5️⃣ Quero ser fornecedor\n6️⃣ Trabalhe Conosco\n7️⃣ Outros`
      };
    }
    
    const option = messageBody.trim();
    
    await session.addToMenuPath({
      menu: 'main_menu',
      option,
      timestamp: new Date()
    });
    
    switch (option) {
      case '1': // Sou Cliente
        session.currentFlow = 'client_flow';
        session.currentStep = 'collect_data';
        await session.save();
        return {
          message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\n📝 Nome\n📞 Telefone\n📧 Email\n🏢 Qual contrato'
        };
      
      case '2': // Quero ser cliente
        session.currentFlow = 'prospect_flow';
        session.currentStep = 'collect_data';
        await session.save();
        return {
          message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\n📝 Nome\n📞 Telefone\n📧 Email\n📍 Qual seu estado?'
        };
      
      case '3': // Colaborador
        session.currentFlow = 'employee_flow';
        session.currentStep = 'employee_type';
        await session.save();
        return {
          message: `Digite 👇🏽\n\n1️⃣ Colaborador\n2️⃣ Ex colaborador\n3️⃣ Voltar ao menu anterior`
        };
      
      case '4': // Atual fornecedor
        session.currentFlow = 'supplier_flow';
        session.currentStep = 'supplier_menu';
        await session.save();
        return {
          message: `Digite 👇🏽\n\n1️⃣ Financeiro\n2️⃣-7️⃣ (Outros departamentos)\n8️⃣ Voltar ao menu anterior`
        };
      
      case '5': // Quero ser fornecedor
        // Transferir para atendente
        session.needsHumanAgent = true;
        session.currentFlow = 'wait_for_agent';
        await session.save();
        return {
          message: 'Aguarde que nosso time comercial já vai te atender 😊'
        };
      
      case '6': // Trabalhe Conosco
        return {
          message: `🎯 *TRABALHE CONOSCO*\n\nConheça a FG Services e candidate-se às nossas vagas:\n\n🔗 https://trabalhe-conosco.vercel.app/#nossa-historia\n\nBoa sorte! 🍀\n\n${this.getMainMenuAgain()}`
        };
      
      case '7': // Outros
        session.needsHumanAgent = true;
        session.currentFlow = 'wait_for_agent';
        await session.save();
        return {
          message: 'Aguarde que nosso time já vai te atender 😊'
        };
      
      default:
        return {
          message: '❌ Opção inválida. Por favor, escolha um número de 1 a 7.'
        };
    }
  }

  /**
   * Fluxo Cliente
   */
  async handleClientFlow(session, messageBody, whatsappClient) {
    // Coletar dados se ainda não tem
    if (!session.email || !session.contract) {
      // Implementar coleta de dados em sequência
      // (simplificado por enquanto)
      session.currentFlow = 'client_menu';
      await session.save();
    }
    
    // Menu do cliente
    if (session.currentStep === 'client_menu' || session.currentFlow === 'client_menu') {
      const option = messageBody.trim();
      
      switch (option) {
        case '1': // Administrativo
          session.currentFlow = 'administrative_menu';
          await session.save();
          return {
            message: `Digite 👇🏽\n\n1️⃣ Departamento Pessoal\n2️⃣ Financeiro\n3️⃣ Compras\n4️⃣ Manutenção\n5️⃣ Logística\n6️⃣ RH\n7️⃣ Segurança do Trabalho\n8️⃣ Faturamento\n9️⃣ Gerência Administrativa\n🔟 Diretoria\n1️⃣1️⃣ Operacional\n1️⃣2️⃣ Voltar ao menu anterior`
          };
        
        case '2': // Comercial
          session.needsHumanAgent = true;
          session.currentFlow = 'wait_for_agent';
          await session.save();
          return {
            message: 'Aguarde que nosso time comercial já vai te atender 😊'
          };
        
        case '3': // Operacional
          session.needsHumanAgent = true;
          session.currentFlow = 'wait_for_agent';
          await session.save();
          return {
            message: 'Aguarde que nosso time operacional já vai te atender 😊'
          };
        
        case '4': // Voltar
          return await this.handleAskName(session, session.name);
        
        default:
          return {
            message: '❌ Opção inválida. Digite um número de 1 a 4.'
          };
      }
    }
    
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Menu Administrativo
   */
  async handleAdministrativeMenu(session, messageBody, whatsappClient) {
    const option = messageBody.trim();
    
    const menuMap = {
      '1': { flow: 'dp_menu', step: 'profile_selection' },
      '2': { flow: 'financial_menu' },
      '3': { flow: 'purchasing_menu' },
      '4': { flow: 'maintenance_menu', step: 'service_type' },
      '5': { flow: 'logistics_menu' },
      '6': { flow: 'hr_menu' },
      '7': { flow: 'safety_menu' },
      '8': { flow: 'billing_menu', step: 'billing_hierarchy' },
      '9': { flow: 'management_menu', step: 'collect_info' },
      '10': { transfer: true, dept: 'Diretoria' },
      '11': { transfer: true, dept: 'Operacional' },
      '12': { back: 'client_menu' }
    };
    
    const selected = menuMap[option];
    
    if (!selected) {
      return {
        message: '❌ Opção inválida. Digite um número de 1 a 12.'
      };
    }
    
    if (selected.back) {
      session.currentFlow = selected.back;
      await session.save();
      return {
        message: `Como a *FG SERVICES* pode ajudar você hoje?\n\n1️⃣ Assuntos Administrativos\n2️⃣ Comercial\n3️⃣ Operacional\n4️⃣ Voltar ao menu anterior`
      };
    }
    
    if (selected.transfer) {
      session.needsHumanAgent = true;
      session.currentFlow = 'wait_for_agent';
      const formData = session.formData || {};
      formData.department = selected.dept;
      session.formData = formData;
      await session.save();
      return {
        message: `Aguarde que nosso time de *${selected.dept}* já vai te atender 😊`
      };
    }
    
    session.currentFlow = selected.flow;
    if (selected.step) session.currentStep = selected.step;
    await session.save();
    
    // Processar próximo passo
    return await this.processMessageFlow(session, '', whatsappClient);
  }

  // ==================== HELPERS ====================

  /**
   * Texto para voltar ao menu
   */
  getMainMenuAgain() {
    return '\n\n_Digite *menu* para voltar ao início._';
  }

  /**
   * Handlers simplificados (delegar para flowManager)
   */
  async handleDPMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleBenefitsMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleLeaveMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleTerminationFlow(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleMaintenanceMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handlePurchasingMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleMaterialsRequest(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleEmployeeFlow(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleSupplierFlow(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleBillingMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleHRMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleSafetyMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  async handleManagementMenu(session, messageBody, whatsappClient) {
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Conversa com atendente humano
   */
  async handleAgentConversation(session, messageBody) {
    // Apenas registrar mensagem, atendente humano responde pelo dashboard
    logger.info(`💬 Mensagem em atendimento humano de ${session.phone}: ${messageBody}`);
    
    // Não responder automaticamente, deixar para o atendente
    return null;
  }

  /**
   * Avaliação NPS
   */
  async handleNPSEvaluation(session, messageBody) {
    const score = parseInt(messageBody.trim());
    
    if (isNaN(score) || score < 0 || score > 10) {
      return {
        message: '❌ Por favor, digite um número de 0 a 10.'
      };
    }
    
    session.npsScore = score;
    session.isActive = false;
    await session.save();
    
    logger.info(`⭐ NPS Score: ${score} de ${session.phone}`);
    
    return {
      message: '✨ *Até mais e conte com a FG SERVICES*\n\nObrigado pela sua avaliação! 🙏'
    };
  }
}

module.exports = new FlowMessageHandler();

