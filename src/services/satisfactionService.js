const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const moment = require('moment-timezone');
const { rawFormatDateSQL } = require('../utils/dbHelpers');

/**
 * ================================================================================
 * FASE 6C: SERVICE - ANÁLISE DE SATISFAÇÃO (NPS, WORD CLOUD, SENTIMENT)
 * ================================================================================
 * 
 * Serviço responsável por análise de satisfação do cliente:
 * - NPS (Net Promoter Score)
 * - Word Cloud (palavras mais frequentes)
 * - Análise de Sentimento
 * - Tendências de satisfação
 */

class SatisfactionService {
  
  /**
   * Calcula NPS (Net Promoter Score) para um período
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>}
   */
  async calculateNPS(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        departmentId = null,
        agentId = null,
        queueId = null
      } = options;

      const whereClause = {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      };

      let joinClause = '';
      if (departmentId) joinClause += ` AND t.departmentId = :departmentId`;
      if (agentId) joinClause += ` AND t.userId = :agentId`;
      if (queueId) joinClause += ` AND t.queueId = :queueId`;

      const [result] = await sequelize.query(`
        SELECT 
          COUNT(*) as totalRatings,
          COUNT(CASE WHEN r.rating >= 9 THEN 1 END) as promoters,
          COUNT(CASE WHEN r.rating >= 7 AND r.rating <= 8 THEN 1 END) as passives,
          COUNT(CASE WHEN r.rating <= 6 THEN 1 END) as detractors,
          AVG(r.rating) as avgRating,
          GROUP_CONCAT(CASE WHEN r.comment IS NOT NULL AND r.comment != '' THEN r.comment END, '|||') as comments
        FROM ratings r
        INNER JOIN tickets t ON t.id = r.ticketId
        WHERE r.createdAt BETWEEN :startDate AND :endDate
          ${joinClause}
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          departmentId: departmentId || null,
          agentId: agentId || null,
          queueId: queueId || null
        },
        type: sequelize.QueryTypes.SELECT
      });

      const totalRatings = parseInt(result.totalRatings) || 0;
      const promoters = parseInt(result.promoters) || 0;
      const passives = parseInt(result.passives) || 0;
      const detractors = parseInt(result.detractors) || 0;

      // Fórmula NPS: ((Promoters - Detractors) / Total) * 100
      const npsScore = totalRatings > 0 
        ? Math.round(((promoters - detractors) / totalRatings) * 100)
        : 0;

      // Classificação NPS
      let classification = 'Ruim';
      if (npsScore >= 75) classification = 'Excelente';
      else if (npsScore >= 50) classification = 'Muito Bom';
      else if (npsScore >= 0) classification = 'Razoável';

      return {
        period: {
          startDate,
          endDate,
          days: moment(endDate).diff(moment(startDate), 'days')
        },
        nps: {
          score: npsScore,
          classification
        },
        distribution: {
          promoters,
          promotersPercent: totalRatings > 0 ? ((promoters / totalRatings) * 100).toFixed(2) : 0,
          passives,
          passivesPercent: totalRatings > 0 ? ((passives / totalRatings) * 100).toFixed(2) : 0,
          detractors,
          detractorsPercent: totalRatings > 0 ? ((detractors / totalRatings) * 100).toFixed(2) : 0,
          total: totalRatings
        },
        avgRating: parseFloat(result.avgRating || 0).toFixed(2),
        comments: result.comments ? result.comments.split('|||').filter(c => c) : []
      };

    } catch (error) {
      logger.error('❌ Erro ao calcular NPS:', error);
      throw error;
    }
  }

  /**
   * Gera Word Cloud (palavras mais frequentes) dos comentários
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async generateWordCloud(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        minRating = null,
        maxRating = null,
        limit = 50
      } = options;

      let ratingFilter = '';
      if (minRating !== null) ratingFilter += ` AND r.rating >= :minRating`;
      if (maxRating !== null) ratingFilter += ` AND r.rating <= :maxRating`;

      const [result] = await sequelize.query(`
        SELECT GROUP_CONCAT(r.comment, ' ') as allComments
        FROM ratings r
        WHERE r.createdAt BETWEEN :startDate AND :endDate
          AND r.comment IS NOT NULL 
          AND r.comment != ''
          ${ratingFilter}
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          minRating: minRating || 0,
          maxRating: maxRating || 10
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (!result || !result.allComments) {
        return [];
      }

      // Processar texto: remover pontuação, lowercase, contar palavras
      const text = result.allComments
        .toLowerCase()
        .replace(/[^\wÀ-ÿ\s]/g, ' ') // Manter acentos
        .replace(/\s+/g, ' ')
        .trim();

      // Stop words em português
      const stopWords = new Set([
        'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'os', 'as', 'dos', 'das',
        'para', 'com', 'por', 'sem', 'sob', 'ao', 'à', 'no', 'na', 'nos', 'nas',
        'que', 'qual', 'quais', 'como', 'se', 'mas', 'porém', 'pois', 'quando', 'onde',
        'muito', 'pouco', 'mais', 'menos', 'bem', 'mal', 'não', 'sim', 'já', 'ainda',
        'foi', 'ser', 'ter', 'estar', 'fazer', 'fica', 'ficou', 'fico', 'fui', 'vai',
        'sou', 'foi', 'tem', 'tinha', 'esta', 'esse', 'isso', 'essa', 'aquilo'
      ]);

      const words = text.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
      
      // Contar frequência
      const frequency = {};
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
      });

      // Ordenar por frequência e retornar top N
      const wordCloud = Object.entries(frequency)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return wordCloud;

    } catch (error) {
      logger.error('❌ Erro ao gerar word cloud:', error);
      throw error;
    }
  }

  /**
   * Análise de sentimento dos comentários (simplificada)
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>}
   */
  async analyzeSentiment(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate()
      } = options;

      const [results] = await sequelize.query(`
        SELECT 
          r.id,
          r.rating,
          r.comment,
          r.createdAt,
          t.contactId,
          u.name as agentName
        FROM ratings r
        INNER JOIN tickets t ON t.id = r.ticketId
        LEFT JOIN users u ON u.id = t.userId
        WHERE r.createdAt BETWEEN :startDate AND :endDate
          AND r.comment IS NOT NULL 
          AND r.comment != ''
        ORDER BY r.createdAt DESC
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Palavras positivas e negativas em português
      const positiveWords = new Set([
        'bom', 'boa', 'ótimo', 'ótima', 'excelente', 'perfeito', 'perfeita', 'maravilhoso',
        'rápido', 'rápida', 'eficiente', 'atencioso', 'atenciosa', 'educado', 'educada',
        'simpático', 'simpática', 'resolveu', 'solucionou', 'ajudou', 'obrigado', 'obrigada',
        'parabéns', 'satisfeito', 'satisfeita', 'feliz', 'agradeço', 'recomendo'
      ]);

      const negativeWords = new Set([
        'ruim', 'péssimo', 'péssima', 'horrível', 'terrível', 'lento', 'lenta', 'demorado',
        'demorada', 'demora', 'problema', 'problemas', 'erro', 'erros', 'mal', 'mau',
        'insatisfeito', 'insatisfeita', 'difícil', 'complicado', 'complicada', 'infeliz',
        'decepcionado', 'decepcionada', 'frustrado', 'frustrada', 'não', 'nunca', 'nada'
      ]);

      const analyzed = results.map(row => {
        const text = row.comment.toLowerCase();
        const words = text.split(/\s+/);
        
        let positiveCount = 0;
        let negativeCount = 0;

        words.forEach(word => {
          if (positiveWords.has(word)) positiveCount++;
          if (negativeWords.has(word)) negativeCount++;
        });

        // Determinar sentimento
        let sentiment = 'neutral';
        if (positiveCount > negativeCount) sentiment = 'positive';
        else if (negativeCount > positiveCount) sentiment = 'negative';

        // Rating também influencia
        if (row.rating >= 8 && sentiment !== 'negative') sentiment = 'positive';
        else if (row.rating <= 5 && sentiment !== 'positive') sentiment = 'negative';

        return {
          ...row,
          sentiment,
          positiveCount,
          negativeCount,
          sentimentScore: positiveCount - negativeCount
        };
      });

      // Calcular distribuição
      const positive = analyzed.filter(a => a.sentiment === 'positive').length;
      const neutral = analyzed.filter(a => a.sentiment === 'neutral').length;
      const negative = analyzed.filter(a => a.sentiment === 'negative').length;
      const total = analyzed.length;

      return {
        period: {
          startDate,
          endDate
        },
        distribution: {
          positive,
          positivePercent: total > 0 ? ((positive / total) * 100).toFixed(2) : 0,
          neutral,
          neutralPercent: total > 0 ? ((neutral / total) * 100).toFixed(2) : 0,
          negative,
          negativePercent: total > 0 ? ((negative / total) * 100).toFixed(2) : 0,
          total
        },
        comments: analyzed.slice(0, 100), // Limitar a 100 comentários
        summary: {
          avgSentimentScore: total > 0 
            ? (analyzed.reduce((sum, a) => sum + a.sentimentScore, 0) / total).toFixed(2) 
            : 0
        }
      };

    } catch (error) {
      logger.error('❌ Erro ao analisar sentimento:', error);
      throw error;
    }
  }

  /**
   * Tendências de satisfação ao longo do tempo
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async getSatisfactionTrends(options = {}) {
    try {
      const {
        startDate = moment().subtract(90, 'days').toDate(),
        endDate = moment().toDate(),
        interval = 'day' // day, week, month
      } = options;

      let dateFormat;
      switch (interval) {
        case 'week':
          dateFormat = '%Y-W%W'; // Year-Week
          break;
        case 'month':
          dateFormat = '%Y-%m'; // Year-Month
          break;
        default:
          dateFormat = '%Y-%m-%d'; // Year-Month-Day
      }

      const [results] = await sequelize.query(`
        SELECT 
          ${rawFormatDateSQL('r.createdAt', dateFormat)} as period,
          COUNT(*) as totalRatings,
          AVG(r.rating) as avgRating,
          COUNT(CASE WHEN r.rating >= 9 THEN 1 END) as promoters,
          COUNT(CASE WHEN r.rating >= 7 AND r.rating <= 8 THEN 1 END) as passives,
          COUNT(CASE WHEN r.rating <= 6 THEN 1 END) as detractors
        FROM ratings r
        WHERE r.createdAt BETWEEN :startDate AND :endDate
        GROUP BY period
        ORDER BY period ASC
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      return results.map(row => {
        const total = parseInt(row.totalRatings);
        const promoters = parseInt(row.promoters);
        const detractors = parseInt(row.detractors);
        
        return {
          period: row.period,
          totalRatings: total,
          avgRating: parseFloat(row.avgRating).toFixed(2),
          nps: total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0,
          promoters,
          passives: parseInt(row.passives),
          detractors
        };
      });

    } catch (error) {
      logger.error('❌ Erro ao calcular tendências:', error);
      throw error;
    }
  }

  /**
   * Comparação de satisfação entre departamentos/filas/agentes
   * @param {String} groupBy - 'department', 'queue', 'agent'
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async compareSatisfaction(groupBy, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        limit = 10
      } = options;

      const validGroupBy = ['department', 'queue', 'agent'];
      if (!validGroupBy.includes(groupBy)) {
        throw new Error(`groupBy inválido. Use: ${validGroupBy.join(', ')}`);
      }

      let selectField, groupField, nameField;
      switch (groupBy) {
        case 'department':
          selectField = 't.departmentId';
          groupField = 't.departmentId';
          nameField = 't.departmentId'; // TODO: Join com tabela departments
          break;
        case 'queue':
          selectField = 'q.id';
          groupField = 'q.id';
          nameField = 'q.name';
          break;
        case 'agent':
          selectField = 'u.id';
          groupField = 'u.id';
          nameField = 'u.name';
          break;
      }

      const [results] = await sequelize.query(`
        SELECT 
          ${selectField} as id,
          ${nameField} as name,
          COUNT(*) as totalRatings,
          AVG(r.rating) as avgRating,
          COUNT(CASE WHEN r.rating >= 9 THEN 1 END) as promoters,
          COUNT(CASE WHEN r.rating >= 7 AND r.rating <= 8 THEN 1 END) as passives,
          COUNT(CASE WHEN r.rating <= 6 THEN 1 END) as detractors
        FROM ratings r
        INNER JOIN tickets t ON t.id = r.ticketId
        ${groupBy === 'queue' ? 'LEFT JOIN queues q ON q.id = t.queueId' : ''}
        ${groupBy === 'agent' ? 'LEFT JOIN users u ON u.id = t.userId' : ''}
        WHERE r.createdAt BETWEEN :startDate AND :endDate
        GROUP BY ${groupField}
        HAVING totalRatings > 0
        ORDER BY avgRating DESC
        LIMIT :limit
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit
        },
        type: sequelize.QueryTypes.SELECT
      });

      return results.map(row => {
        const total = parseInt(row.totalRatings);
        const promoters = parseInt(row.promoters);
        const detractors = parseInt(row.detractors);
        
        return {
          id: row.id,
          name: row.name || 'Sem nome',
          totalRatings: total,
          avgRating: parseFloat(row.avgRating).toFixed(2),
          nps: total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0,
          promoters,
          passives: parseInt(row.passives),
          detractors
        };
      });

    } catch (error) {
      logger.error('❌ Erro ao comparar satisfação:', error);
      throw error;
    }
  }
}

module.exports = new SatisfactionService();

