/**
 * Handler de Mensagens Baseado em Fluxo
 * Processa mensagens usando o sistema completo de fluxos definidos
 */

const logger = require('../utils/logger');
const UserSession = require('../models/UserSessionSQL');
const flowManager = require('./services/flowManager');
const scheduleService = require('./services/scheduleService');
const intentClassifier = require('./services/intentClassifier');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const Contact = require('../models/ContactSQL');
const AIClassificationLog = require('../models/AIClassificationLog');
const crypto = require('crypto');

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
      const jid = contact.id; // JID completo com @lid ou @s.whatsapp.net
      const messageBody = message.body || '';
      const name = contact.name || contact.pushName || '';

      // Ignorar mensagens vazias (reações, status, etc)
      if (!messageBody.trim()) {
        logger.info(`⏭️ Mensagem vazia/sem texto ignorada de ${name} (${phone})`);
        return;
      }

      logger.info(`📨 Mensagem de ${name} (${phone}) JID: ${jid}: ${messageBody.substring(0, 50)}...`);

      // Criar ou buscar contato
      const whatsappId = contact.id || `${phone}@s.whatsapp.net`;
      let contactRecord = await Contact.findOne({ where: { phone } });
      if (!contactRecord) {
        contactRecord = await Contact.create({
          whatsappId,
          phone,
          name,
          isActive: true
        });
        logger.info(`✅ Novo contato criado: ${name} (${phone})`);
      } else {
        // Atualizar nome se mudou
        if (contactRecord.name !== name && name) {
          contactRecord.name = name;
          await contactRecord.save();
        }
      }

      // Criar ou buscar ticket (passar JID completo para envio correto)
      let ticket = await this.findOrCreateTicket(phone, name, contactRecord.id, whatsappId);

      // Salvar mensagem recebida no banco
      await this.saveIncomingMessage(ticket.id, contactRecord.id, phone, name, messageBody, message);

      // Emitir evento Socket.IO para o dashboard
      this.notifyDashboard(ticket, contactRecord, messageBody, 'incoming');

      // 👤 VERIFICAR SE TEM ATENDENTE HUMANO ATRIBUÍDO
      if (ticket.assignedTo && ticket.status === 'in_progress') {
        logger.info(`👤 [ATENDIMENTO HUMANO] Ticket ${ticket.protocol} está com atendente ${ticket.assignedTo}. IA bloqueada.`);
        logger.info(`📨 [ATENDIMENTO HUMANO] Mensagem encaminhada apenas para o atendente. Sem resposta automática.`);
        
        // Notificar atendente via Socket.IO (mensagem já foi salva e notificada acima)
        // Não processar pela IA - retornar sem resposta
        return;
      }

      // 🔔 SE TICKET ESTÁ AGUARDANDO ATENDENTE (waiting_human)
      if (ticket.status === 'waiting_human') {
        logger.info(`⏳ [AGUARDANDO ATENDENTE] Ticket ${ticket.protocol} aguardando atribuição. Cliente tentou enviar mensagem.`);
        
        // Enviar mensagem ao cliente pedindo para aguardar (não notificar novamente)
        await whatsappClient.sendMessage(
          message.from,
          '⏳ *Por favor, aguarde...*\n\nSua solicitação de atendimento já foi registrada e está na fila.\n\nUm de nossos atendentes responderá em breve.\n\n_Obrigado pela paciência!_ 🙏'
        );
        
        return; // Não processar pela IA
      }

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
      const response = await this.processMessageFlow(session, messageBody, whatsappClient, ticket, message.from);

      logger.info(`🎯 Resposta gerada: ${response ? (typeof response === 'object' ? JSON.stringify(response).substring(0, 100) : response.substring(0, 100)) : 'NULL'}`);

      // Enviar resposta(s)
      if (response) {
        logger.info(`📤 Enviando resposta para ${jid}...`);
        await this.sendResponse(whatsappClient, jid, response, session, ticket, contactRecord);
      } else {
        logger.warn(`⚠️ Nenhuma resposta gerada! Fluxo: ${session.currentFlow}, Step: ${session.currentStep}`);
      }

    } catch (error) {
      logger.error('❌ Erro no flowMessageHandler:', error);
      logger.error('❌ Stack trace:', error.stack);
      if (typeof session !== 'undefined' && session) {
        logger.error(`❌ Contexto: Fluxo=${session.currentFlow}, Step=${session.currentStep}`);
      } else {
        logger.error(`❌ Contexto: Sessão não disponível (erro ocorreu antes da criação)`);
      }
      
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
  async processMessageFlow(session, messageBody, whatsappClient, ticket = null, jid = null) {
    const currentFlow = session.currentFlow;
    const currentStep = session.currentStep;

    logger.info(`🔄 Processando fluxo: ${currentFlow}, step: ${currentStep}`);

    // 🤖 MODO IA PURA: Se IA estiver ativada, processar TUDO pela IA (sem fluxos tradicionais)
    if (intentClassifier.config.enabled) {
      logger.info(`🤖 [MODO IA PURA] Processando mensagem exclusivamente pela IA...`);
      
      // Exceção: Fluxo inicial de boas-vindas (primeira mensagem)
      if (currentFlow === 'initial' && currentStep === 'start') {
        return await this.handleInitialFlow(session);
      }

      // Exceção: Coleta de nome
      if (currentFlow === 'initial' && currentStep === 'ask_name') {
        return await this.handleAskName(session, messageBody);
      }

      // Exceção: Mensagem fora do horário
      if (currentFlow === 'initial' && currentStep === 'collect_offline_message') {
        return await this.handleOfflineMessage(session, messageBody);
      }

      // 📋 PRIORIDADE: Se está coletando dados, processar os dados primeiro (evita loop)
      const formData = session.formData || {};
      if (formData.collecting_data === true) {
        logger.info(`📋 [COLETA DE DADOS] Processando dados fornecidos pelo usuário...`);
        return await this.handleDataCollection(session, messageBody);
      }

      // TUDO MAIS: Processar pela IA
      const aiResult = await this.tryAIClassification(session, messageBody);
      if (aiResult) {
        // Se IA identificou necessidade de atendente humano
        if (aiResult.needsHuman) {
          logger.info(`🤚 [MODO IA PURA] IA solicitou atendimento humano`);
          if (ticket && jid) {
            await this.requestHumanAttendance(ticket, whatsappClient, jid, 'Cliente solicitou atendimento humano');
          } else {
            logger.error('❌ Não foi possível solicitar atendimento humano: ticket ou jid não disponível');
          }
          return null; // Mensagem já foi enviada pela requestHumanAttendance
        }
        
        logger.info(`🎯 [MODO IA PURA] IA redirecionou para: ${aiResult.flow} (confiança: ${aiResult.confidence})`);
        return aiResult.response;
      } else {
        // Se a IA não conseguiu classificar com confiança suficiente
        logger.warn(`⚠️ [MODO IA PURA] IA não conseguiu classificar. Solicitando reformulação...`);
        return `Desculpe, não entendi sua solicitação. 🤔\n\nPoderia reformular de forma mais clara? Por exemplo:\n- "Quero tirar férias"\n- "Preciso de ajuda com manutenção"\n- "Quero ser cliente"\n\nEstou aqui para ajudar! 😊`;
      }
    }

    // 🔧 MODO TRADICIONAL (IA desativada): Continuar com fluxos tradicionais

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

    // 🧠 SISTEMA HÍBRIDO: Tentar classificação por IA antes de processar opções numéricas
    // Aplica apenas em menus que esperam escolha do usuário
    const menusForAI = ['main_menu', 'client_menu', 'administrative_menu'];
    const isNumericOption = /^\d+$/.test(messageBody.trim());
    
    if (menusForAI.includes(currentFlow) && !isNumericOption) {
      const aiResult = await this.tryAIClassification(session, messageBody);
      if (aiResult) {
        logger.info(`🎯 IA redirecionou para: ${aiResult.flow} (confiança: ${aiResult.confidence})`);
        return aiResult.response;
      }
    }

    // MENU PRINCIPAL
    if (currentFlow === 'main_menu') {
      return await this.handleMainMenu(session, messageBody, whatsappClient);
    }

    // FLUXO CLIENTE
    if (currentFlow === 'client_flow') {
      return await this.handleClientFlow(session, messageBody, whatsappClient);
    }

    // FLUXO PROSPECT (Quero ser cliente)
    if (currentFlow === 'prospect_flow') {
      return await this.handleProspectFlow(session, messageBody, whatsappClient);
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
  async sendResponse(whatsappClient, jid, response, session, ticket, contact) {
    try {
      logger.info(`📱 JID para envio: ${jid}`);
      
      // Extrair phone do JID para salvar no banco
      const phone = jid.split('@')[0];

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
            // Salvar resposta no banco
            if (ticket && contact) {
              await this.saveOutgoingMessage(ticket.id, contact.id, phone, textToSend);
              this.notifyDashboard(ticket, contact, textToSend, 'outgoing');
            }
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
              // Salvar resposta no banco
              if (ticket && contact) {
                await this.saveOutgoingMessage(ticket.id, contact.id, phone, textToSend);
                this.notifyDashboard(ticket, contact, textToSend, 'outgoing');
              }
              await this.delay(800);
            }
          }
        } else if (response.message) {
          // Garantir que message é string
          const textToSend = String(response.message || '');
          if (textToSend.trim()) {
            await whatsappClient.sendMessage(jid, textToSend);
            // Salvar resposta no banco
            if (ticket && contact) {
              await this.saveOutgoingMessage(ticket.id, contact.id, phone, textToSend);
              this.notifyDashboard(ticket, contact, textToSend, 'outgoing');
            }
          }
        }
        
        // Se tem próximo fluxo, processar
        if (response.next) {
          await this.delay(1000);
          const nextResponse = await this.processMessageFlow(session, '', whatsappClient, ticket, jid);
          if (nextResponse) {
            await this.sendResponse(whatsappClient, jid, nextResponse, session, ticket, contact);
          }
        }
        
        return;
      }

      // Se é string simples
      if (typeof response === 'string' && response.trim()) {
        await whatsappClient.sendMessage(jid, response);
        // Salvar resposta no banco
        if (ticket && contact) {
          await this.saveOutgoingMessage(ticket.id, contact.id, phone, response);
          this.notifyDashboard(ticket, contact, response, 'outgoing');
        }
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
  /**
   * Retorna saudação baseada no horário
   */
  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  async handleInitialFlow(session) {
    // Verificar horário de atendimento
    const schedule = scheduleService.isBusinessHours();
    const greeting = this.getGreeting();
    const name = session.name || '';
    
    if (schedule.isOpen) {
      // Dentro do horário
      session.currentStep = 'ask_name';
      await session.save();
      
      return {
        message: `${greeting}! ${name ? name + ', ' : ''}😊\n\nSeja muito bem-vindo(a) ao atendimento da *FG SERVICES*! 🌟\n\n_Excelência para quem faz com excelência_\n\nEstou aqui para te ajudar! Como posso te atender hoje?`,
        next: true
      };
    } else {
      // Fora do horário
      session.currentStep = 'collect_offline_message';
      await session.save();
      
      const nextOpenFormatted = scheduleService.formatNextOpen(schedule.nextOpen);
      
      return {
        message: `${greeting}! ${name ? name + ', ' : ''}😊\n\nSeja bem-vindo(a) ao atendimento da *FG SERVICES*! 🌟\n\n_Excelência para quem faz com excelência_\n\n⏰ *No momento estamos fora do horário de atendimento.*\n\n📅 Nosso horário:\n• Segunda a Sexta\n• 8h às 12h | 13h às 17h\n\n${nextOpenFormatted ? `Retornaremos: ${nextOpenFormatted}` : ''}\n\n💬 Pode deixar sua mensagem que retornaremos assim que possível!`
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
   * Menu Principal - Delegar ao flowManager
   */
  async handleMainMenu(session, messageBody, whatsappClient) {
    logger.info(`📋 Processando main_menu via flowManager...`);
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Fluxo Cliente - Delegar ao flowManager
   */
  async handleClientFlow(session, messageBody, whatsappClient) {
    logger.info('📝 Processando client_flow via flowManager...');
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Fluxo Prospect (Quero ser cliente) - Delegar ao flowManager
   */
  async handleProspectFlow(session, messageBody, whatsappClient) {
    logger.info('📝 Processando prospect_flow via flowManager...');
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }

  /**
   * Menu Administrativo - Delegar ao flowManager
   */
  async handleAdministrativeMenu(session, messageBody, whatsappClient) {
    logger.info('📝 Processando administrative_menu via flowManager...');
    return await flowManager.processMessage(session, messageBody, whatsappClient);
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

  /**
   * Busca ou cria ticket para o contato
   */
  async findOrCreateTicket(phone, name, contactId, whatsappJid = null) {
    try {
      // Salvar JID completo no userPhone para envio correto
      const phoneToSave = whatsappJid || phone;
      
      logger.info(`📱 findOrCreateTicket - phone: ${phone}, whatsappJid: ${whatsappJid}, saving: ${phoneToSave}`);
      
      // Buscar ticket aberto existente (buscar por JID ou número)
      let ticket = await Ticket.findOne({
        where: {
          [Ticket.sequelize.Sequelize.Op.or]: [
            { userPhone: phoneToSave },
            { userPhone: phone }
          ],
          status: ['open', 'waiting_human', 'in_progress']
        },
        order: [['createdAt', 'DESC']]
      });

      if (ticket) {
        // Atualizar última interação e JID se necessário
        ticket.updatedAt = new Date();
        if (whatsappJid && !ticket.userPhone.includes('@')) {
          logger.info(`📱 Atualizando userPhone de ${ticket.userPhone} para ${whatsappJid}`);
          ticket.userPhone = whatsappJid;
        }
        await ticket.save();
        return ticket;
      }

      // Criar novo ticket em estado 'open' (IA processa primeiro)
      const protocol = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      ticket = await Ticket.create({
        protocol,
        userId: contactId, // ID do contato como userId
        userName: name,
        userPhone: phoneToSave, // Salvar JID completo!
        department: 'Atendimento',
        status: 'open', // ✅ IA processa primeiro
        priority: 'normal',
        subject: 'Atendimento via WhatsApp',
        description: 'Conversa iniciada via WhatsApp',
        messages: [],
        attachments: []
      });

      logger.info(`🎫 Novo ticket criado: ${protocol} para ${name} (JID: ${phoneToSave}) - STATUS: open (IA processando)`);
      
      // Emitir evento de novo ticket
      this.emitSocketEvent('new_ticket', {
        ticket: ticket.toJSON()
      });

      return ticket;
    } catch (error) {
      logger.error('❌ Erro ao criar/buscar ticket:', error);
      throw error;
    }
  }

  /**
   * Salva mensagem recebida no banco
   */
  async saveIncomingMessage(ticketId, contactId, phone, name, body, rawMessage) {
    try {
      const messageId = rawMessage.id || `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      const chatMessage = await ChatMessage.create({
        messageId,
        ticketId,
        contactId,
        direction: 'incoming',
        from: phone,
        to: 'bot',
        fromName: name,
        body,
        type: rawMessage.type || 'text',
        status: 'received',
        fromMe: false,
        timestamp: rawMessage.timestamp ? new Date(rawMessage.timestamp * 1000) : new Date(),
        isRead: false,
        metadata: {
          rawMessageId: rawMessage.id,
          hasMedia: rawMessage.hasMedia || false
        }
      });

      logger.info(`💾 Mensagem salva no banco: ${messageId}`);
      
      return chatMessage;
    } catch (error) {
      logger.error('❌ Erro ao salvar mensagem:', error);
      throw error;
    }
  }

  /**
   * Salva mensagem enviada (resposta do bot) no banco
   */
  async saveOutgoingMessage(ticketId, contactId, phone, body) {
    try {
      const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      const chatMessage = await ChatMessage.create({
        messageId,
        ticketId,
        contactId,
        direction: 'outgoing',
        from: 'bot',
        to: phone,
        fromName: 'Bot',
        body,
        type: 'text',
        status: 'sent',
        fromMe: true,
        timestamp: new Date(),
        isRead: true
      });

      logger.info(`📤 Resposta salva no banco: ${messageId}`);
      
      return chatMessage;
    } catch (error) {
      logger.error('❌ Erro ao salvar resposta:', error);
    }
  }

  /**
   * 🧠 Tenta classificar intenção com IA (Sistema Híbrido)
   */
  async tryAIClassification(session, messageBody) {
    try {
      // Construir contexto do usuário
      const userContext = {
        name: session.name,
        currentFlow: session.currentFlow,
        currentStep: session.currentStep,
        formData: session.formData || {}
      };

      // Tentar classificar com IA
      const classification = await intentClassifier.classify(messageBody, userContext);
      
      // Se IA não conseguiu classificar ou confiança baixa, retorna null para usar fluxo tradicional
      if (!classification || classification.confidence < intentClassifier.config.confidenceThreshold) {
        logger.info(`🤖 IA: Confiança baixa (${classification?.confidence || 0}), usando fluxo tradicional`);
        return null;
      }

      // Log da classificação
      logger.info(`✅ IA classificou com sucesso:`, {
        intent: classification.intent,
        flow: classification.flow,
        confidence: classification.confidence,
        method: classification.method
      });

      // Salvar log de classificação para analytics
      await this.logAIClassification(session, messageBody, classification);

      // 🤚 CASO ESPECIAL: IA identificou necessidade de atendente humano
      if (classification.intent === 'atendimento_humano' || classification.flow === 'human_handoff') {
        logger.info(`🤚 [IA] Detectou necessidade de atendimento humano`);
        
        // Marcar resposta especial para solicitar atendimento humano
        return {
          flow: 'human_handoff',
          confidence: classification.confidence,
          response: null, // Será tratado no handleMessage
          needsHuman: true
        };
      }

      // Redirecionar para o fluxo identificado
      if (classification.flow) {
        // Atualizar sessão
        session.currentFlow = classification.flow;
        session.currentStep = 'start';  // Iniciar do primeiro passo do fluxo
        await session.save();

        // Obter mensagem do fluxo de destino
        const flowResponse = await flowManager.processMessage(
          session.toJSON(),
          messageBody,
          { forceFlow: classification.flow }
        );

        // Mensagem educada com coleta de dados
        const greeting = this.getGreeting();
        let confirmationMessage = `${greeting}! 😊\n\nPerfeito! Vou te ajudar com *${this.getIntentLabel(classification.intent)}*.\n\n`;
        
        // Verificar se precisa coletar dados
        const needsData = this.needsDataCollection(classification.intent);
        if (needsData) {
          const dataMessage = await this.getDataCollectionMessage(session, classification.intent);
          if (dataMessage) {
            confirmationMessage += dataMessage;
            // Se está coletando dados, NÃO adicionar a resposta do fluxo ainda
            return {
              flow: classification.flow,
              confidence: classification.confidence,
              response: confirmationMessage
            };
          }
        }
        
        // Se não precisa coletar dados OU já tem todos os dados
        return {
          flow: classification.flow,
          confidence: classification.confidence,
          response: confirmationMessage
        };
      }

      return null;

    } catch (error) {
      logger.error('❌ Erro na classificação por IA:', error);
      return null; // Fallback para fluxo tradicional
    }
  }

  /**
   * Verifica se o departamento precisa de coleta de dados
   */
  needsDataCollection(intent) {
    const deptsThatNeedData = [
      'dp', 'rh', 'financeiro', 'faturamento', 
      'seguranca', 'comercial', 'manutencao', 'logistica'
    ];
    return deptsThatNeedData.includes(intent);
  }

  /**
   * Retorna mensagem de coleta de dados
   */
  async getDataCollectionMessage(session, intent) {
    let message = '';
    
    // Verificar dados que faltam
    const missingData = [];
    const formData = session.formData || {};
    
    // SEMPRE pedir nome completo se não foi coletado ainda
    if (!formData.nome_completo) {
      missingData.push('nome completo');
    }
    
    // SEMPRE pedir email
    if (!formData.email) {
      missingData.push('e-mail');
    }
    
    // SEMPRE pedir contrato/loja para TODOS os departamentos que precisam de dados
    const deptsThatNeedContract = ['dp', 'rh', 'seguranca', 'comercial', 'financeiro', 'faturamento', 'manutencao', 'logistica'];
    if (deptsThatNeedContract.includes(intent) && !formData.contrato) {
      missingData.push('contrato/loja onde trabalha');
    }
    
    if (missingData.length > 0) {
      message += `Para prosseguir, preciso de algumas informações:\n\n`;
      message += `📋 *Dados necessários:*\n`;
      missingData.forEach((data, i) => {
        message += `${i + 1}. ${data}\n`;
      });
      message += `\n*Dica:* Envie cada informação em uma linha separada, ou tudo junto. Vou entender! 😊`;
      
      // Salvar flag de coleta de dados
      session.formData = {
        ...formData,
        collecting_data: true,
        missing_data: missingData,
        target_intent: intent
      };
      await session.save();
    }
    
    return message;
  }

  /**
   * Processa a coleta de dados fornecidos pelo usuário
   */
  async handleDataCollection(session, messageBody) {
    const formData = session.formData || {};
    const missingData = formData.missing_data || [];
    const targetIntent = formData.target_intent;

    logger.info(`📋 Iniciando coleta de dados. Faltam: ${JSON.stringify(missingData)}`);
    logger.info(`📝 Mensagem recebida: "${messageBody}"`);

    // Processar a mensagem e extrair dados
    const lines = messageBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // 1️⃣ PRIORIDADE: Extrair EMAIL primeiro (é mais fácil de identificar)
    const emailMatch = messageBody.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && !formData.email) {
      formData.email = emailMatch[0];
      const index = missingData.indexOf('e-mail');
      if (index > -1) missingData.splice(index, 1);
      logger.info(`✅ Email coletado: ${formData.email}`);
    }

    // 2️⃣ Extrair NOME COMPLETO (linha com nome e sobrenome, sem @, sem números)
    if (!formData.nome_completo) {
      // Procurar linha que parece ser um nome (tem pelo menos 2 palavras, sem símbolos especiais)
      const nameLine = lines.find(l => {
        const words = l.split(' ').filter(w => w.length > 1);
        const hasMultipleWords = words.length >= 2;
        const noEmail = !l.includes('@');
        const noNumbers = !/\d/.test(l);
        const noContractKeywords = !l.toLowerCase().includes('loja') && 
                                   !l.toLowerCase().includes('contrato') && 
                                   !l.toLowerCase().includes('sede');
        return hasMultipleWords && noEmail && noNumbers && noContractKeywords;
      });
      
      if (nameLine) {
        formData.nome_completo = nameLine;
        session.name = nameLine.split(' ')[0]; // Atualizar nome da sessão com primeiro nome
        const index = missingData.indexOf('nome completo');
        if (index > -1) missingData.splice(index, 1);
        logger.info(`✅ Nome completo coletado: ${formData.nome_completo}`);
      }
    }

    // 3️⃣ Extrair CONTRATO/LOJA (linha que sobrou ou que contém palavras-chave)
    if (!formData.contrato) {
      // Procurar linha com palavras-chave ou linha restante
      const contratoLine = lines.find(l => {
        const lower = l.toLowerCase();
        const hasKeywords = lower.includes('loja') || lower.includes('contrato') || 
                           lower.includes('sede') || lower.includes('unidade');
        const isNotNameOrEmail = l !== formData.nome_completo && !l.includes('@');
        return hasKeywords || (isNotNameOrEmail && l.length > 2);
      });
      
      if (contratoLine) {
        formData.contrato = contratoLine;
        const index = missingData.indexOf('contrato/loja onde trabalha');
        if (index > -1) missingData.splice(index, 1);
        logger.info(`✅ Contrato/Loja coletado: ${formData.contrato}`);
      }
    }

    // Atualizar sessão
    formData.missing_data = missingData;
    session.formData = formData;
    await session.save();

    logger.info(`📊 Após processamento, ainda faltam: ${JSON.stringify(missingData)}`);

    // Se ainda faltam dados
    if (missingData.length > 0) {
      const greeting = this.getGreeting();
      return `${greeting}! 😊\n\nObrigado pelas informações! Ainda preciso de:\n\n${missingData.map((d, i) => `${i + 1}. *${d}*`).join('\n')}\n\nPor favor, me envie essas informações.`;
    }

    // 🎉 Todos os dados coletados!
    logger.info(`🎉 Todos os dados coletados com sucesso!`);
    formData.collecting_data = false;
    session.formData = formData;
    await session.save();

    // 🎯 ROTEAMENTO AUTOMÁTICO: Atribuir ticket ao atendente adequado
    const ticketRoutingService = require('../services/ticketRoutingService');
    
    let assignedAgentName = null;
    
    try {
      const ticket = await Ticket.findOne({
        where: { userPhone: session.phone, status: ['open', 'waiting_human'] },
        order: [['createdAt', 'DESC']]
      });

      if (ticket) {
        // Atualizar ticket com os dados coletados e departamento
        ticket.userName = formData.nome_completo;
        ticket.department = this.getIntentLabel(targetIntent);
        ticket.description = `Nome: ${formData.nome_completo}\nEmail: ${formData.email}${formData.contrato ? `\nContrato/Loja: ${formData.contrato}` : ''}\n\nSolicitação: ${ticket.subject || 'Atendimento'}`;

        // Rotear automaticamente
        const routing = targetIntent === 'dp' 
          ? await ticketRoutingService.routeDPTicket({
              subject: ticket.subject,
              description: ticket.description,
              userMessage: messageBody,
              departmentId: 'dp'
            })
          : await ticketRoutingService.routeTicket({
              subject: ticket.subject,
              description: ticket.description,
              userMessage: messageBody,
              departmentId: targetIntent,
              department: this.getIntentLabel(targetIntent)
            });

        if (routing) {
          ticket.assignedTo = routing.agentId;
          ticket.status = 'in_progress';
          assignedAgentName = routing.agentName;
          logger.info(`✅ Ticket ${ticket.protocol} atribuído automaticamente para ${routing.agentName}`);
        }

        await ticket.save();
      }
    } catch (error) {
      logger.error('❌ Erro ao rotear ticket:', error);
    }

    // 🧹 LIMPAR dados de coleta para evitar loop
    session.formData = {
      nome_completo: formData.nome_completo,
      email: formData.email,
      contrato: formData.contrato
      // Removemos: collecting_data, missing_data, target_intent
    };
    session.currentFlow = 'initial'; // Voltar ao fluxo inicial
    session.currentStep = 'start'; // Resetar step
    await session.save();

    const greeting = this.getGreeting();
    let responseMessage = `${greeting}! 😊\n\n✅ Perfeito! Recebi todas as informações:\n\n👤 *Nome Completo:* ${formData.nome_completo}\n📧 *Email:* ${formData.email}${formData.contrato ? `\n🏢 *Contrato/Loja:* ${formData.contrato}` : ''}\n\n🎯 Sua solicitação foi direcionada para *${this.getIntentLabel(targetIntent)}*.`;
    
    if (assignedAgentName) {
      responseMessage += `\n\n👤 *Atendente responsável:* ${assignedAgentName}`;
    }
    
    responseMessage += `\n\nEm breve, nossa equipe entrará em contato! 🌟\n\n_Se precisar de algo mais, é só me chamar!_ 💬`;
    
    return responseMessage;
  }

  /**
   * Retorna label amigável da intenção
   */
  getIntentLabel(intent) {
    const labels = {
      'dp': 'Departamento Pessoal',
      'rh': 'Recursos Humanos',
      'financeiro': 'Financeiro',
      'compras': 'Compras',
      'manutencao': 'Manutenção',
      'logistica': 'Logística',
      'seguranca': 'Segurança do Trabalho',
      'faturamento': 'Faturamento',
      'comercial': 'Comercial',
      'operacional': 'Operacional',
      'novo_cliente': 'novos clientes',
      'trabalhe_conosco': 'oportunidades de carreira',
      'atendimento_humano': 'atendimento humano'
    };
    return labels[intent] || intent;
  }

  /**
   * Salva log de classificação da IA para analytics
   */
  async logAIClassification(session, message, classification) {
    try {
      await AIClassificationLog.create({
        phone: session.phone,
        userName: session.name,
        userMessage: message,
        sessionContext: {
          currentFlow: session.currentFlow,
          currentStep: session.currentStep,
          formData: session.formData
        },
        intent: classification.intent,
        targetFlow: classification.flow,
        confidence: classification.confidence,
        method: classification.method,
        matchedKeywords: classification.matchedKeywords || null,
        reasoning: classification.reasoning || null,
        used: true
      });
      
      logger.info('📊 Log de classificação IA salvo no banco');
    } catch (error) {
      logger.error('❌ Erro ao salvar log de IA:', error);
    }
  }

  /**
   * Notifica dashboard sobre nova mensagem
   */
  notifyDashboard(ticket, contact, messageBody, direction) {
    try {
      this.emitSocketEvent('new_message', {
        ticketId: ticket.id,
        ticket: ticket.toJSON(),
        contact: contact.toJSON(),
        message: {
          body: messageBody,
          direction,
          timestamp: new Date(),
          from: direction === 'incoming' ? contact.phone : 'bot'
        }
      });

      // Atualizar lista de tickets
      this.emitSocketEvent('ticket_updated', {
        ticketId: ticket.id,
        ticket: ticket.toJSON()
      });
    } catch (error) {
      logger.error('❌ Erro ao notificar dashboard:', error);
    }
  }

  /**
   * IA solicita atendimento humano (quando identifica necessidade)
   */
  async requestHumanAttendance(ticket, whatsappClient, jid, reason = 'Solicitação de atendimento') {
    try {
      logger.info(`🤚 [IA] Solicitando atendimento humano para ticket ${ticket.protocol}. Motivo: ${reason}`);
      
      // Mudar status do ticket para 'waiting_human'
      ticket.status = 'waiting_human';
      ticket.subject = reason;
      await ticket.save();
      
      // Buscar contato
      const Contact = require('../models/ContactSQL');
      const contact = await Contact.findOne({ where: { phone: ticket.userPhone.split('@')[0] } });
      
      // Notificar atendentes disponíveis
      await this.notifyAvailableAgents(ticket, contact, reason);
      
      // Informar cliente
      await whatsappClient.sendMessage(
        jid,
        '🤝 *Atendimento Humano Solicitado*\n\n' +
        'Entendi que você precisa de um atendimento mais especializado.\n\n' +
        'Estou direcionando você para um de nossos atendentes.\n\n' +
        '⏳ _Por favor, aguarde. Você será atendido em breve._'
      );
      
      logger.info(`✅ [IA] Atendimento humano solicitado com sucesso para ${ticket.protocol}`);
      
    } catch (error) {
      logger.error('❌ Erro ao solicitar atendimento humano:', error);
    }
  }

  /**
   * Notifica atendentes disponíveis sobre novo ticket
   */
  async notifyAvailableAgents(ticket, contact, messageBody) {
    try {
      const User = require('../models/UserSQL');
      
      // Buscar atendentes online
      const availableAgents = await User.findAll({
        where: {
          role: ['agent', 'manager', 'admin'],
          status: 'online'
        }
      });

      if (availableAgents.length === 0) {
        logger.warn('⚠️ Nenhum atendente online disponível!');
        
        // Se não há atendentes, mudar status para 'open' e deixar IA assumir após timeout
        ticket.status = 'open';
        await ticket.save();
        return;
      }

      logger.info(`🔔 Notificando ${availableAgents.length} atendentes disponíveis...`);

      // Emitir evento para todos os atendentes
      const { io } = require('../server');
      if (io) {
        io.emit('new_ticket_notification', {
          ticket: ticket.toJSON(),
          contact: contact.toJSON(),
          message: messageBody,
          timestamp: new Date()
        });
        
        logger.info(`✅ Notificação enviada para atendentes`);
      }

      // Iniciar timeout de 30 segundos - se ninguém aceitar, IA assume
      setTimeout(async () => {
        try {
          // Recarregar ticket para verificar status atual
          await ticket.reload();
          
          // Se ainda está waiting_human, ninguém aceitou - mudar para 'open'
          if (ticket.status === 'waiting_human') {
            logger.info(`⏰ Timeout! Nenhum atendente aceitou o ticket ${ticket.protocol}. IA assumindo...`);
            ticket.status = 'open';
            await ticket.save();
            
            // Emitir evento de timeout
            if (io) {
              io.emit('ticket_auto_assigned', {
                ticketId: ticket.id,
                reason: 'timeout'
              });
            }
          }
        } catch (error) {
          logger.error('❌ Erro no timeout de atendimento:', error);
        }
      }, 30000); // 30 segundos

    } catch (error) {
      logger.error('❌ Erro ao notificar atendentes:', error);
    }
  }

  /**
   * Emite evento Socket.IO
   */
  emitSocketEvent(event, data) {
    try {
      // Tentar obter io do app global
      const { io } = require('../server');
      if (io) {
        io.emit(event, data);
        logger.info(`📡 Evento Socket.IO emitido: ${event}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Socket.IO não disponível para emitir evento: ${event}`);
    }
  }
}

module.exports = new FlowMessageHandler();

