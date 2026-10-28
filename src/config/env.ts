import "dotenv/config";
import z from "zod";

// Interpreta "true"/"false"/"1"/"0" (z.coerce.boolean trataria "false" como true).
const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  // Um segredo fraco permite forjar tokens (inclusive de ADMIN). Gere com:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
  // Aceita "15m", "1h", "7d" etc.
  JWT_EXPIRES_IN: z.string().min(1).default("1h"),
  // Origens do front separadas por vírgula. Vazio: só o front local fora de produção.
  CORS_ORIGINS: z.string().default(""),
  // Atrás de proxy/load balancer (Render, Railway, Nginx...) use "true" ou o
  // número de proxies, senão o rate limit enxerga o IP do proxy.
  TRUST_PROXY: z.string().default("false"),
  // /api-docs: ligado fora de produção; em produção só com ENABLE_DOCS=true.
  ENABLE_DOCS: booleanFromString.optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Configuração de ambiente inválida:\n${problems}`);
}

const data = parsed.data;
const isProduction = data.NODE_ENV === "production";

const parseTrustProxy = (value: string): boolean | number => {
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return false;
};

const corsOrigins = data.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  nodeEnv: data.NODE_ENV,
  isProduction,
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  jwtSecret: data.JWT_SECRET,
  jwtExpiresIn: data.JWT_EXPIRES_IN,
  corsOrigins:
    corsOrigins.length > 0
      ? corsOrigins
      : isProduction
        ? []
        : ["http://localhost:5173", "http://localhost:3000"],
  trustProxy: parseTrustProxy(data.TRUST_PROXY),
  docsEnabled: data.ENABLE_DOCS ?? !isProduction,
  logLevel: data.LOG_LEVEL,
};
