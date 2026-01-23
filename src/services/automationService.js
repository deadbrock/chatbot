const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const models = sequelize.models;
const Groq = require('groq-sdk');

/**
 * Serviço de Automação Inteligente
 * Processa mensagens, detecta intenções e executa automações
 */
class AutomationService {
  constructor() {
    this.activeExecutions = new Map(); // Armazena execuções em andamento
    this.groqClient = null;
  }

  /**
   * Inicializa cliente Groq
   */
  getGroqClient() {
    if (!this.groqClient && process.env.GROQ_API_KEY) {
      this.groqClient = new Groq({
        apiKey: process.env.GROQ_API_KEY
      });
    }
    return this.groqClient;
  }

  /**
   * Processa uma mensagem e verifica se deve executar alguma automação
   */
  async processMessage(contactId, message, ticketId = null) {
    try {
      logger.info(`🤖 [AUTOMATION] Processando mensagem de contato ${contactId}`);

      // 1. Detectar intenção da mensagem
      const intent = await this.detectIntent(message);
      logger.info(`🎯 [AUTOMATION] Intenção detectada: ${intent.name} (${intent.confidence}%)`);

      // 2. Buscar regras ativas que correspondam à intenção
      const rules = await this.findMatchingRules(intent, message);
      
      if (rules.length === 0) {
        logger.info('ℹ️ [AUTOMATION] Nenhuma regra correspondente encontrada');
        return null;
      }

      // 3. Executar a regra de maior prioridade
      const rule = rules[0];
      logger.info(`✅ [AUTOMATION] Executando regra: ${rule.name}`);

      const execution = await this.executeRule(rule, contactId, message, ticketId, intent);
      
      return execution;

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao processar mensagem:', error);
      return null;
    }
  }

  /**
   * Detecta a intenção de uma mensagem usando IA
   */
  async detectIntent(message) {
    try {
      const client = this.getGroqClient();
      
      if (!client) {
        // Fallback: detecção simples sem IA
        return this.detectIntentSimple(message);
      }

      const systemPrompt = `Você é um classificador de intenções para um sistema de atendimento empresarial.
Analise a mensagem do usuário e identifique a intenção principal.

INTENÇÕES POSSÍVEIS:
- saudacao: Saudações, olá, bom dia, etc.
- salario: Dúvidas sobre pagamento, salário, holerite
- ferias: Dúvidas sobre férias, períodos, saldo
- beneficios: Questões sobre vale-transporte, alimentação, plano de saúde
- rh: Contratação, demissão, documentos RH
- financeiro: Pagamentos, reembolsos, notas fiscais
- manutencao: Problemas com equipamentos, reparos
- logistica: Entregas, transportes, pedidos
- reclamacao: Reclamações, insatisfações
- elogio: Elogios, agradecimentos
- cancelamento: Pedidos de cancelamento
- informacao: Pedidos de informação geral
- outro: Outras intenções

Responda APENAS com um JSON no formato:
{
  "intent": "nome_da_intencao",
  "confidence": 85,
  "entities": {}
}`;

      const response = await client.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        name: result.intent || 'outro',
        confidence: result.confidence || 50,
        entities: result.entities || {}
      };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao detectar intenção:', error);
      return this.detectIntentSimple(message);
    }
  }

  /**
   * Detecção simples de intenção (fallback)
   */
  detectIntentSimple(message) {
    const msg = message.toLowerCase();
    
    const keywords = {
      saudacao: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'e ai'],
      salario: ['salário', 'salario', 'pagamento', 'holerite', 'recibo', 'deposito'],
      ferias: ['férias', 'ferias', 'descanso', 'recesso'],
      beneficios: ['vale', 'benefício', 'beneficio', 'plano', 'seguro', 'alimentação'],
      rh: ['contratação', 'contratacao', 'demissão', 'demissao', 'rh', 'recursos humanos'],
      financeiro: ['financeiro', 'reembolso', 'nota fiscal', 'pagamento'],
      manutencao: ['manutenção', 'manutencao', 'reparo', 'conserto', 'quebrado'],
      logistica: ['entrega', 'transporte', 'pedido', 'envio'],
      reclamacao: ['reclamação', 'reclamacao', 'problema', 'insatisfeito', 'ruim'],
      elogio: ['parabéns', 'parabens', 'obrigado', 'agradeco', 'excelente', 'ótimo']
    };

    for (const [intent, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (msg.includes(word)) {
          return {
            name: intent,
            confidence: 70,
            entities: {}
          };
        }
      }
    }

    return {
      name: 'outro',
      confidence: 50,
      entities: {}
    };
  }

  /**
   * Busca regras que correspondem à intenção detectada
   */
  async findMatchingRules(intent, message) {
    try {
      const rules = await models.AutomationRule.findAll({
        where: {
          isActive: true
        },
        order: [['priority', 'ASC']]
      });

      const matchingRules = rules.filter(rule => {
        if (rule.triggerType === 'always') return true;
        if (rule.triggerType === 'intent' && rule.triggerValue === intent.name) return true;
        if (rule.triggerType === 'keyword' && message.toLowerCase().includes(rule.triggerValue.toLowerCase())) return true;
        return false;
      });

      return matchingRules;

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao buscar regras:', error);
      return [];
    }
  }

  /**
   * Executa uma regra de automação
   */
  async executeRule(rule, contactId, message, ticketId, intent) {
    try {
      // Criar registro de execução
      const execution = await models.AutomationExecution.create({
        ruleId: rule.id,
        contactId,
        ticketId,
        status: 'started',
        missingSlots: rule.requiredSlots || [],
        metadata: { intent: intent.name, initialMessage: message }
      });

      // Armazenar em memória para continuar coleta
      this.activeExecutions.set(contactId, {
        executionId: execution.id,
        ruleId: rule.id,
        missingSlots: [...(rule.requiredSlots || [])],
        collectedSlots: {},
        currentStep: 0
      });

      // Incrementar contador
      await rule.increment('executionCount');
      await rule.update({ lastExecutedAt: new Date() });

      // Enviar mensagem de saudação
      const response = {
        message: rule.greetingMessage || 'Olá! Vou te ajudar com sua solicitação.',
        needsInput: (rule.requiredSlots || []).length > 0,
        nextSlot: (rule.requiredSlots || [])[0] || null,
        slotPrompt: rule.slotPrompts ? rule.slotPrompts[(rule.requiredSlots || [])[0]] : null
      };

      if (response.needsInput) {
        execution.status = 'collecting';
        await execution.save();
      }

      return {
        execution,
        response
      };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao executar regra:', error);
      throw error;
    }
  }

  /**
   * Continua a coleta de dados de uma execução ativa
   */
  async continueExecution(contactId, message) {
    try {
      const activeExec = this.activeExecutions.get(contactId);
      
      if (!activeExec) {
        return null; // Nenhuma execução ativa
      }

      const execution = await models.AutomationExecution.findByPk(activeExec.executionId);
      const rule = await models.AutomationRule.findByPk(activeExec.ruleId);

      if (!execution || !rule) {
        this.activeExecutions.delete(contactId);
        return null;
      }

      // Coletar o slot atual
      const currentSlot = activeExec.missingSlots[0];
      activeExec.collectedSlots[currentSlot] = message;
      activeExec.missingSlots.shift();

      // Atualizar banco
      execution.collectedSlots = activeExec.collectedSlots;
      execution.missingSlots = activeExec.missingSlots;
      await execution.save();

      // Verificar se ainda faltam slots
      if (activeExec.missingSlots.length > 0) {
        const nextSlot = activeExec.missingSlots[0];
        return {
          execution,
          response: {
            message: rule.slotPrompts[nextSlot] || `Por favor, informe ${nextSlot}:`,
            needsInput: true,
            nextSlot,
            slotPrompt: rule.slotPrompts[nextSlot]
          }
        };
      }

      // Todos os slots coletados - executar ações
      logger.info('✅ [AUTOMATION] Todos os dados coletados, executando ações...');
      
      execution.status = 'executing';
      await execution.save();

      const result = await this.executeActions(rule, execution, activeExec.collectedSlots);

      // Finalizar
      execution.status = result.success ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.result = result;
      await execution.save();

      if (result.success) {
        await rule.increment('successCount');
      }

      // Remover da memória
      this.activeExecutions.delete(contactId);

      return {
        execution,
        response: {
          message: rule.completionMessage || 'Pronto! Sua solicitação foi processada.',
          needsInput: false,
          result
        }
      };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao continuar execução:', error);
      this.activeExecutions.delete(contactId);
      return null;
    }
  }

  /**
   * Executa as ações configuradas na regra
   */
  async executeActions(rule, execution, collectedData) {
    const results = [];
    
    try {
      for (const action of rule.actions || []) {
        logger.info(`🔧 [AUTOMATION] Executando ação: ${action.type}`);
        
        let result;
        switch (action.type) {
          case 'create_ticket':
            result = await this.actionCreateTicket(execution, collectedData, action.params);
            break;
          case 'transfer_queue':
            result = await this.actionTransferQueue(execution, action.params);
            break;
          case 'add_tag':
            result = await this.actionAddTag(execution, action.params);
            break;
          case 'send_notification':
            result = await this.actionSendNotification(execution, collectedData, action.params);
            break;
          case 'update_contact':
            result = await this.actionUpdateContact(execution, collectedData, action.params);
            break;
          default:
            result = { success: false, error: 'Tipo de ação desconhecido' };
        }
        
        results.push({ action: action.type, ...result });
      }

      execution.executedActions = results;
      await execution.save();

      return {
        success: results.every(r => r.success),
        results
      };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao executar ações:', error);
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * AÇÃO: Criar ticket
   */
  async actionCreateTicket(execution, collectedData, params) {
    try {
      const ticket = await models.Ticket.create({
        contactId: execution.contactId,
        subject: params.subject || 'Novo ticket via automação',
        description: this.formatDescription(collectedData),
        status: params.status || 'open',
        priority: params.priority || 'medium',
        queueId: params.queueId || null,
        metadata: { automationData: collectedData, automationRuleId: execution.ruleId }
      });

      execution.ticketId = ticket.id;
      await execution.save();

      logger.info(`✅ [AUTOMATION] Ticket criado: ${ticket.id}`);
      return { success: true, ticketId: ticket.id };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao criar ticket:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AÇÃO: Transferir para fila
   */
  async actionTransferQueue(execution, params) {
    try {
      if (!execution.ticketId) {
        return { success: false, error: 'Ticket não encontrado' };
      }

      const ticket = await models.Ticket.findByPk(execution.ticketId);
      if (!ticket) {
        return { success: false, error: 'Ticket não existe' };
      }

      await ticket.update({
        queueId: params.queueId,
        status: params.status || ticket.status
      });

      logger.info(`✅ [AUTOMATION] Ticket transferido para fila ${params.queueId}`);
      return { success: true, queueId: params.queueId };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao transferir fila:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AÇÃO: Adicionar tag
   */
  async actionAddTag(execution, params) {
    try {
      if (!execution.ticketId) {
        return { success: false, error: 'Ticket não encontrado' };
      }

      await models.TicketTag.create({
        ticketId: execution.ticketId,
        tagId: params.tagId
      });

      logger.info(`✅ [AUTOMATION] Tag adicionada ao ticket`);
      return { success: true, tagId: params.tagId };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao adicionar tag:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AÇÃO: Enviar notificação
   */
  async actionSendNotification(execution, collectedData, params) {
    try {
      // Aqui você pode integrar com sistema de notificações (email, SMS, etc.)
      logger.info(`📧 [AUTOMATION] Notificação enviada para ${params.to}`);
      
      return { success: true, recipient: params.to };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao enviar notificação:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AÇÃO: Atualizar contato
   */
  async actionUpdateContact(execution, collectedData, params) {
    try {
      const contact = await models.Contact.findByPk(execution.contactId);
      if (!contact) {
        return { success: false, error: 'Contato não encontrado' };
      }

      const updateData = {};
      for (const [field, value] of Object.entries(params.fields || {})) {
        updateData[field] = collectedData[value] || value;
      }

      await contact.update(updateData);

      logger.info(`✅ [AUTOMATION] Contato atualizado`);
      return { success: true, updatedFields: Object.keys(updateData) };

    } catch (error) {
      logger.error('❌ [AUTOMATION] Erro ao atualizar contato:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formata dados coletados em descrição legível
   */
  formatDescription(data) {
    let description = 'Dados coletados via automação:\n\n';
    for (const [key, value] of Object.entries(data)) {
      description += `${key}: ${value}\n`;
    }
    return description;
  }

  /**
   * Verifica se há execução ativa para um contato
   */
  hasActiveExecution(contactId) {
    return this.activeExecutions.has(contactId);
  }

  /**
   * Cancela execução ativa
   */
  async cancelExecution(contactId) {
    const activeExec = this.activeExecutions.get(contactId);
    if (activeExec) {
      const execution = await models.AutomationExecution.findByPk(activeExec.executionId);
      if (execution) {
        execution.status = 'failed';
        execution.completedAt = new Date();
        execution.error = 'Cancelado pelo usuário';
        await execution.save();
      }
      this.activeExecutions.delete(contactId);
    }
  }
}

// Singleton
const automationService = new AutomationService();
module.exports = automationService;
