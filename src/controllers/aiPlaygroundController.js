const logger = require('../utils/logger');
// const Groq = require('groq-sdk'); // ⚠️ Desabilitado: groq-sdk não instalado (IA aguardando aprovação)

/**
 * Controller para playground de testes e treinamento da IA
 * ⚠️ TEMPORARIAMENTE DESABILITADO: aguardando aprovação da diretoria + instalação do groq-sdk
 */

/**
 * Testar mensagem com a IA
 */
async function testMessage(req, res) {
  logger.warn('⚠️ [AI PLAYGROUND] Tentativa de uso com IA desabilitada');
  return res.status(503).json({
    success: false,
    error: 'Serviço de IA temporariamente indisponível',
    message: 'O playground de IA requer o pacote groq-sdk. Instale com: npm install groq-sdk'
  });
}

/**
 * Salvar exemplo de treinamento
 */
async function saveTrainingExample(req, res) {
  try {
    const { message, expectedIntent, expectedResponse, notes } = req.body;

    if (!message || !expectedIntent) {
      return res.status(400).json({ error: 'Mensagem e intenção esperada são obrigatórias' });
    }

    // Criar diretório de exemplos se não existir
    const fs = require('fs');
    const path = require('path');
    const examplesDir = path.join(__dirname, '../data/training-examples');
    
    if (!fs.existsSync(examplesDir)) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }

    // Carregar exemplos existentes ou criar novo arquivo
    const examplesFile = path.join(examplesDir, 'examples.json');
    let examples = [];
    
    if (fs.existsSync(examplesFile)) {
      const data = fs.readFileSync(examplesFile, 'utf8');
      examples = JSON.parse(data);
    }

    // Adicionar novo exemplo
    const newExample = {
      id: Date.now().toString(),
      message,
      expectedIntent,
      expectedResponse,
      notes,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    examples.push(newExample);

    // Salvar de volta
    fs.writeFileSync(examplesFile, JSON.stringify(examples, null, 2), 'utf8');

    logger.info(`✅ [AI PLAYGROUND] Exemplo de treinamento salvo: ${newExample.id}`);

    res.json({
      success: true,
      example: newExample
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao salvar exemplo:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar exemplo',
      details: error.message 
    });
  }
}

/**
 * Listar exemplos de treinamento
 */
async function getTrainingExamples(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const examplesFile = path.join(__dirname, '../data/training-examples/examples.json');
    
    let examples = [];
    
    if (fs.existsSync(examplesFile)) {
      const data = fs.readFileSync(examplesFile, 'utf8');
      examples = JSON.parse(data);
    }

    res.json({
      success: true,
      examples: examples.reverse() // Mais recentes primeiro
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao carregar exemplos:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar exemplos',
      details: error.message 
    });
  }
}

/**
 * Deletar exemplo de treinamento
 */
async function deleteTrainingExample(req, res) {
  try {
    const { id } = req.params;
    const fs = require('fs');
    const path = require('path');
    const examplesFile = path.join(__dirname, '../data/training-examples/examples.json');
    
    if (!fs.existsSync(examplesFile)) {
      return res.status(404).json({ error: 'Nenhum exemplo encontrado' });
    }

    const data = fs.readFileSync(examplesFile, 'utf8');
    let examples = JSON.parse(data);

    // Remover exemplo
    examples = examples.filter(ex => ex.id !== id);

    // Salvar de volta
    fs.writeFileSync(examplesFile, JSON.stringify(examples, null, 2), 'utf8');

    logger.info(`✅ [AI PLAYGROUND] Exemplo removido: ${id}`);

    res.json({
      success: true,
      message: 'Exemplo removido com sucesso'
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao deletar exemplo:', error);
    res.status(500).json({ 
      error: 'Erro ao deletar exemplo',
      details: error.message 
    });
  }
}

/**
 * Obter estatísticas de intenções
 */
async function getIntentStats(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const examplesFile = path.join(__dirname, '../data/training-examples/examples.json');
    
    let examples = [];
    
    if (fs.existsSync(examplesFile)) {
      const data = fs.readFileSync(examplesFile, 'utf8');
      examples = JSON.parse(data);
    }

    // Contar intenções
    const intentCounts = {};
    examples.forEach(ex => {
      intentCounts[ex.expectedIntent] = (intentCounts[ex.expectedIntent] || 0) + 1;
    });

    // Converter para array e ordenar
    const stats = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      stats,
      totalExamples: examples.length
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao obter estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao obter estatísticas',
      details: error.message 
    });
  }
}

/**
 * Funções auxiliares
 */

// Detectar intenção simples baseada em palavras-chave
function detectSimpleIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.match(/férias|ferias|tirar ferias|solicitar ferias/)) {
    return 'consulta_ferias';
  }
  if (lowerMessage.match(/folha de pagamento|salario|salário|holerite|contracheque/)) {
    return 'consulta_folha_pagamento';
  }
  if (lowerMessage.match(/beneficio|benefício|vale|plano de saude|plano de saúde/)) {
    return 'consulta_beneficios';
  }
  if (lowerMessage.match(/humano|atendente|pessoa|falar com alguem|falar com alguém/)) {
    return 'atendimento_humano';
  }
  if (lowerMessage.match(/oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello/)) {
    return 'saudacao';
  }
  
  return 'geral';
}

// Detectar sentimento simples
function detectSentiment(message) {
  const lowerMessage = message.toLowerCase();
  
  // Palavras positivas
  const positiveWords = ['obrigado', 'obrigada', 'legal', 'ótimo', 'otimo', 'bom', 'excelente', 'perfeito', 'sim', 'ok'];
  // Palavras negativas
  const negativeWords = ['problema', 'ruim', 'péssimo', 'pessimo', 'não', 'nao', 'erro', 'falha', 'dificuldade'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerMessage.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

module.exports = {
  testMessage,
  saveTrainingExample,
  getTrainingExamples,
  deleteTrainingExample,
  getIntentStats
};

