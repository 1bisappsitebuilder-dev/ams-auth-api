import { z } from "zod";

export const PermissionSchema = z.object({
	accessPolicyId: z.string().nonempty("Access policy ID is required"),
	roleId: z.string().nonempty("Role ID is required"),
	rolePermissions: z
		.array(
			z.object({
				resource: z.enum(["organization", "user", "role", "app", "module"]),
				actions: z
					.array(z.enum(["create", "read", "update", "delete"]))
					.nonempty("At least one action is required"),
			}),
		)
		.nonempty("At least one role permission is required"),
	createdAt: z.string().datetime().optional(),
});
