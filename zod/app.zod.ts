import z from "zod";
import { StatusEnum } from "./user.zod";

export const AppSchema = z.object({
	id: z.string().optional(), // Prisma will auto-generate, so optional on input
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	icon: z.string().optional(),
	thumbnail: z.string().optional(),
	status: StatusEnum.default("active"), // match your Status enum
	version: z.string().optional(),
	code: z.string().min(1, "Code is required"),
	withModule: z.boolean().default(false),
});
