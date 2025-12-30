# Guia de Fluxos de Conversa

## Visão Geral

O sistema de fluxos permite criar conversas automatizadas personalizadas sem programar. Você pode criar fluxos complexos com perguntas, opções, condições e ações.

## Conceitos

### Fluxo (Flow)
Um fluxo é uma sequência de **steps** (passos) que guiam a conversa com o usuário.

### Step (Passo)
Cada step representa uma ação na conversa. Tipos disponíveis:

1. **message** - Enviar mensagem
2. **question** - Fazer pergunta e aguardar resposta
3. **options** - Menu de opções (1, 2, 3...)
4. **collect** - Coletar dado específico (com validação)
5. **condition** - Decisão condicional (if/else)
6. **action** - Executar ação (criar ticket, enviar email, etc.)

### Variáveis
Dados coletados durante o fluxo que podem ser reutilizados.
Formato: `{{nomeVariavel}}`

### Triggers
O que ativa o fluxo:
- **keyword** - Palavra-chave (ex: "rastrear", "orçamento")
- **command** - Comando (ex: "/start", "/help")
- **department** - Ao entrar em departamento
- **intent** - Intenção detectada
- **manual** - Ativação manual

## Estrutura de um Fluxo

```json
{
  "name": "Nome do Fluxo",
  "description": "Descrição",
  "trigger": "palavra-chave",
  "triggerType": "keyword",
  "department": "Comercial",
  "priority": 10,
  "status": "active",
  "variables": {
    "userName": "",
    "email": ""
  },
  "steps": [
    {
      "id": "step1",
      "type": "message",
      "content": "Olá, {{userName}}!",
      "next": "step2"
    },
    {
      "id": "step2",
      "type": "question",
      "question": "Qual seu e-mail?",
      "saveAs": "email",
      "next": "step3"
    }
  ]
}
```

## Tipos de Steps

### 1. Message (Mensagem)

Envia uma mensagem ao usuário.

```json
{
  "id": "welcome",
  "type": "message",
  "content": "Bem-vindo! Como posso ajudar?",
  "delay": 1000,
  "next": "step2"
}
```

**Propriedades:**
- `content` - Texto da mensagem (suporta variáveis)
- `delay` - Atraso antes de enviar (ms)
- `templateId` - ID de template (opcional)
- `next` - Próximo step

### 2. Question (Pergunta)

Faz uma pergunta e aguarda resposta livre.

```json
{
  "id": "ask_name",
  "type": "question",
  "question": "Qual seu nome?",
  "saveAs": "userName",
  "validation": {
    "type": "text",
    "min": 2,
    "errorMessage": "Nome muito curto"
  },
  "next": "step3"
}
```

**Propriedades:**
- `question` - Pergunta a fazer
- `saveAs` - Nome da variável para salvar resposta
- `validation` - Validação (opcional)
- `next` - Próximo step

### 3. Options (Menu de Opções)

Apresenta menu numerado.

```json
{
  "id": "menu",
  "type": "options",
  "message": "Escolha uma opção:",
  "options": [
    {
      "label": "Rastrear pedido",
      "value": "tracking",
      "next": "tracking_flow"
    },
    {
      "label": "Falar com atendente",
      "value": "human",
      "next": "transfer_human"
    }
  ],
  "next": "conditional"
}
```

**Propriedades:**
- `message` - Texto antes das opções
- `options` - Array de opções
  - `label` - Texto da opção
  - `value` - Valor a salvar
  - `next` - Próximo step (específico da opção)
- `next` - Próximo step padrão

### 4. Collect (Coletar Dado)

Coleta dado específico com validação.

```json
{
  "id": "collect_email",
  "type": "collect",
  "prompt": "Informe seu e-mail:",
  "saveAs": "email",
  "dataType": "email",
  "validation": {
    "type": "email",
    "errorMessage": "E-mail inválido"
  },
  "next": "step4"
}
```

**Tipos de dados:**
- `text` - Texto livre
- `number` - Número
- `email` - E-mail
- `phone` - Telefone
- `date` - Data

**Validações:**
- `type` - Tipo de validação
- `min` - Valor/tamanho mínimo
- `max` - Valor/tamanho máximo
- `pattern` - Regex customizado
- `errorMessage` - Mensagem de erro

### 5. Condition (Condição)

Decisão condicional (if/else).

```json
{
  "id": "check_age",
  "type": "condition",
  "condition": {
    "variable": "age",
    "operator": "greater_than",
    "value": 18
  },
  "nextIfTrue": "adult_flow",
  "nextIfFalse": "minor_flow"
}
```

**Operadores:**
- `equals` - Igual
- `not_equals` - Diferente
- `contains` - Contém
- `greater_than` - Maior que
- `less_than` - Menor que
- `exists` - Existe

### 6. Action (Ação)

Executa ação do sistema.

```json
{
  "id": "create_ticket_action",
  "type": "action",
  "action": "create_ticket",
  "next": "confirmation"
}
```

**Ações disponíveis:**
- `create_ticket` - Criar ticket
- `transfer_department` - Transferir para departamento
- `send_email` - Enviar e-mail
- `save_data` - Salvar no banco
- `call_webhook` - Chamar webhook externo

## Templates de Mensagens

Templates são mensagens reutilizáveis com variáveis.

### Criar Template

```json
{
  "name": "Boas-vindas",
  "category": "greeting",
  "content": "Olá, {{userName}}! Bem-vindo à {{companyName}}!",
  "variables": [
    {
      "name": "userName",
      "description": "Nome do usuário",
      "default": "Cliente"
    },
    {
      "name": "companyName",
      "description": "Nome da empresa",
      "default": "Nossa Empresa"
    }
  ],
  "status": "active"
}
```

### Usar Template em Fluxo

```json
{
  "id": "welcome",
  "type": "message",
  "templateId": 123,
  "next": "step2"
}
```

## Exemplos Práticos

### Exemplo 1: Rastreamento de Pedido

```json
{
  "name": "Rastreamento",
  "trigger": "rastrear",
  "triggerType": "keyword",
  "steps": [
    {
      "id": "1",
      "type": "message",
      "content": "📦 Vou te ajudar a rastrear!",
      "next": "2"
    },
    {
      "id": "2",
      "type": "collect",
      "prompt": "Informe o número do pedido:",
      "saveAs": "orderNumber",
      "dataType": "text",
      "next": "3"
    },
    {
      "id": "3",
      "type": "message",
      "content": "✅ Pedido {{orderNumber}} encontrado!\n\nStatus: Em trânsito\nPrevisão: 2-3 dias",
      "next": "auto"
    }
  ]
}
```

### Exemplo 2: Pesquisa de Satisfação

```json
{
  "name": "Pesquisa NPS",
  "trigger": "avaliar",
  "triggerType": "keyword",
  "steps": [
    {
      "id": "1",
      "type": "message",
      "content": "⭐ Queremos sua opinião!",
      "next": "2"
    },
    {
      "id": "2",
      "type": "options",
      "message": "De 0 a 10, quanto você recomendaria nosso serviço?",
      "options": [
        {"label": "0-6 (Não recomendo)", "value": "detractor", "next": "3"},
        {"label": "7-8 (Neutro)", "value": "passive", "next": "4"},
        {"label": "9-10 (Recomendo muito)", "value": "promoter", "next": "5"}
      ]
    },
    {
      "id": "3",
      "type": "question",
      "question": "Sentimos muito! O que podemos melhorar?",
      "saveAs": "feedback",
      "next": "6"
    },
    {
      "id": "4",
      "type": "message",
      "content": "Obrigado pelo feedback! Vamos trabalhar para melhorar!",
      "next": "auto"
    },
    {
      "id": "5",
      "type": "message",
      "content": "🎉 Que ótimo! Obrigado pela confiança!",
      "next": "auto"
    },
    {
      "id": "6",
      "type": "action",
      "action": "save_data",
      "next": "7"
    },
    {
      "id": "7",
      "type": "message",
      "content": "Obrigado pelo feedback! Vamos analisar e melhorar!",
      "next": "auto"
    }
  ]
}
```

### Exemplo 3: Agendamento

```json
{
  "name": "Agendamento",
  "trigger": "agendar",
  "triggerType": "keyword",
  "steps": [
    {
      "id": "1",
      "type": "message",
      "content": "📅 Vou te ajudar a agendar!",
      "next": "2"
    },
    {
      "id": "2",
      "type": "collect",
      "prompt": "Qual a data desejada? (DD/MM/AAAA)",
      "saveAs": "date",
      "dataType": "date",
      "next": "3"
    },
    {
      "id": "3",
      "type": "options",
      "message": "Qual horário?",
      "options": [
        {"label": "09:00", "value": "09:00", "next": "4"},
        {"label": "10:00", "value": "10:00", "next": "4"},
        {"label": "14:00", "value": "14:00", "next": "4"},
        {"label": "15:00", "value": "15:00", "next": "4"}
      ]
    },
    {
      "id": "4",
      "type": "collect",
      "prompt": "Informe seu nome completo:",
      "saveAs": "fullName",
      "dataType": "text",
      "next": "5"
    },
    {
      "id": "5",
      "type": "collect",
      "prompt": "Informe seu telefone:",
      "saveAs": "phone",
      "dataType": "phone",
      "next": "6"
    },
    {
      "id": "6",
      "type": "message",
      "content": "✅ AGENDAMENTO CONFIRMADO\n\n📅 Data: {{date}}\n⏰ Horário: {{lastOption}}\n👤 Nome: {{fullName}}\n📞 Telefone: {{phone}}\n\nVocê receberá confirmação por SMS!",
      "next": "auto"
    }
  ]
}
```

## API Endpoints

### Fluxos

- `GET /api/flows` - Listar todos
- `GET /api/flows/active` - Listar ativos
- `GET /api/flows/:id` - Detalhes
- `POST /api/flows` - Criar
- `PUT /api/flows/:id` - Atualizar
- `PATCH /api/flows/:id/activate` - Ativar
- `PATCH /api/flows/:id/archive` - Arquivar
- `POST /api/flows/:id/duplicate` - Duplicar
- `POST /api/flows/:id/test` - Testar
- `DELETE /api/flows/:id` - Deletar

### Templates

- `GET /api/templates` - Listar todos
- `GET /api/templates/active` - Listar ativos
- `GET /api/templates/categories` - Listar categorias
- `GET /api/templates/:id` - Detalhes
- `POST /api/templates` - Criar
- `PUT /api/templates/:id` - Atualizar
- `POST /api/templates/:id/duplicate` - Duplicar
- `POST /api/templates/:id/render` - Renderizar com variáveis
- `POST /api/templates/:id/validate` - Validar
- `DELETE /api/templates/:id` - Deletar

## Boas Práticas

1. **Nomeie claramente** - Use nomes descritivos para fluxos e steps
2. **Valide inputs** - Sempre valide dados coletados
3. **Mensagens curtas** - Mantenha mensagens objetivas
4. **Feedback visual** - Use emojis para melhor UX
5. **Teste antes de ativar** - Sempre teste fluxos em modo draft
6. **Use templates** - Reutilize mensagens comuns
7. **Priorize fluxos** - Use priority para controlar ordem
8. **Documente variáveis** - Descreva cada variável usada

## Troubleshooting

### Fluxo não ativa
- Verifique se `status` é `active`
- Confirme que `trigger` está correto
- Verifique `priority` (maior = primeiro)

### Validação falha
- Confirme tipo de dado (`dataType`)
- Verifique regex em `pattern`
- Teste com `POST /api/flows/:id/test`

### Variável não substitui
- Use formato correto: `{{nomeVariavel}}`
- Confirme que variável foi salva (`saveAs`)
- Verifique se variável está em `variables`

## Comandos Úteis

```bash
# Popular banco com exemplos
npm run seed

# Testar fluxo via API
curl -X POST http://localhost:3000/api/flows/1/test \
  -H "Authorization: Bearer TOKEN"

# Renderizar template
curl -X POST http://localhost:3000/api/templates/1/render \
  -H "Content-Type: application/json" \
  -d '{"variables": {"userName": "João"}}'
```

## Próximos Passos

1. Acesse **Configurações > Fluxos** no dashboard
2. Clique em **Novo Fluxo**
3. Configure trigger e steps
4. Teste em modo draft
5. Ative quando estiver pronto!

---

**Dúvidas?** Consulte a documentação técnica em `ARCHITECTURE.md`

