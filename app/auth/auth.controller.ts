import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";

const logger = getLogger();
const authLogger = logger.child({
	module: "auth",
});

export const controller = (prisma: PrismaClient) => {
	// const personCtrl = personController(prisma);

	const register = async (req: Request, res: Response, next: NextFunction) => {
		const { email, password, userName, ...personData } = req.body;
		const { firstName, lastName } = personData;

		// Validate required fields
		if (!firstName || !lastName) {
			authLogger.error("First name and last name are required");
			res.status(400).json({ message: "First name and last name are required" });
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			authLogger.error(`Invalid email address: ${email}`);
			res.status(400).json({ message: "Invalid email address" });
		}

		if (!password || password.length < 6) {
			authLogger.error("Password must be at least 6 characters long");
			res.status(400).json({ message: "Password must be at least 6 characters long" });
		}

		try {
			// Check if user already exists
			const existingUser = await prisma.user.findUnique({ where: { email } });
			if (existingUser) {
				authLogger.error(`User already exists: ${email}`);
				res.status(400).json({ message: "User already exists" });
			}

			const hashedPassword = await argon2.hash(password);

			const result = await prisma.$transaction(async (tx) => {
				// Create Person record
				const person = await tx.person.create({
					data: { firstName, lastName, ...personData },
				});

				// Create User linked to Person
				const user = await tx.user.create({
					data: {
						email,
						userName: userName || "",
						password: hashedPassword,
						loginMethod: "email",
						personId: person.id,
					},
					include: {
						person: true,
						roles: true, // include roles if you need them
					},
				});

				return { user };
			});

			authLogger.info(`User created: ${result.user.id}`);
			res.status(201).json({
				message: "Registration successful",
				user: result.user,
			});
		} catch (error) {
			authLogger.error(`Error during registration: ${error}`);
			res.status(500).json({ message: "Error during registration" });
			next(error);
		}
	};

	const login = async (req: Request, res: Response, _next: NextFunction) => {
		const { identifier, password } = req.body;
		// `identifier` can be either username or email

		if (!identifier || !password) {
			authLogger.error("Username/email and password are required");
			res.status(400).json({ message: "Username/email and password are required" });
		}

		authLogger.info(`Logging in user with identifier: ${identifier}`);

		try {
			const user = await prisma.user.findFirst({
				where: {
					OR: [{ email: identifier }, { userName: identifier }],
				},
				include: {
					person: true,
					roles: {
						include: {
							role: true,
						},
					},
				},
			});

			if (!user || !user.password) {
				authLogger.error(`Invalid credentials for identifier: ${identifier}`);
				res.status(401).json({ message: "Invalid credentials" });
				return
			}

			const isPasswordValid = await argon2.verify(user.password, password);
			if (!isPasswordValid) {
				authLogger.error(`Invalid password for identifier: ${identifier}`);
				res.status(401).json({ message: "Invalid credentials" });
			}

			// Update last login timestamp
			await prisma.user.update({
				where: { id: user.id },
				data: { lastLoginAt: new Date() },
			});

			// Generate JWT
			const token = jwt.sign(
				{
					userId: user.id,
					roles: user.roles.map((r) => r.role.name), // assuming UserRole has "name"
					firstName: user.person?.firstName,
					lastName: user.person?.lastName,
				},
				process.env.JWT_SECRET || "",
				{ expiresIn: "1h" },
			);

			// Set cookie
			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
			});

			authLogger.info(`User logged in: ${user.id}`);
			res.status(200).json({
				message: "Logged in successfully",
				user: {
					id: user.id,
					email: user.email,
					userName: user.userName,
					roles: user.roles,
					person: user.person,
				},
			});
		} catch (error) {
			authLogger.error(`Error during login: ${error}`);
			res.status(500).json({ message: "Error during login" });
		}
	};

	const logout = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const isProduction = process.env.NODE_ENV === config.COMMON.PRODUCTION;

			// Retrieve token from cookie (if exists)
			const token = req.cookies[config.COMMON.TOKEN];

			// Clear the JWT cookie
			res.cookie(config.COMMON.TOKEN, "", {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? "none" : "lax",
				maxAge: 0, // Expire immediately
				path: "/",
			});

			// Get user info from request (set by auth middleware)
			const userId = (req as any).user?.id || "system";
			const organizationId = (req as any).user?.organizationId;

			authLogger.info(`${config.SUCCESS.AUTH.LOGGED_OUT_SUCCESSFULLY}: ${userId}`);
			res.status(200).json({
				message: config.SUCCESS.AUTH.LOGGED_OUT_SUCCESSFULLY,
				success: true,
			});
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				authLogger.error(`Prisma error during logout: ${error}`);
				res.status(500).json({
					message: config.ERROR.AUTH.ERROR_DURING_LOGOUT,
					error: error.message,
					success: false,
				});
			}

			authLogger.error(`${config.ERROR.AUTH.ERROR_DURING_LOGOUT}: ${error}`);
			res.status(500).json({
				message: config.ERROR.AUTH.ERROR_DURING_LOGOUT,
				error: error.message,
				success: false,
			});
		}
	};

	const updatePassword = async (req: Request, res: Response, _next: NextFunction) => {
		const { userId, password } = req.body;

		if (!userId || !password) {
			authLogger.error("User ID and new password are required");
			res.status(400).json({
				message: "User ID and new password are required",
			});
			return;
		}

		if (password.length < 6) {
			authLogger.error("Password must be at least 6 characters long");
			res.status(400).json({
				message: "Password must be at least 6 characters long",
			});
			return;
		}

		try {
			const hashedPassword = await argon2.hash(password);

			await prisma.user.update({
				where: {
					id: userId,
				},
				data: {
					password: hashedPassword,
				},
			});

			authLogger.info(`Password updated for user: ${userId}`);
			res.status(200).json({
				message: "Password updated successfully",
			});
		} catch (error) {
			authLogger.error(`Error updating password: ${error}`);
			res.status(500).json({
				message: "Error updating password",
			});
		}
	};

	return {
		register,
		login,
		updatePassword,
		logout,
	};
};
