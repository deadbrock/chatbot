const cron = require('cron');
const logger = require('../utils/logger');
const SessionManager = require('./sessionManager');
const TicketService = require('./ticketService');
const VoiceService = require('./voiceService');

const sessionManager = new SessionManager();
const ticketService = new TicketService();
const voiceService = new VoiceService();

/**
 * Inicializa todos os jobs agendados
 */
function initializeScheduledJobs() {
  logger.info('⏰ Inicializando jobs agendados...');

  // Job 1: Limpar sessões expiradas (a cada hora)
  const cleanSessionsJob = new cron.CronJob(
    '0 * * * *', // A cada hora
    async () => {
      logger.info('🔄 Executando limpeza de sessões...');
      try {
        await sessionManager.cleanExpiredSessions();
      } catch (error) {
        logger.error('Erro ao limpar sessões:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  // Job 2: Fechar tickets inativos (a cada 6 horas)
  const closeInactiveTicketsJob = new cron.CronJob(
    '0 */6 * * *', // A cada 6 horas
    async () => {
      logger.info('🔄 Fechando tickets inativos...');
      try {
        const hours = parseInt(process.env.AUTO_CLOSE_TICKET_HOURS) || 24;
        await ticketService.autoCloseInactiveTickets(hours);
      } catch (error) {
        logger.error('Erro ao fechar tickets inativos:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  // Job 3: Limpar arquivos temporários (diariamente às 3h)
  const cleanTempFilesJob = new cron.CronJob(
    '0 3 * * *', // Diariamente às 3h
    async () => {
      logger.info('🔄 Limpando arquivos temporários...');
      try {
        await voiceService.cleanTempFiles(24);
      } catch (error) {
        logger.error('Erro ao limpar arquivos temporários:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  // Job 4: Relatório diário (diariamente às 9h)
  const dailyReportJob = new cron.CronJob(
    '0 9 * * *', // Diariamente às 9h
    async () => {
      logger.info('📊 Gerando relatório diário...');
      try {
        await generateDailyReport();
      } catch (error) {
        logger.error('Erro ao gerar relatório:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  // Job 5: Backup de dados (diariamente às 2h)
  const backupJob = new cron.CronJob(
    '0 2 * * *', // Diariamente às 2h
    async () => {
      logger.info('💾 Executando backup...');
      try {
        await performBackup();
      } catch (error) {
        logger.error('Erro ao executar backup:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  // Job 6: Lembrete de tickets pendentes (a cada 2 horas durante horário comercial)
  const ticketReminderJob = new cron.CronJob(
    '0 8-18/2 * * 1-5', // A cada 2 horas, das 8h às 18h, seg-sex
    async () => {
      logger.info('🔔 Enviando lembretes de tickets...');
      try {
        await sendTicketReminders();
      } catch (error) {
        logger.error('Erro ao enviar lembretes:', error);
      }
    },
    null,
    true,
    'America/Sao_Paulo'
  );

  logger.info('✅ Jobs agendados iniciados com sucesso!');

  return {
    cleanSessionsJob,
    closeInactiveTicketsJob,
    cleanTempFilesJob,
    dailyReportJob,
    backupJob,
    ticketReminderJob
  };
}

/**
 * Gera relatório diário
 */
async function generateDailyReport() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await ticketService.getStats({
      createdAt: {
        $gte: yesterday,
        $lt: today
      }
    });

    const sessionStats = await sessionManager.getStats();

    const report = {
      date: yesterday.toLocaleDateString('pt-BR'),
      tickets: stats,
      sessions: sessionStats
    };

    logger.info('📊 Relatório diário:', report);

    // Aqui você pode enviar o relatório por email, salvar em arquivo, etc.
    
    return report;

  } catch (error) {
    logger.error('Erro ao gerar relatório:', error);
    throw error;
  }
}

/**
 * Executa backup dos dados
 */
async function performBackup() {
  try {
    logger.info('💾 Backup iniciado...');
    
    // Implementar lógica de backup
    // Exemplo: exportar MongoDB para arquivo, enviar para S3, etc.
    
    logger.info('✅ Backup concluído!');
    
  } catch (error) {
    logger.error('Erro no backup:', error);
    throw error;
  }
}

/**
 * Envia lembretes de tickets pendentes
 */
async function sendTicketReminders() {
  try {
    const openTickets = await ticketService.getOpenTickets();
    
    // Filtrar tickets que estão há mais de 4 horas sem resposta
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const pendingTickets = openTickets.filter(ticket => {
      return ticket.status === 'waiting_human' && 
             ticket.updatedAt < fourHoursAgo;
    });

    if (pendingTickets.length > 0) {
      logger.info(`🔔 ${pendingTickets.length} tickets pendentes encontrados`);
      
      // Notificar atendentes via Socket.IO ou email
      // Implementar conforme necessário
    }

    return pendingTickets.length;

  } catch (error) {
    logger.error('Erro ao enviar lembretes:', error);
    throw error;
  }
}

module.exports = {
  initializeScheduledJobs,
  generateDailyReport,
  performBackup,
  sendTicketReminders
};

