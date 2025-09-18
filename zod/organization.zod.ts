import { z } from "zod";

const ColorsSchema = z.object({
	primary: z.string().optional(),
	secondary: z.string().optional(),
	accent: z.string().optional(),
	success: z.string().optional(),
	warning: z.string().optional(),
	danger: z.string().optional(),
	info: z.string().optional(),
	light: z.string().optional(),
	dark: z.string().optional(),
	neutral: z.string().optional(),
});

const BrandingSchema = z.object({
	logo: z.string().optional(),
	background: z.string().optional(),
	font: z.string().optional(),
	colors: ColorsSchema.optional(),
});

export const OrganizationSchema = z.object({
	name: z.string().nonempty("Organization name is required"),
	code: z.string().nonempty("Organization code is required"),
	description: z.string().optional(),
	branding: BrandingSchema.optional(),
	createdAt: z.string().datetime().optional(),
	updatedAt: z.string().datetime().optional(),
	deletedAt: z.string().datetime().optional(),
});
