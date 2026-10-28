import { FastifyInstance } from "fastify";
import etag from "@fastify/etag";

// Cache de catálogo público: o navegador/CDN reutiliza a resposta por 60 s e
// revalida por ETag (304 sem corpo) depois disso. Só respostas 2xx são cacheadas.
export const CATALOG_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=30";

export const registerPublicCache = async (fastify: FastifyInstance) => {
  await fastify.register(etag);

  fastify.addHook("onSend", async (_request, reply) => {
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      reply.header("Cache-Control", CATALOG_CACHE_CONTROL);
    }
  });
};
