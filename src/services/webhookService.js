const axios = require('axios');
const Webhook = require('../models/WebhookSQL');
const WebhookLog = require('../models/WebhookLogSQL');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * SERVIÇO DE WEBHOOKS
 * Gerencia disparo, retry e logging de webhooks
 */

class WebhookService {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * ==============================================
   * DISPARO DE WEBHOOKS
   * ==============================================
   */

  /**
   * Dispara webhooks para um evento
   * @param {string} eventName - Nome do evento
   * @param {object} eventData - Dados do evento
   */
  async trigger(eventName, eventData) {
    try {
      // Validar evento
      if (!Webhook.isValidEvent(eventName)) {
        logger.warn(`Evento inválido: ${eventName}`);
        return;
      }

      // Buscar webhooks que escutam este evento
      const webhooks = await Webhook.findByEvent(eventName);

      if (webhooks.length === 0) {
        logger.debug(`Nenhum webhook registrado para o evento: ${eventName}`);
        return;
      }

      logger.info(`📤 Disparando ${webhooks.length} webhook(s) para evento: ${eventName}`);

      // Disparar cada webhook
      const promises = webhooks.map(webhook => 
        this.executeWebhook(webhook, eventName, eventData)
      );

      await Promise.allSettled(promises);

      logger.info(`✅ Webhooks disparados para evento: ${eventName}`);
    } catch (error) {
      logger.error(`Erro ao disparar webhooks para evento ${eventName}:`, error);
    }
  }

  /**
   * Executa um webhook específico
   * @param {Webhook} webhook - Instância do webhook
   * @param {string} eventName - Nome do evento
   * @param {object} eventData - Dados do evento
   * @param {number} attemptNumber - Número da tentativa
   */
  async executeWebhook(webhook, eventName, eventData, attemptNumber = 1) {
    const startTime = Date.now();
    let log = null;

    try {
      // Preparar payload
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        webhookId: webhook.id,
        data: eventData
      };

      // Assinar payload
      const signature = webhook.signPayload(payload);

      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatBot-Webhook/1.0',
        'X-Webhook-Event': eventName,
        'X-Webhook-ID': webhook.id,
        ...webhook.headers
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      // Fazer requisição
      logger.info(`📡 Executando webhook ${webhook.name} (tentativa ${attemptNumber})...`);

      const response = await axios({
        method: webhook.method,
        url: webhook.url,
        data: payload,
        headers,
        timeout: webhook.timeout * 1000,
        validateStatus: null // Não lançar erro para status codes
      });

      const responseTime = Date.now() - startTime;

      // Verificar sucesso (2xx)
      const isSuccess = response.status >= 200 && response.status < 300;

      // Criar log
      log = await WebhookLog.create({
        webhookId: webhook.id,
        event: eventName,
        payload,
        requestUrl: webhook.url,
        requestMethod: webhook.method,
        requestHeaders: headers,
        responseStatus: response.status,
        responseBody: this.truncateResponseBody(response.data),
        responseHeaders: response.headers,
        responseTime,
        status: isSuccess ? 'success' : 'failure',
        error: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
        attemptNumber,
        willRetry: false,
        metadata: {
          signature,
          userAgent: headers['User-Agent']
        }
      });

      if (isSuccess) {
        // Sucesso
        await webhook.recordSuccess();
        logger.info(`✅ Webhook ${webhook.name} executado com sucesso (${responseTime}ms)`);
      } else {
        // Falha - verificar retry
        await webhook.recordFailure(new Error(`HTTP ${response.status}`));

        if (webhook.shouldRetry(attemptNumber)) {
          await this.scheduleRetry(webhook, eventName, eventData, attemptNumber, log);
        } else {
          logger.error(`❌ Webhook ${webhook.name} falhou após ${attemptNumber} tentativa(s)`);
        }
      }

      return { success: isSuccess, response, log };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isTimeout = error.code === 'ECONNABORTED';

      // Criar log de erro
      log = await WebhookLog.create({
        webhookId: webhook.id,
        event: eventName,
        payload: {
          event: eventName,
          timestamp: new Date().toISOString(),
          data: eventData
        },
        requestUrl: webhook.url,
        requestMethod: webhook.method,
        requestHeaders: webhook.headers,
        responseStatus: null,
        responseBody: null,
        responseHeaders: null,
        responseTime,
        status: isTimeout ? 'timeout' : 'failure',
        error: error.message,
        attemptNumber,
        willRetry: false
      });

      // Registrar erro/timeout
      if (isTimeout) {
        await webhook.recordTimeout();
      } else {
        await webhook.recordFailure(error);
      }

      // Verificar retry
      if (webhook.shouldRetry(attemptNumber)) {
        await this.scheduleRetry(webhook, eventName, eventData, attemptNumber, log);
      } else {
        logger.error(`❌ Webhook ${webhook.name} falhou após ${attemptNumber} tentativa(s):`, error.message);
      }

      return { success: false, error, log };
    }
  }

  /**
   * Agenda retry de um webhook
   */
  async scheduleRetry(webhook, eventName, eventData, attemptNumber, log) {
    const delay = webhook.calculateRetryDelay(attemptNumber);
    const nextRetryAt = new Date(Date.now() + delay * 1000);

    logger.info(`🔄 Agendando retry do webhook ${webhook.name} em ${delay}s`);

    // Atualizar log
    if (log) {
      await log.update({
        willRetry: true,
        nextRetryAt
      });
    }

    // Agendar retry
    setTimeout(async () => {
      logger.info(`🔄 Executando retry do webhook ${webhook.name}...`);
      await this.executeWebhook(webhook, eventName, eventData, attemptNumber + 1);
    }, delay * 1000);
  }

  /**
   * ==============================================
   * RETRY MANUAL
   * ==============================================
   */

  /**
   * Reprocessa webhooks com falhas
   */
  async retryFailedWebhooks(webhookId = null) {
    try {
      let logs;

      if (webhookId) {
        // Retry de um webhook específico
        logs = await WebhookLog.findAll({
          where: {
            webhookId,
            status: 'retry',
            willRetry: true
          },
          order: [['nextRetryAt', 'ASC']]
        });
      } else {
        // Retry de todos os webhooks pendentes
        logs = await WebhookLog.findPendingRetries();
      }

      if (logs.length === 0) {
        logger.info('Nenhum webhook pendente de retry');
        return { processed: 0 };
      }

      logger.info(`🔄 Reprocessando ${logs.length} webhook(s) com falha...`);

      let processed = 0;

      for (const log of logs) {
        try {
          const webhook = await Webhook.findByPk(log.webhookId);

          if (!webhook || !webhook.isActive) {
            continue;
          }

          await this.executeWebhook(
            webhook,
            log.event,
            log.payload.data,
            log.attemptNumber + 1
          );

          processed++;
        } catch (error) {
          logger.error(`Erro ao reprocessar webhook log ${log.id}:`, error);
        }
      }

      logger.info(`✅ ${processed} webhook(s) reprocessado(s)`);

      return { processed };
    } catch (error) {
      logger.error('Erro ao reprocessar webhooks:', error);
      throw error;
    }
  }

  /**
   * ==============================================
   * TESTE DE WEBHOOK
   * ==============================================
   */

  /**
   * Testa um webhook com payload fictício
   */
  async testWebhook(webhook) {
    const testEvent = 'system.test';
    const testData = {
      message: 'Este é um teste de webhook',
      timestamp: new Date().toISOString(),
      test: true
    };

    logger.info(`🧪 Testando webhook: ${webhook.name}`);

    const result = await this.executeWebhook(webhook, testEvent, testData);

    return {
      success: result.success,
      responseStatus: result.response?.status || null,
      responseTime: result.log?.responseTime || null,
      error: result.error?.message || null,
      log: result.log
    };
  }

  /**
   * ==============================================
   * UTILITÁRIOS
   * ==============================================
   */

  /**
   * Trunca corpo da resposta para não sobrecarregar o banco
   */
  truncateResponseBody(data, maxLength = 5000) {
    if (!data) return null;

    const str = typeof data === 'string' ? data : JSON.stringify(data);

    if (str.length <= maxLength) {
      return str;
    }

    return str.substring(0, maxLength) + '... [truncated]';
  }

  /**
   * Verifica assinatura de um payload recebido
   */
  verifySignature(payload, signature, secret) {
    if (!secret || !signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Limpa logs antigos
   */
  async cleanupOldLogs(daysOld = 30) {
    try {
      const deleted = await WebhookLog.cleanup(daysOld);
      logger.info(`🗑️ ${deleted} log(s) de webhook antigo(s) deletado(s)`);
      return deleted;
    } catch (error) {
      logger.error('Erro ao limpar logs de webhooks:', error);
      throw error;
    }
  }

  /**
   * ==============================================
   * ESTATÍSTICAS
   * ==============================================
   */

  /**
   * Obtém estatísticas globais
   */
  async getGlobalStats() {
    const [webhookStats, logStats] = await Promise.all([
      Webhook.getGlobalStats(),
      WebhookLog.getGlobalStats()
    ]);

    return {
      webhooks: webhookStats,
      logs: logStats
    };
  }

  /**
   * Obtém estatísticas de um webhook específico
   */
  async getWebhookStats(webhookId, options = {}) {
    const webhook = await Webhook.findByPk(webhookId);

    if (!webhook) {
      throw new Error('Webhook não encontrado');
    }

    const logStats = await WebhookLog.getWebhookStats(webhookId, options);

    return {
      webhook: webhook.getStats(),
      logs: logStats
    };
  }

  /**
   * Obtém top eventos
   */
  async getTopEvents(limit = 10) {
    return await WebhookLog.getTopEvents(limit);
  }

  /**
   * Obtém webhooks com mais falhas
   */
  async getTopFailures(limit = 10) {
    return await WebhookLog.getTopFailures(limit);
  }
}

// Singleton
const webhookService = new WebhookService();

module.exports = webhookService;

