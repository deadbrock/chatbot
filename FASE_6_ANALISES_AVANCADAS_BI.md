# 📊 FASE 6 - ANÁLISES AVANÇADAS E BUSINESS INTELLIGENCE

## 📋 **OBJETIVO DA FASE 6**

Implementar sistema completo de análises avançadas, dashboards interativos, relatórios personalizados e Business Intelligence para tomada de decisões estratégicas.

---

## 🎯 **ESCOPO DA FASE 6**

### **Módulos a Implementar:**

#### **6A - Dashboard Executivo** 📈
- Overview geral do negócio
- KPIs principais
- Gráficos interativos
- Comparativos (período anterior, meta)
- Filtros avançados (período, fila, agente)
- Exportação de dados

#### **6B - Análise de Atendimento** 👥
- Performance por agente
- Performance por fila
- Tempo médio de atendimento
- Taxa de resolução
- Heatmap de horários
- Análise de carga de trabalho

#### **6C - Análise de Satisfação** ⭐
- NPS detalhado
- Análise de feedback
- Word cloud de comentários
- Evolução temporal
- Comparativo por setor
- Detratores x Promotores

#### **6D - Análise de Conversas** 💬
- Análise de sentimento
- Tópicos mais frequentes
- Palavras-chave
- Tempo de resposta
- Taxa de abandono
- Primeira resposta

#### **6E - Previsões e Tendências** 🔮
- Previsão de demanda
- Tendências de tickets
- Sazonalidade
- Machine Learning básico
- Alertas preditivos

#### **6F - Relatórios Personalizados** 📄
- Builder de relatórios
- Campos customizados
- Agendamento automático
- Múltiplos formatos (PDF, Excel, CSV)
- Compartilhamento

---

## 📦 **FASE 6A - DASHBOARD EXECUTIVO**

### **Status:** 🔨 **EM IMPLEMENTAÇÃO**

### **Componentes:**

#### **1. Modelo de Analytics**

**Modelo: `AnalyticsSnapshotSQL.js`**
```javascript
{
  id: UUID,
  date: DATE, // Data do snapshot
  period: ENUM('hourly', 'daily', 'weekly', 'monthly'),
  
  // Tickets
  totalTickets: INTEGER,
  openTickets: INTEGER,
  closedTickets: INTEGER,
  avgResolutionTime: INTEGER, // em minutos
  avgResponseTime: INTEGER, // em minutos
  
  // Mensagens
  totalMessages: INTEGER,
  receivedMessages: INTEGER,
  sentMessages: INTEGER,
  
  // Contatos
  totalContacts: INTEGER,
  newContacts: INTEGER,
  activeContacts: INTEGER,
  
  // Satisfação
  npsScore: FLOAT,
  totalRatings: INTEGER,
  promoters: INTEGER,
  passives: INTEGER,
  detractors: INTEGER,
  
  // Agentes
  activeAgents: INTEGER,
  avgAgentLoad: FLOAT, // tickets por agente
  
  // Conversão
  conversionRate: FLOAT,
  
  // JSON detalhado
  breakdown: JSON, // Breakdown por fila, agente, etc.
  metadata: JSON
}
```

#### **2. Analytics Service**

**Service: `analyticsService.js`**
```javascript
class AnalyticsService {
  // Gerar snapshot diário
  async generateDailySnapshot(date) {
    const startOfDay = moment(date).startOf('day');
    const endOfDay = moment(date).endOf('day');
    
    const data = {
      date: startOfDay.toDate(),
      period: 'daily',
      
      // Calcular métricas de tickets
      totalTickets: await this.countTickets(startOfDay, endOfDay),
      openTickets: await this.countOpenTickets(endOfDay),
      closedTickets: await this.countClosedTickets(startOfDay, endOfDay),
      avgResolutionTime: await this.calculateAvgResolutionTime(startOfDay, endOfDay),
      avgResponseTime: await this.calculateAvgResponseTime(startOfDay, endOfDay),
      
      // Calcular métricas de mensagens
      totalMessages: await this.countMessages(startOfDay, endOfDay),
      receivedMessages: await this.countReceivedMessages(startOfDay, endOfDay),
      sentMessages: await this.countSentMessages(startOfDay, endOfDay),
      
      // Calcular métricas de contatos
      totalContacts: await this.countAllContacts(endOfDay),
      newContacts: await this.countNewContacts(startOfDay, endOfDay),
      activeContacts: await this.countActiveContacts(startOfDay, endOfDay),
      
      // Calcular NPS
      npsScore: await this.calculateNPS(startOfDay, endOfDay),
      totalRatings: await this.countRatings(startOfDay, endOfDay),
      promoters: await this.countPromoters(startOfDay, endOfDay),
      passives: await this.countPassives(startOfDay, endOfDay),
      detractors: await this.countDetractors(startOfDay, endOfDay),
      
      // Calcular métricas de agentes
      activeAgents: await this.countActiveAgents(startOfDay, endOfDay),
      avgAgentLoad: await this.calculateAvgAgentLoad(startOfDay, endOfDay),
      
      // Breakdown detalhado
      breakdown: await this.generateBreakdown(startOfDay, endOfDay)
    };
    
    return await AnalyticsSnapshot.create(data);
  }
  
  // Obter dados do dashboard
  async getDashboardData(startDate, endDate, filters = {}) {
    const snapshots = await AnalyticsSnapshot.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate]
        },
        period: filters.period || 'daily'
      },
      order: [['date', 'ASC']]
    });
    
    return {
      timeline: snapshots,
      summary: this.calculateSummary(snapshots),
      trends: this.calculateTrends(snapshots),
      comparison: await this.calculateComparison(startDate, endDate)
    };
  }
  
  // KPIs principais
  async getMainKPIs(startDate, endDate) {
    return {
      totalTickets: await this.countTickets(startDate, endDate),
      avgResolutionTime: await this.calculateAvgResolutionTime(startDate, endDate),
      satisfactionScore: await this.calculateNPS(startDate, endDate),
      conversionRate: await this.calculateConversionRate(startDate, endDate),
      activeUsers: await this.countActiveAgents(startDate, endDate),
      growthRate: await this.calculateGrowthRate(startDate, endDate)
    };
  }
  
  // Breakdown por dimensão
  async getBreakdown(dimension, startDate, endDate) {
    switch (dimension) {
      case 'queue':
        return await this.breakdownByQueue(startDate, endDate);
      case 'agent':
        return await this.breakdownByAgent(startDate, endDate);
      case 'status':
        return await this.breakdownByStatus(startDate, endDate);
      case 'hour':
        return await this.breakdownByHour(startDate, endDate);
      case 'weekday':
        return await this.breakdownByWeekday(startDate, endDate);
      default:
        throw new Error('Invalid dimension');
    }
  }
}
```

#### **3. Dashboard Controller**

**Controller: `dashboardController.js`**
```javascript
// GET /api/dashboard/executive
exports.getExecutiveDashboard = async (req, res) => {
  try {
    const { startDate, endDate, ...filters } = req.query;
    
    const data = await analyticsService.getDashboardData(
      startDate || moment().subtract(30, 'days'),
      endDate || moment(),
      filters
    );
    
    success(res, data);
  } catch (error) {
    fail(res, error.message, 500);
  }
};

// GET /api/dashboard/kpis
exports.getKPIs = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const kpis = await analyticsService.getMainKPIs(
      startDate || moment().subtract(30, 'days'),
      endDate || moment()
    );
    
    success(res, kpis);
  } catch (error) {
    fail(res, error.message, 500);
  }
};

// GET /api/dashboard/breakdown/:dimension
exports.getBreakdown = async (req, res) => {
  try {
    const { dimension } = req.params;
    const { startDate, endDate } = req.query;
    
    const breakdown = await analyticsService.getBreakdown(
      dimension,
      startDate || moment().subtract(30, 'days'),
      endDate || moment()
    );
    
    success(res, breakdown);
  } catch (error) {
    fail(res, error.message, 500);
  }
};

// GET /api/dashboard/trends
exports.getTrends = async (req, res) => {
  try {
    const { metric, startDate, endDate } = req.query;
    
    const trends = await analyticsService.getTrends(
      metric,
      startDate || moment().subtract(90, 'days'),
      endDate || moment()
    );
    
    success(res, trends);
  } catch (error) {
    fail(res, error.message, 500);
  }
};

// GET /api/dashboard/comparison
exports.getComparison = async (req, res) => {
  try {
    const { period1Start, period1End, period2Start, period2End } = req.query;
    
    const comparison = await analyticsService.comparePerformance(
      { start: period1Start, end: period1End },
      { start: period2Start, end: period2End }
    );
    
    success(res, comparison);
  } catch (error) {
    fail(res, error.message, 500);
  }
};
```

#### **4. Frontend Dashboard**

**View: `executiveDashboardView.js`**
```javascript
// Cards de KPIs com Chart.js
// Gráficos de linha, barra, pizza
// Tabelas interativas
// Filtros de período
// Exportação de dados
// Refresh automático
```

---

## 📦 **FASE 6B - ANÁLISE DE ATENDIMENTO**

### **Componentes:**

#### **1. Performance de Agentes**

**Métricas:**
- Total de tickets atendidos
- Tempo médio de primeira resposta
- Tempo médio de resolução
- Taxa de resolução no primeiro contato
- Tickets ativos/fechados
- Horas online
- Taxa de satisfação (NPS por agente)
- Produtividade (tickets/hora)

**Visualizações:**
- Ranking de agentes
- Gráfico de performance individual
- Comparativo entre agentes
- Evolução temporal
- Heatmap de atividade

#### **2. Performance de Filas**

**Métricas:**
- Tickets por fila
- Tempo médio de espera
- Taxa de abandono
- SLA cumprido/estourado
- Taxa de transferência
- Volume por horário

**Visualizações:**
- Dashboard por fila
- Gráfico de volume
- Análise de SLA
- Distribuição de carga

#### **3. Heatmap de Atividade**

**Análise:**
- Tickets por hora do dia
- Tickets por dia da semana
- Picos de demanda
- Horários ociosos
- Recomendações de escala

---

## 📦 **FASE 6C - ANÁLISE DE SATISFAÇÃO**

### **Componentes:**

#### **1. NPS Detalhado**

**Análises:**
- NPS geral e por período
- Breakdown por fila/agente/tag
- Evolução temporal (gráfico de linha)
- Distribuição de notas (0-10)
- Percentual de Promotores/Passivos/Detratores

**Visualizações:**
- Gauge de NPS
- Gráfico de distribuição
- Timeline de evolução
- Tabela de breakdown

#### **2. Análise de Feedback**

**Recursos:**
- Lista de todos os comentários
- Filtros por nota
- Busca por palavra-chave
- Sentimento automático (positivo/negativo/neutro)
- Categorização de feedback

#### **3. Word Cloud**

**Geração:**
- Extrair palavras dos comentários
- Remover stopwords
- Calcular frequência
- Gerar nuvem visual
- Filtrar por período/nota

---

## 📦 **FASE 6D - ANÁLISE DE CONVERSAS**

### **Componentes:**

#### **1. Análise de Sentimento**

**Biblioteca: sentiment.js ou API externa**

```javascript
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

async function analyzeConversation(messages) {
  const scores = messages.map(msg => {
    const result = sentiment.analyze(msg.body);
    return {
      messageId: msg.id,
      score: result.score,
      comparative: result.comparative,
      sentiment: result.score > 0 ? 'positive' : result.score < 0 ? 'negative' : 'neutral'
    };
  });
  
  return {
    messages: scores,
    overall: {
      avgScore: scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
      sentiment: this.classifySentiment(scores)
    }
  };
}
```

#### **2. Tópicos Frequentes**

**Análise:**
- Extração de palavras-chave
- Clustering de mensagens similares
- Identificação de temas recorrentes
- Frequência de menções

#### **3. Métricas de Conversa**

**Cálculos:**
- Tempo médio de primeira resposta
- Tempo médio entre mensagens
- Número médio de mensagens por conversa
- Taxa de abandono (cliente parou de responder)
- Duração da conversa

---

## 📦 **FASE 6E - PREVISÕES E TENDÊNCIAS**

### **Componentes:**

#### **1. Previsão de Demanda**

**Algoritmo: Regressão Linear Simples**

```javascript
const regression = require('regression');

async function predictDemand(historicalData, daysAhead = 7) {
  // Preparar dados
  const data = historicalData.map((item, index) => [index, item.tickets]);
  
  // Calcular regressão
  const result = regression.linear(data);
  
  // Prever próximos dias
  const predictions = [];
  for (let i = 0; i < daysAhead; i++) {
    const day = data.length + i;
    const predicted = result.predict(day)[1];
    predictions.push({
      date: moment().add(i, 'days'),
      predicted: Math.round(predicted)
    });
  }
  
  return {
    equation: result.equation,
    r2: result.r2,
    predictions
  };
}
```

#### **2. Detecção de Tendências**

**Análise:**
- Crescimento/Decrescimento
- Sazonalidade (dia da semana, hora, mês)
- Anomalias (picos inesperados)
- Padrões recorrentes

#### **3. Alertas Preditivos**

**Condições:**
- Previsão de estouro de SLA
- Previsão de sobrecarga de agentes
- Tendência de queda de satisfação
- Aumento anormal de demanda

---

## 📦 **FASE 6F - RELATÓRIOS PERSONALIZADOS**

### **Componentes:**

#### **1. Report Builder**

**Interface:**
- Drag & drop de campos
- Seleção de métricas
- Filtros customizados
- Agrupamentos
- Ordenação
- Formatação condicional

#### **2. Templates de Relatório**

**Templates Prontos:**
- Relatório Executivo Mensal
- Performance de Equipe
- Satisfação do Cliente
- Análise de Volume
- Relatório de SLA
- Audit Log

#### **3. Agendamento**

**Recursos:**
- Agendar geração automática
- Recorrência (diária, semanal, mensal)
- Envio por email automático
- Múltiplos destinatários
- Formatos (PDF, Excel, CSV)

---

## 🎨 **VISUALIZAÇÕES**

### **Bibliotecas:**
- **Chart.js** - Gráficos principais
- **ApexCharts** - Gráficos avançados
- **D3.js** - Visualizações customizadas
- **Leaflet** - Mapas (opcional)

### **Tipos de Gráficos:**
1. **Linha** - Tendências temporais
2. **Barra** - Comparativos
3. **Pizza/Donut** - Distribuições
4. **Área** - Volume acumulado
5. **Gauge** - Medidores (NPS, SLA)
6. **Heatmap** - Atividade por hora/dia
7. **Funnel** - Conversão
8. **Scatter** - Correlações
9. **Radar** - Performance multi-dimensional
10. **Treemap** - Hierarquias

---

## 🚀 **INICIANDO FASE 6A - DASHBOARD EXECUTIVO**

### **Próximos Passos:**
1. ✅ Criar modelo `AnalyticsSnapshotSQL.js`
2. ✅ Criar service `analyticsService.js`
3. ✅ Criar controller `dashboardController.js`
4. ✅ Criar rotas `/api/dashboard/*`
5. ✅ Criar job de snapshot diário
6. ✅ Criar view `executiveDashboardView.js`
7. ✅ Implementar gráficos Chart.js
8. ✅ Adicionar filtros e exportação

---

## 📊 **ESTATÍSTICAS DA FASE 6**

### **Estimativa de Implementação:**

| Módulo | Complexidade | Tempo Estimado | Prioridade |
|--------|--------------|----------------|------------|
| 6A - Dashboard Executivo | Alta | 5-6 dias | 🔥 Alta |
| 6B - Análise Atendimento | Média | 3-4 dias | 🔥 Alta |
| 6C - Análise Satisfação | Média | 3-4 dias | 🟡 Média |
| 6D - Análise Conversas | Alta | 4-5 dias | 🟡 Média |
| 6E - Previsões | Alta | 5-6 dias | 🟢 Baixa |
| 6F - Relatórios Customizados | Média | 3-4 dias | 🟡 Média |

**TOTAL ESTIMADO: 23-29 dias de desenvolvimento**

---

## 🎯 **METAS DA FASE 6**

- Fornecer visão 360° do negócio
- Facilitar tomada de decisões baseada em dados
- Identificar oportunidades de melhoria
- Prever demandas futuras
- Medir ROI do sistema
- Otimizar alocação de recursos
- Melhorar satisfação do cliente

---

**🎉 FASE 6 - PRONTA PARA INÍCIO! 🎉**

Vamos começar implementando o Dashboard Executivo!

