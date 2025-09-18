import { z } from "zod";

export const RoleSchema = z.object({
	name: z.string().min(1, { message: "Role name is required" }),
	description: z.string().optional(),
});
