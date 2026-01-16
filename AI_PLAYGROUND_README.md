# 🤖 AI Playground - Guia de Uso

## 📖 O que é?

O **AI Playground** é uma tela de desenvolvimento onde você pode:
- ✅ Conversar diretamente com a IA
- ✅ Ver a intenção detectada
- ✅ Verificar a confiança da resposta
- ✅ Ajustar o contexto da IA
- ✅ Salvar exemplos de treinamento
- ✅ Analisar estatísticas

---

## 🚀 Como Acessar

1. Faça login no dashboard
2. Clique em **"🤖 AI Playground"** no menu lateral
3. A tela será carregada com a interface de treinamento

---

## 💬 Como Usar

### 1. **Conversando com a IA**

- Digite sua mensagem no campo de texto na parte inferior
- Clique em **"Enviar"** ou pressione `Enter`
- A IA irá processar e responder
- Você verá:
  - **Resposta da IA**
  - **Intenção detectada** (ex: consulta_ferias)
  - **Nível de confiança** (ex: 95%)
  - **Tempo de resposta** (ex: 250ms)

### 2. **Ajustando o Contexto**

O **contexto** define a personalidade e conhecimento da IA.

**Exemplo de contexto:**
```
Você é um assistente virtual de RH.
Ajude o usuário com suas dúvidas sobre:
- Férias
- Folha de pagamento
- Benefícios
- Políticas da empresa

Se não souber responder, classifique como "atendimento_humano".
```

**Como ajustar:**
1. Edite o texto na caixa "📝 Contexto da IA"
2. Clique em **"Atualizar Contexto"**
3. As próximas mensagens usarão o novo contexto

### 3. **Salvando Exemplos de Treinamento**

Quando a IA responder algo corretamente (ou incorretamente), você pode salvar como exemplo:

1. Clique em **"💾 Salvar como Exemplo"**
2. Preencha:
   - **Mensagem:** (já preenchida)
   - **Intenção Esperada:** (ex: consulta_ferias)
   - **Resposta Esperada:** (opcional)
   - **Notas:** (opcional - para lembrar depois)
3. Clique em **"Salvar"**

**Os exemplos ficam salvos em:** `src/data/training-examples/examples.json`

### 4. **Visualizando Exemplos Salvos**

1. Clique em **"📚 Ver Todos"** no card "Exemplos de Treinamento"
2. Você verá todos os exemplos salvos
3. Pode deletar exemplos clicando no ícone 🗑️

### 5. **Visualizando Estatísticas**

1. Clique em **"📊 Ver Estatísticas"**
2. Você verá:
   - Total de exemplos salvos
   - Distribuição por intenção
   - Quais intenções têm mais exemplos

---

## 📊 Informações Exibidas

### **Última Resposta:**
- **Intenção:** Qual foi a intenção detectada pela IA
- **Confiança:** Quão confiante a IA está (0-100%)
- **Tempo:** Quanto tempo levou para responder

### **Badges nas Mensagens:**
- 🔵 **Badge Azul:** Intenção detectada
- 🟢 **Badge Verde:** Nível de confiança

---

## 🎯 Casos de Uso

### **1. Testar Novas Frases**
Teste se a IA entende diferentes formas de perguntar a mesma coisa:
- "Quero tirar férias"
- "Como solicito minhas férias?"
- "Preciso de informações sobre férias"

### **2. Treinar Novas Intenções**
Se você quer que a IA reconheça uma nova intenção:
1. Converse com ela usando frases da nova intenção
2. Salve como exemplo com a intenção correta
3. Repita com várias frases diferentes

### **3. Ajustar Respostas**
Se a IA está respondendo incorretamente:
1. Ajuste o contexto para guiar melhor a IA
2. Salve exemplos com a resposta esperada
3. Teste novamente

### **4. Identificar Problemas**
Se a confiança está muito baixa (<70%):
- A IA não tem certeza
- Pode precisar de mais exemplos
- O contexto pode estar confuso

---

## 🔐 Permissões

- **Apenas administradores** podem acessar o AI Playground
- Os exemplos são salvos com o ID do usuário que os criou

---

## 📁 Estrutura de Arquivos

```
src/
├── controllers/
│   └── aiPlaygroundController.js    # API do playground
├── routes/
│   └── aiPlayground.js              # Rotas da API
├── data/
│   └── training-examples/
│       └── examples.json            # Exemplos salvos
└── dashboard/
    └── public/
        └── app/
            └── views/
                ├── aiPlaygroundView.js   # Interface
                └── aiPlayground.css      # Estilos
```

---

## 🛠️ API Endpoints

### **POST /api/ai-playground/test**
Testa uma mensagem com a IA

**Body:**
```json
{
  "message": "Quero tirar férias",
  "context": "Você é um assistente de RH...",
  "userId": "playground"
}
```

**Resposta:**
```json
{
  "success": true,
  "output": {
    "response": "Entendi! Vou te ajudar...",
    "intent": "consulta_ferias",
    "confidence": 0.95
  },
  "performance": {
    "responseTime": "250ms"
  }
}
```

### **POST /api/ai-playground/examples**
Salva um exemplo de treinamento

### **GET /api/ai-playground/examples**
Lista todos os exemplos salvos

### **DELETE /api/ai-playground/examples/:id**
Remove um exemplo

### **GET /api/ai-playground/stats**
Retorna estatísticas das intenções

---

## 💡 Dicas

1. **Teste Casos Extremos:** Teste frases mal escritas, gírias, erros de digitação
2. **Varie as Frases:** Salve exemplos com diferentes formas de perguntar
3. **Use Notas:** Adicione notas nos exemplos para lembrar do contexto
4. **Monitore a Confiança:** Se estiver abaixo de 70%, adicione mais exemplos
5. **Limpe o Chat:** Use o botão "Limpar" para começar um teste novo

---

## 🎨 Interface

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 AI Playground                                           │
│  Teste e treine sua IA em tempo real                       │
├─────────────────────────────────────────┬───────────────────┤
│                                         │                   │
│  💬 Conversa                            │  📝 Contexto      │
│  ┌────────────────────────────────┐    │  ┌──────────────┐ │
│  │                                │    │  │              │ │
│  │  [Mensagens aqui]              │    │  │  [Contexto]  │ │
│  │                                │    │  │              │ │
│  └────────────────────────────────┘    │  └──────────────┘ │
│  ┌────────────────────────────────┐    │                   │
│  │ [Digite sua mensagem...]       │    │  📊 Última        │
│  └────────────────────────────────┘    │     Resposta      │
│  [Enviar]                               │                   │
│                                         │  📚 Exemplos      │
│                                         │                   │
│                                         │  ⚡ Ações         │
└─────────────────────────────────────────┴───────────────────┘
```

---

## ❓ Perguntas Frequentes

**P: Os exemplos salvos afetam a IA automaticamente?**
R: Não diretamente. Eles servem como referência para você treinar e melhorar o contexto.

**P: Posso deletar todos os exemplos?**
R: Sim, você pode deletar um por um na tela de visualização.

**P: Quantos exemplos devo salvar?**
R: Recomendamos pelo menos 10-20 exemplos por intenção.

**P: Posso exportar os exemplos?**
R: Sim! Eles estão em JSON no arquivo `src/data/training-examples/examples.json`

---

## 🎓 Próximos Passos

1. **Explore a interface** - Teste diferentes tipos de mensagens
2. **Salve exemplos** - Crie uma biblioteca de exemplos
3. **Ajuste o contexto** - Refine a personalidade da IA
4. **Monitore estatísticas** - Veja quais intenções têm mais exemplos

---

**✨ Divirta-se treinando sua IA! ✨**

