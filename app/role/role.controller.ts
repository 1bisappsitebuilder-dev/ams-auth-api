import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { buildErrorResponse, formatZodErrors } from "../../helper/error-handler";
import {
	buildFilterConditions,
	buildFindManyQuery,
	getNestedFields,
} from "../../helper/query-builder";
import { buildPagination, buildSuccessResponse } from "../../helper/success-handler";
import { validateQueryParams } from "../../helper/validation-helper";
import { RoleSchema } from "../../zod/role.zod";

const logger = getLogger();
const roleLogger = logger.child({ module: "role" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		try {
			if (!id) {
				roleLogger.error(config.ERROR.ROLE.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.ROLE_ID_REQUIRED, 400);
				res.status(400).json(errorResponse);
				return;
			}

			if (fields && typeof fields !== "string") {
				roleLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
				const errorResponse = buildErrorResponse(
					config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			roleLogger.info(`${config.SUCCESS.ROLE.GETTING_BY_ID}: ${id}`);

			const query: Prisma.RoleFindFirstArgs = {
				where: {
					id,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			};

			query.select = getNestedFields(fields);

			const role = await prisma.role.findFirst(query);

			if (!role) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			roleLogger.info(`${config.SUCCESS.ROLE.RETRIEVED}: ${role.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ROLE.RETRIEVED,
				{ role },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_GETTING}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.ROLE.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, roleLogger);

		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page,
			limit,
			order,
			fields,
			sort,
			skip,
			query,
			filter,
			document,
			pagination,
			count,
		} = validationResult.validatedParams!;

		roleLogger.info(
			`${config.SUCCESS.ROLE.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.RoleWhereInput = {
				OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				...(query
					? {
							OR: [
								{ name: { contains: String(query) } },
								{ description: { contains: String(query) } },
							],
						}
					: {}),
			};

			// Add filter conditions using the reusable function
			const filterConditions = buildFilterConditions(filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}

			const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields);

			const [roles, total] = await Promise.all([
				document ? prisma.role.findMany(findManyQuery) : [],
				count ? prisma.role.count({ where: whereClause }) : 0,
			]);

			roleLogger.info(`Retrieved ${roles.length} roles`);
			const responseData = {
				...(document && { roles }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.ROLE.RETRIEVED, responseData, 200),
			);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_GETTING}: ${error}`);
			res.status(500).json(buildErrorResponse(config.ERROR.ROLE.INTERNAL_SERVER_ERROR, 500));
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = RoleSchema.safeParse(req.body);
			if (!validationResult.success) {
				// Debug: Log raw Zod error
				console.log(
					"Raw Zod Error:",
					JSON.stringify(validationResult.error.format(), null, 2),
				);
				const formattedErrors = formatZodErrors(validationResult.error.format());
				roleLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if role already exists
			const existingRole = await prisma.role.findFirst({
				where: {
					name: validatedData.name,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			});

			if (existingRole) {
				roleLogger.info(`${config.SUCCESS.ROLE.RETRIEVED}: ${existingRole.id}`);
				const successResponse = buildSuccessResponse(
					"Existing role found",
					{ role: existingRole },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newRole = await prisma.role.create({
				data: {
					...validatedData,
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.CREATED}: ${newRole.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ROLE.CREATED,
				{ role: newRole },
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.ROLE.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				roleLogger.error(config.ERROR.ROLE.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.ROLE_ID_REQUIRED, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = RoleSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				roleLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				roleLogger.error(config.ERROR.ROLE.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.ROLE.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			roleLogger.info(`Updating role: ${id}`);

			const existingRole = await prisma.role.findFirst({
				where: {
					id,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			});

			if (!existingRole) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedRole = await prisma.role.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.UPDATED}: ${updatedRole.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ROLE.UPDATED,
				{ role: updatedRole },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_UPDATING}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.ROLE.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				roleLogger.error(config.ERROR.ROLE.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.ROLE_ID_REQUIRED, 400);
				res.status(400).json(errorResponse);
				return;
			}

			roleLogger.info(`${config.SUCCESS.ROLE.SOFT_DELETING}: ${id}`);

			const existingRole = await prisma.role.findFirst({
				where: {
					id,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			});

			if (!existingRole) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ROLE.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.role.update({
				where: { id },
				data: {
					deletedAt: new Date(),
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(config.SUCCESS.ROLE.DELETED, {}, 200);
			res.status(200).json(successResponse);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_DELETING}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.ROLE.INTERNAL_SERVER_ERROR, 500);
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
