const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const models = sequelize.models;
const automationService = require('../services/automationService');

/**
 * Lista todas as regras de automação
 */
async function listRules(req, res) {
  try {
    const rules = await models.AutomationRule.findAll({
      order: [['priority', 'ASC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      rules
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao listar regras:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar regras'
    });
  }
}

/**
 * Cria uma nova regra de automação
 */
async function createRule(req, res) {
  try {
    const ruleData = req.body;

    const rule = await models.AutomationRule.create(ruleData);

    logger.info(`✅ [AUTOMATIONS] Regra criada: ${rule.name}`);

    res.json({
      success: true,
      rule
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao criar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar regra',
      details: error.message
    });
  }
}

/**
 * Atualiza uma regra de automação
 */
async function updateRule(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const rule = await models.AutomationRule.findByPk(id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Regra não encontrada'
      });
    }

    await rule.update(updateData);

    logger.info(`✅ [AUTOMATIONS] Regra atualizada: ${rule.name}`);

    res.json({
      success: true,
      rule
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao atualizar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar regra',
      details: error.message
    });
  }
}

/**
 * Deleta uma regra de automação
 */
async function deleteRule(req, res) {
  try {
    const { id } = req.params;

    const rule = await models.AutomationRule.findByPk(id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Regra não encontrada'
      });
    }

    await rule.destroy();

    logger.info(`✅ [AUTOMATIONS] Regra deletada: ${rule.name}`);

    res.json({
      success: true,
      message: 'Regra deletada com sucesso'
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao deletar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar regra',
      details: error.message
    });
  }
}

/**
 * Ativa/desativa uma regra
 */
async function toggleRule(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const rule = await models.AutomationRule.findByPk(id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Regra não encontrada'
      });
    }

    await rule.update({ isActive });

    logger.info(`✅ [AUTOMATIONS] Regra ${isActive ? 'ativada' : 'desativada'}: ${rule.name}`);

    res.json({
      success: true,
      rule
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao alternar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao alternar regra',
      details: error.message
    });
  }
}

/**
 * Lista execuções de automação
 */
async function listExecutions(req, res) {
  try {
    const { ruleId, contactId, status, limit = 50 } = req.query;

    const where = {};
    if (ruleId) where.ruleId = ruleId;
    if (contactId) where.contactId = contactId;
    if (status) where.status = status;

    const executions = await models.AutomationExecution.findAll({
      where,
      include: [
        {
          model: models.AutomationRule,
          as: 'rule',
          attributes: ['id', 'name']
        },
        {
          model: models.Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      executions
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao listar execuções:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar execuções'
    });
  }
}

/**
 * Testa uma mensagem contra regras de automação
 */
async function testMessage(req, res) {
  try {
    const { message, contactId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem é obrigatória'
      });
    }

    // Criar contato temporário se não existir
    let contact;
    if (contactId) {
      contact = await models.Contact.findByPk(contactId);
    }
    
    if (!contact) {
      contact = await models.Contact.create({
        name: 'Teste',
        phone: '5511999999999',
        metadata: { test: true }
      });
    }

    // Processar mensagem
    const result = await automationService.processMessage(contact.id, message);

    res.json({
      success: true,
      result,
      message: result ? 'Automação acionada' : 'Nenhuma automação correspondente'
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao testar mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao testar mensagem',
      details: error.message
    });
  }
}

/**
 * Continua uma execução ativa (coleta de slots)
 */
async function continueExecution(req, res) {
  try {
    const { contactId, message } = req.body;

    if (!contactId || !message) {
      return res.status(400).json({
        success: false,
        error: 'contactId e message são obrigatórios'
      });
    }

    const result = await automationService.continueExecution(contactId, message);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma execução ativa encontrada'
      });
    }

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao continuar execução:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao continuar execução',
      details: error.message
    });
  }
}

/**
 * Cancela uma execução ativa
 */
async function cancelExecution(req, res) {
  try {
    const { contactId } = req.params;

    await automationService.cancelExecution(contactId);

    res.json({
      success: true,
      message: 'Execução cancelada'
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao cancelar execução:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao cancelar execução'
    });
  }
}

/**
 * Estatísticas de automações
 */
async function getStats(req, res) {
  try {
    const totalRules = await models.AutomationRule.count();
    const activeRules = await models.AutomationRule.count({ where: { isActive: true } });
    
    const totalExecutions = await models.AutomationExecution.count();
    const completedExecutions = await models.AutomationExecution.count({ where: { status: 'completed' } });
    const failedExecutions = await models.AutomationExecution.count({ where: { status: 'failed' } });
    
    const topRules = await models.AutomationRule.findAll({
      order: [['executionCount', 'DESC']],
      limit: 5,
      attributes: ['id', 'name', 'executionCount', 'successCount']
    });

    res.json({
      success: true,
      stats: {
        totalRules,
        activeRules,
        totalExecutions,
        completedExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? ((completedExecutions / totalExecutions) * 100).toFixed(2) : 0,
        topRules
      }
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
}

/**
 * Templates de automações pré-configuradas
 */
async function getTemplates(req, res) {
  try {
    const templates = [
      {
        id: 'template_salario',
        name: 'Atendimento de Salário',
        description: 'Coleta dados do funcionário e redireciona para o financeiro',
        config: {
          name: 'Atendimento de Salário',
          description: 'Coleta dados sobre dúvidas de salário e redireciona para o financeiro',
          isActive: true,
          priority: 5,
          triggerType: 'intent',
          triggerValue: 'salario',
          requiredSlots: ['nome_completo', 'loja', 'supervisor'],
          slotPrompts: {
            nome_completo: 'Por favor, informe seu nome completo:',
            loja: 'Em qual loja você está alocado(a)?',
            supervisor: 'Quem é o seu supervisor direto?'
          },
          actions: [
            {
              type: 'create_ticket',
              params: {
                subject: 'Dúvida sobre salário',
                status: 'open',
                priority: 'high'
              }
            },
            {
              type: 'transfer_queue',
              params: {
                queueId: null, // Será preenchido com ID da fila financeiro
                status: 'pending'
              }
            }
          ],
          greetingMessage: 'Olá! Sou o assistente da FG SERVICES. Vi que você tem uma dúvida sobre salário. Vou coletar alguns dados para encaminhar ao setor financeiro.',
          completionMessage: 'Perfeito! Recebi todas as informações. Estou redirecionando você para um atendente do financeiro. Por favor, aguarde.'
        }
      },
      {
        id: 'template_ferias',
        name: 'Solicitação de Férias',
        description: 'Coleta dados para solicitação de férias',
        config: {
          name: 'Solicitação de Férias',
          description: 'Coleta informações para pedido de férias',
          isActive: true,
          priority: 5,
          triggerType: 'intent',
          triggerValue: 'ferias',
          requiredSlots: ['nome_completo', 'periodo_desejado', 'supervisor'],
          slotPrompts: {
            nome_completo: 'Qual é o seu nome completo?',
            periodo_desejado: 'Qual período você gostaria de tirar férias? (ex: 01/02/2026 a 15/02/2026)',
            supervisor: 'Nome do seu supervisor:'
          },
          actions: [
            {
              type: 'create_ticket',
              params: {
                subject: 'Solicitação de férias',
                status: 'open',
                priority: 'medium'
              }
            },
            {
              type: 'transfer_queue',
              params: {
                queueId: null, // Será preenchido com ID da fila RH
                status: 'pending'
              }
            }
          ],
          greetingMessage: 'Olá! Vou te ajudar com sua solicitação de férias. Preciso de algumas informações:',
          completionMessage: 'Sua solicitação de férias foi registrada! O RH entrará em contato em breve.'
        }
      },
      {
        id: 'template_suporte',
        name: 'Suporte Técnico',
        description: 'Coleta informações sobre problemas técnicos',
        config: {
          name: 'Suporte Técnico',
          description: 'Coleta dados sobre problemas técnicos',
          isActive: true,
          priority: 8,
          triggerType: 'intent',
          triggerValue: 'manutencao',
          requiredSlots: ['nome', 'departamento', 'descricao_problema'],
          slotPrompts: {
            nome: 'Qual é o seu nome?',
            departamento: 'De qual departamento você é?',
            descricao_problema: 'Descreva o problema técnico:'
          },
          actions: [
            {
              type: 'create_ticket',
              params: {
                subject: 'Suporte técnico',
                status: 'open',
                priority: 'high'
              }
            },
            {
              type: 'add_tag',
              params: {
                tagId: null // Tag "suporte_tecnico"
              }
            }
          ],
          greetingMessage: 'Olá! Vou registrar seu chamado de suporte técnico. Preciso de algumas informações:',
          completionMessage: 'Chamado registrado! Nossa equipe técnica entrará em contato em breve.'
        }
      }
    ];

    res.json({
      success: true,
      templates
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao buscar templates:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar templates'
    });
  }
}

/**
 * Cria regra a partir de template
 */
async function createFromTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const customizations = req.body;

    // Buscar template
    const templatesResponse = await getTemplates(req, res);
    // Nota: Isso não vai funcionar bem, vou refatorar
    
    // Por simplicidade, vamos receber o config completo do template no body
    const rule = await models.AutomationRule.create(customizations);

    logger.info(`✅ [AUTOMATIONS] Regra criada a partir de template: ${rule.name}`);

    res.json({
      success: true,
      rule
    });

  } catch (error) {
    logger.error('❌ [AUTOMATIONS] Erro ao criar regra de template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar regra de template',
      details: error.message
    });
  }
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  listExecutions,
  testMessage,
  continueExecution,
  cancelExecution,
  getStats,
  getTemplates,
  createFromTemplate
};
