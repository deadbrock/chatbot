const SystemSetting = require('../models/SystemSettingSQL');
const { sendSuccess, sendError, badRequest, notFound } = require('../utils/http');

/**
 * Controller de Configurações do Sistema
 * Gerenciamento de configurações globais
 */

/**
 * Lista todas as configurações
 * GET /api/settings
 */
async function listSettings(req, res) {
  try {
    const { category } = req.query;
    
    const where = {};
    if (category) where.category = category;
    
    const settings = await SystemSetting.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['group', 'ASC'],
        ['order', 'ASC'],
        ['label', 'ASC']
      ]
    });
    
    // Organizar por categoria
    const grouped = {};
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push({
        key: setting.key,
        value: parseValue(setting.value, setting.type),
        defaultValue: parseValue(setting.defaultValue, setting.type),
        type: setting.type,
        label: setting.label,
        description: setting.description,
        placeholder: setting.placeholder,
        helpText: setting.helpText,
        validation: setting.validation,
        options: setting.options,
        group: setting.group,
        order: setting.order,
        isVisible: setting.isVisible,
        isReadOnly: setting.isReadOnly,
        requiresRestart: setting.requiresRestart,
        updatedAt: setting.updatedAt
      });
    });
    
    return sendSuccess(res, {
      settings: grouped,
      total: settings.length
    });
  } catch (error) {
    console.error('Erro ao listar configurações:', error);
    return sendError(res, 'Erro ao listar configurações');
  }
}

/**
 * Lista categorias disponíveis
 * GET /api/settings/categories
 */
async function listCategories(req, res) {
  try {
    const categories = [
      { value: 'general', label: 'Geral', icon: 'gear' },
      { value: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
      { value: 'notifications', label: 'Notificações', icon: 'bell' },
      { value: 'email', label: 'Email', icon: 'envelope' },
      { value: 'tickets', label: 'Tickets', icon: 'ticket' },
      { value: 'chat', label: 'Chat', icon: 'chat' },
      { value: 'integrations', label: 'Integrações', icon: 'link' },
      { value: 'security', label: 'Segurança', icon: 'shield' },
      { value: 'appearance', label: 'Aparência', icon: 'palette' },
      { value: 'birthday', label: 'Aniversários', icon: 'gift' },
      { value: 'api', label: 'API', icon: 'code' },
      { value: 'advanced', label: 'Avançado', icon: 'tools' }
    ];
    
    return sendSuccess(res, { categories });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return sendError(res, 'Erro ao listar categorias');
  }
}

/**
 * Busca configurações por categoria
 * GET /api/settings/category/:category
 */
async function getByCategory(req, res) {
  try {
    const { category } = req.params;
    
    const settings = await SystemSetting.getByCategory(category);
    
    return sendSuccess(res, {
      category,
      settings,
      total: settings.length
    });
  } catch (error) {
    console.error('Erro ao buscar configurações por categoria:', error);
    return sendError(res, 'Erro ao buscar configurações por categoria');
  }
}

/**
 * Busca uma configuração específica
 * GET /api/settings/:key
 */
async function getSetting(req, res) {
  try {
    const { key } = req.params;
    
    const setting = await SystemSetting.findOne({ where: { key } });
    
    if (!setting) {
      return notFound(res, 'Configuração não encontrada');
    }
    
    return sendSuccess(res, {
      setting: {
        key: setting.key,
        value: parseValue(setting.value, setting.type),
        defaultValue: parseValue(setting.defaultValue, setting.type),
        type: setting.type,
        label: setting.label,
        description: setting.description,
        category: setting.category,
        group: setting.group,
        validation: setting.validation,
        options: setting.options,
        isReadOnly: setting.isReadOnly,
        requiresRestart: setting.requiresRestart,
        updatedAt: setting.updatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return sendError(res, 'Erro ao buscar configuração');
  }
}

/**
 * Busca valor de uma configuração
 * GET /api/settings/:key/value
 */
async function getSettingValue(req, res) {
  try {
    const { key } = req.params;
    
    const value = await SystemSetting.get(key);
    
    return sendSuccess(res, { key, value });
  } catch (error) {
    console.error('Erro ao buscar valor:', error);
    return sendError(res, 'Erro ao buscar valor');
  }
}

/**
 * Atualiza uma configuração
 * PUT /api/settings/:key
 */
async function updateSetting(req, res) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return badRequest(res, 'Valor é obrigatório');
    }
    
    const setting = await SystemSetting.findOne({ where: { key } });
    
    if (!setting) {
      return notFound(res, 'Configuração não encontrada');
    }
    
    if (setting.isReadOnly) {
      return badRequest(res, 'Esta configuração é somente leitura');
    }
    
    // Validar valor
    const validationError = validateValue(value, setting);
    if (validationError) {
      return badRequest(res, validationError);
    }
    
    await SystemSetting.set(key, value, req.user?.id);
    
    return sendSuccess(res, {
      message: 'Configuração atualizada com sucesso',
      key,
      value,
      requiresRestart: setting.requiresRestart
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    return sendError(res, 'Erro ao atualizar configuração');
  }
}

/**
 * Atualiza múltiplas configurações de uma vez
 * PUT /api/settings/bulk
 */
async function bulkUpdateSettings(req, res) {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return badRequest(res, 'Configurações inválidas');
    }
    
    const results = [];
    const errors = [];
    let requiresRestart = false;
    
    for (const [key, value] of Object.entries(settings)) {
      try {
        const setting = await SystemSetting.findOne({ where: { key } });
        
        if (!setting) {
          errors.push({ key, error: 'Configuração não encontrada' });
          continue;
        }
        
        if (setting.isReadOnly) {
          errors.push({ key, error: 'Configuração somente leitura' });
          continue;
        }
        
        // Validar valor
        const validationError = validateValue(value, setting);
        if (validationError) {
          errors.push({ key, error: validationError });
          continue;
        }
        
        await SystemSetting.set(key, value, req.user?.id);
        
        results.push({ key, value });
        
        if (setting.requiresRestart) {
          requiresRestart = true;
        }
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }
    
    return sendSuccess(res, {
      message: `${results.length} configurações atualizadas`,
      updated: results,
      errors: errors.length > 0 ? errors : undefined,
      requiresRestart
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações em lote:', error);
    return sendError(res, 'Erro ao atualizar configurações em lote');
  }
}

/**
 * Restaura configuração para valor padrão
 * POST /api/settings/:key/reset
 */
async function resetSetting(req, res) {
  try {
    const { key } = req.params;
    
    const setting = await SystemSetting.findOne({ where: { key } });
    
    if (!setting) {
      return notFound(res, 'Configuração não encontrada');
    }
    
    if (setting.isReadOnly) {
      return badRequest(res, 'Esta configuração é somente leitura');
    }
    
    await SystemSetting.set(key, parseValue(setting.defaultValue, setting.type), req.user?.id);
    
    return sendSuccess(res, {
      message: 'Configuração restaurada para padrão',
      key,
      value: parseValue(setting.defaultValue, setting.type)
    });
  } catch (error) {
    console.error('Erro ao restaurar configuração:', error);
    return sendError(res, 'Erro ao restaurar configuração');
  }
}

/**
 * Busca histórico de alterações
 * GET /api/settings/:key/history
 */
async function getSettingHistory(req, res) {
  try {
    const { key } = req.params;
    
    const setting = await SystemSetting.findOne({ where: { key } });
    
    if (!setting) {
      return notFound(res, 'Configuração não encontrada');
    }
    
    return sendSuccess(res, {
      key,
      history: setting.changeLog || [],
      total: setting.changeLog?.length || 0
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return sendError(res, 'Erro ao buscar histórico');
  }
}

/**
 * Exporta configurações
 * GET /api/settings/export
 */
async function exportSettings(req, res) {
  try {
    const { category } = req.query;
    
    const where = {};
    if (category) where.category = category;
    
    const settings = await SystemSetting.findAll({ where });
    
    const exported = {};
    settings.forEach(setting => {
      exported[setting.key] = parseValue(setting.value, setting.type);
    });
    
    return sendSuccess(res, {
      settings: exported,
      exportedAt: new Date(),
      category: category || 'all'
    });
  } catch (error) {
    console.error('Erro ao exportar configurações:', error);
    return sendError(res, 'Erro ao exportar configurações');
  }
}

/**
 * Importa configurações
 * POST /api/settings/import
 */
async function importSettings(req, res) {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return badRequest(res, 'Configurações inválidas');
    }
    
    const results = [];
    const errors = [];
    
    for (const [key, value] of Object.entries(settings)) {
      try {
        await SystemSetting.set(key, value, req.user?.id);
        results.push({ key, value });
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }
    
    return sendSuccess(res, {
      message: `${results.length} configurações importadas`,
      imported: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Erro ao importar configurações:', error);
    return sendError(res, 'Erro ao importar configurações');
  }
}

// Helpers

function parseValue(stringValue, type) {
  if (stringValue === null || stringValue === undefined) return null;
  
  switch (type) {
    case 'boolean':
      return stringValue === 'true' || stringValue === true;
    case 'number':
      return Number(stringValue);
    case 'json':
    case 'array':
      try {
        return JSON.parse(stringValue);
      } catch {
        return null;
      }
    default:
      return stringValue;
  }
}

function validateValue(value, setting) {
  const validation = setting.validation || {};
  
  // Required
  if (validation.required && (value === null || value === undefined || value === '')) {
    return 'Valor é obrigatório';
  }
  
  // Type-specific validations
  if (setting.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return 'Valor deve ser um número';
    }
    if (validation.min !== undefined && num < validation.min) {
      return `Valor mínimo é ${validation.min}`;
    }
    if (validation.max !== undefined && num > validation.max) {
      return `Valor máximo é ${validation.max}`;
    }
  }
  
  if (setting.type === 'string') {
    const str = String(value);
    if (validation.minLength !== undefined && str.length < validation.minLength) {
      return `Comprimento mínimo é ${validation.minLength}`;
    }
    if (validation.maxLength !== undefined && str.length > validation.maxLength) {
      return `Comprimento máximo é ${validation.maxLength}`;
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(str)) {
        return 'Formato inválido';
      }
    }
  }
  
  // Options validation
  if (setting.options && Array.isArray(setting.options)) {
    const validValues = setting.options.map(opt => opt.value);
    if (!validValues.includes(value)) {
      return 'Valor não está entre as opções válidas';
    }
  }
  
  return null;
}

module.exports = {
  listSettings,
  listCategories,
  getByCategory,
  getSetting,
  getSettingValue,
  updateSetting,
  bulkUpdateSettings,
  resetSetting,
  getSettingHistory,
  exportSettings,
  importSettings
};

