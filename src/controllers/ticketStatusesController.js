const { Op } = require('sequelize');
const TicketStatus = require('../models/TicketStatusSQL');
const { ok, fail } = require('../utils/http');

/**
 * Controller de Status Personalizados
 */

/**
 * Listar status
 * GET /api/ticket-statuses
 */
async function listStatuses(req, res) {
  try {
    const { isActive = '' } = req.query;
    const where = {};

    if (isActive !== '') where.isActive = isActive === 'true';

    const statuses = await TicketStatus.findAll({
      where,
      order: [['order', 'ASC'], ['name', 'ASC']]
    });

    return ok(res, statuses);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter status por ID
 * GET /api/ticket-statuses/:id
 */
async function getStatus(req, res) {
  try {
    const { id } = req.params;

    const status = await TicketStatus.findByPk(id);
    if (!status) {
      return fail(res, 404, 'Status não encontrado');
    }

    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Criar novo status
 * POST /api/ticket-statuses
 */
async function createStatus(req, res) {
  try {
    const data = req.body;
    const userId = req.user?.id;

    // Gerar slug
    if (!data.slug) {
      data.slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Verificar se slug já existe
    const existing = await TicketStatus.findOne({
      where: { slug: data.slug }
    });

    if (existing) {
      return fail(res, 400, 'Já existe um status com este nome');
    }

    // Se for padrão, remover padrão dos outros
    if (data.isDefault) {
      await TicketStatus.update(
        { isDefault: false },
        { where: { isDefault: true } }
      );
    }

    const status = await TicketStatus.create({
      ...data,
      createdBy: userId
    });

    return ok(res, status, 201);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Atualizar status
 * PUT /api/ticket-statuses/:id
 */
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const status = await TicketStatus.findByPk(id);
    if (!status) {
      return fail(res, 404, 'Status não encontrado');
    }

    // Se for padrão, remover padrão dos outros
    if (data.isDefault && !status.isDefault) {
      await TicketStatus.update(
        { isDefault: false },
        { where: { isDefault: true } }
      );
    }

    await status.update({
      ...data,
      updatedBy: userId
    });

    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Excluir status
 * DELETE /api/ticket-statuses/:id
 */
async function deleteStatus(req, res) {
  try {
    const { id } = req.params;

    const status = await TicketStatus.findByPk(id);
    if (!status) {
      return fail(res, 404, 'Status não encontrado');
    }

    // Verificar se há tickets usando este status
    const Ticket = require('../models/TicketSQL');
    const ticketsCount = await Ticket.count({
      where: { status: status.slug }
    });

    if (ticketsCount > 0) {
      return fail(res, 400, `Não é possível excluir. Existem ${ticketsCount} ticket(s) usando este status.`);
    }

    await status.destroy();

    return ok(res, { message: 'Status excluído com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Reordenar status
 * POST /api/ticket-statuses/reorder
 */
async function reorderStatuses(req, res) {
  try {
    const { statusIds } = req.body;

    if (!Array.isArray(statusIds)) {
      return fail(res, 400, 'statusIds deve ser um array');
    }

    // Atualizar ordem
    for (let i = 0; i < statusIds.length; i++) {
      await TicketStatus.update(
        { order: i },
        { where: { id: statusIds[i] } }
      );
    }

    return ok(res, { message: 'Ordem atualizada com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter estatísticas de uso
 * GET /api/ticket-statuses/stats
 */
async function getStatusStats(req, res) {
  try {
    const { sequelize } = require('../config/database');
    const Ticket = require('../models/TicketSQL');

    const stats = await Ticket.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    return ok(res, stats);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Inicializar status padrões
 * POST /api/ticket-statuses/init-defaults
 */
async function initDefaults(req, res) {
  try {
    const defaults = [
      {
        name: 'Aberto',
        slug: 'open',
        color: '#17a2b8',
        icon: 'inbox',
        category: 'open',
        order: 1,
        isDefault: true,
        description: 'Ticket recém criado, aguardando atendimento'
      },
      {
        name: 'Aguardando',
        slug: 'pending',
        color: '#ffc107',
        icon: 'clock',
        category: 'pending',
        order: 2,
        description: 'Aguardando resposta do cliente ou ação externa'
      },
      {
        name: 'Em Atendimento',
        slug: 'in-progress',
        color: '#007bff',
        icon: 'chat-dots',
        category: 'in_progress',
        order: 3,
        description: 'Ticket sendo atendido por um agente'
      },
      {
        name: 'Resolvido',
        slug: 'resolved',
        color: '#28a745',
        icon: 'check-circle',
        category: 'resolved',
        order: 4,
        description: 'Problema resolvido, aguardando confirmação'
      },
      {
        name: 'Fechado',
        slug: 'closed',
        color: '#6c757d',
        icon: 'x-circle',
        category: 'closed',
        order: 5,
        isFinal: true,
        description: 'Ticket finalizado'
      }
    ];

    const created = [];
    for (const statusData of defaults) {
      const existing = await TicketStatus.findOne({
        where: { slug: statusData.slug }
      });

      if (!existing) {
        const status = await TicketStatus.create(statusData);
        created.push(status);
      }
    }

    return ok(res, {
      message: `${created.length} status padrão(ões) criado(s)`,
      created
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = {
  listStatuses,
  getStatus,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  getStatusStats,
  initDefaults
};

