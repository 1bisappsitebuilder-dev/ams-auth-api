import { z } from "zod";

// Zod Schemas for Person
const PhoneTypeEnum = z.enum([
	"mobile",
	"home",
	"work",
	"emergency",
	"fax",
	"pager",
	"main",
	"other",
]);
const IdentificationTypeEnum = z.enum([
	"passport",
	"drivers_license",
	"national_id",
	"postal_id",
	"voters_id",
	"senior_citizen_id",
	"company_id",
	"school_id",
]);
const GenderTypeEnum = z.enum([
	"male",
	"female",
	"other",
	"prefer_not_to_say",
	"unknown",
	"not_applicable",
]);

const PhoneSchema = z.object({
	type: PhoneTypeEnum.optional(),
	countryCode: z.string().optional(),
	number: z.string().optional(),
	isPrimary: z.boolean().optional(),
});

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

const ContactInfoSchema = z.object({
	email: z.string().email().optional(),
	phones: z.array(PhoneSchema).optional(),
	fax: z.string().optional(),
	address: ContactAddressSchema.optional(),
});

const IdentificationSchema = z.object({
	type: IdentificationTypeEnum.optional(),
	number: z.string().optional(),
	issuingCountry: z.string().optional(),
	expiryDate: z.string().datetime().optional(),
});

export const PersonSchema = z.object({
	organizationId: z.string().optional(),
	prefix: z.string().optional(),
	firstName: z.string().min(1, "First name is required"),
	middleName: z.string().optional(),
	lastName: z.string().min(1, "Last name is required"),
	dateOfBirth: z.string().datetime().optional(),
	placeOfBirth: z.string().optional(),
	age: z.number().int().positive().optional(),
	nationality: z.string().optional(),
	primaryLanguage: z.string().optional(),
	gender: GenderTypeEnum.optional(),
	currency: z.string().optional(),
	vipCode: z.string().optional(),
	contactInfo: ContactInfoSchema.optional(),
	identification: IdentificationSchema.optional(),
	isActive: z.boolean().optional().default(true),
	status: z.string().optional(),
	createdBy: z.string().optional(),
	updatedBy: z.string().optional(),
	lastLoginAt: z.string().datetime().optional(),
});
