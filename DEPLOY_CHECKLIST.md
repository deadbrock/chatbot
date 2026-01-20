# ✅ Checklist de Deploy - AstroChat

## 📋 Pré-Deploy

- [ ] Código commitado no Git
- [ ] Repositório GitHub criado e atualizado
- [ ] `.env` não está commitado (verificar `.gitignore`)
- [ ] Todas as dependências estão no `package.json`
- [ ] Testes locais passando

---

## 🚂 Railway (Backend + PostgreSQL)

### Setup Inicial
- [ ] Conta Railway criada
- [ ] Projeto Railway criado
- [ ] Repositório conectado ao Railway
- [ ] PostgreSQL adicionado ao projeto

### Variáveis de Ambiente
- [ ] `DATABASE_URL` configurada (automática do Railway)
- [ ] `DB_DIALECT=postgres` configurada
- [ ] `DB_SSL=true` configurada
- [ ] `PORT=3000` configurada
- [ ] `NODE_ENV=production` configurada
- [ ] `JWT_SECRET` configurada (chave forte gerada)
- [ ] `WHATSAPP_SESSION_NAME=chatbot-session` configurada
- [ ] `WHATSAPP_TIMEOUT=60000` configurada
- [ ] `INACTIVITY_TIMEOUT=300000` configurada
- [ ] `AUTO_CLOSE_TICKET_HOURS=24` configurada
- [ ] `ALLOWED_ORIGINS` configurada (domínio Vercel)

### Deploy
- [ ] Build executado com sucesso
- [ ] Servidor iniciado sem erros
- [ ] URL do Railway anotada: `https://________________.up.railway.app`
- [ ] Health check funcionando: `/health`
- [ ] API respondendo: `/api/status`

### Verificação
- [ ] Logs do Railway sem erros críticos
- [ ] Banco de dados conectado
- [ ] Migrações executadas (se necessário)
- [ ] CORS configurado corretamente

---

## 🌐 Vercel (Frontend)

### Setup Inicial
- [ ] Conta Vercel criada
- [ ] Projeto Vercel criado
- [ ] Repositório conectado ao Vercel
- [ ] Framework: "Other" selecionado
- [ ] Root Directory: `src/dashboard/public`
- [ ] Build Command: (vazio)
- [ ] Output Directory: `.`

### Variáveis de Ambiente
- [ ] `API_URL` configurada com URL do Railway
  - Valor: `https://seu-projeto.up.railway.app/api`

### Configuração do Frontend
- [ ] Meta tag `api-url` atualizada no `index.html` (ou variável de ambiente)
- [ ] `api.js` configurado para usar API externa

### Deploy
- [ ] Build executado com sucesso
- [ ] URL do Vercel anotada: `https://________________.vercel.app`
- [ ] Página carrega sem erros no console

### Verificação
- [ ] Login funcionando
- [ ] Requisições API chegando ao Railway
- [ ] Dashboard carregando dados
- [ ] Socket.IO conectando (se aplicável)
- [ ] Sem erros CORS no console

---

## 🔗 Integração

### CORS
- [ ] Backend permite requisições do domínio Vercel
- [ ] `ALLOWED_ORIGINS` inclui URL do Vercel
- [ ] Teste de requisição cross-origin funcionando

### API
- [ ] Frontend consegue fazer requisições ao Railway
- [ ] Autenticação funcionando
- [ ] Tokens sendo enviados corretamente
- [ ] Respostas da API chegando ao frontend

### Socket.IO (se aplicável)
- [ ] WebSocket conectando ao Railway
- [ ] Eventos em tempo real funcionando

---

## 🔒 Segurança

- [ ] `JWT_SECRET` forte e único
- [ ] `.env` não commitado
- [ ] Credenciais não expostas no código
- [ ] HTTPS habilitado (Railway e Vercel)
- [ ] CORS configurado apenas para domínios permitidos

---

## 📝 Documentação

- [ ] URLs de produção documentadas
- [ ] Variáveis de ambiente documentadas
- [ ] Processo de deploy documentado
- [ ] Troubleshooting documentado

---

## 🎯 Pós-Deploy

- [ ] Teste completo do sistema em produção
- [ ] Backup do banco de dados configurado
- [ ] Monitoramento configurado
- [ ] Alertas configurados (opcional)
- [ ] Domínio customizado configurado (opcional)

---

## 🐛 Troubleshooting

Se algo não funcionar:

1. **Frontend não conecta com API**:
   - [ ] Verificar `API_URL` no Vercel
   - [ ] Verificar CORS no Railway
   - [ ] Verificar console do navegador (F12)

2. **Erro 401 (Não autorizado)**:
   - [ ] Verificar `JWT_SECRET` no Railway
   - [ ] Verificar se token está sendo enviado
   - [ ] Verificar logs do Railway

3. **Erro de conexão com banco**:
   - [ ] Verificar `DATABASE_URL` no Railway
   - [ ] Verificar `DB_SSL=true`
   - [ ] Verificar logs do Railway

4. **Build falha**:
   - [ ] Verificar logs de build
   - [ ] Verificar dependências no `package.json`
   - [ ] Verificar Node.js version

---

**Data do Deploy**: _______________
**URL Railway**: https://________________.up.railway.app
**URL Vercel**: https://________________.vercel.app
**Status**: ⬜ Em andamento | ⬜ Concluído | ⬜ Com problemas
