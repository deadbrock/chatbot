# 🔧 Solução: WhatsApp Não Conecta / QR Code Não Funciona

## 🚨 **PROBLEMA**
O QR Code aparece na tela, mas ao escanear com o WhatsApp, nada acontece e a conexão não é estabelecida.

---

## ✅ **SOLUÇÃO RÁPIDA (Faça Agora!)**

### **Passo 1: Limpar Sessão Antiga**
A sessão antiga do WhatsApp pode estar corrompida. Vamos limpar:

```bash
# OPÇÃO A: Via API (Recomendado)
# Acesse no navegador:
https://web-production-ea053.up.railway.app/api/whatsapp/clear-session

# OPÇÃO B: Via Railway Dashboard
1. Acesse Railway.app
2. Vá no projeto AstroChat
3. Clique em "Variables"
4. Adicione uma nova variável temporária:
   FORCE_NEW_SESSION=true
5. Salve e aguarde redeploy (2-3 min)
6. Após conectar, REMOVA essa variável
```

### **Passo 2: Reiniciar Servidor**
```bash
# No Railway:
1. Vá em "Deployments"
2. Clique nos 3 pontinhos do último deploy
3. "Redeploy"
4. Aguarde 2-3 minutos
```

### **Passo 3: Testar Conexão**
```bash
1. Acesse: https://web-production-ea053.up.railway.app/admin
2. Login: admin@admin.com / admin123
3. Menu: Administração → Connections
4. Clique: "Nova Conexão"
5. Aguarde o QR Code aparecer (pode demorar 10-20s)
6. Escaneie com WhatsApp
7. IMPORTANTE: Mantenha a aba aberta até conectar!
```

---

## 🔍 **DIAGNÓSTICO COMPLETO**

### **Verificar Status do Servidor**

#### **1. Verificar se o servidor está rodando:**
```bash
# Acesse no navegador:
https://web-production-ea053.up.railway.app/api/status

# Deve retornar algo como:
{
  "status": "online",
  "timestamp": "2026-01-23T...",
  "uptime": 123.45
}
```

#### **2. Verificar logs do Railway:**
```bash
1. Acesse Railway.app
2. Projeto AstroChat
3. Clique em "View Logs"
4. Procure por erros relacionados a:
   - "QR Code"
   - "WhatsApp"
   - "WPPConnect"
   - "chromium"
```

### **Problemas Comuns e Soluções**

#### **Problema 1: "QR Code não aparece"**
**Causa:** Servidor ainda está inicializando o Chrome/Chromium

**Solução:**
```bash
- Aguarde 20-30 segundos após clicar "Nova Conexão"
- O primeiro QR Code sempre demora mais
- Veja os logs do Railway para acompanhar
```

#### **Problema 2: "QR Code expira muito rápido"**
**Causa:** QR Code do WhatsApp expira em 60 segundos

**Solução:**
```bash
- Tenha o celular em mãos ANTES de clicar "Nova Conexão"
- Clique "Atualizar QR Code" se expirar
- Escaneie rapidamente
```

#### **Problema 3: "Escaneia mas não conecta"**
**Causa:** Sessão antiga conflitando

**Solução:**
```bash
# Limpar sessão via API:
curl -X POST https://web-production-ea053.up.railway.app/api/whatsapp/clear-session

# Ou via script:
node scripts/clear-whatsapp-session.js
```

#### **Problema 4: "Erro de memória/timeout no Railway"**
**Causa:** Railway pode estar com recursos limitados

**Solução:**
```bash
1. Verifique plano do Railway (deve ter pelo menos 512MB RAM)
2. Restart o serviço
3. Se persistir, considere aumentar recursos
```

---

## 🛠️ **SCRIPTS DE CORREÇÃO**

Criei scripts para facilitar:

### **1. Limpar Sessão do WhatsApp**
```bash
cd C:\Users\user\Documents\chatbot\chatbot
node scripts/clear-whatsapp-session.js
```

### **2. Forçar Reconexão**
```bash
cd C:\Users\user\Documents\chatbot\chatbot
node scripts/force-reconnect-whatsapp.js
```

### **3. Verificar Saúde do Sistema**
```bash
cd C:\Users\user\Documents\chatbot\chatbot
node scripts/health-check.js
```

---

## 📱 **PASSO A PASSO DETALHADO**

### **Como Escanear Corretamente:**

1. **Abra o WhatsApp no celular**
2. **Vá em:**
   - Android: Menu (3 pontos) → "Aparelhos conectados" → "Conectar um aparelho"
   - iPhone: "Configurações" → "Aparelhos conectados" → "Conectar um aparelho"
3. **Aponte a câmera para o QR Code**
4. **Aguarde...**
   - ⏳ Conexão pode demorar 10-30 segundos
   - 🔄 Mantenha a aba do navegador aberta
   - ✅ Aguarde a mensagem "Conectado com sucesso!"

---

## 🔐 **VARIÁVEIS DE AMBIENTE NECESSÁRIAS**

Verifique se todas estão configuradas no Railway:

```bash
# OBRIGATÓRIAS:
NODE_ENV=production
PORT=8080
JWT_SECRET=seu_jwt_secret_aqui
DATABASE_URL=postgresql://...
GROQ_API_KEY=sua_groq_api_key_aqui

# OPCIONAIS (mas recomendadas):
DB_DIALECT=postgres
DB_SSL=true
ALLOWED_ORIGINS=https://chatbot-three-bay.vercel.app
API_URL=https://web-production-ea053.up.railway.app
```

---

## 🐛 **LOGS ÚTEIS PARA DIAGNÓSTICO**

Quando reportar problemas, inclua esses logs do Railway:

```bash
# Procure por:
"QR Code recebido"
"Iniciando WPPConnect"
"Cliente conectado"
"Erro ao gerar QR Code"
"Sessão expirada"
"chromium"
```

---

## ⚡ **SOLUÇÃO ALTERNATIVA (Se nada funcionar)**

### **Usar WhatsApp Web Diretamente (Temporário):**

Enquanto corrige o problema, você pode usar o sistema sem conexão direta:

1. **Acesse o dashboard normalmente**
2. **Configure as automações** (elas ficarão salvas)
3. **Quando conseguir conectar**, tudo funcionará automaticamente

---

## 🆘 **SUPORTE URGENTE**

Se nada funcionar, entre em contato fornecendo:

1. ✅ Print do erro no navegador (F12 → Console)
2. ✅ Logs do Railway (últimas 50 linhas)
3. ✅ Horário que tentou conectar
4. ✅ Mensagem de erro exata

---

## 📊 **CHECKLIST DE VERIFICAÇÃO**

Antes de tentar conectar novamente, verifique:

- [ ] Servidor está rodando (https://web-production-ea053.up.railway.app/api/status)
- [ ] Sessão foi limpa (`/api/whatsapp/clear-session`)
- [ ] Aguardou 20-30s após clicar "Nova Conexão"
- [ ] Aba do navegador permaneceu aberta
- [ ] WhatsApp no celular está atualizado
- [ ] Internet do celular e PC está funcionando
- [ ] Não há outro WhatsApp Web conectado (desconecte se houver)

---

## 🎯 **SOLUÇÃO DEFINITIVA**

Se o problema persistir mesmo após todas as tentativas, vamos fazer uma **reinicialização completa**:

```bash
1. Limpar todas as sessões (via Railway variables)
2. Fazer redeploy completo
3. Aguardar 5 minutos
4. Tentar nova conexão
```

**Vou criar os scripts agora para você! →**

---

**Última atualização: 23/01/2026**
