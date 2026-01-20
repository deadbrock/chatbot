# 🔐 Criar Usuário Admin no PostgreSQL

## Problema Identificado

O usuário admin não existe no banco de dados PostgreSQL do Railway.

**Resposta do backend:**
```json
{"success":false,"message":"Credenciais inválidas"}
```

## Solução 1: Executar Script Localmente

### Passo 1: Configurar variáveis de ambiente localmente

Crie um arquivo `.env` local com a URL do PostgreSQL do Railway:

```env
DATABASE_URL=postgresql://postgres:CgmJkpZqPeeodbjXszKCrzuENfGNgHu@tramway.proxy.rlwy.net:26754/railway
NODE_ENV=production
```

### Passo 2: Executar o script

```bash
node scripts/create-admin-user.js
```

O script vai:
- Conectar ao PostgreSQL do Railway
- Verificar se o admin já existe
- Criar o usuário admin com:
  - Email: `admin@admin.com`
  - Senha: `admin123`
  - Role: `admin`

## Solução 2: Via Railway CLI

### Passo 1: Instalar Railway CLI

```bash
npm install -g @railway/cli
```

### Passo 2: Fazer login

```bash
railway login
```

### Passo 3: Conectar ao projeto

```bash
railway link
```

Selecione o projeto "AstroChat"

### Passo 4: Executar o script no Railway

```bash
railway run node scripts/create-admin-user.js
```

## Solução 3: Adicionar ao Railway como Run Command

### Opção A: Criar comando personalizado

1. Acesse o Railway
2. Vá para o serviço "AstroChat"
3. Aba "Settings"
4. Em "Deploy", adicione em "Custom Start Command":

```bash
node scripts/create-admin-user.js && node src/server.js
```

**ATENÇÃO:** Isso vai executar toda vez que o servidor reiniciar. Pode causar conflito se o admin já existir.

### Opção B: Criar serviço separado para seed

Melhor abordagem: criar um serviço separado no Railway só para rodar seeds uma vez.

## Solução 4: Verificar se já foi criado

### Verificar logs do Railway

Procure nos logs do Railway por:

```
✅ Usuário admin criado com sucesso
```

ou

```
⚠️ Usuário admin já existe
```

Se aparecer, significa que o usuário foi criado, mas pode ter senha diferente.

## Credenciais Padrão

Após criar o usuário admin:

```
Email: admin@admin.com
Senha: admin123
```

## Testando

1. Acesse o login do Vercel
2. Use as credenciais acima
3. Deve funcionar!

## Próximos Passos

Após conseguir fazer login:

1. ✅ Altere a senha do admin
2. ✅ Crie outros usuários conforme necessário
3. ✅ Configure as permissões

## Troubleshooting

### "Error: connect ECONNREFUSED"

O banco de dados PostgreSQL não está acessível. Verifique:
- Se a URL do PostgreSQL está correta
- Se o PostgreSQL está rodando no Railway
- Se há firewall bloqueando

### "Error: relation 'Users' does not exist"

As tabelas não foram criadas. Execute:

```bash
railway run npx sequelize-cli db:migrate
```

ou o script fará automaticamente ao executar `sequelize.sync()`.

### "Usuário admin já existe"

Ótimo! Isso significa que o usuário foi criado. Tente:
- Email: `admin@admin.com`
- Senha: `admin123`

Se não funcionar, execute o script e escolha resetar a senha.
