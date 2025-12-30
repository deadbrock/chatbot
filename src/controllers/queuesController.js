const { Op } = require('sequelize');
const Queue = require('../models/QueueSQL');
const Ticket = require('../models/TicketSQL');
const User = require('../models/UserSQL');
const { ok, fail } = require('../utils/http');

/**
 * Controller de Filas
 */

/**
 * Listar filas
 * GET /api/queues
 */
async function listQueues(req, res) {
  try {
    const { isActive = '' } = req.query;
    const where = {};

    if (isActive !== '') where.isActive = isActive === 'true';

    const queues = await Queue.findAll({
      where,
      order: [['order', 'ASC'], ['name', 'ASC']]
    });

    return ok(res, queues);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter fila por ID
 * GET /api/queues/:id
 */
async function getQueue(req, res) {
  try {
    const { id } = req.params;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    return ok(res, queue);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Criar nova fila
 * POST /api/queues
 */
async function createQueue(req, res) {
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
    const existing = await Queue.findOne({
      where: { slug: data.slug }
    });

    if (existing) {
      return fail(res, 400, 'Já existe uma fila com este nome');
    }

    // Se for padrão, remover padrão das outras
    if (data.isDefault) {
      await Queue.update(
        { isDefault: false },
        { where: { isDefault: true } }
      );
    }

    const queue = await Queue.create({
      ...data,
      createdBy: userId
    });

    return ok(res, queue, 201);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Atualizar fila
 * PUT /api/queues/:id
 */
async function updateQueue(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    // Se for padrão, remover padrão das outras
    if (data.isDefault && !queue.isDefault) {
      await Queue.update(
        { isDefault: false },
        { where: { isDefault: true } }
      );
    }

    await queue.update({
      ...data,
      updatedBy: userId
    });

    return ok(res, queue);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Excluir fila
 * DELETE /api/queues/:id
 */
async function deleteQueue(req, res) {
  try {
    const { id } = req.params;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    // Verificar se há tickets nesta fila
    const ticketsCount = await Ticket.count({
      where: { queueId: id }
    });

    if (ticketsCount > 0) {
      return fail(res, 400, `Não é possível excluir. Existem ${ticketsCount} ticket(s) nesta fila.`);
    }

    await queue.destroy();

    return ok(res, { message: 'Fila excluída com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Reordenar filas
 * POST /api/queues/reorder
 */
async function reorderQueues(req, res) {
  try {
    const { queueIds } = req.body;

    if (!Array.isArray(queueIds)) {
      return fail(res, 400, 'queueIds deve ser um array');
    }

    for (let i = 0; i < queueIds.length; i++) {
      await Queue.update(
        { order: i },
        { where: { id: queueIds[i] } }
      );
    }

    return ok(res, { message: 'Ordem atualizada com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter estatísticas da fila
 * GET /api/queues/:id/stats
 */
async function getQueueStats(req, res) {
  try {
    const { id } = req.params;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    const waiting = await Ticket.count({
      where: { queueId: id, status: 'pending' }
    });

    const active = await Ticket.count({
      where: { queueId: id, status: 'in-progress' }
    });

    const resolved = await Ticket.count({
      where: { queueId: id, status: { [Op.in]: ['resolved', 'closed'] } }
    });

    const total = await Ticket.count({
      where: { queueId: id }
    });

    // Atualizar cache de estatísticas
    await queue.update({
      stats: {
        waiting,
        active,
        resolved,
        total,
        avgWaitTime: queue.stats.avgWaitTime || 0,
        avgResponseTime: queue.stats.avgResponseTime || 0
      }
    });

    return ok(res, {
      waiting,
      active,
      resolved,
      total,
      avgWaitTime: queue.stats.avgWaitTime || 0,
      avgResponseTime: queue.stats.avgResponseTime || 0
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Distribuir ticket para fila
 * POST /api/queues/:id/distribute
 */
async function distributeTicket(req, res) {
  try {
    const { id } = req.params;
    const { ticketId } = req.body;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    if (!queue.isActive) {
      return fail(res, 400, 'Fila inativa');
    }

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return fail(res, 404, 'Ticket não encontrado');
    }

    // Atribuir fila ao ticket
    await ticket.update({ queueId: id });

    // Se auto-assign estiver ativo, distribuir para agente
    if (queue.autoAssign) {
      const agent = await selectAgent(queue);
      if (agent) {
        await ticket.update({ assignedTo: agent.id });
      }
    }

    return ok(res, ticket);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Selecionar agente para distribuição
 * Implementa diferentes modos de distribuição
 */
async function selectAgent(queue) {
  try {
    if (!queue.agents || queue.agents.length === 0) {
      return null;
    }

    // Buscar agentes disponíveis
    const availableAgents = await User.findAll({
      where: {
        id: { [Op.in]: queue.agents },
        isActive: true
      }
    });

    if (availableAgents.length === 0) {
      return null;
    }

    // Contar tickets ativos por agente
    const agentsWithTickets = await Promise.all(
      availableAgents.map(async (agent) => {
        const activeTickets = await Ticket.count({
          where: {
            assignedTo: agent.id,
            status: { [Op.notIn]: ['resolved', 'closed'] }
          }
        });
        return { agent, activeTickets };
      })
    );

    // Filtrar agentes que não atingiram o limite
    const eligibleAgents = agentsWithTickets.filter(
      ({ activeTickets }) => activeTickets < queue.maxTicketsPerAgent
    );

    if (eligibleAgents.length === 0) {
      return null;
    }

    // Aplicar modo de distribuição
    switch (queue.distributionMode) {
      case 'least_active':
        // Agente com menos tickets ativos
        eligibleAgents.sort((a, b) => a.activeTickets - b.activeTickets);
        return eligibleAgents[0].agent;

      case 'random':
        // Agente aleatório
        const randomIndex = Math.floor(Math.random() * eligibleAgents.length);
        return eligibleAgents[randomIndex].agent;

      case 'priority':
        // Por prioridade (implementar lógica de prioridade no User)
        // Por enquanto, usa least_active
        eligibleAgents.sort((a, b) => a.activeTickets - b.activeTickets);
        return eligibleAgents[0].agent;

      case 'round_robin':
      default:
        // Round robin - pega o próximo na lista
        // Implementação simples: pega o com menos tickets
        eligibleAgents.sort((a, b) => a.activeTickets - b.activeTickets);
        return eligibleAgents[0].agent;
    }
  } catch (error) {
    console.error('Erro ao selecionar agente:', error);
    return null;
  }
}

/**
 * Adicionar agente à fila
 * POST /api/queues/:id/agents
 */
async function addAgent(req, res) {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    const agent = await User.findByPk(agentId);
    if (!agent) {
      return fail(res, 404, 'Agente não encontrado');
    }

    const agents = queue.agents || [];
    if (!agents.includes(agentId)) {
      agents.push(agentId);
      await queue.update({ agents });
    }

    return ok(res, queue);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Remover agente da fila
 * DELETE /api/queues/:id/agents/:agentId
 */
async function removeAgent(req, res) {
  try {
    const { id, agentId } = req.params;

    const queue = await Queue.findByPk(id);
    if (!queue) {
      return fail(res, 404, 'Fila não encontrada');
    }

    const agents = (queue.agents || []).filter(a => a !== agentId);
    await queue.update({ agents });

    return ok(res, queue);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Inicializar filas padrões
 * POST /api/queues/init-defaults
 */
async function initDefaults(req, res) {
  try {
    const defaults = [
      {
        name: 'Suporte Geral',
        slug: 'suporte-geral',
        color: '#007bff',
        icon: 'headset',
        description: 'Fila padrão para atendimento geral',
        isDefault: true,
        order: 1
      },
      {
        name: 'Vendas',
        slug: 'vendas',
        color: '#28a745',
        icon: 'cart',
        description: 'Atendimento comercial e vendas',
        order: 2
      },
      {
        name: 'Financeiro',
        slug: 'financeiro',
        color: '#ffc107',
        icon: 'currency-dollar',
        description: 'Questões financeiras e cobranças',
        order: 3
      },
      {
        name: 'Suporte Técnico',
        slug: 'suporte-tecnico',
        color: '#dc3545',
        icon: 'tools',
        description: 'Problemas técnicos e bugs',
        order: 4
      }
    ];

    const created = [];
    for (const queueData of defaults) {
      const existing = await Queue.findOne({
        where: { slug: queueData.slug }
      });

      if (!existing) {
        const queue = await Queue.create(queueData);
        created.push(queue);
      }
    }

    return ok(res, {
      message: `${created.length} fila(s) padrão criada(s)`,
      created
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = {
  listQueues,
  getQueue,
  createQueue,
  updateQueue,
  deleteQueue,
  reorderQueues,
  getQueueStats,
  distributeTicket,
  addAgent,
  removeAgent,
  initDefaults,
  selectAgent // Exportar para uso em outros módulos
};

