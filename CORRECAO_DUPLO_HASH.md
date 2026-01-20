# 🔧 Correção: Duplo Hash de Senha

## Problema Identificado

O login estava retornando 401 (Credenciais inválidas) mesmo após criar o usuário admin. A causa era **duplo hash de senha**.

### O que estava acontecendo:

1. **Em `initializeAdmin.js`:**
   ```javascript
   const hashedPassword = await bcrypt.hash('admin123', 10);
   await User.create({ password: hashedPassword, ... });
   ```

2. **No modelo `UserSQL.js` (hook beforeCreate):**
   ```javascript
   User.beforeCreate(async (user) => {
     if (user.password) {
       const salt = await bcrypt.genSalt(10);
       user.password = await bcrypt.hash(user.password, salt); // Hash novamente!
     }
   });
   ```

3. **Resultado:**
   - Senha armazenada: `hash(hash('admin123'))`
   - Login tentado: `hash('admin123')`
   - Comparação: `hash('admin123')` vs `hash(hash('admin123'))` = ❌ NÃO BATE

## Solução Aplicada

Removido o hash manual e deixado o hook do modelo fazer o trabalho:

```javascript
// ANTES (ERRADO - duplo hash):
const hashedPassword = await bcrypt.hash('admin123', 10);
await User.create({
  password: hashedPassword,
  ...
});

// DEPOIS (CORRETO - hash único):
await User.create({
  password: 'admin123', // Texto plano - o hook faz hash automaticamente
  ...
});
```

### Arquivos corrigidos:
- ✅ `src/setup/initializeAdmin.js`
- ✅ `scripts/create-admin-user.js`

## Próximos Passos

### 1. Fazer commit e push:

```bash
git add src/setup/initializeAdmin.js scripts/create-admin-user.js
git commit -m "fix: corrigir duplo hash de senha do usuário admin"
git push
```

### 2. Limpar o banco de dados

O usuário admin atual tem senha com duplo hash. Você tem duas opções:

#### Opção A: Aguardar novo deploy (recomendado)

O Railway vai fazer redeploy e vai tentar criar o usuário novamente. Como já existe, não vai criar duplicado, mas você pode deletar o usuário atual primeiro.

#### Opção B: Deletar usuário atual e recriar

Conecte ao PostgreSQL do Railway e execute:

```sql
DELETE FROM "Users" WHERE email = 'admin@admin.com';
```

Depois, reinicie o servidor no Railway ou execute:

```bash
railway run node scripts/create-admin-user.js
```

### 3. Testar login

Após o redeploy e recriação do usuário:

1. Acesse o login no Vercel
2. Use:
   - **Email:** `admin@admin.com`
   - **Senha:** `admin123`
3. Deve funcionar! ✅

## Verificação

### Console do navegador:

```
🔍 Tentando fazer login em: https://web-production-ea053.up.railway.app/api/users/login
📊 Resposta recebida:
   - Status: 200 ✅
✅ JSON parseado com sucesso: {success: true, data: {token: '...', user: {...}}}
```

### Logs do Railway:

```
2026-01-20 XX:XX:XX [INFO]: 📝 Tentativa de login: { body: { email: 'admin@admin.com', ... }
2026-01-20 XX:XX:XX [INFO]: ✅ Login bem-sucedido: admin@admin.com (admin)
```

## Lição Aprendida

Quando usar modelos Sequelize com hooks `beforeCreate` ou `beforeUpdate` para hash de senha:

❌ **NÃO faça:**
```javascript
const hash = await bcrypt.hash(password, 10);
await User.create({ password: hash });
```

✅ **Faça:**
```javascript
await User.create({ password: 'senha_texto_plano' });
// O hook faz o hash automaticamente
```

## Troubleshooting

### Se ainda não funcionar após deploy:

1. Verifique os logs do Railway para confirmar que o usuário foi recriado
2. Conecte ao PostgreSQL e verifique se há usuário duplicado:
   ```sql
   SELECT id, email, name, role FROM "Users" WHERE email = 'admin@admin.com';
   ```
3. Se houver duplicados, delete todos e deixe o sistema recriar:
   ```sql
   DELETE FROM "Users" WHERE email = 'admin@admin.com';
   ```
4. Reinicie o servidor no Railway
