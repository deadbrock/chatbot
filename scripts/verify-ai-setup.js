/**
 * Diagnóstico da IA de atendimento — FG Services / AstroChat
 * Uso: node scripts/verify-ai-setup.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const intentClassifier = require('../src/bot/services/intentClassifier');
const { isAutoReplyEnabled, resolveGroqApiKey, resolveGroqApiKeySource, getAutoReplyDiagnostics } = require('../src/config/ai');

const configPath = path.join(__dirname, '../data/ai-config.json');
const trainingPath = path.join(__dirname, '../data/training-examples.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function statusLine(ok, label, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('🤖 DIAGNÓSTICO DA IA DE ATENDIMENTO');
  console.log('══════════════════════════════════════════════\n');

  const fileConfig = readJson(configPath) || {};
  const training = readJson(trainingPath) || {};
  const groqKey = resolveGroqApiKey();

  let ready = true;

  const diag = getAutoReplyDiagnostics();
  ready = statusLine(isAutoReplyEnabled(), 'Respostas automáticas', diag.reason) && ready;
  ready = statusLine(!!groqKey, 'API Key Groq/Grok', groqKey ? `configurada (***${groqKey.slice(-6)})` : 'defina GROQ_API_KEY ou GROK_API_KEY no Railway') && ready;
  ready = statusLine(fileConfig.enabled === true, 'IA habilitada (ai-config.json)', fileConfig.enabled ? `modo: ${fileConfig.mode || 'hybrid'}` : 'enabled=false') && ready;
  ready = statusLine(intentClassifier.isEnabled(), 'IA operacional (enabled + API Key)', intentClassifier.isEnabled() ? 'pronta para classificar' : 'faltam requisitos acima') && ready;

  console.log('');
  console.log('📋 Configuração atual:');
  console.log(`   Provider: ${fileConfig.provider || intentClassifier.config.provider}`);
  console.log(`   Modelo: ${fileConfig.model || intentClassifier.config.model}`);
  console.log(`   Modo: ${fileConfig.mode || 'hybrid'}`);
  console.log(`   Confiança mínima: ${fileConfig.confidenceThreshold ?? intentClassifier.config.confidenceThreshold}`);
  console.log(`   Exemplos de treino: ${(training.examples || []).length}`);
  console.log(`   Intenções mapeadas: ${Object.keys(intentClassifier.intentMap).length}`);

  console.log('\n🧪 Teste rápido (keywords, sem API):');
  const keywordTest = intentClassifier.classifyByKeywords('preciso do meu vale transporte');
  if (keywordTest) {
    console.log(`   "${keywordTest.intent}" — confiança ${keywordTest.confidence.toFixed(2)} (${keywordTest.matchedKeywords.join(', ')})`);
  } else {
    console.log('   Nenhum match por keywords');
  }

  if (groqKey) {
    console.log('\n🌐 Teste ao vivo na API Groq:');
    console.log(`   Variável detectada: ${resolveGroqApiKeySource() || 'env'}`);
    try {
      const axios = require('axios');
      const ping = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: fileConfig.model || 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Responda apenas: GROQ_OK' }],
          max_tokens: 8,
          temperature: 0
        },
        {
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      const text = ping.data?.choices?.[0]?.message?.content?.trim() || '(vazio)';
      ready = statusLine(true, 'Conexão Groq API', `modelo ${fileConfig.model || intentClassifier.config.model} → "${text}"`) && ready;

      const live = await intentClassifier.classify('preciso do holerite', { name: 'Teste', is_employee: true });
      const viaGroq = live?.method === 'groq';
      ready = statusLine(viaGroq, 'Classificador usando Groq', viaGroq
        ? `intent=${live.intent}, confiança=${live.confidence?.toFixed?.(2) ?? live.confidence}`
        : `caiu em fallback (${live?.method || 'sem resposta'}) — verifique logs`) && ready;
    } catch (error) {
      const detail = error.response?.data?.error?.message || error.message;
      ready = statusLine(false, 'Conexão Groq API', detail) && ready;
    }
  }

  console.log('\n══════════════════════════════════════════════');
  if (ready) {
    console.log('🎉 IA PRONTA PARA USO');
    console.log('   Reinicie o servidor após alterar variáveis de ambiente.');
  } else {
    console.log('⚠️  IA AINDA NÃO ESTÁ 100% OPERACIONAL');
    console.log('   1. Railway/.env → GROQ_API_KEY=sua_chave');
    console.log('   2. Railway/.env → BOT_AUTO_REPLY=true');
    console.log('   3. Reinicie o servidor');
    console.log('   4. Painel → Configurações → Assistente IA → confirmar ativado');
  }
  console.log('══════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
