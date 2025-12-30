const Report = require('../models/ReportSQL');
const reportService = require('../services/reportService');
const { success, error, notFound } = require('../utils/http');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * CONTROLLER DE RELATÓRIOS
 * Gerenciamento completo de relatórios
 */

/**
 * Lista todos os relatórios
 * GET /api/reports
 */
exports.listReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, includePublic = true } = req.query;
    
    let reports;
    
    // Se for admin, pode ver todos
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const where = {};
      
      if (type) where.type = type;
      if (status) where.status = status;
      
      reports = await Report.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });
    } else {
      // Usuário comum vê apenas seus relatórios e públicos
      reports = await Report.findUserReports(userId, includePublic === 'true');
      
      if (type) {
        reports = reports.filter(r => r.type === type);
      }
      
      if (status) {
        reports = reports.filter(r => r.status === status);
      }
    }
    
    // Adicionar descrições legíveis
    const reportsWithDescriptions = reports.map(report => ({
      ...report.toJSON(),
      filtersDescription: report.getFiltersDescription(),
      scheduleDescription: report.getScheduleDescription()
    }));
    
    success(res, reportsWithDescriptions, 'Relatórios listados com sucesso');
  } catch (err) {
    logger.error('Erro ao listar relatórios:', err);
    error(res, 'Erro ao listar relatórios', 500);
  }
};

/**
 * Cria novo relatório
 * POST /api/reports
 */
exports.createReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      type,
      filters,
      schedule,
      format,
      recipients,
      isPublic,
      allowedUsers,
      customFields,
      chartTypes
    } = req.body;
    
    // Validações
    if (!name) {
      return error(res, 'Nome do relatório é obrigatório', 400);
    }
    
    if (!type) {
      return error(res, 'Tipo do relatório é obrigatório', 400);
    }
    
    // Criar relatório
    const report = await Report.create({
      name,
      description,
      type,
      filters: filters || {},
      schedule: schedule || null,
      format: format || 'pdf',
      recipients: recipients || [],
      status: schedule ? 'active' : 'draft',
      isPublic: isPublic || false,
      allowedUsers: allowedUsers || [],
      customFields: customFields || [],
      chartTypes: chartTypes || [],
      createdBy: userId
    });
    
    // Calcular próxima execução se agendado
    if (schedule) {
      report.nextScheduled = report.calculateNextScheduled();
      await report.save();
    }
    
    logger.info(`Relatório criado: ${report.id} por ${userId}`);
    success(res, report, 'Relatório criado com sucesso', 201);
  } catch (err) {
    logger.error('Erro ao criar relatório:', err);
    error(res, 'Erro ao criar relatório', 500);
  }
};

/**
 * Obtém detalhes de um relatório
 * GET /api/reports/:id
 */
exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const report = await Report.findByPk(id);
    
    if (!report) {
      return notFound(res, 'Relatório não encontrado');
    }
    
    // Verificar permissão
    if (!report.hasAccess(userId) && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return error(res, 'Acesso negado', 403);
    }
    
    const reportData = {
      ...report.toJSON(),
      filtersDescription: report.getFiltersDescription(),
      scheduleDescription: report.getScheduleDescription()
    };
    
    success(res, reportData, 'Relatório obtido com sucesso');
  } catch (err) {
    logger.error('Erro ao obter relatório:', err);
    error(res, 'Erro ao obter relatório', 500);
  }
};

/**
 * Atualiza um relatório
 * PATCH /api/reports/:id
 */
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    
    const report = await Report.findByPk(id);
    
    if (!report) {
      return notFound(res, 'Relatório não encontrado');
    }
    
    // Verificar permissão (apenas criador ou admin)
    if (report.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return error(res, 'Acesso negado', 403);
    }
    
    // Campos permitidos para atualização
    const allowedFields = [
      'name', 'description', 'filters', 'schedule', 'format',
      'recipients', 'status', 'isPublic', 'allowedUsers',
      'customFields', 'chartTypes'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        report[field] = updates[field];
      }
    });
    
    report.updatedBy = userId;
    
    // Recalcular próxima execução se schedule mudou
    if (updates.schedule) {
      report.nextScheduled = report.calculateNextScheduled();
    }
    
    await report.save();
    
    logger.info(`Relatório atualizado: ${report.id} por ${userId}`);
    success(res, report, 'Relatório atualizado com sucesso');
  } catch (err) {
    logger.error('Erro ao atualizar relatório:', err);
    error(res, 'Erro ao atualizar relatório', 500);
  }
};

/**
 * Deleta um relatório
 * DELETE /api/reports/:id
 */
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const report = await Report.findByPk(id);
    
    if (!report) {
      return notFound(res, 'Relatório não encontrado');
    }
    
    // Verificar permissão (apenas criador ou admin)
    if (report.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return error(res, 'Acesso negado', 403);
    }
    
    await report.destroy();
    
    logger.info(`Relatório deletado: ${id} por ${userId}`);
    success(res, null, 'Relatório deletado com sucesso');
  } catch (err) {
    logger.error('Erro ao deletar relatório:', err);
    error(res, 'Erro ao deletar relatório', 500);
  }
};

/**
 * Gera um relatório manualmente
 * POST /api/reports/:id/generate
 */
exports.generateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { format } = req.body;
    
    const report = await Report.findByPk(id);
    
    if (!report) {
      return notFound(res, 'Relatório não encontrado');
    }
    
    // Verificar permissão
    if (!report.hasAccess(userId) && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return error(res, 'Acesso negado', 403);
    }
    
    logger.info(`Gerando relatório ${id} no formato ${format || report.format}...`);
    
    // Gerar dados do relatório
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
        return error(res, 'Tipo de relatório não suportado', 400);
    }
    
    // Gerar arquivo no formato especificado
    const outputFormat = format || report.format;
    let result;
    
    switch (outputFormat) {
      case 'pdf':
        result = await reportService.generatePDF(reportData, report.type, report.name);
        break;
      case 'excel':
        result = await reportService.generateExcel(reportData, report.type, report.name);
        break;
      case 'csv':
        result = await reportService.generateCSV(reportData, report.type, report.name);
        break;
      case 'json':
        result = { data: reportData, filename: `${report.type}_${Date.now()}.json` };
        break;
      default:
        return error(res, 'Formato não suportado', 400);
    }
    
    // Atualizar estatísticas do relatório
    await report.markAsGenerated();
    
    logger.info(`Relatório ${id} gerado com sucesso: ${result.filename}`);
    
    success(res, {
      filename: result.filename,
      filepath: result.filepath,
      downloadUrl: `/api/reports/${id}/download?file=${result.filename}`,
      data: outputFormat === 'json' ? result.data : undefined
    }, 'Relatório gerado com sucesso');
  } catch (err) {
    logger.error('Erro ao gerar relatório:', err);
    
    // Marcar relatório como erro
    const report = await Report.findByPk(req.params.id);
    if (report) {
      await report.markAsError(err);
    }
    
    error(res, 'Erro ao gerar relatório: ' + err.message, 500);
  }
};

/**
 * Download de relatório gerado
 * GET /api/reports/:id/download
 */
exports.downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { file } = req.query;
    const userId = req.user.id;
    
    if (!file) {
      return error(res, 'Nome do arquivo não fornecido', 400);
    }
    
    const report = await Report.findByPk(id);
    
    if (!report) {
      return notFound(res, 'Relatório não encontrado');
    }
    
    // Verificar permissão
    if (!report.hasAccess(userId) && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return error(res, 'Acesso negado', 403);
    }
    
    const filepath = path.join(__dirname, '../../uploads/reports', file);
    
    if (!fs.existsSync(filepath)) {
      return notFound(res, 'Arquivo não encontrado');
    }
    
    // Determinar tipo de conteúdo
    const ext = path.extname(file).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
    logger.info(`Download de relatório: ${file} por ${userId}`);
  } catch (err) {
    logger.error('Erro ao baixar relatório:', err);
    error(res, 'Erro ao baixar relatório', 500);
  }
};

/**
 * Histórico de relatórios gerados
 * GET /api/reports/history
 */
exports.getReportsHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    let reports;
    
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      reports = await Report.findAll({
        where: {
          lastGenerated: {
            [Report.sequelize.Sequelize.Op.ne]: null
          }
        },
        order: [['lastGenerated', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else {
      reports = await Report.findAll({
        where: {
          createdBy: userId,
          lastGenerated: {
            [Report.sequelize.Sequelize.Op.ne]: null
          }
        },
        order: [['lastGenerated', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }
    
    success(res, reports, 'Histórico obtido com sucesso');
  } catch (err) {
    logger.error('Erro ao obter histórico:', err);
    error(res, 'Erro ao obter histórico', 500);
  }
};

/**
 * Relatório customizado ad-hoc
 * POST /api/reports/custom-query
 */
exports.customQuery = async (req, res) => {
  try {
    const { type, filters, format = 'json' } = req.body;
    
    if (!type) {
      return error(res, 'Tipo do relatório é obrigatório', 400);
    }
    
    logger.info(`Gerando relatório customizado: ${type}`);
    
    // Gerar dados
    let reportData;
    
    switch (type) {
      case 'tickets':
        reportData = await reportService.generateTicketsReport(filters);
        break;
      case 'messages':
        reportData = await reportService.generateMessagesReport(filters);
        break;
      case 'agents':
        reportData = await reportService.generateAgentsReport(filters);
        break;
      case 'nps':
        reportData = await reportService.generateNPSReport(filters);
        break;
      default:
        return error(res, 'Tipo não suportado', 400);
    }
    
    // Se format for json, retornar direto
    if (format === 'json') {
      return success(res, reportData, 'Relatório gerado com sucesso');
    }
    
    // Caso contrário, gerar arquivo
    let result;
    
    switch (format) {
      case 'pdf':
        result = await reportService.generatePDF(reportData, type, 'Relatório Customizado');
        break;
      case 'excel':
        result = await reportService.generateExcel(reportData, type, 'Relatório Customizado');
        break;
      case 'csv':
        result = await reportService.generateCSV(reportData, type, 'Relatório Customizado');
        break;
      default:
        return error(res, 'Formato não suportado', 400);
    }
    
    success(res, {
      filename: result.filename,
      downloadUrl: `/api/reports/download-temp?file=${result.filename}`
    }, 'Relatório gerado com sucesso');
  } catch (err) {
    logger.error('Erro ao gerar relatório customizado:', err);
    error(res, 'Erro ao gerar relatório customizado', 500);
  }
};

/**
 * Estatísticas de relatórios
 * GET /api/reports/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await Report.getStats();
    success(res, stats, 'Estatísticas obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter estatísticas:', err);
    error(res, 'Erro ao obter estatísticas', 500);
  }
};

/**
 * Exportação de Tickets
 * POST /api/reports/export/tickets
 */
exports.exportTickets = async (req, res) => {
  try {
    const { format = 'excel', filters = {} } = req.body;
    
    const reportData = await reportService.generateTicketsReport(filters);
    
    let result;
    
    switch (format) {
      case 'excel':
        result = await reportService.generateExcel(reportData, 'tickets', 'Exportação de Tickets');
        break;
      case 'csv':
        result = await reportService.generateCSV(reportData, 'tickets', 'Exportação de Tickets');
        break;
      case 'json':
        return success(res, reportData, 'Tickets exportados com sucesso');
      default:
        return error(res, 'Formato não suportado', 400);
    }
    
    success(res, {
      filename: result.filename,
      downloadUrl: `/api/reports/download-temp?file=${result.filename}`
    }, 'Tickets exportados com sucesso');
  } catch (err) {
    logger.error('Erro ao exportar tickets:', err);
    error(res, 'Erro ao exportar tickets', 500);
  }
};

/**
 * Exportação de Contatos
 * POST /api/reports/export/contacts
 */
exports.exportContacts = async (req, res) => {
  try {
    const { format = 'excel', includeStats = true } = req.body;
    const Contact = require('../models/ContactSQL');
    
    const contacts = await Contact.findAll({
      order: [['name', 'ASC']]
    });
    
    const contactsData = contacts.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      email: c.email,
      isGroup: c.isGroup,
      ticketsCount: includeStats ? (c.metadata?.ticketsCount || 0) : undefined,
      createdAt: c.createdAt
    }));
    
    if (format === 'json') {
      return success(res, contactsData, 'Contatos exportados com sucesso');
    }
    
    // Gerar arquivo (simplificado)
    const filename = `contacts_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    
    success(res, {
      filename,
      data: contactsData,
      downloadUrl: `/api/reports/download-temp?file=${filename}`
    }, 'Contatos exportados com sucesso');
  } catch (err) {
    logger.error('Erro ao exportar contatos:', err);
    error(res, 'Erro ao exportar contatos', 500);
  }
};

/**
 * Download temporário (arquivos gerados ad-hoc)
 * GET /api/reports/download-temp
 */
exports.downloadTemp = async (req, res) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return error(res, 'Nome do arquivo não fornecido', 400);
    }
    
    const filepath = path.join(__dirname, '../../uploads/reports', file);
    
    if (!fs.existsSync(filepath)) {
      return notFound(res, 'Arquivo não encontrado');
    }
    
    const ext = path.extname(file).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
    // Deletar arquivo após 1 minuto
    setTimeout(() => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }, 60000);
  } catch (err) {
    logger.error('Erro ao baixar arquivo:', err);
    error(res, 'Erro ao baixar arquivo', 500);
  }
};

module.exports = exports;

