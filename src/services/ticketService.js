const Ticket = require('../models/TicketSQL');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');

class TicketService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.ensureUploadsDir();
  }

  /**
   * Garante que o diretório de uploads existe
   */
  async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      logger.error('Erro ao criar diretório de uploads:', error);
    }
  }

  /**
   * Cria novo ticket
   */
  async createTicket(userId, data = {}) {
    try {
      const protocol = await Ticket.generateProtocol();

      const ticket = await Ticket.create({
        protocol,
        userId,
        userName: data.userName,
        userPhone: data.userPhone,
        department: data.department,
        departmentId: data.departmentId,
        subject: data.subject,
        description: data.description,
        priority: data.priority || 'medium',
        metadata: data.metadata || {}
      });
      
      logger.info(`🎫 Ticket criado: ${protocol} para ${userId}`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao criar ticket:', error);
      throw error;
    }
  }

  /**
   * Obtém ou cria ticket para usuário
   */
  async getOrCreateTicket(userId) {
    try {
      // Buscar ticket aberto mais recente
      let ticket = await Ticket.findOne({
        where: {
          userId,
          status: { [Op.in]: ['open', 'waiting_human', 'in_progress'] }
        },
        order: [['createdAt', 'DESC']]
      });

      // Se não existir, criar novo
      if (!ticket) {
        ticket = await this.createTicket(userId);
      }

      return ticket;

    } catch (error) {
      logger.error('Erro ao obter/criar ticket:', error);
      throw error;
    }
  }

  /**
   * Atualiza ticket
   */
  async updateTicket(ticketId, updates) {
    try {
      const ticket = await Ticket.findByPk(ticketId);

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      await ticket.update(updates);

      logger.debug(`✅ Ticket ${ticket.protocol} atualizado`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao atualizar ticket:', error);
      throw error;
    }
  }

  /**
   * Adiciona mensagem ao ticket
   */
  async addMessage(ticketId, from, message, type = 'text', isBot = false) {
    try {
      const ticket = await Ticket.findByPk(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      await ticket.addMessage(from, message, type, isBot);
      
      return ticket;

    } catch (error) {
      logger.error('Erro ao adicionar mensagem:', error);
      throw error;
    }
  }

  /**
   * Registra interação
   */
  async logInteraction(userId, interactionData) {
    try {
      const ticket = await this.getOrCreateTicket(userId);
      
      // Adicionar como mensagem
      await ticket.addMessage(
        userId,
        JSON.stringify(interactionData),
        'system',
        true
      );
      
      return ticket;

    } catch (error) {
      logger.error('Erro ao registrar interação:', error);
      throw error;
    }
  }

  /**
   * Anexa mídia ao ticket
   */
  async attachMedia(ticketId, mediaData) {
    try {
      const ticket = await Ticket.findByPk(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      // Salvar arquivo
      const filename = `${Date.now()}_${mediaData.filename}`;
      const filepath = path.join(this.uploadsDir, filename);
      
      const buffer = Buffer.from(mediaData.data, 'base64');
      await fs.writeFile(filepath, buffer);

      // Adicionar ao ticket
      const attachments = ticket.attachments || [];
      attachments.push({
        filename: mediaData.filename,
        mimetype: mediaData.mimetype,
        size: buffer.length,
        url: `/uploads/${filename}`,
        uploadedAt: new Date()
      });

      ticket.attachments = attachments;
      await ticket.save();
      
      logger.debug(`📎 Mídia anexada ao ticket ${ticket.protocol}`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao anexar mídia:', error);
      throw error;
    }
  }

  /**
   * Atribui ticket a atendente
   */
  async assignTicket(ticketId, agentId) {
    try {
      const ticket = await Ticket.findByPk(ticketId);

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      await ticket.update({
        assignedTo: agentId,
        assignedAt: new Date(),
        status: 'in_progress'
      });

      logger.info(`👤 Ticket ${ticket.protocol} atribuído ao agente ${agentId}`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao atribuir ticket:', error);
      throw error;
    }
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(ticketId, resolution) {
    try {
      const ticket = await Ticket.findByPk(ticketId);

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      const metadata = ticket.metadata || {};
      metadata.resolution = resolution;

      await ticket.update({
        status: 'resolved',
        resolvedAt: new Date(),
        metadata
      });

      logger.info(`✅ Ticket ${ticket.protocol} resolvido`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao resolver ticket:', error);
      throw error;
    }
  }

  /**
   * Fecha ticket
   */
  async closeTicket(ticketId, feedback = null) {
    try {
      const ticket = await Ticket.findByPk(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      await ticket.closeTicket(feedback);
      
      logger.info(`🔒 Ticket ${ticket.protocol} fechado`);
      return ticket;

    } catch (error) {
      logger.error('Erro ao fechar ticket:', error);
      throw error;
    }
  }

  /**
   * Obtém tickets do usuário
   */
  async getUserTickets(userId, limit = 10) {
    try {
      return await Ticket.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit
      });
    } catch (error) {
      logger.error('Erro ao obter tickets do usuário:', error);
      return [];
    }
  }

  /**
   * Obtém tickets por departamento
   */
  async getDepartmentTickets(departmentId, status = null) {
    try {
      const where = { departmentId };
      
      if (status) {
        where.status = status;
      }

      return await Ticket.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });

    } catch (error) {
      logger.error('Erro ao obter tickets do departamento:', error);
      return [];
    }
  }

  /**
   * Obtém tickets abertos
   */
  async getOpenTickets() {
    try {
      return await Ticket.getOpenTickets();
    } catch (error) {
      logger.error('Erro ao obter tickets abertos:', error);
      return [];
    }
  }

  /**
   * Busca ticket por protocolo
   */
  async getTicketByProtocol(protocol) {
    try {
      return await Ticket.findOne({ where: { protocol } });
    } catch (error) {
      logger.error('Erro ao buscar ticket:', error);
      return null;
    }
  }

  /**
   * Estatísticas de tickets
   */
  async getStats(filters = {}) {
    try {
      const { fn, col, literal } = require('sequelize');
      
      const whereClause = {};
      if (filters.createdAt) {
        whereClause.createdAt = filters.createdAt;
      }

      const total = await Ticket.count({ where: whereClause });
      const open = await Ticket.count({ where: { ...whereClause, status: 'open' } });
      const inProgress = await Ticket.count({ where: { ...whereClause, status: 'in_progress' } });
      const resolved = await Ticket.count({ where: { ...whereClause, status: 'resolved' } });
      const closed = await Ticket.count({ where: { ...whereClause, status: 'closed' } });

      const avgRatingResult = await Ticket.findOne({
        attributes: [[fn('AVG', col('rating')), 'avg']],
        where: { ...whereClause, rating: { [Op.ne]: null } }
      });

      return {
        total,
        open,
        inProgress,
        resolved,
        closed,
        avgRating: avgRatingResult ? parseFloat(avgRatingResult.get('avg')) || 0 : 0,
        avgResponseTime: 0 // Calcular se necessário
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Fecha tickets inativos automaticamente
   */
  async autoCloseInactiveTickets(hoursInactive = 24) {
    try {
      const cutoffDate = new Date(Date.now() - hoursInactive * 60 * 60 * 1000);

      const result = await Ticket.update(
        {
          status: 'closed',
          closedAt: new Date()
        },
        {
          where: {
            status: { [Op.in]: ['open', 'waiting_human'] },
            updatedAt: { [Op.lt]: cutoffDate }
          }
        }
      );

      const count = result[0];
      logger.info(`🔒 ${count} tickets fechados por inatividade`);
      return count;

    } catch (error) {
      logger.error('Erro ao fechar tickets inativos:', error);
      return 0;
    }
  }
}

module.exports = TicketService;
