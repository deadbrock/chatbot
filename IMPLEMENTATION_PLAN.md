# Plano de Implementação - Funcionalidades Amanda

Baseado na análise do sistema Amanda, este é o plano de implementação das funcionalidades identificadas.

## 📊 Resumo do Mapeamento

### Estrutura Amanda
```
├── Gerência (Dashboard)
│   ├── 11 Cards de Métricas Coloridos
│   ├── Visão Geral e Avaliações (NPS)
│   ├── Mensagens por Período (hora a hora)
│   ├── Ranking de Contatos (Top 10)
│   ├── Ranking de Atendentes
│   ├── Distribuição por Canal/Setor
│   └── Atividade por Hora
│
├── Atendimentos
│   ├── Atendimentos (lista)
│   ├── Respostas Rápidas
│   ├── Status (customização)
│   ├── Kanban
│   ├── Contatos
│   ├── Agendamentos
│   └── Tags
│
├── Automações
│   ├── Fluxo de Campanha
│   ├── Fluxo de Conversa (editor visual)
│   └── Follow UP (Templates)
│
└── Administração
    ├── API
    ├── Usuários
    ├── Config. Aniversário
    ├── Filas & Chatbot
    ├── Lista de Arquivos
    ├── Integrações
    ├── Conexões
    ├── Financeiro
    └── Configurações
```

## ✅ Status Atual do Nosso Sistema

### Já Implementado
- ✅ Dashboard básico com 4 métricas
- ✅ Sistema de tickets (CRUD)
- ✅ Sessões ativas
- ✅ Gerenciamento de atendentes
- ✅ Analytics com 2 gráficos
- ✅ Sistema de fluxos (backend completo)
- ✅ Templates de mensagens (backend)
- ✅ Autenticação JWT
- ✅ Socket.IO para real-time
- ✅ Design system com tema claro/escuro

## 🎯 Implementação Imediata (Fase 1)

### 1. Dashboard Completo Amanda-Style

#### 1.1 Cards de Métricas (11 cards coloridos)
**Arquivo**: `src/dashboard/public/index.html`

```html
<!-- Substituir os 4 cards atuais por 11 cards coloridos -->
<div class="row g-3 mb-4">
    <div class="col-lg-2 col-md-4 col-sm-6">
        <div class="metric-card metric-card-orange">
            <div class="metric-header">
                <span class="metric-title">Tickets Ativos</span>
                <i class="bi bi-arrow-up-right"></i>
            </div>
            <div class="metric-value" id="ticketsAtivos">0</div>
            <div class="metric-subtitle">Demanda ativa</div>
        </div>
    </div>
    <!-- ... mais 10 cards ... -->
</div>
```

**CSS**: `src/dashboard/public/css/metric-cards.css` ✅ CRIADO

#### 1.2 Sistema NPS
**Novos Arquivos**:
- `src/models/RatingSQL.js` - Modelo de avaliações
- `src/services/npsService.js` - Cálculo de NPS
- `src/routes/nps.js` - API de NPS

**Lógica NPS**:
```javascript
// Promotores (9-10): clientes satisfeitos
// Neutros (7-8): clientes neutros
// Detratores (0-6): clientes insatisfeitos

NPS = ((Promotores - Detratores) / Total) * 100
```

#### 1.3 Rankings

**Ranking de Contatos (Top 10)**:
- Query: Top 10 usuários com mais tickets
- Ordenação: Número de tickets DESC
- Dados: Nome, Avatar, Tickets, Setor, Tempo Total

**Ranking de Atendentes**:
- Query: Todos os atendentes
- Métricas: Total atendimentos, Pontuação NPS, Tempo médio
- Gráfico de barras horizontal
- Lista com detalhes expandidos

#### 1.4 Gráficos Adicionais

**Métricas de Tempo** (barras comparativo):
- Tempo de Atendimento
- Tempo de Espera
- Tempo de Primeira Resposta

**Mensagens por Período** (linha hora a hora):
- Eixo X: 0h às 23h
- Eixo Y: Quantidade de mensagens
- 2 linhas: Recebidas (azul) e Enviadas (verde)

**Atividade Diária** (barras):
- Últimos 7 ou 30 dias
- Total de tickets por dia

**Distribuição por Canal** (pizza):
- WhatsApp: 100% (por enquanto)
- Preparado para: Telegram, Instagram, etc.

**Distribuição por Setor** (pizza):
- Todos os departamentos configurados
- Percentual de tickets por setor

**Atividade por Hora** (barras):
- 0h às 23h
- Identificação automática de pico

### 2. Módulos Novos

#### 2.1 Respostas Rápidas
**Arquivos**:
- `src/models/QuickReplySQL.js`
- `src/routes/quickReplies.js`
- `src/dashboard/public/app/views/quickRepliesView.js`

**Funcionalidades**:
- CRUD de respostas rápidas
- Atalhos (ex: /oi, /obrigado)
- Variáveis: {{nome}}, {{protocolo}}, {{data}}
- Categorização
- Busca

#### 2.2 Sistema de Tags
**Arquivos**:
- `src/models/TagSQL.js`
- `src/models/TicketTagSQL.js` (relacionamento)
- `src/routes/tags.js`

**Funcionalidades**:
- CRUD de tags
- Cores personalizadas
- Múltiplas tags por ticket
- Filtro por tags
- Auto-tagging (regras)

#### 2.3 Visualização Kanban
**Arquivos**:
- `src/dashboard/public/app/views/kanbanView.js`
- `src/dashboard/public/css/kanban.css`

**Funcionalidades**:
- Colunas por status
- Drag and drop (HTML5 Drag API ou biblioteca)
- Customização de colunas
- Filtros

#### 2.4 Agendamentos
**Arquivos**:
- `src/models/ScheduleSQL.js`
- `src/services/scheduleService.js`
- `src/routes/schedules.js`

**Funcionalidades**:
- Agendar envio de mensagens
- Follow-ups automáticos
- Lembretes
- Campanhas programadas

### 3. Melhorias de UX

#### 3.1 Empty States Ilustrados
Adicionar ilustrações SVG ou ícones grandes para estados vazios

#### 3.2 Loading States
- Skeleton loaders ✅ (já criado em loading.js)
- Progress bars
- Spinners contextuais

#### 3.3 Animações
- Fade in/out
- Slide
- Bounce (para notificações)

---

## 📅 Cronograma Sugerido

### Semana 1: Dashboard Avançado
- Dia 1-2: 11 cards de métricas + CSS
- Dia 3: Sistema NPS (modelo + cálculo)
- Dia 4: Rankings (contatos + atendentes)
- Dia 5: Gráficos adicionais

### Semana 2: Módulos Novos
- Dia 1-2: Respostas Rápidas
- Dia 3: Sistema de Tags
- Dia 4-5: Visualização Kanban

### Semana 3: Agendamentos e Refinamentos
- Dia 1-2: Agendamentos
- Dia 3-4: Editor Visual de Fluxos (básico)
- Dia 5: Testes e ajustes

### Semana 4: Polimento
- Dia 1-2: Empty states + Loading states
- Dia 3: Animações
- Dia 4: Responsividade mobile
- Dia 5: Documentação

---

## 🔧 Tecnologias Adicionais Necessárias

### Para Editor Visual de Fluxos
- **React Flow** ou **Vue Flow** (recomendado)
- Alternativa: **Drawflow** (vanilla JS)

### Para Kanban
- **HTML5 Drag and Drop API** (nativo)
- Alternativa: **SortableJS**

### Para Agendamentos
- **node-cron** ✅ (já temos)
- **agenda** (alternativa mais robusta)

---

## 💡 Diferenciais a Adicionar

Funcionalidades que podemos ter e o Amanda não tem (visível):

1. **Chat em Tempo Real no Dashboard**
   - Interface WhatsApp-like
   - Atendente responde direto pelo painel
   - Histórico completo da conversa

2. **Relatórios Exportáveis**
   - PDF com gráficos
   - Excel com dados brutos
   - Agendamento de relatórios

3. **Inteligência Artificial** (quando aprovada)
   - Sugestão de respostas
   - Análise de sentimento
   - Categorização automática

4. **Multi-idioma**
   - PT-BR, EN, ES
   - Detecção automática

5. **Webhooks Avançados**
   - Eventos customizados
   - Retry automático
   - Logs de webhooks

---

## 🎯 Próximos Passos Imediatos

1. ✅ Análise completa do Amanda (CONCLUÍDO)
2. 🔨 Implementar 11 cards de métricas (EM ANDAMENTO)
3. 📊 Criar sistema NPS
4. 🏆 Implementar rankings
5. 📈 Adicionar gráficos faltantes
6. ⚡ Criar módulo de Respostas Rápidas
7. 🎯 Implementar Kanban
8. 🏷️ Sistema de Tags

Vou continuar implementando agora!

