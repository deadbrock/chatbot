# Arquitetura do Sistema

## Visão Geral

Sistema de chatbot WhatsApp empresarial com dashboard administrativo, desenvolvido em Node.js + Express + SQLite, sem dependências de IA externa (aguardando aprovação da diretoria).

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO WHATSAPP                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WHATSAPP-WEB.JS CLIENT                        │
│  • QR Code Authentication                                       │
│  • Message Handler                                              │
│  • Media Download                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGE HANDLER                            │
│  • Fluxo de boas-vindas                                         │
│  • Detecção de comandos                                         │
│  • Roteamento por departamento                                  │
│  • Sistema de fluxos (rating, faq, scheduling)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
┌─────────────────────┐   ┌──────────────────────┐
│  SIMPLE RESPONDER   │   │  SESSION MANAGER     │
│  • Palavras-chave   │   │  • NodeCache         │
│  • Sentimento       │   │  • TTL automático    │
│  • Sugestões dept.  │   │  • Histórico         │
└─────────────────────┘   └──────────────────────┘
                │                     │
                └──────────┬──────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TICKET SERVICE                             │
│  • Criação de protocolo único                                   │
│  • Histórico de mensagens                                       │
│  • Anexos (mídia)                                               │
│  • Avaliações                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLITE DATABASE                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │  Users  │  │ Tickets │  │Sessions │                         │
│  └─────────┘  └─────────┘  └─────────┘                         │
│  • Sequelize ORM                                                │
│  • Auto-sync schema                                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                             │
│  • REST API (/api/*)                                            │
│  • JWT Auth Middleware                                          │
│  • Static Files (dashboard)                                     │
│  • Socket.IO (real-time)                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DASHBOARD (FRONTEND)                          │
│  • Modular (ES Modules)                                         │
│  • Views: dashboard, tickets, sessions, agents, analytics       │
│  • Chart.js para gráficos                                       │
│  • Socket.IO client (notificações)                              │
│  • Theme system (light/dark)                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológica

### Backend
- **Node.js** 18+
- **Express.js** 4.x - Framework HTTP
- **whatsapp-web.js** - Integração WhatsApp
- **Sequelize** 6.x - ORM
- **SQLite3** - Banco de dados local
- **Socket.IO** 4.x - WebSocket para real-time
- **jsonwebtoken** - Autenticação JWT
- **bcryptjs** - Hash de senhas
- **node-cache** - Cache em memória
- **winston** - Logging estruturado
- **cron** - Jobs agendados

### Frontend
- **Vanilla JavaScript** (ES Modules)
- **Bootstrap** 5.3 - UI framework
- **Chart.js** 4.x - Gráficos
- **Socket.IO Client** - Real-time updates
- **Bootstrap Icons** - Ícones

## Estrutura de Diretórios

```
chatbot-whatsapp/
├── src/
│   ├── bot/                      # Lógica do chatbot
│   │   ├── whatsapp.js           # Cliente WhatsApp
│   │   ├── messageHandler.js     # Handler principal de mensagens
│   │   └── simpleResponder.js    # Sistema de respostas (sem IA)
│   │
│   ├── config/                   # Configurações
│   │   ├── database.js           # Conexão SQLite
│   │   ├── departments.js        # 13 departamentos
│   │   └── messages.js           # Templates de mensagens
│   │
│   ├── models/                   # Modelos Sequelize
│   │   ├── UserSQL.js
│   │   ├── TicketSQL.js
│   │   └── SessionSQL.js
│   │
│   ├── services/                 # Lógica de negócio
│   │   ├── sessionManager.js     # Gerenciamento de sessões
│   │   ├── ticketService.js      # CRUD de tickets
│   │   └── scheduler.js          # Jobs agendados
│   │
│   ├── routes/                   # Rotas da API
│   │   ├── index.js              # Router principal
│   │   ├── users.js              # /api/users
│   │   ├── tickets.js            # /api/tickets
│   │   ├── sessions.js           # /api/sessions
│   │   └── analytics.js          # /api/analytics
│   │
│   ├── middleware/               # Middlewares
│   │   └── auth.js               # Autenticação JWT
│   │
│   ├── utils/                    # Utilitários
│   │   ├── logger.js             # Winston logger
│   │   └── http.js               # Respostas padronizadas
│   │
│   ├── dashboard/public/         # Frontend
│   │   ├── index.html            # Dashboard principal
│   │   ├── login.html            # Página de login
│   │   │
│   │   ├── app/                  # JavaScript modular
│   │   │   ├── app.js            # Entry point
│   │   │   ├── auth.js           # Autenticação
│   │   │   ├── api.js            # Cliente API
│   │   │   ├── router.js         # Roteamento SPA
│   │   │   ├── socket.js         # Socket.IO client
│   │   │   ├── theme.js          # Light/Dark mode
│   │   │   │
│   │   │   ├── ui/               # Componentes UI
│   │   │   │   ├── dom.js
│   │   │   │   ├── toast.js
│   │   │   │   └── loading.js
│   │   │   │
│   │   │   └── views/            # Views por seção
│   │   │       ├── dashboardView.js
│   │   │       ├── ticketsView.js
│   │   │       ├── sessionsView.js
│   │   │       ├── agentsView.js
│   │   │       └── analyticsView.js
│   │   │
│   │   ├── css/                  # Estilos
│   │   │   ├── theme.css         # Design system
│   │   │   ├── dashboard.css     # Dashboard styles
│   │   │   └── login.css         # Login styles
│   │   │
│   │   └── js/                   # Scripts legados
│   │       └── login.js
│   │
│   ├── setup/                    # Scripts de setup
│   │   └── initialize.js         # Criar usuário admin
│   │
│   └── server.js                 # Entry point do servidor
│
├── database.sqlite               # Banco de dados (gerado)
├── .wwebjs_auth/                 # Sessão WhatsApp (gerado)
├── .env                          # Variáveis de ambiente (criar)
├── env.example                   # Template do .env
├── start.bat                     # Script de inicialização Windows
├── package.json
├── README.md
├── CHANGELOG.md
└── ARCHITECTURE.md (este arquivo)
```

## Fluxos Principais

### 1. Fluxo de Mensagem WhatsApp

```
Usuário envia mensagem
    ↓
whatsapp.js recebe evento 'message'
    ↓
Busca/cria sessão (SessionManager)
    ↓
messageHandler.handle(message, session, client)
    ↓
┌─ Primeira mensagem? → Boas-vindas + Menu
├─ Comando? (menu, protocolo, etc.) → Executar comando
├─ Número? (1-5) → Opção de menu
├─ Fluxo ativo? (rating, faq) → Continuar fluxo
└─ Texto livre → simpleResponder.processMessage()
    ↓
    ├─ Detecta departamento? → Sugerir transferência
    ├─ Detecta sentimento negativo? → Oferecer atendente
    └─ Resposta padrão → Enviar + registrar no ticket
```

### 2. Fluxo de Autenticação Dashboard

```
Usuário acessa /login.html
    ↓
Preenche email/senha
    ↓
POST /api/users/login
    ↓
Backend valida credenciais (bcrypt)
    ↓
Gera JWT token (24h)
    ↓
Frontend armazena token (localStorage)
    ↓
Redireciona para /admin
    ↓
Todas as requests incluem header: Authorization: Bearer <token>
    ↓
authMiddleware valida token em cada request
```

### 3. Fluxo de Ticket

```
Usuário inicia conversa
    ↓
ticketService.getOrCreateTicket(userId)
    ↓
Gera protocolo único (ex: TKT-20251215-ABC123)
    ↓
Salva no banco: { userId, protocol, status: 'open', messages: [] }
    ↓
A cada mensagem: ticketService.addMessage(ticketId, { from, message, timestamp })
    ↓
Usuário solicita atendente: status → 'waiting_human'
    ↓
Dashboard notificado via Socket.IO
    ↓
Atendente atribui ticket: assignedTo → userId, status → 'in_progress'
    ↓
Usuário avalia: rating (1-5), ratedAt
    ↓
Ticket fechado: status → 'closed', closedAt
```

### 4. Fluxo de Notificação Real-Time

```
Evento ocorre no backend (novo ticket, atualização, etc.)
    ↓
messageHandler.notifyDashboard(event, data)
    ↓
io.emit(event, data) → Socket.IO broadcast
    ↓
Dashboard (socket.js) escuta evento
    ↓
socket.on(event, (data) => { ... })
    ↓
Atualiza UI (badge, tabela, toast)
```

## Departamentos Configurados

1. **Atendimento/Recepção** - Atendimento geral
2. **Logística** - Rastreamento, entregas, coletas
3. **Manutenção** - Chamados, reparos
4. **Gerência Administrativa** - Solicitações administrativas
5. **Comercial** - Vendas, orçamentos
6. **Recursos Humanos** - Vagas, benefícios
7. **Departamento Pessoal** - Folha, férias, atestados
8. **TI** - Suporte técnico, senhas
9. **Financeiro** - Pagamentos, cobranças
10. **Faturamento** - Notas fiscais, boletos
11. **Segurança do Trabalho** - EPIs, treinamentos
12. **Marketing** - Campanhas, eventos
13. **Coordenadoria** - Coordenação geral
14. **Operações** - Operações diárias

Cada departamento tem:
- Keywords para detecção automática
- Horário de funcionamento
- Emoji identificador
- Respostas automáticas (on/off)
- Features específicas (tracking, scheduling, etc.)

## Comandos do Bot

- `menu` - Menu principal
- `departamentos` - Lista de departamentos
- `protocolo` - Consultar protocolos
- `atendente` - Solicitar atendente humano
- `rastrear` - Rastrear pedido
- `faq` - Perguntas frequentes
- `avaliar` - Avaliar atendimento
- `cancelar` - Cancelar operação
- `sair` - Finalizar atendimento
- `help` - Lista de comandos
- `0` - Voltar ao menu

## API Endpoints

### Públicos
- `POST /api/users/login` - Login

### Protegidos (requer JWT)
- `GET /api/tickets` - Listar tickets
- `GET /api/tickets/:id` - Detalhes do ticket
- `PATCH /api/tickets/:id` - Atualizar ticket
- `GET /api/tickets/stats/summary` - Estatísticas

- `GET /api/sessions` - Sessões ativas
- `GET /api/sessions/:userId` - Detalhes da sessão
- `DELETE /api/sessions/:userId` - Expirar sessão
- `GET /api/sessions/stats/summary` - Estatísticas

- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PATCH /api/users/:id/status` - Atualizar status

- `GET /api/analytics/dashboard` - Métricas do dashboard
- `GET /api/analytics/tickets/timeline` - Timeline de tickets
- `GET /api/analytics/tickets/by-status` - Tickets por status
- `GET /api/analytics/tickets/by-department` - Tickets por departamento
- `GET /api/analytics/ratings` - Distribuição de avaliações
- `GET /api/analytics/agents/performance` - Performance dos atendentes

### Sistema
- `GET /health` - Health check (status do sistema)

## Segurança

### Autenticação
- JWT com expiração de 24h
- Senha hasheada com bcrypt (10 rounds)
- Middleware de autenticação em todas as rotas protegidas

### Autorização
- Roles: `admin`, `manager`, `agent`, `viewer`
- Middleware `checkRole(...roles)` para verificar permissões

### Proteções
- SQL Injection: Sequelize parametriza queries
- XSS: `escapeHtml()` no frontend
- CORS: Configurado no Express
- Rate limiting: A implementar

## Performance

### Cache
- **NodeCache** para sessões (TTL: 30 min)
- Evita hits no banco a cada mensagem

### Database
- Índices em: `userId`, `protocol`, `status`, `createdAt`
- Queries otimizadas com `LIMIT`

### Frontend
- Lazy loading de views
- Debounce em busca (150ms)
- Skeleton loaders durante carregamento

## Monitoramento

### Logs
- **Winston** com níveis: error, warn, info, debug
- Formato: timestamp + level + message + metadata
- Arquivo: `logs/app.log` (rotação diária)

### Métricas
- Dashboard exibe em tempo real:
  - Tickets hoje/abertos
  - Sessões ativas
  - Atendentes online
  - Tempo médio de resposta
  - Avaliação média

## Jobs Agendados

### Limpeza de Sessões
- **Frequência**: A cada 1 hora
- **Ação**: Expira sessões inativas > 24h

### Fechamento de Tickets
- **Frequência**: A cada 1 hora
- **Ação**: Fecha tickets inativos > 24h

### Lembretes
- **Frequência**: A cada 30 min
- **Ação**: Notifica tickets aguardando > 2h

## Escalabilidade

### Atual (Desenvolvimento)
- SQLite local
- NodeCache em memória
- Socket.IO em processo único

### Produção (Futuro)
- Migrar para PostgreSQL/MySQL
- Redis para cache distribuído
- Socket.IO com Redis adapter (múltiplas instâncias)
- Load balancer (Nginx)
- PM2 para cluster mode

## Limitações Conhecidas

1. **IA desabilitada** - Aguardando aprovação da diretoria
2. **Áudio desabilitado** - Sem Google Cloud Speech-to-Text
3. **Fila de atendentes** - Simplificada (sem round-robin real)
4. **Agendamentos** - Em desenvolvimento
5. **Multi-idioma** - Apenas PT-BR
6. **Backup automático** - Não implementado

## Próximos Passos

Ver `CHANGELOG.md` seção "Próximos passos".

