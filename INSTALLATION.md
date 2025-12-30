# 📦 Guia de Instalação Completo

## Pré-requisitos

Antes de iniciar a instalação, certifique-se de ter:

### Software Necessário

- **Node.js** 18.x ou superior ([Download](https://nodejs.org/))
- **MongoDB** 6.x ou superior ([Download](https://www.mongodb.com/try/download/community))
- **Redis** 7.x ou superior ([Download](https://redis.io/download))
- **Git** ([Download](https://git-scm.com/downloads))

### Contas de Serviços

- **OpenAI API Key** ([Obter aqui](https://platform.openai.com/api-keys))
- **Google Cloud Account** com APIs ativadas:
  - Dialogflow API
  - Cloud Speech-to-Text API
  - Cloud Text-to-Speech API
  - ([Console Google Cloud](https://console.cloud.google.com/))

---

## 1️⃣ Instalação do MongoDB

### Windows

```bash
# Download do instalador
# https://www.mongodb.com/try/download/community

# Ou via Chocolatey
choco install mongodb

# Iniciar serviço
net start MongoDB
```

### Linux (Ubuntu/Debian)

```bash
# Importar chave pública
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Adicionar repositório
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar serviço
sudo systemctl start mongod
sudo systemctl enable mongod
```

### macOS

```bash
# Via Homebrew
brew tap mongodb/brew
brew install mongodb-community@6.0

# Iniciar serviço
brew services start mongodb-community@6.0
```

---

## 2️⃣ Instalação do Redis

### Windows

```bash
# Via Chocolatey
choco install redis-64

# Ou baixar do GitHub
# https://github.com/microsoftarchive/redis/releases

# Iniciar serviço
redis-server
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install redis-server

# Iniciar serviço
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### macOS

```bash
# Via Homebrew
brew install redis

# Iniciar serviço
brew services start redis
```

---

## 3️⃣ Configuração do Google Cloud

### Passo 1: Criar Projeto

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em "Criar Projeto"
3. Nomeie seu projeto (ex: "chatbot-whatsapp")
4. Anote o **Project ID**

### Passo 2: Ativar APIs

No console, ative as seguintes APIs:

- Dialogflow API
- Cloud Speech-to-Text API
- Cloud Text-to-Speech API

```bash
# Ou via gcloud CLI
gcloud services enable dialogflow.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable texttospeech.googleapis.com
```

### Passo 3: Criar Credenciais

1. Vá em "APIs & Services" > "Credentials"
2. Clique em "Create Credentials" > "Service Account"
3. Preencha os dados e crie
4. Clique na conta criada
5. Vá em "Keys" > "Add Key" > "Create new key"
6. Escolha JSON e baixe o arquivo
7. Salve como `google-credentials.json` na pasta `config/`

---

## 4️⃣ Instalação do Chatbot

### Passo 1: Clonar Repositório

```bash
# Clone o projeto
git clone <seu-repositorio>
cd chatbot-whatsapp
```

### Passo 2: Instalar Dependências

```bash
# Instalar pacotes Node.js
npm install
```

### Passo 3: Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar arquivo .env
nano .env  # ou use seu editor preferido
```

**Configure as seguintes variáveis:**

```env
# Servidor
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/chatbot_whatsapp

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OpenAI (OBRIGATÓRIO)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Cloud (OBRIGATÓRIO)
GOOGLE_PROJECT_ID=seu-projeto-id
GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json

# JWT (Gere uma chave segura)
JWT_SECRET=sua_chave_super_segura_aqui

# WhatsApp
WHATSAPP_SESSION_NAME=chatbot-session
WHATSAPP_TIMEOUT=60000

# Atendimento
MAX_SIMULTANEOUS_CHATS=50
INACTIVITY_TIMEOUT=300000
AUTO_CLOSE_TICKET_HOURS=24
```

### Passo 4: Colocar Credenciais Google

```bash
# Criar pasta config
mkdir config

# Copiar arquivo de credenciais Google
cp /caminho/para/google-credentials.json ./config/
```

### Passo 5: Inicializar Banco de Dados

```bash
# Executar script de setup
npm run setup
```

Este comando irá:
- Criar índices no MongoDB
- Criar usuário admin padrão
- Configurar estrutura inicial

**Credenciais padrão:**
- Email: `admin@admin.com`
- Senha: `admin123`

⚠️ **IMPORTANTE:** Altere a senha imediatamente após o primeiro login!

---

## 5️⃣ Iniciar o Chatbot

### Modo Desenvolvimento

```bash
npm run dev
```

### Modo Produção

```bash
npm start
```

---

## 6️⃣ Conectar WhatsApp

1. Após iniciar o servidor, um **QR Code** será exibido no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Configurações** > **Aparelhos Conectados**
4. Clique em **Conectar um aparelho**
5. Escaneie o QR Code exibido no terminal
6. Aguarde a mensagem: **"WhatsApp conectado e pronto para uso!"**

✅ Pronto! Seu chatbot está funcionando!

---

## 7️⃣ Acessar Dashboard

Abra seu navegador e acesse:

```
http://localhost:3000/admin
```

**Login:**
- Email: `admin@admin.com`
- Senha: `admin123`

---

## 8️⃣ Testar o Chatbot

Envie uma mensagem para o número do WhatsApp conectado:

```
Olá
```

O bot deve responder com o menu de boas-vindas! 🎉

---

## 🔧 Solução de Problemas

### Erro: "Cannot connect to MongoDB"

```bash
# Verificar se MongoDB está rodando
sudo systemctl status mongod

# Iniciar se necessário
sudo systemctl start mongod
```

### Erro: "Redis connection refused"

```bash
# Verificar se Redis está rodando
redis-cli ping

# Deve retornar: PONG

# Iniciar se necessário
sudo systemctl start redis-server
```

### Erro: "OpenAI API key not found"

Verifique se a variável `OPENAI_API_KEY` está configurada corretamente no arquivo `.env`

### Erro: "Google credentials not found"

Verifique se:
1. O arquivo `google-credentials.json` está na pasta `config/`
2. A variável `GOOGLE_APPLICATION_CREDENTIALS` aponta para o arquivo correto
3. O arquivo tem permissões de leitura

### QR Code não aparece

```bash
# Limpar sessão antiga
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Reiniciar servidor
npm start
```

### Porta 3000 já em uso

```bash
# Alterar porta no .env
PORT=3001

# Ou matar processo na porta 3000
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 🚀 Próximos Passos

1. **Personalizar Mensagens**: Edite `src/config/messages.js`
2. **Adicionar Departamentos**: Edite `src/config/departments.js`
3. **Configurar Integrações**: Veja `docs/INTEGRATIONS.md`
4. **Deploy em Produção**: Veja `docs/DEPLOYMENT.md`
5. **Backup Automático**: Configure em `src/services/scheduler.js`

---

## 📚 Documentação Adicional

- [Guia de Uso](./USAGE.md)
- [API Reference](./API.md)
- [Integrações](./docs/INTEGRATIONS.md)
- [Deploy](./docs/DEPLOYMENT.md)
- [FAQ](./docs/FAQ.md)

---

## 💬 Suporte

Problemas na instalação?

- 📧 Email: suporte@suaempresa.com
- 📱 WhatsApp: (XX) XXXXX-XXXX
- 🐛 Issues: [GitHub Issues](seu-repositorio/issues)

---

**Desenvolvido com ❤️ para transformar o atendimento da sua empresa**

