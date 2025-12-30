# 🔌 FASE 5 - INTEGRAÇÕES EXTERNAS E NOTIFICAÇÕES

## 📋 **OBJETIVO DA FASE 5**

Implementar integrações externas, sistema de webhooks, notificações e alertas para expandir as capacidades do sistema.

---

## 🎯 **ESCOPO DA FASE 5**

### **Módulos a Implementar:**

#### **5A - Sistema de Webhooks** 🔗
- Webhooks personalizados
- 10+ eventos disponíveis
- Retry automático
- Assinatura de payload (segurança)
- Logs de chamadas
- Interface de gerenciamento

#### **5B - Notificações Push** 🔔
- Web Push Notifications
- Service Worker
- Permissões do navegador
- Notificações de mensagens
- Notificações de tickets
- Badges e sons

#### **5C - Sistema de Alertas** ⚠️
- Alertas de SLA
- Alertas de inatividade
- Alertas de erros
- Alertas de quota
- Configuração por usuário
- Canal de notificação (email, push, SMS)

#### **5D - Integração com APIs Externas** 🌐
- Gerenciador de integrações
- Templates de integração (CRM, E-commerce)
- OAuth2 flow
- Credentials manager
- Webhooks recebidos
- Mapping de dados

#### **5E - Notificações por Email** 📧
- Template engine
- Envio via SMTP/SendGrid
- Filas de email
- Tracking de aberturas
- HTML responsivo
- Unsubscribe

---

## 📦 **FASE 5A - SISTEMA DE WEBHOOKS**

### **Status:** 🔨 **EM IMPLEMENTAÇÃO**

### **Componentes:**

#### **1. Modelo de Webhooks**

**Modelo: `WebhookSQL.js`**
```javascript
- id (UUID)
- name (string) - Nome do webhook
- url (string) - URL de destino
- method (enum: POST, GET, PUT, PATCH)
- headers (JSON) - Headers customizados
- events (JSON array) - Eventos que disparam
- isActive (boolean)
- secret (string) - Para assinatura HMAC
- retryAttempts (integer) - Tentativas em caso de falha
- retryDelay (integer) - Delay entre tentativas (segundos)
- timeout (integer) - Timeout da requisição (segundos)
- lastTriggered (datetime)
- lastStatus (string) - Status da última chamada
- lastError (text)
- successCount (integer)
- failureCount (integer)
- createdBy (UUID)
- metadata (JSON)
```

#### **2. Eventos Disponíveis**

**Eventos de Ticket:**
- `ticket.created` - Ticket criado
- `ticket.updated` - Ticket atualizado
- `ticket.assigned` - Ticket atribuído
- `ticket.status_changed` - Status mudou
- `ticket.closed` - Ticket fechado
- `ticket.reopened` - Ticket reaberto

**Eventos de Mensagem:**
- `message.received` - Mensagem recebida
- `message.sent` - Mensagem enviada
- `message.read` - Mensagem lida
- `message.delivered` - Mensagem entregue

**Eventos de Contato:**
- `contact.created` - Contato criado
- `contact.updated` - Contato atualizado
- `contact.blocked` - Contato bloqueado

**Eventos de Sistema:**
- `user.login` - Usuário fez login
- `user.logout` - Usuário fez logout
- `campaign.completed` - Campanha finalizada
- `flow.completed` - Fluxo completado
- `nps.rated` - Avaliação NPS recebida

#### **3. Payload Padrão**

**Estrutura:**
```json
{
  "event": "ticket.created",
  "timestamp": "2025-12-17T15:30:00Z",
  "webhookId": "uuid-do-webhook",
  "data": {
    "id": "uuid-do-recurso",
    "type": "ticket",
    "attributes": {
      // Dados do recurso
    }
  },
  "signature": "sha256-hmac-signature"
}
```

#### **4. Service de Webhooks**

**Funções:**
- `triggerWebhook(event, data)` - Dispara webhook
- `signPayload(payload, secret)` - Assina payload com HMAC
- `verifySignature(payload, signature, secret)` - Verifica assinatura
- `retryFailedWebhooks()` - Reprocessa falhas
- `logWebhookCall(webhookId, status, response)` - Registra chamada
- `findWebhooksByEvent(event)` - Busca webhooks por evento

#### **5. Controller de Webhooks**

**Endpoints:**
```javascript
GET    /api/webhooks           - Lista webhooks
POST   /api/webhooks           - Cria webhook
GET    /api/webhooks/:id       - Detalhes
PATCH  /api/webhooks/:id       - Atualiza
DELETE /api/webhooks/:id       - Deleta
POST   /api/webhooks/:id/test  - Testa webhook
GET    /api/webhooks/:id/logs  - Logs de chamadas
POST   /api/webhooks/:id/retry - Reprocessa falhas
```

---

## 📦 **FASE 5B - NOTIFICAÇÕES PUSH**

### **Status:** 🔨 **A IMPLEMENTAR**

### **Componentes:**

#### **1. Service Worker**

**Arquivo: `sw.js`**
```javascript
// Service Worker para notificações
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'open') {
    clients.openWindow(event.notification.data.url);
  }
});
```

#### **2. Push Manager**

**Frontend: `pushManager.js`**
```javascript
class PushManager {
  async requestPermission() {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  async subscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });
    
    // Enviar subscription para o backend
    await this.sendSubscriptionToBackend(subscription);
    
    return subscription;
  }
  
  async unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await this.removeSubscriptionFromBackend();
    }
  }
}
```

#### **3. Backend Push**

**Modelo: `PushSubscriptionSQL.js`**
```javascript
- id (UUID)
- userId (UUID)
- endpoint (string)
- keys (JSON) - p256dh, auth
- userAgent (string)
- isActive (boolean)
- lastUsed (datetime)
```

**Service: `pushNotificationService.js`**
```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:admin@empresa.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushNotification(userId, notification) {
  const subscriptions = await PushSubscription.findAll({
    where: { userId, isActive: true }
  });
  
  const payload = JSON.stringify(notification);
  
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      // Subscription expirada, remover
      if (error.statusCode === 410) {
        await subscription.update({ isActive: false });
      }
    }
  }
}
```

---

## 📦 **FASE 5C - SISTEMA DE ALERTAS**

### **Status:** 🔨 **A IMPLEMENTAR**

### **Componentes:**

#### **1. Modelo de Alertas**

**Modelo: `AlertSQL.js`**
```javascript
- id (UUID)
- name (string) - Nome do alerta
- description (text)
- type (enum: sla, inactivity, error, quota, custom)
- severity (enum: info, warning, critical)
- conditions (JSON) - Condições para disparar
- actions (JSON array) - Ações a executar
- channels (JSON array) - Canais (email, push, sms, webhook)
- recipients (JSON array) - Destinatários
- schedule (JSON) - Quando verificar (cron)
- isActive (boolean)
- lastChecked (datetime)
- lastTriggered (datetime)
- triggerCount (integer)
- createdBy (UUID)
```

#### **2. Tipos de Alertas**

**SLA (Service Level Agreement):**
```javascript
{
  type: 'sla',
  conditions: {
    metric: 'response_time',
    operator: 'greater_than',
    value: 300, // 5 minutos
    threshold: 5 // Após 5 tickets
  },
  actions: [
    {
      type: 'notification',
      channel: 'push',
      title: 'Alerta de SLA',
      message: '5 tickets estão próximos de estourar o SLA'
    }
  ]
}
```

**Inatividade:**
```javascript
{
  type: 'inactivity',
  conditions: {
    resource: 'ticket',
    field: 'lastMessageAt',
    operator: 'older_than',
    value: 3600 // 1 hora
  },
  actions: [
    {
      type: 'notification',
      channel: 'email',
      subject: 'Ticket sem resposta há 1 hora',
      template: 'ticket_inactive'
    }
  ]
}
```

**Erro do Sistema:**
```javascript
{
  type: 'error',
  conditions: {
    source: 'logs',
    level: 'error',
    count: 5,
    timeWindow: 300 // 5 minutos
  },
  actions: [
    {
      type: 'notification',
      channel: 'push',
      severity: 'critical',
      message: '5 erros nos últimos 5 minutos'
    }
  ]
}
```

**Quota:**
```javascript
{
  type: 'quota',
  conditions: {
    resource: 'messages',
    operator: 'percentage',
    value: 90 // 90% da quota
  },
  actions: [
    {
      type: 'notification',
      channel: 'email',
      message: 'Você atingiu 90% da quota de mensagens'
    }
  ]
}
```

#### **3. Alert Processor**

**Service: `alertProcessor.js`**
```javascript
class AlertProcessor {
  async checkAlerts() {
    const activeAlerts = await Alert.findAll({
      where: { isActive: true }
    });
    
    for (const alert of activeAlerts) {
      const shouldTrigger = await this.evaluateConditions(alert);
      
      if (shouldTrigger) {
        await this.executeActions(alert);
        await alert.update({
          lastTriggered: new Date(),
          triggerCount: alert.triggerCount + 1
        });
      }
      
      await alert.update({ lastChecked: new Date() });
    }
  }
  
  async evaluateConditions(alert) {
    // Avaliar condições baseado no tipo
    switch (alert.type) {
      case 'sla':
        return await this.checkSLA(alert.conditions);
      case 'inactivity':
        return await this.checkInactivity(alert.conditions);
      case 'error':
        return await this.checkErrors(alert.conditions);
      case 'quota':
        return await this.checkQuota(alert.conditions);
      default:
        return false;
    }
  }
  
  async executeActions(alert) {
    for (const action of alert.actions) {
      switch (action.channel) {
        case 'push':
          await this.sendPushNotification(alert, action);
          break;
        case 'email':
          await this.sendEmail(alert, action);
          break;
        case 'sms':
          await this.sendSMS(alert, action);
          break;
        case 'webhook':
          await this.triggerWebhook(alert, action);
          break;
      }
    }
  }
}
```

---

## 📦 **FASE 5D - INTEGRAÇÕES EXTERNAS**

### **Status:** 🔨 **A IMPLEMENTAR**

### **Componentes:**

#### **1. Modelo de Integrações**

**Modelo: `IntegrationSQL.js`**
```javascript
- id (UUID)
- name (string) - Nome da integração
- provider (enum: hubspot, pipedrive, rdstation, woocommerce, shopify, custom)
- type (enum: crm, ecommerce, payment, analytics, custom)
- config (JSON) - Configurações
- credentials (JSON encrypted) - Credenciais
- mapping (JSON) - Mapeamento de campos
- webhookUrl (string) - URL para receber webhooks
- webhookSecret (string)
- isActive (boolean)
- lastSync (datetime)
- syncInterval (integer) - Minutos
- syncStatus (enum: idle, syncing, error)
- syncErrors (JSON array)
- stats (JSON) - Estatísticas
- createdBy (UUID)
```

#### **2. Integration Manager**

**Service: `integrationManager.js`**
```javascript
class IntegrationManager {
  async syncIntegration(integration) {
    const adapter = this.getAdapter(integration.provider);
    
    try {
      integration.syncStatus = 'syncing';
      await integration.save();
      
      const result = await adapter.sync(integration);
      
      integration.syncStatus = 'idle';
      integration.lastSync = new Date();
      integration.stats = result.stats;
      await integration.save();
      
      return result;
    } catch (error) {
      integration.syncStatus = 'error';
      integration.syncErrors.push({
        timestamp: new Date(),
        error: error.message
      });
      await integration.save();
      
      throw error;
    }
  }
  
  getAdapter(provider) {
    const adapters = {
      hubspot: new HubSpotAdapter(),
      pipedrive: new PipedriveAdapter(),
      rdstation: new RDStationAdapter(),
      woocommerce: new WooCommerceAdapter(),
      shopify: new ShopifyAdapter()
    };
    
    return adapters[provider] || new CustomAdapter();
  }
}
```

#### **3. Adapters**

**HubSpot Adapter:**
```javascript
class HubSpotAdapter {
  async sync(integration) {
    const { apiKey } = integration.credentials;
    
    // Sincronizar contatos
    const contacts = await this.fetchNewContacts(apiKey);
    await this.importContacts(contacts, integration.mapping);
    
    // Sincronizar deals
    const deals = await this.fetchDeals(apiKey);
    await this.syncDeals(deals);
    
    return {
      contacts: contacts.length,
      deals: deals.length
    };
  }
  
  async createContact(contact, apiKey) {
    // Criar contato no HubSpot
  }
  
  async createDeal(ticket, apiKey) {
    // Criar deal no HubSpot quando ticket é criado
  }
}
```

---

## 📦 **FASE 5E - NOTIFICAÇÕES POR EMAIL**

### **Status:** 🔨 **A IMPLEMENTAR**

### **Componentes:**

#### **1. Email Templates**

**Engine: Handlebars**

**Template: `ticket_assigned.hbs`**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #007bff; color: white; padding: 20px; }
    .content { padding: 20px; }
    .button { background: #007bff; color: white; padding: 10px 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Novo Ticket Atribuído</h1>
    </div>
    <div class="content">
      <p>Olá {{agentName}},</p>
      <p>Um novo ticket foi atribuído a você:</p>
      
      <h3>{{ticketSubject}}</h3>
      <p><strong>Contato:</strong> {{contactName}}</p>
      <p><strong>Fila:</strong> {{queueName}}</p>
      <p><strong>Criado em:</strong> {{createdAt}}</p>
      
      <a href="{{ticketUrl}}" class="button">Ver Ticket</a>
    </div>
  </div>
</body>
</html>
```

#### **2. Email Service**

**Service: `emailService.js`**
```javascript
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  async sendEmail(to, subject, template, data) {
    const html = await this.renderTemplate(template, data);
    
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject,
      html
    };
    
    return await this.transporter.sendMail(mailOptions);
  }
  
  async renderTemplate(templateName, data) {
    const templatePath = path.join(__dirname, '../templates/email', `${templateName}.hbs`);
    const source = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(source);
    return template(data);
  }
  
  async sendTicketAssigned(ticket, agent) {
    return await this.sendEmail(
      agent.email,
      'Novo Ticket Atribuído',
      'ticket_assigned',
      {
        agentName: agent.name,
        ticketSubject: ticket.subject,
        contactName: ticket.contact.name,
        queueName: ticket.queue.name,
        createdAt: ticket.createdAt,
        ticketUrl: `${process.env.APP_URL}/admin#tickets/${ticket.id}`
      }
    );
  }
}
```

#### **3. Email Queue**

**Para envios em massa:**
```javascript
const Queue = require('bull');
const emailQueue = new Queue('email', {
  redis: {
    host: '127.0.0.1',
    port: 6379
  }
});

emailQueue.process(async (job) => {
  const { to, subject, template, data } = job.data;
  await emailService.sendEmail(to, subject, template, data);
});

// Adicionar à fila
emailQueue.add({
  to: 'user@example.com',
  subject: 'Test',
  template: 'test',
  data: {}
});
```

---

## 🚀 **INICIANDO FASE 5A - WEBHOOKS**

Vamos começar com o módulo mais crítico!

### **Próximos Passos:**
1. ✅ Criar modelo `WebhookSQL.js`
2. ✅ Criar service `webhookService.js`
3. ✅ Criar controller `webhooksController.js`
4. ✅ Criar rotas
5. ✅ Integrar com eventos do sistema
6. ✅ Criar logs de webhooks
7. ✅ Criar retry mechanism

---

## 📊 **ESTATÍSTICAS DA FASE 5**

### **Estimativa de Implementação:**

| Módulo | Complexidade | Tempo Estimado | Prioridade |
|--------|--------------|----------------|------------|
| 5A - Webhooks | Alta | 4-5 dias | 🔥 Alta |
| 5B - Push | Média | 3-4 dias | 🟡 Média |
| 5C - Alertas | Alta | 4-5 dias | 🔥 Alta |
| 5D - Integrações | Alta | 5-7 dias | 🟡 Média |
| 5E - Email | Baixa | 2-3 dias | 🟡 Média |

**TOTAL ESTIMADO: 18-24 dias de desenvolvimento**

---

**🎉 FASE 5 - PRONTA PARA INÍCIO! 🎉**

