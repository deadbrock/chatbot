# 🤖 SISTEMA DE FLUXO DE CHATBOT - FG SERVICES

## 📋 VISÃO GERAL

Sistema completo de chatbot conversacional implementado para **FG Services**, baseado no fluxo de interação fornecido no diagrama Draw.io.

### ✨ CARACTERÍSTICAS PRINCIPAIS

- ✅ **Verificação automática de horário de atendimento** (8h-12h, 13h-17h, Segunda-Sexta)
- ✅ **Sistema de menus hierárquicos** com 7 opções principais e dezenas de submenus
- ✅ **Gerenciamento de sessão de usuário** com rastreamento de contexto
- ✅ **Coleta inteligente de dados** (nome, email, CPF, contrato, etc.)
- ✅ **Transferência automática para atendentes humanos**
- ✅ **Sistema de avaliação NPS** (0-10)
- ✅ **Integração completa com Baileys** (WhatsApp)
- ✅ **Mensagens fora do horário** com registro de solicitações

---

## 🏗️ ARQUITETURA

```
src/bot/
├── flowMessageHandler.js       # Handler principal de mensagens
├── services/
│   ├── flowManager.js          # Gerenciador de fluxo
│   └── scheduleService.js      # Verificação de horário
├── flows/
│   └── flowDefinitions.js      # Definições completas de todos os fluxos
└── whatsapp-baileys.js         # Cliente WhatsApp (Baileys)

src/models/
└── UserSessionSQL.js           # Modelo de sessão de usuário
```

---

## 📊 ESTRUTURA DE FLUXOS

### **FLUXO PRINCIPAL**

```
Início do Contato
    ↓
Verificação de Horário
    ↓
├─ DENTRO DO HORÁRIO → Boas-vindas → Menu Principal
└─ FORA DO HORÁRIO → Mensagem offline → Registro
```

### **MENU PRINCIPAL (7 opções)**

1️⃣ **Sou Cliente**
   - Coleta de dados (nome, telefone, email, contrato)
   - Submenus: Administrativo, Comercial, Operacional

2️⃣ **Quero ser cliente**
   - Coleta de dados de prospect
   - Transferência para comercial

3️⃣ **Colaborador**
   - Colaborador atual / Ex-colaborador
   - Opções: RDV, Pagamentos de diárias, Salários

4️⃣ **Atual fornecedor**
   - Menu financeiro
   - Contas a pagar / Contas a receber

5️⃣ **Quero ser fornecedor**
   - Transferência imediata para comercial

6️⃣ **Trabalhe Conosco**
   - Link direto: https://trabalhe-conosco.vercel.app

7️⃣ **Outros**
   - Transferência para atendente

---

## 🔧 MENU ADMINISTRATIVO (12 departamentos)

Quando o cliente seleciona "Sou Cliente" → "Administrativo":

1. **Departamento Pessoal**
   - Admissões, Benefícios, Férias, Afastamentos, Rescisões
   
2. **Financeiro**
   - Transferência para atendente

3. **Compras**
   - Compras / Pedidos de Materiais

4. **Manutenção**
   - Abrir chamados
   - Dúvidas técnicas
   - Solicitação de peças
   - Formulário Google Forms integrado

5. **Logística**
   - Pedidos por região (Recife, Norte, Nordeste)

6. **RH**
   - Contratações e Ouvidora

7. **Segurança do Trabalho**

8. **Faturamento**
   - Hierarquia: Encarregado, Supervisor, Coordenador, Gerente
   - Informações de faturamento / Comprovantes de Etanol

9. **Gerência Administrativa**
   - Coleta de dados completa

10. **Diretoria**
    - Transferência direta

11. **Operacional**
    - Transferência direta

12. **Voltar ao menu anterior**

---

## 🎯 FLUXO DE MANUTENÇÃO (Exemplo Completo)

```
Manutenção
    ↓
1. Abrir chamados
    ↓
    Selecione o equipamento:
    - Enceradeira
    - Lavadora de piso
    - Roçadeira
    - Aspirador
    - Polidora
    - Varredeira
    ↓
    Coleta de dados:
    - Cargo
    - Loja/Contrato
    - Endereço
    ↓
    Formulário Google Forms
    ↓
    Confirmação de preenchimento
    ↓
    ├─ SIM → Aguardar atendente → Conversa → NPS → Encerramento
    └─ NÃO → Encerramento imediato
```

---

## 💾 MODELO DE DADOS

### **UserSession**

```javascript
{
  phone: String,              // Número WhatsApp
  name: String,               // Nome do usuário
  email: String,              // Email
  cpf: String,                // CPF
  company: String,            // Empresa (fornecedor)
  contract: String,           // Contrato (cliente)
  
  currentFlow: String,        // Fluxo atual (ex: 'main_menu')
  currentStep: String,        // Passo atual (ex: 'start')
  menuPath: Array,            // Caminho percorrido
  formData: Object,           // Dados temporários
  
  isActive: Boolean,          // Sessão ativa?
  needsHumanAgent: Boolean,   // Precisa atendente?
  agentId: Integer,           // ID do atendente
  npsScore: Integer,          // Nota NPS (0-10)
  
  lastInteraction: Date,      // Última interação
  expiresAt: Date             // Expira em 24h
}
```

---

## ⏰ HORÁRIO DE ATENDIMENTO

### **Configuração**

```javascript
{
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '13:00', end: '17:00' },
  workDays: [1, 2, 3, 4, 5],  // Segunda a Sexta
  holidays: ['01-01', '12-25', ...]
}
```

### **Comportamento**

- ✅ **Dentro do horário**: Fluxo normal
- ⏰ **Fora do horário**: Mensagem + coleta de mensagem offline
- 📅 **Feriados**: Mensagem especial
- 🕛 **Horário de almoço**: Mensagem de retorno às 13h

---

## 🎨 PERSONALIZAÇÃO

### **Modificar horários**

```javascript
// src/bot/services/scheduleService.js
scheduleService.setBusinessHours({
  schedule: {
    morning: { start: { hour: 9, minute: 0 }, end: { hour: 12, minute: 30 } },
    afternoon: { start: { hour: 14, minute: 0 }, end: { hour: 18, minute: 0 } }
  }
});
```

### **Adicionar novo fluxo**

```javascript
// src/bot/flows/flowDefinitions.js
flows.novo_fluxo = {
  id: 'novo_fluxo',
  name: 'Novo Fluxo',
  message: 'Mensagem do novo fluxo',
  options: {
    '1': { next: 'proximo_fluxo' },
    '2': { action: 'transfer_to_agent' }
  }
};
```

---

## 🚀 COMO USAR

### **1. Iniciar o servidor**

```bash
cd chatbot-whatsapp
npm start
```

### **2. Escanear QR Code**

- Acesse: http://localhost:3001/admin
- Vá em: Administração → Conexões WhatsApp → Nova Conexão
- Escaneie o QR Code com WhatsApp

### **3. Testar o chatbot**

Envie mensagens para o número conectado:

```
# Primeira mensagem
Olá

# Resposta do bot
Olá 😊, seja bem vindo(a) ao atendimento da FG SERVICES
Excelência para quem faz com excelência

Como posso te chamar?

# Usuário
João Silva

# Bot
Selecione a opção que indica seu perfil:
1️⃣ Sou Cliente
2️⃣ Quero ser cliente
...

# Usuário
1

# ... fluxo continua
```

---

## 📈 MÉTRICAS E AVALIAÇÃO

### **Sistema NPS**

Ao final de cada atendimento:

```
🤝 Agradecemos o seu contato.

Agora, conta pra gente como você se sentiu 
neste atendimento digitando a sua nota de 0 a 10.
```

- **0-6**: Detratores
- **7-8**: Neutros  
- **9-10**: Promotores

**Cálculo NPS**: % Promotores - % Detratores

---

## 🔄 TRANSFERÊNCIA PARA ATENDENTE

### **Quando transferir?**

- Opção "Outros" selecionada
- Departamentos específicos (Diretoria, Operacional)
- Timeout de inatividade
- Solicitação explícita do usuário

### **Como funciona?**

```javascript
session.needsHumanAgent = true;
session.currentFlow = 'wait_for_agent';
formData.department = 'RH';
```

Dashboard recebe notificação e atendente assume a conversa.

---

## 🐛 TROUBLESHOOTING

### **Sessão não persiste**

```bash
# Verificar se tabela foi criada
SELECT * FROM user_sessions;
```

### **Horário não funciona**

```javascript
// Desabilitar verificação temporariamente
scheduleService.businessHours.enabled = false;
```

### **Fluxo travado**

```javascript
// Resetar sessão do usuário
session.reset();
await session.save();
```

---

## 📝 LOGS

### **Tipos de logs**

```
📨 Mensagem recebida
🔄 Processando fluxo: main_menu, step: start
✅ Nova sessão criada para 5511999999999
⏰ Sessão expirada, resetando...
💬 Mensagem em atendimento humano
⭐ NPS Score: 9 de 5511999999999
```

### **Localização**

```
logs/chatbot-YYYY-MM-DD.log
```

---

## 🎯 PRÓXIMOS PASSOS

### **Melhorias Planejadas**

- [ ] IA para respostas contextuais
- [ ] Histórico de conversas
- [ ] Agendamento de callbacks
- [ ] Envio de mídia (imagens, PDFs)
- [ ] Formulários inline (sem Google Forms)
- [ ] Dashboard de métricas em tempo real
- [ ] Multi-atendente
- [ ] Chatbot por voz

---

## 👥 SUPORTE

**Desenvolvido por**: Assistente IA (Claude)  
**Cliente**: FG Services  
**Data**: Dezembro 2025

**Contato**: 
- Sistema: http://localhost:3001
- Dashboard: http://localhost:3001/admin

---

## ⚡ COMANDOS RÁPIDOS

```bash
# Iniciar servidor
npm start

# Ver logs em tempo real
tail -f logs/chatbot-*.log

# Limpar sessões antigas
DELETE FROM user_sessions WHERE expiresAt < NOW();

# Estatísticas de NPS
SELECT AVG(npsScore) FROM user_sessions WHERE npsScore IS NOT NULL;

# Usuários ativos
SELECT COUNT(*) FROM user_sessions WHERE isActive = 1;
```

---

## 🎉 SUCESSO!

Sistema **100% funcional** e pronto para produção! 🚀

Todos os fluxos implementados conforme diagrama Draw.io fornecido.

**Boa sorte com o chatbot da FG Services!** 💪😊

