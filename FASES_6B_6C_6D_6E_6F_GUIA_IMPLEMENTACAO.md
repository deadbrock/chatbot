# 📊 GUIA DE IMPLEMENTAÇÃO - FASES 6B, 6C, 6D, 6E, 6F

## 🎯 VISÃO GERAL

Este guia fornece o roadmap completo para implementar as fases restantes de Analytics e BI.

**Status Atual:** Fases 6B, 6C, 6D, 6E, 6F - Planejadas
**Modelos Criados:** AgentPerformanceSQL.js, QueuePerformanceSQL.js

---

## 📦 FASE 6B - ANÁLISE DE ATENDIMENTO (20% Completo)

### **✅ JÁ IMPLEMENTADO:**
- AgentPerformanceSQL.js (400 linhas)
- QueuePerformanceSQL.js (350 linhas)

### **⏳ PRÓXIMOS PASSOS:**

#### **1. Performance Service (performanceService.js)**

```javascript
class PerformanceService {
  // Calcular performance de agente
  async calculateAgentPerformance(userId, startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: { userId, createdAt: { [Op.between]: [startDate, endDate] }}
    });
    
    return {
      totalTickets: tickets.length,
      closedTickets: tickets.filter(t => t.status === 'closed').length,
      avgResolutionTime: await this.calculateAvgResolution(tickets),
      avgFirstResponseTime: await this.calculateAvgFirstResponse(tickets),
      npsScore: await this.calculateAgentNPS(userId, startDate, endDate),
      ticketsPerHour: tickets.length / hoursOnline,
      // ... mais métricas
    };
  }
  
  // Ranking de agentes
  async getAgentsRanking(startDate, endDate, sortBy = 'totalTickets') {
    const agents = await User.findAll({ where: { role: 'agent' }});
    const performances = await Promise.all(
      agents.map(a => this.calculateAgentPerformance(a.id, startDate, endDate))
    );
    return performances.sort((a, b) => b[sortBy] - a[sortBy]);
  }
  
  // Identificar sobrecarregados
  async getOverloadedAgents(threshold = 15) {
    const agents = await this.getAgentsRanking(
      moment().startOf('week'),
      moment().endOf('week')
    );
    return agents.filter(a => a.ticketsPerHour > threshold);
  }
  
  // Performance de fila
  async calculateQueuePerformance(queueId, startDate, endDate) {
    // Similar ao agente, mas para filas
  }
}
```

#### **2. Performance Controller (performanceController.js)**

```javascript
// GET /api/performance/agents
exports.getAgentsPerformance = async (req, res) => {
  const { startDate, endDate, sortBy } = req.query;
  const ranking = await performanceService.getAgentsRanking(
    new Date(startDate), new Date(endDate), sortBy
  );
  success(res, ranking);
};

// GET /api/performance/agents/:id
exports.getAgentPerformance = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  const performance = await performanceService.calculateAgentPerformance(
    id, new Date(startDate), new Date(endDate)
  );
  success(res, performance);
};

// GET /api/performance/workload
exports.getWorkloadAnalysis = async (req, res) => {
  const overloaded = await performanceService.getOverloadedAgents();
  const idle = await performanceService.getIdleAgents();
  success(res, { overloaded, idle, recommendations: [...] });
};
```

#### **3. Frontend (performanceAnalysisView.js)**

```javascript
// Gráficos:
// 1. Ranking de Agentes (Horizontal Bar)
// 2. Evolução Individual (Line)
// 3. Comparação de Agentes (Radar)
// 4. Distribuição de Carga (Heatmap)
// 5. Volume por Fila (Bar)
// 6. SLA por Fila (Gauge)

async function renderAgentRanking(agents) {
  const ctx = document.getElementById('agentRankingChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: agents.map(a => a.name),
      datasets: [{
        label: 'Tickets Atendidos',
        data: agents.map(a => a.totalTickets),
        backgroundColor: 'rgba(75, 192, 192, 0.7)'
      }]
    },
    options: { indexAxis: 'y' }
  });
}
```

**Tempo Estimado:** 4-6 horas

---

## 📦 FASE 6C - ANÁLISE DE SATISFAÇÃO

### **OBJETIVO:**
Análise detalhada de NPS, feedback e satisfação do cliente.

### **COMPONENTES:**

#### **1. Service (satisfactionService.js)**

```javascript
class SatisfactionService {
  // NPS Detalhado
  async getDetailedNPS(startDate, endDate) {
    const ratings = await Rating.findAll({
      where: { createdAt: { [Op.between]: [startDate, endDate] }}
    });
    
    const promoters = ratings.filter(r => r.score >= 9).length;
    const detractors = ratings.filter(r => r.score <= 6).length;
    const nps = ((promoters - detractors) / ratings.length) * 100;
    
    return {
      nps,
      total: ratings.length,
      promoters,
      passives: ratings.filter(r => r.score >= 7 && r.score <= 8).length,
      detractors,
      distribution: this.getScoreDistribution(ratings),
      evolution: this.getEvolution(ratings),
      byAgent: this.getByAgent(ratings),
      byQueue: this.getByQueue(ratings)
    };
  }
  
  // Word Cloud
  async generateWordCloud(startDate, endDate) {
    const ratings = await Rating.findAll({
      where: { 
        createdAt: { [Op.between]: [startDate, endDate] },
        comment: { [Op.ne]: null }
      }
    });
    
    const allComments = ratings.map(r => r.comment).join(' ');
    const words = this.extractWords(allComments);
    const frequency = this.calculateFrequency(words);
    
    return frequency;
  }
  
  // Análise de Sentimento
  async analyzeSentiment(startDate, endDate) {
    const ratings = await Rating.findAll({
      where: { 
        createdAt: { [Op.between]: [startDate, endDate] },
        comment: { [Op.ne]: null }
      }
    });
    
    const sentiments = ratings.map(r => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      sentiment: this.detectSentiment(r.comment)
    }));
    
    return sentiments;
  }
  
  extractWords(text) {
    const stopwords = ['o', 'a', 'de', 'para', 'com', 'em', 'que'];
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.includes(w));
  }
  
  calculateFrequency(words) {
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word, count]) => ({ word, count }));
  }
}
```

#### **2. Controller (satisfactionController.js)**

```javascript
// GET /api/satisfaction/nps
exports.getDetailedNPS = async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await satisfactionService.getDetailedNPS(
    new Date(startDate), new Date(endDate)
  );
  success(res, data);
};

// GET /api/satisfaction/wordcloud
exports.getWordCloud = async (req, res) => {
  const { startDate, endDate } = req.query;
  const wordcloud = await satisfactionService.generateWordCloud(
    new Date(startDate), new Date(endDate)
  );
  success(res, wordcloud);
};

// GET /api/satisfaction/feedback
exports.getFeedbackAnalysis = async (req, res) => {
  const { startDate, endDate, filter } = req.query;
  // Listar feedbacks com filtros (score, sentimento, palavra-chave)
  const feedback = await satisfactionService.getFeedback(startDate, endDate, filter);
  success(res, feedback);
};
```

#### **3. Frontend (satisfactionAnalysisView.js)**

```javascript
// Gráficos:
// 1. NPS Gauge
// 2. Distribuição de Notas (0-10) - Bar
// 3. Evolução Temporal - Line
// 4. Word Cloud - Canvas/SVG
// 5. Sentimento por Período - Pie
// 6. NPS por Agente - Horizontal Bar
// 7. NPS por Fila - Horizontal Bar

// Word Cloud com D3.js ou biblioteca específica
async function renderWordCloud(words) {
  const container = document.getElementById('wordCloudContainer');
  
  // Usar biblioteca como d3-cloud ou wordcloud
  const cloud = wordcloud(container, {
    list: words.map(w => [w.word, w.count]),
    gridSize: 16,
    weightFactor: 10,
    fontFamily: 'Arial',
    color: 'random-dark',
    rotateRatio: 0.5,
    backgroundColor: '#fff'
  });
}

// NPS Gauge
function renderNPSGauge(npsScore) {
  const ctx = document.getElementById('npsGaugeChart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [npsScore + 100, 200 - (npsScore + 100)],
        backgroundColor: ['#4CAF50', '#e0e0e0']
      }]
    },
    options: {
      circumference: 180,
      rotation: 270,
      cutout: '75%'
    }
  });
}
```

**Tempo Estimado:** 5-6 horas

---

## 📦 FASE 6D - ANÁLISE DE CONVERSAS

### **OBJETIVO:**
Análise de sentimento, tópicos e métricas de conversação.

### **COMPONENTES:**

#### **1. Service (conversationService.js)**

```javascript
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class ConversationService {
  // Análise de Sentimento
  async analyzeConversationSentiment(ticketId) {
    const messages = await ChatMessage.findAll({
      where: { ticketId },
      order: [['timestamp', 'ASC']]
    });
    
    const analysis = messages.map(msg => {
      const result = sentiment.analyze(msg.body);
      return {
        messageId: msg.id,
        body: msg.body,
        score: result.score,
        comparative: result.comparative,
        sentiment: result.score > 0 ? 'positive' : 
                   result.score < 0 ? 'negative' : 'neutral'
      };
    });
    
    return {
      messages: analysis,
      overall: {
        avgScore: analysis.reduce((sum, a) => sum + a.score, 0) / analysis.length,
        sentiment: this.classifyOverallSentiment(analysis)
      }
    };
  }
  
  // Tópicos Frequentes
  async extractTopics(startDate, endDate) {
    const messages = await ChatMessage.findAll({
      where: { 
        timestamp: { [Op.between]: [startDate, endDate] },
        fromMe: false
      }
    });
    
    const allText = messages.map(m => m.body).join(' ');
    const keywords = this.extractKeywords(allText);
    
    return keywords;
  }
  
  // Métricas de Conversa
  async getConversationMetrics(startDate, endDate) {
    const tickets = await Ticket.findAll({
      where: { createdAt: { [Op.between]: [startDate, endDate] }},
      include: [{ model: ChatMessage, as: 'messages' }]
    });
    
    return {
      avgFirstResponseTime: this.calculateAvgFirstResponse(tickets),
      avgMessagesPerConversation: this.calculateAvgMessages(tickets),
      avgConversationDuration: this.calculateAvgDuration(tickets),
      abandonRate: this.calculateAbandonRate(tickets)
    };
  }
  
  extractKeywords(text) {
    // Implementar TF-IDF ou usar biblioteca
    const words = text.toLowerCase().split(/\s+/);
    const frequency = {};
    words.forEach(w => frequency[w] = (frequency[w] || 0) + 1);
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }
}
```

#### **2. Controller (conversationController.js)**

```javascript
// GET /api/conversations/sentiment/:ticketId
exports.getSentiment = async (req, res) => {
  const { ticketId } = req.params;
  const analysis = await conversationService.analyzeConversationSentiment(ticketId);
  success(res, analysis);
};

// GET /api/conversations/topics
exports.getTopics = async (req, res) => {
  const { startDate, endDate } = req.query;
  const topics = await conversationService.extractTopics(
    new Date(startDate), new Date(endDate)
  );
  success(res, topics);
};

// GET /api/conversations/metrics
exports.getMetrics = async (req, res) => {
  const { startDate, endDate } = req.query;
  const metrics = await conversationService.getConversationMetrics(
    new Date(startDate), new Date(endDate)
  );
  success(res, metrics);
};
```

**Dependência:**
```bash
npm install sentiment natural
```

**Tempo Estimado:** 4-5 horas

---

## 📦 FASE 6E - PREVISÕES E TENDÊNCIAS

### **OBJETIVO:**
Previsão de demanda usando ML básico e detecção de tendências.

### **COMPONENTES:**

#### **1. Service (forecastService.js)**

```javascript
const regression = require('regression');

class ForecastService {
  // Previsão de Demanda
  async predictDemand(daysAhead = 7) {
    const snapshots = await AnalyticsSnapshot.findAll({
      where: {
        date: {
          [Op.gte]: moment().subtract(90, 'days').format('YYYY-MM-DD')
        }
      },
      order: [['date', 'ASC']]
    });
    
    // Preparar dados para regressão
    const data = snapshots.map((s, index) => [index, s.totalTickets]);
    
    // Calcular regressão linear
    const result = regression.linear(data);
    
    // Prever próximos dias
    const predictions = [];
    for (let i = 0; i < daysAhead; i++) {
      const day = data.length + i;
      const predicted = result.predict(day)[1];
      predictions.push({
        date: moment().add(i, 'days').format('YYYY-MM-DD'),
        predicted: Math.round(predicted),
        confidence: result.r2
      });
    }
    
    return {
      equation: result.equation,
      r2: result.r2,
      predictions
    };
  }
  
  // Detecção de Tendências
  async detectTrends(metric = 'totalTickets') {
    const snapshots = await AnalyticsSnapshot.findAll({
      where: {
        date: {
          [Op.gte]: moment().subtract(30, 'days').format('YYYY-MM-DD')
        }
      },
      order: [['date', 'ASC']]
    });
    
    const values = snapshots.map(s => s[metric]);
    
    return {
      trend: this.calculateTrend(values),
      seasonality: this.detectSeasonality(values),
      anomalies: this.detectAnomalies(values)
    };
  }
  
  calculateTrend(values) {
    const first = values.slice(0, 10).reduce((a, b) => a + b) / 10;
    const last = values.slice(-10).reduce((a, b) => a + b) / 10;
    const change = ((last - first) / first) * 100;
    
    return {
      direction: change > 5 ? 'growing' : change < -5 ? 'declining' : 'stable',
      percentage: change.toFixed(2)
    };
  }
  
  detectSeasonality(values) {
    // Análise simples de padrões semanais
    const byWeekday = Array(7).fill(0);
    values.forEach((v, i) => {
      const weekday = i % 7;
      byWeekday[weekday] += v;
    });
    
    const avg = byWeekday.reduce((a, b) => a + b) / 7;
    const peakDay = byWeekday.indexOf(Math.max(...byWeekday));
    
    return { byWeekday, peakDay, hasSeasonality: Math.max(...byWeekday) > avg * 1.5 };
  }
  
  detectAnomalies(values) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
    
    return values
      .map((v, i) => ({ index: i, value: v, zScore: (v - mean) / stdDev }))
      .filter(item => Math.abs(item.zScore) > 2);
  }
}
```

**Dependência:**
```bash
npm install regression
```

**Tempo Estimado:** 5-6 horas

---

## 📦 FASE 6F - RELATÓRIOS PERSONALIZADOS

### **OBJETIVO:**
Report Builder com drag & drop, campos customizados e templates.

### **COMPONENTES:**

#### **1. Modelo (CustomReportSQL.js)**

```javascript
const CustomReport = sequelize.define('CustomReport', {
  id: UUID,
  name: STRING,
  description: TEXT,
  template: ENUM('blank', 'executive', 'performance', 'satisfaction'),
  
  // Configuração do relatório
  config: JSON,
  /* {
    fields: ['totalTickets', 'npsScore', ...],
    filters: [{ field: 'status', operator: 'equals', value: 'closed' }],
    groupBy: ['queue', 'agent'],
    orderBy: [{ field: 'totalTickets', direction: 'DESC' }],
    charts: [
      { type: 'bar', field: 'totalTickets', groupBy: 'agent' },
      { type: 'line', field: 'npsScore', timeRange: '30d' }
    ]
  } */
  
  layout: JSON,
  /* {
    sections: [
      { id: 1, type: 'header', content: { title: '...' }},
      { id: 2, type: 'kpi', fields: ['...'] },
      { id: 3, type: 'chart', chartId: 1 },
      { id: 4, type: 'table', fields: ['...'] }
    ]
  } */
  
  schedule: JSON,
  recipients: JSON,
  format: ENUM('pdf', 'excel', 'html'),
  isPublic: BOOLEAN,
  createdBy: UUID
});
```

#### **2. Report Builder Frontend**

```javascript
// Drag & Drop com SortableJS ou React DnD
class ReportBuilder {
  constructor() {
    this.sections = [];
    this.fields = [];
    this.charts = [];
  }
  
  addSection(type) {
    const section = {
      id: uuidv4(),
      type, // 'header', 'kpi', 'chart', 'table', 'text'
      config: {}
    };
    this.sections.push(section);
    this.render();
  }
  
  addField(sectionId, field) {
    const section = this.sections.find(s => s.id === sectionId);
    if (!section.config.fields) section.config.fields = [];
    section.config.fields.push(field);
    this.render();
  }
  
  addChart(sectionId, chartConfig) {
    const chart = {
      id: uuidv4(),
      ...chartConfig
    };
    this.charts.push(chart);
    
    const section = this.sections.find(s => s.id === sectionId);
    section.config.chartId = chart.id;
    this.render();
  }
  
  save() {
    const report = {
      name: this.name,
      config: { fields: this.fields, charts: this.charts },
      layout: { sections: this.sections }
    };
    
    return apiFetch('/api/custom-reports', {
      method: 'POST',
      body: JSON.stringify(report)
    });
  }
  
  render() {
    // Renderizar preview do relatório
  }
}
```

**Tempo Estimado:** 8-10 horas

---

## 📊 RESUMO DE IMPLEMENTAÇÃO

### **Ordem Sugerida:**

1. **Fase 6B** (4-6h) - Completa análise de performance
2. **Fase 6C** (5-6h) - Adiciona insights de satisfação
3. **Fase 6D** (4-5h) - Análise de conversas
4. **Fase 6E** (5-6h) - Previsões com ML
5. **Fase 6F** (8-10h) - Report Builder avançado

**Tempo Total Estimado:** 26-33 horas

### **Dependências Adicionais:**

```bash
npm install sentiment natural regression d3-cloud
```

### **Prioridade:**

- **Alta:** 6B (Performance é crítico)
- **Média:** 6C, 6D (Insights valiosos)
- **Baixa:** 6E, 6F (Refinamentos avançados)

---

## 🎯 SISTEMA APÓS IMPLEMENTAÇÃO

Com todas as fases implementadas, o sistema terá:

- ✅ 16 fases completas
- ✅ ~35.000 linhas de código
- ✅ 200+ endpoints
- ✅ 50+ gráficos
- ✅ ML básico integrado
- ✅ Report Builder customizável
- ✅ Analytics 360° completo

---

**🎉 GUIA COMPLETO PARA FINALIZAÇÃO DO PROJETO! 🎉**

