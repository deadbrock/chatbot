# 🗄️ Setup com SQLite (Desenvolvimento Local)

## ✅ Vantagens do SQLite

- ✅ **Sem instalação**: Banco de dados em arquivo único
- ✅ **Zero configuração**: Funciona imediatamente
- ✅ **Portátil**: Arquivo `database.sqlite` pode ser copiado
- ✅ **Perfeito para desenvolvimento**: Rápido e simples
- ✅ **Sem dependências externas**: Não precisa de MongoDB, Redis, etc.

---

## 🚀 Instalação Rápida

### 1️⃣ Instalar Dependências

```powershell
cd chatbot-whatsapp
npm install
```

### 2️⃣ Executar Setup

```powershell
npm run setup
```

**Isso irá:**
- Criar arquivo `database.sqlite` automaticamente
- Criar tabelas necessárias
- Criar usuário admin padrão

### 3️⃣ Iniciar o Bot

```powershell
npm start
```

---

## 📝 Arquivo .env Simplificado

Crie um arquivo `.env` na raiz do projeto com este conteúdo mínimo:

```env
# Servidor
PORT=3000
NODE_ENV=development

# JWT (pode manter esta chave)
JWT_SECRET=chatbot_jwt_secret_2024

# WhatsApp
WHATSAPP_SESSION_NAME=chatbot-session
WHATSAPP_TIMEOUT=60000

# Atendimento
MAX_SIMULTANEOUS_CHATS=50
INACTIVITY_TIMEOUT=300000
AUTO_CLOSE_TICKET_HOURS=24
```

**Pronto! Não precisa configurar:**
- ❌ MongoDB
- ❌ Redis
- ❌ OpenAI
- ❌ Google Cloud

---

## 🎯 O Que Foi Removido/Simplificado

### ❌ Removido (Por Enquanto)
- OpenAI/ChatGPT (aguardando aprovação da diretoria)
- Google Cloud Speech-to-Text
- Google Cloud Text-to-Speech
- MongoDB
- Redis

### ✅ Substituído Por
- **SQLite** - Banco de dados local em arquivo
- **Sistema de Respostas Simples** - Baseado em palavras-chave (sem IA)
- **Cache em Memória** - NodeCache (substitui Redis)

---

## 🤖 Como Funciona Sem IA

O bot agora usa um **sistema inteligente de palavras-chave**:

### Detecção Automática
```javascript
Cliente: "Olá"
Bot: Detecta saudação → Responde com boas-vindas

Cliente: "Preciso rastrear minha entrega"
Bot: Detecta palavra "rastrear" → Direciona para Logística

Cliente: "Quero fazer um orçamento"
Bot: Detecta "orçamento" → Direciona para Comercial
```

### Recursos Disponíveis
- ✅ Detecção de departamentos por palavras-chave
- ✅ Análise de sentimento básica
- ✅ Respostas contextuais
- ✅ Menu interativo
- ✅ Sistema de tickets completo
- ✅ Transferência para atendente humano
- ✅ Histórico de conversas

---

## 📊 Banco de Dados SQLite

### Arquivo
```
chatbot-whatsapp/database.sqlite
```

### Tabelas Criadas
- `Tickets` - Sistema de tickets
- `Sessions` - Sessões de conversação
- `Users` - Usuários e atendentes

### Visualizar Dados

**Opção 1 - DB Browser for SQLite:**
1. Baixe: https://sqlitebrowser.org/
2. Abra o arquivo `database.sqlite`
3. Visualize e edite dados

**Opção 2 - VSCode Extension:**
1. Instale: "SQLite Viewer"
2. Clique no arquivo `database.sqlite`

---

## 🔄 Migração Futura

Quando a diretoria aprovar, você pode facilmente migrar para:

### Para Adicionar IA (ChatGPT)
```bash
npm install openai
```

Descomente código em:
- `src/bot/messageHandler.js`
- `src/bot/aiEngine.js`

### Para Adicionar MongoDB
```bash
npm install mongoose
```

Substitua imports de:
- `models/TicketSQL.js` → `models/Ticket.js`
- `models/SessionSQL.js` → `models/Session.js`
- `models/UserSQL.js` → `models/User.js`

---

## ✅ Checklist de Funcionamento

Verifique se tudo está funcionando:

- [ ] `npm run setup` executou sem erros
- [ ] Arquivo `database.sqlite` foi criado
- [ ] `npm start` iniciou o servidor
- [ ] QR Code apareceu no terminal
- [ ] WhatsApp conectou com sucesso
- [ ] Bot responde mensagens
- [ ] Dashboard abre em `http://localhost:3000/admin`

---

## 🆘 Solução de Problemas

### Erro: "Cannot find module 'sequelize'"
```powershell
npm install
```

### Erro: "database.sqlite is locked"
Feche qualquer programa que esteja acessando o banco e reinicie:
```powershell
npm start
```

### Erro: "QR Code não aparece"
```powershell
# Limpar sessão antiga
Remove-Item -Recurse -Force .wwebjs_auth
Remove-Item -Recurse -Force .wwebjs_cache
npm start
```

### Resetar Banco de Dados
```powershell
# Deletar banco e recriar
Remove-Item database.sqlite
npm run setup
```

---

## 📈 Performance

### Capacidade do SQLite
- ✅ Suporta milhares de tickets
- ✅ Rápido para desenvolvimento
- ✅ Adequado para até ~100 usuários simultâneos

### Quando Migrar para MongoDB?
Considere migrar quando:
- Mais de 100 usuários simultâneos
- Mais de 10.000 tickets
- Necessidade de replicação
- Deploy em múltiplos servidores

---

## 💡 Dicas

1. **Backup Regular**: Copie `database.sqlite` periodicamente
2. **Desenvolvimento**: SQLite é perfeito para testes
3. **Produção Pequena**: Funciona bem para empresas pequenas
4. **Migração Fácil**: Dados podem ser exportados depois

---

## 🎉 Pronto!

Seu chatbot está funcionando **SEM** dependências externas!

```powershell
npm run setup
npm start
```

**Simples assim!** 🚀

---

## 📞 Próximos Passos

1. ✅ Teste o bot enviando mensagens
2. ✅ Acesse o dashboard
3. ✅ Personalize mensagens em `src/config/messages.js`
4. ✅ Ajuste departamentos em `src/config/departments.js`
5. ⏳ Aguarde aprovação da diretoria para IA

