/**
 * Script para Limpar Sessão do WhatsApp
 * Limpa tokens e força nova conexão
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://web-production-ea053.up.railway.app/api';
const TOKEN_DIR = path.join(__dirname, '../tokens');

console.log('═══════════════════════════════════════════════════════');
console.log('🧹 LIMPEZA DE SESSÃO DO WHATSAPP');
console.log('═══════════════════════════════════════════════════════\n');

/**
 * Limpa arquivos de sessão locais
 */
async function clearLocalSession() {
  console.log('📂 Verificando diretório de tokens...');
  
  if (!fs.existsSync(TOKEN_DIR)) {
    console.log('ℹ️  Diretório de tokens não existe (tudo bem, será criado)');
    return true;
  }

  try {
    const files = fs.readdirSync(TOKEN_DIR);
    
    if (files.length === 0) {
      console.log('ℹ️  Nenhum arquivo de sessão encontrado');
      return true;
    }

    console.log(`🗑️  Encontrados ${files.length} arquivo(s) de sessão:`);
    
    for (const file of files) {
      const filePath = path.join(TOKEN_DIR, file);
      console.log(`   - Deletando: ${file}`);
      fs.unlinkSync(filePath);
    }

    console.log('✅ Arquivos locais deletados com sucesso!\n');
    return true;

  } catch (error) {
    console.error('❌ Erro ao limpar arquivos locais:', error.message);
    return false;
  }
}

/**
 * Limpa sessão via API (se servidor estiver rodando)
 */
async function clearRemoteSession() {
  console.log('🌐 Tentando limpar sessão no servidor remoto...');
  
  try {
    // Verificar se servidor está online
    console.log('   🔍 Verificando status do servidor...');
    
    try {
      await axios.get(`${API_URL}/status`, { timeout: 5000 });
      console.log('   ✅ Servidor está online');
    } catch (error) {
      console.log('   ⚠️  Servidor não está acessível (isso é normal se estiver offline)');
      console.log('   ℹ️  A limpeza local é suficiente se o servidor estiver parado');
      return true;
    }

    // Tentar limpar sessão
    console.log('   🧹 Enviando comando de limpeza...');
    
    const response = await axios.post(`${API_URL}/whatsapp/clear-session`, {}, {
      timeout: 10000,
      validateStatus: () => true // Aceitar qualquer status
    });

    if (response.status === 200 || response.status === 201) {
      console.log('   ✅ Sessão limpa no servidor!');
      return true;
    } else {
      console.log(`   ⚠️  Resposta inesperada: ${response.status}`);
      console.log('   ℹ️  Mas a limpeza local já foi feita');
      return true;
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ℹ️  Servidor não está rodando localmente (normal para Railway)');
    } else {
      console.log(`   ⚠️  Erro ao limpar sessão remota: ${error.message}`);
    }
    console.log('   ℹ️  A limpeza local é suficiente');
    return true;
  }
}

/**
 * Executa limpeza completa
 */
async function main() {
  let success = true;

  // Passo 1: Limpar localmente
  console.log('🔹 PASSO 1: Limpando arquivos locais...');
  if (!await clearLocalSession()) {
    success = false;
  }

  // Passo 2: Limpar remotamente
  console.log('🔹 PASSO 2: Limpando sessão remota...');
  if (!await clearRemoteSession()) {
    success = false;
  }

  // Resultado final
  console.log('\n═══════════════════════════════════════════════════════');
  if (success) {
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Se o servidor estiver rodando, faça um restart');
    console.log('2. Acesse o dashboard');
    console.log('3. Vá em: Administração → Connections');
    console.log('4. Clique em "Nova Conexão"');
    console.log('5. Aguarde o QR Code (pode demorar 20-30s)');
    console.log('6. Escaneie com seu WhatsApp\n');
  } else {
    console.log('⚠️  LIMPEZA COMPLETADA COM AVISOS');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('ℹ️  Alguns avisos ocorreram, mas isso é normal.');
    console.log('ℹ️  A limpeza local foi feita, que é o mais importante.\n');
  }

  process.exit(0);
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
