# 🤖 Chatbot WhatsApp Empresarial - Sistema Completo

## 📋 Descrição

Chatbot WhatsApp profissional com Inteligência Artificial, processamento de linguagem natural, reconhecimento de voz, e integração completa com todos os departamentos da empresa.

## ✨ Funcionalidades Principais

### 🎯 Recursos Básicos
- ✅ Atendimento automatizado 24/7
- ✅ Menu interativo por departamento
- ✅ Sistema de tickets e CRM integrado
- ✅ Transferência para atendimento humano
- ✅ Histórico completo de conversas
- ✅ Respostas rápidas e templates

### 🚀 Funcionalidades Inovadoras

#### 1. **Inteligência Artificial Avançada**
- GPT-4 para respostas contextuais inteligentes
- Aprendizado contínuo com conversas
- Análise de sentimento do cliente
- Predição de intenções

#### 2. **Processamento de Voz**
- Reconhecimento de áudio (Speech-to-Text)
- Respostas em áudio (Text-to-Speech)
- Suporte a múltiplos idiomas

#### 3. **Automação Inteligente**
- Agendamento automático de reuniões
- Geração de protocolos de atendimento
- Envio de documentos e formulários
- Integração com calendários

#### 4. **Analytics e Relatórios**
- Dashboard em tempo real
- Métricas de atendimento
- Análise de satisfação (NPS)
- Relatórios por departamento

#### 5. **Multi-atendimento**
- Suporte a múltiplos atendentes
- Fila de espera inteligente
- Distribuição automática por departamento
- Sistema de prioridades

#### 6. **Integrações**
- CRM (Salesforce, HubSpot)
- ERP (SAP, TOTVS)
- Google Calendar
- Sistemas internos via API

## 🏢 Departamentos Configurados

1. **Atendimento/Recepção** - Triagem inicial e direcionamento
2. **Logística** - Rastreamento, entregas, coletas
3. **Manutenção** - Abertura de chamados, agendamentos
4. **Gerência Administrativa** - Solicitações administrativas
5. **Comercial** - Vendas, orçamentos, propostas
6. **Recursos Humanos** - Vagas, benefícios, documentos
7. **Departamento Pessoal** - Folha, férias, atestados
8. **T.I** - Suporte técnico, senhas, acessos
9. **Financeiro** - Pagamentos, cobranças, consultas
10. **Faturamento** - Notas fiscais, boletos
11. **Segurança do Trabalho** - Treinamentos, EPIs, acidentes
12. **Marketing** - Campanhas, materiais, eventos
13. **Coordenadoria** - Gestão de projetos
14. **Operações** - Processos operacionais

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+
- MongoDB 6+
- Redis 7+
- Conta Google Cloud (Dialogflow, Speech API)
- Conta OpenAI (GPT-4)

### Passo a Passo

```bash
# 1. Clone o repositório
git clone <seu-repositorio>
cd chatbot-whatsapp

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais

# 4. Configure o Google Cloud
# Coloque seu arquivo de credenciais em: config/google-credentials.json

# 5. Inicialize o banco de dados
npm run setup

# 6. Inicie o servidor
npm run dev
```

### Primeira Execução

1. Ao iniciar, um QR Code será exibido no terminal
2. Escaneie com seu WhatsApp (WhatsApp Web)
3. Aguarde a mensagem "WhatsApp conectado!"
4. O bot está pronto para uso

## 📱 Como Usar

### Para Clientes

Envie uma mensagem para o número do WhatsApp configurado:

```
Olá
```

O bot responderá com o menu principal e guiará você pelos departamentos.

### Para Administradores

Acesse o dashboard em: `http://localhost:3000/admin`

**Credenciais padrão:**
- Usuário: admin
- Senha: admin123 (altere imediatamente!)

## 🎮 Comandos Especiais

### Comandos do Cliente
- `menu` - Exibe menu principal
- `falar com atendente` - Transfere para humano
- `protocolo` - Consulta protocolo de atendimento
- `avaliar` - Avalia o atendimento
- `cancelar` - Cancela operação atual

### Comandos do Atendente
- `/assumir` - Assume o atendimento
- `/transferir [depto]` - Transfere para outro departamento
- `/finalizar` - Finaliza o atendimento
- `/nota [texto]` - Adiciona nota interna
- `/prioridade [alta|media|baixa]` - Define prioridade

## 🔧 Configurações Avançadas

### Personalização de Mensagens

Edite: `src/config/messages.js`

### Adicionar Novo Departamento

1. Edite: `src/config/departments.js`
2. Crie o handler: `src/handlers/[departamento]Handler.js`
3. Adicione rotas: `src/flows/[departamento]Flow.js`

### Integração com APIs Externas

Edite: `src/integrations/`

## 📊 Estrutura do Projeto

```
chatbot-whatsapp/
├── src/
│   ├── server.js              # Servidor principal
│   ├── bot/
│   │   ├── whatsapp.js        # Cliente WhatsApp
│   │   ├── aiEngine.js        # Motor de IA
│   │   └── nlp.js             # Processamento de linguagem
│   ├── handlers/              # Handlers por departamento
│   ├── flows/                 # Fluxos de conversação
│   ├── controllers/           # Controllers da API
│   ├── models/                # Models do MongoDB
│   ├── services/              # Serviços (email, sms, etc)
│   ├── integrations/          # Integrações externas
│   ├── middleware/            # Middlewares
│   ├── utils/                 # Utilitários
│   ├── config/                # Configurações
│   └── dashboard/             # Dashboard web
├── logs/                      # Logs do sistema
├── uploads/                   # Arquivos enviados
└── docs/                      # Documentação adicional
```

## 🔐 Segurança

- Autenticação JWT para dashboard
- Criptografia de dados sensíveis
- Rate limiting anti-spam
- Validação de números autorizados
- Logs de auditoria completos

## 📈 Performance

- Cache Redis para respostas rápidas
- Processamento assíncrono de mensagens
- Suporte a 50+ conversas simultâneas
- Tempo médio de resposta: < 2s

## 🆘 Suporte

Para dúvidas ou problemas:
- 📧 Email: suporte@suaempresa.com
- 📱 WhatsApp: (XX) XXXXX-XXXX
- 📖 Documentação: [link]

## 📝 Licença

MIT License - Veja LICENSE para mais detalhes

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja CONTRIBUTING.md

---

**Desenvolvido com ❤️ para transformar o atendimento da sua empresa**

"# chatbot" 
