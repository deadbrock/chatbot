/**
 * Script para verificar a estrutura da tabela Users
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

async function verify() {
  try {
    console.log('🔍 Verificando estrutura da tabela Users...\n');
    
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco\n');
    
    // Verificar se a tabela existe
    const [tableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'Users'
      );
    `, { type: QueryTypes.SELECT });
    
    if (!tableExists.exists) {
      console.log('❌ Tabela Users NÃO existe!');
      process.exit(1);
    }
    
    console.log('✅ Tabela Users existe\n');
    
    // Verificar colunas
    const columns = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'Users'
      ORDER BY ordinal_position;
    `, { type: QueryTypes.SELECT });
    
    console.log('📊 Estrutura da tabela Users:\n');
    console.table(columns);
    
    // Verificar campos problemáticos comuns
    const problematicFields = ['active', 'status', 'role', 'id'];
    
    console.log('\n🔍 Verificando campos críticos:\n');
    
    problematicFields.forEach(fieldName => {
      const field = columns.find(col => col.column_name === fieldName);
      if (field) {
        console.log(`✅ ${fieldName}:`);
        console.log(`   Tipo: ${field.data_type} (${field.udt_name})`);
        console.log(`   Nullable: ${field.is_nullable}`);
        console.log(`   Default: ${field.column_default || 'null'}\n`);
      } else {
        console.log(`❌ Campo ${fieldName} NÃO encontrado!\n`);
      }
    });
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verify();
