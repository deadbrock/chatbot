# 🔍 Debug de Login no Railway

## Alterações Feitas

### 1. **Login.js - Logs Detalhados**
Adicionados logs extensivos para capturar:
- Status da resposta HTTP
- Headers da resposta
- Corpo da resposta (texto bruto)
- Tentativa de parse JSON
- Mensagens de erro específicas

### 2. **usersController.js - Logs de Login**
Adicionados logs para rastrear:
- Tentativa de login (email, IP, origin)
- Validação de campos
- Usuário encontrado/não encontrado
- Senha correta/incorreta
- Token gerado
- Erros de processamento

### 3. **server.js - Error Handler Melhorado**
- Logs detalhados de erro incluindo URL, método, body e headers
- Sempre retorna JSON (não HTML) mesmo em caso de erro

## Como Debugar

### Passo 1: Verificar Logs no Railway

1. Acesse o Railway
2. Vá para o projeto "AstroChat"
3. Aba "Deployments" → deployment mais recente
4. Aba "Logs"
5. Faça o deploy das alterações
6. Tente fazer login no Vercel
7. Observe os logs em tempo real

### O que procurar nos logs:

#### Se aparecer:
```
📝 Tentativa de login: { body: { email: 'xxx', password: 'xxx' }, ip: '...', origin: '...' }
```
✅ O backend está recebendo a requisição corretamente.

#### Se NÃO aparecer nada:
❌ A requisição não está chegando ao backend. Possíveis causas:
- CORS bloqueando
- URL da API incorreta
- Rota não encontrada

#### Se aparecer:
```
⚠️ Login rejeitado: usuário não encontrado - email@exemplo.com
```
❌ Usuário não existe no banco PostgreSQL. Você precisa criar o usuário admin.

#### Se aparecer:
```
❌ Erro ao processar login: { message: '...', stack: '...' }
```
❌ Erro no código do backend (SQL, conexão, etc.)

### Passo 2: Verificar Console do Navegador

Ao tentar fazer login, o console deve mostrar:

```
🔍 Tentando fazer login em: https://web-production-ea053.up.railway.app/api/users/login
📊 Resposta recebida:
   - Status: XXX
   - Status Text: XXX
   - Content-Type: XXX
   - Todas as Headers: ...
   - Corpo da resposta: ...
```

#### Interpretação:

**Status 200**:
✅ Sucesso! Se ainda dá erro de JSON, o problema é no formato da resposta.

**Status 401**:
❌ Credenciais inválidas ou usuário não existe.

**Status 404**:
❌ Rota não encontrada. Verifique se a URL está correta.

**Status 405**:
❌ Método não permitido. Problema de CORS ou rota.

**Status 500**:
❌ Erro interno no backend. Verifique logs do Railway.

**Corpo vazio**:
❌ Backend não retornou nada. Crashou ou não processou a rota.

**Corpo é HTML**:
❌ Pode ser erro 404/500 do Nginx ou Railway proxy.

## Passo 3: Criar Usuário Admin (se necessário)

Se o usuário admin não existir no PostgreSQL:

### Opção 1: Via Script de Inicialização

O sistema deveria criar automaticamente na primeira inicialização.

Verifique nos logs do Railway se aparece:
```
✅ Configurações de administração inicializadas
```

Se NÃO aparecer, pode ser que o script não rodou.

### Opção 2: Via SQL Manual

Conecte-se ao PostgreSQL do Railway e execute:

```sql
INSERT INTO "Users" (
  id, 
  name, 
  email, 
  password, 
  role, 
  active, 
  "createdAt", 
  "updatedAt"
) VALUES (
  1,
  'Administrador',
  'admin@admin.com',
  '$2a$10$YourHashedPasswordHere', -- Use bcrypt para gerar
  'admin',
  true,
  NOW(),
  NOW()
);
```

### Opção 3: Verificar se Usuário Existe

```sql
SELECT id, name, email, role, active FROM "Users" WHERE email = 'admin@admin.com';
```

## Checklist de Debug

- [ ] Commit e push das alterações
- [ ] Aguardar redeploy do Railway
- [ ] Tentar fazer login
- [ ] Observar logs do Railway em tempo real
- [ ] Observar console do navegador (F12)
- [ ] Copiar e colar os logs aqui para análise
- [ ] Verificar se usuário admin existe no banco
- [ ] Verificar se ALLOWED_ORIGINS está correto
- [ ] Verificar se NODE_ENV=production

## Próximos Passos

Após fazer deploy e tentar login:

1. Copie TODOS os logs do console do navegador
2. Copie os logs relevantes do Railway (especialmente erros)
3. Me envie para análise detalhada

Isso vai nos dar informações suficientes para identificar o problema exato.
