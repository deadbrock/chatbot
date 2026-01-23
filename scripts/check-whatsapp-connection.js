/**
 * Script para Verificar e Registrar Conexão do WhatsApp
 * Verifica se o WhatsApp está conectado e salva no banco
 */

const axios = require('axios');
const { sequelize } = require('../src/config/database');
const WhatsAppConnection = require('../src/models/WhatsAppConnectionSQL')(sequelize, require('sequelize').DataTypes);

const API_URL = process.env.API_URL || 'https://web-production-ea053.up.railway.app/api';
const EMAIL = 'admin@admin.com';
const PASSWORD = 'admin123';

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 VERIFICAR CONEXÃO DO WHATSAPP');
console.log('═══════════════════════════════════════════════════════\n');

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
    }, { timeout: 10000 });

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
 * Verificar status do WhatsApp
 */
async function checkWhatsAppStatus() {
  console.log('🔍 Verificando status do WhatsApp via API...');
  
  try {
    const response = await axios.get(`${API_URL}/whatsapp/status`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 10000
    });

    console.log('📊 Status recebido:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message);
    return null;
  }
}

/**
 * Conectar ao banco de dados
 */
async function connectDatabase() {
  console.log('\n📂 Conectando ao banco de dados...');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de dados\n');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    return false;
  }
}

/**
 * Verificar conexões no banco
 */
async function checkDatabaseConnections() {
  console.log('🔍 Verificando conexões no banco de dados...');
  
  try {
    const connections = await WhatsAppConnection.findAll();
    
    console.log(`📊 Total de conexões no banco: ${connections.length}\n`);
    
    if (connections.length > 0) {
      console.log('Conexões encontradas:');
      connections.forEach((conn, index) => {
        console.log(`\n${index + 1}. ${conn.name}`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Instance ID: ${conn.instanceId}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Telefone: ${conn.phoneNumber || 'N/A'}`);
        console.log(`   Ativa: ${conn.isActive ? 'Sim' : 'Não'}`);
        console.log(`   Padrão: ${conn.isDefault ? 'Sim' : 'Não'}`);
      });
    } else {
      console.log('⚠️  Nenhuma conexão encontrada no banco\n');
    }
    
    return connections;

  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error.message);
    return [];
  }
}

/**
 * Criar/Atualizar conexão no banco
 */
async function saveConnection(status) {
  console.log('\n💾 Salvando conexão no banco de dados...');
  
  try {
    // Buscar se já existe uma conexão padrão
    let connection = await WhatsAppConnection.findOne({
      where: { isDefault: true }
    });

    const connectionData = {
      name: 'WhatsApp Principal',
      instanceId: 'wppconnect-default',
      status: status.connected ? 'connected' : 'disconnected',
      isActive: true,
      isDefault: true,
      priority: 100,
      phoneNumber: status.info?.wid?.user || null,
      phoneNumberFormatted: status.info?.formattedNumber || null,
      deviceInfo: status.info ? {
        platform: status.info.platform || 'unknown',
        pushname: status.info.pushname || null,
        phone: status.info.phone || null
      } : null,
      lastConnectedAt: status.connected ? new Date() : null
    };

    if (connection) {
      // Atualizar existente
      await connection.update(connectionData);
      console.log('✅ Conexão atualizada no banco!');
      console.log(`   ID: ${connection.id}`);
    } else {
      // Criar nova
      connection = await WhatsAppConnection.create(connectionData);
      console.log('✅ Nova conexão criada no banco!');
      console.log(`   ID: ${connection.id}`);
    }

    return connection;

  } catch (error) {
    console.error('❌ Erro ao salvar conexão:', error.message);
    return null;
  }
}

/**
 * Executar verificação completa
 */
async function main() {
  // Verificar via API (não requer banco)
  if (!await login()) {
    console.error('\n❌ Não foi possível fazer login.');
    process.exit(1);
  }

  const status = await checkWhatsAppStatus();
  
  if (!status) {
    console.error('\n❌ Não foi possível verificar o status do WhatsApp.');
    console.log('\n💡 SOLUÇÃO: O servidor pode não estar rodando.');
    console.log('   Verifique se o servidor está online em:');
    console.log(`   ${API_URL}/status`);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESULTADO DA VERIFICAÇÃO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n✅ WhatsApp Conectado: ${status.connected ? 'SIM ✅' : 'NÃO ❌'}`);
  
  if (status.connected && status.info) {
    console.log(`📱 Telefone: ${status.info.formattedNumber || status.info.wid?.user || 'N/A'}`);
    console.log(`👤 Nome: ${status.info.pushname || 'N/A'}`);
    console.log(`📱 Plataforma: ${status.info.platform || 'N/A'}`);
  }

  // Verificar banco de dados
  if (!await connectDatabase()) {
    console.error('\n❌ Não foi possível conectar ao banco de dados.');
    console.log('\n💡 Mas o WhatsApp está funcionando via API!');
    process.exit(0);
  }

  await checkDatabaseConnections();

  // Se WhatsApp está conectado, salvar no banco
  if (status.connected) {
    const saved = await saveConnection(status);
    
    if (saved) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ SUCESSO!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('\n📋 PRÓXIMOS PASSOS:');
      console.log('1. Acesse o dashboard');
      console.log('2. Vá em: Administração → Connections');
      console.log('3. Atualize a página (F5)');
      console.log('4. A conexão deve aparecer agora! ✅\n');
    }
  } else {
    console.log('\n⚠️  WhatsApp não está conectado.');
    console.log('💡 Execute o script de conexão primeiro.\n');
  }

  await sequelize.close();
  process.exit(0);
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
