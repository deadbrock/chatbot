# 🔌 API Reference

Documentação completa da API REST do Chatbot WhatsApp.

## Base URL

```
http://localhost:3000/api
```

## Autenticação

A maioria dos endpoints requer autenticação via JWT Token.

### Login

```http
POST /api/users/login
```

**Request Body:**
```json
{
  "email": "admin@admin.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Administrador",
      "email": "admin@admin.com",
      "role": "admin"
    }
  }
}
```

### Usar Token

Inclua o token no header de todas as requisições:

```http
Authorization: Bearer {seu_token_aqui}
```

---

## 📋 Tickets

### Listar Tickets

```http
GET /api/tickets
```

**Query Parameters:**
- `status` (opcional): Filtrar por status
- `department` (opcional): Filtrar por departamento
- `limit` (opcional): Limite de resultados (padrão: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "protocol": "TKT1234567890",
      "userId": "5511999999999@c.us",
      "userName": "João Silva",
      "department": "Comercial",
      "status": "open",
      "priority": "medium",
      "createdAt": "2024-12-15T10:30:00.000Z",
      "messages": [],
      "rating": null
    }
  ]
}
```

### Obter Ticket Específico

```http
GET /api/tickets/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "protocol": "TKT1234567890",
    "userId": "5511999999999@c.us",
    "userName": "João Silva",
    "userPhone": "5511999999999",
    "department": "Comercial",
    "departmentId": "comercial",
    "status": "open",
    "priority": "medium",
    "messages": [
      {
        "from": "5511999999999@c.us",
        "message": "Olá, preciso de um orçamento",
        "type": "text",
        "timestamp": "2024-12-15T10:30:00.000Z",
        "isBot": false
      }
    ],
    "createdAt": "2024-12-15T10:30:00.000Z",
    "updatedAt": "2024-12-15T10:35:00.000Z"
  }
}
```

### Criar Ticket

```http
POST /api/tickets
```

**Request Body:**
```json
{
  "userId": "5511999999999@c.us",
  "userName": "João Silva",
  "userPhone": "5511999999999",
  "department": "Comercial",
  "departmentId": "comercial",
  "subject": "Solicitação de Orçamento",
  "description": "Cliente solicita orçamento para produto X",
  "priority": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "protocol": "TKT1234567890",
    "userId": "5511999999999@c.us",
    "status": "open",
    "createdAt": "2024-12-15T10:30:00.000Z"
  }
}
```

### Atualizar Ticket

```http
PATCH /api/tickets/:id
```

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "507f1f77bcf86cd799439012"
}
```

### Atribuir Ticket

```http
POST /api/tickets/:id/assign
```

**Request Body:**
```json
{
  "agentId": "507f1f77bcf86cd799439012"
}
```

### Fechar Ticket

```http
POST /api/tickets/:id/close
```

**Request Body:**
```json
{
  "feedback": "Problema resolvido com sucesso"
}
```

### Estatísticas de Tickets

```http
GET /api/tickets/stats/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "open": 25,
    "inProgress": 10,
    "resolved": 80,
    "closed": 35,
    "avgRating": 4.5,
    "avgResponseTime": 180000
  }
}
```

---

## 💬 Sessões

### Listar Sessões Ativas

```http
GET /api/sessions
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "5511999999999@c.us",
      "data": {
        "userName": "João Silva",
        "userPhone": "5511999999999",
        "welcomed": true,
        "currentDepartment": "comercial",
        "lastInteraction": "2024-12-15T10:35:00.000Z",
        "interactionCount": 5
      },
      "active": true,
      "createdAt": "2024-12-15T10:30:00.000Z"
    }
  ]
}
```

### Obter Sessão Específica

```http
GET /api/sessions/:userId
```

### Expirar Sessão

```http
DELETE /api/sessions/:userId
```

### Estatísticas de Sessões

```http
GET /api/sessions/stats/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "active": 15,
    "total": 250,
    "averageInteractions": 8.5
  }
}
```

---

## 👥 Usuários

### Listar Usuários

```http
GET /api/users
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "role": "agent",
      "department": "Comercial",
      "status": "online",
      "stats": {
        "ticketsHandled": 45,
        "averageRating": 4.7
      }
    }
  ]
}
```

### Atendentes Disponíveis

```http
GET /api/users/agents/available?department=comercial
```

### Criar Usuário

```http
POST /api/users
```

**Request Body:**
```json
{
  "name": "Maria Santos",
  "email": "maria@empresa.com",
  "password": "senha123",
  "role": "agent",
  "department": "Comercial",
  "departmentId": "comercial"
}
```

### Atualizar Status

```http
PATCH /api/users/:id/status
```

**Request Body:**
```json
{
  "status": "online"
}
```

**Status disponíveis:** `online`, `offline`, `busy`, `away`

---

## 📊 Analytics

### Dashboard Principal

```http
GET /api/analytics/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketsToday": 25,
    "ticketsOpen": 15,
    "sessionsActive": 8,
    "agentsOnline": 5,
    "avgRating": 4.5,
    "avgResponseTime": 180000
  }
}
```

### Tickets por Departamento

```http
GET /api/analytics/tickets/by-department
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Comercial",
      "count": 45,
      "open": 12,
      "closed": 33
    },
    {
      "_id": "Suporte",
      "count": 38,
      "open": 8,
      "closed": 30
    }
  ]
}
```

### Tickets por Status

```http
GET /api/analytics/tickets/by-status
```

### Timeline de Tickets

```http
GET /api/analytics/tickets/timeline?days=30
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "2024-12-01",
      "count": 15
    },
    {
      "_id": "2024-12-02",
      "count": 18
    }
  ]
}
```

### Distribuição de Avaliações

```http
GET /api/analytics/ratings
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "_id": 5, "count": 45 },
    { "_id": 4, "count": 30 },
    { "_id": 3, "count": 10 },
    { "_id": 2, "count": 3 },
    { "_id": 1, "count": 2 }
  ]
}
```

### Performance dos Atendentes

```http
GET /api/analytics/agents/performance
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "agentName": "João Silva",
      "totalTickets": 45,
      "avgRating": 4.7,
      "resolved": 42
    }
  ]
}
```

---

## 🔔 Webhook

### Receber Webhook

```http
POST /api/webhook
```

**Request Body:**
```json
{
  "event": "ticket_created",
  "data": {
    "ticketId": "507f1f77bcf86cd799439011",
    "protocol": "TKT1234567890"
  }
}
```

### Testar Webhook

```http
GET /api/webhook/test
```

---

## 🏥 Health Check

### Status do Sistema

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "whatsapp": true,
  "mongodb": true,
  "redis": true
}
```

### Status da API

```http
GET /api/status
```

**Response:**
```json
{
  "status": "online",
  "timestamp": "2024-12-15T10:30:00.000Z",
  "uptime": 3600
}
```

---

## ❌ Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 500 | Erro interno do servidor |

**Formato de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro descritiva"
}
```

---

## 🔐 Rate Limiting

A API possui rate limiting para prevenir abuso:

- **Limite:** 100 requisições por minuto por IP
- **Header de resposta:** `X-RateLimit-Remaining`

---

## 📝 Exemplos de Uso

### JavaScript (Fetch)

```javascript
const token = 'seu_token_aqui';

async function getTickets() {
  const response = await fetch('http://localhost:3000/api/tickets', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log(data);
}
```

### Python (Requests)

```python
import requests

token = 'seu_token_aqui'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'http://localhost:3000/api/tickets',
    headers=headers
)

data = response.json()
print(data)
```

### cURL

```bash
curl -X GET \
  http://localhost:3000/api/tickets \
  -H 'Authorization: Bearer seu_token_aqui' \
  -H 'Content-Type: application/json'
```

---

## 📚 Recursos Adicionais

- [Guia de Instalação](./INSTALLATION.md)
- [Guia de Uso](./USAGE.md)
- [README](./README.md)

---

**API Version:** 1.0.0  
**Última Atualização:** Dezembro 2024

