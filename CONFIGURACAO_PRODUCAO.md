# ⚙️ Configuração para Produção - AstroChat

## ✅ Configurações Aplicadas no Código

Todas as configurações necessárias para produção foram aplicadas automaticamente no código:

### 1. **Detecção Automática de Ambiente**
- ✅ Frontend detecta automaticamente se está em produção ou desenvolvimento
- ✅ API URL configurável via meta tag ou script tag
- ✅ Socket.IO usa a mesma URL da API automaticamente

### 2. **CORS Configurado**
- ✅ Permite requisições do Vercel em produção
- ✅ Configurável via variável `ALLOWED_ORIGINS` no Railway
- ✅ Em desenvolvimento, permite qualquer origem

### 3. **Banco de Dados PostgreSQL**
- ✅ SSL habilitado automaticamente em produção
- ✅ Connection pooling configurado
- ✅ Suporta `DATABASE_URL` (padrão Railway)

### 4. **Socket.IO**
- ✅ Conecta automaticamente ao servidor correto
- ✅ Usa mesma URL da API em produção
- ✅ Reconexão automática configurada

---

## 🔧 Configurações Necessárias no Railway

### Variáveis de Ambiente Obrigatórias

```env
# Banco de Dados (criado automaticamente pelo Railway)
DATABASE_URL=<gerado automaticamente>

# Ou configure manualmente:
DB_DIALECT=postgres
DB_SSL=true
DB_HOST=<host do railway>
DB_PORT=5432
DB_NAME=<nome do banco>
DB_USER=<usuário>
DB_PASSWORD=<senha>

# Servidor
PORT=3000
NODE_ENV=production

# JWT (OBRIGATÓRIO - gere uma chave forte!)
JWT_SECRET=<gere-uma-chave-secreta-forte>

# WhatsApp
WHATSAPP_SESSION_NAME=chatbot-session
WHATSAPP_TIMEOUT=60000

# Atendimento
INACTIVITY_TIMEOUT=300000
AUTO_CLOSE_TICKET_HOURS=24

# CORS (após deploy do Vercel, adicione a URL aqui)
ALLOWED_ORIGINS=https://seu-projeto.vercel.app
```

### Gerar JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🌐 Configurações Necessárias no Vercel

### Variáveis de Ambiente

```env
# URL da API do Railway
API_URL=https://seu-projeto.up.railway.app/api
```

**OU** configure via HTML (meta tag):

Edite `src/dashboard/public/index.html` e adicione:

```html
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

**OU** configure via script tag:

Edite `src/dashboard/public/index.html` e atualize:

```html
<script id="api-config" type="application/json">
{
  "apiUrl": "https://seu-projeto.up.railway.app"
}
</script>
```

---

## 📝 Checklist de Configuração

### Railway
- [ ] `DATABASE_URL` configurada (automática)
- [ ] `DB_DIALECT=postgres` configurada
- [ ] `DB_SSL=true` configurada (ou deixe vazio - será true automaticamente em produção)
- [ ] `NODE_ENV=production` configurada
- [ ] `JWT_SECRET` configurada (chave forte gerada)
- [ ] `ALLOWED_ORIGINS` configurada com URL do Vercel (após deploy)

### Vercel
- [ ] `API_URL` configurada com URL do Railway
- [ ] **OU** meta tag `api-url` adicionada no HTML
- [ ] **OU** script tag `api-config` atualizado no HTML

### Código
- [ ] ✅ Detecção automática de ambiente - **JÁ CONFIGURADO**
- [ ] ✅ CORS flexível - **JÁ CONFIGURADO**
- [ ] ✅ PostgreSQL com SSL - **JÁ CONFIGURADO**
- [ ] ✅ Socket.IO automático - **JÁ CONFIGURADO**

---

## 🚀 Como Configurar a URL da API

### Opção 1: Variável de Ambiente no Vercel (Recomendado)

1. Vá em **Settings** → **Environment Variables**
2. Adicione:
   - **Nome**: `API_URL`
   - **Valor**: `https://seu-projeto.up.railway.app/api`
3. Faça redeploy

### Opção 2: Meta Tag no HTML

Edite `src/dashboard/public/index.html`:

```html
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

### Opção 3: Script Tag no HTML

Edite `src/dashboard/public/index.html`:

```html
<script id="api-config" type="application/json">
{
  "apiUrl": "https://seu-projeto.up.railway.app"
}
</script>
```

---

## ✅ Verificação

Após configurar tudo:

1. **Railway**:
   - Acesse: `https://seu-projeto.up.railway.app/health`
   - Deve retornar: `{"status":"ok",...}`

2. **Vercel**:
   - Acesse: `https://seu-projeto.vercel.app/admin`
   - Abra o console (F12)
   - Deve mostrar: `🔗 API Base URL: https://seu-projeto.up.railway.app/api`

3. **Teste de Login**:
   - Faça login no dashboard
   - Verifique se os dados carregam

---

## 🐛 Troubleshooting

### Frontend não conecta com API

**Sintoma**: Erro no console `Failed to fetch` ou `CORS error`

**Solução**:
1. Verifique se `API_URL` está configurada no Vercel
2. Verifique se meta tag está no HTML
3. Verifique se URL do Railway está correta
4. Verifique CORS no Railway (`ALLOWED_ORIGINS`)

### Socket.IO não conecta

**Sintoma**: `Socket.IO desconectado` no console

**Solução**:
1. Socket.IO usa a mesma URL da API
2. Configure a URL da API primeiro
3. Verifique se o Railway está rodando
4. Verifique logs do Railway

### Erro 401 (Não autorizado)

**Sintoma**: Login não funciona

**Solução**:
1. Verifique `JWT_SECRET` no Railway
2. Verifique se token está sendo enviado
3. Verifique logs do Railway

### Erro de banco de dados

**Sintoma**: `Connection refused` ou `SSL required`

**Solução**:
1. Verifique `DATABASE_URL` no Railway
2. Configure `DB_SSL=true` (ou deixe vazio - será true automaticamente)
3. Verifique logs do Railway

---

## 📞 Próximos Passos

1. Configure as variáveis de ambiente no Railway
2. Configure a URL da API no Vercel (ou HTML)
3. Faça deploy do Vercel
4. Teste o sistema completo
5. Configure domínio customizado (opcional)

---

**Tudo pronto! O código está configurado para produção! 🎉**
