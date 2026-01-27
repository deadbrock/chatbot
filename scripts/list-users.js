/**
 * Script para listar todos os usuários do banco
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function listUsers() {
  try {
    console.log('👥 Listando usuários do banco...\n');
    
    await sequelize.authenticate();
    
    const users = await sequelize.query(`
      SELECT 
        id,
        name,
        email,
        role,
        department,
        status,
        active,
        "lastLogin",
        "createdAt"
      FROM "Users"
      ORDER BY id;
    `, { type: QueryTypes.SELECT });
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no banco!\n');
    } else {
      console.log(`✅ Total de usuários: ${users.length}\n`);
      console.table(users);
    }
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

listUsers();
