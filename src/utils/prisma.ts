import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  max: env.db.poolMax,
  idleTimeoutMillis: env.db.idleTimeoutMs,
  connectionTimeoutMillis: env.db.connectionTimeoutMs,
  ...(env.db.statementTimeoutMs > 0
    ? { statement_timeout: env.db.statementTimeoutMs }
    : {}),
});

const client = new PrismaClient({ adapter });

// Registra consultas lentas (só modelo, operação e duração: nunca os dados).
export const prisma = client.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const startedAt = performance.now();

      try {
        return await query(args);
      } finally {
        const durationMs = Math.round(performance.now() - startedAt);

        if (env.db.slowQueryMs > 0 && durationMs >= env.db.slowQueryMs) {
          console.warn(
            JSON.stringify({
              level: "warn",
              msg: "consulta lenta",
              model: model ?? null,
              operation,
              durationMs,
            }),
          );
        }
      }
    },
  },
});
