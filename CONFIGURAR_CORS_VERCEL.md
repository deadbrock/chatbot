# 🔧 Configurar CORS para Vercel + Railway

## 🚨 **PROBLEMA**

```
Access to fetch at 'Railway URL' from origin 'Vercel URL' 
has been blocked by CORS policy
```

**Causa:** O Railway não está permitindo requisições do domínio do Vercel.

---

## ✅ **SOLUÇÃO: Configurar ALLOWED_ORIGINS no Railway**

### **1. Acesse o Railway**
- https://railway.app
- Vá no projeto **AstroChat**
- Clique na aba **Variables**

### **2. Adicione a Variável**

**Nome da variável:**
```
ALLOWED_ORIGINS
```

**Valor (copie EXATAMENTE assim):**
```
https://chatbot-three-bay.vercel.app
```

> ⚠️ **IMPORTANTE:** 
> - NÃO adicione barra `/` no final
> - Use HTTPS (não HTTP)
> - Cole EXATAMENTE o domínio do Vercel

### **3. Salvar e Redeployar**

1. Clique em **Add** ou **Save**
2. O Railway vai **redeployar automaticamente**
3. Aguarde 2-3 minutos

---

## 🎯 **DOMÍNIOS A ADICIONAR**

Se você tiver múltiplos domínios (produção + preview), separe por vírgula:

```
https://chatbot-three-bay.vercel.app,https://chatbot-preview.vercel.app
```

---

## 🔍 **VERIFICAR SE FUNCIONOU**

Após o redeploy:

1. Abra o Console do navegador (F12)
2. Recarregue a página do Vercel
3. **Antes (com erro):**
   ```
   ❌ blocked by CORS policy
   ```

4. **Depois (funcionando):**
   ```
   ✅ 200 OK
   ```

---

## 💡 **ALTERNATIVA TEMPORÁRIA**

Se você quiser permitir **QUALQUER** origem temporariamente (não recomendado para produção):

**NO RAILWAY:**
- **REMOVA** ou **DEIXE VAZIO** a variável `ALLOWED_ORIGINS`
- O sistema vai permitir todas as origens automaticamente

⚠️ **Atenção:** Isso é menos seguro, use apenas para testes!

---

## 🎯 **CONFIGURAÇÃO FINAL RECOMENDADA**

### **Variáveis no Railway:**

| Variável | Valor |
|----------|-------|
| `ALLOWED_ORIGINS` | `https://chatbot-three-bay.vercel.app` |
| `API_URL` | `https://web-production-ea053.up.railway.app/api` |
| `NODE_ENV` | `production` |
| `GROQ_API_KEY` | `gsk_...` (sua key) |
| `DATABASE_URL` | (automático do Railway) |
| `JWT_SECRET` | (seu secret) |

---

## 🚀 **DEPLOY AUTOMÁTICO**

O Railway detecta mudanças em variáveis de ambiente e redeploya automaticamente.

**Tempo estimado: 2-3 minutos** ⏰
