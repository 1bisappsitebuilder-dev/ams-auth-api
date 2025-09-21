import z from "zod";
// Define Zod schema for App validation
export const AppSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	icon: z.string().optional(),
	code: z.string().min(1, "Code is required"),
	withModule: z.boolean().default(true),
});
