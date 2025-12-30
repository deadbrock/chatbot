const express = require('express');
const router = express.Router();
const Schedule = require('../models/ScheduleSQL');
const scheduleService = require('../services/scheduleService');
const { httpResponse } = require('../utils/http');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * GET /api/schedules
 * Lista todos os agendamentos
 */
router.get('/', async (req, res) => {
  try {
    const { status, type, recipientId, startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (recipientId) whereClause.recipientId = recipientId;
    
    if (startDate && endDate) {
      whereClause.scheduledFor = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.scheduledFor = {
        [Op.gte]: new Date(startDate)
      };
    }

    const schedules = await Schedule.findAll({
      where: whereClause,
      order: [['scheduledFor', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Schedule.count({ where: whereClause });

    httpResponse.ok(res, {
      data: schedules,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Erro ao listar agendamentos:', error);
    httpResponse.error(res, 'Erro ao listar agendamentos');
  }
});

/**
 * GET /api/schedules/stats
 * Estatísticas de agendamentos
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await scheduleService.getStats(start, end);
    
    httpResponse.ok(res, stats);
  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error);
    httpResponse.error(res, 'Erro ao obter estatísticas');
  }
});

/**
 * GET /api/schedules/:id
 * Obter um agendamento por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    
    if (!schedule) {
      return httpResponse.notFound(res, 'Agendamento não encontrado');
    }

    httpResponse.ok(res, schedule);
  } catch (error) {
    logger.error('Erro ao obter agendamento:', error);
    httpResponse.error(res, 'Erro ao obter agendamento');
  }
});

/**
 * POST /api/schedules
 * Criar novo agendamento
 */
router.post('/', async (req, res) => {
  try {
    const { 
      type, 
      scheduledFor, 
      recipientId, 
      ticketId,
      message, 
      mediaUrl, 
      mediaType,
      repeat,
      repeatUntil,
      metadata
    } = req.body;

    if (!type || !scheduledFor || !recipientId || !message) {
      return httpResponse.badRequest(res, 'type, scheduledFor, recipientId e message são obrigatórios');
    }

    const scheduleData = {
      type,
      scheduledFor: new Date(scheduledFor),
      recipientId,
      ticketId,
      message,
      mediaUrl,
      mediaType,
      repeat: repeat || 'none',
      repeatUntil: repeatUntil ? new Date(repeatUntil) : null,
      createdBy: req.user?.id,
      metadata
    };

    const schedule = await scheduleService.createSchedule(scheduleData);

    httpResponse.created(res, schedule);
  } catch (error) {
    logger.error('Erro ao criar agendamento:', error);
    httpResponse.error(res, 'Erro ao criar agendamento');
  }
});

/**
 * PUT /api/schedules/:id
 * Atualizar agendamento (apenas se ainda não foi enviado)
 */
router.put('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    
    if (!schedule) {
      return httpResponse.notFound(res, 'Agendamento não encontrado');
    }

    if (schedule.status === 'sent') {
      return httpResponse.badRequest(res, 'Não é possível editar um agendamento já enviado');
    }

    const { 
      scheduledFor, 
      message, 
      mediaUrl, 
      mediaType,
      repeat,
      repeatUntil,
      metadata
    } = req.body;

    await schedule.update({
      scheduledFor: scheduledFor ? new Date(scheduledFor) : schedule.scheduledFor,
      message: message || schedule.message,
      mediaUrl: mediaUrl !== undefined ? mediaUrl : schedule.mediaUrl,
      mediaType: mediaType !== undefined ? mediaType : schedule.mediaType,
      repeat: repeat !== undefined ? repeat : schedule.repeat,
      repeatUntil: repeatUntil !== undefined ? (repeatUntil ? new Date(repeatUntil) : null) : schedule.repeatUntil,
      metadata: metadata !== undefined ? metadata : schedule.metadata
    });

    logger.info(`Agendamento ${schedule.id} atualizado`);
    httpResponse.ok(res, schedule);
  } catch (error) {
    logger.error('Erro ao atualizar agendamento:', error);
    httpResponse.error(res, 'Erro ao atualizar agendamento');
  }
});

/**
 * DELETE /api/schedules/:id
 * Excluir agendamento
 */
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    
    if (!schedule) {
      return httpResponse.notFound(res, 'Agendamento não encontrado');
    }

    if (schedule.status === 'sent') {
      return httpResponse.badRequest(res, 'Não é possível excluir um agendamento já enviado');
    }

    await schedule.destroy();
    
    logger.info(`Agendamento ${schedule.id} excluído`);
    httpResponse.noContent(res);
  } catch (error) {
    logger.error('Erro ao excluir agendamento:', error);
    httpResponse.error(res, 'Erro ao excluir agendamento');
  }
});

/**
 * POST /api/schedules/:id/cancel
 * Cancelar agendamento
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const schedule = await scheduleService.cancelSchedule(req.params.id);
    httpResponse.ok(res, schedule);
  } catch (error) {
    logger.error('Erro ao cancelar agendamento:', error);
    httpResponse.error(res, error.message);
  }
});

/**
 * POST /api/schedules/:id/retry
 * Reprocessar agendamento que falhou
 */
router.post('/:id/retry', async (req, res) => {
  try {
    const schedule = await scheduleService.retryFailed(req.params.id);
    httpResponse.ok(res, schedule);
  } catch (error) {
    logger.error('Erro ao reprocessar agendamento:', error);
    httpResponse.error(res, error.message);
  }
});

module.exports = router;

