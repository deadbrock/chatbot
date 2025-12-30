const logger = require('../utils/logger');
const simpleResponder = require('./simpleResponder');
const messages = require('../config/messages');
const { 
  generateDepartmentMenu, 
  findDepartmentByKeywords,
  getDepartmentById,
  getAllDepartments
} = require('../config/departments');
const SessionManager = require('../services/sessionManager');
const TicketService = require('../services/ticketService');
const flowEngine = require('../services/flowEngine');

class MessageHandler {
  constructor() {
    this.sessionManager = new SessionManager();
    this.ticketService = new TicketService();
    
    // Comandos disponíveis
    this.commands = {
      'menu': this.handleMenuCommand.bind(this),
      'departamentos': this.handleDepartmentsCommand.bind(this),
      'protocolo': this.handleProtocolCommand.bind(this),
      'atendente': this.handleHumanCommand.bind(this),
      'rastrear': this.handleTrackingCommand.bind(this),
      'faq': this.handleFaqCommand.bind(this),
      'avaliar': this.handleRatingCommand.bind(this),
      'cancelar': this.handleCancelCommand.bind(this),
      'sair': this.handleExitCommand.bind(this),
      'help': this.handleHelpCommand.bind(this),
      '0': this.handleMenuCommand.bind(this)
    };
  }

  /**
   * Handler principal de mensagens
   */
  async handle(message, session, whatsappClient) {
    try {
      const from = message.from;
      const text = message.body.trim();

      // Marcar como lida
      await whatsappClient.markAsRead(message);

      // Mostrar "digitando..."
      await whatsappClient.sendTyping(from, 2000);

      // Processar diferentes tipos de mensagem
      if (message.hasMedia) {
        return await this.handleMediaMessage(message, session, whatsappClient);
      }

      if (message.type === 'ptt' || message.type === 'audio') {
        return await this.handleVoiceMessage(message, session, whatsappClient);
      }

      // Verificar se é primeira mensagem
      if (!session.data.welcomed) {
        return await this.handleFirstMessage(message, session, whatsappClient);
      }

      // Verificar comandos
      const command = text.toLowerCase();
      if (this.commands[command]) {
        return await this.commands[command](message, session, whatsappClient);
      }

      // Verificar se é número (opção de menu)
      if (/^\d+$/.test(text)) {
        return await this.handleNumericOption(message, session, whatsappClient);
      }

      // Verificar se está em fluxo customizado (flowEngine)
      if (session.flowContext) {
        return await this.handleCustomFlow(message, session, whatsappClient);
      }

      // Verificar se está em fluxo específico (legado)
      if (session.data.currentFlow) {
        return await this.handleFlowMessage(message, session, whatsappClient);
      }

      // Verificar se existe fluxo customizado para o texto
      const customFlow = await flowEngine.findFlow(text.toLowerCase(), 'keyword');
      if (customFlow) {
        await flowEngine.startFlow(customFlow.id, from);
        const result = await flowEngine.executeStep(from, 0);
        if (result && result.content) {
          await whatsappClient.sendMessage(from, result.content);
        }
        return;
      }

      // Processar com resposta simples/IA
      return await this.handleAIMessage(message, session, whatsappClient);

    } catch (error) {
      logger.error('Erro no message handler:', error);
      await whatsappClient.sendMessage(
        message.from,
        messages.error.general
      );
    }
  }

  /**
   * Primeira mensagem do usuário
   */
  async handleFirstMessage(message, whatsappClient) {
    const from = message.from;
    const contact = await message.getContact();
    const name = contact.pushname || contact.name || 'Cliente';

    // Atualizar sessão
    await this.sessionManager.updateSession(from, {
      welcomed: true,
      userName: name
    });

    // Enviar boas-vindas
    await whatsappClient.sendMessage(from, messages.welcome.first_time);
    
    // Aguardar um pouco e enviar menu
    setTimeout(async () => {
      await whatsappClient.sendMessage(from, messages.mainMenu);
    }, 1500);
  }

  /**
   * Opção numérica do menu
   */
  async handleNumericOption(message, session, whatsappClient) {
    const from = message.from;
    const option = message.body.trim();

    // Se tem fluxo ativo, deixar handleFlowMessage processar
    if (session.data.currentFlow) {
      return await this.handleFlowMessage(message, session, whatsappClient);
    }

    // Menu principal
    switch (option) {
      case '1':
        return await this.handleDepartmentsCommand(message, session, whatsappClient);
      case '2':
        return await this.handleProtocolCommand(message, session, whatsappClient);
      case '3':
        return await this.handleHumanCommand(message, session, whatsappClient);
      case '4':
        return await this.handleFaqCommand(message, session, whatsappClient);
      case '5':
        return await this.handleRatingCommand(message, session, whatsappClient);
      case '0':
        return await this.handleMenuCommand(message, session, whatsappClient);
      default:
        // Pode ser opção de departamento
        await this.handleDepartmentSelection(message, session, whatsappClient);
    }
  }

  /**
   * Selecionar departamento por número
   */
  async handleDepartmentSelection(message, session, whatsappClient) {
    const from = message.from;
    const num = parseInt(message.body.trim());
    
    const departments = getAllDepartments();
    if (num > 0 && num <= departments.length) {
      const dept = departments[num - 1];
      await this.transferToDepartment(from, dept.id, session, whatsappClient);
    } else {
      await whatsappClient.sendMessage(from, messages.error.invalid_option);
    }
  }

  /**
   * Transferir para departamento
   */
  async transferToDepartment(userId, deptId, session, whatsappClient) {
    try {
      const dept = getDepartmentById(deptId);
      if (!dept) {
        await whatsappClient.sendMessage(userId, messages.error.invalid_option);
        return;
      }

      // Atualizar sessão
      await this.sessionManager.updateSession(userId, {
        currentDepartment: deptId
      });

      // Criar/atualizar ticket
      const ticket = await this.ticketService.getOrCreateTicket(userId);
      await this.ticketService.updateTicket(ticket.id, {
        department: dept.name,
        departmentId: deptId,
        status: dept.autoResponses ? 'open' : 'waiting_human'
      });

      // Mensagem de transferência
      await whatsappClient.sendMessage(userId, messages.success.transferred(dept.name));

      // Notificar dashboard via Socket.IO
      this.notifyDashboard('ticket:updated', {
        ticketId: ticket.id,
        userId,
        department: dept.name,
        status: ticket.status
      });

      // Mensagem específica do departamento
      setTimeout(async () => {
        const deptMessage = this.getDepartmentWelcome(dept);
        await whatsappClient.sendMessage(userId, deptMessage);
      }, 1000);

    } catch (error) {
      logger.error('Erro ao transferir para departamento:', error);
      await whatsappClient.sendMessage(userId, messages.error.general);
    }
  }

  /**
   * Mensagem de boas-vindas do departamento
   */
  getDepartmentWelcome(dept) {
    const base = `${dept.emoji} *${dept.name.toUpperCase()}*\n\n${dept.description}\n\n`;
    
    if (dept.id === 'logistica') {
      return base + `Como posso ajudar?\n\n*1* - Rastrear pedido\n*2* - Agendar coleta\n*3* - Falar com atendente\n\nOu descreva sua necessidade!`;
    }
    
    if (dept.id === 'ti') {
      return base + `Como posso ajudar?\n\n*1* - Resetar senha\n*2* - Suporte remoto\n*3* - Abrir chamado\n*4* - Falar com atendente`;
    }
    
    if (dept.id === 'comercial') {
      return base + `Como posso ajudar?\n\n*1* - Solicitar orçamento\n*2* - Ver catálogo\n*3* - Falar com vendedor\n\nOu me conte o que precisa!`;
    }

    if (dept.id === 'rh') {
      return base + `Como posso ajudar?\n\n*1* - Vagas abertas\n*2* - Enviar currículo\n*3* - Consultar benefícios\n*4* - Falar com RH`;
    }
    
    // Padrão
    return base + `Como posso ajudar você hoje?\n\nDescreva sua necessidade ou digite *atendente* para falar com alguém do time! 😊`;
  }

  /**
   * Mensagem processada com sistema simples (sem IA)
   */
  async handleAIMessage(message, session, whatsappClient) {
    const from = message.from;
    const text = message.body;

    try {
      // Processar com sistema simples
      const aiResult = await simpleResponder.processMessage(from, text, {
        userName: session.userName,
        department: session.currentDepartment
      });

      // Verificar se sugeriu departamento
      if (aiResult.suggestedDepartment) {
        const dept = aiResult.suggestedDepartment;
        
        await whatsappClient.sendMessage(
          from,
          `${aiResult.response}\n\n📌 Identifiquei que sua dúvida é sobre *${dept.name}*.\n\nDeseja que eu te direcione para lá?\n\n*1.* Sim\n*2.* Não, quero outro departamento`
        );

        // Salvar departamento sugerido na sessão
        await this.sessionManager.updateSession(from, {
          suggestedDepartment: dept.id,
          currentFlow: 'department_confirmation'
        });

      } else {
        // Resposta normal
        await whatsappClient.sendMessage(from, aiResult.response);

        // Sugerir próxima ação baseado no sentimento
        if (aiResult.sentiment === 'negative') {
          setTimeout(async () => {
            await whatsappClient.sendMessage(
              from,
              '😔 Percebo que você pode estar insatisfeito. Gostaria de falar com um atendente humano?\n\n*1.* Sim\n*2.* Não'
            );
            await this.sessionManager.updateSession(from, {
              currentFlow: 'human_transfer_confirmation'
            });
          }, 2000);
        }
      }

      // Registrar interação no ticket
      const ticket = await this.ticketService.getOrCreateTicket(from);
      await this.ticketService.addMessage(ticket.id, {
        from: 'user',
        message: text,
        timestamp: new Date()
      });
      await this.ticketService.addMessage(ticket.id, {
        from: 'bot',
        message: aiResult.response,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Erro ao processar com IA:', error);
      await whatsappClient.sendMessage(from, messages.error.not_understood);
    }
  }

  /**
   * Mensagem em fluxo customizado (flowEngine)
   */
  async handleCustomFlow(message, session, whatsappClient) {
    const from = message.from;
    const text = message.body.trim();

    try {
      const result = await flowEngine.processUserResponse(from, text);
      
      if (!result) {
        // Fluxo terminou ou erro
        return;
      }

      if (result.type === 'validation_error' || result.type === 'error') {
        await whatsappClient.sendMessage(from, result.message);
        return;
      }

      if (result.type === 'flow_ended') {
        await whatsappClient.sendMessage(from, result.message);
        return;
      }

      // Enviar resposta do step
      if (result.content || result.message || result.question || result.prompt) {
        const messageToSend = result.content || result.message || result.question || result.prompt;
        await whatsappClient.sendMessage(from, messageToSend);
      }

    } catch (error) {
      logger.error('Erro ao processar fluxo customizado:', error);
      await whatsappClient.sendMessage(from, 'Desculpe, ocorreu um erro. Digite *menu* para recomeçar.');
      await flowEngine.endFlow(from, 'error');
    }
  }

  /**
   * Mensagem em fluxo específico (legado)
   */
  async handleFlowMessage(message, session, whatsappClient) {
    const from = message.from;
    const text = message.body.trim();
    const flow = session.data.currentFlow;

    switch (flow) {
      case 'department_confirmation':
        if (text === '1') {
          const deptId = session.data.suggestedDepartment;
          await this.transferToDepartment(from, deptId, session, whatsappClient);
        } else {
          await whatsappClient.sendMessage(from, generateDepartmentMenu());
        }
        await this.sessionManager.updateSession(from, {
          currentFlow: null,
          suggestedDepartment: null
        });
        break;

      case 'human_transfer_confirmation':
        if (text === '1') {
          await this.handleHumanCommand(message, session, whatsappClient);
        } else {
          await whatsappClient.sendMessage(from, 'Ok! Como posso ajudar?');
        }
        await this.sessionManager.updateSession(from, {
          currentFlow: null
        });
        break;

      case 'rating':
        await this.handleRatingResponse(message, session, whatsappClient);
        break;

      case 'scheduling':
        await this.handleSchedulingFlow(message, session, whatsappClient);
        break;

      case 'faq':
        await this.handleFaqResponse(message, session, whatsappClient);
        break;

      default:
        await this.handleAIMessage(message, session, whatsappClient);
    }
  }

  /**
   * Mensagem de mídia (imagem, documento, etc)
   */
  async handleMediaMessage(message, session, whatsappClient) {
    const from = message.from;

    try {
      await whatsappClient.sendMessage(from, messages.document.received);

      const media = await message.downloadMedia();
      
      // Salvar mídia e anexar ao ticket
      const ticket = await this.ticketService.getOrCreateTicket(from);
      await this.ticketService.attachMedia(ticket.id, {
        mimetype: media.mimetype,
        data: media.data,
        filename: media.filename || `file_${Date.now()}`
      });

      await whatsappClient.sendMessage(from, messages.document.processed);

    } catch (error) {
      logger.error('Erro ao processar mídia:', error);
      await whatsappClient.sendMessage(from, messages.document.error);
    }
  }

  /**
   * Mensagem de voz (desabilitado por enquanto)
   */
  async handleVoiceMessage(message, session, whatsappClient) {
    const from = message.from;

    try {
      await whatsappClient.sendMessage(
        from,
        '🎤 Desculpe, o processamento de áudio está temporariamente desabilitado.\n\nPor favor, envie sua mensagem em texto. 😊'
      );
    } catch (error) {
      logger.error('Erro ao processar áudio:', error);
    }
  }

  /**
   * Comando: menu
   */
  async handleMenuCommand(message, session, whatsappClient) {
    await whatsappClient.sendMessage(message.from, messages.mainMenu);
  }

  /**
   * Comando: departamentos
   */
  async handleDepartmentsCommand(message, session, whatsappClient) {
    await whatsappClient.sendMessage(message.from, generateDepartmentMenu());
  }

  /**
   * Comando: protocolo
   */
  async handleProtocolCommand(message, session, whatsappClient) {
    const from = message.from;
    const tickets = await this.ticketService.getUserTickets(from);

    if (tickets.length === 0) {
      await whatsappClient.sendMessage(
        from,
        '📋 Você não possui protocolos abertos no momento.'
      );
      return;
    }

    let response = '*📋 SEUS PROTOCOLOS*\n\n';
    tickets.forEach(ticket => {
      response += `🎫 *${ticket.protocol}*\n`;
      response += `Status: ${this.getStatusEmoji(ticket.status)} ${this.formatStatus(ticket.status)}\n`;
      response += `Departamento: ${ticket.department}\n`;
      response += `Criado: ${this.formatDate(ticket.createdAt)}\n\n`;
    });

    await whatsappClient.sendMessage(from, response);
  }

  /**
   * Comando: atendente (transferir para humano)
   */
  async handleHumanCommand(message, session, whatsappClient) {
    const from = message.from;

    await whatsappClient.sendMessage(from, messages.human.connecting);

    // Criar/atualizar ticket
    const ticket = await this.ticketService.getOrCreateTicket(from);
    await this.ticketService.updateTicket(ticket.id, {
      status: 'waiting_human',
      requestedHumanAt: new Date()
    });

    // Notificar dashboard
    this.notifyDashboard('ticket:waiting_human', {
      ticketId: ticket.id,
      userId: from,
      userName: session.userName,
      department: ticket.department,
      protocol: ticket.protocol
    });

    // Calcular posição na fila
    const queuePosition = await this.ticketService.getQueuePosition(from);

    await whatsappClient.sendMessage(
      from,
      messages.human.queue(queuePosition)
    );
  }

  /**
   * Comando: rastrear
   */
  async handleTrackingCommand(message, session, whatsappClient) {
    const from = message.from;
    
    await whatsappClient.sendMessage(
      from,
      '📦 *RASTREAMENTO*\n\nPor favor, informe o número do pedido (ex: 123456):'
    );

    await this.sessionManager.updateSession(from, {
      currentFlow: 'tracking',
      awaitingInput: 'order_number'
    });
  }

  /**
   * Comando: faq
   */
  async handleFaqCommand(message, session, whatsappClient) {
    const from = message.from;
    
    await whatsappClient.sendMessage(from, messages.faq.menu);
    
    await this.sessionManager.updateSession(from, {
      currentFlow: 'faq'
    });
  }

  /**
   * Resposta ao FAQ
   */
  async handleFaqResponse(message, session, whatsappClient) {
    const from = message.from;
    const option = message.body.trim();

    if (option === '0') {
      await this.handleMenuCommand(message, session, whatsappClient);
      await this.sessionManager.updateSession(from, { currentFlow: null });
      return;
    }

    const answer = messages.faq.answers[option];
    if (answer) {
      await whatsappClient.sendMessage(from, answer);
      setTimeout(async () => {
        await whatsappClient.sendMessage(from, '\nPosso ajudar com mais alguma coisa?\n\nDigite *menu* ou *faq* para voltar.');
      }, 1000);
    } else {
      await whatsappClient.sendMessage(from, messages.error.invalid_option);
    }

    await this.sessionManager.updateSession(from, { currentFlow: null });
  }

  /**
   * Comando: avaliar
   */
  async handleRatingCommand(message, session, whatsappClient) {
    const from = message.from;
    
    await whatsappClient.sendMessage(from, messages.closing.rating);
    
    await this.sessionManager.updateSession(from, {
      currentFlow: 'rating'
    });
  }

  /**
   * Resposta à avaliação
   */
  async handleRatingResponse(message, session, whatsappClient) {
    const from = message.from;
    const rating = parseInt(message.body.trim());

    if (rating >= 1 && rating <= 5) {
      // Salvar avaliação no ticket
      const ticket = await this.ticketService.getOrCreateTicket(from);
      await this.ticketService.updateTicket(ticket.id, {
        rating,
        ratedAt: new Date()
      });

      // Notificar dashboard
      this.notifyDashboard('ticket:rated', {
        ticketId: ticket.id,
        rating,
        userId: from
      });

      await whatsappClient.sendMessage(from, messages.closing.thanks(rating));
    } else {
      await whatsappClient.sendMessage(
        from,
        '❌ Avaliação inválida. Por favor, escolha um número de 1 a 5.'
      );
      return;
    }

    await this.sessionManager.updateSession(from, { currentFlow: null });
  }

  /**
   * Fluxo de agendamento
   */
  async handleSchedulingFlow(message, session, whatsappClient) {
    const from = message.from;
    const text = message.body.trim();

    // Implementar lógica de agendamento (simplificado)
    await whatsappClient.sendMessage(
      from,
      '📅 *AGENDAMENTO*\n\nEsta funcionalidade estará disponível em breve!\n\nPor enquanto, digite *atendente* para agendar com nossa equipe. 😊'
    );

    await this.sessionManager.updateSession(from, { currentFlow: null });
  }

  /**
   * Comando: cancelar
   */
  async handleCancelCommand(message, session, whatsappClient) {
    const from = message.from;
    
    await this.sessionManager.updateSession(from, {
      currentFlow: null,
      awaitingInput: null
    });

    await whatsappClient.sendMessage(from, messages.commands.cancelled);
  }

  /**
   * Comando: sair
   */
  async handleExitCommand(message, session, whatsappClient) {
    const from = message.from;
    
    await whatsappClient.sendMessage(from, messages.closing.confirm);
    
    await this.sessionManager.updateSession(from, {
      currentFlow: 'exit_confirmation'
    });
  }

  /**
   * Comando: help
   */
  async handleHelpCommand(message, session, whatsappClient) {
    await whatsappClient.sendMessage(message.from, messages.commands.help);
  }

  /**
   * Notificar dashboard via Socket.IO
   */
  notifyDashboard(event, data) {
    try {
      const io = global.io || require('../server').io;
      if (io) {
        io.emit(event, data);
        logger.info(`Dashboard notificado: ${event}`, data);
      }
    } catch (error) {
      logger.error('Erro ao notificar dashboard:', error);
    }
  }

  // Helpers
  getStatusEmoji(status) {
    const emojis = {
      'open': '🟢',
      'waiting_human': '🟡',
      'in_progress': '🔵',
      'resolved': '✅',
      'closed': '⚫'
    };
    return emojis[status] || '⚪';
  }

  formatStatus(status) {
    const statuses = {
      'open': 'Aberto',
      'waiting_human': 'Aguardando atendente',
      'in_progress': 'Em andamento',
      'resolved': 'Resolvido',
      'closed': 'Fechado'
    };
    return statuses[status] || status;
  }

  formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleString('pt-BR');
  }
}

module.exports = MessageHandler;
