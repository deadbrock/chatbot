# 🔧 Como Deletar e Recriar o Usuário Admin

## ✅ Status: Código corrigido e em produção

O código já foi corrigido e está no Railway! Agora só falta deletar o usuário com duplo hash e deixar o sistema recriar.

## 🎯 Solução Mais Rápida (Recomendada)

### Opção 1: Forçar Recriação via Railway CLI

Se você tem o Railway CLI instalado:

```bash
# Conectar ao banco PostgreSQL do Railway
railway connect PostgreSQL

# Deletar o usuário
DELETE FROM "Users" WHERE email = 'admin@admin.com';

# Sair
\q

# Reiniciar o serviço
railway restart
```

---

### Opção 2: Via Dashboard do Railway (Mais Fácil)

#### Passo 1: Acessar o PostgreSQL no Railway

1. Entre no [Railway Dashboard](https://railway.app)
2. Selecione seu projeto
3. Clique no serviço **PostgreSQL**
4. Vá para a aba **"Data"** ou **"Query"**

#### Passo 2: Executar SQL para Deletar

Cole e execute este comando:

```sql
DELETE FROM "Users" WHERE email = 'admin@admin.com';
```

#### Passo 3: Reiniciar o Backend

1. Volte para o serviço do **Backend** (Node.js)
2. Clique em **"Deployments"**
3. No canto superior direito, clique **"⋮"** (três pontos)
4. Selecione **"Restart"**

#### Passo 4: Aguardar Logs

Aguarde os logs mostrarem:

```
🔄 Criando usuário admin padrão...
✅ Usuário admin criado com sucesso!
   📧 Email: admin@admin.com
   🔑 Senha: admin123
```

---

### Opção 3: Via Script Node (Se tiver acesso SSH)

Se você consegue executar comandos no Railway:

```bash
# No Railway, execute:
railway run node scripts/create-admin-user.js
```

O script vai:
1. Verificar se existe usuário
2. Perguntar se quer deletar
3. Recriar com senha correta

---

## 🧪 Testar Login

Após deletar e recriar:

1. Acesse: https://astrochat-rho.vercel.app/login.html
2. Use:
   - **Email:** `admin@admin.com`
   - **Senha:** `admin123`
3. Deve funcionar! ✅

---

## 📊 Como Confirmar que Funcionou

### Console do Navegador (deve mostrar):
```
🔍 Tentando fazer login em: https://web-production-ea053.up.railway.app/api/users/login
📊 Resposta recebida:
   - Status: 200 ✅
✅ JSON parseado com sucesso: {success: true, data: {token: '...', user: {...}}}
```

### Logs do Railway (deve mostrar):
```
2026-01-22 XX:XX:XX [INFO]: 📝 Tentativa de login: { body: { email: 'admin@admin.com', ... }
2026-01-22 XX:XX:XX [INFO]: ✅ Usuário encontrado: admin@admin.com
2026-01-22 XX:XX:XX [INFO]: ✅ Senha válida
2026-01-22 XX:XX:XX [INFO]: ✅ Login bem-sucedido: admin@admin.com (admin)
```

---

## ❓ Troubleshooting

### Se ainda retornar 401:

1. **Verifique se o usuário foi deletado:**
   ```sql
   SELECT id, email, "createdAt" FROM "Users" WHERE email = 'admin@admin.com';
   ```
   - Se retornar resultado, delete novamente

2. **Verifique se o servidor reiniciou:**
   - Veja os logs no Railway
   - Deve mostrar "Usuário admin criado com sucesso!"

3. **Limpe o cache do navegador:**
   ```
   Ctrl + Shift + Delete
   Limpar cookies e cache
   ```

4. **Tente em uma janela anônima:**
   - Ctrl + Shift + N (Chrome)
   - Teste o login novamente

---

## 🎯 Resumo Executivo

| Item | Status |
|------|--------|
| Código corrigido | ✅ Completo |
| Push para GitHub | ✅ Completo |
| Deploy no Railway | ✅ Automático |
| Deletar usuário antigo | ⏳ **VOCÊ PRECISA FAZER** |
| Reiniciar servidor | ⏳ **VOCÊ PRECISA FAZER** |
| Testar login | ⏳ Aguardando |

---

## 📞 Suporte

Se ainda tiver problemas, verifique:

1. **URL da API está correta?**
   - Deve ser: `https://web-production-ea053.up.railway.app`

2. **ALLOWED_ORIGINS está correto?**
   - Deve incluir: `https://astrochat-rho.vercel.app`

3. **Banco de dados está conectado?**
   - Logs devem mostrar: "✅ Banco de dados conectado com sucesso"

4. **Variáveis de ambiente estão configuradas?**
   - `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`
