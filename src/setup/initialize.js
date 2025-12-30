require('dotenv').config();
const { testConnection, syncDatabase } = require('../config/database');
const User = require('../models/UserSQL');
const logger = require('../utils/logger');

/**
 * Script de inicialização do banco de dados SQLite
 */
async function initialize() {
  try {
    logger.info('🚀 Iniciando setup do banco de dados...');

    // Conectar ao SQLite
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Falha ao conectar ao banco de dados');
    }

    // Sincronizar modelos (criar tabelas)
    await syncDatabase();
    logger.info('✅ Tabelas criadas/atualizadas');

    // Criar usuário admin padrão
    const adminExists = await User.findOne({ where: { email: 'admin@admin.com' } });

    if (!adminExists) {
      const admin = await User.create({
        name: 'Administrador',
        email: 'admin@admin.com',
        password: 'admin123', // Será hasheado automaticamente
        role: 'admin',
        department: 'Administração'
      });

      logger.info('✅ Usuário admin criado');
      logger.info('📧 Email: admin@admin.com');
      logger.info('🔑 Senha: admin123');
      logger.info('⚠️  ALTERE A SENHA IMEDIATAMENTE!');
    } else {
      logger.info('ℹ️  Usuário admin já existe');
    }

    logger.info('');
    logger.info('╔═══════════════════════════════════════════════════════╗');
    logger.info('║                                                       ║');
    logger.info('║     ✅ SETUP CONCLUÍDO COM SUCESSO!                  ║');
    logger.info('║                                                       ║');
    logger.info('║     Banco de dados: SQLite (local)                    ║');
    logger.info('║     Arquivo: database.sqlite                          ║');
    logger.info('║                                                       ║');
    logger.info('║     Próximos passos:                                  ║');
    logger.info('║     1. Execute: npm start                             ║');
    logger.info('║     2. Escaneie o QR Code com WhatsApp                ║');
    logger.info('║     3. Acesse: http://localhost:3000/admin            ║');
    logger.info('║                                                       ║');
    logger.info('║     Login padrão:                                     ║');
    logger.info('║     Email: admin@admin.com                            ║');
    logger.info('║     Senha: admin123                                   ║');
    logger.info('║                                                       ║');
    logger.info('╚═══════════════════════════════════════════════════════╝');
    logger.info('');

    process.exit(0);

  } catch (error) {
    logger.error('❌ Erro no setup:', error);
    process.exit(1);
  }
}

// Executar
initialize();
