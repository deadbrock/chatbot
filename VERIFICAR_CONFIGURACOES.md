# 🔍 Verificação de Configurações

## ✅ Variáveis Railway (corretas):
- ✅ `ALLOWED_ORIGINS`: https://chatbot-three-bay.vercel.app
- ✅ `DATABASE_URL`: postgresql://...
- ✅ `JWT_SECRET`: configurado
- ✅ `NODE_ENV`: production

## ✅ Variáveis Vercel (corretas):
- ✅ `API_URL`: https://web-production-ea053.up.railway.app

---

## ⚠️ IMPORTANTE: Qual é a URL do seu frontend no Vercel?

Vejo duas URLs diferentes:
1. **Railway ALLOWED_ORIGINS**: `https://chatbot-three-bay.vercel.app`
2. **Vercel API_URL**: `https://web-production-ea053.up.railway.app` (backend)

**Preciso confirmar:** Qual é a URL do seu projeto Vercel onde o frontend está hospedado?

---

## 🔍 Passos para Verificar

### 1. Confirme a URL do Vercel Frontend

No Vercel, vá em **"Deployments"** e veja qual é a URL do seu projeto.

Exemplos possíveis:
- `https://chatbot-three-bay.vercel.app` ✅
- `https://astrochat-rho.vercel.app` ✅
- Outra URL...

### 2. Verifique os Logs do Railway

**MUITO IMPORTANTE:** Após deletar o usuário e reiniciar, os logs devem mostrar:

```
✅ Banco de dados conectado com sucesso
✅ Sincronização do banco de dados concluída
🔄 Criando usuário admin padrão...
✅ Usuário admin criado com sucesso!
   📧 Email: admin@admin.com
   🔑 Senha: admin123
```

**Se NÃO aparecer "Criando usuário admin padrão", significa que:**
- O sistema detectou que o usuário já existe (não foi deletado corretamente)
- Ou o código antigo ainda está rodando

---

## 🎯 Ação Necessária

Por favor, me envie:

1. **Screenshot dos logs do Railway** após o restart (últimas 50 linhas)
   - Procure por "Criando usuário admin" ou "Usuário admin já existe"

2. **Confirme a URL do Vercel** onde o frontend está hospedado
   - Não é a URL do Railway (backend)
   - É a URL onde você acessa o login (vercel.app)

3. **Teste este comando SQL no Railway PostgreSQL:**

```sql
-- Verificar se o usuário existe e quando foi criado
SELECT 
  id, 
  email, 
  name, 
  role, 
  active,
  "createdAt",
  LENGTH(password) as password_length
FROM "Users" 
WHERE email = 'admin@admin.com';
```

**O que esperar:**
- `password_length` deve ser **60** (hash bcrypt padrão)
- Se for diferente de 60, a senha tem duplo hash

---

## 🔧 Se o usuário NÃO foi recriado

Execute este SQL no Railway PostgreSQL:

```sql
-- Deletar TODOS os usuários admin (se houver duplicados)
DELETE FROM "Users" WHERE email = 'admin@admin.com';

-- Verificar se foi deletado
SELECT COUNT(*) FROM "Users" WHERE email = 'admin@admin.com';
-- Deve retornar: 0
```

Depois, no Railway:
1. Vá em **Deployments**
2. Clique em **"⋮"** (três pontos)
3. Selecione **"Redeploy"** (não apenas Restart)

O **Redeploy** vai recarregar todo o código e executar o `initializeAdminDefaults()` novamente.

---

## 🧪 Teste Alternativo

Enquanto investiga, você pode criar o usuário manualmente via SQL:

```sql
-- ATENÇÃO: Use este comando APENAS se o usuário foi deletado
-- A senha já está com hash correto (bcrypt de 'admin123')

INSERT INTO "Users" (
  name, 
  email, 
  password, 
  role, 
  department, 
  active,
  "createdAt",
  "updatedAt"
) VALUES (
  'Administrador',
  'admin@admin.com',
  '$2a$10$YourHashHere', -- Não use isso, deixe o sistema criar
  'admin',
  'TI',
  true,
  NOW(),
  NOW()
);
```

**MAS ATENÇÃO:** Não recomendo criar manualmente porque pode dar duplo hash novamente.

**MELHOR:** Deixe o sistema criar automaticamente após Redeploy.
