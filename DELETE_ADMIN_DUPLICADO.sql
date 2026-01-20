-- Script para deletar usuário admin com duplo hash
-- Execute este script no PostgreSQL do Railway antes de fazer novo deploy

-- 1. Verificar se o usuário existe
SELECT id, email, name, role, active, "createdAt"
FROM "Users"
WHERE email = 'admin@admin.com';

-- 2. Deletar o usuário (se existir)
DELETE FROM "Users" WHERE email = 'admin@admin.com';

-- 3. Verificar se foi deletado
SELECT id, email, name, role, active, "createdAt"
FROM "Users"
WHERE email = 'admin@admin.com';

-- Resultado esperado: nenhuma linha retornada

-- Após executar este script:
-- 1. Faça commit e push do código corrigido
-- 2. O Railway vai fazer redeploy
-- 3. O sistema vai criar o usuário admin com hash correto
-- 4. Teste o login com admin@admin.com / admin123
