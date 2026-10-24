-- ============================================================================
-- Ativa o Row Level Security (RLS) nas tabelas da API no Supabase.
--
-- NÃO é uma migration do Prisma: rode manualmente no SQL Editor do Supabase
-- (ou via psql), de preferência primeiro em um projeto/banco de teste.
--
-- Por quê: tabelas criadas pelo Prisma nascem SEM RLS. Se o schema "public"
-- estiver exposto na Data API do Supabase, quem tiver a anon key (pública no
-- front) consegue ler/escrever essas tabelas direto, sem passar pela API —
-- inclusive "User" com os hashes de senha.
--
-- Efeito: com RLS ligado e nenhuma policy, os papéis "anon" e "authenticated"
-- perdem o acesso. A API continua funcionando SE o papel do DATABASE_URL
-- ignorar o RLS (ver passo 1 abaixo).
-- ============================================================================

-- PASSO 1 · Confira o papel que a API usa (o usuário do DATABASE_URL).
--   Rode a consulta conectado com o mesmo DATABASE_URL da API:
--
--     select current_user, rolbypassrls from pg_roles where rolname = current_user;
--
--   rolbypassrls = true  → pode seguir (o papel "postgres" do Supabase tem isso).
--   rolbypassrls = false → NÃO rode o PASSO 3 ainda: a API deixaria de ler e
--                          escrever. Use o papel postgres ou crie um papel
--                          dedicado com BYPASSRLS antes.

-- PASSO 2 · Veja o estado atual (rowsecurity = false significa tabela exposta).
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- PASSO 3 · Ligue o RLS em todas as tabelas (sem policies = acesso negado
--           para anon/authenticated).
alter table "User"                enable row level security;
alter table "Product"             enable row level security;
alter table "Category"            enable row level security;
alter table "Order"               enable row level security;
alter table "OrderItem"           enable row level security;
alter table "_prisma_migrations"  enable row level security;

-- PASSO 4 · Refaça a consulta do PASSO 2: todas devem mostrar rowsecurity = true.
--
-- TESTE DE FORA: chame a Data API com a anon key, por exemplo
--   curl "https://<projeto>.supabase.co/rest/v1/User?select=email" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
-- e confirme que NÃO devolve linhas (lista vazia ou erro de permissão).
--
-- NOVAS TABELAS: repita o "enable row level security" para cada tabela criada
-- por migrations futuras.
