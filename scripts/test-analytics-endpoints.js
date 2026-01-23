/**
 * Script para Testar Endpoints de Analytics
 * Testa os endpoints que estão falhando
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'https://web-production-ea053.up.railway.app/api';
const EMAIL = 'admin@admin.com';
const PASSWORD = 'admin123';

let authToken = null;

/**
 * Login
 */
async function login() {
  console.log('🔐 Fazendo login...');
  
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: EMAIL,
      password: PASSWORD
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login realizado\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    return false;
  }
}

/**
 * Testar endpoint
 */
async function testEndpoint(path, method = 'GET') {
  console.log(`\n🔍 Testando: ${method} ${path}`);
  console.log('─'.repeat(60));
  
  try {
    const response = await axios({
      method,
      url: `${API_URL}${path}`,
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 10000
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Dados recebidos:`, JSON.stringify(response.data, null, 2).substring(0, 500));
    return true;

  } catch (error) {
    console.error(`❌ Erro: ${error.response?.status || 'TIMEOUT'}`);
    
    if (error.response?.data) {
      console.error(`📋 Detalhes:`, error.response.data);
    }
    
    if (error.response?.data?.error) {
      console.error(`🔴 Mensagem de erro:`, error.response.data.error);
    }
    
    return false;
  }
}

/**
 * Executar testes
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TESTE DE ENDPOINTS DE ANALYTICS');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!await login()) {
    console.error('\n❌ Não foi possível fazer login.');
    process.exit(1);
  }

  const endpoints = [
    '/analytics/activity/hourly',
    '/analytics/metrics/time',
    '/analytics/rankings/contacts?limit=10',
    '/analytics/rankings/agents',
    '/analytics/tickets/timeline?days=30',
    '/analytics/dashboard',
    '/analytics/metrics/extended'
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    
    // Aguardar 1 segundo entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESULTADO DOS TESTES');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Sucesso: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log(`📊 Total: ${endpoints.length}`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
