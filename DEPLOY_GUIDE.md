# 🚀 Guia de Deploy - AstroChat

## 📋 Visão Geral

Este guia explica como fazer deploy do **AstroChat** em:
- **Railway** → Backend (Node.js) + Banco de Dados PostgreSQL
- **Vercel** → Frontend (arquivos estáticos)

---

## 🏗️ Arquitetura de Deploy

```
┌─────────────────┐         ┌─────────────────┐
│     Vercel      │         │    Railway      │
│   (Frontend)    │ ──────► │   (Backend)    │
│                 │   API   │   + PostgreSQL │
└─────────────────┘         └─────────────────┘
```

---

## 📦 PARTE 1: Deploy no Railway (Backend + PostgreSQL)

### 1.1 Criar Conta e Projeto

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique em **"New Project"**
4. Selecione **"Deploy from GitHub repo"**
5. Conecte seu repositório

### 1.2 Adicionar Banco de Dados PostgreSQL

1. No projeto Railway, clique em **"+ New"**
2. Selecione **"Database"** → **"Add PostgreSQL"**
3. Aguarde a criação do banco
4. Railway criará automaticamente a variável `DATABASE_URL`

### 1.3 Configurar Variáveis de Ambiente

No Railway, vá em **"Variables"** e adicione:

```env
# Banco de Dados (já criado automaticamente pelo Railway)
DATABASE_URL=<gerado automaticamente>

# Ou configure manualmente:
DB_DIALECT=postgres
DB_HOST=<host do railway>
DB_PORT=5432
DB_NAME=<nome do banco>
DB_USER=<usuário>
DB_PASSWORD=<senha>
DB_SSL=true

# Servidor
PORT=3000
NODE_ENV=production

# JWT (OBRIGATÓRIO - gere uma chave segura!)
JWT_SECRET=<gere-uma-chave-secreta-forte-aqui>

# WhatsApp
WHATSAPP_SESSION_NAME=chatbot-session
WHATSAPP_TIMEOUT=60000

# Atendimento
INACTIVITY_TIMEOUT=300000
AUTO_CLOSE_TICKET_HOURS=24
```

**⚠️ IMPORTANTE**: Gere um `JWT_SECRET` forte:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 1.4 Configurar Build e Deploy

O Railway detectará automaticamente:
- `package.json` → Instalará dependências
- `Procfile` ou `railway.json` → Comando de start
- Porta → Usará a variável `PORT` ou porta padrão

### 1.5 Verificar Deploy

1. Após o deploy, Railway fornecerá uma URL (ex: `https://seu-projeto.up.railway.app`)
2. Teste a API: `https://seu-projeto.up.railway.app/api/status`
3. Teste o health: `https://seu-projeto.up.railway.app/health`

**Anote a URL do Railway** - você precisará dela para configurar o Vercel!

---

## 🌐 PARTE 2: Deploy no Vercel (Frontend)

### 2.1 Criar Conta e Projeto

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique em **"Add New Project"**
4. Conecte o mesmo repositório
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `src/dashboard/public`
   - **Build Command**: (deixe vazio - arquivos estáticos)
   - **Output Directory**: `.` (ponto)

### 2.2 Configurar Variáveis de Ambiente

No Vercel, vá em **"Settings"** → **"Environment Variables"** e adicione:

```env
# URL da API do Railway (OBRIGATÓRIO!)
VITE_API_URL=https://seu-projeto.up.railway.app
# ou
REACT_APP_API_URL=https://seu-projeto.up.railway.app
```

**⚠️ IMPORTANTE**: Substitua `https://seu-projeto.up.railway.app` pela URL real do seu Railway!

### 2.3 Atualizar Frontend para Usar API Externa

O frontend precisa apontar para a API do Railway. Vamos configurar isso:

**Opção A**: Usar variável de ambiente (recomendado)
**Opção B**: Configurar diretamente no código

### 2.4 Deploy

1. Clique em **"Deploy"**
2. Aguarde o build
3. Vercel fornecerá uma URL (ex: `https://seu-projeto.vercel.app`)

---

## 🔧 PARTE 3: Configurar Frontend para API Externa

### 3.1 Atualizar `api.js`

O arquivo `src/dashboard/public/app/api.js` precisa usar a URL da API do Railway.

**Opção 1**: Usar variável de ambiente (se usar build tool)
**Opção 2**: Detectar automaticamente
**Opção 3**: Configurar manualmente

Vamos usar a **Opção 2** (detecção automática):

```javascript
// Se estiver em produção (Vercel), usar API do Railway
// Se estiver em desenvolvimento, usar localhost
const API_BASE_URL = window.location.hostname.includes('vercel.app') 
  ? 'https://seu-projeto.up.railway.app/api'
  : '/api';
```

### 3.2 Configurar CORS no Railway

O backend precisa permitir requisições do Vercel. O código já tem `cors()`, mas vamos garantir:

```javascript
app.use(cors({
  origin: [
    'https://seu-projeto.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));
```

---

## ✅ PARTE 4: Verificação Final

### Checklist

- [ ] Railway deployado e funcionando
- [ ] PostgreSQL criado e conectado
- [ ] Variáveis de ambiente configuradas no Railway
- [ ] API respondendo: `https://seu-projeto.up.railway.app/api/status`
- [ ] Vercel deployado
- [ ] Variável `VITE_API_URL` ou `REACT_APP_API_URL` configurada no Vercel
- [ ] Frontend atualizado para usar API do Railway
- [ ] CORS configurado no backend
- [ ] Teste de login funcionando
- [ ] Teste de criação de ticket funcionando

### Testes

1. **API Health Check**:
   ```bash
   curl https://seu-projeto.up.railway.app/health
   ```

2. **Frontend**:
   - Acesse: `https://seu-projeto.vercel.app/admin`
   - Faça login
   - Verifique se os dados carregam da API

---

## 🔒 Segurança

### Variáveis Sensíveis

**NUNCA** commite no Git:
- `.env`
- `JWT_SECRET`
- `DATABASE_URL` (com senha)
- Credenciais de produção

### Recomendações

1. Use variáveis de ambiente nas plataformas
2. Gere `JWT_SECRET` forte e único
3. Configure CORS apenas para domínios permitidos
4. Use HTTPS sempre (Railway e Vercel já fornecem)
5. Configure rate limiting no backend
6. Monitore logs de erro

---

## 🐛 Troubleshooting

### Problema: Frontend não conecta com API

**Solução**:
1. Verifique a variável `VITE_API_URL` no Vercel
2. Verifique CORS no backend
3. Verifique console do navegador (F12) para erros

### Problema: Erro 401 (Não autorizado)

**Solução**:
1. Verifique se `JWT_SECRET` está configurado
2. Verifique se o token está sendo enviado corretamente
3. Verifique logs do Railway

### Problema: Erro de conexão com banco

**Solução**:
1. Verifique `DATABASE_URL` no Railway
2. Verifique se `DB_SSL=true` está configurado
3. Verifique logs do Railway para detalhes

### Problema: Build falha no Railway

**Solução**:
1. Verifique logs de build
2. Verifique se todas as dependências estão no `package.json`
3. Verifique se `node_modules` não está no `.gitignore` incorretamente

---

## 📝 Próximos Passos

1. **Domínio Customizado**:
   - Configure domínio no Railway
   - Configure domínio no Vercel
   - Atualize variáveis de ambiente

2. **CI/CD**:
   - Configure deploy automático no push
   - Configure testes antes do deploy

3. **Monitoramento**:
   - Configure logs no Railway
   - Configure analytics no Vercel
   - Configure alertas de erro

4. **Backup**:
   - Configure backup automático do PostgreSQL
   - Configure backup de arquivos importantes

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Railway
2. Verifique os logs no Vercel
3. Verifique o console do navegador (F12)
4. Consulte a documentação:
   - [Railway Docs](https://docs.railway.app)
   - [Vercel Docs](https://vercel.com/docs)

---

**Boa sorte com o deploy! 🚀**
