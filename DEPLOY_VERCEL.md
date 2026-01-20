# 🚀 Guia de Deploy no Vercel

## 📋 Framework a Escolher

**Escolha: `Other` ou `Static Site`**

Como o projeto é um frontend estático (HTML, CSS, JavaScript vanilla), não precisa de um framework específico.

## 🔧 Passo a Passo

### 1. **Conectar Repositório**
- Acesse [vercel.com](https://vercel.com)
- Faça login com GitHub/GitLab/Bitbucket
- Clique em "Add New Project"
- Selecione o repositório do projeto

### 2. **Configurar Projeto**

Quando o Vercel perguntar sobre o framework:

**Framework Preset:** Selecione **`Other`** ou deixe em branco (detecta automaticamente)

**Root Directory:** Deixe em branco ou defina como raiz do projeto

**Build Command:** Deixe em branco (não precisa de build)

**Output Directory:** `src/dashboard/public`

**Install Command:** Deixe padrão (`npm install`)

### 3. **Variáveis de Ambiente**

**O Vercel NÃO precisa de variáveis de ambiente obrigatórias** para este projeto (é um site estático).

**Opcional:** Você pode adicionar `API_URL` se quiser usar variável de ambiente:
- Name: `API_URL`
- Value: `https://seu-projeto.up.railway.app`
- Environment: Production, Preview, Development

**⚠️ IMPORTANTE:** A URL da API do Railway será configurada via meta tag no HTML (método recomendado).

### 4. **Configuração Automática**

O arquivo `vercel.json` já está configurado e o Vercel vai:
- ✅ Servir arquivos estáticos de `src/dashboard/public`
- ✅ Redirecionar `/admin` para `index.html`
- ✅ Configurar CORS headers
- ✅ Não executar build (site estático)

### 5. **Após o Deploy**

1. **Obter URL do Railway:**
   - Acesse o Railway
   - Copie a URL do serviço (ex: `https://seu-projeto.up.railway.app`)

2. **Configurar URL da API no Frontend:**
   
   Opção A - Via Meta Tag (recomendado):
   ```html
   <!-- Edite src/dashboard/public/index.html -->
   <meta name="api-url" content="https://seu-projeto.up.railway.app">
   ```

   Opção B - Via Script Tag:
   ```html
   <!-- Edite src/dashboard/public/index.html -->
   <script id="api-config" type="application/json" data-api-url="https://seu-projeto.up.railway.app"></script>
   ```

3. **Fazer commit e push:**
   ```bash
   git add src/dashboard/public/index.html
   git commit -m "feat: configurar URL da API do Railway"
   git push
   ```

4. **Redeploy no Vercel:**
   - O Vercel detecta automaticamente o push
   - Ou faça redeploy manual no painel

### 6. **Configurar CORS no Railway**

Certifique-se de que o Railway permite requisições do domínio Vercel:

No Railway, adicione a variável de ambiente:
```
ALLOWED_ORIGINS=https://seu-projeto.vercel.app
```

## ✅ Checklist

- [ ] Repositório conectado ao Vercel
- [ ] Framework selecionado: `Other` ou `Static Site`
- [ ] Output Directory: `src/dashboard/public`
- [ ] Variável `NODE_ENV=production` configurada
- [ ] URL da API configurada no `index.html`
- [ ] CORS configurado no Railway com domínio Vercel
- [ ] Deploy realizado com sucesso
- [ ] Teste de acesso ao dashboard funcionando

## 🐛 Troubleshooting

### Erro 404 nas rotas
- Verifique se o `vercel.json` está correto
- Certifique-se de que `outputDirectory` aponta para `src/dashboard/public`

### Erro de CORS
- Verifique se `ALLOWED_ORIGINS` no Railway inclui o domínio Vercel
- Verifique se os headers CORS estão configurados no `vercel.json`

### API não conecta
- Verifique se a URL da API está correta no `index.html`
- Verifique se o Railway está online
- Verifique os logs do Railway para erros

## 📝 Notas

- O Vercel detecta automaticamente sites estáticos
- Não é necessário configurar build command
- O `vercel.json` já está otimizado para este projeto
- O frontend se conecta ao backend via API REST e Socket.IO
