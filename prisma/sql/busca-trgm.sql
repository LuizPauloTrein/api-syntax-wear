-- Busca por texto (ILIKE '%termo%') com índice trigram (passo 17 do plano).
--
-- Como aplicar (o Prisma não declara índices GIN no schema):
--   1. npx prisma migrate dev --create-only --name indices_de_performance
--      (gera a migration com os índices do schema.prisma, sem aplicar)
--   2. cole o conteúdo DESTE arquivo no fim do migration.sql gerado
--   3. npx prisma migrate dev
--
-- Antes e depois, meça no SQL Editor do Supabase:
--   EXPLAIN ANALYZE SELECT * FROM "Product"
--   WHERE active AND (name ILIKE '%camiseta%' OR description ILIKE '%camiseta%');
-- Com poucas linhas o Postgres ainda pode preferir varredura sequencial; o
-- índice passa a valer quando o catálogo cresce.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING gin ("description" gin_trgm_ops);
