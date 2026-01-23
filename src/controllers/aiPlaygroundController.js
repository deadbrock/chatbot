const logger = require('../utils/logger');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

/**
 * Controller para playground de testes e treinamento da IA
 * Usa Groq (Llama 3.1) para processamento de linguagem natural
 * Implementa Few-Shot Learning com exemplos de treinamento
 */

// Inicializar cliente Groq
let groqClient = null;

function getGroqClient() {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    logger.info('✅ Cliente Groq inicializado');
  }
  return groqClient;
}

/**
 * Carregar exemplos de treinamento do arquivo
 */
function loadTrainingExamples() {
  try {
    const examplesFile = path.join(__dirname, '../data/training-examples/examples.json');
    
    if (fs.existsSync(examplesFile)) {
      const data = fs.readFileSync(examplesFile, 'utf8');
      const examples = JSON.parse(data);
      logger.info(`📚 ${examples.length} exemplos de treinamento carregados`);
      return examples;
    }
    
    logger.warn('⚠️ Nenhum exemplo de treinamento encontrado');
    return [];
  } catch (error) {
    logger.error('❌ Erro ao carregar exemplos:', error);
    return [];
  }
}

/**
 * Construir prompt com Few-Shot Learning
 * Inclui exemplos de treinamento para melhorar as respostas
 */
function buildFewShotPrompt(userMessage, context, examples) {
  let systemPrompt = `Você é um assistente virtual inteligente da empresa Aestron.
Sua função é ajudar funcionários com dúvidas sobre:
- Departamento Pessoal (férias, benefícios, holerite)
- Recursos Humanos (vagas, contratação)
- Financeiro (pagamentos, reembolsos)
- Manutenção (equipamentos, reparos)
- Logística (entregas, transportes)

Analise a mensagem do usuário e:
1. Identifique a intenção principal
2. Forneça uma resposta útil e profissional
3. Se necessário, sugira o departamento adequado

${context ? `Contexto adicional: ${context}` : ''}`;

  // Adicionar exemplos de treinamento (Few-Shot Learning)
  if (examples && examples.length > 0) {
    systemPrompt += '\n\n📚 EXEMPLOS DE TREINAMENTO (aprenda com estes exemplos):\n';
    
    // Limitar a 5 exemplos mais recentes para não exceder limite de tokens
    const recentExamples = examples.slice(0, 5);
    
    recentExamples.forEach((example, index) => {
      systemPrompt += `\nExemplo ${index + 1}:`;
      systemPrompt += `\nUsuário: "${example.message}"`;
      systemPrompt += `\nIntenção esperada: ${example.expectedIntent}`;
      
      if (example.expectedResponse) {
        systemPrompt += `\nResposta esperada: "${example.expectedResponse}"`;
      }
      
      if (example.notes) {
        systemPrompt += `\nNotas: ${example.notes}`;
      }
    });
    
    systemPrompt += '\n\n✅ Use estes exemplos como referência para entender melhor as intenções e fornecer respostas adequadas.';
  }
  
  return systemPrompt;
}

/**
 * Testar mensagem com a IA usando Few-Shot Learning
 */
async function testMessage(req, res) {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem é obrigatória'
      });
    }

    // Verificar se API key está configurada
    if (!process.env.GROQ_API_KEY) {
      logger.warn('⚠️ [AI PLAYGROUND] GROQ_API_KEY não configurada');
      return res.status(503).json({
        success: false,
        error: 'API de IA não configurada',
        message: 'Configure a variável GROQ_API_KEY no ambiente'
      });
    }

    const client = getGroqClient();
    
    logger.info(`🤖 [AI PLAYGROUND] Testando mensagem: "${message.substring(0, 50)}..."`);

    // 🎓 CARREGAR EXEMPLOS DE TREINAMENTO (Few-Shot Learning)
    const trainingExamples = loadTrainingExamples();
    
    // Construir prompt com exemplos de treinamento
    const systemPrompt = buildFewShotPrompt(message, context, trainingExamples);
    
    if (trainingExamples.length > 0) {
      logger.info(`📚 [AI PLAYGROUND] Usando ${Math.min(5, trainingExamples.length)} exemplos de treinamento`);
    }

    // Chamar API Groq com Few-Shot Learning
    const startTime = Date.now();
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
    });

    const responseTime = Date.now() - startTime;
    const aiResponse = chatCompletion.choices[0]?.message?.content || 'Sem resposta';

    // Detectar intenção e sentimento
    const intent = detectSimpleIntent(message);
    const sentiment = detectSentiment(message);

    logger.info(`✅ [AI PLAYGROUND] Resposta gerada em ${responseTime}ms (${trainingExamples.length} exemplos usados)`);

    res.json({
      success: true,
      response: aiResponse,
      intent,
      sentiment,
      confidence: chatCompletion.choices[0]?.finish_reason === 'stop' ? 0.85 : 0.5,
      responseTime,
      model: 'llama-3.1-8b-instant',
      usage: chatCompletion.usage,
      trainingExamplesUsed: Math.min(5, trainingExamples.length) // Quantos exemplos foram usados
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao testar mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar mensagem',
      details: error.message
    });
  }
}

/**
 * Salvar exemplo de treinamento
 * Os exemplos são salvos em arquivo JSON e usados automaticamente no Few-Shot Learning
 */
async function saveTrainingExample(req, res) {
  try {
    const { message, expectedIntent, expectedResponse, notes } = req.body;

    if (!message || !expectedIntent) {
      return res.status(400).json({ 
        success: false,
        error: 'Mensagem e intenção esperada são obrigatórias' 
      });
    }

    // Criar diretório de exemplos se não existir
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

    // Adicionar novo exemplo NO INÍCIO (mais recentes primeiro)
    const newExample = {
      id: Date.now().toString(),
      message,
      expectedIntent,
      expectedResponse,
      notes,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    // Adicionar no início para priorizar exemplos recentes
    examples.unshift(newExample);

    // Salvar de volta (PERSISTENTE - mantém após recarregar página)
    fs.writeFileSync(examplesFile, JSON.stringify(examples, null, 2), 'utf8');

    logger.info(`✅ [AI PLAYGROUND] Exemplo salvo e será usado no próximo treinamento: ${newExample.id}`);
    logger.info(`📚 [AI PLAYGROUND] Total de exemplos: ${examples.length}`);

    res.json({
      success: true,
      example: newExample,
      message: `Exemplo salvo! A IA agora usará ${Math.min(5, examples.length)} exemplos para aprender.`
    });

  } catch (error) {
    logger.error('❌ [AI PLAYGROUND] Erro ao salvar exemplo:', error);
    res.status(500).json({ 
      success: false,
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

