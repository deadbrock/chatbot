const { findDepartmentByKeywords } = require('../config/departments');
const logger = require('../utils/logger');

/**
 * Sistema simples de respostas baseado em palavras-chave
 * (substitui temporariamente a IA até aprovação da diretoria)
 */
class SimpleResponder {
  constructor() {
    // Padrões de resposta por categoria
    this.patterns = {
      greeting: {
        keywords: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'e ai', 'eai'],
        responses: [
          'Olá! 😊 Como posso ajudar você hoje?',
          'Oi! Estou aqui para ajudar. O que você precisa?',
          'Olá! Em que posso ser útil?'
        ]
      },
      
      thanks: {
        keywords: ['obrigado', 'obrigada', 'valeu', 'vlw', 'agradeço', 'grato', 'grata'],
        responses: [
          'Por nada! Fico feliz em ajudar! 😊',
          'Sempre às ordens! 💙',
          'Disponha! Estou aqui sempre que precisar! ✨'
        ]
      },

      goodbye: {
        keywords: ['tchau', 'até logo', 'até mais', 'falou', 'flw', 'adeus', 'xau'],
        responses: [
          'Até logo! Volte sempre! 👋',
          'Tchau! Foi um prazer ajudar! 😊',
          'Até mais! Estou aqui quando precisar! 💙'
        ]
      },

      help: {
        keywords: ['ajuda', 'socorro', 'não sei', 'perdido', 'como funciona', 'não entendi'],
        responses: [
          'Claro! Vou te ajudar. 😊\n\nDigite *menu* para ver todas as opções ou me conte o que você precisa em uma frase.',
          'Sem problemas! Estou aqui para isso.\n\nVocê pode:\n• Digitar *menu* para opções\n• Digitar *departamentos* para áreas\n• Ou me dizer o que precisa!'
        ]
      },

      complaint: {
        keywords: ['reclamação', 'reclamar', 'problema', 'insatisfeito', 'péssimo', 'horrível', 'ruim'],
        sentiment: 'negative',
        responses: [
          '😔 Sinto muito pelo inconveniente!\n\nVou te conectar com um atendente humano para resolver isso o mais rápido possível.',
          '😔 Peço desculpas pelo transtorno.\n\nVou encaminhar para um gestor que pode te ajudar melhor.'
        ]
      },

      praise: {
        keywords: ['parabéns', 'excelente', 'ótimo', 'muito bom', 'perfeito', 'adorei', 'amei'],
        sentiment: 'positive',
        responses: [
          '🤩 Que ótimo ouvir isso! Ficamos muito felizes!',
          '😊 Obrigado pelo feedback positivo! Isso nos motiva muito!',
          '💚 Que bom que você gostou! Estamos sempre buscando melhorar!'
        ]
      },

      price: {
        keywords: ['preço', 'quanto custa', 'valor', 'orçamento', 'cotação'],
        suggestDepartment: 'comercial',
        responses: [
          '💰 Para informações sobre preços e orçamentos, vou te conectar com nosso time Comercial!'
        ]
      },

      tracking: {
        keywords: ['rastrear', 'rastreamento', 'onde está', 'pedido', 'entrega', 'chegou'],
        suggestDepartment: 'logistica',
        responses: [
          '📦 Para rastreamento e informações de entrega, vou te direcionar para a Logística!'
        ]
      },

      technical: {
        keywords: ['senha', 'sistema', 'computador', 'internet', 'email', 'acesso', 'login', 'não consigo entrar'],
        suggestDepartment: 'ti',
        responses: [
          '💻 Para suporte técnico, vou te conectar com nossa equipe de TI!'
        ]
      },

      payment: {
        keywords: ['pagamento', 'pagar', 'boleto', 'fatura', 'débito', 'cobrança'],
        suggestDepartment: 'financeiro',
        responses: [
          '💰 Para questões financeiras e pagamentos, vou te direcionar ao Financeiro!'
        ]
      },

      invoice: {
        keywords: ['nota fiscal', 'nf', 'nfe', 'danfe'],
        suggestDepartment: 'faturamento',
        responses: [
          '📄 Para notas fiscais, vou te conectar com o Faturamento!'
        ]
      },

      job: {
        keywords: ['vaga', 'emprego', 'trabalho', 'currículo', 'trabalhar', 'contratar'],
        suggestDepartment: 'rh',
        responses: [
          '👥 Para vagas e oportunidades, vou te direcionar ao RH!'
        ]
      },

      maintenance: {
        keywords: ['manutenção', 'reparo', 'conserto', 'quebrado', 'defeito', 'não funciona'],
        suggestDepartment: 'manutencao',
        responses: [
          '🔧 Para manutenção e reparos, vou te conectar com a equipe de Manutenção!'
        ]
      },

      safety: {
        keywords: ['segurança', 'acidente', 'epi', 'treinamento', 'cipa'],
        suggestDepartment: 'seguranca',
        responses: [
          '🦺 Para questões de segurança do trabalho, vou te direcionar à equipe responsável!'
        ]
      }
    };
  }

  /**
   * Processar mensagem e retornar resposta
   */
  async processMessage(userId, text, context = {}) {
    try {
      const normalizedText = text.toLowerCase().trim();
      
      // 1. Verificar padrões de resposta
      for (const [category, pattern] of Object.entries(this.patterns)) {
        if (this.matchesPattern(normalizedText, pattern.keywords)) {
          const response = this.getRandomResponse(pattern.responses);
          
          // Se sugere departamento, retornar com sugestão
          if (pattern.suggestDepartment) {
            const dept = require('../config/departments').getDepartmentById(pattern.suggestDepartment);
            return {
              response,
              suggestedDepartment: dept,
              intent: category,
              sentiment: pattern.sentiment || 'neutral',
              confidence: 0.8
            };
          }

          return {
            response,
            intent: category,
            sentiment: pattern.sentiment || 'neutral',
            confidence: 0.7
          };
        }
      }

      // 2. Tentar identificar departamento por palavras-chave
      const dept = findDepartmentByKeywords(normalizedText);
      if (dept) {
        return {
          response: `Entendi que você precisa do departamento de *${dept.name}*.`,
          suggestedDepartment: dept,
          intent: 'department_request',
          sentiment: 'neutral',
          confidence: 0.75
        };
      }

      // 3. Resposta padrão quando não entende
      return {
        response: this.getDefaultResponse(context),
        intent: 'unknown',
        sentiment: 'neutral',
        confidence: 0.3
      };

    } catch (error) {
      logger.error('Erro no SimpleResponder:', error);
      return {
        response: 'Desculpe, não entendi. Pode reformular?',
        intent: 'error',
        sentiment: 'neutral',
        confidence: 0
      };
    }
  }

  /**
   * Verificar se texto contém alguma palavra-chave
   */
  matchesPattern(text, keywords) {
    return keywords.some(keyword => {
      // Busca palavra completa ou como parte de palavra maior
      const regex = new RegExp(`\\b${keyword}\\b|${keyword}`, 'i');
      return regex.test(text);
    });
  }

  /**
   * Retornar resposta aleatória do array
   */
  getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Resposta padrão quando não entende
   */
  getDefaultResponse(context) {
    const responses = [
      'Hmm, não tenho certeza se entendi.\n\nPode me explicar de outra forma? Ou digite *menu* para ver as opções! 😊',
      'Desculpe, não compreendi completamente.\n\nQue tal digitar *departamentos* para eu te direcionar melhor?',
      'Não identifiquei sua necessidade ainda.\n\nPode ser mais específico? Ou digite *menu* para as opções! 🤔'
    ];

    if (context.department) {
      responses.push(
        `Como você está no departamento de *${context.department}*, pode me dar mais detalhes sobre o que precisa?`
      );
    }

    return this.getRandomResponse(responses);
  }

  /**
   * Analisar sentimento básico
   */
  analyzeSentiment(text) {
    const positive = ['bom', 'ótimo', 'excelente', 'perfeito', 'adorei', 'amei', 'parabéns', 'obrigado'];
    const negative = ['ruim', 'péssimo', 'horrível', 'problema', 'reclamação', 'insatisfeito', 'demora'];

    const normalizedText = text.toLowerCase();
    
    const positiveCount = positive.filter(word => normalizedText.includes(word)).length;
    const negativeCount = negative.filter(word => normalizedText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}

module.exports = new SimpleResponder();
