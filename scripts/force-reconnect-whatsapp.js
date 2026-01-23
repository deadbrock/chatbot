/**
 * Script para Forçar Reconexão do WhatsApp
 * Reinicia completamente a conexão
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'https://web-production-ea053.up.railway.app/api';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

console.log('═══════════════════════════════════════════════════════');
console.log('🔄 FORÇAR RECONEXÃO DO WHATSAPP');
console.log('═══════════════════════════════════════════════════════\n');

let authToken = null;

/**
 * Faz login para obter token
 */
async function login() {
  console.log('🔐 Fazendo login...');
  
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: EMAIL,
      password: PASSWORD
    }, {
      timeout: 10000
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login realizado com sucesso!\n');
      return true;
    } else {
      console.log('❌ Token não recebido');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Força reconexão
 */
async function forceReconnect() {
  console.log('🔄 Forçando reconexão...');
  
  try {
    const response = await axios.post(`${API_URL}/whatsapp/force-reconnect`, {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (response.data.success) {
      console.log('✅ Reconexão iniciada com sucesso!');
      console.log(`   Status: ${response.data.status}\n`);
      return true;
    } else {
      console.log('⚠️  Resposta inesperada:', response.data);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao forçar reconexão:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Aguarda um tempo e verifica status
 */
async function checkStatus() {
  console.log('⏳ Aguardando 5 segundos antes de verificar status...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('🔍 Verificando status da conexão...');
  
  try {
    const response = await axios.get(`${API_URL}/whatsapp/status`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 10000
    });

    console.log('📊 Status atual:');
    console.log(`   - Conectado: ${response.data.connected ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   - Status: ${response.data.status || 'N/A'}`);
    
    if (response.data.qrcode) {
      console.log('   - QR Code: ✅ Disponível');
      console.log('\n📱 QR Code está pronto! Acesse o dashboard para escanear.');
    } else {
      console.log('   - QR Code: ⏳ Ainda não disponível');
      console.log('\n⏳ Aguarde mais 10-20 segundos e acesse o dashboard.');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.response?.data || error.message);
  }
}

/**
 * Executa o processo completo
 */
async function main() {
  // Verificar se servidor está online
  console.log('🌐 Verificando conexão com servidor...');
  
  try {
    await axios.get(`${API_URL}/status`, { timeout: 5000 });
    console.log('✅ Servidor está online\n');
  } catch (error) {
    console.error('❌ Servidor não está acessível!');
    console.error('   URL:', API_URL);
    console.error('   Erro:', error.message);
    console.error('\n💡 Verifique se o servidor está rodando.');
    process.exit(1);
  }

  // Login
  if (!await login()) {
    console.error('\n❌ Não foi possível fazer login.');
    console.error('💡 Verifique suas credenciais.');
    process.exit(1);
  }

  // Forçar reconexão
  if (!await forceReconnect()) {
    console.error('\n❌ Não foi possível forçar reconexão.');
    process.exit(1);
  }

  // Verificar status
  await checkStatus();

  // Resultado final
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ PROCESSO CONCLUÍDO!');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('1. Acesse: ' + API_URL.replace('/api', '/admin'));
  console.log('2. Vá em: Administração → Connections');
  console.log('3. Clique em: "Nova Conexão" ou "Atualizar QR Code"');
  console.log('4. Escaneie o QR Code com seu WhatsApp');
  console.log('5. Aguarde a confirmação de conexão\n');

  process.exit(0);
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
