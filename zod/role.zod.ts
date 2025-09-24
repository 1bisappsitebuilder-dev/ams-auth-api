import { z } from "zod";
const roleTypeEnum = z.enum(["system", "organization", "app"]);

export const RoleSchema = z.object({
	name: z.string().min(1, { message: "Role name is required" }),
	description: z.string().optional(),
	roleType: roleTypeEnum.default("organization"),
});
