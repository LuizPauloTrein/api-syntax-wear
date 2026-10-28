export type Page<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const buildPage = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): Page<T> => ({
  data,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

// Schema JSON do envelope, para as respostas das rotas de listagem.
export const pageResponseSchema = (itemSchema: object) => ({
  type: "object",
  properties: {
    data: { type: "array", items: itemSchema },
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
  },
});
