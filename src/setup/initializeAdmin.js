const Role = require('../models/RoleSQL');
const SystemSetting = require('../models/SystemSettingSQL');
const FlowNode = require('../models/FlowNodeSQL');
const User = require('../models/UserSQL');
const bcrypt = require('bcryptjs');

/**
 * Cria usuário admin padrão se não existir
 */
async function createDefaultAdminUser() {
  try {
    // Verificar se já existe um usuário admin
    const existingAdmin = await User.findOne({ where: { email: 'admin@admin.com' } });
    
    if (existingAdmin) {
      console.log('ℹ️  Usuário admin já existe');
      return;
    }

    console.log('🔄 Criando usuário admin padrão...');
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await User.create({
      name: 'Administrador',
      email: 'admin@admin.com',
      password: hashedPassword,
      role: 'admin',
      department: 'TI',
      active: true
    });

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('   📧 Email: admin@admin.com');
    console.log('   🔑 Senha: admin123');
    console.log('   ⚠️  Altere a senha após o primeiro login!');
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error);
    throw error;
  }
}

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
    
    // Criar usuário admin padrão
    await createDefaultAdminUser();
    
    console.log('✅ Configurações de administração inicializadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar configurações de administração:', error);
    throw error;
  }
}

module.exports = { initializeAdminDefaults };

