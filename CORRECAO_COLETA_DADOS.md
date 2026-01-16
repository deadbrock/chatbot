# 🎯 CORREÇÃO: COLETA DE DADOS DO CLIENTE

## 📊 PROBLEMA IDENTIFICADO

O bot estava pedindo dados do cliente (Nome, Telefone, Email, Contrato), mas **esperava uma opção numérica** de menu ao invés de aceitar os dados em texto livre.

### Logs do Erro

```
]: 🔄 Processando fluxo: client_flow, step: collect_data
]: 🎯 Resposta gerada: {"message":"❌ Opção inválida. Digite um número de 1 a 4."}
```

**Mensagem enviada pelo usuário:**
```
douglas
81992955523
douglas.mds24@gmail.com
mix caiada
```

**Resposta do bot:**
```
❌ Opção inválida. Digite um número de 1 a 4.
```

---

## 🔍 CAUSA RAIZ

### 1. **handleClientFlow** pulava a coleta de dados

**Arquivo:** `src/bot/flowMessageHandler.js` (linhas 492-500)

```javascript
// ❌ CÓDIGO ANTIGO
async handleClientFlow(session, messageBody, whatsappClient) {
  if (!session.email || !session.contract) {
    // Implementar coleta de dados em sequência
    // (simplificado por enquanto)
    session.currentFlow = 'client_flow';
    session.currentStep = 'client_menu';  // ❌ Pulava direto pro menu!
    await session.save();
  }
  
  if (session.currentStep === 'client_menu') {
    // ... esperava número de 1 a 4
    default:
      return { message: '❌ Opção inválida. Digite um número de 1 a 4.' };
  }
}
```

### 2. **collectData** modificava o fluxo compartilhado

**Arquivo:** `src/bot/services/flowManager.js` (linha 155)

```javascript
// ❌ CÓDIGO ANTIGO
step.collect.shift(); // Remove campo do array ORIGINAL!
```

Isso causava:
- **Bug de estado compartilhado**: Modificava a definição do fluxo que é usada por TODOS os usuários
- **Perda de campos**: Após um usuário coletar, os próximos não teriam os mesmos campos

### 3. **Mensagem inicial pedia todos os campos de uma vez**

**Arquivo:** `src/bot/flowMessageHandler.js` (linha 433)

```javascript
// ❌ CÓDIGO ANTIGO
return {
  message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\n📝 Nome\n📞 Telefone\n📧 Email\n🏢 Qual contrato'
};
```

Mas o `collectData` esperava **um campo por vez**!

---

## ✅ CORREÇÕES APLICADAS

### 1. **handleClientFlow** agora delega para flowManager

**Arquivo:** `src/bot/flowMessageHandler.js`

```javascript
// ✅ CÓDIGO NOVO
async handleClientFlow(session, messageBody, whatsappClient) {
  // Se está no step de coleta de dados, processar com flowManager
  if (session.currentStep === 'collect_data') {
    logger.info('📝 Coletando dados do cliente...');
    return await flowManager.processMessage(session, messageBody, whatsappClient);
  }
  
  // Menu do cliente
  if (session.currentStep === 'client_menu') {
    // ... processar opções 1-4
  }
  
  // Para outros steps, usar flowManager
  return await flowManager.processMessage(session, messageBody, whatsappClient);
}
```

### 2. **collectData** agora usa índice da sessão

**Arquivo:** `src/bot/services/flowManager.js`

```javascript
// ✅ CÓDIGO NOVO
async collectData(session, step, userMessage) {
  const formData = session.formData || {};
  
  if (Array.isArray(step.collect)) {
    // Rastrear progresso da coleta (NÃO modificar o step original!)
    let collectionIndex = session.collectionIndex || 0;
    
    // Coletar o dado atual
    const currentField = step.collect[collectionIndex];
    formData[currentField] = userMessage;
    
    // Salvar dados específicos na sessão
    if (currentField === 'name') session.name = userMessage;
    if (currentField === 'email') session.email = userMessage;
    if (currentField === 'phone') session.phone = userMessage;
    if (currentField === 'cpf') session.cpf = userMessage;
    if (currentField === 'company') session.company = userMessage;
    if (currentField === 'contract') session.contract = userMessage;
    
    // Avançar para o próximo campo
    collectionIndex++;
    
    if (collectionIndex < step.collect.length) {
      // Ainda há campos para coletar
      session.formData = formData;
      session.collectionIndex = collectionIndex;
      await session.save();
      
      const nextField = step.collect[collectionIndex];
      const fieldLabels = {
        'name': '📝 Nome',
        'phone': '📞 Telefone',
        'email': '📧 Email',
        'contract': '🏢 Qual contrato',
        'cpf': '🆔 CPF',
        'company': '🏢 Empresa'
      };
      
      return {
        message: `✅ Obrigado! Agora informe:\n\n${fieldLabels[nextField] || nextField}`,
        collecting: true
      };
    } else {
      // Todos os campos coletados
      session.formData = formData;
      session.collectionIndex = 0; // Resetar para próxima coleta
      if (step.next) {
        session.currentStep = step.next;
      }
      await session.save();
      
      logger.info(`✅ Dados coletados: ${JSON.stringify(formData)}`);
      
      // Retornar mensagem do próximo step
      const nextStep = this.flows[session.currentFlow]?.steps?.[session.currentStep];
      if (nextStep && nextStep.message) {
        const message = typeof nextStep.message === 'function' 
          ? nextStep.message(session.name)
          : nextStep.message;
        return { message, next: session.currentStep };
      }
      
      return {
        message: '✅ Dados coletados com sucesso!',
        next: step.next
      };
    }
  }
  // ...
}
```

### 3. **Mensagem inicial pede apenas o primeiro campo**

**Arquivo:** `src/bot/flowMessageHandler.js`

```javascript
// ✅ CÓDIGO NOVO
case '1': // Sou Cliente
  session.currentFlow = 'client_flow';
  session.currentStep = 'collect_data';
  session.collectionIndex = 0; // Iniciar coleta
  await session.save();
  return {
    message: '✅ Ótimo! Para agilizar seu atendimento, vou precisar de alguns dados.\n\nPor favor, informe:\n\n📝 Nome'
  };
```

---

## 🎯 FLUXO ESPERADO AGORA

1. **Usuário:** "menu"
2. **Bot:** "Selecione a opção... 1️⃣ Sou Cliente..."
3. **Usuário:** "1"
4. **Bot:** "✅ Ótimo! Para agilizar seu atendimento, vou precisar de alguns dados.\n\nPor favor, informe:\n\n📝 Nome"
5. **Usuário:** "Douglas Souza"
6. **Bot:** "✅ Obrigado! Agora informe:\n\n📞 Telefone"
7. **Usuário:** "81992955523"
8. **Bot:** "✅ Obrigado! Agora informe:\n\n📧 Email"
9. **Usuário:** "douglas.mds24@gmail.com"
10. **Bot:** "✅ Obrigado! Agora informe:\n\n🏢 Qual contrato"
11. **Usuário:** "mix caiada"
12. **Bot:** "Como a *FG SERVICES* pode ajudar você hoje?\n\n1️⃣ Assuntos Administrativos\n2️⃣ Comercial\n3️⃣ Operacional\n4️⃣ Voltar ao menu anterior"

---

## 🧪 TESTE AGORA!

✅ **Sessão do usuário resetada**
✅ **Servidor rodando na porta 3001**

### Para testar:

1. Envie qualquer mensagem (ex: "menu", "oi", "1")
2. Selecione "1" (Sou Cliente)
3. Responda cada campo solicitado **um por vez**

### Exemplo de teste:
```
Você: menu
Bot: [Menu com opções]

Você: 1
Bot: ✅ Ótimo! Para agilizar seu atendimento...
     Por favor, informe:
     📝 Nome

Você: Douglas Souza
Bot: ✅ Obrigado! Agora informe:
     📞 Telefone

Você: 81992955523
Bot: ✅ Obrigado! Agora informe:
     📧 Email

Você: douglas@exemplo.com
Bot: ✅ Obrigado! Agora informe:
     🏢 Qual contrato

Você: Mix Caiada
Bot: Como a *FG SERVICES* pode ajudar você hoje?
     1️⃣ Assuntos Administrativos
     2️⃣ Comercial
     3️⃣ Operacional
     4️⃣ Voltar ao menu anterior
```

---

## 📝 RESUMO DAS MUDANÇAS

| Arquivo | Mudança | Motivo |
|---------|---------|--------|
| `flowMessageHandler.js` | `handleClientFlow` delega para `flowManager` | Permitir coleta campo a campo |
| `flowManager.js` | `collectData` usa `collectionIndex` da sessão | Não modificar fluxo compartilhado |
| `flowMessageHandler.js` | Mensagem inicial pede só 1 campo | Compatível com coleta sequencial |
| `flowMessageHandler.js` | Inicializa `collectionIndex = 0` | Rastrear progresso da coleta |

---

## 🎉 RESULTADO

Agora o bot:
✅ Aceita dados de texto (não espera números)
✅ Coleta campo por campo (não tudo de uma vez)
✅ Não corrompe o fluxo para outros usuários
✅ Salva os dados na sessão (`name`, `email`, `phone`, `contract`)
✅ Progride automaticamente para o menu do cliente

**TESTE E ME MOSTRE OS RESULTADOS!** 🚀

