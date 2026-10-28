-- Papel de banco dedicado para a API (passo 18 do plano): só lê e escreve
-- dados, sem permissão de DDL (criar/alterar/apagar tabelas). As migrations
-- continuam usando o usuário admin (DIRECT_URL).
--
-- ATENÇÃO: as tabelas têm RLS ligado (prisma/sql/enable-rls.sql) e este papel
-- NÃO ignora RLS. Teste primeiro em um ambiente de homologação. Se a API
-- passar a receber listas vazias, o papel precisa de BYPASSRLS (se o Supabase
-- permitir no seu projeto) ou de policies para ele.
--
-- Troque a senha antes de rodar e use a URL deste usuário em DATABASE_URL.

CREATE ROLE api_runtime LOGIN PASSWORD 'TROQUE-ESTA-SENHA' NOINHERIT;

GRANT USAGE ON SCHEMA public TO api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_runtime;

-- Tabelas criadas por migrations futuras herdam as mesmas permissões.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO api_runtime;

-- A API nunca precisa mexer no histórico de migrations.
REVOKE ALL ON "_prisma_migrations" FROM api_runtime;
