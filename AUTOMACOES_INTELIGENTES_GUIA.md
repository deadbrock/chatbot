# 🤖 Automações Inteligentes - Guia Completo

## 📋 Visão Geral

O sistema de **Automações Inteligentes** do AstroChat permite criar fluxos automáticos de atendimento que:
- ✅ Detectam intenções do usuário usando IA (Groq API)
- ✅ Coletam dados estruturados (nome, loja, supervisor, etc.)
- ✅ Executam ações automáticas (criar ticket, transferir para fila, notificar)
- ✅ Funcionam diretamente no WhatsApp
- ✅ São totalmente configuráveis via interface web

---

## 🎯 Como Funciona

### 1. **Detecção de Intenção**
Quando um usuário envia uma mensagem, a IA analisa e identifica a intenção:
- `salario`: Dúvidas sobre pagamento
- `ferias`: Solicitações de férias
- `beneficios`: Questões sobre vale-transporte, alimentação
- `manutencao`: Problemas técnicos
- E muitos outros...

### 2. **Coleta de Dados (Slots)**
Após detectar a intenção, o sistema coleta dados necessários:
```
Usuário: "Quero falar sobre meu salário"
IA: "Olá! Vou te ajudar. Por favor, informe seu nome completo:"
Usuário: "João Silva"
IA: "Em qual loja você está alocado?"
Usuário: "Loja Centro"
IA: "Quem é o seu supervisor?"
Usuário: "Maria Santos"
IA: "Perfeito! Estou redirecionando você para o setor financeiro..."
```

### 3. **Execução de Ações**
Com todos os dados coletados, o sistema executa ações:
- **Criar Ticket**: Registro automático no sistema
- **Transferir para Fila**: Redirecionar para departamento específico
- **Adicionar Tag**: Categorizar o atendimento
- **Enviar Notificação**: Alertar equipe responsável
- **Atualizar Contato**: Salvar informações do usuário

---

## 🚀 Como Usar

### **Acessar o Módulo**
1. Faça login no dashboard do AstroChat
2. No menu lateral, clique em **"Inteligência Artificial"**
3. Selecione **"Automações"**

### **Criar Nova Regra**

#### **Opção 1: Usar Template Pronto**
1. Clique em **"📋 Templates"**
2. Escolha um template (ex: "Atendimento de Salário")
3. Clique em **"Usar Template"**
4. Personalize conforme necessário
5. Clique em **"Salvar Regra"**

#### **Opção 2: Criar do Zero**
1. Clique em **"➕ Nova Regra"**
2. Preencha os campos:

**Informações Básicas:**
- **Nome**: Ex: "Atendimento de Salário"
- **Descrição**: Breve explicação
- **Prioridade**: Menor = mais prioritário
- **Status**: Ativada ou Desativada

**Gatilho (Quando executar):**
- **Tipo**: Intenção, Palavra-chave, Sentimento ou Sempre
- **Valor**: Ex: "salario" para intenção

**Coleta de Dados (Slots):**
- Clique em **"➕ Adicionar Dado"**
- **Nome do dado**: Ex: "nome_completo"
- **Mensagem para solicitar**: Ex: "Por favor, informe seu nome completo:"
- Repita para cada dado necessário

**Ações (O que fazer):**
- Clique em **"➕ Adicionar Ação"**
- **Tipo**: Escolha a ação (Criar Ticket, Transferir para Fila, etc.)
- **Parâmetros**: Configure em formato JSON
  ```json
  {
    "subject": "Dúvida sobre salário",
    "status": "open",
    "priority": "high"
  }
  ```

**Mensagens Personalizadas:**
- **Saudação**: Mensagem inicial ao acionar a regra
- **Conclusão**: Mensagem ao finalizar coleta de dados
- **Erro**: Mensagem em caso de problema

3. Clique em **"Salvar Regra"**

---

## 💡 Exemplos Práticos

### **Exemplo 1: Atendimento de Salário**

**Gatilho:**
- Tipo: Intenção
- Valor: `salario`

**Slots:**
1. `nome_completo` → "Qual é o seu nome completo?"
2. `loja` → "Em qual loja você trabalha?"
3. `supervisor` → "Quem é o seu supervisor?"

**Ações:**
1. Criar Ticket
   ```json
   {
     "subject": "Dúvida sobre salário",
     "status": "open",
     "priority": "high"
   }
   ```
2. Transferir para Fila
   ```json
   {
     "queueId": "financeiro_queue_id",
     "status": "pending"
   }
   ```

**Mensagens:**
- **Saudação**: "Olá! Sou o assistente da FG SERVICES. Vi que você tem uma dúvida sobre salário. Vou coletar alguns dados para encaminhar ao setor financeiro."
- **Conclusão**: "Perfeito! Recebi todas as informações. Estou redirecionando você para um atendente do financeiro. Por favor, aguarde."

---

### **Exemplo 2: Solicitação de Férias**

**Gatilho:**
- Tipo: Intenção
- Valor: `ferias`

**Slots:**
1. `nome_completo`
2. `periodo_desejado` → "Qual período você gostaria de tirar férias? (ex: 01/02/2026 a 15/02/2026)"
3. `supervisor`

**Ações:**
1. Criar Ticket
2. Transferir para Fila de RH
3. Enviar Notificação para RH

---

### **Exemplo 3: Suporte Técnico**

**Gatilho:**
- Tipo: Intenção
- Valor: `manutencao`

**Slots:**
1. `nome`
2. `departamento`
3. `descricao_problema` → "Descreva o problema técnico:"

**Ações:**
1. Criar Ticket de Alta Prioridade
2. Adicionar Tag "suporte_tecnico"
3. Enviar Notificação para equipe de TI

---

## 🧪 Como Testar

### **Testar no Dashboard**
1. Acesse o módulo de Automações
2. Clique na aba **"Testar"**
3. Digite uma mensagem (ex: "Preciso falar sobre meu salário")
4. Clique em **"Testar Mensagem"**
5. Veja qual automação foi acionada e a resposta da IA

### **Testar no WhatsApp Real**
1. Certifique-se que a regra está **Ativada**
2. Envie uma mensagem para o número do WhatsApp conectado
3. A automação será executada automaticamente
4. Responda às perguntas da IA
5. Ao finalizar, a automação executará as ações configuradas

---

## 📊 Monitoramento

### **Visualizar Estatísticas**
No topo da página de Automações, você verá:
- **Total de Regras**: Quantas regras existem
- **Regras Ativas**: Quantas estão funcionando
- **Execuções**: Total de vezes que foram acionadas
- **Taxa de Sucesso**: Percentual de execuções bem-sucedidas

### **Visualizar Execuções**
1. Clique na aba **"Execuções"**
2. Veja o histórico completo:
   - Data e hora
   - Qual regra foi executada
   - Contato que acionou
   - Status (iniciada, coletando, executando, completa, falhou)
   - Resultado

---

## ⚙️ Configurações Avançadas

### **Parâmetros de Ações**

#### **Criar Ticket**
```json
{
  "subject": "Título do ticket",
  "status": "open|pending|in_progress|closed",
  "priority": "low|medium|high|urgent",
  "queueId": "id_da_fila" // opcional
}
```

#### **Transferir para Fila**
```json
{
  "queueId": "id_da_fila",
  "status": "pending" // opcional
}
```

#### **Adicionar Tag**
```json
{
  "tagId": "id_da_tag"
}
```

#### **Enviar Notificação**
```json
{
  "to": "email@example.com",
  "subject": "Assunto",
  "message": "Mensagem"
}
```

#### **Atualizar Contato**
```json
{
  "fields": {
    "email": "email_coletado_slot",
    "company": "empresa_coletada_slot"
  }
}
```

---

## 🔧 Troubleshooting

### **Automação não está sendo acionada**
- ✅ Verifique se a regra está **Ativada**
- ✅ Confira se o **Gatilho** está correto
- ✅ Teste no módulo "Testar" para ver se a intenção é detectada
- ✅ Verifique se não há outras regras com prioridade maior

### **IA não está coletando os slots**
- ✅ Verifique se os slots estão configurados corretamente
- ✅ Confira se as mensagens de prompt estão claras
- ✅ Teste manualmente enviando as respostas esperadas

### **Ações não estão sendo executadas**
- ✅ Verifique se os parâmetros das ações estão em formato JSON válido
- ✅ Confira se os IDs de filas/tags existem no sistema
- ✅ Veja o log de execuções na aba "Execuções"

---

## 📚 Boas Práticas

1. **Nomeie regras de forma descritiva**: "Atendimento de Salário" em vez de "Regra 1"
2. **Use prioridades adequadamente**: Regras mais específicas devem ter prioridade maior (número menor)
3. **Teste antes de ativar**: Sempre teste na aba "Testar" antes de usar em produção
4. **Mensagens claras**: Escreva prompts de coleta de dados de forma simples e direta
5. **Monitore regularmente**: Verifique as estatísticas e execuções para otimizar as regras

---

## 🎓 Casos de Uso Avançados

### **Coleta Condicional**
Você pode criar múltiplas regras para diferentes cenários:
- Regra 1: Salário - Prioridade 5
- Regra 2: Férias - Prioridade 5
- Regra 3: Reclamação - Prioridade 1 (mais alta)

### **Encadeamento de Ações**
Ao configurar várias ações, elas são executadas em sequência:
1. Criar Ticket
2. Transferir para Fila
3. Adicionar Tag
4. Enviar Notificação

---

## 🆘 Suporte

Se precisar de ajuda adicional:
1. Verifique os logs do sistema
2. Consulte a documentação da API em `/api/automations`
3. Entre em contato com o suporte técnico

---

## 🚀 Próximos Passos

Após dominar as automações básicas, explore:
- **Integração com APIs externas**: Envie dados para sistemas terceiros
- **Webhooks**: Acione automações via HTTP
- **Relatórios personalizados**: Analise performance das automações

---

**Desenvolvido por AstroChat - Aestron**
*Sistema de Atendimento Inteligente com IA*
