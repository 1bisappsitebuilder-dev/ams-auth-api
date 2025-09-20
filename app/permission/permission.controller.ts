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
import { PermissionSchema } from "../../zod/permission.zod";

const logger = getLogger();
const permissionLogger = logger.child({ module: "permission" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		try {
			if (!id) {
				permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
				const errorResponse = buildErrorResponse(
					config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			if (fields && typeof fields !== "string") {
				permissionLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
				const errorResponse = buildErrorResponse(
					config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			permissionLogger.info(`${config.SUCCESS.PERMISSION.GETTING_BY_ID}: ${id}`);

			const query: Prisma.PermissionFindFirstArgs = {
				where: { id, isDeleted: false },
			};

			query.select = getNestedFields(fields);

			const permission = await prisma.permission.findFirst(query);

			if (!permission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERMISSION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			permissionLogger.info(`${config.SUCCESS.PERMISSION.RETRIEVED}: ${permission.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERMISSION.RETRIEVED,
				{ permission },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_GETTING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, permissionLogger);

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
			filter,
			query,
			document,
			pagination,
			count,
		} = validationResult.validatedParams!;

		permissionLogger.info(
			`${config.SUCCESS.PERMISSION.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.PermissionWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{
									accessPolicy: {
										name: { contains: String(query), mode: "insensitive" },
									},
								},
								{
									role: {
										name: { contains: String(query), mode: "insensitive" },
									},
								},
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

			const [permissions, total] = await Promise.all([
				document ? prisma.permission.findMany(findManyQuery) : [],
				count ? prisma.permission.count({ where: whereClause }) : 0,
			]);

			permissionLogger.info(`Retrieved ${permissions.length} permissions`);
			const responseData = {
				...(document && { permissions }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.PERMISSION.RETRIEVED, responseData, 200),
			);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_GETTING}: ${error}`);
			res.status(500).json(
				buildErrorResponse(config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR, 500),
			);
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = PermissionSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				permissionLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if permission already exists
			const existingPermission = await prisma.permission.findFirst({
				where: {
					isDeleted: false,
					accessPolicyId: validatedData.accessPolicyId,
					roleId: validatedData.roleId,
				},
			});

			if (existingPermission) {
				permissionLogger.info(
					`${config.SUCCESS.PERMISSION.RETRIEVED}: ${existingPermission.id}`,
				);
				const successResponse = buildSuccessResponse(
					"Existing permission found",
					{ permission: existingPermission },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newPermission = await prisma.permission.create({
				data: {
					...validatedData,
				},
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.CREATED}: ${newPermission.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERMISSION.CREATED,
				{ permission: newPermission },
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
				const errorResponse = buildErrorResponse(
					config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = PermissionSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				permissionLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				permissionLogger.error(config.ERROR.PERMISSION.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.PERMISSION.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			permissionLogger.info(`Updating permission: ${id}`);

			const existingPermission = await prisma.permission.findFirst({
				where: { id, isDeleted: false },
			});

			if (!existingPermission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERMISSION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedPermission = await prisma.permission.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.UPDATED}: ${updatedPermission.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERMISSION.UPDATED,
				{ permission: updatedPermission },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_UPDATING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
				const errorResponse = buildErrorResponse(
					config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			permissionLogger.info(`${config.SUCCESS.PERMISSION.DELETING}: ${id}`);

			const existingPermission = await prisma.permission.findFirst({
				where: { id, isDeleted: false },
			});

			if (!existingPermission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERMISSION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.permission.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERMISSION.DELETED,
				{},
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_DELETING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR,
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
