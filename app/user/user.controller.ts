import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { logActivity } from "../../utils/activityLogger";
import { AuthRequest } from "../../middleware/verifyToken";
import { sendPrismaErrorResponse, sendValidationError } from "../../utils/validationHelper";
import { buildErrorResponse } from "../../helper/error-handler";
import { getNestedFields } from "../../helper/query-builder";
import { buildSuccessResponse } from "../../helper/success-handler";

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
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
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
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			userLogger.error(`${config.ERROR.USER.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.USER.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			userLogger.error(`${config.ERROR.USER.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.USER.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			userLogger.error(`${config.ERROR.USER.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.USER.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			userLogger.error(`${config.ERROR.USER.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.USER.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					userLogger.error(`${config.ERROR.USER.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.USER.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		userLogger.info(
			`${config.SUCCESS.USER.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.UserWhereInput = {
				deletedAt: null,
				...(query
					? {
							OR: [
								{
									person: {
										OR: [
											{ firstName: { contains: String(query) } },
											{ lastName: { contains: String(query) } },
										],
									},
								},
								{ email: { contains: String(query) } },
								{ userName: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.UserFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { id: order as Prisma.SortOrder },
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				findManyQuery.select = fieldSelections;
			}

			const [users, total] = await Promise.all([
				prisma.user.findMany(findManyQuery),
				prisma.user.count({ where: whereClause }),
			]);

			userLogger.info(`Retrieved ${users.length} users`);
			res.status(200).json({
				users,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
			``;
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { personId, userName, email, loginMethod, ...others } = req.body;

		// Validate required fields
		if (!personId || !userName || !email || !loginMethod) {
			userLogger.error(config.ERROR.USER.MISSING_REQUIRED_FIELDS);
			res.status(400).json({
				error: "personId, userName, email, and loginMethod are required",
			});
			return;
		}

		try {
			// Check if person exists
			const existingPerson = await prisma.person.findFirst({
				where: {
					id: personId,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			});

			if (!existingPerson) {
				userLogger.error(`${config.ERROR.USER.PERSON_NOT_FOUND}: ${personId}`);
				res.status(404).json({ error: config.ERROR.USER.PERSON_NOT_FOUND });
				return;
			}

			// Check for existing user with same username or email
			const existingUser = await prisma.user.findFirst({
				where: {
					AND: [
						{
							OR: [{ userName }, { email }],
						},
						{
							OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
						},
					],
				},
			});

			if (existingUser) {
				userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${existingUser.id}`);
				res.status(200).json({
					...existingUser,
					message: "Existing user found with matching username or email",
				});
				return;
			}

			// Create new user
			const newUser = await prisma.user.create({
				data: {
					personId,
					userName,
					email,
					loginMethod,
					...others,
				},
			});

			userLogger.info(`${config.SUCCESS.USER.CREATED}: ${newUser.id}`);
			res.status(201).json(newUser);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { email, userName, password, type, status, ...personData } = req.body;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			res.status(400).json({ error: config.ERROR.USER.USER_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			userLogger.error(config.ERROR.USER.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.USER.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		if (email) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				userLogger.error(`${config.ERROR.USER.INVALID_EMAIL}: ${email}`);
				res.status(400).json({ error: config.ERROR.USER.INVALID_EMAIL });
				return;
			}
		}

		userLogger.info(`Updating user: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.USER.NOT_FOUND });
				return;
			}

			if (email) {
				const userWithEmail = await prisma.user.findUnique({
					where: { email },
				});

				if (userWithEmail && userWithEmail.id !== id) {
					userLogger.error(`${config.ERROR.USER.EMAIL_ALREADY_IN_USED}: ${email}`);
					res.status(400).json({ error: config.ERROR.USER.EMAIL_ALREADY_IN_USED });
					return;
				}
			}

			const [updatedUser] = await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: {
						...(email && { email }),
						...(userName && { userName }),
						...(password && { password }),
						...(type && { type }),
						...(status && { status }),
					},
					include: {
						person: true,
					},
				}),
				...(Object.keys(personData).length > 0
					? [
							prisma.person.update({
								where: { id: existingUser.person.id },
								data: personData,
							}),
						]
					: []),
			]);

			userLogger.info(`${config.SUCCESS.USER.UPDATE}: ${updatedUser.id}`);
			res.status(200).json(updatedUser);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_UPDATING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			res.status(400).json({ error: config.ERROR.USER.USER_ID_REQUIRED });
			return;
		}

		userLogger.info(`${config.SUCCESS.USER.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.USER.NOT_FOUND });
				return;
			}

			await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: { deletedAt: new Date() }, // set current datetime
				}),
				prisma.person.update({
					where: { id: existingUser.person.id },
					data: {
						deletedAt: new Date(),
					},
				}),
			]);

			userLogger.info(`${config.SUCCESS.USER.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.USER.DELETED });
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_DELETING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	};

	const getCurrentUser = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const userId = req.userId;

		if (!userId) {
			userLogger.error(config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND);
			res.status(401).json({ error: config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND });
		}

		userLogger.info(`Getting current user: ${userId}`);

		try {
			const user = await prisma.user.findUnique({
				where: {
					id: userId,
					deletedAt: null,
				},
				include: { person: true, organization: true },
			});

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${userId}`);
				return res.status(401).json({ error: config.ERROR.USER.NOT_FOUND });
			}

			// Now safe to destructure, since user is not null
			const { password, ...userWithoutPassword } = user;

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			res.status(200).json(userWithoutPassword);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			return sendValidationError(res, config.ERROR.USER.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.ERROR.USER.INTERNAL_SERVER_ERROR },
			]);
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
