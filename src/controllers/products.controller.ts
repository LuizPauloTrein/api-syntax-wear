import { FastifyReply, FastifyRequest } from "fastify";
import { CreateProduct, ProductFilters } from "../types";
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from "../services/products.service";
import { createProductSchema, deleteProductSchema, productFiltersSchema, updateProductSchema } from "../utils/validators";
import { generateSlug } from "../utils/slug";

export const listProducts = async (request: FastifyRequest<{ Querystring: ProductFilters }>, reply: FastifyReply) => {
	const filters = productFiltersSchema.parse(request.query);
	const result = await getProducts(filters as ProductFilters);
	reply.status(200).send(result);
};

export const getProduct = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
	const product = await getProductById(request.params.id);
	reply.status(200).send(product);
};

export const createNewProduct = async (request: FastifyRequest<{ Body: CreateProduct }>, reply: FastifyReply) => {
	const body = request.body;

	body.slug = generateSlug(body.name);

	const validate = createProductSchema.parse(body);
	await createProduct(validate);

	reply.status(201).send({ message: "Produto criado com sucesso" });
};

export const updateExistingProduct = async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateProduct> }>, reply: FastifyReply) => {
	const { id } = request.params;
	const body = request.body;

	const validate = updateProductSchema.parse(body);

	if (validate.name) {
		validate.slug = generateSlug(validate.name);
	}

	const product = await updateProduct(Number(id), validate);
	reply.status(200).send(product);
};

export const deleteExistingProduct = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
	const { id } = request.params;

	const validate = deleteProductSchema.parse({ id: Number(id) });

	await deleteProduct(validate.id);

	reply.status(204).send();
};
