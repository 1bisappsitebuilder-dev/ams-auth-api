import { z } from "zod";
import {
	RoleSchema,
	SubRoleSchema,
	StatusSchema,
	ObjectIdSchema,
	EmailSchema,
	DateTimeSchema,
} from "./user.zod";

// Re-export common schemas from user.zod.ts
export { RoleSchema, SubRoleSchema, StatusSchema, ObjectIdSchema, EmailSchema, DateTimeSchema };

// Registration schema
export const RegisterSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(6, "Password must be at least 6 characters long"),
	userName: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.max(50, "Username must be at most 50 characters")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Username can only contain letters, numbers, underscores, and hyphens",
		),
	role: RoleSchema,
	subRole: SubRoleSchema.optional(),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	organizationId: z
		.string()
		.regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format")
		.optional(),
	// Additional person data fields
	phoneNumber: z.string().optional(),
	dateOfBirth: z.string().datetime().optional(),
	gender: z.enum(["male", "female", "other"]).optional(),
	nationality: z.string().optional(),
	address: z
		.object({
			street: z.string().optional(),
			city: z.string().optional(),
			state: z.string().optional(),
			country: z.string().optional(),
			postalCode: z.string().optional(),
		})
		.optional(),
	// Allow nested personalInfo and contactInfo objects to pass through
	personalInfo: z.record(z.any()).optional(),
	contactInfo: z.record(z.any()).optional(),
	identification: z.record(z.any()).optional(),
});

// Login schema
export const LoginSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(1, "Password is required"),
});

// Password update schema
export const UpdatePasswordSchema = z.object({
	userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format"),
	password: z.string().min(6, "Password must be at least 6 characters long"),
});

// Error response schema
export const AuthErrorResponseSchema = z.object({
	message: z.string(),
});

// Type exports
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
