import { z } from "zod";

export const AccessPolicySchema = z.object({
	name: z.string().nonempty("Access policy name is required"),
	description: z.string().optional(),
});
