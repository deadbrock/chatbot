# 🔐 Variáveis de Ambiente no Vercel

## ✅ Resposta Rápida

**O Vercel NÃO precisa de variáveis de ambiente obrigatórias** para este projeto, pois é um site estático (HTML, CSS, JS).

## 📋 Variáveis Opcionais (Recomendadas)

Você pode configurar uma variável opcional para facilitar a configuração da API:

### `API_URL` (Opcional)

**Descrição:** URL base da API do Railway

**Valor:** `https://seu-projeto.up.railway.app`

**Como usar:** O código já detecta automaticamente, mas você pode configurar via:
1. Meta tag no HTML (recomendado)
2. Script tag no HTML
3. Variável de ambiente (se quiser usar)

## 🔧 Como Configurar no Vercel

### Opção 1: Via Painel do Vercel (Recomendado)

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione (opcional):
   ```
   Name: API_URL
   Value: https://seu-projeto.up.railway.app
   Environment: Production, Preview, Development (marque todos)
   ```

### Opção 2: Via Meta Tag no HTML (Mais Simples)

Edite `src/dashboard/public/index.html` e adicione:

```html
<meta name="api-url" content="https://seu-projeto.up.railway.app">
```

### Opção 3: Via Script Tag no HTML

Edite `src/dashboard/public/index.html` e modifique o script existente:

```html
<script id="api-config" type="application/json">
{
  "apiUrl": "https://seu-projeto.up.railway.app"
}
</script>
```

## 🎯 Qual Método Usar?

**Recomendação:** Use a **Opção 2 (Meta Tag)** porque:
- ✅ Mais simples
- ✅ Não depende de variáveis de ambiente
- ✅ Funciona em qualquer ambiente
- ✅ Fácil de atualizar

## 📝 Checklist

- [ ] URL da API do Railway obtida
- [ ] Meta tag configurada no `index.html` OU variável `API_URL` no Vercel
- [ ] Commit e push realizado
- [ ] Deploy no Vercel concluído
- [ ] Teste de conexão com API funcionando

## 🔍 Como o Código Detecta a URL da API

O código em `src/dashboard/public/app/api.js` tenta detectar a URL nesta ordem:

1. **Variável de ambiente** (`window.ENV.API_URL` ou `process.env.API_URL`)
2. **Meta tag** (`<meta name="api-url" content="...">`)
3. **Script tag** (`<script id="api-config">`)
4. **Detecção automática** (baseada no hostname)

Se nenhuma for encontrada, usa `/api` (proxy local para desenvolvimento).

## ⚠️ Importante

- O Vercel **não precisa** de variáveis de ambiente para funcionar
- A URL da API pode ser configurada diretamente no HTML
- Variáveis de ambiente são apenas uma opção adicional
- O código já tem fallback automático

## 🚀 Próximos Passos

1. Configure a URL da API via meta tag no HTML (mais simples)
2. Faça commit e push
3. O Vercel fará deploy automaticamente
4. Teste o acesso ao dashboard
