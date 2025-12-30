const express = require('express');
const router = express.Router();
const npsService = require('../services/npsService');

/**
 * GET /api/nps/score
 * Calcula o NPS para um período
 */
router.get('/score', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const npsData = await npsService.calculateNPS(start, end);
    
    res.json({
      success: true,
      data: npsData
    });
  } catch (error) {
    console.error('Erro ao calcular NPS:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular NPS',
      error: error.message
    });
  }
});

/**
 * GET /api/nps/by-agent
 * NPS por atendente
 */
router.get('/by-agent', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const npsData = await npsService.calculateNPSByAgent(start, end);
    
    res.json({
      success: true,
      data: npsData
    });
  } catch (error) {
    console.error('Erro ao calcular NPS por atendente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular NPS por atendente',
      error: error.message
    });
  }
});

/**
 * GET /api/nps/by-department
 * NPS por departamento
 */
router.get('/by-department', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const npsData = await npsService.calculateNPSByDepartment(start, end);
    
    res.json({
      success: true,
      data: npsData
    });
  } catch (error) {
    console.error('Erro ao calcular NPS por departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular NPS por departamento',
      error: error.message
    });
  }
});

/**
 * GET /api/nps/distribution
 * Distribuição de scores (0-10)
 */
router.get('/distribution', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const distribution = await npsService.getScoreDistribution(start, end);
    
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Erro ao obter distribuição de scores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter distribuição',
      error: error.message
    });
  }
});

/**
 * GET /api/nps/ratings
 * Lista de avaliações com filtros
 */
router.get('/ratings', async (req, res) => {
  try {
    const filters = {
      ticketId: req.query.ticketId,
      userId: req.query.userId,
      attendedBy: req.query.attendedBy,
      category: req.query.category,
      minScore: req.query.minScore ? parseInt(req.query.minScore) : undefined,
      maxScore: req.query.maxScore ? parseInt(req.query.maxScore) : undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const ratings = await npsService.getRatings(filters);
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar avaliações',
      error: error.message
    });
  }
});

/**
 * POST /api/nps/ratings
 * Cria uma nova avaliação
 */
router.post('/ratings', async (req, res) => {
  try {
    const { ticketId, userId, score, comment, attendedBy, department, responseTime } = req.body;

    if (!ticketId || !userId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'ticketId, userId e score são obrigatórios'
      });
    }

    if (score < 0 || score > 10) {
      return res.status(400).json({
        success: false,
        message: 'Score deve estar entre 0 e 10'
      });
    }

    const ratingData = {
      ticketId,
      userId,
      score,
      comment,
      attendedBy,
      department,
      responseTime
    };

    const rating = await npsService.createRating(ratingData);
    
    res.status(201).json({
      success: true,
      data: rating
    });
  } catch (error) {
    console.error('Erro ao criar avaliação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar avaliação',
      error: error.message
    });
  }
});

module.exports = router;
