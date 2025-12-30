const Role = require('../models/RoleSQL');
const SystemSetting = require('../models/SystemSettingSQL');
const FlowNode = require('../models/FlowNodeSQL');

/**
 * Inicializa papéis e configurações padrão do sistema
 * Deve ser executado na inicialização do servidor
 */
async function initializeAdminDefaults() {
  try {
    console.log('🔧 Inicializando configurações de administração...');
    
    // Inicializar papéis padrão
    await Role.initializeDefaults();
    
    // Inicializar configurações do sistema
    await SystemSetting.initializeDefaults();
    
    // Inicializar nodes de fluxo padrão
    await FlowNode.initializeDefaults();
    
    console.log('✅ Configurações de administração inicializadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar configurações de administração:', error);
    throw error;
  }
}

module.exports = { initializeAdminDefaults };

