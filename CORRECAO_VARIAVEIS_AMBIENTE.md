# 🔧 Correção de Variáveis de Ambiente

## ❌ Problemas Identificados

### 1. **ALLOWED_ORIGINS no Railway está INCORRETO**

**Valor atual (ERRADO):**
```
https://vercel.com/douglas-projects-c2be5a2b/astrochat
```

**Problema:** Esta é a URL do painel do Vercel, não a URL do seu projeto deployado.

**Solução:** Você precisa obter a URL real do seu projeto Vercel e atualizar.

### 2. **Erro 405 (Method Not Allowed)**

O erro 405 indica que:
- A rota pode não estar aceitando o método HTTP correto
- Pode haver problema de CORS bloqueando a requisição
- A URL pode estar incorreta

## ✅ Soluções

### Passo 1: Obter URL Correta do Vercel

1. Acesse o Vercel
2. Vá para o projeto "astrochat"
3. Na aba "Deployments", clique no deployment mais recente
4. Copie a URL (algo como: `https://astrochat-xxx.vercel.app` ou `https://astrochat-douglas-projects.vercel.app`)

### Passo 2: Atualizar ALLOWED_ORIGINS no Railway

1. Acesse o Railway
2. Vá para o serviço "AstroChat"
3. Aba "Variables"
4. Encontre `ALLOWED_ORIGINS`
5. Edite e coloque a URL correta do Vercel:
   ```
   https://astrochat-xxx.vercel.app
   ```
   **OU** se você tem múltiplas URLs (produção + preview):
   ```
   https://astrochat-xxx.vercel.app,https://astrochat-git-xxx.vercel.app
   ```

### Passo 3: Verificar Variáveis no Railway

Certifique-se de que estas variáveis estão configuradas:

✅ **DATABASE_URL** - Já configurado (PostgreSQL)
✅ **JWT_SECRET** - Já configurado
✅ **NODE_ENV** - Deve ser `production`
✅ **ALLOWED_ORIGINS** - **CORRIGIR** com URL do Vercel

### Passo 4: Verificar se o Servidor Está Online

Teste se a API está respondendo:

1. Acesse: `https://web-production-ea053.up.railway.app/api/users/login`
2. Deve retornar um erro de método (isso é normal - significa que a rota existe)
3. Se retornar 404, há problema na configuração das rotas

### Passo 5: Verificar CORS no Código

O código já está configurado para aceitar origens via `ALLOWED_ORIGINS`. Verifique se está funcionando corretamente.

## 🔍 Debug

### Teste Manual da API

Abra o console do navegador (F12) e execute:

```javascript
fetch('https://web-production-ea053.up.railway.app/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' })
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
```

Se retornar erro de CORS, o problema está no `ALLOWED_ORIGINS`.

## 📝 Checklist

- [ ] Obter URL correta do projeto Vercel
- [ ] Atualizar `ALLOWED_ORIGINS` no Railway com URL do Vercel
- [ ] Verificar se `NODE_ENV=production` no Railway
- [ ] Testar login novamente
- [ ] Verificar logs do Railway para erros
