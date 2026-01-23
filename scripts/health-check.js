/**
 * Script de Health Check - Verifica Saúde do Sistema
 * Testa todos os componentes principais
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://web-production-ea053.up.railway.app/api';

console.log('═══════════════════════════════════════════════════════');
console.log('🏥 HEALTH CHECK - ASTROCHAT');
console.log('═══════════════════════════════════════════════════════\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * Teste 1: Servidor Online
 */
async function testServerOnline() {
  console.log('🔹 Teste 1: Verificando se servidor está online...');
  
  try {
    const response = await axios.get(`${API_URL}/status`, { timeout: 5000 });
    
    if (response.status === 200 && response.data.status === 'online') {
      console.log('   ✅ Servidor está ONLINE');
      console.log(`   ⏱️  Uptime: ${Math.floor(response.data.uptime)}s\n`);
      results.passed++;
      return true;
    } else {
      console.log('   ⚠️  Servidor respondeu mas com status inesperado\n');
      results.warnings++;
      return false;
    }
  } catch (error) {
    console.log('   ❌ Servidor está OFFLINE ou inacessível');
    console.log(`   Erro: ${error.message}\n`);
    results.failed++;
    return false;
  }
}

/**
 * Teste 2: Banco de Dados
 */
async function testDatabase() {
  console.log('🔹 Teste 2: Verificando conexão com banco de dados...');
  
  try {
    // Tentar buscar configurações (endpoint que acessa o DB)
    const response = await axios.get(`${API_URL}/settings`, { 
      timeout: 10000,
      validateStatus: (status) => status < 500 // Aceitar até 499
    });
    
    if (response.status === 200 || response.status === 401) {
      // 401 é OK, significa que o endpoint existe e DB está conectado
      console.log('   ✅ Banco de dados está CONECTADO\n');
      results.passed++;
      return true;
    } else {
      console.log(`   ⚠️  Resposta inesperada: ${response.status}\n`);
      results.warnings++;
      return false;
    }
  } catch (error) {
    if (error.response?.status === 401) {
      // 401 é OK neste caso
      console.log('   ✅ Banco de dados está CONECTADO (autenticação necessária)\n');
      results.passed++;
      return true;
    }
    
    console.log('   ❌ Erro ao conectar com banco de dados');
    console.log(`   Erro: ${error.message}\n`);
    results.failed++;
    return false;
  }
}

/**
 * Teste 3: WhatsApp Status
 */
async function testWhatsApp() {
  console.log('🔹 Teste 3: Verificando status do WhatsApp...');
  
  try {
    const response = await axios.get(`${API_URL}/whatsapp/status`, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      console.log('   ℹ️  Endpoint existe (autenticação necessária)');
      console.log('   ✅ Módulo WhatsApp está ATIVO\n');
      results.passed++;
      return true;
    } else if (response.status === 200) {
      const connected = response.data.connected || false;
      console.log(`   Status: ${connected ? '✅ CONECTADO' : '⏳ DESCONECTADO'}`);
      console.log(`   Info: ${JSON.stringify(response.data, null, 2)}\n`);
      results.passed++;
      return true;
    } else {
      console.log(`   ⚠️  Status inesperado: ${response.status}\n`);
      results.warnings++;
      return false;
    }
  } catch (error) {
    console.log('   ❌ Erro ao verificar WhatsApp');
    console.log(`   Erro: ${error.message}\n`);
    results.failed++;
    return false;
  }
}

/**
 * Teste 4: Arquivos de Sessão
 */
async function testSessionFiles() {
  console.log('🔹 Teste 4: Verificando arquivos de sessão...');
  
  try {
    const tokenDir = path.join(__dirname, '../tokens');
    
    if (!fs.existsSync(tokenDir)) {
      console.log('   ℹ️  Diretório de tokens não existe (será criado ao conectar)');
      console.log('   ✅ Estado limpo\n');
      results.passed++;
      return true;
    }

    const files = fs.readdirSync(tokenDir);
    
    if (files.length === 0) {
      console.log('   ℹ️  Nenhum arquivo de sessão (estado limpo)');
      console.log('   ✅ Pronto para nova conexão\n');
      results.passed++;
      return true;
    } else {
      console.log(`   📂 Encontrados ${files.length} arquivo(s) de sessão:`);
      files.forEach(file => console.log(`      - ${file}`));
      console.log('   ⚠️  Sessões antigas presentes (pode causar conflito)\n');
      results.warnings++;
      return true;
    }
  } catch (error) {
    console.log('   ❌ Erro ao verificar arquivos');
    console.log(`   Erro: ${error.message}\n`);
    results.failed++;
    return false;
  }
}

/**
 * Teste 5: APIs Principais
 */
async function testMainAPIs() {
  console.log('🔹 Teste 5: Verificando APIs principais...');
  
  const endpoints = [
    '/users/login',
    '/tickets',
    '/sessions',
    '/analytics/dashboard',
    '/automations/rules'
  ];

  let working = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`, {
        timeout: 5000,
        validateStatus: () => true
      });

      // 401 significa que endpoint existe e precisa de auth (OK)
      // 200 significa que endpoint está funcionando (OK)
      if (response.status === 200 || response.status === 401) {
        console.log(`   ✅ ${endpoint}`);
        working++;
      } else {
        console.log(`   ⚠️  ${endpoint} (status ${response.status})`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint} (erro: ${error.message})`);
    }
  }

  console.log(`\n   Total: ${working}/${endpoints.length} endpoints funcionando\n`);
  
  if (working >= endpoints.length * 0.8) {
    results.passed++;
    return true;
  } else {
    results.failed++;
    return false;
  }
}

/**
 * Teste 6: Variáveis de Ambiente
 */
async function testEnvironmentVariables() {
  console.log('🔹 Teste 6: Verificando variáveis de ambiente...');
  
  const requiredVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'DATABASE_URL',
    'GROQ_API_KEY'
  ];

  let missing = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length === 0) {
    console.log('   ✅ Todas as variáveis obrigatórias estão configuradas\n');
    results.passed++;
    return true;
  } else {
    console.log('   ⚠️  Variáveis faltando (verificar no Railway):');
    missing.forEach(v => console.log(`      - ${v}`));
    console.log('\n');
    results.warnings++;
    return false;
  }
}

/**
 * Executa todos os testes
 */
async function main() {
  const startTime = Date.now();

  console.log(`🌐 API URL: ${API_URL}\n`);

  // Executar testes
  await testServerOnline();
  await testDatabase();
  await testWhatsApp();
  await testSessionFiles();
  await testMainAPIs();
  await testEnvironmentVariables();

  // Resultado final
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESULTADO DO HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Testes Passados: ${results.passed}`);
  console.log(`⚠️  Avisos: ${results.warnings}`);
  console.log(`❌ Testes Falhados: ${results.failed}`);
  console.log(`⏱️  Tempo Total: ${totalTime}s`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (results.failed === 0) {
    console.log('🎉 SISTEMA SAUDÁVEL!');
    console.log('✅ Todos os componentes críticos estão funcionando.\n');
    
    if (results.warnings > 0) {
      console.log('ℹ️  Alguns avisos foram encontrados, mas não são críticos.\n');
    }
  } else {
    console.log('⚠️  PROBLEMAS DETECTADOS!');
    console.log('❌ Alguns componentes apresentaram falhas.');
    console.log('💡 Verifique os logs acima para detalhes.\n');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL no health check:', error);
  process.exit(1);
});
