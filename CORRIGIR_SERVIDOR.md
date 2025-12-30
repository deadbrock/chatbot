# 🚨 CORREÇÃO: Servidor Encerrando Imediatamente

## ❌ **PROBLEMA IDENTIFICADO:**

O servidor está falhando devido a **dependências obrigatórias faltando**:

1. **`OPENAI_API_KEY` não configurada** (erro fatal em `aiEngine.js`)
2. **Módulo `@google-cloud/speech` faltando** (erro fatal em `voiceService.js`)

---

## ✅ **SOLUÇÃO RÁPIDA:**

### **OPÇÃO 1: Desabilitar AI temporariamente (Recomendado)**

Edite o arquivo `.env` e adicione:

```env
# Desabilitar AI temporariamente
ENABLE_AI=false
ENABLE_VOICE=false

# Ou adicione uma chave dummy
OPENAI_API_KEY=sk-dummy-key-for-testing
```

Depois, modifique os arquivos para não quebrar quando AI não estiver disponível:

#### **1. src/bot/aiEngine.js**

No início do arquivo, adicione verificação:

```javascript
if (!process.env.OPENAI_API_KEY || process.env.ENABLE_AI === 'false') {
  console.warn('⚠️ AI Engine desabilitado (OPENAI_API_KEY não configurada)');
  module.exports = {
    // Mock do AI Engine
    classifyIntent: async () => ({ intent: 'unknown', confidence: 0 }),
    generateResponse: async () => 'Desculpe, o assistente AI não está disponível.',
    // ... outros métodos mock
  };
  return;
}

const { Configuration, OpenAIApi } = require('openai');
// ... resto do código
```

#### **2. src/services/voiceService.js**

No início do arquivo:

```javascript
if (process.env.ENABLE_VOICE === 'false') {
  console.warn('⚠️ Voice Service desabilitado');
  module.exports = {
    transcribeAudio: async () => ({ text: '', confidence: 0 }),
  };
  return;
}

const speech = require('@google-cloud/speech');
// ... resto do código
```

---

### **OPÇÃO 2: Instalar dependências faltantes**

```bash
npm install openai @google-cloud/speech
```

E configure as chaves no `.env`:

```env
OPENAI_API_KEY=sk-sua-chave-real-aqui
GOOGLE_APPLICATION_CREDENTIALS=./path/to/google-credentials.json
```

---

### **OPÇÃO 3: Comentar imports problemáticos**

#### **Em `src/bot/messageHandler.js`** (linha 2):

```javascript
// const aiEngine = require('./aiEngine');  // ❌ Comentar temporariamente
```

#### **Em `src/server.js`** ou onde `voiceService` é importado:

```javascript
// const voiceService = require('./services/voiceService');  // ❌ Comentar
```

---

## 🔧 **CORREÇÃO AUTOMÁTICA:**

Criei um script para você. Execute:

```bash
cd C:\Users\user\Documents\chatFG\chatbot-whatsapp
node fix-ai-dependencies.js
```

**OU manualmente:**

1. Abra `.env`
2. Adicione estas linhas:

```env
ENABLE_AI=false
ENABLE_VOICE=false
OPENAI_API_KEY=sk-dummy
```

3. Reinicie:

```bash
npm start
```

---

## 📝 **VERIFICAR SE FUNCIONOU:**

O servidor deve iniciar mostrando:

```
⚠️ AI Engine desabilitado (OPENAI_API_KEY não configurada)
⚠️ Voice Service desabilitado
🚀 Servidor rodando na porta 3001
✅ Banco sincronizado com sucesso!
```

---

## 💡 **PARA USAR AI NO FUTURO:**

1. Obtenha uma chave OpenAI: https://platform.openai.com/api-keys
2. Configure no `.env`:
   ```env
   OPENAI_API_KEY=sk-sua-chave-real
   ENABLE_AI=true
   ```
3. Instale: `npm install openai`
4. Reinicie o servidor

---

**🎯 Use a OPÇÃO 1 para iniciar rapidamente sem AI!**

