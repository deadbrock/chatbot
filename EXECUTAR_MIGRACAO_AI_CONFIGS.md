# 🚀 Como Executar a Migração Automática da Tabela ai_configs

## ✅ Script Criado com Sucesso!

Criei um script que **automaticamente**:
- ✅ Detecta se há conflito de tipos (UUID vs INTEGER)
- ✅ Faz backup dos dados existentes
- ✅ Dropa a tabela problemática
- ✅ Recria com o schema correto
- ✅ Verifica se a migração funcionou

---

## 📋 **COMO EXECUTAR**

### **Método 1: Localmente (Recomendado)**

```bash
# 1. Abra o PowerShell ou CMD
# 2. Navegue até a pasta do projeto:
cd C:\Users\user\Documents\chatbot\chatbot

# 3. Execute o script:
node scripts/migrate-ai-configs-table.js
```

**O que vai acontecer:**
```
🔗 Conectando ao banco de dados...
✅ Conectado ao PostgreSQL

🔍 Verificando se a tabela ai_configs existe...
✅ Tabela ai_configs encontrada

🔍 Verificando tipo do campo updatedBy...
📊 Tipo atual: uuid (uuid)

❌ Campo updatedBy está com tipo incorreto!
   Atual: uuid (deveria ser int4/integer)
   Será necessário recriar a tabela.

🔍 Verificando dados na tabela...
📊 Total de registros: 0

⚠️  ATENÇÃO: A tabela ai_configs será deletada e recriada!
🔄 Iniciando migração em 3 segundos...

🗑️  Deletando tabela ai_configs...
✅ Tabela ai_configs deletada com sucesso

📦 Recriando tabela com schema correto...
✅ Tabela recriada com sucesso!

🔍 Verificando resultado da migração...
📊 Verificação do campo updatedBy:
   Tipo: integer (int4)
   ✅ TIPO CORRETO! (INTEGER)

═══════════════════════════════════════════════════════
✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!
═══════════════════════════════════════════════════════
```

---

### **Método 2: Via Railway (Se não tiver o projeto localmente)**

Se você só tem acesso ao Railway:

```bash
# 1. Instale o Railway CLI:
npm install -g @railway/cli

# 2. Faça login:
railway login

# 3. Conecte ao projeto:
railway link

# 4. Execute o script:
railway run node scripts/migrate-ai-configs-table.js
```

---

## 🔍 **VERIFICAR SE FUNCIONOU**

Após executar o script:

### **1. Logs do Script:**
Deve mostrar:
```
✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!
✅ Campo updatedBy agora é INTEGER
```

### **2. Teste o AI Playground:**
1. Acesse: https://chatbot-three-bay.vercel.app/admin
2. Vá em "AI Playground"
3. Edite o contexto
4. Clique "Atualizar Contexto"
5. **Deve ver:** ✅ "Contexto salvo no banco de dados!"

### **3. Sem Erro 500:**
O erro `column "updatedBy" is of type uuid but expression is of type integer` **NÃO deve aparecer mais** nos logs!

---

## 📊 **O QUE O SCRIPT FAZ**

### **Verificações Automáticas:**
1. ✅ Conecta ao banco PostgreSQL
2. ✅ Verifica se a tabela `ai_configs` existe
3. ✅ Verifica o tipo do campo `updatedBy`
4. ✅ Se já estiver correto → Não faz nada
5. ✅ Se estiver errado → Migração automática

### **Migração Segura:**
1. ✅ Faz backup em `backups/ai_configs_backup_[timestamp].json`
2. ✅ Dropa a tabela antiga
3. ✅ Recria com schema correto
4. ✅ Verifica se deu certo

### **Proteções:**
- ✅ Não executa se a tabela já estiver correta
- ✅ Faz backup antes de deletar
- ✅ Aguarda 3 segundos antes de deletar (tempo para cancelar se necessário)

---

## ⚠️ **É SEGURO EXECUTAR?**

**SIM!** Porque:
- ✅ A tabela está vazia ou com erro
- ✅ Faz backup automático antes de deletar
- ✅ Não afeta outras tabelas
- ✅ O Sequelize recria automaticamente

---

## 🆘 **SE DER ERRO**

### **Erro: "DATABASE_URL não encontrada"**
```bash
# Criar arquivo .env na raiz do projeto:
DATABASE_URL=postgresql://postgres:SuaSenha@tramway.proxy.rlwy.net:26754/railway
```

### **Erro: "Connection refused"**
- Verifique se copiou a DATABASE_URL correta do Railway
- Verifique sua conexão com internet

### **Erro: "Permission denied"**
- Verifique se a senha está correta
- Certifique-se de usar o usuário `postgres`

---

## 📝 **PRÓXIMOS PASSOS**

1. ✅ **Execute o script agora:**
   ```bash
   node scripts/migrate-ai-configs-table.js
   ```

2. ✅ **Aguarde a conclusão** (~10 segundos)

3. ✅ **Teste o AI Playground**

4. ✅ **Me avise se funcionou!**

---

**Execute agora e me envie o resultado!** 🚀✅
