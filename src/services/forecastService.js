const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

/**
 * ================================================================================
 * FASE 6E: SERVICE - PREVISÕES E TENDÊNCIAS (MACHINE LEARNING BÁSICO)
 * ================================================================================
 * 
 * Serviço responsável por previsões e detecção de anomalias usando:
 * - Regressão Linear simples para previsões
 * - Detecção de anomalias baseada em desvio padrão
 * - Análise de tendências
 */

class ForecastService {
  
  /**
   * Prevê volume de tickets para os próximos dias
   * @param {Object} options - Opções de previsão
   * @returns {Promise<Object>}
   */
  async forecastTicketVolume(options = {}) {
    try {
      const {
        daysToForecast = 7,
        historicalDays = 30
      } = options;

      const startDate = moment().subtract(historicalDays, 'days').toDate();
      const endDate = moment().toDate();

      // Buscar dados históricos
      const [historical] = await sequelize.query(`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as ticketCount
        FROM tickets
        WHERE createdAt BETWEEN :startDate AND :endDate
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (historical.length < 7) {
        throw new Error('Dados insuficientes para previsão (mínimo 7 dias)');
      }

      // Calcular regressão linear
      const regression = this.linearRegression(
        historical.map((h, i) => i),
        historical.map(h => h.ticketCount)
      );

      // Gerar previsões
      const forecast = [];
      for (let i = 1; i <= daysToForecast; i++) {
        const futureDate = moment().add(i, 'days');
        const predictedValue = regression.slope * (historical.length + i - 1) + regression.intercept;
        
        forecast.push({
          date: futureDate.format('YYYY-MM-DD'),
          predictedTickets: Math.max(0, Math.round(predictedValue)),
          confidence: this.calculateConfidence(regression.r2)
        });
      }

      // Calcular tendência
      const trend = regression.slope > 0.5 ? 'crescente' : (regression.slope < -0.5 ? 'decrescente' : 'estável');

      return {
        period: {
          historicalStart: moment(startDate).format('YYYY-MM-DD'),
          historicalEnd: moment(endDate).format('YYYY-MM-DD'),
          forecastDays: daysToForecast
        },
        historical: historical.map(h => ({
          date: h.date,
          actualTickets: h.ticketCount
        })),
        forecast,
        model: {
          type: 'linear_regression',
          slope: regression.slope.toFixed(4),
          intercept: regression.intercept.toFixed(4),
          r2: regression.r2.toFixed(4),
          accuracy: (regression.r2 * 100).toFixed(2) + '%'
        },
        trend: {
          direction: trend,
          avgDaily: (historical.reduce((sum, h) => sum + h.ticketCount, 0) / historical.length).toFixed(2),
          projection7Days: forecast.reduce((sum, f) => sum + f.predictedTickets, 0)
        }
      };

    } catch (error) {
      logger.error('❌ Erro ao prever volume de tickets:', error);
      throw error;
    }
  }

  /**
   * Detecta anomalias em métricas
   * @param {Object} options - Opções de detecção
   * @returns {Promise<Object>}
   */
  async detectAnomalies(options = {}) {
    try {
      const {
        metric = 'tickets', // 'tickets', 'messages', 'response_time'
        days = 30,
        threshold = 2 // Desvios padrão
      } = options;

      const startDate = moment().subtract(days, 'days').toDate();
      const endDate = moment().toDate();

      let query, label;
      
      switch (metric) {
        case 'messages':
          query = `
            SELECT 
              DATE(createdAt) as date,
              COUNT(*) as value
            FROM messages
            WHERE createdAt BETWEEN :startDate AND :endDate
            GROUP BY DATE(createdAt)
          `;
          label = 'mensagens';
          break;
          
        case 'response_time':
          query = `
            SELECT 
              DATE(t.createdAt) as date,
              AVG(
                CASE 
                  WHEN t.firstResponseAt IS NOT NULL 
                  THEN ${rawDateDiffMinutesSQL('t.firstResponseAt', 't.createdAt')}
                END
              ) as value
            FROM tickets t
            WHERE t.createdAt BETWEEN :startDate AND :endDate
              AND t.firstResponseAt IS NOT NULL
            GROUP BY DATE(t.createdAt)
          `;
          label = 'tempo de resposta (min)';
          break;
          
        default: // tickets
          query = `
            SELECT 
              DATE(createdAt) as date,
              COUNT(*) as value
            FROM tickets
            WHERE createdAt BETWEEN :startDate AND :endDate
            GROUP BY DATE(createdAt)
          `;
          label = 'tickets';
      }

      const [data] = await sequelize.query(query, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (data.length < 7) {
        throw new Error('Dados insuficientes para detecção de anomalias (mínimo 7 dias)');
      }

      // Calcular média e desvio padrão
      const values = data.map(d => parseFloat(d.value));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Detectar anomalias
      const upperBound = mean + (stdDev * threshold);
      const lowerBound = mean - (stdDev * threshold);

      const anomalies = data
        .map(d => ({
          date: d.date,
          value: parseFloat(d.value),
          isAnomaly: parseFloat(d.value) > upperBound || parseFloat(d.value) < lowerBound,
          type: parseFloat(d.value) > upperBound ? 'alto' : (parseFloat(d.value) < lowerBound ? 'baixo' : 'normal'),
          deviation: ((parseFloat(d.value) - mean) / stdDev).toFixed(2)
        }))
        .filter(d => d.isAnomaly);

      return {
        period: {
          startDate: moment(startDate).format('YYYY-MM-DD'),
          endDate: moment(endDate).format('YYYY-MM-DD'),
          days
        },
        metric: {
          name: metric,
          label
        },
        statistics: {
          mean: mean.toFixed(2),
          stdDev: stdDev.toFixed(2),
          min: Math.min(...values).toFixed(2),
          max: Math.max(...values).toFixed(2),
          upperBound: upperBound.toFixed(2),
          lowerBound: lowerBound.toFixed(2)
        },
        anomalies: anomalies.sort((a, b) => new Date(b.date) - new Date(a.date)),
        anomalyCount: anomalies.length,
        anomalyRate: ((anomalies.length / data.length) * 100).toFixed(2) + '%',
        allData: data.map(d => ({
          date: d.date,
          value: parseFloat(d.value).toFixed(2)
        }))
      };

    } catch (error) {
      logger.error('❌ Erro ao detectar anomalias:', error);
      throw error;
    }
  }

  /**
   * Analisa tendências em múltiplas métricas
   * @param {Object} options - Opções de análise
   * @returns {Promise<Object>}
   */
  async analyzeTrends(options = {}) {
    try {
      const {
        days = 30
      } = options;

      const [ticketTrend, messageTrend, satisfactionTrend] = await Promise.all([
        this.forecastTicketVolume({ historicalDays: days, daysToForecast: 7 }),
        this.calculateMetricTrend('messages', days),
        this.calculateMetricTrend('satisfaction', days)
      ]);

      return {
        period: {
          days,
          startDate: moment().subtract(days, 'days').format('YYYY-MM-DD'),
          endDate: moment().format('YYYY-MM-DD')
        },
        trends: {
          tickets: {
            direction: ticketTrend.trend.direction,
            avgDaily: ticketTrend.trend.avgDaily,
            forecast7Days: ticketTrend.trend.projection7Days,
            model: ticketTrend.model
          },
          messages: messageTrend,
          satisfaction: satisfactionTrend
        },
        summary: this.generateTrendSummary({
          tickets: ticketTrend,
          messages: messageTrend,
          satisfaction: satisfactionTrend
        })
      };

    } catch (error) {
      logger.error('❌ Erro ao analisar tendências:', error);
      throw error;
    }
  }

  /**
   * Calcula tendência para uma métrica específica
   * @param {String} metric - Métrica para análise
   * @param {Number} days - Dias históricos
   * @returns {Promise<Object>}
   */
  async calculateMetricTrend(metric, days) {
    try {
      let query;
      
      switch (metric) {
        case 'messages':
          query = `
            SELECT 
              DATE(createdAt) as date,
              COUNT(*) as value
            FROM messages
            WHERE createdAt >= date('now', '-${days} days')
            GROUP BY DATE(createdAt)
            ORDER BY date ASC
          `;
          break;
          
        case 'satisfaction':
          query = `
            SELECT 
              DATE(r.createdAt) as date,
              AVG(r.rating) as value
            FROM ratings r
            WHERE r.createdAt >= date('now', '-${days} days')
            GROUP BY DATE(r.createdAt)
            ORDER BY date ASC
          `;
          break;
          
        default:
          throw new Error('Métrica inválida');
      }

      const [data] = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT
      });

      if (data.length < 2) {
        return {
          direction: 'insuficiente',
          change: 0,
          avgValue: 0
        };
      }

      const values = data.map(d => parseFloat(d.value));
      const firstValue = values[0];
      const lastValue = values[values.length - 1];
      const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const change = ((lastValue - firstValue) / firstValue * 100).toFixed(2);

      return {
        direction: change > 5 ? 'crescente' : (change < -5 ? 'decrescente' : 'estável'),
        change: change + '%',
        avgValue: avgValue.toFixed(2),
        firstValue: firstValue.toFixed(2),
        lastValue: lastValue.toFixed(2)
      };

    } catch (error) {
      logger.error(`❌ Erro ao calcular tendência de ${metric}:`, error);
      throw error;
    }
  }

  /**
   * Gera resumo das tendências
   * @param {Object} trends - Tendências calculadas
   * @returns {Array}
   */
  generateTrendSummary(trends) {
    const summary = [];

    if (trends.tickets) {
      summary.push({
        metric: 'Tickets',
        trend: trends.tickets.trend.direction,
        insight: `Volume de tickets está ${trends.tickets.trend.direction}. Média diária: ${trends.tickets.trend.avgDaily}`
      });
    }

    if (trends.messages) {
      summary.push({
        metric: 'Mensagens',
        trend: trends.messages.direction,
        insight: `Volume de mensagens ${trends.messages.change} nos últimos dias`
      });
    }

    if (trends.satisfaction) {
      summary.push({
        metric: 'Satisfação',
        trend: trends.satisfaction.direction,
        insight: `Satisfação média: ${trends.satisfaction.avgValue} (${trends.satisfaction.change})`
      });
    }

    return summary;
  }

  /**
   * Implementa regressão linear simples
   * @param {Array} x - Valores X
   * @param {Array} y - Valores Y
   * @returns {Object}
   */
  linearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

    // Calcular slope (inclinação) e intercept (intercepto)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calcular R² (coeficiente de determinação)
    const meanY = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
    const ssResidual = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    return { slope, intercept, r2 };
  }

  /**
   * Calcula confiança da previsão baseada em R²
   * @param {Number} r2 - Coeficiente R²
   * @returns {String}
   */
  calculateConfidence(r2) {
    if (r2 >= 0.8) return 'alta';
    if (r2 >= 0.6) return 'média';
    if (r2 >= 0.4) return 'baixa';
    return 'muito baixa';
  }
}

module.exports = new ForecastService();

