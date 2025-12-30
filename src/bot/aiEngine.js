// Auto-generated wrapper
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-dummy-key-for-testing' || process.env.ENABLE_AI === 'false') {
  console.warn('⚠️ AI Engine desabilitado (configure OPENAI_API_KEY no .env)');
  module.exports = {
    classifyIntent: async () => ({ intent: 'unknown', confidence: 0 }),
    generateResponse: async () => 'O assistente AI não está disponível no momento.',
    extractEntities: async () => [],
    getSentiment: async () => ({ sentiment: 'neutral', score: 0 }),
  };
} else {
const OpenAI = require('openai');
const logger = require('../utils/logger');
const { findDepartmentByKeywords } = require('../config/departments');

class AIEngine {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.conversationHistory = new Map();
    this.maxHistoryLength = 10;
  }

  /**
   * Processa mensagem com GPT-4
   */
  async processMessage(userId, message, context = {}) {
    try {
      logger.debug(`🤖 Processando mensagem com IA para ${userId}`);

      // Obter histórico de conversação
      let history = this.conversationHistory.get(userId) || [];

      // Construir prompt do sistema
      const systemPrompt = this.buildSystemPrompt(context);

      // Construir mensagens para API
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message }
      ];

      // Chamar GPT-4
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      });

      const aiResponse = response.choices[0].message.content;

      // Atualizar histórico
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: aiResponse });

      // Limitar tamanho do histórico
      if (history.length > this.maxHistoryLength * 2) {
        history = history.slice(-this.maxHistoryLength * 2);
      }

      this.conversationHistory.set(userId, history);

      logger.debug(`✅ IA respondeu para ${userId}`);

      return {
        response: aiResponse,
        intent: await this.detectIntent(message),
        sentiment: await this.analyzeSentiment(message),
        suggestedDepartment: findDepartmentByKeywords(message)
      };

    } catch (error) {
      logger.error('Erro ao processar com IA:', error);
      throw error;
    }
  }

  /**
   * Constrói prompt do sistema
   */
  buildSystemPrompt(context) {
    const { department, userName, companyName } = context;

    let prompt = `Você é um assistente virtual inteligente e prestativo de uma empresa${companyName ? ` chamada ${companyName}` : ''}.

PERSONALIDADE:
- Seja sempre educado, profissional e empático
- Use emojis de forma moderada para tornar a conversa mais amigável
- Seja objetivo e claro nas respostas
- Mostre interesse genuíno em ajudar o cliente

CAPACIDADES:
- Responder dúvidas sobre produtos e serviços
- Direcionar para o departamento correto
- Abrir chamados e protocolos
- Fornecer informações gerais da empresa
- Agendar atendimentos

LIMITAÇÕES:
- Não invente informações que você não sabe
- Para questões específicas ou complexas, sugira transferir para um atendente humano
- Não prometa coisas que não pode cumprir

DIRETRIZES:
- Mantenha respostas curtas (máximo 3-4 linhas)
- Use formatação WhatsApp: *negrito*, _itálico_
- Sempre ofereça próximos passos claros
- Se não entender, peça esclarecimento`;

    if (userName) {
      prompt += `\n\nO nome do cliente é ${userName}. Use o nome dele naturalmente na conversa.`;
    }

    if (department) {
      prompt += `\n\nVocê está atendendo pelo departamento de ${department}. Foque em questões relacionadas a este departamento.`;
    }

    return prompt;
  }

  /**
   * Detecta intenção da mensagem
   */
  async detectIntent(message) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Classifique a intenção da mensagem em uma das categorias:
- greeting (saudação)
- question (pergunta)
- complaint (reclamação)
- request (solicitação)
- feedback (feedback/avaliação)
- farewell (despedida)
- other (outro)

Responda apenas com a categoria, sem explicações.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return response.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      logger.error('Erro ao detectar intenção:', error);
      return 'other';
    }
  }

  /**
   * Analisa sentimento da mensagem
   */
  async analyzeSentiment(message) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Analise o sentimento da mensagem e classifique como:
- positive (positivo)
- neutral (neutro)
- negative (negativo)

Responda apenas com a classificação, sem explicações.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return response.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      logger.error('Erro ao analisar sentimento:', error);
      return 'neutral';
    }
  }

  /**
   * Gera resposta contextual
   */
  async generateContextualResponse(question, knowledgeBase) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que responde perguntas baseado em uma base de conhecimento.
            
Base de conhecimento:
${JSON.stringify(knowledgeBase, null, 2)}

Responda de forma clara e objetiva, usando as informações da base de conhecimento.
Se a informação não estiver disponível, seja honesto e sugira alternativas.`
          },
          { role: 'user', content: question }
        ],
        temperature: 0.5,
        max_tokens: 300
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Erro ao gerar resposta contextual:', error);
      throw error;
    }
  }

  /**
   * Resume conversa
   */
  async summarizeConversation(userId) {
    try {
      const history = this.conversationHistory.get(userId);
      if (!history || history.length === 0) {
        return null;
      }

      const conversationText = history
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Resuma a conversa a seguir em 2-3 frases, destacando os pontos principais e o resultado.'
          },
          { role: 'user', content: conversationText }
        ],
        temperature: 0.5,
        max_tokens: 150
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Erro ao resumir conversa:', error);
      return null;
    }
  }

  /**
   * Sugere próxima ação
   */
  async suggestNextAction(userId, currentContext) {
    try {
      const history = this.conversationHistory.get(userId) || [];
      const recentMessages = history.slice(-6); // Últimas 3 trocas

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Baseado na conversa, sugira a próxima melhor ação:
- transfer_human (transferir para humano)
- open_ticket (abrir chamado)
- schedule (agendar atendimento)
- provide_info (fornecer mais informações)
- close (finalizar atendimento)

Responda apenas com a ação, sem explicações.`
          },
          {
            role: 'user',
            content: JSON.stringify({ recentMessages, currentContext })
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return response.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      logger.error('Erro ao sugerir próxima ação:', error);
      return 'provide_info';
    }
  }

  /**
   * Limpa histórico de conversa
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
    logger.debug(`🗑️ Histórico limpo para ${userId}`);
  }

  /**
   * Obtém histórico de conversa
   */
  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Extrai informações estruturadas da mensagem
   */
  async extractInformation(message, fields) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Extraia as seguintes informações da mensagem: ${fields.join(', ')}
            
Retorne um JSON com os campos encontrados. Se não encontrar, use null.
Exemplo: {"nome": "João", "email": "joao@email.com", "telefone": null}`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const extracted = JSON.parse(response.choices[0].message.content);
      return extracted;
    } catch (error) {
      logger.error('Erro ao extrair informações:', error);
      return {};
    }
  }
}

// Exportar instância única
const aiEngine = new AIEngine();
module.exports = aiEngine;


}
