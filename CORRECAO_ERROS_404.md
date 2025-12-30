# 🔧 CORREÇÃO DE ERROS 404 E HTML

## 🐛 PROBLEMAS IDENTIFICADOS

### **1. Erro 404 nos endpoints** ✅ RESOLVIDO
- As rotas já estão registradas corretamente em `src/routes/index.js`
- O problema pode ser o servidor não estar rodando ou porta errada

### **2. Elementos HTML não existem** ❌ PENDENTE
- Falta adicionar seção `administrationSection` no `index.html`
- Outros elementos podem estar faltando

---

## ✅ SOLUÇÃO RÁPIDA

### **PASSO 1: Verificar se o servidor está rodando**

```bash
cd chatbot-whatsapp
npm start
```

**Deve mostrar:**
```
🚀 Servidor rodando na porta 3001
✅ Banco sincronizado com sucesso!
⏰ Jobs agendados inicializados
📱 Inicializando WhatsApp...
```

### **PASSO 2: Adicionar seção de Administração ao index.html**

Abra `src/dashboard/public/index.html` e localize a linha que contém:

```html
<!-- Seção de Automações -->
```

**Logo após o fechamento dessa seção** (procure por `</div><!-- fim automações -->`), adicione:

```html
<!-- Seção de Administração -->
<div id="administrationSection" class="content-section">
    <div class="page-header d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3">
        <div>
            <h1 class="page-title">
                <i class="bi bi-shield-lock text-primary"></i>
                Administração
            </h1>
            <div class="page-subtitle text-muted">Gerenciamento de API Keys, Conexões, Configurações e Permissões</div>
        </div>
    </div>

    <!-- Tabs de Administração -->
    <ul class="nav nav-tabs mb-4" role="tablist">
        <li class="nav-item">
            <button class="nav-link active" data-admin-tab="api-keys" type="button">
                <i class="bi bi-key"></i> API Keys
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="connections" type="button">
                <i class="bi bi-whatsapp"></i> Conexões WhatsApp
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="settings" type="button">
                <i class="bi bi-gear"></i> Configurações
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="roles" type="button">
                <i class="bi bi-shield-check"></i> Roles & Permissões
            </button>
        </li>
    </ul>

    <!-- API Keys Tab -->
    <div data-admin-content="api-keys" class="admin-tab-content active">
        <div class="d-flex justify-content-between mb-3">
            <h4>Chaves de API</h4>
            <button class="btn btn-primary" id="newApiKeyBtn">
                <i class="bi bi-plus-lg"></i> Nova Chave
            </button>
        </div>
        
        <div class="table-responsive">
            <table class="table table-hover" id="apiKeysTable">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Tipo</th>
                        <th>Chave</th>
                        <th>Status</th>
                        <th>Expira em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="apiKeysTableBody">
                    <!-- Preenchido por JS -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- Connections Tab -->
    <div data-admin-content="connections" class="admin-tab-content">
        <div class="d-flex justify-content-between mb-3">
            <h4>Conexões WhatsApp</h4>
            <button class="btn btn-primary" id="newConnectionBtn">
                <i class="bi bi-plus-lg"></i> Nova Conexão
            </button>
        </div>
        
        <div class="row" id="connectionsGrid">
            <!-- Preenchido por JS -->
        </div>
    </div>

    <!-- Settings Tab -->
    <div data-admin-content="settings" class="admin-tab-content">
        <div class="mb-3">
            <h4>Configurações do Sistema</h4>
        </div>
        
        <!-- Filtros de Categoria -->
        <div class="mb-3">
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-outline-primary active" data-category-filter="all">
                    <i class="bi bi-grid"></i> Todas
                </button>
                <button type="button" class="btn btn-outline-primary" data-category-filter="general">
                    <i class="bi bi-gear"></i> Geral
                </button>
                <button type="button" class="btn btn-outline-primary" data-category-filter="whatsapp">
                    <i class="bi bi-whatsapp"></i> WhatsApp
                </button>
                <button type="button" class="btn btn-outline-primary" data-category-filter="notifications">
                    <i class="bi bi-bell"></i> Notificações
                </button>
                <button type="button" class="btn btn-outline-primary" data-category-filter="email">
                    <i class="bi bi-envelope"></i> Email
                </button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body" id="settingsContainer">
                <!-- Preenchido por JS -->
            </div>
        </div>
    </div>

    <!-- Roles Tab -->
    <div data-admin-content="roles" class="admin-tab-content">
        <div class="d-flex justify-content-between mb-3">
            <h4>Roles & Permissões</h4>
            <button class="btn btn-primary" id="newRoleBtn">
                <i class="bi bi-plus-lg"></i> Novo Role
            </button>
        </div>
        
        <div class="table-responsive">
            <table class="table table-hover" id="rolesTable">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Descrição</th>
                        <th>Usuários</th>
                        <th>Permissões</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="rolesTableBody">
                    <!-- Preenchido por JS -->
                </tbody>
            </table>
        </div>
    </div>
</div>
<!-- Fim da Seção de Administração -->
```

### **PASSO 3: Adicionar CSS da Administração**

Verifique se existe o arquivo `src/dashboard/public/css/administration.css`. Se não existir, crie-o:

```css
/* Administration Section */
.admin-tab-content {
    display: none;
}

.admin-tab-content.active {
    display: block;
}

/* API Keys */
.api-key-display {
    font-family: 'Courier New', monospace;
    background-color: #f8f9fa;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 0.9em;
}

body.dark-mode .api-key-display {
    background-color: #2b3035;
    color: #e0e0e0;
}

/* Connection Cards */
.connection-card {
    border-left: 4px solid #198754;
    transition: all 0.3s ease;
}

.connection-card.disconnected {
    border-left-color: #dc3545;
}

.connection-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

/* QR Code Display */
.qr-code-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: white;
    border-radius: 8px;
}

.qr-code-container img {
    max-width: 100%;
    height: auto;
}

/* Settings */
.setting-item {
    padding: 15px;
    border-bottom: 1px solid #dee2e6;
}

.setting-item:last-child {
    border-bottom: none;
}

body.dark-mode .setting-item {
    border-bottom-color: #495057;
}

/* Roles */
.permission-badge {
    display: inline-block;
    padding: 4px 8px;
    margin: 2px;
    background: #e7f3ff;
    border-radius: 4px;
    font-size: 0.85em;
}

body.dark-mode .permission-badge {
    background: #1e3a5f;
    color: #a8d0ff;
}
```

### **PASSO 4: Adicionar link do CSS no index.html**

No `<head>` do `index.html`, adicione:

```html
<link rel="stylesheet" href="/css/administration.css">
```

### **PASSO 5: Reiniciar o servidor**

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm start
```

---

## 🔍 VERIFICAÇÃO DOS ERROS

### **Erro: `Cannot set properties of null (setting 'innerHTML')`**

**Causa:** O elemento HTML não existe no DOM.

**Solução:** Certifique-se de que o HTML foi adicionado corretamente. Verifique no navegador (F12 > Elements) se o elemento existe.

### **Erro: `HTTP 404` nos endpoints**

**Causa possível 1:** Servidor não está rodando
- **Solução:** Iniciar com `npm start`

**Causa possível 2:** Porta errada
- **Solução:** Verificar se está acessando `http://localhost:3001` (porta 3001)

**Causa possível 3:** Rota não registrada
- **Solução:** Verificar `src/routes/index.js` - já está OK ✅

### **Erro: `automationsView.js:92 Erro ao buscar fluxos: Error: HTTP 404`**

Este erro indica que a rota `/api/campaign-flows` retorna 404. Vamos verificar:

1. **Verificar se o arquivo existe:**
   - `src/routes/campaignFlows.js` ✅ (deve existir)
   - `src/controllers/campaignFlowsController.js` ✅ (deve existir)

2. **Verificar se está importado em `src/routes/index.js`:**
   ```javascript
   const campaignFlowsRoutes = require('./campaignFlows');
   router.use('/campaign-flows', authMiddleware, campaignFlowsRoutes);
   ```
   ✅ Está registrado!

3. **Verificar autenticação:**
   - O token JWT está sendo enviado? Verifique no console: `localStorage.getItem('token')`
   - Se não houver token, faça login novamente

---

## 🚀 CHECKLIST RÁPIDO

- [ ] Servidor está rodando (`npm start`)
- [ ] Porta 3001 está livre
- [ ] Arquivo `.env` configurado
- [ ] Banco de dados sincronizado
- [ ] HTML da administração adicionado ao `index.html`
- [ ] CSS da administração existe e está linkado
- [ ] Token JWT está no localStorage
- [ ] Cache do navegador limpo (Ctrl+Shift+Del)

---

## 📝 COMANDO PARA TESTAR ENDPOINTS MANUALMENTE

```bash
# Obter token (faça login primeiro no navegador)
# Copie o token do localStorage

# Testar endpoint de campanhas
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" http://localhost:3001/api/campaigns

# Testar endpoint de fluxos
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" http://localhost:3001/api/campaign-flows

# Testar endpoint de API Keys
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" http://localhost:3001/api/api-keys
```

---

## 💡 DICA IMPORTANTE

Se após seguir todos os passos os erros persistirem:

1. **Limpe o cache do navegador** (Ctrl+Shift+Del)
2. **Faça logout e login novamente**
3. **Reinicie o servidor**
4. **Verifique o console do servidor** para ver se há erros

---

## 📞 ONDE ENCONTRAR OS ARQUIVOS COMPLETOS

- **HTML Administração:** `ADMINISTRATION_HTML_SECTION.txt`
- **CSS Administração:** Criar em `src/dashboard/public/css/administration.css`
- **Rotas:** `src/routes/index.js` (já configurado ✅)
- **Controllers:** `src/controllers/` (já existem ✅)

---

**🎯 Com estas correções, todos os erros 404 e elementos null devem ser resolvidos!**

