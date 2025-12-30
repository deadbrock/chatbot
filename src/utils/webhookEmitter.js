const webhookService = require('../services/webhookService');
const logger = require('./logger');

/**
 * EMITTER DE WEBHOOKS
 * Utilitário para disparar webhooks em diferentes partes do sistema
 */

class WebhookEmitter {
  /**
   * Emite evento de webhook
   * @param {string} eventName - Nome do evento
   * @param {object} data - Dados do evento
   */
  async emit(eventName, data) {
    try {
      // Disparar webhooks de forma assíncrona (não bloqueia)
      setImmediate(async () => {
        try {
          await webhookService.trigger(eventName, data);
        } catch (error) {
          logger.error(`Erro ao disparar webhooks para ${eventName}:`, error);
        }
      });
    } catch (error) {
      logger.error('Erro no webhook emitter:', error);
    }
  }

  /**
   * ==============================================
   * EVENTOS DE TICKET
   * ==============================================
   */

  async ticketCreated(ticket) {
    await this.emit('ticket.created', {
      id: ticket.id,
      contact: ticket.contact,
      queue: ticket.queue,
      status: ticket.status,
      createdAt: ticket.createdAt
    });
  }

  async ticketUpdated(ticket, changes) {
    await this.emit('ticket.updated', {
      id: ticket.id,
      changes,
      ticket
    });
  }

  async ticketAssigned(ticket, user) {
    await this.emit('ticket.assigned', {
      id: ticket.id,
      assignedTo: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      ticket
    });
  }

  async ticketStatusChanged(ticket, oldStatus, newStatus) {
    await this.emit('ticket.status_changed', {
      id: ticket.id,
      oldStatus,
      newStatus,
      ticket
    });
  }

  async ticketClosed(ticket) {
    await this.emit('ticket.closed', {
      id: ticket.id,
      closedAt: ticket.closedAt,
      ticket
    });
  }

  async ticketReopened(ticket) {
    await this.emit('ticket.reopened', {
      id: ticket.id,
      reopenedAt: new Date(),
      ticket
    });
  }

  /**
   * ==============================================
   * EVENTOS DE MENSAGEM
   * ==============================================
   */

  async messageReceived(message) {
    await this.emit('message.received', {
      id: message.id,
      ticketId: message.ticketId,
      from: message.from,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp
    });
  }

  async messageSent(message) {
    await this.emit('message.sent', {
      id: message.id,
      ticketId: message.ticketId,
      to: message.to,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp
    });
  }

  async messageRead(message) {
    await this.emit('message.read', {
      id: message.id,
      ticketId: message.ticketId,
      readAt: message.readAt
    });
  }

  async messageDelivered(message) {
    await this.emit('message.delivered', {
      id: message.id,
      ticketId: message.ticketId,
      deliveredAt: message.deliveredAt
    });
  }

  /**
   * ==============================================
   * EVENTOS DE CONTATO
   * ==============================================
   */

  async contactCreated(contact) {
    await this.emit('contact.created', {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      createdAt: contact.createdAt
    });
  }

  async contactUpdated(contact, changes) {
    await this.emit('contact.updated', {
      id: contact.id,
      changes,
      contact
    });
  }

  async contactBlocked(contact) {
    await this.emit('contact.blocked', {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      blockedAt: new Date()
    });
  }

  async contactUnblocked(contact) {
    await this.emit('contact.unblocked', {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      unblockedAt: new Date()
    });
  }

  /**
   * ==============================================
   * EVENTOS DE USUÁRIO
   * ==============================================
   */

  async userLogin(user, ipAddress) {
    await this.emit('user.login', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ipAddress,
      timestamp: new Date()
    });
  }

  async userLogout(user) {
    await this.emit('user.logout', {
      id: user.id,
      name: user.name,
      email: user.email,
      timestamp: new Date()
    });
  }

  async userCreated(user) {
    await this.emit('user.created', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  }

  async userUpdated(user, changes) {
    await this.emit('user.updated', {
      id: user.id,
      changes,
      user
    });
  }

  /**
   * ==============================================
   * EVENTOS DE CAMPANHA
   * ==============================================
   */

  async campaignStarted(campaign) {
    await this.emit('campaign.started', {
      id: campaign.id,
      name: campaign.name,
      startedAt: new Date(),
      campaign
    });
  }

  async campaignCompleted(campaign, stats) {
    await this.emit('campaign.completed', {
      id: campaign.id,
      name: campaign.name,
      completedAt: new Date(),
      stats,
      campaign
    });
  }

  async campaignFailed(campaign, error) {
    await this.emit('campaign.failed', {
      id: campaign.id,
      name: campaign.name,
      failedAt: new Date(),
      error: error.message,
      campaign
    });
  }

  /**
   * ==============================================
   * EVENTOS DE FLUXO
   * ==============================================
   */

  async flowStarted(flow, execution) {
    await this.emit('flow.started', {
      flowId: flow.id,
      executionId: execution.id,
      startedAt: new Date(),
      flow,
      execution
    });
  }

  async flowCompleted(flow, execution) {
    await this.emit('flow.completed', {
      flowId: flow.id,
      executionId: execution.id,
      completedAt: new Date(),
      flow,
      execution
    });
  }

  async flowFailed(flow, execution, error) {
    await this.emit('flow.failed', {
      flowId: flow.id,
      executionId: execution.id,
      failedAt: new Date(),
      error: error.message,
      flow,
      execution
    });
  }

  /**
   * ==============================================
   * EVENTOS DE NPS
   * ==============================================
   */

  async npsRated(rating) {
    await this.emit('nps.rated', {
      id: rating.id,
      ticketId: rating.ticketId,
      score: rating.score,
      comment: rating.comment,
      ratedAt: rating.createdAt,
      rating
    });
  }

  /**
   * ==============================================
   * EVENTOS DE SISTEMA
   * ==============================================
   */

  async systemError(error, context) {
    await this.emit('system.error', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
  }

  async systemWarning(message, context) {
    await this.emit('system.warning', {
      message,
      context,
      timestamp: new Date()
    });
  }
}

// Singleton
const webhookEmitter = new WebhookEmitter();

module.exports = webhookEmitter;

