/**
 * Handler de Mensagens Baseado em Fluxo
 * Processa mensagens usando o sistema completo de fluxos definidos
 */

const logger = require('../utils/logger');
const { isAutoReplyEnabled } = require('../config/bot');
const UserSession = require('../models/UserSessionSQL');
const flowManager = require('./services/flowManager');
const scheduleService = require('./services/scheduleService');
const intentClassifier = require('./services/intentClassifier');
const automationService = require('../services/automationService');
const Ticket = require('../models/TicketSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const Contact = require('../models/ContactSQL');
const inboxConversationService = require('../services/inboxConversationService');
const contactDisplayUtils = require('../utils/contactDisplayUtils');
const { resolveWhatsAppTimestamp } = require('../utils/whatsappMessageUtils');
const AIClassificationLog = require('../models/AIClassificationLog');
const crypto = require('crypto');
const chatMediaUtils = require('../utils/chatMediaUtils');
const chatMediaService = require('../services/chatMediaService');

class FlowMessageHandler {
  /**
   * Resolve corpo da mensagem (texto ou placeholder para mídia)
   */
  resolveMessageBody(message) {
    const type = chatMediaUtils.normalizeMessageType(message.type);
    const hasMedia = Boolean(
      message.hasMedia
      || message.isMedia
      || ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(type)
    );

    if (hasMedia) {
      const caption = message.caption || '';
      if (caption.trim() && !chatMediaUtils.isBase64Payload(caption)) {
        return caption.trim();
      }
      return chatMediaUtils.getMediaPreviewLabel(type, true);
    }

    const body = message.body || '';
    if (body.trim() && !chatMediaUtils.isBase64Payload(body)) {
      return body.trim();
    }

    return chatMediaUtils.getMediaPreviewLabel(type, hasMedia);
  }

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
      const rawName = contact.name || contact.pushName || '';
      const name = contactDisplayUtils.resolveContactNameForStorage(rawName, phone);
      const messageBody = this.resolveMessageBody(message);

      // Ignorar status do WhatsApp, newsletters e mensagens de sistema
      if (!jid || jid.includes('@broadcast') || jid === 'status@broadcast') {
        logger.debug(`⏭️ Mensagem de sistema ignorada: ${jid}`);
        return;
      }

      // Ignorar mensagens vazias (reações sem texto, etc)
      if (!messageBody.trim()) {
        logger.info(`⏭️ Mensagem vazia/sem conteúdo ignorada de ${name} (${phone})`);
        return;
      }

      logger.info(`📨 Mensagem de ${name} (${phone}) JID: ${jid}: ${messageBody.substring(0, 50)}...`);

      const rawId = message.id;
      const incomingMessageId = typeof rawId === 'object'
        ? (rawId._serialized || rawId.id || null)
        : rawId;

      if (incomingMessageId) {
        const existingMessage = await ChatMessage.findOne({
          where: { messageId: incomingMessageId }
        });
        if (existingMessage) {
          logger.debug(`⏭️ Mensagem já sincronizada: ${incomingMessageId}`);
          return;
        }
      }

      // Ignorar replay de histórico durante sincronização em massa
      const whatsappSyncService = require('../services/whatsappSyncService');
      if (whatsappSyncService.syncInProgress) {
        logger.debug(`⏭️ Sync em andamento — mensagem ao vivo ignorada: ${incomingMessageId || 'sem-id'}`);
        return;
      }

      // Criar ou buscar contato
      const whatsappId = contact.id || `${phone}@s.whatsapp.net`;
      let contactRecord = await Contact.findOne({ where: { phone } });
      if (!contactRecord) {
        contactRecord = await Contact.create({
          whatsappId,
          phone,
          name,
          isActive: true,
          source: 'whatsapp_sync'
        });
        logger.info(`✅ Novo contato criado: ${name} (${phone})`);
      } else {
        // Atualizar nome se mudou para um nome real do WhatsApp
        const resolvedName = contactDisplayUtils.resolveContactNameForStorage(rawName, phone);
        if (!contactDisplayUtils.isGenericContactName(resolvedName)
          && contactRecord.name !== resolvedName) {
          contactRecord.name = resolvedName;
          await contactRecord.save();
        }
      }

      // Criar ou buscar conversa (ticket só quando atendente aceitar)
      const conversation = await inboxConversationService.findOrCreateConversation(
        phone,
        name,
        contactRecord.id,
        whatsappId
      );

      if (!contactRecord.profilePicUrl) {
        const whatsappProfilePicService = require('../services/whatsappProfilePicService');
        whatsappProfilePicService.refreshContactProfilePic(contactRecord.id, whatsappId)
          .catch(() => {});
      }

      let ticket = null;
      if (conversation.activeTicketId) {
        ticket = await Ticket.findByPk(conversation.activeTicketId);
      }

      // Salvar mensagem recebida no banco
      const chatMessage = await this.saveIncomingMessage({
        conversationId: conversation.id,
        ticketId: ticket?.id || null,
        contactId: contactRecord.id,
        phone,
        name,
        body: messageBody,
        rawMessage: message,
        whatsappClient
      });

      if (this.isRecentWhatsAppMessage(message, chatMessage)) {
        this.notifyDashboard(conversation, ticket, contactRecord, chatMessage, 'incoming');
      } else {
        logger.debug(`⏭️ Mensagem histórica — sem notificação em tempo real (${incomingMessageId || 'sem-id'})`);
      }

      // Modo manual: sem boas-vindas, IA, fluxos ou automações
      if (!isAutoReplyEnabled) {
        logger.info(`🔇 [MODO MANUAL] Resposta automática desabilitada. Conversa ${conversation.id} aguardando atendente.`);
        return;
      }

      // 👤 VERIFICAR SE TEM ATENDENTE HUMANO ATRIBUÍDO
      if (ticket?.assignedTo && ticket.status === 'in_progress') {
        logger.info(`👤 [ATENDIMENTO HUMANO] Ticket ${ticket.protocol} está com atendente ${ticket.assignedTo}. IA bloqueada.`);
        logger.info(`📨 [ATENDIMENTO HUMANO] Mensagem encaminhada apenas para o atendente. Sem resposta automática.`);
        return;
      }

      const waitingHuman = Boolean(conversation.metadata?.waitingHuman) || ticket?.status === 'waiting_human';

      // 🔔 SE ESTÁ AGUARDANDO ATENDENTE
      if (waitingHuman) {
        logger.info(`⏳ [AGUARDANDO ATENDENTE] Conversa ${conversation.id} aguardando atribuição.`);
        
        await whatsappClient.sendMessage(
          message.from,
          '⏳ *Por favor, aguarde...*\n\nSua solicitação de atendimento já foi registrada e está na fila.\n\nUm de nossos atendentes responderá em breve.\n\n_Obrigado pela paciência!_ 🙏'
        );
        
        return;
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

      // 🤖 VERIFICAR AUTOMAÇÕES INTELIGENTES
      // Verificar se há automação ativa para este contato
      if (automationService.hasActiveExecution(contactRecord.id)) {
        logger.info(`🤖 [AUTOMAÇÃO] Continuando execução ativa para ${name}`);
        const automationResult = await automationService.continueExecution(contactRecord.id, messageBody);
        
        if (automationResult) {
          // Enviar resposta da automação
          await whatsappClient.sendMessage(message.from, automationResult.response.message);
          
          // Salvar resposta no banco
          await this.saveOutgoingMessage({
            conversationId: conversation.id,
            ticketId: ticket?.id || null,
            contactId: contactRecord.id,
            phone,
            body: automationResult.response.message
          });
          
          this.notifyDashboard(conversation, ticket, contactRecord, automationResult.response.message, 'outgoing');
          
          // Se completou e criou ticket, atualizar status
          if (automationResult.execution.status === 'completed' && automationResult.execution.ticketId) {
            logger.info(`✅ [AUTOMAÇÃO] Execução completada com sucesso`);
          }
          
          return;
        }
      } else {
        // Verificar se deve iniciar nova automação
        logger.info(`🎯 [AUTOMAÇÃO] Verificando se mensagem aciona alguma regra...`);
        const automationResult = await automationService.processMessage(
          contactRecord.id,
          messageBody,
          ticket?.id || null
        );
        
        if (automationResult) {
          logger.info(`🤖 [AUTOMAÇÃO] Regra acionada: ${automationResult.response.message}`);
          
          // Enviar resposta da automação
          await whatsappClient.sendMessage(message.from, automationResult.response.message);
          
          // Salvar resposta no banco
          await this.saveOutgoingMessage({
            conversationId: conversation.id,
            ticketId: ticket?.id || null,
            contactId: contactRecord.id,
            phone,
            body: automationResult.response.message
          });
          
          this.notifyDashboard(conversation, ticket, contactRecord, automationResult.response.message, 'outgoing');
          
          // Se precisa de input adicional, aguardar próxima mensagem
          if (automationResult.response.needsInput) {
            const slotPrompt = automationResult.response.slotPrompt || `Por favor, informe ${automationResult.response.nextSlot}:`;
            await whatsappClient.sendMessage(message.from, slotPrompt);
            
            await this.saveOutgoingMessage({
              conversationId: conversation.id,
              ticketId: ticket?.id || null,
              contactId: contactRecord.id,
              phone,
              body: slotPrompt
            });
          }
          
          return; // Não processar fluxo padrão
        }
      }

      // Atualizar última interação
      await session.updateLastInteraction();

      // Processar mensagem baseada no fluxo atual
      const response = await this.processMessageFlow(
        session,
        messageBody,
        whatsappClient,
        conversation,
        ticket,
        message.from
      );

      logger.info(`🎯 Resposta gerada: ${response ? (typeof response === 'object' ? JSON.stringify(response).substring(0, 100) : response.substring(0, 100)) : 'NULL'}`);

      if (response) {
        logger.info(`📤 Enviando resposta para ${jid}...`);
        await this.sendResponse(whatsappClient, jid, response, session, conversation, ticket, contactRecord);
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
        if (isAutoReplyEnabled) {
          await whatsappClient.sendMessage(
            message.from,
            '⚠️ Desculpe, ocorreu um erro. Digite *menu* para recomeçar.'
          );
        }
      } catch (sendError) {
        logger.error('❌ Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }

  /**
   * Processa mensagem baseada no fluxo
   */
  async processMessageFlow(session, messageBody, whatsappClient, conversation = null, ticket = null, jid = null) {
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
          if (conversation && jid) {
            await this.requestHumanAttendance(conversation, whatsappClient, jid, 'Cliente solicitou atendimento humano');
          } else {
            logger.error('❌ Não foi possível solicitar atendimento humano: conversa ou jid não disponível');
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
  async sendResponse(whatsappClient, jid, response, session, conversation, ticket, contact) {
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
            if (conversation && contact) {
              await this.saveOutgoingMessage({
                conversationId: conversation.id,
                ticketId: ticket?.id || conversation.activeTicketId || null,
                contactId: contact.id,
                phone,
                body: textToSend
              });
              this.notifyDashboard(conversation, ticket, contact, textToSend, 'outgoing');
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
              if (conversation && contact) {
                await this.saveOutgoingMessage({
                  conversationId: conversation.id,
                  ticketId: ticket?.id || conversation.activeTicketId || null,
                  contactId: contact.id,
                  phone,
                  body: textToSend
                });
                this.notifyDashboard(conversation, ticket, contact, textToSend, 'outgoing');
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
            if (conversation && contact) {
              await this.saveOutgoingMessage({
                conversationId: conversation.id,
                ticketId: ticket?.id || conversation.activeTicketId || null,
                contactId: contact.id,
                phone,
                body: textToSend
              });
              this.notifyDashboard(conversation, ticket, contact, textToSend, 'outgoing');
            }
          }
        }
        
        // Se tem próximo fluxo, processar
        if (response.next) {
          await this.delay(1000);
          const nextResponse = await this.processMessageFlow(
            session,
            '',
            whatsappClient,
            conversation,
            ticket,
            jid
          );
          if (nextResponse) {
            await this.sendResponse(whatsappClient, jid, nextResponse, session, conversation, ticket, contact);
          }
        }
        
        return;
      }

      // Se é string simples
      if (typeof response === 'string' && response.trim()) {
        await whatsappClient.sendMessage(jid, response);
        // Salvar resposta no banco
        if (conversation && contact) {
          await this.saveOutgoingMessage({
            conversationId: conversation.id,
            ticketId: ticket?.id || conversation.activeTicketId || null,
            contactId: contact.id,
            phone,
            body: response
          });
          this.notifyDashboard(conversation, ticket, contact, response, 'outgoing');
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
   * Salva mensagem recebida no banco
   */
  async saveIncomingMessage({
    conversationId,
    ticketId = null,
    contactId,
    phone,
    name,
    body,
    rawMessage,
    whatsappClient
  }) {
    try {
      const rawId = rawMessage.id;
      const messageId = typeof rawId === 'object'
        ? (rawId._serialized || rawId.id || JSON.stringify(rawId))
        : (rawId || `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`);

      const msgType = chatMediaUtils.normalizeMessageType(rawMessage.type);
      const hasMedia = Boolean(
        rawMessage.hasMedia
        || rawMessage.isMedia
        || ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msgType)
      );

      let mediaUrl = null;
      let mediaType = null;
      let mediaFilename = null;
      let mediaSize = null;

      if (hasMedia && whatsappClient) {
        const saved = await chatMediaService.processIncomingMedia(whatsappClient, rawMessage);
        if (saved) {
          mediaUrl = saved.publicUrl;
          mediaType = saved.mimetype;
          mediaFilename = saved.filename;
          mediaSize = saved.size;
        } else if (chatMediaUtils.isBase64Payload(rawMessage.body)) {
          const fallback = await chatMediaService.saveBase64Body(rawMessage.body, msgType);
          if (fallback) {
            mediaUrl = fallback.publicUrl;
            mediaType = fallback.mimetype;
            mediaFilename = fallback.filename;
            mediaSize = fallback.size;
          }
        }
      }

      const displayBody = chatMediaUtils.sanitizeBodyForDisplay(body, msgType, hasMedia);
      const messageTimestamp = resolveWhatsAppTimestamp(rawMessage) || new Date();

      const chatMessage = await ChatMessage.create({
        messageId,
        conversationId,
        ticketId,
        contactId,
        direction: 'incoming',
        from: phone,
        to: 'bot',
        fromName: name,
        body: displayBody,
        type: hasMedia ? msgType : 'text',
        status: 'delivered',
        fromMe: false,
        hasMedia: Boolean(mediaUrl) || hasMedia,
        mediaUrl,
        mediaType,
        mediaFilename,
        mediaSize,
        timestamp: messageTimestamp,
        createdAt: messageTimestamp,
        updatedAt: messageTimestamp,
        metadata: {
          rawMessageId: rawMessage.id,
          hasMedia
        }
      });

      logger.info(`💾 Mensagem salva no banco: ${messageId}`);

      await inboxConversationService.touchConversation(conversationId, messageTimestamp);
      if (ticketId) {
        await Ticket.update({ updatedAt: messageTimestamp }, { where: { id: ticketId } });
      }

      return chatMessage;
    } catch (error) {
      logger.error('❌ Erro ao salvar mensagem:', error);
      throw error;
    }
  }

  /**
   * Salva mensagem enviada (resposta do bot) no banco
   */
  async saveOutgoingMessage({
    conversationId,
    ticketId = null,
    contactId,
    phone,
    body
  }) {
    try {
      const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const messageTimestamp = new Date();
      
      const chatMessage = await ChatMessage.create({
        messageId,
        conversationId,
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
        timestamp: messageTimestamp,
        createdAt: messageTimestamp,
        updatedAt: messageTimestamp
      });

      logger.info(`📤 Resposta salva no banco: ${messageId}`);

      await inboxConversationService.touchConversation(conversationId, messageTimestamp);
      if (ticketId) {
        await Ticket.update({ updatedAt: messageTimestamp }, { where: { id: ticketId } });
      }
      
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
   * Mensagem recebida agora (não replay de histórico na conexão/sync)
   */
  isRecentWhatsAppMessage(rawMessage, chatMessage) {
    const messageTime = resolveWhatsAppTimestamp(rawMessage)
      || (chatMessage?.timestamp ? new Date(chatMessage.timestamp) : null);

    if (!messageTime || Number.isNaN(messageTime.getTime())) {
      return false;
    }

    const ageMs = Date.now() - messageTime.getTime();
    return ageMs <= 3 * 60 * 1000;
  }

  /**
   * Notifica dashboard sobre nova mensagem
   */
  notifyDashboard(conversation, ticket, contact, chatMessage, direction) {
    try {
      const conversationJson = conversation.toJSON ? conversation.toJSON() : conversation;
      const messagePayload = typeof chatMessage === 'string'
        ? {
            body: chatMessage,
            direction,
            timestamp: new Date(),
            from: direction === 'incoming' ? contact.phone : 'bot'
          }
        : {
            ...chatMessage.toJSON(),
            direction: chatMessage.direction || direction
          };

      this.emitSocketEvent('new_message', {
        conversationId: conversationJson.id,
        ticketId: ticket?.id || null,
        conversation: conversationJson,
        ticket: ticket ? ticket.toJSON() : null,
        contact: contact.toJSON ? contact.toJSON() : contact,
        message: messagePayload
      });

      this.emitSocketEvent('conversation_updated', {
        conversationId: conversationJson.id,
        conversation: { ...conversationJson, updatedAt: new Date() }
      });

      if (ticket) {
        this.emitSocketEvent('ticket_updated', {
          ticketId: ticket.id,
          ticket: { ...ticket.toJSON(), updatedAt: new Date() }
        });
      }
    } catch (error) {
      logger.error('❌ Erro ao notificar dashboard:', error);
    }
  }

  /**
   * IA solicita atendimento humano (sem criar ticket — só ao aceitar)
   */
  async requestHumanAttendance(conversation, whatsappClient, jid, reason = 'Solicitação de atendimento') {
    try {
      logger.info(`🤚 [IA] Solicitando atendimento humano para conversa ${conversation.id}. Motivo: ${reason}`);

      await inboxConversationService.markWaitingHuman(conversation, reason);

      const contact = await Contact.findByPk(conversation.contactId);
      await this.notifyAvailableAgents(conversation, contact, reason);

      await whatsappClient.sendMessage(
        jid,
        '🤝 *Atendimento Humano Solicitado*\n\n' +
        'Entendi que você precisa de um atendimento mais especializado.\n\n' +
        'Estou direcionando você para um de nossos atendentes.\n\n' +
        '⏳ _Por favor, aguarde. Você será atendido em breve._'
      );

      logger.info(`✅ [IA] Atendimento humano solicitado para conversa ${conversation.id}`);
    } catch (error) {
      logger.error('❌ Erro ao solicitar atendimento humano:', error);
    }
  }

  /**
   * Notifica atendentes disponíveis sobre conversa aguardando humano
   */
  async notifyAvailableAgents(conversation, contact, messageBody) {
    try {
      const User = require('../models/UserSQL');

      const availableAgents = await User.findAll({
        where: {
          role: ['agent', 'manager', 'admin'],
          status: 'online'
        }
      });

      if (availableAgents.length === 0) {
        logger.warn('⚠️ Nenhum atendente online disponível!');
        return;
      }

      logger.info(`🔔 Notificando ${availableAgents.length} atendentes disponíveis...`);

      const io = global.io || require('../server').io;
      if (io) {
        io.emit('new_conversation_notification', {
          conversation: conversation.toJSON ? conversation.toJSON() : conversation,
          contact: contact?.toJSON ? contact.toJSON() : contact,
          message: messageBody,
          timestamp: new Date()
        });
      }

      const conversationId = conversation.id;
      setTimeout(async () => {
        try {
          const refreshed = await inboxConversationService.getConversationById(conversationId);
          if (refreshed?.waitingHuman && !refreshed.activeTicketId) {
            logger.info(`⏰ Timeout! Nenhum atendente aceitou a conversa ${conversationId}.`);
            const conv = await require('../models/ConversationSQL').findByPk(conversationId);
            if (conv) {
              await conv.update({
                metadata: { ...(conv.metadata || {}), waitingHuman: false }
              });
            }
            if (io) {
              io.emit('conversation_timeout', { conversationId, reason: 'timeout' });
            }
          }
        } catch (error) {
          logger.error('❌ Erro no timeout de atendimento:', error);
        }
      }, 30000);
    } catch (error) {
      logger.error('❌ Erro ao notificar atendentes:', error);
    }
  }

  /**
   * Emite evento Socket.IO
   */
  emitSocketEvent(event, data) {
    try {
      const io = global.io || require('../server').io;
      if (io) {
        io.emit(event, data);
        logger.info(`📡 Evento Socket.IO emitido: ${event}`);
      } else {
        logger.warn(`⚠️ Socket.IO não disponível para emitir evento: ${event}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Socket.IO não disponível para emitir evento: ${event}`);
    }
  }
}

module.exports = new FlowMessageHandler();

