const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const moment = require('moment-timezone');
const { rawExtractHourSQL, rawDateDiffMinutesSQL } = require('../utils/dbHelpers');

/**
 * ================================================================================
 * FASE 6D: SERVICE - ANÁLISE DE CONVERSAS
 * ================================================================================
 * 
 * Serviço responsável por análise avançada de conversas:
 * - Sentimento em tempo real
 * - Extração de tópicos/palavras-chave
 * - Identificação de padrões
 * - Métricas de engajamento
 */

class ConversationService {
  
  /**
   * Analisa sentimento de uma conversa/ticket
   * @param {String} ticketId - ID do ticket
   * @returns {Promise<Object>}
   */
  async analyzeConversation(ticketId) {
    try {
      const [messages] = await sequelize.query(`
        SELECT 
          m.id,
          m.body,
          m.fromMe,
          m.createdAt,
          m.type
        FROM messages m
        WHERE m.ticketId = :ticketId
          AND m.type = 'text'
        ORDER BY m.createdAt ASC
      `, {
        replacements: { ticketId },
        type: sequelize.QueryTypes.SELECT
      });

      if (messages.length === 0) {
        return {
          ticketId,
          messageCount: 0,
          sentiment: null,
          topics: [],
          engagement: {}
        };
      }

      // Analisar sentimento de cada mensagem
      const analyzedMessages = messages.map(msg => {
        const sentiment = this.detectMessageSentiment(msg.body);
        const topics = this.extractTopics(msg.body);
        
        return {
          ...msg,
          sentiment: sentiment.label,
          sentimentScore: sentiment.score,
          topics
        };
      });

      // Calcular métricas gerais
      const customerMessages = analyzedMessages.filter(m => !m.fromMe);
      const agentMessages = analyzedMessages.filter(m => m.fromMe);
      
      const avgSentiment = analyzedMessages.reduce((sum, m) => sum + m.sentimentScore, 0) / analyzedMessages.length;
      
      // Extrair tópicos mais frequentes
      const allTopics = analyzedMessages.flatMap(m => m.topics);
      const topicFrequency = {};
      allTopics.forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      });
      
      const topTopics = Object.entries(topicFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      // Calcular engajamento
      const responseTime = this.calculateAverageResponseTime(messages);
      
      return {
        ticketId,
        messageCount: messages.length,
        customerMessageCount: customerMessages.length,
        agentMessageCount: agentMessages.length,
        sentiment: {
          overall: avgSentiment > 0.3 ? 'positive' : (avgSentiment < -0.3 ? 'negative' : 'neutral'),
          score: avgSentiment.toFixed(2),
          positive: analyzedMessages.filter(m => m.sentiment === 'positive').length,
          neutral: analyzedMessages.filter(m => m.sentiment === 'neutral').length,
          negative: analyzedMessages.filter(m => m.sentiment === 'negative').length
        },
        topics: topTopics,
        engagement: {
          avgResponseTimeMinutes: responseTime,
          messagesPerParticipant: {
            customer: customerMessages.length,
            agent: agentMessages.length
          },
          turnTaking: this.analyzeTurnTaking(messages)
        },
        messages: analyzedMessages
      };

    } catch (error) {
      logger.error('❌ Erro ao analisar conversa:', error);
      throw error;
    }
  }

  /**
   * Detecta sentimento de uma mensagem (simplificado)
   * @param {String} text - Texto da mensagem
   * @returns {Object}
   */
  detectMessageSentiment(text) {
    if (!text) return { label: 'neutral', score: 0 };

    const lowerText = text.toLowerCase();
    
    // Palavras positivas e negativas
    const positiveWords = [
      'obrigado', 'obrigada', 'excelente', 'ótimo', 'bom', 'perfeito', 'maravilhoso',
      'adorei', 'amei', 'parabéns', 'legal', 'bacana', 'show', 'top', 'feliz',
      'satisfeito', 'satisfeita', 'gostei', 'aprovo', 'recomendo', 'agradeço'
    ];
    
    const negativeWords = [
      'ruim', 'péssimo', 'horrível', 'terrível', 'problema', 'erro', 'falha',
      'insatisfeito', 'insatisfeita', 'decepcionado', 'frustrado', 'chato',
      'demorado', 'lento', 'difícil', 'complicado', 'não funciona', 'mal'
    ];

    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1;
    });
    
    // Normalizar score (-1 a 1)
    score = Math.max(-1, Math.min(1, score / 3));
    
    let label = 'neutral';
    if (score > 0.3) label = 'positive';
    else if (score < -0.3) label = 'negative';
    
    return { label, score };
  }

  /**
   * Extrai tópicos/palavras-chave de um texto
   * @param {String} text - Texto para análise
   * @returns {Array}
   */
  extractTopics(text) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    
    // Tópicos comuns em atendimento
    const topics = {
      'pagamento': ['pagamento', 'pagar', 'pago', 'cobrança', 'fatura', 'boleto', 'cartão'],
      'entrega': ['entrega', 'entregar', 'enviado', 'envio', 'rastreio', 'correios'],
      'produto': ['produto', 'mercadoria', 'item', 'compra', 'comprei'],
      'cancelamento': ['cancelar', 'cancelamento', 'desistir', 'devolver', 'reembolso'],
      'suporte': ['ajuda', 'ajudar', 'suporte', 'dúvida', 'como', 'funciona'],
      'reclamação': ['reclamar', 'reclamação', 'insatisfeito', 'problema', 'erro'],
      'elogio': ['parabéns', 'excelente', 'obrigado', 'adorei', 'perfeito'],
      'prazo': ['prazo', 'quando', 'demora', 'demorar', 'tempo'],
      'preço': ['preço', 'valor', 'custo', 'caro', 'barato', 'desconto'],
      'cadastro': ['cadastro', 'cadastrar', 'registro', 'conta', 'senha']
    };

    const detectedTopics = [];
    
    Object.entries(topics).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedTopics.push(topic);
      }
    });

    return detectedTopics;
  }

  /**
   * Calcula tempo médio de resposta
   * @param {Array} messages - Lista de mensagens
   * @returns {Number}
   */
  calculateAverageResponseTime(messages) {
    const responseTimes = [];
    
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      
      // Se mudou de quem enviou (cliente -> agente ou agente -> cliente)
      if (prev.fromMe !== curr.fromMe) {
        const timeDiff = moment(curr.createdAt).diff(moment(prev.createdAt), 'minutes');
        if (timeDiff > 0 && timeDiff < 1440) { // Ignorar > 24h
          responseTimes.push(timeDiff);
        }
      }
    }

    if (responseTimes.length === 0) return 0;
    
    return (responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length).toFixed(2);
  }

  /**
   * Analisa alternância de turnos (turn-taking)
   * @param {Array} messages - Lista de mensagens
   * @returns {Object}
   */
  analyzeTurnTaking(messages) {
    let turns = 0;
    let prevFromMe = null;
    
    messages.forEach(msg => {
      if (prevFromMe !== null && prevFromMe !== msg.fromMe) {
        turns++;
      }
      prevFromMe = msg.fromMe;
    });

    return {
      totalTurns: turns,
      avgMessagesPerTurn: messages.length > 0 ? (messages.length / (turns + 1)).toFixed(2) : 0,
      balanced: Math.abs(
        messages.filter(m => m.fromMe).length - 
        messages.filter(m => !m.fromMe).length
      ) < 3 // Diferença menor que 3 mensagens = balanceado
    };
  }

  /**
   * Analisa múltiplas conversas em lote
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>}
   */
  async analyzeBatchConversations(options = {}) {
    try {
      const {
        startDate = moment().subtract(7, 'days').toDate(),
        endDate = moment().toDate(),
        limit = 50,
        status = null
      } = options;

      let statusFilter = '';
      if (status) statusFilter = ` AND t.status = :status`;

      const [tickets] = await sequelize.query(`
        SELECT t.id
        FROM tickets t
        WHERE t.createdAt BETWEEN :startDate AND :endDate
          ${statusFilter}
        ORDER BY t.createdAt DESC
        LIMIT :limit
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          status: status || '',
          limit
        },
        type: sequelize.QueryTypes.SELECT
      });

      const analyses = await Promise.all(
        tickets.map(ticket => this.analyzeConversation(ticket.id))
      );

      // Calcular estatísticas agregadas
      const totalMessages = analyses.reduce((sum, a) => sum + a.messageCount, 0);
      const avgSentiment = analyses.reduce((sum, a) => sum + parseFloat(a.sentiment.score), 0) / analyses.length;
      
      // Tópicos mais frequentes
      const allTopics = analyses.flatMap(a => a.topics);
      const topicFrequency = {};
      allTopics.forEach(({ topic, count }) => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + count;
      });
      
      const topTopics = Object.entries(topicFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      return {
        period: {
          startDate,
          endDate
        },
        summary: {
          totalConversations: analyses.length,
          totalMessages,
          avgMessagesPerConversation: (totalMessages / analyses.length).toFixed(2),
          avgSentimentScore: avgSentiment.toFixed(2),
          sentimentDistribution: {
            positive: analyses.filter(a => a.sentiment.overall === 'positive').length,
            neutral: analyses.filter(a => a.sentiment.overall === 'neutral').length,
            negative: analyses.filter(a => a.sentiment.overall === 'negative').length
          }
        },
        topTopics,
        conversations: analyses
      };

    } catch (error) {
      logger.error('❌ Erro ao analisar conversas em lote:', error);
      throw error;
    }
  }

  /**
   * Identifica padrões em conversas
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>}
   */
  async identifyPatterns(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate()
      } = options;

      const batch = await this.analyzeBatchConversations({ 
        startDate, 
        endDate, 
        limit: 100 
      });

      // Padrões de horário
      const [hourlyPattern] = await sequelize.query(`
        SELECT 
          ${rawExtractHourSQL('m.createdAt')} as hour,
          COUNT(*) as messageCount
        FROM messages m
        INNER JOIN tickets t ON t.id = m.ticketId
        WHERE t.createdAt BETWEEN :startDate AND :endDate
        GROUP BY hour
        ORDER BY hour ASC
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Padrões de duração
      const [durationPattern] = await sequelize.query(`
        SELECT 
          CASE 
            WHEN ${rawDateDiffMinutesSQL('t.closedAt', 't.createdAt')} < 15 THEN 'quick'
            WHEN ${rawDateDiffMinutesSQL('t.closedAt', 't.createdAt')} < 60 THEN 'medium'
            WHEN ${rawDateDiffMinutesSQL('t.closedAt', 't.createdAt')} < 240 THEN 'long'
            ELSE 'very_long'
          END as duration,
          COUNT(*) as count,
          AVG(r.rating) as avgRating
        FROM tickets t
        LEFT JOIN ratings r ON r.ticketId = t.id
        WHERE t.createdAt BETWEEN :startDate AND :endDate
          AND t.status = 'closed'
          AND t.closedAt IS NOT NULL
        GROUP BY duration
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        period: {
          startDate,
          endDate
        },
        patterns: {
          hourly: hourlyPattern,
          duration: durationPattern,
          topics: batch.topTopics,
          sentiment: batch.summary.sentimentDistribution
        },
        insights: this.generateInsights(hourlyPattern, durationPattern, batch)
      };

    } catch (error) {
      logger.error('❌ Erro ao identificar padrões:', error);
      throw error;
    }
  }

  /**
   * Gera insights com base nos padrões
   * @param {Array} hourlyPattern - Padrão horário
   * @param {Array} durationPattern - Padrão de duração
   * @param {Object} batch - Análise em lote
   * @returns {Array}
   */
  generateInsights(hourlyPattern, durationPattern, batch) {
    const insights = [];

    // Insight: Horário de pico
    if (hourlyPattern.length > 0) {
      const peakHour = hourlyPattern.reduce((max, h) => 
        h.messageCount > max.messageCount ? h : max
      );
      insights.push({
        type: 'peak_hour',
        message: `Horário de pico: ${peakHour.hour}h com ${peakHour.messageCount} mensagens`,
        data: peakHour
      });
    }

    // Insight: Duração predominante
    if (durationPattern.length > 0) {
      const mostCommon = durationPattern.reduce((max, d) => 
        d.count > max.count ? d : max
      );
      insights.push({
        type: 'duration',
        message: `Maioria dos atendimentos tem duração: ${mostCommon.duration}`,
        data: mostCommon
      });
    }

    // Insight: Sentimento geral
    const sentimentDist = batch.summary.sentimentDistribution;
    const totalSentiment = sentimentDist.positive + sentimentDist.neutral + sentimentDist.negative;
    if (totalSentiment > 0) {
      const positivePercent = (sentimentDist.positive / totalSentiment * 100).toFixed(1);
      insights.push({
        type: 'sentiment',
        message: `${positivePercent}% das conversas têm sentimento positivo`,
        data: sentimentDist
      });
    }

    // Insight: Tópico mais frequente
    if (batch.topTopics.length > 0) {
      const topTopic = batch.topTopics[0];
      insights.push({
        type: 'top_topic',
        message: `Tópico mais frequente: ${topTopic.topic} (${topTopic.count} menções)`,
        data: topTopic
      });
    }

    return insights;
  }
}

module.exports = new ConversationService();

