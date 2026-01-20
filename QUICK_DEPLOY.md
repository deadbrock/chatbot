# ⚡ Deploy Rápido - AstroChat

## 🎯 Resumo Executivo

Este guia rápido te ajuda a fazer deploy do AstroChat em **menos de 15 minutos**.

---

## 📦 Arquivos Criados

✅ **Configuração Railway**:
- `railway.json` - Configuração do Railway
- `railway.toml` - Configuração alternativa
- `Procfile` - Comando de start
- `.nixpacks.toml` - Configuração de build

✅ **Configuração Vercel**:
- `vercel.json` - Configuração do Vercel
- `.vercelignore` - Arquivos ignorados

✅ **Documentação**:
- `DEPLOY_GUIDE.md` - Guia completo detalhado
- `DEPLOY_CHECKLIST.md` - Checklist passo a passo
- `QUICK_DEPLOY.md` - Este arquivo (guia rápido)

---

## 🚀 Passos Rápidos

### 1️⃣ Railway (5 minutos)

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione seu repositório
4. Clique em **"+ New"** → **"Database"** → **"Add PostgreSQL"**
5. Vá em **"Variables"** e adicione:

```env
NODE_ENV=production
PORT=3000
DB_DIALECT=postgres
DB_SSL=true
JWT_SECRET=<gere-uma-chave-forte>
```

**Gerar JWT_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

6. Aguarde o deploy (Railway detecta automaticamente)
7. **Anote a URL**: `https://seu-projeto.up.railway.app`

---

### 2️⃣ Vercel (5 minutos)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte o mesmo repositório
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `src/dashboard/public`
   - **Build Command**: (deixe vazio)
   - **Output Directory**: `.`

5. Vá em **"Environment Variables"** e adicione:
   ```env
   API_URL=https://seu-projeto.up.railway.app/api
   ```
   (Substitua pela URL real do Railway!)

6. Clique em **"Deploy"**
7. **Anote a URL**: `https://seu-projeto.vercel.app`

---

### 3️⃣ Configurar Frontend (2 minutos)

**Opção A - Via Meta Tag** (Recomendado):

Edite `src/dashboard/public/index.html` e descomente/adicione:

```html
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

**Opção B - Via Código**:

Edite `src/dashboard/public/app/api.js` e descomente a linha:

```javascript
return 'https://seu-projeto.up.railway.app/api';
```

---

### 4️⃣ Configurar CORS (2 minutos)

Edite `src/server.js` e adicione sua URL do Vercel em `allowedOrigins`:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://seu-projeto.vercel.app', // ← Adicione aqui
];
```

Ou configure via variável de ambiente no Railway:

```env
ALLOWED_ORIGINS=https://seu-projeto.vercel.app
```

---

### 5️⃣ Testar (1 minuto)

1. Acesse: `https://seu-projeto.vercel.app/admin`
2. Faça login
3. Verifique se os dados carregam

---

## ✅ Verificação Rápida

- [ ] Railway deployado e respondendo
- [ ] Vercel deployado e carregando
- [ ] Frontend conectando com API
- [ ] Login funcionando
- [ ] Dados carregando

---

## 🐛 Problemas Comuns

### Frontend não conecta
→ Verifique `API_URL` no Vercel e meta tag no HTML

### Erro CORS
→ Adicione URL do Vercel em `allowedOrigins` no Railway

### Erro 401
→ Verifique `JWT_SECRET` no Railway

### Erro de banco
→ Verifique `DATABASE_URL` e `DB_SSL=true` no Railway

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `DEPLOY_GUIDE.md` - Guia completo e detalhado
- `DEPLOY_CHECKLIST.md` - Checklist completo

---

**Pronto! Seu AstroChat está no ar! 🚀**
