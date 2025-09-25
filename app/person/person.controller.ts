import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import {
	buildErrorResponse,
	formatZodErrors,
	handlePrismaClientValidationError,
} from "../../helper/error-handler";
import { buildPagination, buildSuccessResponse } from "../../helper/success-handler";
import { PersonSchema } from "../../zod/person.zod";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	getNestedFields,
} from "../../helper/query-builder";
import { ObjectIdSchema } from "../../zod/object-id.zod";

const logger = getLogger();
const personLogger = logger.child({ module: "person" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		const idValidation = ObjectIdSchema.safeParse(id);

		if (!idValidation.success) {
			personLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
			const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
			res.status(400).json(errorResponse);
			return;
		}

		if (fields && typeof fields !== "string") {
			personLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
				400,
			);
			res.status(400).json(errorResponse);
			return;
		}

		personLogger.info(`${config.SUCCESS.PERSON.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.PersonFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			query.select = getNestedFields(fields);

			const person = await prisma.person.findFirst(query);

			if (!person) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERSON.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			personLogger.info(`${config.SUCCESS.PERSON.RETRIEVED}: ${person.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERSON.RETRIEVED,
				{ person },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error: any) {
			if (error.name === "PrismaClientValidationError") {
				const errorMsg = handlePrismaClientValidationError(error.message);
				personLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${errorMsg}`);
				res.status(400).json(buildErrorResponse(errorMsg, 400));
			} else {
				personLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
				res.status(500).json(
					buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500),
				);
			}
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, personLogger);

		if (!validationResult.isValid) {
			console.log("ERROR HERE!!!!!")
			res.status(400).json(validationResult.errorResponse);
		}

		const {
			page,
			limit,
			order,
			fields,
			sort,
			skip,
			query,
			document,
			pagination,
			count,
			filter,
		} = validationResult.validatedParams!;

		personLogger.info(
			`${config.SUCCESS.PERSON.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}, filter: ${JSON.stringify(filter)}`,
		);

		try {
			// Base where clause
			const whereClause: Prisma.PersonWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ firstName: { contains: String(query) } },
								{ lastName: { contains: String(query) } },
								{ middleName: { contains: String(query) } },
							],
						}
					: {}),
			};

			// Add filter conditions using the reusable function
			const filterConditions = buildFilterConditions("Person", filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}

			const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields);

			const [person, total] = await Promise.all([
				document ? prisma.person.findMany(findManyQuery) : [],
				count ? prisma.person.count({ where: whereClause }) : 0,
			]);

			personLogger.info(`Retrieved ${person.length} person`);
			const responseData = {
				...(document && { person }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.PERSON.RETRIEVED, responseData, 200),
			);
		} catch (error: any) {
			if (error.name === "PrismaClientValidationError") {
				const errorMsg = handlePrismaClientValidationError(error.message);
				personLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${errorMsg}`);
				res.status(400).json(buildErrorResponse(errorMsg, 400));
			} else {
				personLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
				res.status(500).json(
					buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500),
				);
			}
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = PersonSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				personLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if person already exists
			const existingPerson = await prisma.person.findFirst({
				where: {
					isDeleted: false,
					firstName: validatedData.firstName,
					lastName: validatedData.lastName,
				},
			});

			if (existingPerson) {
				personLogger.info(`${config.SUCCESS.PERSON.RETRIEVED}: ${existingPerson.id}`);
				const successResponse = buildSuccessResponse(
					"Existing person found",
					{ person: existingPerson },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			const newPerson = await prisma.person.create({
				data: {
					...validatedData,
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.CREATED}: ${newPerson.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERSON.CREATED,
				newPerson,
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERSON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			const idValidation = ObjectIdSchema.safeParse(id);

			if (!idValidation.success) {
				personLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
				const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = PersonSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				personLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				personLogger.error(config.ERROR.PERSON.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.PERSON.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			personLogger.info(`Updating person: ${id}`);

			const existingPerson = await prisma.person.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingPerson) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERSON.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedPerson = await prisma.person.update({
				where: { id },
				data: {
					...validatedData,
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.UPDATE}: ${updatedPerson.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.PERSON.UPDATE,
				{ person: updatedPerson },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_UPDATING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERSON.INTERNAL_SERVER_ERROR,
				500,
			);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		const idValidation = ObjectIdSchema.safeParse(id);

		if (!idValidation.success) {
			personLogger.error(config.ERROR.QUERY_PARAMS.INVALID_ID);
			const errorResponse = buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_ID, 400);
			res.status(400).json(errorResponse);
			return;
		}

		personLogger.info(`${config.SUCCESS.PERSON.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.person.findUnique({
				where: { id, isDeleted: false },
			});

			if (!existingUser) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.PERSON.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			await prisma.person.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(config.SUCCESS.PERSON.DELETED, {}, 200);
			res.status(200).json(successResponse);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_DELETING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.PERSON.INTERNAL_SERVER_ERROR,
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
