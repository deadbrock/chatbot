# 🔌 GUIA COMPLETO - SISTEMA DE WEBHOOKS

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Como Funciona](#como-funciona)
3. [Instalação](#instalação)
4. [Uso no Frontend](#uso-no-frontend)
5. [Uso no Backend](#uso-no-backend)
6. [Recebendo Webhooks](#recebendo-webhooks)
7. [Segurança](#segurança)
8. [Troubleshooting](#troubleshooting)
9. [Exemplos Práticos](#exemplos-práticos)

---

## 🎯 VISÃO GERAL

O sistema de webhooks permite que o chatbot notifique sistemas externos quando eventos importantes acontecem (criação de tickets, mensagens recebidas, etc.).

### **Características:**
- ✅ 30 eventos disponíveis
- ✅ Retry automático (exponential backoff)
- ✅ Assinatura HMAC-SHA256 (segurança)
- ✅ Logs completos de todas as chamadas
- ✅ Estatísticas detalhadas
- ✅ Interface web completa
- ✅ API REST para gerenciamento

---

## ⚙️ COMO FUNCIONA

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   EVENTO    │────────>│   WEBHOOK    │────────>│   SISTEMA   │
│  (Sistema)  │         │   EMITTER    │         │   EXTERNO   │
└─────────────┘         └──────────────┘         └─────────────┘
                                │
                                v
                        ┌──────────────┐
                        │  WEBHOOK LOG │
                        │  (Histórico) │
                        └──────────────┘
```

### **Fluxo:**
1. Evento ocorre no sistema (ex: ticket criado)
2. Sistema chama `webhookEmitter.ticketCreated(ticket)`
3. Emitter busca webhooks que escutam esse evento
4. Para cada webhook:
   - Prepara payload
   - Assina com HMAC (se secret configurado)
   - Faz requisição HTTP
   - Registra log
   - Se falhar, agenda retry

---

## 📦 INSTALAÇÃO

### **Dependências:**
```bash
npm install axios  # Já instalado
```

### **Arquivos Criados:**
```
src/
├── models/
│   ├── WebhookSQL.js           # Modelo principal
│   └── WebhookLogSQL.js        # Logs
├── services/
│   └── webhookService.js       # Lógica de disparo
├── controllers/
│   └── webhooksController.js   # API endpoints
├── routes/
│   └── webhooks.js             # Rotas REST
└── utils/
    └── webhookEmitter.js       # Helper para disparar

dashboard/public/
├── app/views/
│   └── webhooksView.js         # Interface web
└── css/
    └── webhooks.css            # Estilos
```

### **Banco de Dados:**
Os modelos criarão automaticamente as tabelas:
- `Webhooks` - Configurações dos webhooks
- `WebhookLogs` - Histórico de chamadas

---

## 🖥️ USO NO FRONTEND

### **1. Acessar a Interface:**
```
http://localhost:3001/admin#webhooks
```

### **2. Criar um Webhook:**

**Passo a passo:**
1. Clicar em "+ Criar Webhook"
2. Preencher:
   - **Nome:** "Notificar Meu Sistema"
   - **URL:** `https://meu-servidor.com/webhooks`
   - **Método:** POST
3. Selecionar eventos:
   - ☑ ticket.created
   - ☑ ticket.assigned
   - ☑ message.received
4. (Opcional) Configurações avançadas:
   - Secret: deixar vazio (auto-gera)
   - Retry: 3 tentativas
   - Delay: 60 segundos
   - Timeout: 30 segundos
5. Clicar em "Salvar"

**Resultado:**
- Webhook criado
- Secret gerado automaticamente
- Aparece na lista

### **3. Testar o Webhook:**

1. Localizar webhook na lista
2. Clicar no botão "▶" (Play)
3. Sistema envia payload de teste:
```json
{
  "event": "system.test",
  "timestamp": "2025-12-17T18:30:00Z",
  "webhookId": "uuid",
  "data": {
    "message": "Este é um teste de webhook",
    "test": true
  }
}
```
4. Ver resultado no toast

### **4. Ver Logs:**

1. Clicar no botão "👁" (Olho)
2. Modal com:
   - Informações básicas
   - Estatísticas (sucessos/falhas)
   - Eventos monitorados
   - Últimos 10 logs

### **5. Filtrar Webhooks:**

- **Buscar:** Digite nome ou URL
- **Status:** Todos / Ativo / Inativo
- **Evento:** Selecione um evento específico

---

## 💻 USO NO BACKEND

### **1. Disparar Webhook no Código:**

#### **Exemplo 1: Ticket Criado**
```javascript
// src/controllers/ticketsController.js
const webhookEmitter = require('../utils/webhookEmitter');

exports.createTicket = async (req, res) => {
  try {
    const ticket = await Ticket.create(req.body);
    
    // Disparar webhook
    await webhookEmitter.ticketCreated(ticket);
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

#### **Exemplo 2: Mensagem Recebida**
```javascript
// src/services/whatsappService.js
const webhookEmitter = require('../utils/webhookEmitter');

socket.on('message', async (message) => {
  // Processar mensagem...
  
  // Disparar webhook
  await webhookEmitter.messageReceived({
    id: message.id,
    from: message.from,
    body: message.body,
    type: message.type
  });
});
```

#### **Exemplo 3: Usuário Logou**
```javascript
// src/controllers/authController.js
const webhookEmitter = require('../utils/webhookEmitter');

exports.login = async (req, res) => {
  // Validar credenciais...
  
  const user = await User.findOne({ where: { email } });
  const token = generateToken(user);
  
  // Disparar webhook
  await webhookEmitter.userLogin(user, req.ip);
  
  res.json({ token, user });
};
```

### **2. Métodos Disponíveis:**

```javascript
const webhookEmitter = require('../utils/webhookEmitter');

// Tickets
webhookEmitter.ticketCreated(ticket);
webhookEmitter.ticketUpdated(ticket, changes);
webhookEmitter.ticketAssigned(ticket, user);
webhookEmitter.ticketStatusChanged(ticket, oldStatus, newStatus);
webhookEmitter.ticketClosed(ticket);
webhookEmitter.ticketReopened(ticket);

// Mensagens
webhookEmitter.messageReceived(message);
webhookEmitter.messageSent(message);
webhookEmitter.messageRead(message);
webhookEmitter.messageDelivered(message);

// Contatos
webhookEmitter.contactCreated(contact);
webhookEmitter.contactUpdated(contact, changes);
webhookEmitter.contactBlocked(contact);
webhookEmitter.contactUnblocked(contact);

// Usuários
webhookEmitter.userLogin(user, ipAddress);
webhookEmitter.userLogout(user);
webhookEmitter.userCreated(user);
webhookEmitter.userUpdated(user, changes);

// Campanhas
webhookEmitter.campaignStarted(campaign);
webhookEmitter.campaignCompleted(campaign, stats);
webhookEmitter.campaignFailed(campaign, error);

// Fluxos
webhookEmitter.flowStarted(flow, execution);
webhookEmitter.flowCompleted(flow, execution);
webhookEmitter.flowFailed(flow, execution, error);

// NPS
webhookEmitter.npsRated(rating);

// Sistema
webhookEmitter.systemError(error, context);
webhookEmitter.systemWarning(message, context);
```

---

## 📥 RECEBENDO WEBHOOKS

### **1. Criar Endpoint no Servidor Externo:**

#### **Node.js + Express:**
```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Verificar assinatura HMAC
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// Endpoint para receber webhooks
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const webhookId = req.headers['x-webhook-id'];
  const event = req.headers['x-webhook-event'];
  
  // Validar assinatura (IMPORTANTE!)
  const isValid = verifySignature(req.body, signature, 'SEU_SECRET');
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Processar evento
  console.log('Webhook recebido:', event);
  console.log('Dados:', req.body.data);
  
  // Processar de acordo com o evento
  switch (event) {
    case 'ticket.created':
      handleTicketCreated(req.body.data);
      break;
    case 'message.received':
      handleMessageReceived(req.body.data);
      break;
    // ... outros eventos
  }
  
  // IMPORTANTE: Retornar 2xx para sucesso
  res.status(200).json({ received: true });
});

function handleTicketCreated(data) {
  console.log('Novo ticket:', data.id);
  // Sua lógica aqui...
}

function handleMessageReceived(data) {
  console.log('Nova mensagem:', data.body);
  // Sua lógica aqui...
}

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
```

#### **Python + Flask:**
```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)
SECRET = 'SEU_SECRET'

def verify_signature(payload, signature):
    expected = hmac.new(
        SECRET.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return signature == expected

@app.route('/webhooks', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    event = request.headers.get('X-Webhook-Event')
    payload = request.json
    
    # Validar assinatura
    if not verify_signature(payload, signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Processar evento
    print(f'Webhook recebido: {event}')
    print(f'Dados: {payload["data"]}')
    
    if event == 'ticket.created':
        handle_ticket_created(payload['data'])
    elif event == 'message.received':
        handle_message_received(payload['data'])
    
    # Retornar sucesso
    return jsonify({'received': True}), 200

def handle_ticket_created(data):
    print(f'Novo ticket: {data["id"]}')
    # Sua lógica aqui...

def handle_message_received(data):
    print(f'Nova mensagem: {data["body"]}')
    # Sua lógica aqui...

if __name__ == '__main__':
    app.run(port=3000)
```

### **2. Headers Recebidos:**

```
Content-Type: application/json
User-Agent: ChatBot-Webhook/1.0
X-Webhook-Event: ticket.created
X-Webhook-ID: uuid-do-webhook
X-Webhook-Signature: abc123... (HMAC-SHA256)
```

### **3. Payload Padrão:**

```json
{
  "event": "ticket.created",
  "timestamp": "2025-12-17T18:30:00Z",
  "webhookId": "uuid-do-webhook",
  "data": {
    "id": "uuid-do-ticket",
    "contact": {
      "id": "uuid",
      "name": "João Silva",
      "number": "5511999999999"
    },
    "queue": {
      "id": "uuid",
      "name": "Suporte"
    },
    "status": "open",
    "createdAt": "2025-12-17T18:30:00Z"
  }
}
```

---

## 🔐 SEGURANÇA

### **1. Assinatura HMAC:**

**Por que usar:**
- Garante que o webhook veio do seu sistema
- Evita spoofing
- Valida integridade dos dados

**Como funciona:**
1. Sistema gera secret aleatório
2. Ao enviar webhook:
   - Cria HMAC-SHA256 do payload com o secret
   - Envia no header `X-Webhook-Signature`
3. Servidor externo:
   - Recalcula HMAC com o mesmo secret
   - Compara com o recebido
   - Se igual → válido ✅
   - Se diferente → inválido ❌

**Exemplo de validação:**
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = hmac.digest('hex');
  
  return signature === expected;
}

// Uso:
const isValid = verifySignature(req.body, signature, 'SEU_SECRET');
if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### **2. HTTPS Obrigatório:**

**Configure seu webhook para usar HTTPS:**
- ✅ `https://meu-servidor.com/webhook`
- ❌ `http://meu-servidor.com/webhook`

### **3. Guardar Secret em Segurança:**

```bash
# .env
WEBHOOK_SECRET=abc123xyz...
```

```javascript
const SECRET = process.env.WEBHOOK_SECRET;
```

---

## 🔧 TROUBLESHOOTING

### **Problema 1: Webhook não dispara**

**Verificar:**
1. Webhook está ativo?
2. Evento está selecionado?
3. URL está correta?
4. Servidor externo está online?

**Testar:**
```javascript
// Teste manualmente
const webhookService = require('../services/webhookService');
const webhook = await Webhook.findByPk('webhook-id');
await webhookService.testWebhook(webhook);
```

### **Problema 2: Sempre falha**

**Verificar:**
1. Servidor retorna 2xx?
2. Timeout não é muito curto?
3. Assinatura está correta?
4. Logs no servidor externo?

**Ver logs:**
```sql
SELECT * FROM WebhookLogs 
WHERE webhookId = 'uuid' 
AND status = 'failure'
ORDER BY createdAt DESC 
LIMIT 10;
```

### **Problema 3: Retry não funciona**

**Verificar:**
1. `retryAttempts` > 0?
2. Status de falha é >= 500 ou timeout?
3. Logs mostram "willRetry: true"?

**Forçar retry:**
```javascript
POST /api/webhooks/:id/retry
```

### **Problema 4: Assinatura inválida**

**Verificar:**
1. Secret está correto?
2. Payload não foi modificado?
3. JSON.stringify está na mesma ordem?

**Dica:**
```javascript
// Log para debug
console.log('Payload recebido:', req.body);
console.log('Signature recebida:', signature);
console.log('Secret usado:', SECRET);
```

---

## 💡 EXEMPLOS PRÁTICOS

### **1. Integração com Slack:**

```javascript
// Criar webhook para Slack
POST /api/webhooks
{
  "name": "Notificações Slack",
  "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  "method": "POST",
  "events": ["ticket.created", "ticket.assigned"],
  "isActive": true
}

// Payload enviado:
{
  "event": "ticket.created",
  "data": {
    "id": "123",
    "contact": { "name": "João" }
  }
}

// Slack webhook handler (automático)
// Aparece no canal: "Novo ticket criado: João (#123)"
```

### **2. Integração com CRM:**

```javascript
// Criar webhook para CRM
POST /api/webhooks
{
  "name": "Sincronizar CRM",
  "url": "https://crm.example.com/api/webhooks",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer TOKEN_DO_CRM"
  },
  "events": ["contact.created", "contact.updated"],
  "secret": "shared-secret"
}

// No CRM:
app.post('/api/webhooks', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'contact.created') {
    // Criar contato no CRM
    await CRM.createContact({
      name: data.name,
      phone: data.number,
      source: 'WhatsApp Chatbot'
    });
  }
  
  res.json({ success: true });
});
```

### **3. Notificação por Email:**

```javascript
// Criar webhook para serviço de email
POST /api/webhooks
{
  "name": "Email de Urgência",
  "url": "https://api.sendgrid.com/v3/mail/send",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer SENDGRID_API_KEY",
    "Content-Type": "application/json"
  },
  "events": ["ticket.created"],
  "isActive": true
}

// Transformar payload para SendGrid:
// (Isso requer um middleware/proxy)
```

### **4. Dashboard Customizado:**

```javascript
// Criar webhook para dashboard próprio
POST /api/webhooks
{
  "name": "Dashboard Analytics",
  "url": "https://dashboard.meusite.com/api/events",
  "method": "POST",
  "events": [
    "ticket.created",
    "ticket.closed",
    "message.received",
    "message.sent",
    "nps.rated"
  ]
}

// No dashboard:
app.post('/api/events', (req, res) => {
  const { event, data } = req.body;
  
  // Salvar no banco para análise
  await Analytics.create({
    event,
    data,
    timestamp: new Date()
  });
  
  // Atualizar em tempo real via WebSocket
  io.emit('analytics', { event, data });
  
  res.json({ received: true });
});
```

---

## 📊 MONITORAMENTO

### **Ver Estatísticas:**
```
GET /api/webhooks/stats/global
```

**Resposta:**
```json
{
  "webhooks": {
    "total": 25,
    "active": 20,
    "totalCalls": 1500,
    "successRate": "96.67%"
  },
  "logs": {
    "total": 1500,
    "success": 1450,
    "failure": 45,
    "timeout": 5
  }
}
```

### **Top Eventos:**
```
GET /api/webhooks/stats/top-events?limit=10
```

### **Top Falhas:**
```
GET /api/webhooks/stats/top-failures?limit=10
```

---

## 🎓 BOAS PRÁTICAS

1. **Sempre validar assinatura** no servidor externo
2. **Retornar 2xx rapidamente** (< 5s)
3. **Processar assíncrono** (não bloquear resposta)
4. **Tratar idempotência** (mesma chamada 2x)
5. **Log tudo** para debug
6. **Testar antes de ativar**
7. **Monitorar taxa de falha**
8. **Configurar retry adequado**

---

## 📞 SUPORTE

Se tiver problemas:
1. Verificar logs: `GET /api/webhooks/:id/logs`
2. Testar webhook: `POST /api/webhooks/:id/test`
3. Ver documentação: Este arquivo 😊

---

**🎉 Sistema de Webhooks - Pronto para Produção! 🎉**

