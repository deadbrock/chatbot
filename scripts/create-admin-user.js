/**
 * Script para criar usuário admin no PostgreSQL
 * Execute: node scripts/create-admin-user.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/UserSQL');

async function createAdminUser() {
  try {
    console.log('🔄 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de dados');

    console.log('🔄 Sincronizando modelos...');
    await sequelize.sync();
    console.log('✅ Modelos sincronizados');

    // Verificar se o admin já existe
    const existingAdmin = await User.findOne({ where: { email: 'admin@admin.com' } });
    
    if (existingAdmin) {
      console.log('⚠️  Usuário admin já existe!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Nome:', existingAdmin.name);
      console.log('🔑 Role:', existingAdmin.role);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Deseja resetar a senha? (s/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() === 's') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        existingAdmin.password = hashedPassword;
        await existingAdmin.save();
        console.log('✅ Senha resetada para: admin123');
      } else {
        console.log('ℹ️  Nenhuma alteração feita');
      }
      
      process.exit(0);
    }

    // Criar novo usuário admin
    console.log('🔄 Criando usuário admin...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await User.create({
      name: 'Administrador',
      email: 'admin@admin.com',
      password: hashedPassword,
      role: 'admin',
      department: 'TI',
      active: true
    });

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email: admin@admin.com');
    console.log('🔑 Senha: admin123');
    console.log('👤 Role: admin');
    console.log('═══════════════════════════════════════');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error);
    process.exit(1);
  }
}

createAdminUser();
