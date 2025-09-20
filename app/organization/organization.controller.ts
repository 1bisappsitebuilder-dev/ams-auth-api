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
import { OrganizationSchema } from "../../zod/organization.zod";

const logger = getLogger();
const organizationLogger = logger.child({ module: "organization" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		try {
			if (!id) {
				organizationLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.MISSING_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			if (fields && typeof fields !== "string") {
				organizationLogger.error(
					`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`,
				);
				const errorResponse = buildErrorResponse(
					config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			organizationLogger.info(`${config.SUCCESS.ORGANIZATION.GETTING_BY_ID}: ${id}`);

			const query: Prisma.OrganizationFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			query.select = getNestedFields(fields);

			const organization = await prisma.organization.findFirst(query);

			if (!organization) {
				organizationLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ORGANIZATION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			organizationLogger.info(`${config.SUCCESS.ORGANIZATION.RETRIEVED}: ${organization.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ORGANIZATION.RETRIEVED,
				{ organization },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			organizationLogger.error(`${config.ERROR.ORGANIZATION.ERROR_GETTING}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.COMMON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, organizationLogger);

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

		organizationLogger.info(
			`${config.SUCCESS.ORGANIZATION.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.OrganizationWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ name: { contains: String(query) } },
								{ code: { contains: String(query) } },
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

			const [organizations, total] = await Promise.all([
				document ? prisma.organization.findMany(findManyQuery) : [],
				count ? prisma.organization.count({ where: whereClause }) : 0,
			]);

			organizationLogger.info(`Retrieved ${organizations.length} organizations`);
			const responseData = {
				...(document && { organizations }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.ORGANIZATION.RETRIEVED, responseData, 200),
			);
		} catch (error) {
			organizationLogger.error(`${config.ERROR.ORGANIZATION.ERROR_GETTING}: ${error}`);
			res.status(500).json(
				buildErrorResponse(config.ERROR.COMMON.INTERNAL_SERVER_ERROR, 500),
			);
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const validationResult = OrganizationSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				organizationLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if organization already exists
			const existingOrganization = await prisma.organization.findFirst({
				where: {
					name: validatedData.name,
					isDeleted: false,
				},
			});

			if (existingOrganization) {
				organizationLogger.info(
					`${config.SUCCESS.ORGANIZATION.RETRIEVED}: ${existingOrganization.id}`,
				);
				const successResponse = buildSuccessResponse(
					"Existing organization found",
					{ organization: existingOrganization },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newOrganization = await prisma.organization.create({
				data: {
					...validatedData,
				},
			});

			organizationLogger.info(
				`${config.SUCCESS.ORGANIZATION.CREATED}: ${newOrganization.id}`,
			);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ORGANIZATION.CREATED,
				{ organization: newOrganization },
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			organizationLogger.error(`${config.ERROR.COMMON.INTERNAL_SERVER_ERROR}: ${error}`);
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
			if (!id) {
				organizationLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.ORGANIZATION.MISSING_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = OrganizationSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				organizationLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				organizationLogger.error(config.ERROR.ORGANIZATION.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.ORGANIZATION.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			organizationLogger.info(`Updating organization: ${id}`);

			const existingOrganization = await prisma.organization.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingOrganization) {
				organizationLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ORGANIZATION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedOrganization = await prisma.organization.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			organizationLogger.info(
				`${config.SUCCESS.ORGANIZATION.UPDATED}: ${updatedOrganization.id}`,
			);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ORGANIZATION.UPDATED,
				{ organization: updatedOrganization },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			organizationLogger.error(`${config.ERROR.ORGANIZATION.ERROR_UPDATING}: ${error}`);
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
			if (!id) {
				organizationLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.ORGANIZATION.MISSING_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			organizationLogger.info(`${config.SUCCESS.ORGANIZATION.SOFT_DELETING}: ${id}`);

			const existingOrganization = await prisma.organization.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingOrganization) {
				organizationLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.ORGANIZATION.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.organization.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			organizationLogger.info(`${config.SUCCESS.ORGANIZATION.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.ORGANIZATION.DELETED,
				{},
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			organizationLogger.error(`${config.ERROR.ORGANIZATION.ERROR_DELETING}: ${error}`);
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
