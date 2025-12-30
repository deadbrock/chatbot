const cron = require('cron');
const Report = require('../models/ReportSQL');
const reportService = require('./reportService');
const logger = require('../utils/logger');

/**
 * AGENDADOR DE RELATÓRIOS
 * Processa relatórios agendados automaticamente
 */

class ReportScheduler {
  constructor() {
    this.job = null;
  }

  /**
   * Inicia o agendador
   * Executa a cada 5 minutos
   */
  start() {
    logger.info('📊 Iniciando agendador de relatórios...');
    
    // Executar a cada 5 minutos
    this.job = new cron.CronJob('*/5 * * * *', async () => {
      await this.processScheduledReports();
    });
    
    this.job.start();
    
    logger.info('✅ Agendador de relatórios iniciado!');
  }

  /**
   * Para o agendador
   */
  stop() {
    if (this.job) {
      this.job.stop();
      logger.info('🛑 Agendador de relatórios parado');
    }
  }

  /**
   * Processa relatórios que devem ser gerados
   */
  async processScheduledReports() {
    try {
      const reports = await Report.findScheduledReports();
      
      if (reports.length === 0) {
        return;
      }
      
      logger.info(`📊 Processando ${reports.length} relatório(s) agendado(s)...`);
      
      for (const report of reports) {
        try {
          await this.generateAndSendReport(report);
        } catch (error) {
          logger.error(`Erro ao processar relatório ${report.id}:`, error);
          await report.markAsError(error);
        }
      }
      
      logger.info(`✅ ${reports.length} relatório(s) processado(s)!`);
    } catch (error) {
      logger.error('Erro ao processar relatórios agendados:', error);
    }
  }

  /**
   * Gera e envia um relatório
   */
  async generateAndSendReport(report) {
    logger.info(`📊 Gerando relatório: ${report.name} (${report.id})`);
    
    // Gerar dados
    let reportData;
    
    switch (report.type) {
      case 'tickets':
        reportData = await reportService.generateTicketsReport(report.filters);
        break;
      case 'messages':
        reportData = await reportService.generateMessagesReport(report.filters);
        break;
      case 'agents':
        reportData = await reportService.generateAgentsReport(report.filters);
        break;
      case 'nps':
        reportData = await reportService.generateNPSReport(report.filters);
        break;
      default:
        throw new Error(`Tipo de relatório não suportado: ${report.type}`);
    }
    
    // Gerar arquivo
    let result;
    
    switch (report.format) {
      case 'pdf':
        result = await reportService.generatePDF(reportData, report.type, report.name);
        break;
      case 'excel':
        result = await reportService.generateExcel(reportData, report.type, report.name);
        break;
      case 'csv':
        result = await reportService.generateCSV(reportData, report.type, report.name);
        break;
      default:
        throw new Error(`Formato não suportado: ${report.format}`);
    }
    
    logger.info(`✅ Relatório gerado: ${result.filename}`);
    
    // Enviar por email se houver destinatários
    if (report.recipients && report.recipients.length > 0) {
      // TODO: Implementar envio de email
      logger.info(`📧 Enviaria para: ${report.recipients.join(', ')}`);
    }
    
    // Atualizar relatório
    await report.markAsGenerated();
    
    logger.info(`✅ Relatório ${report.name} processado com sucesso!`);
  }

  /**
   * Limpa arquivos antigos periodicamente
   */
  async cleanupOldFiles() {
    try {
      const deleted = await reportService.cleanupOldFiles(30);
      logger.info(`🗑️ ${deleted} arquivo(s) antigo(s) deletado(s)`);
    } catch (error) {
      logger.error('Erro ao limpar arquivos antigos:', error);
    }
  }
}

// Singleton
const reportScheduler = new ReportScheduler();

module.exports = reportScheduler;

