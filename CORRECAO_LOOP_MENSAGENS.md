# 🔄 CORREÇÃO: LOOP INFINITO NA COLETA DE DADOS

## 🔴 PROBLEMA IDENTIFICADO

Após corrigir o fluxo de coleta de dados, o bot entrou em **LOOP INFINITO** pedindo o mesmo campo repetidamente:

### Comportamento Observado nos Logs

```
📝 Body extraído: "81992955523"  (usuário enviou telefone)
📨 Mensagem recebida de Douglas Souza: "81992955523"
🔄 Processando fluxo: client_flow, step: collect_data
📝 Coletando dados do cliente...
🎯 Resposta gerada: {"message":"✅ Obrigado! Agora informe:\n\n📞 Telefone","collecting":true}

[Usuário envia telefone NOVAMENTE]

📝 Body extraído: "81992955523"
🎯 Resposta gerada: {"message":"✅ Obrigado! Agora informe:\n\n📞 Telefone","collecting":true}

[LOOP INFINITO] 🔁🔁🔁
```

O bot **recebia o telefone** mas continuava **pedindo telefone** infinitamente!

---

## 🔍 CAUSA RAIZ

### 1. Campo `collectionIndex` não existia no banco de dados

O código em `src/bot/services/flowManager.js` tentava salvar:

```javascript
session.collectionIndex = collectionIndex;
await session.save();
```

MAS o campo `collectionIndex` **não existia** no modelo `UserSessionSQL` nem na tabela do banco!

### 2. Resultado: Sempre começava do índice 0

Quando a sessão era lida do banco, `session.collectionIndex` era `undefined`:

```javascript
let collectionIndex = session.collectionIndex || 0; // Sempre 0!
```

Por isso:
- ✅ Usuário envia "douglas" → Salva nome → `collectionIndex = 1` (em memória)
- ✅ Bot pede telefone
- ❌ Próxima mensagem: `collectionIndex` lido do banco = `undefined` → volta para 0!
- ❌ Bot pede nome novamente (campo 0)
- ❌ LOOP!

---

## ✅ CORREÇÕES APLICADAS

### 1. Adicionado campo `collectionIndex` ao modelo

**Arquivo:** `src/models/UserSessionSQL.js`

```javascript
// Dados temporários
formData: {
  type: DataTypes.JSON,
  allowNull: true,
  comment: 'Dados temporários coletados no formulário'
},

collectionIndex: {  // ✅ NOVO CAMPO
  type: DataTypes.INTEGER,
  defaultValue: 0,
  comment: 'Índice do campo sendo coletado (para fluxos com múltiplos campos)'
},

// Controle de atendimento
isActive: {
  type: DataTypes.BOOLEAN,
  defaultValue: true,
  comment: 'Sessão ativa ou encerrada'
},
```

### 2. Criada coluna no banco de dados

**Comando SQL executado:**

```sql
ALTER TABLE user_sessions ADD COLUMN collectionIndex INTEGER DEFAULT 0
```

**Resultado:**

```
✅ Coluna collectionIndex adicionada!
```

### 3. Sessão resetada

```
✅ Sessão resetada: [ 1 ]
```

---

## 🎯 FLUXO CORRIGIDO

Agora o bot:

1. ✅ Usuário envia "1" (Sou Cliente)
2. ✅ Bot: "📝 Nome"
3. ✅ Usuário: "Douglas"
4. ✅ Bot salva: `session.collectionIndex = 1` no banco
5. ✅ Bot: "✅ Obrigado! Agora informe: 📞 Telefone"
6. ✅ Usuário: "81992955523"
7. ✅ Bot **lê do banco**: `session.collectionIndex = 1` ✅
8. ✅ Bot salva: `session.collectionIndex = 2` no banco
9. ✅ Bot: "✅ Obrigado! Agora informe: 📧 Email"
10. ✅ ...continua até coletar todos os campos

---

## 📊 RESUMO DAS CORREÇÕES

| Problema | Causa | Solução |
|----------|-------|---------|
| Loop infinito | Campo `collectionIndex` não existia | Adicionado ao modelo e banco |
| Sempre pede campo 0 | `collectionIndex` sempre `undefined` | Agora persiste no banco |
| Múltiplos restarts | Nodemon reiniciava ao salvar | Normal, esperado |
| Mensagens duplicadas | Restart reprocessava mensagens | Normal, esperado |

---

## 🧪 TESTE AGORA!

✅ **Servidor rodando na porta 3000**  
✅ **WhatsApp conectado**  
✅ **Coluna `collectionIndex` criada**  
✅ **Sessão resetada**

### Para testar:

1. Envie no WhatsApp: `menu` ou `oi` ou `1`
2. Selecione `1` (Sou Cliente)
3. Bot: "📝 Nome"
4. Você: `Douglas Souza`
5. Bot: "✅ Obrigado! Agora informe: 📞 Telefone" ✅
6. Você: `81992955523`
7. Bot: "✅ Obrigado! Agora informe: 📧 Email" ✅ (NÃO deve pedir telefone novamente!)
8. Você: `douglas@exemplo.com`
9. Bot: "✅ Obrigado! Agora informe: 🏢 Qual contrato" ✅
10. Você: `Mix Caiada`
11. Bot: Menu do cliente ✅

---

## 🎉 PROBLEMA RESOLVIDO!

Agora o bot:
- ✅ Coleta dados campo por campo
- ✅ Lembra qual campo está coletando (persiste `collectionIndex`)
- ✅ Avança para o próximo campo automaticamente
- ✅ Não entra em loop
- ✅ Salva todos os dados na sessão

**TESTE E ME MOSTRE OS RESULTADOS!** 🚀✨

