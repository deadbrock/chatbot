# ⚡ Quick Start - Comece em 15 Minutos!

## 🎯 Objetivo

Ter o chatbot funcionando em **15 minutos** com configuração mínima.

---

## ✅ Checklist Rápida

Antes de começar, certifique-se de ter:

- [ ] Node.js 18+ instalado
- [ ] MongoDB rodando
- [ ] Redis rodando
- [ ] Chave da OpenAI API
- [ ] Credenciais Google Cloud

---

## 🚀 Passo a Passo

### 1️⃣ Clone e Instale (2 min)

```bash
# Clone o repositório
git clone <seu-repositorio>
cd chatbot-whatsapp

# Instale dependências
npm install
```

### 2️⃣ Configure Ambiente (3 min)

```bash
# Copie o arquivo de exemplo
cp env.example .env

# Edite com suas credenciais
nano .env
```

**Mínimo necessário:**

```env
# OpenAI (OBRIGATÓRIO)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Google Cloud (OBRIGATÓRIO)
GOOGLE_PROJECT_ID=seu-projeto
GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json

# MongoDB (padrão local)
MONGODB_URI=mongodb://localhost:27017/chatbot_whatsapp

# Redis (padrão local)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (gere uma chave qualquer)
JWT_SECRET=minha_chave_super_secreta_123
```

### 3️⃣ Credenciais Google (2 min)

```bash
# Crie pasta config
mkdir config

# Coloque seu arquivo de credenciais
cp /caminho/google-credentials.json ./config/
```

### 4️⃣ Inicialize Banco (1 min)

```bash
npm run setup
```

Você verá:
```
✅ MongoDB conectado
✅ Usuário admin criado
📧 Email: admin@admin.com
🔑 Senha: admin123
```

### 5️⃣ Inicie o Bot (1 min)

```bash
npm start
```

### 6️⃣ Conecte WhatsApp (2 min)

1. Um **QR Code** aparecerá no terminal
2. Abra WhatsApp no celular
3. Vá em **Configurações** > **Aparelhos Conectados**
4. Escaneie o QR Code
5. Aguarde: **"WhatsApp conectado!"**

### 7️⃣ Teste! (2 min)

Envie uma mensagem para o número conectado:

```
Olá
```

O bot deve responder! 🎉

### 8️⃣ Acesse Dashboard (2 min)

Abra no navegador:

```
http://localhost:3000/admin
```

**Login:**
- Email: `admin@admin.com`
- Senha: `admin123`

---

## 🎉 Pronto!

Seu chatbot está funcionando! 

### Próximos Passos

1. **Altere a senha admin** (IMPORTANTE!)
2. **Personalize mensagens**: `src/config/messages.js`
3. **Configure departamentos**: `src/config/departments.js`
4. **Adicione atendentes**: Via dashboard
5. **Leia a documentação completa**: [README.md](./README.md)

---

## 🆘 Problemas?

### QR Code não aparece

```bash
# Limpe sessão antiga
rm -rf .wwebjs_auth/
npm start
```

### Erro de conexão MongoDB

```bash
# Verifique se está rodando
sudo systemctl status mongod

# Inicie se necessário
sudo systemctl start mongod
```

### Erro de conexão Redis

```bash
# Verifique se está rodando
redis-cli ping

# Inicie se necessário
sudo systemctl start redis-server
```

### Bot não responde

1. Verifique se WhatsApp está conectado
2. Veja logs no terminal
3. Verifique chave OpenAI
4. Teste com comando: `menu`

---

## 📚 Documentação Completa

- [README](./README.md) - Visão geral
- [INSTALLATION](./INSTALLATION.md) - Instalação detalhada
- [USAGE](./USAGE.md) - Como usar
- [API](./API.md) - Referência da API
- [FEATURES](./FEATURES.md) - Funcionalidades

---

## 💬 Suporte

- 📧 Email: suporte@suaempresa.com
- 💬 WhatsApp: (XX) XXXXX-XXXX
- 🐛 Issues: [GitHub](seu-repo/issues)

---

**Bom uso! 🚀**

