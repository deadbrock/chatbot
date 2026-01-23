-- Script para corrigir a tabela ai_configs
-- O campo updatedBy foi criado como UUID, mas User.id é INTEGER
-- Precisamos dropar e recriar a tabela

-- 1. Dropar a tabela existente (se houver)
DROP TABLE IF EXISTS "ai_configs" CASCADE;

-- 2. O Sequelize irá recriar automaticamente no próximo sync com o tipo correto (INTEGER)

-- Para executar este script no Railway:
-- 1. Acesse o Railway Dashboard
-- 2. Vá em PostgreSQL > Data
-- 3. Cole este comando e execute:
-- DROP TABLE IF EXISTS "ai_configs" CASCADE;

-- Ou use a conexão PostgreSQL direta:
-- psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"ai_configs\" CASCADE;"
