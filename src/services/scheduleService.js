const Schedule = require('../models/ScheduleSQL');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Serviço de Agendamentos
 * Processa mensagens agendadas e follow-ups
 */
class ScheduleService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkIntervalMs = 30000; // Verificar a cada 30 segundos
  }

  /**
   * Inicia o processador de agendamentos
   */
  start() {
    if (this.isRunning) {
      logger.warn('Schedule service já está rodando');
      return;
    }

    logger.info('📅 Iniciando Schedule Service...');
    this.isRunning = true;

    // Processar agendamentos imediatamente
    this.processSchedules();

    // Processar a cada X segundos
    this.intervalId = setInterval(() => {
      this.processSchedules();
    }, this.checkIntervalMs);

    logger.info(`✅ Schedule Service iniciado (verificando a cada ${this.checkIntervalMs/1000}s)`);
  }

  /**
   * Para o processador de agendamentos
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('📅 Schedule Service parado');
  }

  /**
   * Processa agendamentos pendentes
   */
  async processSchedules() {
    try {
      // Buscar agendamentos prontos para serem processados
      const readySchedules = await Schedule.findAll({
        where: {
          status: 'pending',
          scheduledFor: {
            [Op.lte]: new Date()
          }
        },
        order: [['scheduledFor', 'ASC']],
        limit: 50 // Processar até 50 por vez
      });

      if (readySchedules.length === 0) {
        return;
      }

      logger.info(`📅 Processando ${readySchedules.length} agendamento(s)...`);

      for (const schedule of readySchedules) {
        await this.processSingleSchedule(schedule);
      }

    } catch (error) {
      logger.error('Erro ao processar agendamentos:', error);
    }
  }

  /**
   * Processa um agendamento individual
   */
  async processSingleSchedule(schedule) {
    try {
      // Marcar como processando
      schedule.status = 'processing';
      await schedule.save();

      // TODO: Integrar com WhatsApp client para enviar mensagem
      // Por enquanto, apenas simular o envio
      logger.info(`Enviando mensagem agendada para ${schedule.recipientId}...`);

      // Simular envio bem-sucedido
      await schedule.markAsSent();
      logger.info(`✅ Agendamento ${schedule.id} enviado com sucesso`);

      // Se for recorrente, criar próxima ocorrência
      if (schedule.repeat !== 'none') {
        const nextSchedule = await schedule.createNextOccurrence();
        if (nextSchedule) {
          logger.info(`📅 Próxima ocorrência agendada para ${nextSchedule.scheduledFor}`);
        }
      }

    } catch (error) {
      logger.error(`Erro ao processar agendamento ${schedule.id}:`, error);
      await schedule.markAsFailed(error.message);
    }
  }

  /**
   * Cria um novo agendamento
   */
  async createSchedule(data) {
    try {
      const schedule = await Schedule.create(data);
      logger.info(`✅ Agendamento criado: ${schedule.id} para ${schedule.scheduledFor}`);
      return schedule;
    } catch (error) {
      logger.error('Erro ao criar agendamento:', error);
      throw error;
    }
  }

  /**
   * Cancela um agendamento
   */
  async cancelSchedule(scheduleId) {
    try {
      const schedule = await Schedule.findByPk(scheduleId);
      if (!schedule) {
        throw new Error('Agendamento não encontrado');
      }

      if (schedule.status === 'sent') {
        throw new Error('Não é possível cancelar um agendamento já enviado');
      }

      await schedule.cancel();
      logger.info(`❌ Agendamento ${scheduleId} cancelado`);
      return schedule;
    } catch (error) {
      logger.error('Erro ao cancelar agendamento:', error);
      throw error;
    }
  }

  /**
   * Reprocessa agendamentos que falharam
   */
  async retryFailed(scheduleId) {
    try {
      const schedule = await Schedule.findByPk(scheduleId);
      if (!schedule) {
        throw new Error('Agendamento não encontrado');
      }

      if (schedule.status !== 'failed') {
        throw new Error('Apenas agendamentos com falha podem ser reprocessados');
      }

      schedule.status = 'pending';
      schedule.errorMessage = null;
      await schedule.save();

      logger.info(`🔄 Agendamento ${scheduleId} marcado para reprocessamento`);
      return schedule;
    } catch (error) {
      logger.error('Erro ao reprocessar agendamento:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de agendamentos
   */
  async getStats(startDate = null, endDate = null) {
    try {
      const whereClause = {};

      if (startDate && endDate) {
        whereClause.scheduledFor = {
          [Op.between]: [startDate, endDate]
        };
      }

      const total = await Schedule.count({ where: whereClause });
      const pending = await Schedule.count({ where: { ...whereClause, status: 'pending' } });
      const sent = await Schedule.count({ where: { ...whereClause, status: 'sent' } });
      const failed = await Schedule.count({ where: { ...whereClause, status: 'failed' } });
      const cancelled = await Schedule.count({ where: { ...whereClause, status: 'cancelled' } });

      const byType = await Schedule.findAll({
        where: whereClause,
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type'],
        raw: true
      });

      return {
        total,
        pending,
        sent,
        failed,
        cancelled,
        byType
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas de agendamentos:', error);
      throw error;
    }
  }
}

module.exports = new ScheduleService();

