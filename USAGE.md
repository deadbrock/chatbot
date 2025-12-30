# 📖 Guia de Uso do Chatbot WhatsApp

## Índice

1. [Para Clientes](#para-clientes)
2. [Para Atendentes](#para-atendentes)
3. [Para Administradores](#para-administradores)
4. [Comandos Disponíveis](#comandos-disponíveis)
5. [Fluxos de Atendimento](#fluxos-de-atendimento)

---

## 👤 Para Clientes

### Como Iniciar uma Conversa

Envie qualquer mensagem para o número do WhatsApp do chatbot:

```
Olá
Oi
Preciso de ajuda
```

O bot responderá com uma mensagem de boas-vindas e o menu principal.

### Menu Principal

Após a saudação inicial, você verá:

```
🏢 DEPARTAMENTOS DISPONÍVEIS

1. 👋 Atendimento/Recepção 🟢
2. 🚚 Logística 🟢
3. 🔧 Manutenção 🟢
4. 💼 Comercial 🟢
...

💡 Ou digite sua dúvida que te ajudo a encontrar o departamento certo!
```

### Como Escolher um Departamento

**Opção 1: Digite o número**
```
1
```

**Opção 2: Digite o nome**
```
logística
comercial
```

**Opção 3: Descreva sua necessidade**
```
Preciso rastrear minha entrega
Quero fazer um orçamento
```

O bot usará IA para identificar o departamento correto!

### Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `menu` | Exibe o menu principal |
| `departamentos` | Lista todos os departamentos |
| `protocolo` | Consulta seus protocolos |
| `atendente` | Fala com um humano |
| `rastrear` | Rastreia pedido |
| `faq` | Perguntas frequentes |
| `avaliar` | Avalia o atendimento |
| `cancelar` | Cancela operação atual |
| `sair` | Finaliza atendimento |

### Enviando Arquivos

Você pode enviar:

- 📷 **Fotos** (JPG, PNG)
- 📄 **Documentos** (PDF, DOC, DOCX)
- 🎤 **Áudios** (serão transcritos automaticamente)

Exemplo de uso:
```
Cliente: [envia foto de um problema]
Bot: 📄 Documento recebido!
     Estou processando...
     ✅ Documento processado com sucesso!
     Protocolo anexado ao seu atendimento.
```

### Mensagens de Voz

Envie um áudio e o bot irá:
1. Transcrever automaticamente
2. Processar sua solicitação
3. Responder normalmente

```
Cliente: [áudio: "Quero rastrear meu pedido"]
Bot: 🎤 Processando seu áudio...
     ✅ Entendi: "Quero rastrear meu pedido"
     
     📦 RASTREAMENTO
     Por favor, informe o número do pedido:
```

### Avaliação de Atendimento

Ao finalizar, você pode avaliar:

```
⭐ Como foi seu atendimento?

Avalie de 1 a 5:

1 - Péssimo 😞
2 - Ruim 😕
3 - Regular 😐
4 - Bom 😊
5 - Excelente 🤩
```

---

## 👨‍💼 Para Atendentes

### Acessar Sistema

1. Acesse: `http://localhost:3000/admin`
2. Faça login com suas credenciais
3. Vá para a seção "Tickets"

### Assumir Atendimento

Quando um cliente solicita atendente humano:

1. Você receberá notificação no dashboard
2. Clique em "Assumir" no ticket
3. Comece a conversar diretamente pelo WhatsApp

### Comandos de Atendente

Use estes comandos durante o atendimento:

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/assumir` | Assume o atendimento | `/assumir` |
| `/transferir` | Transfere para outro depto | `/transferir logistica` |
| `/finalizar` | Finaliza atendimento | `/finalizar` |
| `/nota` | Adiciona nota interna | `/nota Cliente está satisfeito` |
| `/prioridade` | Define prioridade | `/prioridade alta` |

### Exemplo de Fluxo

```
Cliente: Preciso falar com um atendente
Bot: 👤 Conectando você com um atendente humano...
     ⏳ Você é o 1º da fila.

[Atendente assume]

Bot: ✅ João Silva assumiu seu atendimento!
     Fique à vontade para conversar. 😊

Atendente: Olá! Como posso ajudar?
Cliente: Meu pedido não chegou
Atendente: Vou verificar para você...

[Atendente digita: /nota Verificando status do pedido #12345]

Atendente: Seu pedido está a caminho, chegará amanhã!
Cliente: Obrigado!

[Atendente digita: /finalizar]

Bot: ✅ Atendimento finalizado!
     Foi um prazer ajudar você! 😊
```

### Boas Práticas

✅ **Faça:**
- Responda rapidamente
- Seja educado e empático
- Use o nome do cliente
- Adicione notas internas importantes
- Finalize tickets resolvidos

❌ **Evite:**
- Deixar cliente sem resposta
- Usar linguagem informal demais
- Esquecer de finalizar tickets
- Transferir sem necessidade

---

## 👨‍💻 Para Administradores

### Dashboard Principal

Acesse: `http://localhost:3000/admin`

#### Métricas Principais

- **Tickets Hoje**: Total de tickets criados hoje
- **Tickets Abertos**: Tickets aguardando atendimento
- **Sessões Ativas**: Conversas em andamento
- **Atendentes Online**: Atendentes disponíveis

#### Gráficos

- **Timeline**: Tickets dos últimos 30 dias
- **Status**: Distribuição por status
- **Departamentos**: Tickets por departamento
- **Performance**: Desempenho dos atendentes

### Gerenciar Usuários

**Criar Novo Atendente:**

1. Vá em "Atendentes"
2. Clique em "Novo Atendente"
3. Preencha os dados:
   - Nome
   - Email
   - Senha
   - Departamento
   - Permissões
4. Salvar

**Permissões Disponíveis:**

- `admin` - Acesso total
- `manager` - Gerenciar departamento
- `agent` - Atender tickets
- `viewer` - Apenas visualizar

### Configurações do Sistema

#### Mensagens Automáticas

Edite: `src/config/messages.js`

```javascript
welcome: {
  first_time: `🤖 Olá! Seja bem-vindo(a)!
  
  Sua mensagem personalizada aqui...`
}
```

#### Departamentos

Edite: `src/config/departments.js`

```javascript
NOVO_DEPTO: {
  id: 'novo_depto',
  name: 'Novo Departamento',
  emoji: '🎯',
  description: 'Descrição do departamento',
  keywords: ['palavra1', 'palavra2'],
  priority: 2,
  workingHours: {
    start: '08:00',
    end: '18:00',
    days: [1, 2, 3, 4, 5]
  }
}
```

#### Horários de Atendimento

Configure por departamento:

```javascript
workingHours: {
  start: '08:00',  // Início
  end: '18:00',    // Fim
  days: [1, 2, 3, 4, 5]  // 0=Dom, 1=Seg, ..., 6=Sáb
}
```

### Relatórios

#### Relatório Diário

Gerado automaticamente às 9h com:
- Total de tickets
- Tickets resolvidos
- Avaliação média
- Tempo médio de resposta

#### Exportar Dados

```bash
# Via API
GET /api/analytics/tickets/timeline?days=30

# Ou use o dashboard para exportar CSV
```

### Backup

Configure backup automático em:
`src/services/scheduler.js`

```javascript
// Backup diário às 2h
const backupJob = new cron.CronJob(
  '0 2 * * *',
  async () => {
    await performBackup();
  }
);
```

---

## 🎮 Comandos Disponíveis

### Comandos do Cliente

```
menu          - Exibe menu principal
departamentos - Lista departamentos
protocolo     - Consulta protocolos
atendente     - Fala com humano
rastrear      - Rastreia pedido
faq           - Perguntas frequentes
avaliar       - Avalia atendimento
cancelar      - Cancela operação
sair          - Finaliza atendimento
help          - Lista comandos
```

### Comandos do Atendente

```
/assumir              - Assume atendimento
/transferir [depto]   - Transfere para departamento
/finalizar            - Finaliza atendimento
/nota [texto]         - Adiciona nota interna
/prioridade [nivel]   - Define prioridade (baixa/media/alta/urgente)
```

---

## 📊 Fluxos de Atendimento

### Fluxo 1: Atendimento Automático

```
Cliente: Olá
   ↓
Bot: Boas-vindas + Menu
   ↓
Cliente: Escolhe departamento
   ↓
Bot: Direciona + Perguntas
   ↓
Bot: Resolve automaticamente
   ↓
Bot: Solicita avaliação
```

### Fluxo 2: Transferência para Humano

```
Cliente: Quero falar com atendente
   ↓
Bot: Coloca na fila
   ↓
Sistema: Notifica atendentes
   ↓
Atendente: Assume
   ↓
Conversa direta
   ↓
Atendente: /finalizar
   ↓
Bot: Solicita avaliação
```

### Fluxo 3: Abertura de Ticket

```
Cliente: Problema complexo
   ↓
Bot: Cria ticket automaticamente
   ↓
Bot: Gera protocolo
   ↓
Cliente: Recebe número do protocolo
   ↓
Sistema: Notifica departamento
   ↓
Atendente: Resolve
   ↓
Cliente: Recebe atualizações
```

### Fluxo 4: Rastreamento

```
Cliente: rastrear
   ↓
Bot: Solicita número do pedido
   ↓
Cliente: 12345
   ↓
Bot: Consulta sistema
   ↓
Bot: Retorna informações
   ↓
Cliente: Satisfeito
```

---

## 💡 Dicas e Truques

### Para Clientes

1. **Seja específico**: Quanto mais detalhes, melhor o bot entende
2. **Use palavras-chave**: "rastrear", "orçamento", "suporte"
3. **Envie fotos**: Ajuda muito em problemas técnicos
4. **Guarde o protocolo**: Para consultas futuras

### Para Atendentes

1. **Responda rápido**: Cliente aguardando
2. **Use notas**: Documente tudo
3. **Transfira corretamente**: Para o departamento certo
4. **Finalize tickets**: Mantenha organizado

### Para Administradores

1. **Monitore métricas**: Diariamente
2. **Ajuste horários**: Conforme demanda
3. **Treine atendentes**: Periodicamente
4. **Atualize FAQs**: Com perguntas comuns

---

## 🆘 Ajuda

Precisa de ajuda?

- 📖 Documentação: [README.md](./README.md)
- 🔧 Instalação: [INSTALLATION.md](./INSTALLATION.md)
- 🐛 Problemas: [GitHub Issues](seu-repo/issues)
- 📧 Email: suporte@suaempresa.com

---

**Bom uso! 🚀**

