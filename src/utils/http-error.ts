// Erro de negócio com status HTTP. Os services lançam HttpError e o
// errorHandler (middlewares/error.middleware.ts) responde com o status e a
// mensagem, sem virar 500.
export class HttpError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string
	) {
		super(message);
		this.name = "HttpError";
	}
}
