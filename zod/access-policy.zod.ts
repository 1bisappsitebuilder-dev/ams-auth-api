import { z } from "zod";

export const ResourceEnum = z.enum(["organization", "user", "role", "app", "module"]);
export const ActionEnum = z.enum(["create", "read", "update", "delete"]);

export const RolePermissionSchema = z.object({
	resource: ResourceEnum,
	actions: z.array(ActionEnum),
});

export const AccessPolicySchema = z.object({
	name: z.string().nonempty("Name is required"),
	description: z.string(),
	rolePermissions: z
		.array(
			z.object({
				roleId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
				rolePermissions: z.array(RolePermissionSchema).optional(),
			}),
		)
		.optional(),
});
