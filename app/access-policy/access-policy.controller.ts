import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { buildErrorResponse, formatZodErrors } from "../../helper/error-handler";
import { buildPagination, buildSuccessResponse } from "../../helper/success-handler";
import { validateQueryParams } from "../../helper/validation-helper";
import { buildFindManyQuery, getNestedFields } from "../../helper/query-builder";
import { AccessPolicySchema } from "../../zod/access-policy.zod";
import { ObjectIdSchema } from "../../zod/object-id.zod";

const logger = getLogger();
const accessPolicyLogger = logger.child({ module: "person" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		const idValidation = ObjectIdSchema.safeParse(req.params.id);

		if (!idValidation.success) {
			accessPolicyLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
			const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
			res.status(400).json(errorResponse);
			return;
		}

		if (fields && typeof fields !== "string") {
			accessPolicyLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
				400,
			);
			res.status(400).json(errorResponse);
			return;
		}
		try {
			accessPolicyLogger.info(`${config.SUCCESS.ACCESS_POLICY.GETTING_BY_ID}: ${id}`);

			const query: Prisma.AccessPolicyFindFirstArgs = {
				where: { id, isDeleted: false },
			};

			query.select = getNestedFields(fields);

			const accessPolicy = await prisma.accessPolicy.findFirst(query);

			if (!accessPolicy) {
				accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ACCESS_POLICY.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			accessPolicyLogger.info(
				`${config.SUCCESS.ACCESS_POLICY.RETRIEVED}: ${accessPolicy.id}`,
			);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ACCESS_POLICY.RETRIEVED,
				{ accessPolicy },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.ERROR_GETTING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.COMMON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, accessPolicyLogger);

		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { page, limit, order, fields, sort, skip, query, document, pagination, count } =
			validationResult.validatedParams!;

		accessPolicyLogger.info(
			`${config.SUCCESS.ACCESS_POLICY.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.AccessPolicyWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ name: { contains: String(query), mode: "insensitive" } },
								{ description: { contains: String(query), mode: "insensitive" } },
							],
						}
					: {}),
			};

			const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields);

			const [accessPolicies, total] = await Promise.all([
				document ? prisma.accessPolicy.findMany(findManyQuery) : [],
				count ? prisma.accessPolicy.count({ where: whereClause }) : 0,
			]);

			accessPolicyLogger.info(`Retrieved ${accessPolicies.length} access policies`);
			const responseData = {
				...(document && { accessPolicies }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.ACCESS_POLICY.RETRIEVED, responseData, 200),
			);
		} catch (error) {
			accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.ERROR_GETTING}: ${error}`);
			res.status(500).json(
				buildErrorResponse(config.ERROR.COMMON.INTERNAL_SERVER_ERROR, 500),
			);
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = AccessPolicySchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				accessPolicyLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if access policy already exists
			const existingPolicy = await prisma.accessPolicy.findFirst({
				where: {
					name: validatedData.name,
				},
			});

			if (existingPolicy) {
				accessPolicyLogger.info(
					`${config.SUCCESS.ACCESS_POLICY.RETRIEVED}: ${existingPolicy.id}`,
				);
				const successResponse = buildSuccessResponse(
					"Existing access policy found",
					{ accessPolicy: existingPolicy },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newAccessPolicy = await prisma.accessPolicy.create({
				data: {
					...validatedData,
				},
			});

			accessPolicyLogger.info(
				`${config.SUCCESS.ACCESS_POLICY.CREATED}: ${newAccessPolicy.id}`,
			);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ACCESS_POLICY.CREATED,
				{ accessPolicy: newAccessPolicy },
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			accessPolicyLogger.error(`${config.ERROR.COMMON.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.COMMON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			const idValidation = ObjectIdSchema.safeParse(req.params.id);

			if (!idValidation.success) {
				accessPolicyLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = AccessPolicySchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				accessPolicyLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				accessPolicyLogger.error(config.ERROR.COMMON.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(config.ERROR.COMMON.NO_UPDATE_FIELDS, 400);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			accessPolicyLogger.info(`Updating access policy: ${id}`);

			const existingPolicy = await prisma.accessPolicy.findFirst({
				where: { id, isDeleted: false },
			});

			if (!existingPolicy) {
				accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ACCESS_POLICY.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedPolicy = await prisma.accessPolicy.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			accessPolicyLogger.info(`${config.SUCCESS.ACCESS_POLICY.UPDATED}: ${updatedPolicy.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ACCESS_POLICY.UPDATED,
				{ accessPolicy: updatedPolicy },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.ERROR_UPDATING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.COMMON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			const idValidation = ObjectIdSchema.safeParse(req.params.id);

			if (!idValidation.success) {
				accessPolicyLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}
			accessPolicyLogger.info(`${config.SUCCESS.ACCESS_POLICY.DELETED}: ${id}`);

			const existingPolicy = await prisma.accessPolicy.findFirst({
				where: { id, isDeleted: false },
			});

			if (!existingPolicy) {
				accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ACCESS_POLICY.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.accessPolicy.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			accessPolicyLogger.info(`${config.SUCCESS.ACCESS_POLICY.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ACCESS_POLICY.DELETED,
				{},
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			accessPolicyLogger.error(`${config.ERROR.ACCESS_POLICY.DELETED}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.COMMON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
	};
};
