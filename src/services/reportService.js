const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

/**
 * SERVIÇO DE RELATÓRIOS
 * Geração de relatórios em PDF, Excel e CSV
 */

class ReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../uploads/reports');
    this.ensureReportsDirectory();
  }

  /**
   * Garante que o diretório de relatórios existe
   */
  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * ==============================================
   * GERAÇÃO DE RELATÓRIOS POR TIPO
   * ==============================================
   */

  /**
   * Relatório de Tickets
   */
  async generateTicketsReport(filters = {}) {
    const { dateFrom, dateTo, status, queueId, userId } = filters;
    
    const where = {};
    
    if (dateFrom) {
      where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
    }
    
    if (status) {
      where.status = status;
    }
    
    if (queueId) {
      where.queueId = queueId;
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    const Ticket = require('../models/TicketSQL');
    const Contact = require('../models/ContactSQL');
    const User = require('../models/UserSQL');
    const Queue = require('../models/QueueSQL');
    
    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: Contact, as: 'contact', attributes: ['name', 'number'] },
        { model: User, as: 'user', attributes: ['name'] },
        { model: Queue, as: 'queue', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Estatísticas
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      pending: tickets.filter(t => t.status === 'pending').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      avgWaitTime: this.calculateAvgWaitTime(tickets),
      avgResolutionTime: this.calculateAvgResolutionTime(tickets)
    };
    
    return { tickets, stats };
  }

  /**
   * Relatório de Mensagens
   */
  async generateMessagesReport(filters = {}) {
    const { dateFrom, dateTo, ticketId } = filters;
    
    const where = {};
    
    if (dateFrom) {
      where.timestamp = { ...where.timestamp, [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.timestamp = { ...where.timestamp, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
    }
    
    if (ticketId) {
      where.ticketId = ticketId;
    }
    
    const ChatMessage = require('../models/ChatMessageSQL');
    
    const messages = await ChatMessage.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: 10000 // Limite de segurança
    });
    
    const stats = {
      total: messages.length,
      received: messages.filter(m => !m.fromMe).length,
      sent: messages.filter(m => m.fromMe).length,
      byType: this.groupByField(messages, 'type'),
      byStatus: this.groupByField(messages, 'status')
    };
    
    return { messages, stats };
  }

  /**
   * Relatório de Atendentes
   */
  async generateAgentsReport(filters = {}) {
    const { dateFrom, dateTo, userId } = filters;
    
    const User = require('../models/UserSQL');
    const Ticket = require('../models/TicketSQL');
    const Rating = require('../models/RatingSQL');
    
    const where = {};
    if (userId) where.id = userId;
    
    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role']
    });
    
    const agentsData = [];
    
    for (const user of users) {
      const ticketWhere = { userId: user.id };
      
      if (dateFrom) {
        ticketWhere.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
      }
      
      if (dateTo) {
        ticketWhere.createdAt = { ...ticketWhere.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
      }
      
      const tickets = await Ticket.findAll({ where: ticketWhere });
      const ratings = await Rating.findAll({
        where: { userId: user.id }
      });
      
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : 0;
      
      agentsData.push({
        name: user.name,
        email: user.email,
        totalTickets: tickets.length,
        closedTickets: tickets.filter(t => t.status === 'closed').length,
        avgRating: avgRating.toFixed(2),
        avgResolutionTime: this.calculateAvgResolutionTime(tickets)
      });
    }
    
    return { agents: agentsData };
  }

  /**
   * Relatório de NPS
   */
  async generateNPSReport(filters = {}) {
    const { dateFrom, dateTo } = filters;
    
    const where = {};
    
    if (dateFrom) {
      where.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
    }
    
    const Rating = require('../models/RatingSQL');
    
    const ratings = await Rating.findAll({ where });
    
    const detractors = ratings.filter(r => r.score >= 1 && r.score <= 6).length;
    const passives = ratings.filter(r => r.score >= 7 && r.score <= 8).length;
    const promoters = ratings.filter(r => r.score >= 9 && r.score <= 10).length;
    const total = ratings.length;
    
    const nps = total > 0
      ? ((promoters - detractors) / total) * 100
      : 0;
    
    return {
      nps: nps.toFixed(2),
      total,
      detractors,
      passives,
      promoters,
      ratings
    };
  }

  /**
   * ==============================================
   * GERAÇÃO EM DIFERENTES FORMATOS
   * ==============================================
   */

  /**
   * Gerar PDF
   */
  async generatePDF(reportData, reportType, reportName) {
    return new Promise((resolve, reject) => {
      const filename = `${reportType}_${Date.now()}.pdf`;
      const filepath = path.join(this.reportsDir, filename);
      
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // Cabeçalho
      doc.fontSize(20).text(reportName || 'Relatório', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.moveDown(2);
      
      // Conteúdo baseado no tipo
      switch (reportType) {
        case 'tickets':
          this.addTicketsPDFContent(doc, reportData);
          break;
        case 'agents':
          this.addAgentsPDFContent(doc, reportData);
          break;
        case 'nps':
          this.addNPSPDFContent(doc, reportData);
          break;
        default:
          doc.text('Tipo de relatório não suportado');
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve({ filepath, filename });
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Adiciona conteúdo de tickets ao PDF
   */
  addTicketsPDFContent(doc, data) {
    const { tickets, stats } = data;
    
    // Estatísticas
    doc.fontSize(14).text('Estatísticas Gerais', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Total de Tickets: ${stats.total}`);
    doc.text(`Abertos: ${stats.open}`);
    doc.text(`Pendentes: ${stats.pending}`);
    doc.text(`Fechados: ${stats.closed}`);
    doc.text(`Tempo Médio de Espera: ${stats.avgWaitTime}`);
    doc.text(`Tempo Médio de Resolução: ${stats.avgResolutionTime}`);
    doc.moveDown(2);
    
    // Tabela de tickets (primeiros 50)
    doc.fontSize(14).text('Detalhes dos Tickets', { underline: true });
    doc.moveDown();
    doc.fontSize(8);
    
    const displayTickets = tickets.slice(0, 50);
    
    displayTickets.forEach((ticket, index) => {
      if (index > 0 && index % 10 === 0) {
        doc.addPage();
      }
      
      doc.text(`#${ticket.id.substring(0, 8)} | ${ticket.contact?.name || 'N/A'} | ${ticket.status} | ${new Date(ticket.createdAt).toLocaleDateString('pt-BR')}`);
    });
    
    if (tickets.length > 50) {
      doc.moveDown();
      doc.text(`... e mais ${tickets.length - 50} tickets`);
    }
  }

  /**
   * Adiciona conteúdo de atendentes ao PDF
   */
  addAgentsPDFContent(doc, data) {
    const { agents } = data;
    
    doc.fontSize(14).text('Desempenho dos Atendentes', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    
    agents.forEach((agent, index) => {
      if (index > 0 && index % 5 === 0) {
        doc.addPage();
      }
      
      doc.fontSize(12).text(agent.name, { underline: true });
      doc.fontSize(10);
      doc.text(`Email: ${agent.email}`);
      doc.text(`Total de Tickets: ${agent.totalTickets}`);
      doc.text(`Tickets Fechados: ${agent.closedTickets}`);
      doc.text(`Avaliação Média: ${agent.avgRating}`);
      doc.text(`Tempo Médio de Resolução: ${agent.avgResolutionTime}`);
      doc.moveDown();
    });
  }

  /**
   * Adiciona conteúdo de NPS ao PDF
   */
  addNPSPDFContent(doc, data) {
    doc.fontSize(14).text('Relatório de NPS', { underline: true });
    doc.moveDown();
    doc.fontSize(16).text(`NPS: ${data.nps}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Total de Avaliações: ${data.total}`);
    doc.text(`Promotores: ${data.promoters} (${((data.promoters / data.total) * 100).toFixed(1)}%)`);
    doc.text(`Neutros: ${data.passives} (${((data.passives / data.total) * 100).toFixed(1)}%)`);
    doc.text(`Detratores: ${data.detractors} (${((data.detractors / data.total) * 100).toFixed(1)}%)`);
  }

  /**
   * Gerar Excel
   */
  async generateExcel(reportData, reportType, reportName) {
    const filename = `${reportType}_${Date.now()}.xlsx`;
    const filepath = path.join(this.reportsDir, filename);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Chatbot WhatsApp';
    workbook.created = new Date();
    
    // Adicionar sheets baseado no tipo
    switch (reportType) {
      case 'tickets':
        this.addTicketsExcelSheet(workbook, reportData);
        break;
      case 'agents':
        this.addAgentsExcelSheet(workbook, reportData);
        break;
      case 'nps':
        this.addNPSExcelSheet(workbook, reportData);
        break;
    }
    
    await workbook.xlsx.writeFile(filepath);
    
    return { filepath, filename };
  }

  /**
   * Adiciona sheet de tickets ao Excel
   */
  addTicketsExcelSheet(workbook, data) {
    const { tickets, stats } = data;
    
    // Sheet de estatísticas
    const statsSheet = workbook.addWorksheet('Estatísticas');
    statsSheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 20 }
    ];
    
    statsSheet.addRows([
      { metric: 'Total de Tickets', value: stats.total },
      { metric: 'Abertos', value: stats.open },
      { metric: 'Pendentes', value: stats.pending },
      { metric: 'Fechados', value: stats.closed },
      { metric: 'Tempo Médio de Espera', value: stats.avgWaitTime },
      { metric: 'Tempo Médio de Resolução', value: stats.avgResolutionTime }
    ]);
    
    // Sheet de tickets
    const ticketsSheet = workbook.addWorksheet('Tickets');
    ticketsSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Contato', key: 'contact', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Fila', key: 'queue', width: 20 },
      { header: 'Atendente', key: 'user', width: 25 },
      { header: 'Criado em', key: 'createdAt', width: 20 }
    ];
    
    tickets.forEach(ticket => {
      ticketsSheet.addRow({
        id: ticket.id.substring(0, 8),
        contact: ticket.contact?.name || 'N/A',
        status: ticket.status,
        queue: ticket.queue?.name || 'N/A',
        user: ticket.user?.name || 'Não atribuído',
        createdAt: new Date(ticket.createdAt).toLocaleString('pt-BR')
      });
    });
    
    // Estilização
    statsSheet.getRow(1).font = { bold: true };
    ticketsSheet.getRow(1).font = { bold: true };
  }

  /**
   * Adiciona sheet de atendentes ao Excel
   */
  addAgentsExcelSheet(workbook, data) {
    const { agents } = data;
    
    const sheet = workbook.addWorksheet('Atendentes');
    sheet.columns = [
      { header: 'Nome', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Total Tickets', key: 'totalTickets', width: 15 },
      { header: 'Tickets Fechados', key: 'closedTickets', width: 18 },
      { header: 'Avaliação Média', key: 'avgRating', width: 18 },
      { header: 'Tempo Médio Resolução', key: 'avgResolutionTime', width: 25 }
    ];
    
    agents.forEach(agent => {
      sheet.addRow(agent);
    });
    
    sheet.getRow(1).font = { bold: true };
  }

  /**
   * Adiciona sheet de NPS ao Excel
   */
  addNPSExcelSheet(workbook, data) {
    const sheet = workbook.addWorksheet('NPS');
    sheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 20 }
    ];
    
    sheet.addRows([
      { metric: 'Score NPS', value: data.nps },
      { metric: 'Total de Avaliações', value: data.total },
      { metric: 'Promotores', value: data.promoters },
      { metric: 'Neutros', value: data.passives },
      { metric: 'Detratores', value: data.detractors }
    ]);
    
    sheet.getRow(1).font = { bold: true };
  }

  /**
   * Gerar CSV
   */
  async generateCSV(reportData, reportType, reportName) {
    const filename = `${reportType}_${Date.now()}.csv`;
    const filepath = path.join(this.reportsDir, filename);
    
    let records = [];
    let headers = [];
    
    switch (reportType) {
      case 'tickets':
        headers = [
          { id: 'id', title: 'ID' },
          { id: 'contact', title: 'Contato' },
          { id: 'status', title: 'Status' },
          { id: 'queue', title: 'Fila' },
          { id: 'user', title: 'Atendente' },
          { id: 'createdAt', title: 'Criado em' }
        ];
        records = reportData.tickets.map(t => ({
          id: t.id,
          contact: t.contact?.name || 'N/A',
          status: t.status,
          queue: t.queue?.name || 'N/A',
          user: t.user?.name || 'Não atribuído',
          createdAt: new Date(t.createdAt).toLocaleString('pt-BR')
        }));
        break;
        
      case 'agents':
        headers = [
          { id: 'name', title: 'Nome' },
          { id: 'email', title: 'Email' },
          { id: 'totalTickets', title: 'Total Tickets' },
          { id: 'closedTickets', title: 'Tickets Fechados' },
          { id: 'avgRating', title: 'Avaliação Média' },
          { id: 'avgResolutionTime', title: 'Tempo Médio Resolução' }
        ];
        records = reportData.agents;
        break;
    }
    
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: headers
    });
    
    await csvWriter.writeRecords(records);
    
    return { filepath, filename };
  }

  /**
   * ==============================================
   * FUNÇÕES AUXILIARES
   * ==============================================
   */

  calculateAvgWaitTime(tickets) {
    if (!tickets || tickets.length === 0) return '0 min';
    
    const total = tickets.reduce((sum, ticket) => {
      if (ticket.firstResponseAt && ticket.createdAt) {
        return sum + (new Date(ticket.firstResponseAt) - new Date(ticket.createdAt));
      }
      return sum;
    }, 0);
    
    const avgMs = total / tickets.length;
    const avgMin = Math.round(avgMs / 1000 / 60);
    return `${avgMin} min`;
  }

  calculateAvgResolutionTime(tickets) {
    const closedTickets = tickets.filter(t => t.closedAt);
    if (closedTickets.length === 0) return '0 min';
    
    const total = closedTickets.reduce((sum, ticket) => {
      return sum + (new Date(ticket.closedAt) - new Date(ticket.createdAt));
    }, 0);
    
    const avgMs = total / closedTickets.length;
    const avgMin = Math.round(avgMs / 1000 / 60);
    return `${avgMin} min`;
  }

  groupByField(items, field) {
    return items.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Limpar arquivos antigos de relatórios
   */
  async cleanupOldFiles(daysOld = 30) {
    const files = fs.readdirSync(this.reportsDir);
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    let deleted = 0;
    
    files.forEach(file => {
      const filepath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filepath);
        deleted++;
      }
    });
    
    return deleted;
  }
}

// Singleton
const reportService = new ReportService();

module.exports = reportService;

