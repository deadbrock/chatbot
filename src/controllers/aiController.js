/**
 * Controller para gerenciar IA e classificação de intenções
 */

const logger = require('../utils/logger');
const intentClassifier = require('../bot/services/intentClassifier');
const AIClassificationLog = require('../models/AIClassificationLog');
const { Op } = require('sequelize');

class AIController {
  /**
   * GET /api/ai/config - Obter configurações da IA
   */
  async getConfig(req, res) {
    try {
      logger.info('📊 [GET /api/ai/config] Requisição recebida');
      logger.info('📊 [GET /api/ai/config] intentClassifier.config:', JSON.stringify({...intentClassifier.config, apiKey: '***'}, null, 2));
      
      const config = {
        ...intentClassifier.config,
        apiKey: intentClassifier.config.apiKey ? '***' + intentClassifier.config.apiKey.slice(-4) : null,
        stats: intentClassifier.getStats()
      };

      logger.info('📊 [GET /api/ai/config] Config a retornar:', JSON.stringify({...config, apiKey: '***'}, null, 2));

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('❌ [GET /api/ai/config] Erro ao obter config da IA:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter configurações',
        error: error.message
      });
    }
  }

  /**
   * PUT /api/ai/config - Atualizar configurações da IA
   */
  async updateConfig(req, res) {
    try {
      logger.info('🔧 [AI-CONTROLLER] Recebendo requisição PUT /api/ai/config');
      logger.info('🔧 [AI-CONTROLLER] Body recebido:', JSON.stringify(req.body, null, 2));

      const { enabled, provider, apiKey, model, confidenceThreshold, maxTokens, temperature } = req.body;

      const updates = {};
      if (typeof enabled !== 'undefined') updates.enabled = enabled;
      if (provider) updates.provider = provider;
      if (apiKey) updates.apiKey = apiKey;
      if (model) updates.model = model;
      if (typeof confidenceThreshold !== 'undefined') updates.confidenceThreshold = parseFloat(confidenceThreshold);
      if (maxTokens) updates.maxTokens = parseInt(maxTokens);
      if (typeof temperature !== 'undefined') updates.temperature = parseFloat(temperature);

      logger.info('🔧 [AI-CONTROLLER] Updates preparados:', JSON.stringify({ ...updates, apiKey: updates.apiKey ? '***' : undefined }, null, 2));

      intentClassifier.updateConfig(updates);

      logger.info('⚙️ [AI-CONTROLLER] Configurações da IA atualizadas pelo usuário:', req.user?.username || 'desconhecido');
      logger.info('✅ [AI-CONTROLLER] Config atual após update:', JSON.stringify({ ...intentClassifier.config, apiKey: intentClassifier.config.apiKey ? '***' : null }, null, 2));

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso',
        data: {
          ...intentClassifier.config,
          apiKey: intentClassifier.config.apiKey ? '***' + intentClassifier.config.apiKey.slice(-4) : null
        }
      });
    } catch (error) {
      logger.error('❌ [AI-CONTROLLER] Erro ao atualizar config da IA:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar configurações',
        error: error.message
      });
    }
  }

  /**
   * GET /api/ai/intents - Listar todas as intenções disponíveis
   */
  async getIntents(req, res) {
    try {
      const intents = Object.entries(intentClassifier.intentMap).map(([key, data]) => ({
        id: key,
        flow: data.flow,
        keywords: data.keywords,
        keywordCount: data.keywords.length
      }));

      res.json({
        success: true,
        data: intents,
        count: intents.length
      });
    } catch (error) {
      logger.error('Erro ao listar intenções:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar intenções',
        error: error.message
      });
    }
  }

  /**
   * POST /api/ai/test - Testar classificação de uma mensagem
   */
  async testClassification(req, res) {
    try {
      const { message, userContext } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Mensagem é obrigatória'
        });
      }

      const startTime = Date.now();
      const result = await intentClassifier.classify(message, userContext || {});
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...result,
          processingTimeMs: processingTime,
          message: message,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Erro ao testar classificação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao testar classificação',
        error: error.message
      });
    }
  }

  /**
   * GET /api/ai/analytics - Obter analytics de classificações
   */
  async getAnalytics(req, res) {
    try {
      const { days = 7, groupBy = 'intent' } = req.query;
      const daysNum = parseInt(days);

      // Estatísticas gerais
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const totalClassifications = await AIClassificationLog.count({
        where: {
          createdAt: { [Op.gte]: startDate }
        }
      });

      const usedClassifications = await AIClassificationLog.count({
        where: {
          createdAt: { [Op.gte]: startDate },
          used: true
        }
      });

      const avgConfidence = await AIClassificationLog.findOne({
        attributes: [[AIClassificationLog.sequelize.fn('AVG', AIClassificationLog.sequelize.col('confidence')), 'avg']],
        where: {
          createdAt: { [Op.gte]: startDate }
        },
        raw: true
      });

      // Estatísticas por intenção
      const statsByIntent = await AIClassificationLog.getStatsByIntent(daysNum);

      // Estatísticas por método
      const statsByMethod = await AIClassificationLog.getStatsByMethod(daysNum);

      // Classificações recentes
      const recentClassifications = await AIClassificationLog.findAll({
        limit: 20,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'phone', 'userName', 'userMessage', 'intent', 'confidence', 'method', 'used', 'createdAt']
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalClassifications,
            usedClassifications,
            usageRate: totalClassifications > 0 ? (usedClassifications / totalClassifications * 100).toFixed(2) : 0,
            avgConfidence: avgConfidence?.avg ? parseFloat(avgConfidence.avg).toFixed(3) : 0,
            period: `${daysNum} dias`
          },
          byIntent: statsByIntent,
          byMethod: statsByMethod,
          recent: recentClassifications
        }
      });
    } catch (error) {
      logger.error('Erro ao obter analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter analytics',
        error: error.message
      });
    }
  }

  /**
   * GET /api/ai/training-examples - Obter exemplos de treinamento
   */
  async getTrainingExamples(req, res) {
    try {
      const fs = require('fs');
      const path = require('path');
      const examplesPath = path.join(__dirname, '../../data/training-examples.json');

      if (fs.existsSync(examplesPath)) {
        const data = fs.readFileSync(examplesPath, 'utf8');
        const json = JSON.parse(data);
        return res.json({
          success: true,
          examples: json.examples || [],
          count: (json.examples || []).length
        });
      }

      return res.json({
        success: true,
        examples: [],
        count: 0
      });
    } catch (error) {
      logger.error('❌ Erro ao obter exemplos de treinamento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter exemplos',
        error: error.message
      });
    }
  }

  /**
   * POST /api/ai/training-examples - Salvar exemplos de treinamento
   */
  async saveTrainingExamples(req, res) {
    try {
      const { examples } = req.body;

      if (!Array.isArray(examples)) {
        return res.status(400).json({
          success: false,
          message: 'Exemplos devem ser um array'
        });
      }

      const fs = require('fs');
      const path = require('path');
      const examplesPath = path.join(__dirname, '../../data/training-examples.json');

      const data = {
        examples: examples,
        instructions: "Adicione novos exemplos neste arquivo para treinar a IA. Cada exemplo deve ter: message (mensagem do usuário), intent (intenção correta), e reasoning (explicação)",
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.username || 'system'
      };

      fs.writeFileSync(examplesPath, JSON.stringify(data, null, 2));

      logger.info(`✅ ${examples.length} exemplos de treinamento salvos por ${req.user?.username || 'system'}`);

      return res.json({
        success: true,
        message: 'Exemplos salvos com sucesso',
        count: examples.length
      });
    } catch (error) {
      logger.error('❌ Erro ao salvar exemplos de treinamento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar exemplos',
        error: error.message
      });
    }
  }

  /**
   * GET /api/ai/logs - Obter logs de classificação (paginado)
   */
  async getLogs(req, res) {
    try {
      const { page = 1, limit = 50, intent, method, minConfidence } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (intent) where.intent = intent;
      if (method) where.method = method;
      if (minConfidence) where.confidence = { [Op.gte]: parseFloat(minConfidence) };

      const { rows, count } = await AIClassificationLog.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Erro ao obter logs:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs',
        error: error.message
      });
    }
  }
}

module.exports = new AIController();

