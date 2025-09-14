import { z } from "zod";

// ObjectId validation schema
export const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
	message: "Invalid ObjectId format",
});

// Create Role Schema
export const CreateRoleSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
	description: z.string().max(500, "Description is too long").optional(),
});

// Update Role Schema
export const UpdateRoleSchema = z.object({
	name: z.string().min(1, "Name cannot be empty").max(100, "Name is too long").optional(),
	description: z.string().max(500, "Description is too long").optional(),
});

// Query parameters schema
export const RoleQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
	sort: z.string().optional(),
	order: z.enum(["asc", "desc"]).default("desc"),
	fields: z.string().optional(),
	query: z.string().optional(),
	filter: z.string().optional(),
});

// Types
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type RoleQueryParams = z.infer<typeof RoleQuerySchema>;
