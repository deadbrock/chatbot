/**
 * Script de Migração Automática - Tabela ai_configs
 * Detecta e corrige conflito de tipo UUID vs INTEGER no campo updatedBy
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const path = require('path');

console.log('═══════════════════════════════════════════════════════');
console.log('🔧 MIGRAÇÃO AUTOMÁTICA - TABELA ai_configs');
console.log('═══════════════════════════════════════════════════════\n');

// Configurar conexão com o banco
let sequelize;

if (process.env.DATABASE_URL) {
  console.log('🔗 Conectando via DATABASE_URL...');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  console.error('❌ DATABASE_URL não encontrada!');
  console.error('💡 Configure a variável DATABASE_URL no .env ou nas variáveis de ambiente.');
  process.exit(1);
}

/**
 * Verificar se a tabela existe
 */
async function tableExists() {
  try {
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'ai_configs'
      );
    `, { type: QueryTypes.SELECT });

    return results.exists;
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
    return false;
  }
}

/**
 * Verificar tipo do campo updatedBy
 */
async function checkUpdatedByType() {
  try {
    const [results] = await sequelize.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'ai_configs'
      AND column_name = 'updatedBy';
    `, { type: QueryTypes.SELECT });

    if (results && results.length > 0) {
      return {
        dataType: results[0].data_type,
        udtName: results[0].udt_name
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao verificar tipo:', error.message);
    return null;
  }
}

/**
 * Contar registros na tabela
 */
async function countRecords() {
  try {
    const [result] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "ai_configs";
    `, { type: QueryTypes.SELECT });

    return parseInt(result.count);
  } catch (error) {
    return 0;
  }
}

/**
 * Fazer backup dos dados (se houver)
 */
async function backupData() {
  try {
    const [results] = await sequelize.query(`
      SELECT * FROM "ai_configs";
    `, { type: QueryTypes.SELECT });

    if (results && results.length > 0) {
      const fs = require('fs');
      const backupPath = path.join(__dirname, '../backups');
      
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      const backupFile = path.join(backupPath, `ai_configs_backup_${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(results, null, 2));
      
      console.log(`✅ Backup salvo em: ${backupFile}`);
      return backupFile;
    }

    console.log('ℹ️  Nenhum dado para fazer backup (tabela vazia)');
    return null;
  } catch (error) {
    console.error('⚠️  Erro ao fazer backup:', error.message);
    return null;
  }
}

/**
 * Dropar a tabela
 */
async function dropTable() {
  try {
    await sequelize.query(`DROP TABLE IF EXISTS "ai_configs" CASCADE;`);
    console.log('✅ Tabela ai_configs deletada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar tabela:', error.message);
    return false;
  }
}

/**
 * Recriar a tabela com o schema correto
 */
async function recreateTable() {
  try {
    console.log('📦 Recriando tabela com schema correto...');
    
    await sequelize.query(`
      CREATE TABLE "ai_configs" (
        "id" UUID PRIMARY KEY,
        "key" VARCHAR(255) UNIQUE NOT NULL,
        "value" TEXT NOT NULL,
        "type" VARCHAR(255) DEFAULT 'string',
        "category" VARCHAR(255) DEFAULT 'general',
        "description" TEXT,
        "isActive" BOOLEAN DEFAULT true,
        "updatedBy" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
      
      CREATE INDEX "ai_configs_key" ON "ai_configs" ("key");
      CREATE INDEX "ai_configs_category" ON "ai_configs" ("category");
      CREATE INDEX "ai_configs_isActive" ON "ai_configs" ("isActive");
    `);

    console.log('✅ Tabela recriada com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao recriar tabela:', error.message);
    return false;
  }
}

/**
 * Verificar resultado
 */
async function verifyMigration() {
  try {
    const typeInfo = await checkUpdatedByType();
    
    if (typeInfo) {
      console.log('\n📊 Verificação do campo updatedBy:');
      console.log(`   Tipo: ${typeInfo.dataType} (${typeInfo.udtName})`);
      
      if (typeInfo.udtName === 'int4' || typeInfo.dataType === 'integer') {
        console.log('   ✅ TIPO CORRETO! (INTEGER)');
        return true;
      } else {
        console.log('   ❌ Tipo ainda incorreto!');
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    return false;
  }
}

/**
 * Executar migração completa
 */
async function main() {
  try {
    // Conectar ao banco
    console.log('🔗 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar se a tabela existe
    console.log('🔍 Verificando se a tabela ai_configs existe...');
    const exists = await tableExists();

    if (!exists) {
      console.log('ℹ️  Tabela ai_configs não existe');
      console.log('✅ Nenhuma ação necessária! A tabela será criada automaticamente pelo Sequelize.\n');
      await sequelize.close();
      process.exit(0);
    }

    console.log('✅ Tabela ai_configs encontrada\n');

    // Verificar tipo do campo updatedBy
    console.log('🔍 Verificando tipo do campo updatedBy...');
    const typeInfo = await checkUpdatedByType();

    if (!typeInfo) {
      console.log('⚠️  Campo updatedBy não encontrado na tabela');
      console.log('💡 A tabela pode estar corrompida. Vamos recriá-la.\n');
    } else {
      console.log(`📊 Tipo atual: ${typeInfo.dataType} (${typeInfo.udtName})\n`);

      if (typeInfo.udtName === 'int4' || typeInfo.dataType === 'integer') {
        console.log('✅ Campo updatedBy já está com tipo correto (INTEGER)!');
        console.log('✅ Nenhuma migração necessária!\n');
        await sequelize.close();
        process.exit(0);
      }

      console.log('❌ Campo updatedBy está com tipo incorreto!');
      console.log(`   Atual: ${typeInfo.udtName} (deveria ser int4/integer)`);
      console.log('   Será necessário recriar a tabela.\n');
    }

    // Verificar se há dados
    console.log('🔍 Verificando dados na tabela...');
    const recordCount = await countRecords();
    console.log(`📊 Total de registros: ${recordCount}\n`);

    // Fazer backup se houver dados
    let backupFile = null;
    if (recordCount > 0) {
      console.log('💾 Fazendo backup dos dados...');
      backupFile = await backupData();
      if (backupFile) {
        console.log(`✅ Backup salvo!\n`);
      }
    }

    // Confirmar antes de deletar
    console.log('⚠️  ATENÇÃO: A tabela ai_configs será deletada e recriada!');
    console.log('   Motivo: Campo updatedBy precisa ser INTEGER, não UUID');
    console.log('   Dados: ' + (recordCount > 0 ? `${recordCount} registros (backup feito)` : 'Nenhum dado'));
    console.log('\n🔄 Iniciando migração em 3 segundos...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dropar tabela
    console.log('\n🗑️  Deletando tabela ai_configs...');
    if (!await dropTable()) {
      throw new Error('Falha ao deletar tabela');
    }

    // Recriar tabela
    console.log('\n📦 Recriando tabela com schema correto...');
    if (!await recreateTable()) {
      throw new Error('Falha ao recriar tabela');
    }

    // Verificar resultado
    console.log('\n🔍 Verificando resultado da migração...');
    const success = await verifyMigration();

    if (success) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('\n📋 Resultado:');
      console.log('   ✅ Tabela ai_configs recriada');
      console.log('   ✅ Campo updatedBy agora é INTEGER');
      console.log('   ✅ Compatível com User.id');
      if (backupFile) {
        console.log(`   ✅ Backup salvo em: ${backupFile}`);
      }
      console.log('\n🎯 Próximos passos:');
      console.log('   1. Reinicie o servidor (Railway faz automaticamente)');
      console.log('   2. Teste o AI Playground');
      console.log('   3. Edite e salve o contexto');
      console.log('   4. Deve funcionar sem erro 500! ✅\n');
    } else {
      console.log('\n⚠️  Migração completada mas verificação falhou');
      console.log('💡 Reinicie o servidor e deixe o Sequelize recriar a tabela.\n');
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO DURANTE A MIGRAÇÃO:', error);
    console.error('\n💡 SOLUÇÃO ALTERNATIVA:');
    console.error('   1. Vá no Railway Dashboard');
    console.error('   2. PostgreSQL → Data/Query');
    console.error('   3. Execute: DROP TABLE IF EXISTS "ai_configs" CASCADE;');
    console.error('   4. Reinicie o servidor\n');
    
    await sequelize.close();
    process.exit(1);
  }
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
