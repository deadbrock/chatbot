# Correções: WhatsApp Timeout e Estabilidade do Servidor

## Problema Identificado

O servidor estava **encerrando imediatamente** após iniciar devido a dois problemas:

### 1. **Dependência faltando**: `groq-sdk`
- **Arquivo**: `src/controllers/aiPlaygroundController.js`
- **Erro**: `require('groq-sdk')` causava crash no startup
- **Solução**: Comentado o `require` e desabilitada a função `testMessage` (retorna 503)

### 2. **Timeout do QR Code derrubando o servidor**
- **Arquivo**: `src/bot/whatsapp-wppconnect.js`
- **Erro**: Quando o QR Code expirava (60s), gerava `unhandledRejection: "Auto Close Called"` que derrubava o processo
- **Solução aplicada**:
  - ✅ Aumentado `autoClose` de **60s → 180s** (3 minutos)
  - ✅ Removido `throw error` no catch do `initialize()` (agora retorna `null`)
  - ✅ Adicionado tratamento de `qrReadError` e `autocloseCalled` no callback `statusFind`
  - ✅ Adicionado `try/catch` nos callbacks `catchQR` e `statusFind`
  - ✅ Servidor **continua rodando** mesmo se o WhatsApp falhar

## Comportamento Atual (Corrigido)

### ✅ Servidor inicia normalmente
- Banco de dados conecta (SQLite ou Postgres via `DATABASE_URL`)
- Dashboard fica disponível em `http://localhost:3000/admin`
- API REST funciona normalmente

### ✅ WhatsApp não bloqueia o servidor
- Se o QR Code expirar, o servidor **não cai**
- Sistema tenta reconectar automaticamente (5 tentativas)
- Dashboard continua funcionando mesmo sem WhatsApp conectado

### ✅ Logs informativos
```
⚠️ Erro ao ler QR Code ou timeout. O servidor continua funcionando.
⚠️ O servidor continuará rodando, mas o WhatsApp não estará disponível.
⚠️ Para tentar novamente, reinicie o servidor ou use a API de reconexão.
```

## Como Usar

### 1. **Iniciar o servidor**
```bash
npm start
```

### 2. **Escanear o QR Code**
- Você tem **3 minutos** para escanear o QR Code que aparece no terminal
- Abra o WhatsApp no celular → **Aparelhos conectados** → **Conectar um aparelho**
- Escaneie o QR Code

### 3. **Se o QR Code expirar**
- O servidor **não vai cair**
- Ele tentará reconectar automaticamente (até 5 vezes)
- Ou você pode reiniciar manualmente: `npm start`

## Arquivos Modificados

1. `src/controllers/aiPlaygroundController.js`
   - Comentado `require('groq-sdk')`
   - Desabilitada função `testMessage` (retorna 503)

2. `src/bot/whatsapp-wppconnect.js`
   - `autoClose: 60000` → `autoClose: 180000`
   - Removido `throw error` no catch
   - Adicionado tratamento de `qrReadError` e `autocloseCalled`
   - Adicionado `try/catch` nos callbacks

3. `src/config/database.js` (preparação AWS)
   - Suporte a Postgres via `DATABASE_URL`
   - Suporte a SSL (`DB_SSL=true`)

4. `package.json`
   - Adicionado `pg` e `pg-hstore`
   - Adicionado script `migrate:sqlite-to-postgres`

5. `docs/AWS_EC2_RDS_SETUP.md` (novo)
   - Checklist completo para deploy na AWS

## Próximos Passos

### Para habilitar IA (opcional)
```bash
npm install groq-sdk
```
Depois, descomente a linha 2 em `src/controllers/aiPlaygroundController.js` e restaure a função `testMessage`.

### Para deploy na AWS
Siga o guia em `docs/AWS_EC2_RDS_SETUP.md`:
1. Criar RDS PostgreSQL
2. Criar EC2
3. Configurar Security Groups
4. Configurar `.env` com `DATABASE_URL`
5. Rodar `npm run migrate:sqlite-to-postgres` (se tiver dados locais)

## Status Atual

✅ **Servidor estável** (não cai mais por timeout do WhatsApp)  
✅ **Dashboard funcionando** (`http://localhost:3000/admin`)  
✅ **Pronto para deploy na AWS** (suporte a Postgres configurado)  
⚠️ **WhatsApp aguardando QR Code** (3 minutos de timeout)  
⚠️ **IA desabilitada** (aguardando instalação do `groq-sdk`)

---

**Data**: 2026-01-16  
**Versão**: 1.0.0
