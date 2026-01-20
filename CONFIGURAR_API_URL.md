# 🔧 Configurar URL da API após Deploy

## ⚠️ Erro: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

Este erro ocorre porque a URL da API do Railway não está configurada no frontend.

## ✅ Solução: Configurar URL da API

### Passo 1: Obter URL do Railway

1. Acesse o Railway
2. Vá para o serviço do backend
3. Copie a URL pública (ex: `https://seu-projeto.up.railway.app`)

### Passo 2: Configurar no Frontend

Você precisa configurar a URL em **2 arquivos**:

#### Arquivo 1: `src/dashboard/public/index.html`

Encontre a linha 7 e configure:

```html
<!-- Configure esta meta tag com a URL da API do Railway após o deploy -->
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

E também configure o script tag (linha 9-13):

```html
<script id="api-config" type="application/json">
{
  "apiUrl": "https://seu-projeto.up.railway.app"
}
</script>
```

#### Arquivo 2: `src/dashboard/public/login.html`

Encontre a linha 7 e configure:

```html
<!-- Configure esta meta tag com a URL da API do Railway após o deploy -->
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

E também configure o script tag (linha 9-13):

```html
<script id="api-config" type="application/json">
{
  "apiUrl": "https://seu-projeto.up.railway.app"
}
</script>
```

### Passo 3: Commit e Push

```bash
git add src/dashboard/public/index.html src/dashboard/public/login.html
git commit -m "feat: configurar URL da API do Railway"
git push
```

### Passo 4: Aguardar Redeploy

- O Vercel detecta automaticamente o push e faz redeploy
- Aguarde alguns minutos
- Teste o login novamente

## 🔍 Verificar se Está Funcionando

1. Abra o console do navegador (F12)
2. Tente fazer login
3. Procure por mensagens como:
   - `🔍 Tentando fazer login em: https://seu-projeto.up.railway.app/api/users/login`
   - Se aparecer `/api/users/login` sem o domínio completo, a configuração não está funcionando

## 🐛 Troubleshooting

### Erro persiste após configurar

1. **Verifique se a URL está correta:**
   - A URL deve ser `https://seu-projeto.up.railway.app` (sem `/api` no final)
   - O código adiciona `/api` automaticamente

2. **Verifique CORS no Railway:**
   - No Railway, adicione a variável de ambiente:
   ```
   ALLOWED_ORIGINS=https://seu-projeto.vercel.app
   ```

3. **Verifique se o Railway está online:**
   - Acesse `https://seu-projeto.up.railway.app/api/health` (se existir)
   - Ou teste qualquer endpoint da API

4. **Limpe o cache do navegador:**
   - Ctrl+Shift+Delete
   - Limpe cache e cookies
   - Tente novamente

### Ainda não funciona?

Verifique os logs do console do navegador e me envie:
- Mensagens de erro completas
- URL que está sendo chamada
- Status code da resposta
