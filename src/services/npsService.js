const Rating = require('../models/RatingSQL');
const { Op, fn, col, literal } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Serviço para cálculo e gerenciamento de NPS (Net Promoter Score)
 */
class NPSService {
  /**
   * Calcula o NPS para um período específico
   * NPS = ((Promotores - Detratores) / Total de Respondentes) * 100
   * 
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Objeto com NPS e breakdown
   */
  async calculateNPS(startDate = null, endDate = null) {
    try {
      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [startDate, endDate]
        };
      } else if (startDate) {
        whereClause.createdAt = {
          [Op.gte]: startDate
        };
      }

      // Contar por categoria
      const counts = await Rating.count({
        where: whereClause,
        group: ['category'],
        raw: true
      });

      // Organizar contagens
      let promoters = 0;
      let neutrals = 0;
      let detractors = 0;

      counts.forEach(row => {
        const count = parseInt(row.count);
        switch (row.category) {
          case 'promoter':
            promoters = count;
            break;
          case 'neutral':
            neutrals = count;
            break;
          case 'detractor':
            detractors = count;
            break;
        }
      });

      const total = promoters + neutrals + detractors;

      // Calcular NPS
      const nps = total > 0 
        ? Math.round(((promoters - detractors) / total) * 100)
        : 0;

      // Calcular percentuais
      const promotersPercent = total > 0 ? Math.round((promoters / total) * 100) : 0;
      const neutralsPercent = total > 0 ? Math.round((neutrals / total) * 100) : 0;
      const detractorsPercent = total > 0 ? Math.round((detractors / total) * 100) : 0;

      return {
        nps,
        total,
        promoters,
        neutrals,
        detractors,
        promotersPercent,
        neutralsPercent,
        detractorsPercent,
        evaluated: total, // Quantos foram avaliados
      };
    } catch (error) {
      logger.error('Erro ao calcular NPS:', error);
      throw error;
    }
  }

  /**
   * Calcula NPS por atendente
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Promise<Array>}
   */
  async calculateNPSByAgent(startDate = null, endDate = null) {
    try {
      const whereClause = { attendedBy: { [Op.ne]: null } };
      
      if (startDate && endDate) {
        whereClause.createdAt = { [Op.between]: [startDate, endDate] };
      }

      const ratings = await Rating.findAll({
        where: whereClause,
        attributes: [
          'attendedBy',
          [fn('COUNT', col('id')), 'total'],
          [fn('COUNT', literal("CASE WHEN category = 'promoter' THEN 1 END")), 'promoters'],
          [fn('COUNT', literal("CASE WHEN category = 'detractor' THEN 1 END")), 'detractors'],
          [fn('AVG', col('score')), 'avgScore'],
        ],
        group: ['attendedBy'],
        raw: true
      });

      return ratings.map(r => {
        const total = parseInt(r.total);
        const promoters = parseInt(r.promoters);
        const detractors = parseInt(r.detractors);
        const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

        return {
          attendedBy: r.attendedBy,
          nps,
          total,
          promoters,
          detractors,
          avgScore: parseFloat(r.avgScore).toFixed(1)
        };
      });
    } catch (error) {
      logger.error('Erro ao calcular NPS por atendente:', error);
      throw error;
    }
  }

  /**
   * Calcula NPS por departamento
   */
  async calculateNPSByDepartment(startDate = null, endDate = null) {
    try {
      const whereClause = { department: { [Op.ne]: null } };
      
      if (startDate && endDate) {
        whereClause.createdAt = { [Op.between]: [startDate, endDate] };
      }

      const ratings = await Rating.findAll({
        where: whereClause,
        attributes: [
          'department',
          [fn('COUNT', col('id')), 'total'],
          [fn('COUNT', literal("CASE WHEN category = 'promoter' THEN 1 END")), 'promoters'],
          [fn('COUNT', literal("CASE WHEN category = 'detractor' THEN 1 END")), 'detractors'],
        ],
        group: ['department'],
        raw: true
      });

      return ratings.map(r => {
        const total = parseInt(r.total);
        const promoters = parseInt(r.promoters);
        const detractors = parseInt(r.detractors);
        const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

        return {
          department: r.department,
          nps,
          total,
          promoters,
          detractors
        };
      });
    } catch (error) {
      logger.error('Erro ao calcular NPS por departamento:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova avaliação
   */
  async createRating(data) {
    try {
      const rating = await Rating.create(data);
      logger.info(`Nova avaliação criada: ${rating.id} - Score: ${rating.score}`);
      return rating;
    } catch (error) {
      logger.error('Erro ao criar avaliação:', error);
      throw error;
    }
  }

  /**
   * Busca avaliações com filtros
   */
  async getRatings(filters = {}) {
    try {
      const whereClause = {};

      if (filters.ticketId) whereClause.ticketId = filters.ticketId;
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.attendedBy) whereClause.attendedBy = filters.attendedBy;
      if (filters.category) whereClause.category = filters.category;
      if (filters.minScore) whereClause.score = { [Op.gte]: filters.minScore };
      if (filters.maxScore) whereClause.score = { ...whereClause.score, [Op.lte]: filters.maxScore };

      if (filters.startDate && filters.endDate) {
        whereClause.createdAt = { [Op.between]: [filters.startDate, filters.endDate] };
      }

      const ratings = await Rating.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: filters.limit || 100
      });

      return ratings;
    } catch (error) {
      logger.error('Erro ao buscar avaliações:', error);
      throw error;
    }
  }

  /**
   * Obtém distribuição de scores
   */
  async getScoreDistribution(startDate = null, endDate = null) {
    try {
      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = { [Op.between]: [startDate, endDate] };
      }

      const distribution = await Rating.findAll({
        where: whereClause,
        attributes: [
          'score',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['score'],
        order: [['score', 'ASC']],
        raw: true
      });

      return distribution.map(d => ({
        score: d.score,
        count: parseInt(d.count)
      }));
    } catch (error) {
      logger.error('Erro ao obter distribuição de scores:', error);
      throw error;
    }
  }
}

module.exports = new NPSService();

