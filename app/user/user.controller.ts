import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import * as argon2 from "argon2";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { AuthRequest } from "../../middleware/verifyToken";
import { uploadMultipleImages } from "../../helper/cloudinary";
import { controller as personController } from "../person/person.controller";
import { handleQueryValidation, executeFormattedQuery } from "../../utils/queryUtils";
import { buildAdvancedWhereClause, getSearchFields } from "../../utils/advancedFilterUtils";
import { ObjectIdSchema, CreateUserSchema, UpdateUserSchema } from "../../zod/user.zod";
import {
	validateWithZod,
	sendValidationError,
	sendSuccessResponse,
	sendErrorResponse,
	sendNotFoundResponse,
	sendConflictResponse,
	sendPrismaErrorResponse,
} from "../../utils/validationHelper";
import { logActivity } from "../../utils/activityLogger";
import { logAudit } from "../../utils/auditLogger";

const logger = getLogger();
const userLogger = logger.child({ module: "user" });

export const controller = (prisma: PrismaClient) => {
	const personCtrl = personController(prisma);

	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		const idValidation = validateWithZod(ObjectIdSchema, id);
		if (!idValidation.success) {
			userLogger.error(`${config.ERROR.USER.INVALID_USER_ID_FORMAT}: ${id}`);
			return sendValidationError(res, config.ERROR.USER.INVALID_USER_ID_FORMAT, [
				{ field: "id", message: config.ERROR.USER.INVALID_USER_ID_FORMAT },
			]);
		}

		if (fields && typeof fields !== "string") {
			userLogger.error(`${config.ERROR.USER.INVALID_FIELDS_PARAMETER}: ${fields}`);
			return sendValidationError(res, config.ERROR.USER.INVALID_FIELDS_PARAMETER, [
				{ field: "fields", message: config.ERROR.USER.POPULATE_MUST_BE_STRING },
			]);
		}

		userLogger.info(`${config.SUCCESS.USER.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.UserFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
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

				query.select = fieldSelections;
			} else {
				query.include = {
					person: true,
				};
			}

			const user = await prisma.user.findFirst(query);

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				return sendNotFoundResponse(res, "User", "id");
			}

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_USER",
				description: `Retrieved user with ID: ${id}`,
				organizationId: user.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Get User Details" },
			});

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			return sendSuccessResponse(res, config.SUCCESS.USER.RETRIEVED, user);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			return sendErrorResponse(res, config.ERROR.USER.INTERNAL_SERVER_ERROR);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Use centralized query validation
		const parsedParams = handleQueryValidation(req, res, userLogger);
		if (!parsedParams) return; // Response already sent if validation failed

		const {
			page,
			limit,
			skip,
			sort,
			fields,
			query,
			filter,
			order,
			documents,
			pagination,
			count,
		} = parsedParams;

		userLogger.info(
			`Getting all users: page: ${page}, limit: ${limit}, query: ${query}, order: ${order}, format: ${documents ? "documents" : pagination ? "pagination" : count ? "count" : "no-data"}`,
		);

		try {
			// Base conditions (filter out soft deleted records)
			const baseConditions: Prisma.UserWhereInput = {
				isDeleted: false,
			};

			// Auto-generate search fields for user and its relations
			const searchFields = getSearchFields("user", ["person", "organization"]);

			// Build where clause using advanced filtering
			const whereClause = buildAdvancedWhereClause(
				baseConditions,
				"user",
				query,
				searchFields,
				filter,
			);

			// Define include options for user data
			const includeOptions = {
				person: true,
				organization: true,
			};

			// Use the reusable utility function
			const response = await executeFormattedQuery(
				prisma,
				"user",
				whereClause,
				parsedParams,
				"users",
				"users",
				includeOptions,
			);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_ALL_USERS",
				description: `Retrieved ${response.data?.length || response.length || 0} user records`,
				page: { url: req.originalUrl, title: "Get All Users" },
			});

			userLogger.info(`Retrieved users successfully`);
			return sendSuccessResponse(
				res,
				config.SUCCESS.USER.RETRIEVED,
				response.data || response,
			);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`Error getting all users: ${error}`);
			return sendValidationError(res, config.ERROR.USER.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.ERROR.USER.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		const idValidation = validateWithZod(ObjectIdSchema, id);
		if (!idValidation.success) {
			userLogger.error(`${config.ERROR.USER.INVALID_USER_ID_FORMAT}: ${id}`);
			return sendValidationError(res, config.ERROR.USER.INVALID_USER_ID_FORMAT, [
				{ field: "id", message: config.ERROR.USER.INVALID_USER_ID_FORMAT },
			]);
		}

		const body = req.body || {};
		const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
		const {
			email,
			userName,
			password,
			role,
			subRole,
			status,
			organizationId,
			avatar,
			folder,
			person,
		} = body;

		// Similar to the create method, we need to handle the person data structure.
		// Let's parse it if it's a string, and then flatten the nested arrays.
		let parsedPerson = person;
		if (typeof person === "string") {
			try {
				parsedPerson = JSON.parse(person);
			} catch (error) {
				userLogger.error(`Failed to parse person JSON: ${error}`);
				return sendValidationError(res, config.ERROR.USER.VALIDATION_FAILED, [
					{ field: "person", message: "Invalid JSON format for person" },
				]);
			}
		}

		let personData: any = parsedPerson;
		while (Array.isArray(personData) && personData.length > 0) {
			personData = personData[0];
		}

		if (Array.isArray(personData)) {
			personData = personData.reduce((acc, curr) => ({ ...acc, ...curr }), {});
		}

		const updateData = {
			...(email && { email }),
			...(userName && { userName }),
			...(password && { password }),
			...(role && { role }),
			...(subRole && { subRole }),
			...(status && { status }),
			...(organizationId && { organizationId }),
			...(avatar && { avatar }),
		};

		const updateValidation = validateWithZod(UpdateUserSchema, updateData);
		if (!updateValidation.success) {
			userLogger.error(
				`${config.ERROR.USER.INVALID_UPDATE_DATA}: ${JSON.stringify(updateValidation.error)}`,
			);
			return sendValidationError(
				res,
				config.ERROR.USER.INVALID_UPDATE_DATA,
				updateValidation.error.errors,
			);
		}

		if (Object.keys(body).length === 0) {
			userLogger.error(config.ERROR.USER.NO_UPDATE_FIELDS);
			return sendValidationError(res, config.ERROR.USER.AT_LEAST_ONE_FIELD_REQUIRED, [
				{ field: "body", message: config.ERROR.USER.REQUEST_BODY_EMPTY },
			]);
		}

		userLogger.info(`Updating user: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				return sendNotFoundResponse(res, "User", "id");
			}

			if (!existingUser.person || !existingUser.person.id) {
				userLogger.error(`User ${id} does not have a valid person record to update.`);
				return sendValidationError(res, config.ERROR.USER.MISSING_ID, [
					{ field: "Error", message: config.ERROR.USER.MISSING_ID },
				]);
			}

			let avatarUrl: string | undefined = avatar;

			if (files?.avatar && files.avatar.length > 0) {
				const avatarFile = files.avatar[0];
				userLogger.info(`${config.ERROR.USER.UPLOADING_AVATAR}: ${id}`);

				const uploadResults = await uploadMultipleImages([avatarFile.buffer], {
					folder: folder || "avatars",
					quality: "auto",
					tags: ["avatar"],
				});

				avatarUrl = uploadResults[0].secure_url;
				userLogger.info(`${config.ERROR.USER.AVATAR_UPLOADED}: ${avatarUrl}`);
			}

			if (email) {
				const userWithEmail = await prisma.user.findUnique({
					where: { email },
				});

				if (userWithEmail && userWithEmail.id !== id) {
					userLogger.error(`${config.ERROR.USER.EMAIL_ALREADY_IN_USED}: ${email}`);
					return sendConflictResponse(
						res,
						"email",
						config.ERROR.USER.EMAIL_ALREADY_IN_USED,
					);
				}
			}

			const userUpdateData = {
				...(email && { email }),
				...(userName && { userName }),
				...(password && { password }),
				...(role && { role }),
				...(subRole && { subRole }),
				...(status && { status }),
				...(organizationId && { organizationId }),
				...(avatarUrl && { avatar: avatarUrl }),
			};

			const personUpdateData = { ...personData };

			// We use a transaction to make sure both user and person are updated,
			// or neither are.
			const result = await prisma.$transaction(async (tx) => {
				const updatedUser = await tx.user.update({
					where: { id },
					data: userUpdateData,
					include: {
						person: true,
					},
				});

				if (Object.keys(personUpdateData).length > 0) {
					// We need to call person controller's update here, similar to create
					const mockReq = {
						params: { id: existingUser.person.id },
						body: personUpdateData,
					} as unknown as Request;

					const mockRes = {
						statusCode: 0,
						data: null,
						status: function (code: number) {
							this.statusCode = code;
							return this;
						},
						json: function (data: any) {
							this.data = data;
							return this;
						},
					} as any;

					await personCtrl.update(mockReq, mockRes, _next);

					if (mockRes.statusCode < 200 || mockRes.statusCode >= 300) {
						// The update in person controller failed.
						throw new Error("Failed to update person data.");
					}

					// We need to merge the person data back into the user for the response
					updatedUser.person = mockRes.data;
				}

				return updatedUser;
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE_USER",
				description: `Updated user with ID: ${id}`,
				organizationId: result.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "User Update" },
			});

			// ✅ Log audit for update
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE",
				resource: "users",
				severity: "MEDIUM",
				entityType: "user",
				entityId: id,
				changesBefore: {
					email: existingUser.email,
					userName: existingUser.userName,
					role: existingUser.role,
					subRole: existingUser.subRole,
					status: existingUser.status,
					organizationId: existingUser.organizationId,
					avatar: existingUser.avatar,
					person: existingUser.person,
				},
				changesAfter: {
					email: result.email,
					userName: result.userName,
					role: result.role,
					subRole: result.subRole,
					status: result.status,
					organizationId: result.organizationId,
					avatar: result.avatar,
					person: result.person,
				},
				description: `Updated user with ID: ${id}`,
				organizationId: result.organizationId ?? undefined,
			});

			userLogger.info(`${config.SUCCESS.USER.UPDATE}: ${result.id}`);
			return sendSuccessResponse(res, config.SUCCESS.USER.USER_UPDATED_SUCCESSFULLY, result);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`${config.ERROR.USER.ERROR_UPDATING_USER}: ${error}`);
			return sendValidationError(res, config.ERROR.USER.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.ERROR.USER.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		const idValidation = validateWithZod(ObjectIdSchema, id);
		if (!idValidation.success) {
			userLogger.error(`${config.ERROR.USER.INVALID_USER_ID_FORMAT}: ${id}`);
			return sendValidationError(res, config.ERROR.USER.INVALID_USER_ID_FORMAT, [
				{ field: "id", message: config.ERROR.USER.INVALID_USER_ID_FORMAT },
			]);
		}

		userLogger.info(`${config.SUCCESS.USER.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				return sendNotFoundResponse(res, "User", "id");
			}

			await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: { isDeleted: true },
				}),
				prisma.person.update({
					where: { id: existingUser.person.id },
					data: {
						metadata: {
							isDeleted: true,
						},
					},
				}),
			]);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE_USER",
				description: `Soft deleted user with ID: ${id}`,
				organizationId: existingUser.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "User Deletion" },
			});

			// ✅ Log audit for deletion
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE",
				resource: "users",
				severity: "HIGH",
				entityType: "user",
				entityId: id,
				changesBefore: {
					email: existingUser.email,
					userName: existingUser.userName,
					role: existingUser.role,
					subRole: existingUser.subRole,
					status: existingUser.status,
					organizationId: existingUser.organizationId,
					avatar: existingUser.avatar,
					isDeleted: existingUser.isDeleted,
					person: existingUser.person,
				},
				changesAfter: {
					isDeleted: true,
				},
				description: `Soft deleted user with ID: ${id}`,
				organizationId: existingUser.organizationId ?? undefined,
			});

			userLogger.info(`${config.SUCCESS.USER.DELETED}: ${id}`);
			return sendSuccessResponse(res, config.SUCCESS.USER.DELETED);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`${config.ERROR.USER.ERROR_DELETING_USER}: ${error}`);
			return sendValidationError(res, config.ERROR.USER.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.ERROR.USER.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const getCurrentUser = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const userId = req.userId;

		if (!userId) {
			userLogger.error(config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND);
			return sendValidationError(res, config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND, [
				{ field: "Error", message: config.ERROR.USER.UNAUTHORIZED_USER_ID_NOT_FOUND },
			]);
		}

		userLogger.info(`Getting current user: ${userId}`);

		try {
			const user = await prisma.user.findUnique({
				where: {
					id: userId,
					isDeleted: false,
				},
				include: {
					person: true,
				},
			});

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${userId}`);
				return sendNotFoundResponse(res, "User", "id");
			}
			const { password, ...userWithoutPassword } = user;

			// ✅ Log activity
			logActivity(req, {
				userId: userId,
				action: "GET_CURRENT_USER",
				description: `Retrieved current user profile`,
				organizationId: user.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Current User Profile" },
			});

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			return sendSuccessResponse(res, config.SUCCESS.USER.RETRIEVED, userWithoutPassword);
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

	const create = async (req: Request, res: Response, next: NextFunction) => {
		const { email, password, userName, role, subRole, organizationId, avatar, path, person } =
			req.body;
		const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

		let parsedPerson = person;
		if (typeof person === "string") {
			try {
				parsedPerson = JSON.parse(person);
			} catch (error) {
				userLogger.error(`Failed to parse person JSON: ${error}`);
				return sendValidationError(res, config.ERROR.USER.VALIDATION_FAILED, [
					{ field: "person", message: "Invalid JSON format for person" },
				]);
			}
		}

		// As per FE request, data might be nested in arrays.
		// Let's get to the actual object.
		let personData: any = parsedPerson;
		while (Array.isArray(personData) && personData.length > 0) {
			personData = personData[0];
		}

		// After potentially un-nesting, if we have an array of objects,
		// we'll merge them. E.g. [{personalInfo: {}}, {contactInfo: {}}]
		if (Array.isArray(personData)) {
			personData = personData.reduce((acc, curr) => ({ ...acc, ...curr }), {});
		}

		const { personalInfo, ...otherPersonData } = personData || {};

		// Ensure path is treated as a string path (same as update method)
		const folderPath = typeof req.body.path === "string" ? req.body.path : undefined;

		// Extract firstName and lastName from personalInfo
		const firstName = personalInfo?.firstName;
		const lastName = personalInfo?.lastName;

		const userData = {
			email,
			password,
			userName,
			role,
			subRole,
			organizationId,
			loginMethod: "email",
		};

		const userValidation = validateWithZod(CreateUserSchema, userData);
		if (!userValidation.success) {
			userLogger.error(
				`${config.ERROR.USER.VALIDATION_FAILED}: ${JSON.stringify(userValidation.error)}`,
			);
			return sendValidationError(
				res,
				config.ERROR.USER.VALIDATION_FAILED,
				userValidation.error.errors,
			);
		}

		if (!personalInfo || !personalInfo.firstName || !personalInfo.lastName) {
			userLogger.error(config.ERROR.USER.VALIDATION_FAILED);
			return sendValidationError(res, config.ERROR.USER.VALIDATION_FAILED, [
				...(!personalInfo
					? [{ field: "person", message: "Personal information is required" }]
					: []),
				...(!personalInfo?.firstName
					? [
							{
								field: "person.personalInfo.firstName",
								message: config.ERROR.USER.FIRST_NAME_REQUIRED,
							},
						]
					: []),
				...(!personalInfo?.lastName
					? [
							{
								field: "person.personalInfo.lastName",
								message: config.ERROR.USER.LAST_NAME_REQUIRED,
							},
						]
					: []),
			]);
		}

		userLogger.info(`Creating user with email: ${email}`);

		try {
			let avatarUrl: string | undefined = avatar;

			if (files?.avatar && files.avatar.length > 0) {
				const avatarFile = files.avatar[0];
				userLogger.info(`${config.ERROR.USER.UPLOADING_AVATAR}: ${email}`);

				const uploadResults = await uploadMultipleImages([avatarFile.buffer], {
					folder: folderPath || "avatars",
					quality: "auto",
					tags: ["avatar"],
				});

				avatarUrl = uploadResults[0].secure_url;
				userLogger.info(`${config.ERROR.USER.AVATAR_UPLOADED}: ${avatarUrl}`);
			}

			const existingUser = await prisma.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				userLogger.error(`${config.ERROR.USER.USER_ALREADY_EXISTS}: ${email}`);
				return sendConflictResponse(res, "email", config.ERROR.USER.EMAIL_ALREADY_IN_USED);
			}

			const hashedPassword = password ? await argon2.hash(password) : undefined;

			const result = await prisma.$transaction(async (tx) => {
				const mockReq = {
					body: {
						...personData,
					},
				} as Request;

				const mockRes = {
					statusCode: 0,
					data: null,
					status: function (code: number) {
						this.statusCode = code;
						return this;
					},
					json: function (data: any) {
						this.data = data;
						return this;
					},
				} as any;

				await personCtrl.create(mockReq, mockRes, next);

				if (mockRes.statusCode !== 201 && mockRes.statusCode !== 200) {
					throw new Error(config.ERROR.USER.FAILED_TO_CREATE_OR_FIND_PERSON);
				}

				const person = mockRes.data;

				userLogger.info(
					`Creating user with personId: ${person.id}${organizationId ? `, organizationId: ${organizationId}` : ", no organization"}`,
				);

				const user = await tx.user.create({
					data: {
						email,
						userName: userName,
						...(hashedPassword && { password: hashedPassword }),
						role: role,
						subRole: subRole,
						loginMethod: "email",
						personId: person.id,
						...(organizationId && { organizationId }),
						...(avatarUrl && { avatar: avatarUrl }),
					},
					include: {
						person: true,
					},
				});

				return {
					user,
					isExistingPerson: mockRes.statusCode === 200,
				};
			});

			const userResponse = {
				id: result.user.id,
				email: result.user.email,
				userName: result.user.userName,
				role: result.user.role,
				subRole: result.user.subRole,
				avatar: result.user.avatar,
				person: result.user.person,
			};

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE_USER",
				description: `Created new user: ${email}`,
				organizationId: result.user.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "User Creation" },
			});

			// ✅ Log audit for creation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE",
				resource: "users",
				severity: "LOW",
				entityType: "user",
				entityId: result.user.id,
				changesBefore: null,
				changesAfter: {
					email: result.user.email,
					userName: result.user.userName,
					role: result.user.role,
					subRole: result.user.subRole,
					loginMethod: result.user.loginMethod,
					personId: result.user.personId,
					organizationId: result.user.organizationId,
					avatar: result.user.avatar,
					person: result.user.person,
				},
				description: `Created new user: ${email}`,
				organizationId: result.user.organizationId ?? undefined,
			});

			userLogger.info(`${config.SUCCESS.USER.CREATED}: ${result.user.id}`);
			return sendSuccessResponse(
				res,
				config.SUCCESS.USER.USER_CREATED_SUCCESSFULLY,
				{ user: userResponse },
				201,
			);
		} catch (error: any) {
			// Handle Prisma errors with consistent formatting
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, userLogger);
			}

			userLogger.error(`${config.ERROR.USER.ERROR_DURING_USER_CREATION}: ${error}`);
			return sendValidationError(res, config.ERROR.USER.ERROR_DURING_USER_CREATION, [
				{ field: "Error", message: config.ERROR.USER.ERROR_DURING_USER_CREATION },
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
