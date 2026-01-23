/**
 * Script de Teste para Automações Inteligentes
 * Testa o fluxo completo do sistema de automações
 */

const axios = require('axios');

// Configuração
const API_URL = process.env.API_URL || 'http://localhost:8080/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@admin.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

let authToken = null;

/**
 * Faz login e obtém o token
 */
async function login() {
  console.log('🔐 Fazendo login...');
  
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login realizado com sucesso!');
      return true;
    }
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Headers com autenticação
 */
function getHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Teste 1: Listar regras existentes
 */
async function testListRules() {
  console.log('\n📋 Teste 1: Listar regras...');
  
  try {
    const response = await axios.get(`${API_URL}/automations/rules`, {
      headers: getHeaders()
    });

    console.log(`✅ Total de regras: ${response.data.rules.length}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao listar regras:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Teste 2: Criar regra de teste
 */
async function testCreateRule() {
  console.log('\n➕ Teste 2: Criar regra de teste...');
  
  const testRule = {
    name: 'Teste Automático - Saudação',
    description: 'Regra criada automaticamente para testes',
    isActive: true,
    priority: 50,
    triggerType: 'intent',
    triggerValue: 'saudacao',
    requiredSlots: ['nome', 'motivo'],
    slotPrompts: {
      nome: 'Qual é o seu nome?',
      motivo: 'Como posso te ajudar hoje?'
    },
    actions: [
      {
        type: 'create_ticket',
        params: {
          subject: 'Novo contato via teste',
          status: 'open',
          priority: 'medium'
        }
      }
    ],
    greetingMessage: 'Olá! Bem-vindo ao teste de automações do AstroChat!',
    completionMessage: 'Obrigado! Sua solicitação foi registrada.',
    errorMessage: 'Desculpe, ocorreu um erro. Por favor, tente novamente.'
  };

  try {
    const response = await axios.post(`${API_URL}/automations/rules`, testRule, {
      headers: getHeaders()
    });

    if (response.data.success) {
      console.log(`✅ Regra criada com ID: ${response.data.rule.id}`);
      return response.data.rule.id;
    }
  } catch (error) {
    console.error('❌ Erro ao criar regra:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Teste 3: Testar detecção de intenção
 */
async function testIntentDetection() {
  console.log('\n🎯 Teste 3: Testar detecção de intenção...');
  
  const testMessages = [
    'Olá, bom dia!',
    'Preciso falar sobre meu salário',
    'Quero tirar férias',
    'Estou com problema no computador'
  ];

  let successCount = 0;

  for (const message of testMessages) {
    try {
      const response = await axios.post(`${API_URL}/automations/test`, 
        { message },
        { headers: getHeaders() }
      );

      console.log(`   📨 "${message}"`);
      console.log(`      → ${response.data.result ? '✅ Automação acionada' : 'ℹ️ Nenhuma automação'}`);
      
      if (response.data.result) {
        successCount++;
      }
    } catch (error) {
      console.error(`   ❌ Erro ao testar mensagem:`, error.response?.data || error.message);
    }
  }

  console.log(`\n   Total: ${successCount}/${testMessages.length} mensagens acionaram automações`);
  return successCount > 0;
}

/**
 * Teste 4: Verificar estatísticas
 */
async function testStats() {
  console.log('\n📊 Teste 4: Verificar estatísticas...');
  
  try {
    const response = await axios.get(`${API_URL}/automations/stats`, {
      headers: getHeaders()
    });

    const stats = response.data.stats;
    console.log(`   ✅ Total de Regras: ${stats.totalRules}`);
    console.log(`   ✅ Regras Ativas: ${stats.activeRules}`);
    console.log(`   ✅ Total de Execuções: ${stats.totalExecutions}`);
    console.log(`   ✅ Taxa de Sucesso: ${stats.successRate}%`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Teste 5: Listar templates
 */
async function testTemplates() {
  console.log('\n📋 Teste 5: Listar templates...');
  
  try {
    const response = await axios.get(`${API_URL}/automations/templates`, {
      headers: getHeaders()
    });

    console.log(`✅ Templates disponíveis: ${response.data.templates.length}`);
    
    response.data.templates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      ${template.description}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao listar templates:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Teste 6: Deletar regra de teste
 */
async function testDeleteRule(ruleId) {
  console.log('\n🗑️ Teste 6: Deletar regra de teste...');
  
  if (!ruleId) {
    console.log('   ⏭️ Nenhuma regra para deletar');
    return true;
  }

  try {
    const response = await axios.delete(`${API_URL}/automations/rules/${ruleId}`, {
      headers: getHeaders()
    });

    if (response.data.success) {
      console.log('✅ Regra deletada com sucesso!');
      return true;
    }
  } catch (error) {
    console.error('❌ Erro ao deletar regra:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Teste 7: Listar execuções
 */
async function testListExecutions() {
  console.log('\n📜 Teste 7: Listar execuções...');
  
  try {
    const response = await axios.get(`${API_URL}/automations/executions?limit=10`, {
      headers: getHeaders()
    });

    console.log(`✅ Execuções encontradas: ${response.data.executions.length}`);
    
    if (response.data.executions.length > 0) {
      console.log('\n   Últimas execuções:');
      response.data.executions.slice(0, 3).forEach((exec, index) => {
        console.log(`   ${index + 1}. Status: ${exec.status} | Regra: ${exec.rule?.name || 'N/A'}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao listar execuções:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Executa todos os testes
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🤖 TESTE DE AUTOMAÇÕES INTELIGENTES - ASTROCHAT');
  console.log('═══════════════════════════════════════════════════════\n');

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Login
  if (!await login()) {
    console.error('\n❌ Falha no login. Abortando testes.');
    process.exit(1);
  }

  let testRuleId = null;

  // Teste 1: Listar regras
  results.total++;
  if (await testListRules()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 2: Criar regra
  results.total++;
  testRuleId = await testCreateRule();
  if (testRuleId) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 3: Detecção de intenção
  results.total++;
  if (await testIntentDetection()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 4: Estatísticas
  results.total++;
  if (await testStats()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 5: Templates
  results.total++;
  if (await testTemplates()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 6: Deletar regra de teste
  results.total++;
  if (await testDeleteRule(testRuleId)) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Teste 7: Listar execuções
  results.total++;
  if (await testListExecutions()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Resultados finais
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESULTADOS DOS TESTES');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Testes Passados: ${results.passed}/${results.total}`);
  console.log(`❌ Testes Falhados: ${results.failed}/${results.total}`);
  console.log(`📈 Taxa de Sucesso: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (results.failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
    process.exit(0);
  } else {
    console.log('⚠️ ALGUNS TESTES FALHARAM. Verifique os logs acima.');
    process.exit(1);
  }
}

// Executar testes
runTests().catch(error => {
  console.error('\n❌ Erro fatal durante execução dos testes:', error);
  process.exit(1);
});
