const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Contact = require('../models/ContactSQL');
const { ok, fail } = require('../utils/http');

/**
 * Controller de Contatos
 * Gerenciamento completo de contatos
 */

/**
 * Listar contatos com filtros e paginação
 * GET /api/contacts
 */
async function listContacts(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      category = '',
      isActive = '',
      assignedTo = '',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filtros
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category) where.category = category;
    if (isActive !== '') where.isActive = isActive === 'true';
    if (assignedTo) where.assignedTo = assignedTo;

    const { count, rows } = await Contact.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: { exclude: ['metadata'] }
    });

    return ok(res, {
      contacts: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter contato por ID
 * GET /api/contacts/:id
 */
async function getContact(req, res) {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    return ok(res, contact);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Criar novo contato
 * POST /api/contacts
 */
async function createContact(req, res) {
  try {
    const data = req.body;
    const userId = req.user?.id;

    // Verificar se já existe
    const existing = await Contact.findOne({
      where: { whatsappId: data.whatsappId }
    });

    if (existing) {
      return fail(res, 400, 'Contato já existe com este WhatsApp ID');
    }

    const contact = await Contact.create({
      ...data,
      createdBy: userId,
      source: data.source || 'Manual'
    });

    return ok(res, contact, 201);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Atualizar contato
 * PUT /api/contacts/:id
 */
async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    await contact.update({
      ...data,
      updatedBy: userId
    });

    return ok(res, contact);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Excluir contato
 * DELETE /api/contacts/:id
 */
async function deleteContact(req, res) {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    await contact.destroy();

    return ok(res, { message: 'Contato excluído com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Bloquear/Desbloquear contato
 * POST /api/contacts/:id/toggle-block
 */
async function toggleBlock(req, res) {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    await contact.update({
      isBlocked: !contact.isBlocked
    });

    return ok(res, contact);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Obter estatísticas de contatos
 * GET /api/contacts/stats
 */
async function getStats(req, res) {
  try {
    const total = await Contact.count();
    const active = await Contact.count({ where: { isActive: true } });
    const blocked = await Contact.count({ where: { isBlocked: true } });

    const byCategory = await Contact.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category'],
      raw: true
    });

    const recentContacts = await Contact.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // últimos 30 dias
        }
      }
    });

    return ok(res, {
      total,
      active,
      blocked,
      inactive: total - active,
      byCategory,
      recentContacts
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Importar contatos de CSV
 * POST /api/contacts/import
 */
async function importContacts(req, res) {
  try {
    const { contacts } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return fail(res, 400, 'Nenhum contato para importar');
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    for (const contactData of contacts) {
      try {
        // Verificar se já existe
        const existing = await Contact.findOne({
          where: { whatsappId: contactData.whatsappId }
        });

        if (existing) {
          results.skipped++;
          results.details.push({
            whatsappId: contactData.whatsappId,
            status: 'skipped',
            reason: 'Já existe'
          });
          continue;
        }

        await Contact.create({
          ...contactData,
          createdBy: userId,
          source: 'Importação'
        });

        results.success++;
        results.details.push({
          whatsappId: contactData.whatsappId,
          status: 'success'
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          whatsappId: contactData.whatsappId,
          status: 'error',
          reason: error.message
        });
      }
    }

    return ok(res, results);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Exportar contatos para CSV
 * GET /api/contacts/export
 */
async function exportContacts(req, res) {
  try {
    const { category = '', isActive = '' } = req.query;
    const where = {};

    if (category) where.category = category;
    if (isActive !== '') where.isActive = isActive === 'true';

    const contacts = await Contact.findAll({
      where,
      attributes: [
        'whatsappId', 'name', 'email', 'phone', 'company',
        'category', 'birthDate', 'city', 'state', 'notes'
      ],
      raw: true
    });

    return ok(res, contacts);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Adicionar tags ao contato
 * POST /api/contacts/:id/tags
 */
async function addTags(req, res) {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    const currentTags = contact.tags || [];
    const newTags = [...new Set([...currentTags, ...tags])];

    await contact.update({ tags: newTags });

    return ok(res, contact);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

/**
 * Remover tag do contato
 * DELETE /api/contacts/:id/tags/:tag
 */
async function removeTag(req, res) {
  try {
    const { id, tag } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return fail(res, 404, 'Contato não encontrado');
    }

    const currentTags = contact.tags || [];
    const newTags = currentTags.filter(t => t !== tag);

    await contact.update({ tags: newTags });

    return ok(res, contact);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  toggleBlock,
  getStats,
  importContacts,
  exportContacts,
  addTags,
  removeTag
};

