import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import {
	buildErrorResponse,
	formatZodErrors,
	handlePrismaClientValidationError,
} from "../../helper/error-handler";
import {
	buildFilterConditions,
	buildFindManyQuery,
	getNestedFields,
} from "../../helper/query-builder";
import { buildPagination, buildSuccessResponse } from "../../helper/success-handler";
import { validateQueryParams } from "../../helper/validation-helper";
import { ObjectIdSchema } from "../../zod/object-id.zod";
import { AppSchema } from "../../zod/app.zod";

const logger = getLogger();
const appLogger = logger.child({ module: "app" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		try {
			const idValidation = ObjectIdSchema.safeParse(id);

			if (!idValidation.success) {
				appLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			if (fields && typeof fields !== "string") {
				appLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
				const errorResponse = buildErrorResponse(
					config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			appLogger.info(`${config.SUCCESS.APP.GETTING_BY_ID}: ${id}`);

			const query: Prisma.AppFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			query.select = getNestedFields(fields);

			const app = await prisma.app.findFirst(query);

			if (!app) {
				appLogger.error(`${config.ERROR.APP.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.APP.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			appLogger.info(`${config.SUCCESS.APP.RETRIEVED}: ${app.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.APP.RETRIEVED,
				{ app },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error: any) {
			if (error.name === "PrismaClientValidationError") {
				const errorMsg = handlePrismaClientValidationError(error.message);
				appLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${errorMsg}`);
				res.status(400).json(buildErrorResponse(errorMsg, 400));
			} else {
				appLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
				res.status(500).json(
					buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500),
				);
			}
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const validationResult = validateQueryParams(req, appLogger);

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

		appLogger.info(
			`${config.SUCCESS.APP.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.AppWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ name: { contains: String(query) } },
								{ description: { contains: String(query) } },
								{ code: { contains: String(query) } },
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

			const [apps, total] = await Promise.all([
				document ? prisma.app.findMany(findManyQuery) : [],
				count ? prisma.app.count({ where: whereClause }) : 0,
			]);

			appLogger.info(`Retrieved ${apps.length} apps`);
			const responseData = {
				...(document && { apps }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.APP.RETRIEVED, responseData, 200),
			);
		} catch (error: any) {
			if (error.name === "PrismaClientValidationError") {
				const errorMsg = handlePrismaClientValidationError(error.message);
				appLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${errorMsg}`);
				res.status(400).json(buildErrorResponse(errorMsg, 400));
			} else {
				appLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
				res.status(500).json(
					buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500),
				);
			}
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = AppSchema.safeParse(req.body);
			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				appLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if app already exists by code
			const existingApp = await prisma.app.findFirst({
				where: {
					code: validatedData.code,
					isDeleted: false,
				},
			});

			if (existingApp) {
				appLogger.info(`${config.SUCCESS.APP.RETRIEVED}: ${existingApp.id}`);
				const successResponse = buildSuccessResponse(
					"Existing app found",
					{ app: existingApp },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newApp = await prisma.app.create({
				data: {
					...validatedData,
				},
			});

			appLogger.info(`${config.SUCCESS.APP.CREATED}: ${newApp.id}`);
			const successResponse = buildSuccessResponse(config.SUCCESS.APP.CREATED, newApp, 201);
			res.status(201).json(successResponse);
		} catch (error) {
			appLogger.error(`${config.ERROR.APP.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.APP.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			const idValidation = ObjectIdSchema.safeParse(id);

			if (!idValidation.success) {
				appLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = AppSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				appLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				appLogger.error(config.ERROR.APP.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.APP.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			appLogger.info(`Updating app: ${id}`);

			const existingApp = await prisma.app.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingApp) {
				appLogger.error(`${config.ERROR.APP.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.APP.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			// Check for code uniqueness if provided in update
			if (validatedData.code && validatedData.code !== existingApp.code) {
				const codeExists = await prisma.app.findFirst({
					where: {
						code: validatedData.code,
						isDeleted: false,
					},
				});
				if (codeExists) {
					appLogger.error(`${config.ERROR.APP.CODE_EXISTS}: ${validatedData.code}`);
					const errorResponse = buildErrorResponse(config.ERROR.APP.CODE_EXISTS, 400);
					res.status(400).json(errorResponse);
					return;
				}
			}

			const updatedApp = await prisma.app.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			appLogger.info(`${config.SUCCESS.APP.UPDATED}: ${updatedApp.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.APP.UPDATED,
				{ app: updatedApp },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			appLogger.error(`${config.ERROR.APP.ERROR_UPDATING}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.APP.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			const idValidation = ObjectIdSchema.safeParse(id);

			if (!idValidation.success) {
				appLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			appLogger.info(`${config.SUCCESS.APP.SOFT_DELETING}: ${id}`);

			const existingApp = await prisma.app.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingApp) {
				appLogger.error(`${config.ERROR.APP.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.APP.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.app.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			appLogger.info(`${config.SUCCESS.APP.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(config.SUCCESS.APP.DELETED, {}, 200);
			res.status(200).json(successResponse);
		} catch (error) {
			appLogger.error(`${config.ERROR.APP.ERROR_DELETING}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.APP.INTERNAL_SERVER_ERROR, 500);
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
