const { CronJob } = require('cron');
const analyticsService = require('./analyticsService');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

/**
 * SNAPSHOT SCHEDULER
 * Gera snapshots diários automaticamente
 */

let snapshotJob;

/**
 * Processa snapshot diário
 */
async function processSnapshot() {
  try {
    logger.info('🔄 Iniciando processamento de snapshot diário...');

    // Gerar snapshot do dia anterior
    const yesterday = moment().subtract(1, 'day').toDate();

    await analyticsService.generateDailySnapshot(yesterday);

    logger.info('✅ Snapshot diário processado com sucesso!');
  } catch (error) {
    logger.error('❌ Erro ao processar snapshot diário:', error);
  }
}

/**
 * Inicializa o scheduler de snapshots
 */
function initializeSnapshotScheduler() {
  if (snapshotJob) {
    snapshotJob.stop();
  }

  // Rodar todo dia à meia-noite e 5 minutos (00:05)
  snapshotJob = new CronJob(
    '5 0 * * *', // 00:05 todos os dias
    processSnapshot,
    null,
    true, // Iniciar agora
    'America/Sao_Paulo'
  );

  logger.info('⏰ Snapshot Scheduler inicializado para rodar diariamente às 00:05');

  // Opcionalmente, executar agora se necessário
  // processSnapshot();
}

/**
 * Para o scheduler
 */
function stopSnapshotScheduler() {
  if (snapshotJob) {
    snapshotJob.stop();
    logger.info('⏹️  Snapshot Scheduler parado');
  }
}

/**
 * Gera snapshots retroativos
 */
async function generateRetroactiveSnapshots(daysBack = 30) {
  try {
    logger.info(`📸 Gerando ${daysBack} snapshots retroativos...`);

    const promises = [];
    for (let i = 1; i <= daysBack; i++) {
      const date = moment().subtract(i, 'days').toDate();
      promises.push(analyticsService.generateDailySnapshot(date));
    }

    await Promise.all(promises);

    logger.info(`✅ ${daysBack} snapshots retroativos gerados com sucesso!`);
  } catch (error) {
    logger.error('Erro ao gerar snapshots retroativos:', error);
    throw error;
  }
}

module.exports = {
  initializeSnapshotScheduler,
  stopSnapshotScheduler,
  processSnapshot,
  generateRetroactiveSnapshots,
};

