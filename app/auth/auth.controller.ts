import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { buildSuccessResponse } from "../../helper/success-handler";
import {
	LoginSchema,
	RegisterInput,
	RegisterSchema,
	UpdatePasswordSchema,
} from "../../zod/auth.zod";
import { buildErrorResponse, formatZodErrors } from "../../helper/error-handler";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const authLogger = logger.child({
	module: "auth",
});

export const controller = (prisma: PrismaClient) => {
	// const personCtrl = personController(prisma);

	const register = async (req: Request, res: Response, next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = RegisterSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				authLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);

				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);

				res.status(400).json(errorResponse);
				return;
			}
			const validatedData: RegisterInput = validationResult.data;

			// Check if user already exists
			const existingUser = await prisma.user.findUnique({
				where: { email: validatedData.email },
			});

			if (existingUser) {
				authLogger.error(`User already exists: ${validatedData.email}`);

				const errorResponse = buildErrorResponse("User already exists", 400, [
					{ field: "email", message: "Email is already registered" },
				]);

				res.status(400).json(errorResponse);
				return;
			}

			const hashedPassword = await argon2.hash(validatedData.password);

			const result = await prisma.$transaction(async (tx) => {
				// Create Person record
				const person = await tx.person.create({
					data: {
						firstName: validatedData.firstName,
						lastName: validatedData.lastName,
						prefix: validatedData.prefix,
						middleName: validatedData.middleName,
						dateOfBirth: validatedData.dateOfBirth,
						placeOfBirth: validatedData.placeOfBirth,
						age: validatedData.age,
						nationality: validatedData.nationality,
						primaryLanguage: validatedData.primaryLanguage,
						gender: validatedData.gender,
						currency: validatedData.currency,
						vipCode: validatedData.vipCode,
						contactInfo: validatedData.contactInfo,
						identification: validatedData.identification,
					},
				});

				// Create User linked to Person
				const user = await tx.user.create({
					data: {
						email: validatedData.email,
						userName: validatedData.userName,
						password: hashedPassword,
						loginMethod: validatedData.loginMethod,
						status: validatedData.status,
						avatar: validatedData.avatar,
						organizationId: validatedData.organizationId,
						personId: person.id,
					},
					include: {
						person: true,
						roles: true,
					},
				});

				return { user };
			});

			authLogger.info(`User created: ${result.user.id}`);

			// Build success response
			const successResponse = buildSuccessResponse(
				"Registration successful",
				{ user: result.user },
				201,
			);

			res.status(201).json(successResponse);
		} catch (error) {
			authLogger.error(`Error during registration: ${error}`);
			const errorResponse = buildErrorResponse("Error during registration", 500);

			res.status(500).json(errorResponse);
		}
	};

	const login = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = LoginSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				authLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);

				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const { identifier, password } = validationResult.data;

			authLogger.info(`Logging in user with identifier: ${identifier}`);

			// Find user by email or username
			const user = await prisma.user.findFirst({
				where: {
					OR: [{ email: identifier }, { userName: identifier }],
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

			if (!user || !user.password) {
				authLogger.error(`Invalid credentials for identifier: ${identifier}`);
				const errorResponse = buildErrorResponse("Invalid credentials", 401, [
					{ field: "identifier", message: "Invalid username or email" },
				]);
				res.status(401).json(errorResponse);
				return;
			}

			// Verify password
			const isPasswordValid = await argon2.verify(user.password, password);
			if (!isPasswordValid) {
				authLogger.error(`Invalid password for identifier: ${identifier}`);
				const errorResponse = buildErrorResponse("Invalid credentials", 401, [
					{ field: "password", message: "Invalid password" },
				]);
				res.status(401).json(errorResponse);
				return;
			}

			// Update last login timestamp
			await prisma.user.update({
				where: { id: user.id },
				data: { lastLoginAt: new Date() },
			});

			// Determine authType and token expiration
			const allowedAuthTypes = new Set(["standard", "persistent", "temporary"]);
			const rawAuthType = (user as any)?.metaData?.authType as string | undefined;
			const authType = allowedAuthTypes.has(rawAuthType || "") ? rawAuthType : "standard";
			const expiresIn =
				authType === "temporary" ? "1h" : authType === "standard" ? "1d" : undefined;

			// Generate JWT
			const tokenPayload = {
				userId: user.id,
				roles: user.roles.map((r) => r.role.name),
				firstName: user.person?.firstName,
				lastName: user.person?.lastName,
				organizationId: user.organizationId ?? undefined,
				authType,
			};

			const token = jwt.sign(
				tokenPayload,
				process.env.JWT_SECRET || "",
				expiresIn ? { expiresIn } : {},
			);

			// Set cookie
			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: authType === "persistent" ? undefined : 1 * 24 * 60 * 60 * 1000, // 1 day for non-persistent
			});

			authLogger.info(`User logged in: ${user.id}`);
			console.log(user);

			// Build success response
			const successResponse = buildSuccessResponse(
				"Logged in successfully",
				{
					id: user.id,
					email: user.email,
					userName: user.userName,
					roles: user.roles,
					person: user.person,
					organization: user.organization,
				},
				200,
			);

			res.status(200).json(successResponse);
		} catch (error) {
			authLogger.error(`Error during login: ${error}`);
			const errorResponse = buildErrorResponse("Error during login", 500);
			res.status(500).json(errorResponse);
		}
	};

	const logout = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const isProduction = process.env.NODE_ENV === "production";

			// Retrieve token from cookie (if exists)
			const token = req.cookies["token"];

			// Clear the JWT cookie
			res.cookie("token", "", {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? "none" : "lax",
				maxAge: 0, // Expire immediately
				path: "/",
			});

			// Get user info from request (set by auth middleware)
			const userId = (req as any).user?.id || "system";

			authLogger.info(`User logged out successfully: ${userId}`);

			// Build success response
			const successResponse = buildSuccessResponse("Logged out successfully");

			res.status(200).json(successResponse);
		} catch (error: any) {
			authLogger.error(`Error during logout: ${error}`);

			// Build error response
			const errorResponse = buildErrorResponse("Error during logout", 500, [
				{ field: "server", message: error.message },
			]);

			res.status(500).json(errorResponse);
		}
	};

	const updatePassword = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		try {
			// Validate the request body using Zod
			const validationResult = UpdatePasswordSchema.safeParse(req.body);

			if (!validationResult.success) {
				const formattedErrors = formatZodErrors(validationResult.error.format());
				authLogger.error(`Validation failed: ${JSON.stringify(formattedErrors)}`);

				const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
				res.status(400).json(errorResponse);
				return;
			}

			const { currentPassword, newPassword } = validationResult.data;

			// Get user info from request (set by auth middleware)
			const userId = req.userId;
			console.log(req.userId);
			if (!userId) {
				authLogger.error("No user found in request");
				const errorResponse = buildErrorResponse("Unauthorized", 401, [
					{ field: "user", message: "No authenticated user found" },
				]);
				res.status(401).json(errorResponse);
				return;
			}

			authLogger.info(`Attempting password update for user: ${userId}`);

			// Fetch user from database
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { password: true },
			});

			if (!user || !user.password) {
				authLogger.error(`User not found or no password set for user: ${userId}`);
				const errorResponse = buildErrorResponse("Invalid user", 404, [
					{ field: "user", message: "User not found or no password set" },
				]);
				res.status(404).json(errorResponse);
				return;
			}

			// Verify current password
			const isPasswordValid = await argon2.verify(user.password, currentPassword);
			if (!isPasswordValid) {
				authLogger.error(`Invalid current password for user: ${userId}`);
				const errorResponse = buildErrorResponse("Invalid credentials", 401, [
					{ field: "currentPassword", message: "Current password is incorrect" },
				]);
				res.status(401).json(errorResponse);
				return;
			}

			// Hash new password
			const hashedPassword = await argon2.hash(newPassword);

			// Update password in database
			await prisma.user.update({
				where: { id: userId },
				data: { password: hashedPassword },
			});

			authLogger.info(`Password updated successfully for user: ${userId}`);

			// Build success response
			const successResponse = buildSuccessResponse(
				"Password updated successfully",
				{ success: true },
				200,
			);

			res.status(200).json(successResponse);
		} catch (error: any) {
			authLogger.error(`Error during password update: ${error}`);
			const errorResponse = buildErrorResponse("Error during password update", 500, [
				{ field: "server", message: error.message },
			]);

			res.status(500).json(errorResponse);
		}
	};

	return {
		register,
		login,
		updatePassword,
		logout,
	};
};
