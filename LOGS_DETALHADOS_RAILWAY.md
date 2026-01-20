# 📋 Logs Detalhados para Railway

## ✅ Melhorias Implementadas

### 1. **Logs Iniciais Antes de Qualquer Importação**
- Logs de sistema (Node.js, plataforma, PID, diretório, memória)
- Logs de variáveis de ambiente (sem expor senhas)
- Logs de carregamento de módulos

### 2. **Proteção de Importações**
- Todas as importações críticas protegidas com try-catch
- Fallbacks para módulos não críticos (scheduler, report, snapshot)
- Logs detalhados de cada etapa de carregamento

### 3. **Logs Detalhados em Cada Etapa**
- **ETAPA 1**: Conexão com banco de dados
- **ETAPA 2**: Sincronização de modelos
- **ETAPA 3**: Configurações de administração
- **ETAPA 4**: Configuração Socket.IO
- **ETAPA 5**: Inicialização servidor HTTP
- **ETAPA 6**: Jobs agendados
- **ETAPA 7**: Inicialização WhatsApp (não bloqueia)

### 4. **Tratamento de Erros Melhorado**
- Logs detalhados de erros (mensagem, código, stack)
- Erros não críticos não bloqueiam o servidor
- Logs tanto em `console.log` quanto em `logger` para garantir visibilidade no Railway

### 5. **Handlers de Processo**
- `uncaughtException`: Logs detalhados antes de encerrar
- `unhandledRejection`: Logs detalhados sem encerrar (em produção)
- `SIGINT`/`SIGTERM`: Logs de encerramento gracioso

## 🔍 Como Verificar os Logs no Railway

1. Acesse o painel do Railway
2. Vá para o serviço do backend
3. Clique em "Deploy Logs" ou "View Logs"
4. Procure por:
   - `🚀 ASTROCHAT - INICIANDO SERVIDOR`
   - `ETAPA 1`, `ETAPA 2`, etc.
   - Mensagens de erro com `❌ ERRO CRÍTICO`

## 🐛 Possíveis Causas de Crash

### 1. **Banco de Dados**
- Verificar se `DATABASE_URL` está configurada
- Verificar se PostgreSQL está acessível
- Verificar SSL se necessário

### 2. **Variáveis de Ambiente**
- `NODE_ENV` deve ser `production`
- `PORT` deve estar definida (Railway define automaticamente)
- `JWT_SECRET` deve estar definida
- `DATABASE_URL` ou variáveis individuais do PostgreSQL

### 3. **Dependências**
- Verificar se `npm install` foi executado corretamente
- Verificar se todas as dependências estão no `package.json`

### 4. **Memória**
- Verificar limites de memória do Railway
- Verificar se há vazamentos de memória

## 📝 Próximos Passos

1. Fazer commit e push das alterações
2. Verificar os logs no Railway após o deploy
3. Identificar em qual ETAPA o servidor está falhando
4. Corrigir o problema específico baseado nos logs

## 🔧 Variáveis de Ambiente Necessárias no Railway

```env
NODE_ENV=production
PORT=3000  # Railway define automaticamente
DATABASE_URL=postgresql://...  # Ou variáveis individuais
DB_DIALECT=postgres
DB_SSL=true
JWT_SECRET=seu-secret-aqui
```
