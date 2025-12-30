# 🚀 GUIA DE INICIALIZAÇÃO RÁPIDA

**Use este guia para resolver TODOS os erros de uma vez!**

---

## ⚡ SOLUÇÃO RÁPIDA (5 MINUTOS)

### **PASSO 1: Parar o servidor se estiver rodando**
```bash
# Pressione Ctrl+C no terminal onde o servidor está rodando
```

### **PASSO 2: Verificar/Criar arquivo .env**

Certifique-se de que existe o arquivo `.env` na raiz do projeto com:

```env
PORT=3001
JWT_SECRET=seu-secret-super-seguro-aqui-mude-em-producao
DB_PATH=./database.sqlite
NODE_ENV=development
TZ=America/Sao_Paulo
WHATSAPP_SESSION_PATH=./sessions
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **PASSO 3: Reiniciar o servidor**
```bash
cd chatbot-whatsapp
npm start
```

Aguarde até ver:
```
🚀 Servidor rodando na porta 3001
✅ Banco sincronizado com sucesso!
⏰ Jobs agendados inicializados
```

### **PASSO 4: Abrir o navegador**
```
http://localhost:3001/login.html
```

### **PASSO 5: Fazer login**
```
Email: admin@example.com
Senha: Admin@123
```

### **PASSO 6: Verificar se funciona**
- ✅ Dashboard deve carregar
- ✅ Menu lateral deve funcionar
- ✅ Sem erros no console (F12)

---

## 🔧 SE AINDA HOUVER ERROS

### **Erro: "Cannot set properties of null"**

Significa que falta HTML. Siga este passo:

1. Abra: `chatbot-whatsapp/src/dashboard/public/index.html`

2. Procure por: `<!-- Seção de Chat -->`

3. Logo após o fechamento dessa seção (procure `</div><!-- fim chat -->`), adicione:

```html
<!-- Seção de Administração -->
<div id="administrationSection" class="content-section">
    <h2>Administração</h2>
    
    <!-- Tabs -->
    <ul class="nav nav-tabs mb-4">
        <li class="nav-item">
            <button class="nav-link active" data-admin-tab="api-keys">API Keys</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="connections">Conexões</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="settings">Configurações</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-admin-tab="roles">Roles</button>
        </li>
    </ul>
    
    <!-- Conteúdo das Tabs -->
    <div data-admin-content="api-keys" class="admin-tab-content active">
        <button class="btn btn-primary mb-3" id="newApiKeyBtn">Nova API Key</button>
        <div id="apiKeysTableBody"></div>
    </div>
    
    <div data-admin-content="connections" class="admin-tab-content">
        <button class="btn btn-primary mb-3" id="newConnectionBtn">Nova Conexão</button>
        <div id="connectionsGrid"></div>
    </div>
    
    <div data-admin-content="settings" class="admin-tab-content">
        <div id="settingsContainer"></div>
    </div>
    
    <div data-admin-content="roles" class="admin-tab-content">
        <button class="btn btn-primary mb-3" id="newRoleBtn">Novo Role</button>
        <div id="rolesTableBody"></div>
    </div>
</div>
```

4. Salve o arquivo

5. Limpe o cache do navegador:
   - Pressione `Ctrl + Shift + Del`
   - Marque "Cache de imagens e arquivos"
   - Clique em "Limpar dados"

6. Recarregue a página: `F5` ou `Ctrl + R`

---

### **Erro: "404 Not Found" nos endpoints**

**Causa:** Token JWT expirado ou servidor não está rodando.

**Solução:**

1. Verifique se o servidor está rodando (veja PASSO 3 acima)

2. Faça logout e login novamente:
   - Console do navegador (F12)
   - Digite: `localStorage.clear()`
   - Pressione Enter
   - Vá para: `http://localhost:3001/login.html`
   - Faça login novamente

---

## 📋 CHECKLIST COMPLETO

Marque conforme for completando:

**Servidor:**
- [ ] Arquivo `.env` existe e está configurado
- [ ] Servidor iniciado com `npm start`
- [ ] Sem erros no console do servidor
- [ ] Porta 3001 acessível

**Frontend:**
- [ ] HTML da administração adicionado (se necessário)
- [ ] Cache do navegador limpo
- [ ] Login realizado com sucesso
- [ ] Token JWT salvo no localStorage

**Testes:**
- [ ] Dashboard carrega sem erros
- [ ] Menu lateral funciona
- [ ] Console do navegador (F12) sem erros vermelho
- [ ] Pode navegar entre seções

---

## 🎯 TESTE RÁPIDO

Execute isto no console do navegador (F12):

```javascript
// 1. Verificar token
console.log('Token existe?', !!localStorage.getItem('token'));

// 2. Testar API
fetch('/api/status')
  .then(r => r.json())
  .then(d => console.log('API Status:', d))
  .catch(e => console.error('Erro:', e));

// 3. Verificar Moment.js
console.log('Moment.js carregado?', typeof moment !== 'undefined');

// 4. Verificar Bootstrap
console.log('Bootstrap carregado?', typeof bootstrap !== 'undefined');
```

**Resultados esperados:**
```
Token existe? true
API Status: {status: "online", timestamp: "...", uptime: 123}
Moment.js carregado? true
Bootstrap carregado? true
```

Se todos retornarem `true` e o status for "online", está tudo OK! ✅

---

## 🆘 RESOLUÇÃO DE PROBLEMAS COMUNS

### **Problema: "npm start" não funciona**
```bash
# Instalar dependências novamente
npm install

# Tentar iniciar
npm start
```

### **Problema: "Porta 3001 já em uso"**
```bash
# Windows (PowerShell como Admin)
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Ou mude a porta no .env
PORT=3002
```

### **Problema: "Banco de dados não sincroniza"**
```bash
# Deletar banco e recriar
rm database.sqlite

# Reiniciar servidor (vai recriar)
npm start
```

### **Problema: "Login não funciona"**
```bash
# Verificar se admin foi criado
# No console do servidor deve mostrar:
# ✅ Usuário admin criado
```

---

## 📞 COMANDOS ÚTEIS

### **Ver logs do servidor:**
```bash
# Linux/Mac
tail -f logs/app.log

# Windows
type logs\app.log
```

### **Testar endpoint específico:**
```bash
# Status do servidor
curl http://localhost:3001/api/status

# Com autenticação (pegue token do localStorage)
curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:3001/api/campaigns
```

### **Resetar tudo (última opção):**
```bash
# Para o servidor (Ctrl+C)

# Remove banco e node_modules
rm database.sqlite
rm -rf node_modules

# Reinstala tudo
npm install

# Inicia servidor (vai recriar banco)
npm start
```

---

## ✅ SISTEMA FUNCIONANDO

Quando tudo estiver funcionando, você verá:

**No console do servidor:**
```
🚀 Servidor rodando na porta 3001
✅ Banco sincronizado com sucesso!
✅ Usuário admin criado
⏰ Jobs agendados inicializados
📱 Inicializando WhatsApp...
```

**No navegador:**
- Dashboard carregado
- Sem erros no console (F12)
- Menu lateral funcionando
- Dados sendo exibidos

---

## 🎉 PRONTO!

Seu sistema está rodando! Explore as funcionalidades:

- 📊 **Dashboard** - Métricas gerais
- 🎫 **Tickets** - Gestão de atendimentos
- 💬 **Chat** - Interface em tempo real
- 📢 **Campanhas** - Envios em massa
- 🤖 **Automações** - Fluxos automáticos
- 🔧 **Administração** - Configurações
- 📈 **Analytics** - Relatórios e insights

---

**Tempo estimado: 5-10 minutos**
**Dificuldade: Fácil**

Qualquer dúvida, consulte:
- `CORRECOES_APLICADAS.md` - Correções detalhadas
- `README_COMPLETO.md` - Documentação completa
- `STATUS_FINAL_PROJETO.md` - Status do projeto

