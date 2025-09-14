import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { getLogger } from "../../helper/logger";
import { controller as personController } from "../person/person.controller";
import {
	RegisterSchema,
	LoginSchema,
	UpdatePasswordSchema,
	type RegisterInput,
	type LoginInput,
	type UpdatePasswordInput,
} from "../../zod/auth.zod";
import {
	validateWithZod,
	sendValidationError,
	sendSuccessResponse,
	sendErrorResponse,
	sendConflictResponse,
	sendNotFoundResponse,
	sendPrismaErrorResponse,
} from "../../utils/validationHelper";
import { config } from "../../config/constant";
import { logActivity } from "../../utils/activityLogger";
import { logAudit } from "../../utils/auditLogger";

const logger = getLogger();
const authLogger = logger.child({ module: "auth" });

export const controller = (prisma: PrismaClient) => {
	const personCtrl = personController(prisma);

	// Utility function to safely extract non-object fields
	const extractScalarFields = (obj: Record<string, any> = {}) => {
		return Object.fromEntries(
			Object.entries(obj).filter(
				([key, value]) =>
					value !== undefined && value !== null && typeof value !== "object",
			),
		);
	};

	const register = async (req: Request, res: Response, next: NextFunction) => {
		const validation = validateWithZod(RegisterSchema, req.body);
		if (!validation.success) {
			return sendValidationError(res, config.ERROR.AUTH.REGISTRATION_VALIDATION_FAILED, [
				{ field: "Error", message: config.ERROR.AUTH.REGISTRATION_VALIDATION_FAILED },
			]);
		}

		const {
			email,
			password,
			userName,
			role,
			subRole,
			firstName,
			lastName,
			organizationId,
			phoneNumber,
			...personData
		} = validation.data as RegisterInput;

		authLogger.info(`${config.INFO.USER.REGISTERING_USER}: ${email}`);

		try {
			const existingUser = await prisma.user.findUnique({ where: { email } });
			if (existingUser) {
				authLogger.error(`${config.ERROR.AUTH.USER_ALREADY_EXISTS}: ${email}`);
				return sendConflictResponse(
					res,
					config.COMMON.EMAIL,
					config.ERROR.AUTH.USER_ALREADY_EXISTS,
				);
			}

			const hashedPassword = await argon2.hash(password);

			const result = await prisma.$transaction(async (tx) => {
				// Structure contact info with phone number if provided
				const contactInfo = {
					...(req.body.contactInfo || {}),
					...(phoneNumber && {
						phones: [
							{
								type: "mobile",
								number: phoneNumber,
								isPrimary: true,
							},
						],
					}),
				};

				// Build personalInfo from the original request, ensuring no nested duplication
				const originalPersonalInfo = req.body.personalInfo || {};
				const personalInfo = {
					firstName,
					lastName,
					...extractScalarFields(originalPersonalInfo),
				};

				const mockReq = {
					body: {
						personalInfo,
						...(organizationId && { organizationId }),
						...(req.body.address && { address: req.body.address }),
						...(Object.keys(contactInfo).length > 0 && { contactInfo }),
						...(req.body.identification && { identification: req.body.identification }),
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
					throw new Error(config.ERROR.AUTH.FAILED_TO_CREATE_OR_FIND_PERSON);
				}

				const person = mockRes.data;

				const user = await tx.user.create({
					data: {
						email,
						userName,
						password: hashedPassword,
						role,
						subRole,
						loginMethod: config.COMMON.EMAIL_METHOD,
						personId: person.id,
					},
					include: { person: true },
				});

				return { user, isExistingPerson: mockRes.statusCode === 200 };
			});

			const userResponse = {
				id: result.user.id,
				email: result.user.email,
				userName: result.user.userName,
				role: result.user.role,
				subRole: result.user.subRole,
				avatar: result.user.avatar,
			};

			// ✅ Log activity
			logActivity(req, {
				userId: result.user.id,
				action: "REGISTER",
				description: `User ${email} registered successfully`,
				organizationId,
				page: { url: req.originalUrl, title: "Registration Page" },
			});
			logAudit(req, {
				userId: result.user.id,
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
				},
				description: `New user account created: ${email}`,
				organizationId,
			});

			authLogger.info(`${config.SUCCESS.AUTH.USER_CREATED}: ${result.user.id}`);
			return sendSuccessResponse(
				res,
				config.SUCCESS.AUTH.REGISTRATION_SUCCESSFUL,
				userResponse,
				201,
			);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, authLogger);
			}
			authLogger.error(`${config.ERROR.AUTH.ERROR_DURING_REGISTRATION}: ${error}`);
			return sendErrorResponse(res, config.ERROR.AUTH.ERROR_DURING_REGISTRATION);
		}
	};

	const login = async (req: Request, res: Response, _next: NextFunction) => {
		const validation = validateWithZod(LoginSchema, req.body);
		if (!validation.success) {
			return sendValidationError(res, config.ERROR.AUTH.LOGIN_VALIDATION_FAILED, [
				{ field: "Error", message: config.ERROR.AUTH.LOGIN_VALIDATION_FAILED },
			]);
		}

		const { email, password } = validation.data as LoginInput;

		authLogger.info(`${config.INFO.USER.LOGGING_IN_USER}: ${email}`);

		try {
			const user = await prisma.user.findUnique({
				where: { email },
				include: { person: true },
			});

			if (!user || !user.password) {
				authLogger.error(`${config.ERROR.AUTH.INVALID_CREDENTIALS}: ${email}`);
				return sendValidationError(res, config.ERROR.AUTH.INVALID_CREDENTIALS, [
					{ field: "Error", message: config.ERROR.AUTH.INVALID_CREDENTIALS },
				]);
			}

			const isPasswordValid = await argon2.verify(user.password, password);
			if (!isPasswordValid) {
				authLogger.error(`${config.ERROR.AUTH.INVALID_CREDENTIALS}: ${email}`);
				return sendValidationError(res, config.ERROR.AUTH.INVALID_CREDENTIALS, [
					{ field: "Error", message: config.ERROR.AUTH.INVALID_CREDENTIALS },
				]);
			}

			await prisma.user.update({
				where: { id: user.id },
				data: { lastLogin: new Date() },
			});

			const token = jwt.sign(
				{
					userId: user.id,
					role: user.role,
					firstName: user.person?.personalInfo?.firstName,
					lastName: user.person?.personalInfo?.lastName,
				},
				process.env.JWT_SECRET || "",
				{ expiresIn: "1d" },
			);

			const isProduction = process.env.NODE_ENV === config.COMMON.PRODUCTION;
			res.cookie(config.COMMON.TOKEN, token, {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? "none" : "lax",
				maxAge: 1 * 24 * 60 * 60 * 1000,
				path: "/",
			});

			const userResponse = {
				id: user.id,
				email: user.email,
				role: user.role,
				subRole: user.subRole,
				avatar: user.avatar,
				person: user.person,
				token,
			};

			// ✅ Log activity
			logActivity(req, {
				userId: user.id,
				action: "LOGIN",
				description: `User ${email} logged in`,
				organizationId: user.person?.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Login Page" },
			});

			authLogger.info(`${config.SUCCESS.AUTH.USER_LOGGED_IN}: ${user.id}`);
			return sendSuccessResponse(
				res,
				config.SUCCESS.AUTH.LOGGED_IN_SUCCESSFULLY,
				userResponse,
			);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, authLogger);
			}
			authLogger.error(`${config.ERROR.AUTH.ERROR_DURING_LOGIN}: ${error}`);
			return sendErrorResponse(res, config.ERROR.AUTH.ERROR_DURING_LOGIN, "LOGIN_ERROR");
		}
	};

	const updatePassword = async (req: Request, res: Response, _next: NextFunction) => {
		const validation = validateWithZod(UpdatePasswordSchema, req.body);
		if (!validation.success) {
			return sendValidationError(res, config.ERROR.AUTH.PASSWORD_UPDATE_VALIDATION_FAILED, [
				{ field: "Error", message: config.ERROR.AUTH.PASSWORD_UPDATE_VALIDATION_FAILED },
			]);
		}

		const { userId, password } = validation.data as UpdatePasswordInput;

		try {
			const existingUser = await prisma.user.findUnique({ where: { id: userId } });
			const previousPassword = existingUser?.password;
			if (!existingUser) {
				authLogger.error(`${config.ERROR.AUTH.USER_NOT_FOUND}: ${userId}`);
				return sendNotFoundResponse(res, config.COMMON.USER, config.COMMON.USER_ID);
			}

			const hashedPassword = await argon2.hash(password);
			await prisma.user.update({
				where: { id: userId },
				data: { password: hashedPassword },
			});

			// ✅ Log activity
			logActivity(req, {
				userId,
				action: "UPDATE_PASSWORD",
				description: "User updated their password",
				organizationId: existingUser.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Password Update Page" },
			});
			logAudit(req, {
				userId,
				action: "UPDATE",
				resource: "users",
				severity: "HIGH",
				entityType: "user",
				entityId: userId,
				changesBefore: { password: previousPassword },
				changesAfter: { password: hashedPassword },
				description: "User password updated",
				organizationId: existingUser.organizationId ?? undefined,
			});

			authLogger.info(`${config.SUCCESS.AUTH.PASSWORD_UPDATED_SUCCESSFULLY}: ${userId}`);
			return sendSuccessResponse(res, config.SUCCESS.AUTH.PASSWORD_UPDATED_SUCCESSFULLY);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, authLogger);
			}
			authLogger.error(`${config.ERROR.AUTH.ERROR_UPDATING_PASSWORD}: ${error}`);
			return sendErrorResponse(
				res,
				config.ERROR.AUTH.ERROR_UPDATING_PASSWORD,
				"PASSWORD_UPDATE_ERROR",
			);
		}
	};

	const logout = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const isProduction = process.env.NODE_ENV === config.COMMON.PRODUCTION;

			res.cookie(config.COMMON.TOKEN, "", {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? "none" : "lax",
				maxAge: 0,
				path: "/",
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "LOGOUT",
				description: "User logged out",
				page: { url: req.originalUrl, title: "Logout Endpoint" },
			});

			authLogger.info("User logged out successfully");
			return sendSuccessResponse(res, "Logged out successfully");
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, authLogger);
			}
			authLogger.error(`Error during logout: ${error}`);
			return sendErrorResponse(res, "Error during logout", "LOGOUT_ERROR");
		}
	};

	return { register, login, updatePassword, logout };
};
