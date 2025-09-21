import { z } from "zod";
import { GenderType, IdentificationType, PhoneType, Status } from "../generated/prisma";

// Phone schema
const PhoneSchema = z.object({
	type: z.nativeEnum(PhoneType).optional(),
	countryCode: z.string().optional(),
	number: z.string().optional(),
	isPrimary: z.boolean().optional(),
});

// ContactAddress schema
const ContactAddressSchema = z.object({
	street: z.string().optional(),
	address2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	country: z.string().optional(),
	postalCode: z.string().optional(),
	zipCode: z.string().optional(),
	houseNumber: z.string().optional(),
});

// ContactInfo schema
const ContactInfoSchema = z.object({
	email: z.string().email().optional().or(z.literal("")),
	phones: z.array(PhoneSchema).optional(),
	fax: z.string().optional(),
	address: ContactAddressSchema.optional(),
});

// Identification schema
const IdentificationSchema = z.object({
	type: z.nativeEnum(IdentificationType).optional(),
	number: z.string().optional(),
	issuingCountry: z.string().optional(),
	expiryDate: z.date().optional().or(z.string().optional()),
});

// Main registration schema
export const RegisterSchema = z.object({
	// User fields
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters long"),
	userName: z.string().min(1, "Username is required"),
	organizationId: z.string().optional(),
	avatar: z.string().optional(),
	status: z.nativeEnum(Status).default(Status.active),
	loginMethod: z.string().default("email"),

	//connect user to existing roles
	roleIds: z.array(z.string()).optional(),

	// Person fields
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	prefix: z.string().optional(),
	middleName: z.string().optional(),
	dateOfBirth: z
		.date()
		.optional()
		.or(z.string().transform((val) => (val ? new Date(val) : undefined))),
	placeOfBirth: z.string().optional(),
	age: z.number().int().positive().optional(),
	nationality: z.string().optional(),
	primaryLanguage: z.string().optional(),
	gender: z.nativeEnum(GenderType).optional(),
	currency: z.string().optional(),
	vipCode: z.string().optional(),

	// Composite fields
	contactInfo: ContactInfoSchema.optional(),
	identification: IdentificationSchema.optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

//login
export const LoginSchema = z.object({
	identifier: z.string().min(1, "Username or email is required"),
	password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Zod schema for updatePassword
export const UpdatePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
