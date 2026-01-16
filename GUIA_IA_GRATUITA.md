# 🆓 Guia: IA Gratuita (Alternativas à OpenAI)

## ✨ Opções GRATUITAS Implementadas

### **1. Google Gemini (RECOMENDADO)**

**Por que usar:**
- ✅ **Completamente GRÁTIS**
- ✅ 60 requisições/minuto
- ✅ Muito preciso (comparável ao GPT-4)
- ✅ API simples

**Como configurar:**

1. **Obter API Key:**
   - Acesse: https://makersuite.google.com/app/apikey
   - Faça login com conta Google
   - Clique em "Create API Key"
   - Copie a chave (começa com `AIza...`)

2. **Adicionar no sistema:**
   ```env
   # Arquivo .env
   AI_API_KEY=AIzaSy...sua_chave_aqui
   ```

3. **Configurar no painel:**
   - Vá em: **Configurações → IA Inteligente**
   - **Provider**: Selecione "Google Gemini (GRÁTIS)"
   - **Modelo**: "Gemini Pro"
   - **API Key**: Deixe em branco (já está no .env)
   - **Ativar Sistema Híbrido**: ✅ ATIVE
   - Clique em **Salvar**

---

### **2. Groq (SUPER RÁPIDO)**

**Por que usar:**
- ✅ **Grátis** (14.400 requisições/dia)
- ✅ **10x mais rápido** que GPT
- ✅ Usa modelos open-source potentes

**Como configurar:**

1. **Obter API Key:**
   - Acesse: https://console.groq.com/keys
   - Crie uma conta
   - Clique em "Create API Key"
   - Copie a chave (começa com `gsk_...`)

2. **Adicionar no sistema:**
   ```env
   # Arquivo .env
   AI_API_KEY=gsk_...sua_chave_aqui
   ```

3. **Configurar no painel:**
   - Vá em: **Configurações → IA Inteligente**
   - **Provider**: Selecione "Groq (GRÁTIS + RÁPIDO)"
   - **Modelo**: "Mixtral 8x7B"
   - **Ativar Sistema Híbrido**: ✅ ATIVE
   - Clique em **Salvar**

---

## 📊 Comparação

| Provider | Custo | Limite Grátis | Velocidade | Precisão |
|----------|-------|---------------|------------|----------|
| **Gemini** | 🆓 Grátis | 60/min | Médio | ⭐⭐⭐⭐⭐ |
| **Groq** | 🆓 Grátis | 14.400/dia | Muito rápido | ⭐⭐⭐⭐ |
| **OpenAI** | 💰 Pago | Nenhum | Médio | ⭐⭐⭐⭐⭐ |

---

## 🚀 Teste Rápido

Depois de configurar, teste no painel:

1. Vá em **Configurações → IA Inteligente**
2. Clique em **"Testar IA"**
3. Digite: "preciso tirar férias"
4. Veja o resultado!

---

## ❓ FAQ

### **Gemini vs Groq - Qual escolher?**

- **Gemini**: Melhor precisão, mais confiável
- **Groq**: Muito mais rápido, bom para alto volume

**Recomendação**: Comece com **Gemini**!

### **E se o limite gratuito acabar?**

Ambos têm limites generosos:
- **Gemini**: 60 requisições/minuto = 86.400/dia
- **Groq**: 14.400 requisições/dia

Para um chatbot, é mais do que suficiente!

### **Posso alternar entre os providers?**

Sim! É só trocar no painel e salvar.

---

## ✅ Resumo dos Passos

1. **Escolha um provider** (Gemini ou Groq)
2. **Obtenha API Key** (links acima)
3. **Adicione no `.env`**
4. **Configure no painel**
5. **Ative o sistema**
6. **Teste!**

---

## 🎉 Pronto!

Agora você tem IA de qualidade **100% GRATUITA** no seu chatbot! 

Quando tiver recursos, pode migrar para OpenAI se quiser, mas Gemini e Groq são excelentes! 🚀

