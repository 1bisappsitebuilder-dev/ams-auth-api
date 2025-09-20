import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { logActivity } from "../../utils/activityLogger";
import { AuthRequest } from "../../middleware/verifyToken";
import { sendPrismaErrorResponse, sendValidationError } from "../../utils/validationHelper";
import { buildErrorResponse, formatZodErrors } from "../../helper/error-handler";
import {
	buildFilterConditions,
	buildFindManyQuery,
	getNestedFields,
} from "../../helper/query-builder";
import { buildPagination, buildSuccessResponse } from "../../helper/success-handler";
import { validateQueryParams } from "../../helper/validation-helper";
import { UserSchema } from "../../zod/user.zod";
import * as argon2 from "argon2";

const logger = getLogger();
const userLogger = logger.child({ module: "user" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			const errorResponse = buildErrorResponse(config.ERROR.USER.USER_ID_REQUIRED, 400);
			res.status(400).json(errorResponse);
			return;
		}

		if (fields && typeof fields !== "string") {
			userLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
			const errorResponse = buildErrorResponse(
				config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
				400,
			);
			res.status(400).json(errorResponse);
			return;
		}

		userLogger.info(`${config.SUCCESS.USER.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.UserFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			query.select = getNestedFields(fields);

			const user = await prisma.user.findFirst(query);

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.USER.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.USER.RETRIEVED,
				{ user },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Validate query parameters
		const validationResult = validateQueryParams(req, userLogger);

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

		userLogger.info(
			`${config.SUCCESS.USER.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.UserWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{
									person: {
										OR: [
											{ firstName: { contains: query } },
											{ lastName: { contains: query } },
										],
									},
								},
								{ email: { contains: query } },
								{ userName: { contains: query } },
							],
						}
					: {}),
			};

			const filterConditions = buildFilterConditions(filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}

			const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields);
			const [users, total] = await Promise.all([
				document ? prisma.user.findMany(findManyQuery) : [],
				count ? prisma.user.count({ where: whereClause }) : 0,
			]);

			userLogger.info(`Retrieved ${users.length} users`);
			const responseData = {
				...(document && { users }),
				...(count && { count: total }),
				...(pagination && { pagination: buildPagination(total, page, limit) }),
			};

			res.status(200).json(
				buildSuccessResponse(config.SUCCESS.USER.RETRIEVED, responseData, 200),
			);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json(buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500));
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		try {
			const validationResult = UserSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				userLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			// Check if person exists
			const existingPerson = await prisma.person.findFirst({
				where: {
					id: validatedData.personId,
					isDeleted: false,
				},
			});

			if (!existingPerson) {
				userLogger.error(
					`${config.ERROR.USER.PERSON_NOT_FOUND}: ${validatedData.personId}`,
				);
				const errorResponse = buildErrorResponse(config.ERROR.USER.PERSON_NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			// Check for existing user with same username or email
			const existingUser = await prisma.user.findFirst({
				where: {
					AND: [
						{
							OR: [
								{ userName: validatedData.userName },
								{ email: validatedData.email },
							],
						},
						{
							isDeleted: false,
						},
					],
				},
			});

			if (existingUser) {
				userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${existingUser.id}`);
				const successResponse = buildSuccessResponse(
					"Existing user found with matching username or email",
					{ user: existingUser },
					200,
				);
				res.status(200).json(successResponse);
				return;
			}

			// 🔑 Hash password if provided
			let hashedPassword: string | undefined = undefined;
			if (validatedData.password) {
				hashedPassword = await argon2.hash(validatedData.password);
			}

			// Create new user
			const newUser = await prisma.user.create({
				data: {
					...validatedData,
					password: hashedPassword, // store the hash, not plain text
				},
			});

			userLogger.info(`${config.SUCCESS.USER.CREATED}: ${newUser.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.USER.CREATED,
				{ user: newUser },
				201,
			);
			res.status(201).json(successResponse);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.INTERNAL_SERVER_ERROR}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				userLogger.error(config.ERROR.USER.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.USER.USER_ID_REQUIRED, 400);
				res.status(400).json(errorResponse);
				return;
			}

			// Validate the request body using Zod
			const validationResult = UserSchema.partial().safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				userLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);
				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			if (Object.keys(req.body).length === 0) {
				userLogger.error(config.ERROR.USER.NO_UPDATE_FIELDS);
				const errorResponse = buildErrorResponse(
					config.ERROR.USER.AT_LEAST_ONE_FIELD_REQUIRED,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			const validatedData = validationResult.data;

			userLogger.info(`Updating user: ${id}`);

			const existingUser = await prisma.user.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.USER.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			if (validatedData.email) {
				const userWithEmail = await prisma.user.findFirst({
					where: {
						email: validatedData.email,
						isDeleted: false,
					},
				});

				if (userWithEmail && userWithEmail.id !== id) {
					userLogger.error(
						`${config.ERROR.USER.EMAIL_ALREADY_IN_USED}: ${validatedData.email}`,
					);
					const errorResponse = buildErrorResponse(
						config.ERROR.USER.EMAIL_ALREADY_IN_USED,
						400,
					);
					res.status(400).json(errorResponse);
					return;
				}
			}

			// if roles are provided, assign them using UserRole
			if (req.body.roles && Array.isArray(req.body.roles)) {
				const roleIds: string[] = req.body.roles;

				for (const roleId of roleIds) {
					const existingRole = await prisma.userRole.findUnique({
						where: {
							userId_roleId: { userId: id, roleId },
						},
					});

					if (!existingRole) {
						await prisma.userRole.create({
							data: {
								userId: id,
								roleId,
							},
						});
					}
				}
			}

			// update user basic info first
			const updatedUser = await prisma.user.update({
				where: { id },
				data: {
					...validatedData,
				},
				include: {
					person: true,
					organization: true,
					roles: {
						include: {
							role: true,
						},
					},
				},
			});

			userLogger.info(`${config.SUCCESS.USER.UPDATE}: ${updatedUser.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.USER.UPDATE,
				{ user: updatedUser },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_UPDATING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		try {
			if (!id) {
				userLogger.error(config.ERROR.USER.MISSING_ID);
				const errorResponse = buildErrorResponse(config.ERROR.USER.USER_ID_REQUIRED, 400);
				res.status(400).json(errorResponse);
				return;
			}

			userLogger.info(`${config.SUCCESS.USER.SOFT_DELETING}: ${id}`);

			const existingUser = await prisma.user.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				const errorResponse = buildErrorResponse(config.ERROR.USER.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			const updatedUser = await prisma.user.update({
				where: { id },
				data: { isDeleted: true },
			});

			userLogger.info(`${config.SUCCESS.USER.DELETED}: ${id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.USER.DELETED,
				{ user: updatedUser },
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_DELETING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	const getCurrentUser = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const userId = req.userId;
		const { fields } = req.query;

		try {
			if (!userId) {
				userLogger.error(config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND);
				const errorResponse = buildErrorResponse(
					config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND,
					401,
				);
				res.status(401).json(errorResponse);
				return;
			}

			if (fields && typeof fields !== "string") {
				userLogger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
				const errorResponse = buildErrorResponse(
					config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING,
					400,
				);
				res.status(400).json(errorResponse);
				return;
			}

			userLogger.info(`Getting current user: ${userId}`);

			const query: Prisma.UserFindFirstArgs = {
				where: {
					id: userId,
					isDeleted: false,
				},
			};

			query.select = getNestedFields(fields) || {
				id: true,
				email: true,
				userName: true,
				password: true,
				organizationId: true,
				roles: {
					select: {
						role: {
							select: {
								name: true,
								description: true,
								type: true,
							},
						},
					},
				},
				person: {
					select: {
						firstName: true,
						lastName: true,
					},
				},
				organization: {
					select: {
						name: true,
						code: true,
						description: true,
						branding: true,
					},
				},
			};

			const user = await prisma.user.findFirst(query);

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${userId}`);
				const errorResponse = buildErrorResponse(config.ERROR.USER.NOT_FOUND, 404);
				res.status(404).json(errorResponse);
				return;
			}

			// Exclude password from response
			const { password, ...userWithoutPassword } = user;

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			const successResponse = buildSuccessResponse(
				config.SUCCESS.USER.RETRIEVED,
				userWithoutPassword,
				200,
			);
			res.status(200).json(successResponse);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			const errorResponse = buildErrorResponse(config.ERROR.USER.INTERNAL_SERVER_ERROR, 500);
			res.status(500).json(errorResponse);
		}
	};

	return {
		getById,
		getAll,
		update,
		remove,
		getCurrentUser,
		create,
	};
};
