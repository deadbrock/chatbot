/**
 * Handler de Mensagens Baseado em Fluxo
 * Processa mensagens usando o sistema completo de fluxos definidos
 */

const logger = require('../utils/logger');
const { checkAutoReplyEnabled } = require('../config/bot');
const { getAutoReplyDiagnostics, resolveGroqApiKey } = require('../config/ai');
const UserSession = require('../models/UserSessionSQL');
const flowManager = require('./services/flowManager');
const scheduleService = require('./services/scheduleService');
const intentClassifier = require('./services/intentClassifier');
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
  constructor() {
    this._processingLocks = new Set();
  }

  async withProcessingLock(key, fn) {
    if (!key) return fn();
    if (this._processingLocks.has(key)) {
      logger.info(`⏭️ Mensagem ignorada — processamento em andamento (${key})`);
      return;
    }
    this._processingLocks.add(key);
    try {
      return await fn();
    } finally {
      this._processingLocks.delete(key);
    }
  }
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
   * Resolve telefone real a partir de JID (@lid → número @c.us)
   */
  async resolveInboundIdentity(whatsappClient, contact, message) {
    const rawJid = whatsappClient?.serializeChatId?.(contact?.id || message?.from)
      || contact?.id
      || message?.from
      || '';
    const jid = typeof rawJid === 'string' ? rawJid : String(rawJid || '');
    const prefix = jid.split('@')[0] || '';
    const suffix = jid.split('@')[1] || '';
    let phone = contact?.number || prefix;
    let displayPhone = null;

    if (suffix === 'lid' && whatsappClient && typeof whatsappClient.getPnLidEntry === 'function') {
      try {
        const entry = await whatsappClient.getPnLidEntry(jid);
        const phoneJid = entry?.phoneNumber?._serialized
          || (entry?.phoneNumber?.user
            ? `${entry.phoneNumber.user}@${entry.phoneNumber.server || 'c.us'}`
            : null);
        if (phoneJid && String(phoneJid).includes('@')) {
          displayPhone = String(phoneJid).split('@')[0];
          phone = displayPhone;
        }
      } catch (err) {
        logger.debug(`getPnLidEntry(${jid}): ${err.message}`);
      }
    }

    if (!displayPhone && suffix !== 'lid' && contactDisplayUtils.isValidPhoneDigits(prefix)) {
      displayPhone = prefix;
      phone = prefix;
    }

    const whatsappId = displayPhone
      ? `${displayPhone.replace(/\D/g, '')}@s.whatsapp.net`
      : jid;

    return { jid, phone, displayPhone: displayPhone || phone, whatsappId };
  }

  async findOrCreateUserSession(phoneKeys, defaults = {}) {
    for (const key of phoneKeys.filter(Boolean)) {
      const session = await UserSession.findOne({ where: { phone: key } });
      if (session) return session;
    }

    const primaryPhone = phoneKeys.find(Boolean);
    return UserSession.create({
      phone: primaryPhone,
      currentFlow: 'initial',
      currentStep: 'start',
      menuPath: [],
      ...defaults
    });
  }

  /**
   * Handler principal - Processa mensagem do usuário
   * @param {Object} whatsappClient - Cliente WhatsApp (Baileys)
   * @param {Object} message - Mensagem recebida
   * @param {Object} contact - Contato que enviou
   */
  async handleMessage(whatsappClient, message, contact) {
    const identity = await this.resolveInboundIdentity(whatsappClient, contact, message);
    const lockKey = identity.jid || identity.phone;
    return this.withProcessingLock(lockKey, () => this._handleMessageCore(whatsappClient, message, contact, identity));
  }

  async _handleMessageCore(whatsappClient, message, contact, identity) {
    try {
      const { jid, phone, displayPhone, whatsappId } = identity;
      const sessionPhoneKeys = [...new Set([displayPhone, phone, jid.split('@')[0]].filter(Boolean))];

      const rawName = contact.name || contact.pushName || message?.notifyName || '';
      const name = contactDisplayUtils.resolveContactNameForStorage(rawName, displayPhone || phone);
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
          const isLiveMessage = this.isRecentWhatsAppMessage(message, existingMessage);
          if (!isLiveMessage) {
            logger.debug(`⏭️ Mensagem histórica já sincronizada: ${incomingMessageId}`);
            return;
          }
          logger.debug(`♻️ Mensagem ao vivo já salva (${incomingMessageId}) — processando resposta automática`);
        }
      }

      // Durante sync em massa, ignorar apenas replay de histórico (não mensagens ao vivo)
      const whatsappSyncService = require('../services/whatsappSyncService');
      if (whatsappSyncService.syncInProgress && !this.isRecentWhatsAppMessage(message, null)) {
        logger.debug(`⏭️ Sync em andamento — mensagem histórica ignorada: ${incomingMessageId || 'sem-id'}`);
        return;
      }

      const employeeContactService = require('../services/employeeContactService');

      let { conversation, employee } = await inboxConversationService.findOrCreateConversationByIdentity(
        displayPhone || phone,
        name,
        jid
      );

      if (!employee && conversation?.contactId) {
        const linkedContact = await Contact.findByPk(conversation.contactId);
        if (employeeContactService.isRegisteredEmployee(linkedContact)) {
          employee = linkedContact;
        }
      }

      if (!employee && conversation?.userPhone) {
        try {
          employee = await employeeContactService.findEmployeeByPhone({
            phone: conversation.userPhone,
            whatsappId: whatsappId || jid
          });
        } catch (employeeErr) {
          logger.error('❌ Erro ao buscar funcionário (continuando sem perfil):', employeeErr.message);
        }
      }

      let contactRecord = employee;

      let session = await this.findOrCreateUserSession(sessionPhoneKeys, {
        name: name ? name.split(' ')[0] : null
      });

      // Migrar sessão de @lid para telefone real quando identificado
      const canonicalPhone = displayPhone || phone;
      if (session && canonicalPhone && session.phone !== canonicalPhone && !sessionPhoneKeys.includes(session.phone)) {
        await session.update({ phone: canonicalPhone });
      }

      if (employee) {
        try {
          await employeeContactService.hydrateSessionFromEmployee(session, employee);
          logger.info(`👤 Funcionário identificado: ${employee.name} (${employee.contract || 'sem contrato'})`);
        } catch (hydrateErr) {
          logger.error('❌ Erro ao hidratar sessão do funcionário:', hydrateErr.message);
        }

        const legacyFlows = [
          'main_menu', 'client_menu', 'administrative_menu', 'dp_menu',
          'benefits_menu', 'leave_menu', 'maintenance_menu', 'purchasing_menu',
          'billing_menu', 'hr_menu', 'safety_menu', 'management_menu',
          'client_flow', 'prospect_flow', 'employee_flow', 'supplier_flow',
          'termination_flow', 'materials_request', 'ask_name'
        ];
        if (legacyFlows.includes(session.currentFlow) || session.currentFlow?.endsWith('_menu') || session.currentFlow?.endsWith('_flow')) {
          session.currentFlow = 'initial';
          session.currentStep = 'ask_subject';
          await session.save();
        }
      } else if (session.currentStep === 'ask_name') {
        session.currentStep = 'ask_subject';
        await session.save();
      } else if (name && !session.name) {
        session.name = name.split(' ')[0];
        await session.save();
      }

      if (contactRecord?.profilePicUrl == null && contactRecord?.id) {
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
        contactId: contactRecord?.id || null,
        phone,
        name: employee?.name || name,
        body: messageBody,
        rawMessage: message,
        whatsappClient
      });

      if (this.isRecentWhatsAppMessage(message, chatMessage)) {
        this.notifyDashboard(conversation, ticket, contactRecord || { name, phone }, chatMessage, 'incoming');
      } else {
        logger.debug(`⏭️ Mensagem histórica — sem notificação em tempo real (${incomingMessageId || 'sem-id'})`);
      }

      // Modo manual: sem boas-vindas, IA, fluxos ou automações
      if (!checkAutoReplyEnabled()) {
        const diag = getAutoReplyDiagnostics();
        logger.info(`🔇 [MODO MANUAL] Resposta automática desabilitada (${diag.reason}). Conversa ${conversation.id}`);
        return;
      }

      if (session.currentFlow === 'nps_evaluation') {
        const postAttendanceService = require('../services/postAttendanceService');
        const stillWaitingRating = await postAttendanceService.ensureActiveRatingFlow(
          session,
          conversation
        );

        if (stillWaitingRating) {
          const response = await this.handleNPSEvaluation(
            session,
            messageBody,
            conversation,
            ticket
          );
          if (response) {
            await this.sendResponse(
              whatsappClient,
              jid,
              response,
              session,
              conversation,
              ticket,
              contactRecord
            );
          }
          return;
        }

        await session.reload();
      }

      // 👤 VERIFICAR SE TEM ATENDENTE HUMANO ATRIBUÍDO
      if (ticket?.assignedTo && ticket.status === 'in_progress') {
        if (this.isSelfFinishRequest(messageBody)) {
          logger.info(`✅ [AUTO-FINALIZAR] Cliente solicitou encerramento do ticket ${ticket.protocol}`);
          await inboxConversationService.finishConversation(
            conversation.id,
            { id: ticket.assignedTo, role: 'agent', name: 'Sistema' },
            { initiatedBy: 'customer' }
          );
          return;
        }

        logger.info(`👤 [ATENDIMENTO HUMANO] Ticket ${ticket.protocol} está com atendente ${ticket.assignedTo}. IA bloqueada.`);
        logger.info(`📨 [ATENDIMENTO HUMANO] Mensagem encaminhada apenas para o atendente. Sem resposta automática.`);
        return;
      }

      const waitingHuman = (
        Boolean(conversation.metadata?.waitingHuman) || ticket?.status === 'waiting_human'
      ) && ticket?.status !== 'in_progress';

      // 🔔 SE ESTÁ AGUARDANDO ATENDENTE
      if (waitingHuman) {
        logger.info(`⏳ [AGUARDANDO ATENDENTE] Conversa ${conversation.id} aguardando atribuição.`);
        
        await whatsappClient.sendMessage(
          message.from,
          '⏳ *Por favor, aguarde...*\n\nSua solicitação de atendimento já foi registrada e está na fila.\n\nUm de nossos atendentes responderá em breve.\n\n_Obrigado pela paciência!_ 🙏'
        );
        
        return;
      }

      // Sessão já obtida/criada acima (com perfil de funcionário quando aplicável)

      // Verificar se sessão expirou (24h inatividade)
      if (session.expiresAt && new Date() > session.expiresAt) {
        logger.info(`⏰ Sessão expirada para ${phone}, resetando...`);
        await session.reset();
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
        message.from,
        contactRecord
      );

      logger.info(`🎯 Resposta gerada: ${response ? (typeof response === 'object' ? JSON.stringify(response).substring(0, 100) : response.substring(0, 100)) : 'NULL'}`);

      if (response) {
        logger.info(`📤 Enviando resposta para ${jid}...`);
        await this.sendResponse(whatsappClient, jid, response, session, conversation, ticket, contactRecord);
      } else {
        logger.warn(`⚠️ Nenhuma resposta gerada! Fluxo: ${session.currentFlow}, Step: ${session.currentStep}`);
        const fallback = this.buildAIFallbackMessage(session);
        await this.sendResponse(whatsappClient, jid, fallback, session, conversation, ticket, contactRecord);
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
        if (checkAutoReplyEnabled()) {
          if (typeof session !== 'undefined' && session) {
            session.currentFlow = 'initial';
            session.currentStep = 'ask_subject';
            await session.save().catch(() => {});
          }
          await whatsappClient.sendMessage(
            message.from,
            '⚠️ Desculpe, ocorreu um erro. Digite *CANCELAR* para recomeçar.'
          );
        }
      } catch (sendError) {
        logger.error('❌ Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }

  /**
   * Detecta comando de cancelamento
   */
  isCancelCommand(messageBody) {
    const normalized = String(messageBody || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return ['cancelar', 'cancel', 'sair', 'reset', 'reiniciar', 'recomecar', 'voltar'].includes(normalized);
  }

  /**
   * Reseta sessão ao receber CANCELAR
   */
  async handleCancelFlow(session) {
    const wasEmployee = this.isRegisteredEmployeeSession(session);
    const employeeFormData = wasEmployee ? { ...(session.formData || {}) } : null;
    const firstName = this.getEmployeeFirstName(session);

    await session.reset();

    if (wasEmployee && employeeFormData) {
      session.formData = employeeFormData;
      session.name = firstName;
    }

    session.currentFlow = 'initial';
    session.currentStep = 'ask_subject';
    await session.save();

    const namePart = firstName && firstName !== 'colaborador(a)' ? `, *${firstName}*` : '';
    return `${this.getGreeting()}${namePart}! ✅\n\nAtendimento *cancelado* e reiniciado.\n\nCom qual *assunto* posso te ajudar agora?\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._`;
  }

  /**
   * Fallback quando a IA não classifica — pede descrição livre (sem menu fixo)
   */
  buildAIFallbackMessage(session) {
    const firstName = (session.name || '').split(' ')[0];
    const greeting = this.getGreeting();
    const namePart = firstName ? `, *${firstName}*` : '';
    return `${greeting}${namePart}! 😊\n\nNão consegui identificar seu assunto com clareza.\n\nPor favor, *descreva com suas palavras* o que você precisa (ex.: holerite, férias, afastamento de colaborador, manutenção de equipamento).\n\n_Digite *CANCELAR* para recomeçar._`;
  }

  buildAfastamentoMenuMessage(session) {
    const firstName = (session.name || '').split(' ')[0];
    const namePart = firstName ? `, *${firstName}*` : '';
    return `${this.getGreeting()}${namePart}! Entendi — você precisa tratar um *afastamento*.\n\nQual tipo?\n\n1️⃣ Licença maternidade\n2️⃣ Licença paternidade\n3️⃣ Outro tipo de afastamento\n\n_Responda com o número da opção._\n\n_Digite *CANCELAR* para recomeçar._`;
  }

  /**
   * Detecta assunto localmente (keywords) antes de depender só da API
   */
  applyLocalSubjectDetection(session, messageBody) {
    const intentClassifier = require('./services/intentClassifier');
    const details = intentClassifier.resolveSubjectDetails(messageBody);
    if (!details) return null;

    const formData = { ...(session.formData || {}) };
    formData.last_intent = details.intent || formData.last_intent;
    formData.subject = details.subject || formData.subject;
    if (details.dpTopic) formData.dpTopic = details.dpTopic;
    if (details.menuContext) formData.menu_context = details.menuContext;

    if (details.needsMenu) {
      formData.awaiting_menu_choice = true;
      session.formData = formData;
      return {
        response: this.buildAfastamentoMenuMessage(session),
        shouldRoute: false
      };
    }

    session.formData = formData;
    return {
      intent: details.intent,
      subject: details.subject,
      dpTopic: details.dpTopic,
      shouldRoute: Boolean(details.shouldRoute),
      confidence: details.confidence || 0.8
    };
  }

  normalizeText(value = '') {
    return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  messageHasNumberedMenu(text) {
    const t = String(text || '');
    return /\b1[\.\)\-:\u2013]/m.test(t) && /\b2[\.\)\-:\u2013]/m.test(t);
  }

  /**
   * Resolve escolha numérica de menu gerado pela IA
   */
  resolveMenuSelection(session, messageBody) {
    const trimmed = String(messageBody || '').trim();
    const formData = session.formData || {};

    if (!/^\d+$/.test(trimmed)) return null;
    if (!formData.awaiting_menu_choice && session.currentFlow !== 'ai_chat') return null;

    const option = parseInt(trimmed, 10);
    if (option < 1 || option > 9) return null;

    const intent = formData.last_intent || 'dp';
    const baseSubject = formData.last_subject || formData.subject || 'Assunto';
    const context = this.normalizeText(`${baseSubject} ${formData.menu_context || ''} ${formData.ai_topic || ''}`);

    if (intent === 'dp' && (context.includes('afastamento') || formData.menu_context === 'afastamento')) {
      const map = {
        1: { subject: 'Licença maternidade', dpTopic: 'Afastamentos' },
        2: { subject: 'Licença paternidade', dpTopic: 'Afastamentos' },
        3: { subject: 'Outro tipo de afastamento', dpTopic: 'Outros e Afastamentos' }
      };
      const pick = map[option];
      if (pick) {
        return { intent: 'dp', shouldRoute: true, ...pick };
      }
    }

    return {
      enrichedMessage: `${baseSubject} — opção ${option}`,
      shouldRoute: false
    };
  }

  /**
   * Persiste contexto da conversa com IA para próximas mensagens
   */
  saveAIConversationContext(session, { classification, responseText, originalMessage }) {
    const formData = { ...(session.formData || {}) };
    const intent = classification?.intent;

    if (intent) formData.last_intent = intent;
    if (classification?.dpTopic) formData.dpTopic = classification.dpTopic;

    formData.last_subject = formData.subject || originalMessage;
    formData.subject = formData.subject || originalMessage;

    const response = String(responseText || '');
    formData.awaiting_menu_choice = this.messageHasNumberedMenu(response);

    const ctx = this.normalizeText(`${originalMessage} ${formData.last_subject || ''}`);
    if (ctx.includes('afastamento')) formData.menu_context = 'afastamento';

    session.formData = formData;
  }

  /**
   * Confirma assunto e direciona ao atendente humano correspondente
   */
  async confirmSubjectAndRoute(session, routingInfo, whatsappClient, conversation, ticket, jid, contact) {
    const ticketRoutingService = require('../services/ticketRoutingService');
    const intent = routingInfo.intent || session.formData?.last_intent || 'dp';
    const subject = routingInfo.subject || routingInfo.dpTopic || session.formData?.subject || 'Atendimento';
    const dpTopic = routingInfo.dpTopic || session.formData?.dpTopic || null;
    const departmentLabel = this.getIntentLabel(intent);

    const formData = { ...(session.formData || {}) };
    formData.subject = subject;
    formData.dpTopic = dpTopic || formData.dpTopic;
    formData.awaiting_menu_choice = false;
    formData.collecting_data = false;
    formData.department = departmentLabel;
    formData.departmentId = intent === 'dp' ? 'dp' : intent;
    session.formData = formData;
    session.currentFlow = 'wait_for_agent';
    session.currentStep = 'active';
    await session.save();

    if (!conversation) {
      return `✅ Entendi! Sua solicitação sobre *${subject}* foi registrada.\n\n⏳ _Aguarde, em breve um atendente entrará em contato._`;
    }

    const employeeContactService = require('../services/employeeContactService');
    const profileComplete = employeeContactService.employeeProfileIsComplete(formData);
    const descriptionParts = [];
    if (formData.nome_completo) descriptionParts.push(`Nome: ${formData.nome_completo}`);
    if (formData.contrato) descriptionParts.push(`Contrato: ${formData.contrato}`);
    if (formData.cargo) descriptionParts.push(`Cargo: ${formData.cargo}`);
    descriptionParts.push(`Assunto: ${subject}`);
    const description = descriptionParts.join('\n');

    let routing = null;
    try {
      if (intent === 'dp') {
        routing = await ticketRoutingService.routeDPTicket({
          topic: dpTopic,
          subject,
          description,
          userMessage: subject,
          department: departmentLabel
        });
      } else {
        routing = await ticketRoutingService.routeTicket({
          departmentId: intent,
          department: departmentLabel,
          subject,
          description,
          userMessage: subject
        });
      }
    } catch (routeErr) {
      logger.error('❌ Erro no roteamento (seguindo para fila humana):', routeErr.message);
    }

    let activeTicket = ticket;
    if (conversation.activeTicketId) {
      activeTicket = await Ticket.findByPk(conversation.activeTicketId) || ticket;
    }

    if (activeTicket) {
      activeTicket.subject = subject;
      activeTicket.department = departmentLabel;
      activeTicket.departmentId = formData.departmentId;
      activeTicket.description = description;
      activeTicket.status = 'waiting_human';
      if (routing?.agentId) {
        activeTicket.assignedTo = routing.agentId;
        activeTicket.assignedAt = new Date();
      }
      await activeTicket.save();
    } else {
      const protocol = await Ticket.generateProtocol();
      activeTicket = await Ticket.create({
        protocol,
        userId: conversation.contactId || String(conversation.id),
        userName: formData.nome_completo || session.name || conversation.displayName || 'Contato',
        userPhone: session.phone || conversation.userPhone,
        conversationId: conversation.id,
        department: departmentLabel,
        departmentId: formData.departmentId,
        status: 'waiting_human',
        subject,
        description,
        assignedTo: routing?.agentId || null,
        assignedAt: routing?.agentId ? new Date() : null,
        messages: [],
        attachments: []
      });
      await conversation.update({ activeTicketId: activeTicket.id });
    }

    const reason = `${departmentLabel} — ${subject}`;
    await this.syncConversationAfterRouting(
      session,
      conversation,
      contact,
      activeTicket,
      routing,
      reason
    );

    const agentPart = routing?.agentName
      ? `*${routing.agentName}* (${routing.topicLabel || departmentLabel})`
      : `nossa equipe de *${departmentLabel}*`;

    logger.info(`🎯 Assunto confirmado e roteado: ${subject} → ${routing?.agentName || 'fila'}`);

    return `✅ Perfeito! Registrei sua solicitação sobre *${subject}*.\n\n🎯 Estou direcionando você para ${agentPart}.\n\n⏳ _Por favor, aguarde — em breve você será atendido._\n\n_Digite *CANCELAR* para recomeçar._`;
  }

  /**
   * Monta resposta final a partir da classificação da IA
   */
  buildAIUserResponse(session, classification, options = {}) {
    const userMessage = classification.userMessage
      || classification.rawResponse?.userMessage
      || classification.reasoning;

    if (userMessage && String(userMessage).trim().length > 20) {
      return String(userMessage).trim();
    }

    const label = this.getIntentLabel(classification.intent);
    const greeting = options.skipGreeting ? '' : `${this.getGreeting()}! 😊\n\n`;
    return `${greeting}Entendi! Vou te ajudar com *${label}*.\n\nMe conte mais detalhes sobre sua solicitação.\n\n_Digite *CANCELAR* para recomeçar._`;
  }

  /**
   * Processa mensagem baseada no fluxo
   */
  async processMessageFlow(session, messageBody, whatsappClient, conversation = null, ticket = null, jid = null, contact = null) {
    const currentFlow = session.currentFlow;
    const currentStep = session.currentStep;

    logger.info(`🔄 Processando fluxo: ${currentFlow}, step: ${currentStep}`);

    if (this.isCancelCommand(messageBody)) {
      return await this.handleCancelFlow(session);
    }

    const legacyFlows = [
      'main_menu', 'client_menu', 'administrative_menu', 'dp_menu',
      'benefits_menu', 'leave_menu', 'maintenance_menu', 'purchasing_menu',
      'billing_menu', 'hr_menu', 'safety_menu', 'management_menu',
      'client_flow', 'prospect_flow', 'employee_flow', 'supplier_flow',
      'termination_flow', 'materials_request'
    ];
    if (legacyFlows.includes(currentFlow) || currentFlow?.endsWith('_menu') || currentFlow?.endsWith('_flow')) {
      logger.info(`♻️ Fluxo legado "${currentFlow}" — redirecionando para IA`);
      session.currentFlow = 'ai_chat';
      session.currentStep = 'active';
      await session.save();
      return await this.processWithAI(session, messageBody, whatsappClient, conversation, ticket, jid, contact);
    }

    const formDataCheck = session.formData || {};
    if (formDataCheck.collecting_data === true) {
      logger.info(`📋 [COLETA DE DADOS] Processando dados fornecidos pelo usuário...`);
      return await this.handleDataCollection(session, messageBody);
    }

    // Fluxo inicial — boas-vindas
    if (currentFlow === 'initial' && currentStep === 'start') {
      const trimmed = (messageBody || '').trim();
      const isGenericGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí|eai|hello|hi)[!.?\s]*$/i.test(trimmed);

      if (!isGenericGreeting && trimmed.length >= 3) {
        session.currentStep = 'ask_subject';
        await session.save();
        return await this.processWithAI(session, messageBody, whatsappClient, conversation, ticket, jid, contact);
      }

      if (this.isRegisteredEmployeeSession(session)) {
        return await this.handleEmployeeFirstContact(session, messageBody);
      }
      return await this.handleInitialFlow(session);
    }

    if (currentFlow === 'initial' && currentStep === 'ask_name') {
      session.currentStep = 'ask_subject';
      await session.save();
    }

    if (currentFlow === 'initial' && currentStep === 'ask_subject') {
      const trimmed = (messageBody || '').trim();
      const isGenericGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí|eai|hello|hi)[!.?\s]*$/i.test(trimmed);
      if (isGenericGreeting || !trimmed) {
        const firstName = (session.name || '').split(' ')[0];
        const namePart = firstName ? `, *${firstName}*` : '';
        return `${this.getGreeting()}${namePart}! 😊\n\nCom qual *assunto* posso te ajudar hoje?\n\n_Ex.: holerite, férias, manutenção, financeiro..._\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._`;
      }
      return await this.processWithAI(session, messageBody, whatsappClient, conversation, ticket, jid, contact);
    }

    if (currentFlow === 'initial' && currentStep === 'collect_offline_message') {
      return await this.handleOfflineMessage(session, messageBody);
    }

    if (currentFlow === 'wait_for_agent' || currentFlow === 'agent_conversation') {
      return await this.handleAgentConversation(session, messageBody);
    }

    if (currentFlow === 'nps_evaluation') {
      const postAttendanceService = require('../services/postAttendanceService');
      const stillWaitingRating = await postAttendanceService.ensureActiveRatingFlow(
        session,
        conversation
      );
      if (stillWaitingRating) {
        return await this.handleNPSEvaluation(session, messageBody, conversation, ticket);
      }
      await session.reload();
    }

    // Demais mensagens: somente IA (sem menus automáticos legados)
    return await this.processWithAI(session, messageBody, whatsappClient, conversation, ticket, jid, contact);
  }

  /**
   * Processamento exclusivo via IA
   */
  async processWithAI(session, messageBody, whatsappClient, conversation = null, ticket = null, jid = null, contact = null) {
    try {
      const menuPick = this.resolveMenuSelection(session, messageBody);
      if (menuPick?.shouldRoute) {
        return await this.confirmSubjectAndRoute(
          session, menuPick, whatsappClient, conversation, ticket, jid, contact
        );
      }

      const localSubject = this.applyLocalSubjectDetection(session, messageBody);
      if (localSubject?.response) {
        await session.save();
        return localSubject.response;
      }
      if (localSubject?.shouldRoute && conversation) {
        return await this.confirmSubjectAndRoute(
          session,
          localSubject,
          whatsappClient,
          conversation,
          ticket,
          jid,
          contact
        );
      }

      const bodyForAI = menuPick?.enrichedMessage || messageBody;
      const aiResult = await this.tryAIClassification(session, bodyForAI);

      if (aiResult?.needsHuman) {
        logger.info(`🤚 [IA] Solicitou atendimento humano`);
        if (conversation && jid) {
          await this.requestHumanAttendance(conversation, whatsappClient, jid, 'Cliente solicitou atendimento humano');
        }
        return `✅ Entendi! Vou te conectar com um *atendente humano*.\n\n⏳ _Aguarde — em breve alguém da nossa equipe continuará o atendimento._\n\n_Digite *CANCELAR* para recomeçar._`;
      }

      if (aiResult?.shouldRoute && conversation) {
        return await this.confirmSubjectAndRoute(
          session,
          {
            intent: aiResult.intent,
            subject: aiResult.subject || session.formData?.subject,
            dpTopic: aiResult.dpTopic || session.formData?.dpTopic
          },
          whatsappClient,
          conversation,
          ticket,
          jid,
          contact
        );
      }

      if (aiResult?.response) {
        session.currentFlow = 'ai_chat';
        session.currentStep = 'active';
        await session.save();
        return aiResult.response;
      }

      // IA sem resposta — tentar detecção local novamente
      const localFallback = this.applyLocalSubjectDetection(session, messageBody);
      if (localFallback?.response) {
        await session.save();
        return localFallback.response;
      }
      if (localFallback?.shouldRoute && conversation) {
        return await this.confirmSubjectAndRoute(
          session, localFallback, whatsappClient, conversation, ticket, jid, contact
        );
      }

      // Com contexto de menu ativo, não desistir — reinterpretar seleção
      const formData = session.formData || {};
      if (formData.awaiting_menu_choice && /^\d+$/.test(String(messageBody || '').trim())) {
        const fallbackPick = this.resolveMenuSelection(session, messageBody);
        if (fallbackPick?.shouldRoute) {
          return await this.confirmSubjectAndRoute(
            session, fallbackPick, whatsappClient, conversation, ticket, jid, contact
          );
        }
      }

      return this.buildAIFallbackMessage(session);
    } catch (error) {
      logger.error('❌ Erro no processWithAI:', error);
      return this.buildAIFallbackMessage(session);
    }
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

          if (response.transferToAgent && conversation) {
            await this.handleTransferToAgent(session, conversation, contact, response, ticket);
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
        if (conversation) {
          await this.saveOutgoingMessage({
            conversationId: conversation.id,
            ticketId: ticket?.id || conversation.activeTicketId || null,
            contactId: contact?.id || null,
            phone,
            body: response
          });
          this.notifyDashboard(conversation, ticket, contact || { name: conversation.displayName, phone }, response, 'outgoing');
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

  isRegisteredEmployeeSession(session) {
    const formData = session?.formData || {};
    return Boolean(formData.is_employee && formData.employee_profile_loaded);
  }

  getEmployeeFirstName(session) {
    const fullName = session?.formData?.nome_completo || session?.name || '';
    const first = fullName.trim().split(/\s+/)[0];
    return first || 'colaborador(a)';
  }

  buildEmployeeWelcome(session) {
    const greeting = this.getGreeting();
    const firstName = this.getEmployeeFirstName(session);
    const formData = session?.formData || {};
    let message = `${greeting}, *${firstName}*! 😊\n\n`;
    message += 'Seja muito bem-vindo(a) ao atendimento da *FG SERVICES*! 🌟\n\n';
    message += '_Excelência para quem faz com excelência_\n\n';
    message += 'Identifiquei seu cadastro como *colaborador*';
    if (formData.contrato) {
      message += ` no contrato *${formData.contrato}*`;
    }
    if (formData.cargo) {
      message += ` — cargo: *${formData.cargo}*`;
    }
    message += '.';
    return message;
  }

  formatAIResponse(response) {
    if (!response) return '';
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response.message) return String(response.message);
    return '';
  }

  async handleEmployeeFirstContact(session, messageBody) {
    const schedule = scheduleService.isBusinessHours();
    const welcome = this.buildEmployeeWelcome(session);

    if (!schedule.isOpen) {
      session.currentStep = 'collect_offline_message';
      await session.save();

      const nextOpenFormatted = scheduleService.formatNextOpen(schedule.nextOpen);
      return {
        message: `${welcome}\n\n⏰ *No momento estamos fora do horário de atendimento.*\n\n📅 Segunda a Sexta • 8h–12h | 13h–17h\n\n${nextOpenFormatted ? `Retornaremos: ${nextOpenFormatted}\n\n` : ''}💬 Pode deixar sua mensagem que retornaremos assim que possível!`
      };
    }

    const trimmed = (messageBody || '').trim();
    const isGenericGreeting = !trimmed || /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí|eai|hello|hi)[!.?\s]*$/i.test(trimmed);

    if (!isGenericGreeting) {
      const localSubject = this.applyLocalSubjectDetection(session, trimmed);
      if (localSubject?.response) {
        await session.save();
        return `${welcome}\n\n${localSubject.response}`;
      }

      const aiResult = await this.tryAIClassification(session, trimmed, { skipGreeting: true });
      if (aiResult?.response) {
        const aiText = this.formatAIResponse(aiResult.response);
        return `${welcome}\n\n${aiText}`;
      }
    }

    session.currentFlow = 'initial';
    session.currentStep = 'ask_subject';
    await session.save();

    return `${welcome}\n\nCom qual *assunto* posso te ajudar hoje?\n\n_Ex.: holerite, férias, vale transporte, manutenção de equipamento..._\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._`;
  }

  async handleEmployeeAskSubject(session, messageBody, whatsappClient, conversation, ticket, jid, contact) {
    return await this.processWithAI(session, messageBody, whatsappClient, conversation, ticket, jid, contact);
  }

  async handleInitialFlow(session) {
    const schedule = scheduleService.isBusinessHours();
    const greeting = this.getGreeting();

    if (this.isRegisteredEmployeeSession(session)) {
      return this.handleEmployeeFirstContact(session, '');
    }

    const firstName = (session.name || '').split(' ')[0];
    const namePart = firstName ? `${firstName}, ` : '';

    if (schedule.isOpen) {
      session.currentStep = 'ask_subject';
      await session.save();

      return {
        message: `${greeting}! ${namePart}😊\n\nSeja muito bem-vindo(a) ao atendimento da *FG SERVICES*! 🌟\n\n_Excelência para quem faz com excelência_\n\nCom qual *assunto* posso te ajudar hoje?\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._`
      };
    }

    session.currentStep = 'collect_offline_message';
    await session.save();

    const nextOpenFormatted = scheduleService.formatNextOpen(schedule.nextOpen);

    return {
      message: `${greeting}! ${namePart}😊\n\nSeja bem-vindo(a) ao atendimento da *FG SERVICES*! 🌟\n\n_Excelência para quem faz com excelência_\n\n⏰ *No momento estamos fora do horário de atendimento.*\n\n📅 Segunda a Sexta • 8h–12h | 13h–17h\n\n${nextOpenFormatted ? `Retornaremos: ${nextOpenFormatted}\n\n` : ''}💬 Pode deixar sua mensagem que retornaremos assim que possível!`
    };
  }

  /**
   * Pergunta nome (se não tiver)
   */
  async handleAskName(session, messageBody) {
    if (this.isRegisteredEmployeeSession(session)) {
      return this.handleEmployeeFirstContact(session, messageBody);
    }

    const trimmed = (messageBody || '').trim();
    const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí|eai|hello|hi)[!.?\s]*$/i.test(trimmed);

    if (isGreeting || !trimmed) {
      session.currentFlow = 'initial';
      session.currentStep = 'ask_subject';
      await session.save();
      const firstName = (session.name || 'visitante').split(' ')[0];
      return `${this.getGreeting()}, *${firstName}*! 😊\n\nCom qual *assunto* posso te ajudar hoje?\n\n_Ex.: holerite, férias, manutenção, financeiro..._\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._`;
    }

    if (!session.name || session.name.length < 2) {
      session.name = trimmed.split(' ')[0];
      await session.save();
    }

    session.currentFlow = 'initial';
    session.currentStep = 'ask_subject';
    await session.save();

    return `${this.getGreeting()}, *${session.name}*! 😊\n\nCom qual *assunto* posso te ajudar hoje?`;
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
    return '\n\n_Digite *CANCELAR* a qualquer momento para recomeçar._';
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
    logger.info(`💬 Mensagem em atendimento humano de ${session.phone}: ${messageBody}`);
    return null;
  }

  /**
   * Detecta pedido do cliente para encerrar o atendimento
   */
  isSelfFinishRequest(messageBody = '') {
    const normalized = this.normalizeText(String(messageBody || ''));
    const patterns = [
      'finalizar atendimento',
      'encerrar atendimento',
      'pode encerrar',
      'pode finalizar',
      'quero encerrar',
      'quero finalizar',
      'nao preciso mais',
      'não preciso mais',
      'obrigado pode encerrar',
      'obrigada pode encerrar',
      'concluir atendimento',
      'terminar atendimento',
      '#finalizar',
      '#encerrar'
    ];

    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return true;
    }

    return /^(finalizar|encerrar|concluir|terminar)[!.?\s]*$/i.test(String(messageBody || '').trim());
  }

  /**
   * Avaliação pós-atendimento (1 a 5 estrelas)
   */
  async handleNPSEvaluation(session, messageBody, conversation = null, ticket = null) {
    const postAttendanceService = require('../services/postAttendanceService');
    const score = parseInt(String(messageBody || '').trim(), 10);

    if (!Number.isFinite(score) || score < 1 || score > 5) {
      return {
        message: '❌ Por favor, responda com uma nota de *1 a 5* para avaliar o atendimento.'
      };
    }

    const ticketId = session.formData?.pendingRatingTicketId
      || conversation?.metadata?.lastFinishedTicketId
      || ticket?.id;

    if (!ticketId) {
      session.currentFlow = 'initial';
      session.currentStep = 'ask_subject';
      await session.save();
      return { message: postAttendanceService.FAREWELL_MESSAGE };
    }

    await postAttendanceService.submitRating({ session, score, ticketId });

    if (conversation) {
      await conversation.update({
        metadata: {
          ...(conversation.metadata || {}),
          awaitingRating: false
        }
      });
    }

    return {
      message: `${postAttendanceService.FAREWELL_MESSAGE}\n\n_Obrigado pela sua avaliação (${score}/5)!_ 🙏`
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

      const existing = await ChatMessage.findOne({ where: { messageId } });
      if (existing) {
        logger.debug(`💾 Mensagem já existia no banco: ${messageId}`);
        await inboxConversationService.touchConversation(conversationId, messageTimestamp);
        return existing;
      }

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
   * 🧠 Classifica intenção com IA e retorna mensagem gerada pela IA
   */
  async tryAIClassification(session, messageBody, options = {}) {
    try {
      const formData = session.formData || {};
      const userContext = {
        name: session.name,
        currentFlow: session.currentFlow,
        currentStep: session.currentStep,
        is_employee: Boolean(formData.is_employee),
        employee_profile_loaded: Boolean(formData.employee_profile_loaded),
        contrato: formData.contrato || null,
        cargo: formData.cargo || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        formData
      };

      const classification = await intentClassifier.classify(messageBody, userContext);

      if (!classification) {
        logger.info('🤖 IA: Sem resposta da classificação — tentando keywords locais');
        const localDetails = intentClassifier.resolveSubjectDetails(messageBody);
        if (localDetails) {
          const formData = session.formData || {};
          if (localDetails.intent) formData.last_intent = localDetails.intent;
          if (localDetails.subject) formData.subject = localDetails.subject;
          if (localDetails.dpTopic) formData.dpTopic = localDetails.dpTopic;
          session.formData = formData;
          await session.save();

          if (localDetails.needsMenu) {
            formData.awaiting_menu_choice = true;
            formData.menu_context = localDetails.menuContext || 'afastamento';
            session.formData = formData;
            await session.save();
            return {
              flow: 'ai_chat',
              intent: localDetails.intent,
              response: this.buildAfastamentoMenuMessage(session),
              shouldRoute: false
            };
          }

          const isEmployee = this.isRegisteredEmployeeSession(session);
          const shouldRoute = Boolean(localDetails.shouldRoute)
            && localDetails.intent
            && (isEmployee || !this.needsDataCollection(localDetails.intent));

          return {
            flow: 'ai_chat',
            intent: localDetails.intent,
            dpTopic: localDetails.dpTopic,
            subject: localDetails.subject,
            confidence: localDetails.confidence || 0.8,
            response: shouldRoute ? null : this.buildAIUserResponse(session, {
              intent: localDetails.intent,
              reasoning: localDetails.subject
            }, options),
            shouldRoute
          };
        }
        return null;
      }

      const threshold = intentClassifier.config.confidenceThreshold || 0.5;
      const hasUserMessage = Boolean(
        classification.userMessage && String(classification.userMessage).trim().length > 10
      );

      if (classification.confidence < threshold && !hasUserMessage) {
        logger.info(`🤖 IA: Confiança baixa (${classification.confidence}), sem userMessage`);
        return null;
      }

      logger.info('✅ IA classificou:', {
        intent: classification.intent,
        confidence: classification.confidence,
        method: classification.method,
        hasUserMessage
      });

      await this.logAIClassification(session, messageBody, classification);

      if (classification.intent === 'atendimento_humano' || classification.flow === 'human_handoff') {
        logger.info('🤚 [IA] Detectou necessidade de atendimento humano');
        return {
          flow: 'human_handoff',
          confidence: classification.confidence,
          response: null,
          needsHuman: true
        };
      }

      if (classification.intent === 'dp' && classification.dpTopic) {
        formData.dpTopic = classification.dpTopic;
        formData.subject = classification.dpTopic;
        session.formData = formData;
      }

      if (classification.intent) {
        formData.last_intent = classification.intent;
        session.formData = formData;
      }

      const response = this.buildAIUserResponse(session, classification, options);
      this.saveAIConversationContext(session, {
        classification,
        responseText: response,
        originalMessage: messageBody
      });

      session.currentFlow = 'ai_chat';
      session.currentStep = 'active';
      await session.save();

      const updatedFormData = session.formData || {};
      const isEmployee = this.isRegisteredEmployeeSession(session);
      const routeThreshold = isEmployee ? 0.55 : 0.75;
      const shouldRoute = !updatedFormData.awaiting_menu_choice
        && classification.confidence >= routeThreshold
        && classification.intent
        && classification.intent !== 'atendimento_humano'
        && (isEmployee || !this.needsDataCollection(classification.intent));

      return {
        flow: 'ai_chat',
        intent: classification.intent,
        dpTopic: classification.dpTopic || updatedFormData.dpTopic,
        subject: updatedFormData.subject,
        confidence: classification.confidence,
        response,
        shouldRoute
      };

    } catch (error) {
      logger.error('❌ Erro na classificação por IA:', error);
      return null;
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
    const employeeContactService = require('../services/employeeContactService');
    const formData = session.formData || {};

    if (employeeContactService.employeeProfileIsComplete(formData)) {
      logger.info('👤 Perfil de funcionário já cadastrado — pulando coleta de dados');
      return null;
    }

    let message = '';

    const missingData = [];
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
              topic: formData.dpTopic || formData.subject,
              subject: ticket.subject || formData.subject,
              description: ticket.description,
              userMessage: messageBody,
              department: formData.department || 'Departamento Pessoal',
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
        intent: classification.intent || 'desconhecido',
        targetFlow: classification.flow || 'ai_chat',
        confidence: classification.confidence || 0,
        method: classification.method || 'keywords',
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
      // Sem timestamp confiável: tratar como ao vivo para não perder resposta
      return true;
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
   * Sincroniza conversa/ticket após roteamento e notifica painel + atendente
   */
  async syncConversationAfterRouting(session, conversation, contact, ticket, routing, reason) {
    const pendingAcceptance = Boolean(routing?.agentId && ticket?.status === 'waiting_human');
    const metadata = {
      ...(conversation.metadata || {}),
      waitingHuman: pendingAcceptance || !routing?.agentId,
      pendingAcceptance,
      waitingHumanReason: reason,
      waitingHumanAt: new Date().toISOString(),
      suggestedAgentId: routing?.agentId || null,
      suggestedAgentName: routing?.agentName || null,
      assignedAgentId: routing?.agentId || ticket?.assignedTo || null,
      dpTopic: routing?.topicLabel || session.formData?.dpTopic || null,
      dpDepartment: session.formData?.department || null,
      routedAt: new Date().toISOString()
    };

    await conversation.update({
      activeTicketId: ticket?.id || conversation.activeTicketId,
      metadata
    });

    await this.notifyAvailableAgents(conversation, contact, reason, routing, ticket);

    try {
      const enriched = await inboxConversationService.getConversationById(conversation.id);
      this.emitSocketEvent('conversation_updated', {
        conversationId: conversation.id,
        conversation: enriched
      });
      this.emitSocketEvent('ticket_updated', {
        ticketId: ticket.id,
        ticket: ticket.toJSON ? ticket.toJSON() : ticket
      });
    } catch (notifyErr) {
      logger.error('❌ Erro ao notificar painel após roteamento:', notifyErr.message);
    }

    if (routing?.agentId) {
      logger.info(`✅ Ticket ${ticket.protocol} direcionado a ${routing.agentName} (ID ${routing.agentId}) — aguardando aceite`);
    } else {
      logger.warn(`⚠️ Ticket ${ticket.protocol} na fila waiting_human — nenhum atendente encontrado no roteamento`);
    }
  }

  /**
   * Encaminha conversa para atendente humano com roteamento por tema do DP
   */
  async handleTransferToAgent(session, conversation, contact, response, ticket, routing = null) {
    try {
      const ticketRoutingService = require('../services/ticketRoutingService');
      const formData = session.formData || {};
      const topic = response.topic || formData.dpTopic || formData.subject;
      const department = response.department || formData.department || 'Departamento Pessoal';
      const reason = topic
        ? `Atendimento DP — ${topic}`
        : `Atendimento — ${department}`;

      const resolvedRouting = routing || await ticketRoutingService.routeDPTicket({
        topic,
        department,
        subject: topic || department,
        description: formData.nome_completo ? `Nome: ${formData.nome_completo}` : '',
        userMessage: formData.subject || topic || department
      });

      if (ticket && resolvedRouting?.agentId && !ticket.assignedTo) {
        ticket.assignedTo = resolvedRouting.agentId;
        ticket.assignedAt = new Date();
        ticket.status = 'waiting_human';
        await ticket.save();
      }

      await this.syncConversationAfterRouting(
        session,
        conversation,
        contact,
        ticket,
        resolvedRouting,
        reason
      );
    } catch (error) {
      logger.error('❌ Erro ao encaminhar para atendente:', error);
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
  async notifyAvailableAgents(conversation, contact, messageBody, routing = null, ticket = null) {
    try {
      const User = require('../models/UserSQL');
      const { Op } = require('sequelize');
      const chatSocketService = global.chatSocketService;
      const enriched = await inboxConversationService.getConversationById(conversation.id);

      const payload = {
        conversation: enriched || (conversation.toJSON ? conversation.toJSON() : conversation),
        contact: contact?.toJSON ? contact.toJSON() : contact,
        message: messageBody,
        ticketId: ticket?.id || enriched?.activeTicketId || null,
        suggestedAgentId: routing?.agentId || null,
        suggestedAgentName: routing?.agentName || null,
        dpTopic: routing?.topicLabel || null,
        timestamp: new Date()
      };

      if (routing?.agentId && chatSocketService) {
        chatSocketService.emitToUser(routing.agentId, 'ticket_assigned_to_you', {
          ...payload,
          protocol: ticket?.protocol || enriched?.activeTicket?.protocol,
          subject: ticket?.subject || enriched?.activeTicket?.subject,
          targetUserId: routing.agentId
        });
        logger.info(`🔔 Notificação enviada ao atendente ${routing.agentName} (ID ${routing.agentId})`);
        return;
      }

      const managers = await User.findAll({
        where: {
          role: 'manager',
          active: true,
          status: 'online'
        },
        attributes: ['id', 'name']
      });

      if (managers.length === 0) {
        logger.warn('⚠️ Nenhum gestor online para fila sem roteamento específico');
        return;
      }

      logger.info(`🔔 Notificando ${managers.length} gestor(es) sobre fila sem atendente definido`);

      if (chatSocketService) {
        for (const manager of managers) {
          chatSocketService.emitToUser(manager.id, 'new_conversation_notification', {
            ...payload,
            targetUserId: manager.id
          });
        }
      }
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

