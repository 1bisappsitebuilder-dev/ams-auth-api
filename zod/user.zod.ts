import { z } from "zod";

export const RoleSchema = z.enum(["superadmin", "viewer", "admin", "guest"]);

export const SubRoleSchema = z.enum(["staff", "guard", "vendor", "operator", "manager", "guest"]);

export const StatusSchema = z.enum(["active", "inactive", "suspended", "archived"]);

export const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");
export const EmailSchema = z.string().email("Invalid email format");
export const DateTimeSchema = z.string().datetime("Invalid date format").or(z.date());

export const CreateUserSchema = z.object({
	personId: ObjectIdSchema.optional(),
	avatar: z.string().url("Invalid avatar URL").optional(),
	userName: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.max(50, "Username must be at most 50 characters")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Username can only contain letters, numbers, underscores, and hyphens",
		),
	email: EmailSchema,
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
			"Password must contain at least one lowercase letter, one uppercase letter, and one number",
		),
	role: RoleSchema,
	subRole: SubRoleSchema.optional(),
	organizationId: ObjectIdSchema.optional(),
	status: StatusSchema.optional().default("active"),
	loginMethod: z.string().min(1, "Login method is required"),
});

export const UpdateUserSchema = z.object({
	personId: ObjectIdSchema.optional(),
	avatar: z.string().url("Invalid avatar URL").optional(),
	userName: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.max(50, "Username must be at most 50 characters")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Username can only contain letters, numbers, underscores, and hyphens",
		)
		.optional(),
	email: EmailSchema.optional(),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
			"Password must contain at least one lowercase letter, one uppercase letter, and one number",
		)
		.optional(),
	role: RoleSchema.optional(),
	subRole: SubRoleSchema.optional(),
	organizationId: ObjectIdSchema.optional(),
	status: StatusSchema.optional(),
	loginMethod: z.string().min(1, "Login method is required").optional(),
	lastLogin: DateTimeSchema.optional(),
});

export const UserQuerySchema = z.object({
	page: z.number().int().positive().optional().default(1),
	limit: z.number().int().positive().max(100).optional().default(10),
	search: z.string().optional(),
	role: RoleSchema.optional(),
	subRole: SubRoleSchema.optional(),
	status: StatusSchema.optional(),
	organizationId: ObjectIdSchema.optional(),
	sortBy: z
		.enum(["userName", "email", "role", "status", "createdAt", "lastLogin"])
		.optional()
		.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
	includeDeleted: z.boolean().optional().default(false),
});

export const UserLoginSchema = z.object({
	email: EmailSchema,
	password: z.string().min(1, "Password is required"),
	loginMethod: z.string().min(1, "Login method is required"),
});

export type Role = z.infer<typeof RoleSchema>;
export type SubRole = z.infer<typeof SubRoleSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type UserLoginInput = z.infer<typeof UserLoginSchema>;
