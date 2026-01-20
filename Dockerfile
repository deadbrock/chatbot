# Dockerfile para deploy do Chatbot WhatsApp

FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configurar Puppeteer para usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
# Tentar npm ci primeiro (mais rápido e determinístico)
# Se falhar, usar npm install como fallback
RUN npm ci --omit=dev || npm install --omit=dev --no-audit

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p logs uploads temp config

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]

