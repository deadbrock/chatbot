# 👥 FASE 6B - ANÁLISE DE ATENDIMENTO

## 📋 **OBJETIVO DA FASE 6B**

Implementar análises detalhadas de performance de agentes e filas, incluindo métricas de produtividade, tempo de resposta, carga de trabalho e rankings.

---

## 🎯 **ESCOPO DA FASE 6B**

### **Módulos a Implementar:**

#### **Performance de Agentes** 👤
- Ranking de agentes
- Produtividade individual
- Tempo médio de atendimento
- Taxa de resolução
- Tickets atendidos
- Primeira resposta
- Taxa de satisfação por agente
- Horas online
- Gráfico de evolução

#### **Performance de Filas** 📋
- Ranking de filas
- Volume de tickets
- Tempo médio de espera
- Taxa de abandono
- SLA cumprido/estourado
- Taxa de transferência
- Distribuição de horários
- Gráfico de carga

#### **Análise de Carga** ⚖️
- Distribuição de tickets
- Agentes sobrecarregados
- Agentes ociosos
- Recomendações de balanceamento
- Heatmap de carga

---

## 📦 **IMPLEMENTAÇÃO**

### **1. Modelo de Performance de Agentes**

**Modelo: `AgentPerformanceSQL.js`**
```javascript
{
  id: UUID,
  userId: UUID,
  date: DATE,
  period: ENUM('daily', 'weekly', 'monthly'),
  
  // Métricas de Produtividade
  totalTickets: INTEGER,
  openTickets: INTEGER,
  closedTickets: INTEGER,
  inProgressTickets: INTEGER,
  
  // Métricas de Tempo
  avgFirstResponseTime: INTEGER, // minutos
  avgResolutionTime: INTEGER, // minutos
  totalResponseTime: INTEGER, // minutos
  
  // Taxa de Resolução
  firstContactResolution: INTEGER, // tickets resolvidos no primeiro contato
  firstContactResolutionRate: FLOAT, // %
  
  // Satisfação
  npsScore: FLOAT,
  totalRatings: INTEGER,
  avgRating: FLOAT,
  
  // Atividade
  hoursOnline: FLOAT,
  messagesReceived: INTEGER,
  messagesSent: INTEGER,
  
  // Produtividade
  ticketsPerHour: FLOAT,
  avgTicketsPerDay: FLOAT,
  
  // Qualidade
  reopenedTickets: INTEGER,
  reopenRate: FLOAT, // %
  transferredTickets: INTEGER,
  transferRate: FLOAT, // %
  
  // Ranking
  rankPosition: INTEGER,
  rankScore: FLOAT,
  
  metadata: JSON
}
```

### **2. Modelo de Performance de Filas**

**Modelo: `QueuePerformanceSQL.js`**
```javascript
{
  id: UUID,
  queueId: UUID,
  date: DATE,
  period: ENUM('daily', 'weekly', 'monthly'),
  
  // Volume
  totalTickets: INTEGER,
  newTickets: INTEGER,
  closedTickets: INTEGER,
  pendingTickets: INTEGER,
  
  // Tempo
  avgWaitTime: INTEGER, // minutos
  avgResolutionTime: INTEGER,
  maxWaitTime: INTEGER,
  
  // SLA
  slaTarget: INTEGER, // minutos
  slaCompliance: FLOAT, // %
  ticketsWithinSLA: INTEGER,
  ticketsOutsideSLA: INTEGER,
  
  // Taxa de Abandono
  abandonedTickets: INTEGER,
  abandonRate: FLOAT, // %
  
  // Transferências
  transferredIn: INTEGER,
  transferredOut: INTEGER,
  transferRate: FLOAT, // %
  
  // Distribuição
  ticketsByHour: JSON, // {0: 5, 1: 3, ...}
  ticketsByDay: JSON, // {0: 50, 1: 120, ...}
  
  // Agentes
  activeAgents: INTEGER,
  avgAgentLoad: FLOAT,
  
  // Satisfação
  npsScore: FLOAT,
  totalRatings: INTEGER,
  
  metadata: JSON
}
```

### **3. Performance Service**

**Service: `performanceService.js`**

#### **Análise de Agentes:**
```javascript
class PerformanceService {
  // Calcular performance de um agente
  async calculateAgentPerformance(userId, startDate, endDate) {
    // Buscar tickets do agente
    const tickets = await Ticket.findAll({
      where: {
        userId,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });
    
    // Calcular métricas
    const totalTickets = tickets.length;
    const closedTickets = tickets.filter(t => t.status === 'closed').length;
    
    // Tempo médio de primeira resposta
    const avgFirstResponseTime = await this.calculateAvgFirstResponse(tickets);
    
    // Tempo médio de resolução
    const avgResolutionTime = await this.calculateAvgResolution(tickets);
    
    // Primeira resolução
    const firstContactResolution = await this.calculateFirstContactResolution(tickets);
    
    // NPS
    const npsScore = await this.calculateAgentNPS(userId, startDate, endDate);
    
    // Horas online
    const hoursOnline = await this.calculateHoursOnline(userId, startDate, endDate);
    
    // Produtividade
    const ticketsPerHour = totalTickets / (hoursOnline || 1);
    
    return {
      userId,
      totalTickets,
      closedTickets,
      avgFirstResponseTime,
      avgResolutionTime,
      firstContactResolution,
      firstContactResolutionRate: (firstContactResolution / totalTickets) * 100,
      npsScore,
      hoursOnline,
      ticketsPerHour,
      // ... mais métricas
    };
  }
  
  // Ranking de agentes
  async getAgentsRanking(startDate, endDate, sortBy = 'totalTickets') {
    const agents = await User.findAll({
      where: { role: 'agent' }
    });
    
    const performances = await Promise.all(
      agents.map(agent => this.calculateAgentPerformance(agent.id, startDate, endDate))
    );
    
    // Ordenar
    performances.sort((a, b) => b[sortBy] - a[sortBy]);
    
    // Adicionar posição no ranking
    performances.forEach((p, index) => {
      p.rankPosition = index + 1;
    });
    
    return performances;
  }
  
  // Identificar agentes sobrecarregados
  async getOverloadedAgents(threshold = 15) {
    const agents = await this.getAgentsRanking(
      moment().startOf('week'),
      moment().endOf('week'),
      'ticketsPerHour'
    );
    
    return agents.filter(a => a.ticketsPerHour > threshold);
  }
  
  // Identificar agentes ociosos
  async getIdleAgents(threshold = 5) {
    const agents = await this.getAgentsRanking(
      moment().startOf('week'),
      moment().endOf('week'),
      'ticketsPerHour'
    );
    
    return agents.filter(a => a.ticketsPerHour < threshold);
  }
}
```

#### **Análise de Filas:**
```javascript
// Calcular performance de uma fila
async calculateQueuePerformance(queueId, startDate, endDate) {
  const tickets = await Ticket.findAll({
    where: {
      queueId,
      createdAt: { [Op.between]: [startDate, endDate] }
    }
  });
  
  // Métricas
  const totalTickets = tickets.length;
  const closedTickets = tickets.filter(t => t.status === 'closed').length;
  
  // Tempo de espera
  const avgWaitTime = await this.calculateAvgWaitTime(tickets);
  
  // SLA
  const slaCompliance = await this.calculateSLACompliance(tickets, queueId);
  
  // Taxa de abandono
  const abandonedTickets = tickets.filter(t => t.abandoned).length;
  const abandonRate = (abandonedTickets / totalTickets) * 100;
  
  // Distribuição por hora
  const ticketsByHour = this.distributeByHour(tickets);
  
  return {
    queueId,
    totalTickets,
    closedTickets,
    avgWaitTime,
    slaCompliance,
    abandonRate,
    ticketsByHour,
    // ... mais métricas
  };
}

// Ranking de filas
async getQueuesRanking(startDate, endDate, sortBy = 'totalTickets') {
  const queues = await Queue.findAll();
  
  const performances = await Promise.all(
    queues.map(queue => this.calculateQueuePerformance(queue.id, startDate, endDate))
  );
  
  performances.sort((a, b) => b[sortBy] - a[sortBy]);
  
  return performances;
}
```

### **4. Performance Controller**

**Controller: `performanceController.js`**

#### **Endpoints:**
```javascript
// GET /api/performance/agents
exports.getAgentsPerformance = async (req, res) => {
  const { startDate, endDate, sortBy = 'totalTickets' } = req.query;
  
  const ranking = await performanceService.getAgentsRanking(
    new Date(startDate),
    new Date(endDate),
    sortBy
  );
  
  success(res, ranking);
};

// GET /api/performance/agents/:id
exports.getAgentPerformance = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  const performance = await performanceService.calculateAgentPerformance(
    id,
    new Date(startDate),
    new Date(endDate)
  );
  
  success(res, performance);
};

// GET /api/performance/queues
exports.getQueuesPerformance = async (req, res) => {
  const { startDate, endDate, sortBy = 'totalTickets' } = req.query;
  
  const ranking = await performanceService.getQueuesRanking(
    new Date(startDate),
    new Date(endDate),
    sortBy
  );
  
  success(res, ranking);
};

// GET /api/performance/queues/:id
exports.getQueuePerformance = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  const performance = await performanceService.calculateQueuePerformance(
    id,
    new Date(startDate),
    new Date(endDate)
  );
  
  success(res, performance);
};

// GET /api/performance/workload
exports.getWorkloadAnalysis = async (req, res) => {
  const overloaded = await performanceService.getOverloadedAgents();
  const idle = await performanceService.getIdleAgents();
  
  success(res, {
    overloaded,
    idle,
    recommendations: generateRecommendations(overloaded, idle)
  });
};

// GET /api/performance/comparison
exports.getAgentsComparison = async (req, res) => {
  const { agentIds, startDate, endDate } = req.query;
  
  const performances = await Promise.all(
    agentIds.split(',').map(id => 
      performanceService.calculateAgentPerformance(
        id,
        new Date(startDate),
        new Date(endDate)
      )
    )
  );
  
  success(res, performances);
};
```

### **5. Frontend - Performance Analysis View**

**View: `performanceAnalysisView.js`**

#### **Componentes:**

**Ranking de Agentes:**
- Tabela com ordenação
- Avatar + nome
- Métricas principais
- Badge de posição
- Gráfico de barra inline

**Detalhes do Agente:**
- Card de resumo
- Gráficos de evolução
- Métricas detalhadas
- Comparação com média

**Ranking de Filas:**
- Tabela com métricas
- SLA visual (gauge)
- Gráfico de volume
- Taxa de abandono

**Análise de Carga:**
- Heatmap de distribuição
- Agentes sobrecarregados (vermelho)
- Agentes ociosos (verde)
- Recomendações automáticas

**Gráficos:**
1. Ranking de Agentes (Horizontal Bar)
2. Evolução Individual (Line)
3. Comparação de Agentes (Radar)
4. Distribuição de Carga (Heatmap)
5. Volume por Fila (Bar)
6. SLA por Fila (Gauge)
7. Atividade por Hora (Bar)

---

## 🚀 **INICIANDO FASE 6B**

Vamos começar implementando o backend completo!

### **Próximos Passos:**
1. ✅ Criar modelos de performance
2. ✅ Criar service de análise
3. ✅ Criar controller
4. ✅ Criar rotas
5. ✅ Criar frontend
6. ✅ Implementar gráficos

---

**🎉 FASE 6B - PRONTA PARA INÍCIO! 🎉**

