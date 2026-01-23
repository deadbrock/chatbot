# 🔧 Corrigir Tabela `ai_configs` no PostgreSQL

## 🐛 Problema

A tabela `ai_configs` foi criada com o campo `updatedBy` como **UUID**, mas o modelo `User` usa **INTEGER** para o `id`.

Erro:
```
column "updatedBy" is of type uuid but expression is of type integer
```

## ✅ Solução

Precisamos **dropar a tabela** para que o Sequelize a recrie com o tipo correto (INTEGER).

---

## 📋 Opção 1: Via Railway Dashboard (RECOMENDADO)

### Passos:

1. **Acesse o Railway Dashboard:**
   - https://railway.app

2. **Selecione seu projeto:**
   - `chatbot`

3. **Clique em PostgreSQL:**
   - Na aba lateral

4. **Vá em "Data" ou "Query":**
   - Procure por uma opção para executar queries SQL

5. **Execute o comando:**
   ```sql
   DROP TABLE IF EXISTS "ai_configs" CASCADE;
   ```

6. **Reinicie o servidor:**
   - O Sequelize irá recriar a tabela automaticamente com o tipo correto
   - O servidor já reinicia automaticamente no Railway

---

## 📋 Opção 2: Via Terminal (Alternativa)

Se você tem acesso ao `psql`:

```bash
# Conectar ao banco
psql $DATABASE_URL

# Dropar a tabela
DROP TABLE IF EXISTS "ai_configs" CASCADE;

# Sair
\q
```

---

## 📋 Opção 3: Via Railway CLI

```bash
# Instalar Railway CLI (se ainda não tiver)
npm install -g @railway/cli

# Login
railway login

# Conectar ao projeto
railway link

# Executar comando SQL
railway run psql -c "DROP TABLE IF EXISTS \"ai_configs\" CASCADE;"
```

---

## 🔍 Verificar se Funcionou

Após dropar a tabela e reiniciar o servidor:

1. **Verifique os logs do Railway:**
   ```
   ✅ Modelos sincronizados com sucesso
   ```

2. **Teste o AI Playground:**
   - Vá em "AI Playground"
   - Edite o contexto
   - Clique "Atualizar Contexto"
   - Deve ver: ✅ "Contexto salvo no banco de dados!"

---

## ⚠️ IMPORTANTE

- **Não há dados para perder:** A tabela `ai_configs` está vazia ou com erro
- **É seguro dropar:** O Sequelize irá recriar automaticamente
- **Tipo correto:** `updatedBy INTEGER` (compatível com `User.id`)

---

## 📊 Confirmação

Após reiniciar, o servidor deve criar a tabela com o schema correto:

```sql
CREATE TABLE "ai_configs" (
  "id" UUID PRIMARY KEY,
  "key" VARCHAR(255) UNIQUE NOT NULL,
  "value" TEXT NOT NULL,
  "type" VARCHAR(255) DEFAULT 'string',
  "category" VARCHAR(255) DEFAULT 'general',
  "description" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "updatedBy" INTEGER,  -- ✅ AGORA É INTEGER!
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

---

## 🎯 Próximos Passos

1. ✅ Dropar a tabela `ai_configs`
2. ✅ Aguardar reinício do servidor
3. ✅ Testar salvamento de contexto no AI Playground
4. ✅ Confirmar que funciona sem erros

---

**Depois de executar, me avise se funcionou!** 🚀
