/**
 * Script para verificar a estrutura da tabela ai_configs
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
    console.log('🔍 Verificando estrutura da tabela ai_configs...\n');
    
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco\n');
    
    // Verificar se a tabela existe
    const [tableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'ai_configs'
      );
    `, { type: QueryTypes.SELECT });
    
    if (!tableExists.exists) {
      console.log('❌ Tabela ai_configs NÃO existe!');
      process.exit(1);
    }
    
    console.log('✅ Tabela ai_configs existe\n');
    
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
      AND table_name = 'ai_configs'
      ORDER BY ordinal_position;
    `, { type: QueryTypes.SELECT });
    
    console.log('📊 Estrutura da tabela:\n');
    console.table(columns);
    
    // Verificar tipo do updatedBy
    const updatedByColumn = columns.find(col => col.column_name === 'updatedBy');
    
    if (!updatedByColumn) {
      console.log('\n❌ Campo updatedBy NÃO encontrado!');
      process.exit(1);
    }
    
    console.log('\n✅ Campo updatedBy encontrado:');
    console.log(`   Tipo: ${updatedByColumn.data_type}`);
    console.log(`   UDT: ${updatedByColumn.udt_name}`);
    console.log(`   Nullable: ${updatedByColumn.is_nullable}`);
    
    if (updatedByColumn.udt_name === 'int4' || updatedByColumn.data_type === 'integer') {
      console.log('\n🎉 SUCESSO! Campo updatedBy está como INTEGER!');
    } else {
      console.log(`\n❌ ERRO! Campo updatedBy está como ${updatedByColumn.udt_name}, deveria ser int4!`);
    }
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verify();
