import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations usam a conexão DIRETA (porta 5432); a API usa o pooler via
    // DATABASE_URL. Sem DIRECT_URL, cai em DATABASE_URL.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
