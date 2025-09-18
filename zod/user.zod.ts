import { z } from "zod";

export const UserSchema = z.object({
	personId: z.string().nonempty("Person ID is required"),
	userName: z.string().nonempty("Username is required"),
	email: z.string().email("Invalid email format"),
	loginMethod: z.string().nonempty("Login method is required"),
	password: z.string().optional(),
	avatar: z.string().optional(),
	status: z.enum(["active", "inactive", "suspended", "archived"]).default("active"),
	organizationId: z.string().optional(),
	lastLoginAt: z.string().datetime().optional(),
	deletedAt: z.string().datetime().optional(),
});
