# 🚨 CORREÇÃO URGENTE - ERROS DE API

**Data:** 17/12/2025  
**Prioridade:** CRÍTICA

---

## 🐛 PROBLEMAS IDENTIFICADOS

### **1. URL DUPLICADA: `/api/api/...`**

**Causa:**
As views estão chamando endpoints com `/api/` no início:
```javascript
// ERRADO ❌
apiFetch('/api/campaigns')  // Resulta em: /api/api/campaigns
apiFetch('/api/tickets')    // Resulta em: /api/api/tickets
```

**Motivo:**
O `apiFetch` em `api.js` já adiciona `/api` automaticamente:
```javascript
const API_BASE_URL = '/api';
fetch(API_BASE_URL + endpoint, ...)  // Adiciona /api
```

---

### **2. PORTA ERRADA: `localhost:3002`**

**Causa:**
O Socket.IO no `chatView.js` está tentando conectar na porta 3002, mas o servidor está na 3001.

---

### **3. ELEMENTO HTML FALTANDO no Dashboard**

**Causa:**
O `dashboardView.js` tenta acessar elementos que não existem no HTML.

---

## ✅ SOLUÇÕES

### **SOLUÇÃO 1: Corrigir Chamadas da API**

Todas as views devem chamar endpoints **SEM o prefixo `/api`**:

```javascript
// ❌ ERRADO
apiFetch('/api/campaigns')
apiFetch('/api/tickets')
apiFetch('/api/webhooks')

// ✅ CORRETO
apiFetch('/campaigns')
apiFetch('/tickets')
apiFetch('/webhooks')
```

#### **Arquivos que precisam ser corrigidos:**

1. **`src/dashboard/public/app/views/campaignsView.js`**
   - Linha ~34: `/api/campaigns` → `/campaigns`

2. **`src/dashboard/public/app/views/broadcastsView.js`**
   - Linha ~27: `/api/broadcasts` → `/broadcasts`
   - Linha ~41: `/api/broadcasts/lists/all` → `/broadcasts/lists/all`

3. **`src/dashboard/public/app/views/automationsView.js`**
   - Linha ~84: `/api/campaign-flows` → `/campaign-flows`

4. **`src/dashboard/public/app/views/chatView.js`**
   - Linha ~236: `/api/tickets` → `/tickets`

5. **`src/dashboard/public/app/views/webhooksView.js`**
   - Linha ~52: `/api/webhooks/events` → `/webhooks/events`
   - Linha ~83: `/api/webhooks` → `/webhooks`

6. **`src/dashboard/public/app/views/executiveDashboardView.js`**
   - Linha ~112: `/api/dashboard/kpis` → `/dashboard/kpis`
   - Linha ~127: `/api/dashboard/executive` → `/dashboard/executive`  
   - Linha ~142: `/api/dashboard/heatmap` → `/dashboard/heatmap`
   - Linha ~157: `/api/dashboard/performance` → `/dashboard/performance`

7. **`src/dashboard/public/app/views/administrationView.js`**
   - Verificar todas as chamadas `apiFetch`

---

### **SOLUÇÃO 2: Corrigir Porta do Socket.IO**

**Arquivo:** `src/dashboard/public/app/views/chatView.js`

**Localizar (linha ~44):**
```javascript
const socket = io('ws://localhost:3002');
```

**Substituir por:**
```javascript
// Usar a mesma origem do frontend (localhost:3001)
const socket = io();
// OU especificar a porta correta:
// const socket = io('http://localhost:3001');
```

---

### **SOLUÇÃO 3: Adicionar Elementos Faltantes no Dashboard**

**Arquivo:** `src/dashboard/public/index.html`

Verificar se a seção `dashboardSection` tem todos os elementos necessários.

---

## 🔧 CORREÇÃO RÁPIDA (REGEX)

Para corrigir todas as views de uma vez, use Find & Replace no VSCode:

**Find (Regex ativado):**
```regex
apiFetch\(['"]/api/
```

**Replace:**
```
apiFetch('/
```

Isso vai mudar:
- `apiFetch('/api/campaigns'` → `apiFetch('/campaigns'`
- `apiFetch("/api/tickets"` → `apiFetch("/tickets"`
- E assim por diante...

---

## 📝 SCRIPT DE CORREÇÃO AUTOMÁTICA

Se preferir, use este comando no terminal (Linux/Mac/Git Bash):

```bash
cd src/dashboard/public/app/views

# Corrigir todos os arquivos .js
find . -name "*.js" -type f -exec sed -i "s|apiFetch('/api/|apiFetch('/|g" {} \;
find . -name "*.js" -type f -exec sed -i 's|apiFetch("/api/|apiFetch("/|g' {} \;
```

**Windows PowerShell:**
```powershell
cd src\dashboard\public\app\views

Get-ChildItem -Filter *.js -Recurse | ForEach-Object {
    (Get-Content $_.FullName) -replace "apiFetch\(['\`"]/api/", "apiFetch('/" | 
    Set-Content $_.FullName
}
```

---

## ✅ CHECKLIST DE CORREÇÃO

### **Passo 1: Corrigir URLs da API**
- [ ] campaignsView.js
- [ ] broadcastsView.js
- [ ] automationsView.js
- [ ] chatView.js
- [ ] webhooksView.js
- [ ] executiveDashboardView.js
- [ ] administrationView.js
- [ ] Todos os outros arquivos em `app/views/`

### **Passo 2: Corrigir Socket.IO**
- [ ] chatView.js - porta corrigida

### **Passo 3: Verificar Elementos HTML**
- [ ] dashboardSection com todos os elementos

### **Passo 4: Testar**
- [ ] Reiniciar servidor
- [ ] Limpar cache
- [ ] Recarregar página
- [ ] Testar cada seção

---

## 🚀 APÓS CORREÇÃO

1. **Reinicie o servidor:**
   ```bash
   npm start
   ```

2. **Limpe o cache completamente:**
   - `Ctrl + Shift + Del`
   - Marque tudo
   - Limpe

3. **Force reload:**
   - `Ctrl + Shift + R`

4. **Verifique o console:**
   - Não deve ter mais `404`
   - Não deve ter `/api/api/`

---

## 🔍 VERIFICAÇÃO

No console do navegador (F12), execute:

```javascript
// Testar endpoint correto
apiFetch('/campaigns').then(console.log).catch(console.error);

// Deve retornar dados ou erro de autenticação
// NÃO deve ser 404
```

---

## 📊 RESUMO

| Problema | Causa | Solução |
|----------|-------|---------|
| `/api/api/` | Prefixo duplicado | Remover `/api` das views |
| Porta 3002 | Socket.IO errado | Usar `io()` ou porta 3001 |
| Elementos null | HTML faltando | Adicionar elementos |

---

## 💡 PREVENÇÃO FUTURA

Para evitar este erro novamente:

1. **Sempre chame `apiFetch` sem `/api`:**
   ```javascript
   // ✅ CORRETO
   apiFetch('/endpoint')
   ```

2. **Socket.IO sem porta:**
   ```javascript
   // ✅ CORRETO - Usa mesma origem
   const socket = io();
   ```

3. **Verificar elementos antes de usar:**
   ```javascript
   const element = document.getElementById('myElement');
   if (element) {
     element.textContent = 'valor';
   } else {
     console.error('Elemento myElement não encontrado');
   }
   ```

---

**🎯 PRIORIDADE: Corrija TODOS os endpoints antes de testar!**

Use Find & Replace global para economizar tempo.

---

**Última atualização:** 17/12/2025  
**Status:** Aguardando correção

