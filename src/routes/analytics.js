const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Rotas existentes
router.get('/dashboard', analyticsController.dashboard);
router.get('/tickets/by-department', analyticsController.ticketsByDepartment);
router.get('/tickets/by-status', analyticsController.ticketsByStatus);
router.get('/tickets/timeline', analyticsController.ticketsTimeline);
router.get('/ratings', analyticsController.ratings);
router.get('/agents/performance', analyticsController.agentsPerformance);

// Novas rotas - Métricas Amanda
router.get('/metrics/extended', analyticsController.extendedMetrics); // 11 cards
router.get('/rankings/contacts', analyticsController.contactsRanking); // Top 10 contatos
router.get('/rankings/agents', analyticsController.agentsRanking); // Ranking atendentes
router.get('/metrics/time', analyticsController.timeMetrics); // Métricas de tempo
router.get('/activity/hourly', analyticsController.hourlyActivity); // Atividade por hora
router.get('/distribution/channel', analyticsController.channelDistribution); // Distribuição por canal
router.get('/distribution/department', analyticsController.departmentDistribution); // Distribuição por setor

module.exports = router;

