import { z } from "zod";

// separate enum schema
export const StatusEnum = z.enum(["active", "inactive", "suspended", "archived"]);

// user schema
export const UserSchema = z.object({
	personId: z.string().nonempty("Person ID is required"),
	userName: z.string().nonempty("Username is required"),
	email: z.string().email("Invalid email format"),
	loginMethod: z.string().nonempty("Login method is required"),
	password: z.string().optional(),
	avatar: z.string().optional(),
	status: StatusEnum.default("active"), // reused enum
	organizationId: z.string().optional(),
	lastLoginAt: z.string().datetime().optional(),
	roleIds: z.array(z.string()).optional(),
});
