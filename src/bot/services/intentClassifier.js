/**
 * Classificador de Intenções usando IA
 * Sistema híbrido que analisa mensagens em linguagem natural
 * e direciona para o fluxo/departamento apropriado
 */

// IMPORTANTE: Carregar .env ANTES de qualquer outra coisa
require('dotenv').config();

const logger = require('../../utils/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class IntentClassifier {
  constructor() {
    // Carregar configurações do arquivo
    this.configPath = path.join(__dirname, '../../../data/ai-config.json');
    this.config = this.loadConfig();
    
    // Sempre usar API Key do .env se disponível
    if (process.env.AI_API_KEY) {
      this.config.apiKey = process.env.AI_API_KEY;
      logger.info(`🔑 API Key carregada do .env: ***${process.env.AI_API_KEY.slice(-6)}`);
    } else {
      logger.warn('⚠️ API Key não encontrada no .env');
    }

    // Mapeamento de intenções para fluxos
    this.intentMap = {
      // Departamento Pessoal
      'dp': {
        flow: 'dp_menu',
        keywords: ['férias', 'afastamento', 'benefícios', 'vale', 'plano de saúde', 'atestado', 'licença', 'rescisão', 'demissão', 'holerite', 'contracheque', 'adiantamento']
      },
      
      // Recursos Humanos
      'rh': {
        flow: 'hr_menu',
        keywords: ['vaga', 'emprego', 'trabalhar', 'currículo', 'contratação', 'processo seletivo', 'recrutamento']
      },
      
      // Financeiro
      'financeiro': {
        flow: 'financial_menu',
        keywords: ['pagamento', 'salário', 'diária', 'rdv', 'nota fiscal', 'reembolso', 'débito', 'fatura', 'cobrança']
      },
      
      // Compras
      'compras': {
        flow: 'purchasing_menu',
        keywords: ['cotação', 'pedido', 'requisição', 'material', 'fornecedor', 'comprar', 'solicitar material']
      },
      
      // Manutenção
      'manutencao': {
        flow: 'maintenance_menu',
        keywords: ['equipamento', 'máquina', 'quebrado', 'defeito', 'conserto', 'manutenção', 'reparo', 'peça', 'enceradeira', 'lavadora', 'aspirador', 'roçadeira']
      },
      
      // Logística
      'logistica': {
        flow: 'logistics_menu',
        keywords: ['entrega', 'transporte', 'veículo', 'motorista', 'frete', 'envio', 'remessa']
      },
      
      // Segurança do Trabalho
      'seguranca': {
        flow: 'safety_menu',
        keywords: ['acidente', 'epi', 'segurança', 'cat', 'incidente', 'risco', 'proteção']
      },
      
      // Faturamento
      'faturamento': {
        flow: 'billing_menu',
        keywords: ['fatura', 'nota', 'cobrança', 'boleto', 'pagamento cliente', 'faturar']
      },
      
      // Comercial
      'comercial': {
        flow: 'commercial_menu',
        keywords: ['contrato', 'proposta', 'orçamento', 'venda', 'negociação', 'renovação', 'cancelamento']
      },
      
      // Operacional
      'operacional': {
        flow: 'operational_menu',
        keywords: ['operação', 'serviço', 'limpeza', 'escala', 'supervisor', 'posto', 'contrato cliente']
      },
      
      // Cliente novo
      'novo_cliente': {
        flow: 'prospect_flow',
        keywords: ['quero ser cliente', 'contratar', 'novo cliente', 'interessado', 'orçamento novo']
      },
      
      // Trabalhe conosco
      'trabalhe_conosco': {
        flow: 'career_flow',
        keywords: ['trabalhar aqui', 'enviar currículo', 'oportunidade', 'candidatar']
      },
      
      // Atendimento humano direto
      'atendimento_humano': {
        flow: 'wait_for_agent',
        keywords: ['atendente', 'pessoa', 'humano', 'falar com alguém', 'urgente', 'reclamação']
      }
    };
  }

  /**
   * Classifica a mensagem do usuário usando IA
   */
  async classify(userMessage, userContext = {}) {
    try {
      logger.info('🧠 Classificando intenção...', { message: userMessage });

      // 🤖 MODO IA PURA: Se IA habilitada, NÃO usar keywords
      if (this.config.enabled && this.config.apiKey) {
        logger.info('🤖 [MODO IA PURA] Classificando exclusivamente por IA (SEM keywords)...');
        const aiResult = await this.classifyWithAI(userMessage, userContext);
        return aiResult;
      }

      // 🔧 MODO TRADICIONAL: Se IA desabilitada, usar keywords
      logger.info('🔧 [MODO TRADICIONAL] Classificando por keywords...');
      const keywordMatch = this.classifyByKeywords(userMessage);
      
      // Se keywords deram confiança aceitável, usa!
      if (keywordMatch && keywordMatch.confidence >= this.config.confidenceThreshold) {
        logger.info('✅ Classificação por keywords', keywordMatch);
        return keywordMatch;
      }

      // Se keywords não deram confiança suficiente
      if (keywordMatch && keywordMatch.confidence >= 0.3) {
        logger.info('✅ Usando keywords (confiança moderada)', keywordMatch);
        return keywordMatch;
      }

      logger.debug('🤖 Keywords sem confiança, usando fluxo tradicional');
      return null;

    } catch (error) {
      logger.error('❌ Erro na classificação de intenção:', error);
      return null; // Fallback para fluxo tradicional
    }
  }

  /**
   * Classificação simples por palavras-chave (rápido e gratuito)
   */
  classifyByKeywords(message) {
    const normalizedMsg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    let bestMatch = null;
    let highestScore = 0;

    for (const [intentKey, intentData] of Object.entries(this.intentMap)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of intentData.keywords) {
        const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedMsg.includes(normalizedKeyword)) {
          // Peso maior para keywords mais específicas
          const weight = keyword.length > 5 ? 1.5 : 1;
          score += weight;
          matchedKeywords.push(keyword);
        }
      }

      // Pontuação baseada na proporção de keywords encontradas
      // Quanto mais keywords encontrar, maior a confiança
      const confidence = Math.min(score / 2.5, 1); // Normaliza para 0-1

      if (confidence > highestScore) {
        highestScore = confidence;
        bestMatch = {
          intent: intentKey,
          flow: intentData.flow,
          confidence: confidence,
          matchedKeywords: matchedKeywords,
          method: 'keywords'
        };
      }
    }

    // Retorna mesmo com confiança baixa (para IA desabilitada poder usar)
    return highestScore >= 0.2 ? bestMatch : null;
  }

  /**
   * Classificação avançada usando API de IA
   */
  async classifyWithAI(message, userContext) {
    const provider = this.config.provider;

    if (provider === 'openai') {
      return await this.classifyWithOpenAI(message, userContext);
    } else if (provider === 'claude') {
      return await this.classifyWithClaude(message, userContext);
    } else if (provider === 'gemini') {
      return await this.classifyWithGemini(message, userContext);
    } else if (provider === 'groq') {
      return await this.classifyWithGroq(message, userContext);
    }

    throw new Error(`Provider não suportado: ${provider}`);
  }

  /**
   * Classificação usando OpenAI GPT
   */
  async classifyWithOpenAI(message, userContext) {
    const prompt = this.buildPrompt(message, userContext);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em classificar intenções de usuários para direcionar ao departamento correto. Sempre responda em formato JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const result = response.data.choices[0].message.content;
      const parsed = JSON.parse(result);

      logger.info('🤖 Classificação OpenAI:', parsed);

      return {
        intent: parsed.intent,
        flow: this.intentMap[parsed.intent]?.flow || null,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        method: 'openai',
        rawResponse: parsed
      };

    } catch (error) {
      logger.error('❌ Erro na API OpenAI:', error.message);
      throw error;
    }
  }

  /**
   * Classificação usando Google Gemini (GRÁTIS!)
   */
  async classifyWithGemini(message, userContext) {
    try {
      // Prompt minimalista para economizar tokens
      const promptText = `Classifique: "${message}"

Categorias: dp (férias/benefícios), financeiro (pagamento/salário), rh (vaga/emprego), manutencao (equipamento), comercial (contrato)

Responda só isto: {"intent":"categoria","confidence":0.9,"reasoning":"motivo"}`;

      // Usar gemini-2.5-flash (mais novo e rápido)
      const model = this.config.model === 'gemini-pro' ? 'gemini-2.5-flash' : this.config.model;
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          contents: [{
            parts: [{
              text: promptText
            }]
          }],
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE'
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048, // Máximo permitido pelo Gemini Flash
            topP: 0.95,
            topK: 20,
            candidateCount: 1,
            stopSequences: ["}"] // Parar após fechar o JSON
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      logger.info('📦 Resposta completa Gemini:', JSON.stringify(response.data, null, 2).substring(0, 500));

      if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
        logger.error('❌ Estrutura da resposta:', response.data);
        throw new Error('Resposta inválida da API Gemini');
      }

      const result = response.data.candidates[0].content.parts[0].text;
      logger.info('🤖 Resposta bruta Gemini:', result.substring(0, 200));
      
      // Limpar a resposta removendo markdown e espaços
      let cleanResult = result.trim();
      
      // Remover blocos de código markdown se existirem
      cleanResult = cleanResult.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Extrair JSON da resposta
      const jsonMatch = cleanResult.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        logger.error('❌ Resposta completa do Gemini:', result);
        throw new Error('Gemini não retornou JSON válido');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);

      logger.info('✅ Classificação Gemini:', parsed);

      return {
        intent: parsed.intent,
        flow: this.intentMap[parsed.intent]?.flow || null,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
        method: 'gemini',
        rawResponse: parsed
      };

    } catch (error) {
      logger.error('❌ Erro na API Gemini:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Classificação usando Groq (RÁPIDO e GRÁTIS!)
   */
  async classifyWithGroq(message, userContext) {
    const prompt = this.buildPrompt(message, userContext);

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: this.config.model === 'mixtral-8x7b-32768' ? 'llama-3.1-8b-instant' : this.config.model,
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em classificar intenções de usuários para direcionar ao departamento correto. Sempre responda em formato JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const result = response.data.choices[0].message.content;
      const parsed = JSON.parse(result);

      logger.info('⚡ Classificação Groq:', parsed);

      return {
        intent: parsed.intent,
        flow: this.intentMap[parsed.intent]?.flow || null,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        method: 'groq',
        rawResponse: parsed
      };

    } catch (error) {
      logger.error('❌ Erro na API Groq:', error.message);
      throw error;
    }
  }

  /**
   * Classificação usando Claude AI
   */
  async classifyWithClaude(message, userContext) {
    const prompt = this.buildPrompt(message, userContext);

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: this.config.maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const result = response.data.content[0].text;
      const parsed = JSON.parse(result);

      logger.info('🤖 Classificação Claude:', parsed);

      return {
        intent: parsed.intent,
        flow: this.intentMap[parsed.intent]?.flow || null,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        method: 'claude',
        rawResponse: parsed
      };

    } catch (error) {
      logger.error('❌ Erro na API Claude:', error.message);
      throw error;
    }
  }

  /**
   * Carrega exemplos de treinamento do arquivo
   */
  loadTrainingExamples() {
    try {
      const examplesPath = path.join(__dirname, '../../../data/training-examples.json');
      if (fs.existsSync(examplesPath)) {
        const data = fs.readFileSync(examplesPath, 'utf8');
        const json = JSON.parse(data);
        return json.examples || [];
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao carregar exemplos de treinamento:', error.message);
    }
    return [];
  }

  /**
   * Constrói o prompt para a IA com Few-Shot Learning
   */
  buildPrompt(message, userContext) {
    const intents = Object.keys(this.intentMap).join(', ');
    const trainingExamples = this.loadTrainingExamples();

    // Montar exemplos para o prompt
    let examplesText = '';
    if (trainingExamples.length > 0) {
      examplesText = trainingExamples.map((ex, i) => 
        `Exemplo ${i + 1}:\nMensagem: "${ex.message}"\nClassificação: {"intent":"${ex.intent}","confidence":0.9,"reasoning":"${ex.reasoning}"}`
      ).join('\n\n');
    }

    return `Você é um assistente virtual educado e prestativo da FG SERVICES, especializado em entender e direcionar solicitações.

🎯 SUA MISSÃO:
- Ser EDUCADO, CORDIAL e PRESTATIVO
- Entender a necessidade do usuário
- Direcioná-lo ao departamento correto
- Coletar dados essenciais quando necessário

${trainingExamples.length > 0 ? `📚 APRENDA COM ESTES EXEMPLOS:

${examplesText}

---` : ''}

📋 DADOS QUE VOCÊ DEVE COLETAR (quando necessário):
- SEMPRE: Nome completo
- SEMPRE: Email de contato
- SE FOR COLABORADOR: Contrato/Loja que trabalha

🏢 DEPARTAMENTOS DISPONÍVEIS:
- dp: Departamento Pessoal (férias, benefícios, holerite, atestados)
- financeiro: Financeiro (salário, pagamentos, adiantamentos)
- rh: Recursos Humanos (vagas, recrutamento, currículos)
- faturamento: Faturamento (notas fiscais, cobranças a clientes)
- seguranca: Segurança do Trabalho (acidentes, EPIs, CAT)
- comercial: Comercial (contratos, propostas, negociações)
- manutencao: Manutenção (equipamentos, consertos, reparos)
- logistica: Logística (entregas, transporte, veículos)
- compras: Compras (cotações, pedidos de material)
- operacional: Operacional (escalas, serviços, limpeza)
- novo_cliente: Novo Cliente (interesse em contratar)
- trabalhe_conosco: Trabalhe Conosco (vagas de emprego)
- atendimento_humano: Atendimento Humano (urgências, reclamações)

---

AGORA CLASSIFIQUE ESTA MENSAGEM:

MENSAGEM DO USUÁRIO:
"${message}"

CONTEXTO DO USUÁRIO:
${JSON.stringify(userContext, null, 2)}

INTENÇÕES DISPONÍVEIS:
${intents}

INSTRUÇÕES:
1. Seja EDUCADO e PRESTATIVO
2. Identifique a intenção do usuário
3. Atribua confiança de 0 a 1
4. Se precisar de dados (nome, email, contrato), indique no reasoning

RESPONDA APENAS COM JSON:
{
  "intent": "nome_da_intencao",
  "confidence": 0.95,
  "reasoning": "Explicação educada e prestativa"
}`;
  }

  /**
   * Carrega configurações do arquivo
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        logger.info('📂 Configurações da IA carregadas do arquivo');
        return {
          ...config,
          apiKey: process.env.AI_API_KEY || null
        };
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao carregar config da IA, usando padrão:', error.message);
    }
    
    // Configuração padrão
    return {
      enabled: false,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      apiKey: process.env.AI_API_KEY || null,
      confidenceThreshold: 0.4,
      maxTokens: 150,
      temperature: 0.3
    };
  }

  /**
   * Salva configurações no arquivo
   */
  saveConfig() {
    try {
      logger.info('💾 [INTENT-CLASSIFIER] Iniciando salvamento de configurações...');
      logger.info('💾 [INTENT-CLASSIFIER] Config path:', this.configPath);
      
      const configToSave = { ...this.config };
      delete configToSave.apiKey; // Não salvar API Key no arquivo
      
      logger.info('💾 [INTENT-CLASSIFIER] Config a salvar:', JSON.stringify(configToSave, null, 2));
      
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        logger.info('📁 [INTENT-CLASSIFIER] Criando diretório:', dir);
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
      logger.info('✅ [INTENT-CLASSIFIER] Configurações da IA salvas no arquivo com sucesso!');
      
      // Verificar se foi salvo
      const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      logger.info('🔍 [INTENT-CLASSIFIER] Verificação: config salvo no arquivo:', JSON.stringify(saved, null, 2));
      
      return true;
    } catch (error) {
      logger.error('❌ [INTENT-CLASSIFIER] Erro ao salvar config da IA:', error.message);
      logger.error('❌ [INTENT-CLASSIFIER] Stack:', error.stack);
      return false;
    }
  }

  /**
   * Atualiza configurações da IA
   */
  updateConfig(newConfig) {
    logger.info('🔧 [INTENT-CLASSIFIER] updateConfig() chamado com:', JSON.stringify(newConfig, null, 2));
    logger.info('🔧 [INTENT-CLASSIFIER] Config ANTES do merge:', JSON.stringify({ ...this.config, apiKey: this.config.apiKey ? '***' : null }, null, 2));
    
    this.config = { ...this.config, ...newConfig };
    
    logger.info('🔧 [INTENT-CLASSIFIER] Config DEPOIS do merge:', JSON.stringify({ ...this.config, apiKey: this.config.apiKey ? '***' : null }, null, 2));
    
    // Sempre manter API Key do .env
    if (process.env.AI_API_KEY) {
      this.config.apiKey = process.env.AI_API_KEY;
      logger.info('🔑 [INTENT-CLASSIFIER] API Key restaurada do .env');
    }
    
    // Salvar no arquivo
    logger.info('💾 [INTENT-CLASSIFIER] Chamando saveConfig()...');
    const saved = this.saveConfig();
    
    if (saved) {
      logger.info('✅ [INTENT-CLASSIFIER] Configurações da IA atualizadas e salvas com sucesso!');
    } else {
      logger.error('❌ [INTENT-CLASSIFIER] Falha ao salvar configurações!');
    }
    
    logger.info('⚙️ [INTENT-CLASSIFIER] Config final:', {
      ...this.config,
      apiKey: this.config.apiKey ? '***' + this.config.apiKey.slice(-6) : null
    });
  }

  /**
   * Verifica se a IA está habilitada e configurada
   */
  isEnabled() {
    return this.config.enabled && !!this.config.apiKey;
  }

  /**
   * Retorna as estatísticas de uso
   */
  getStats() {
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      hasApiKey: !!this.config.apiKey,
      threshold: this.config.confidenceThreshold,
      availableIntents: Object.keys(this.intentMap).length
    };
  }
}

// Singleton
const intentClassifier = new IntentClassifier();

module.exports = intentClassifier;


