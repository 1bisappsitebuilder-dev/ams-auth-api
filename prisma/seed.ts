import { PrismaClient } from "../generated/prisma";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
	console.log("Starting database seeding...");

	// Create Ancorland organization
	const ancorlandOrg = await prisma.organization.upsert({
		where: { id: "68412c97c0c093fb4f0b0a11" },
		update: {},
		create: {
			id: "68412c97c0c093fb4f0b0a11",
			name: "ACL",
			description: "Ancorland Organization",
			code: "ANCORLAND",
			branding: {
				logo: "https://example.com/ancorland-logo.png",
				colors: {
					primary: "#2563eb",
					secondary: "#64748b",
				},
			},
		},
	});

	console.log("Ancorland organization created:", ancorlandOrg.name);

	// Create person for Ancorland frontdesk admin
	const ancorlandPerson = await prisma.person.upsert({
		where: { id: "68412c97c0c093fb4f0b0a12" },
		update: {},
		create: {
			id: "68412c97c0c093fb4f0b0a12",
			personalInfo: {
				firstName: "Front",
				lastName: "Desk",
				age: 28,
				nationality: "US",
				primaryLanguage: "English",
				gender: "female",
			},
			contactInfo: {
				email: "acl-frontdesk-admin@domain.com",
				phones: [
					{
						type: "mobile",
						countryCode: "+1",
						number: "5551234567",
						isPrimary: true,
					},
				],
				address: {
					street: "456 Hotel Ave",
					city: "Miami",
					state: "FL",
					country: "USA",
					postalCode: "33101",
				},
			},
			metadata: {
				isActive: true,
				status: "active",
				isDeleted: false,
			},
		},
	});

	console.log(
		"Ancorland person created:",
		ancorlandPerson.personalInfo?.firstName,
		ancorlandPerson.personalInfo?.lastName,
	);

	// Hash password for Ancorland user
	const ancorlandHashedPassword = await argon2.hash("Test123!");

	// Create Ancorland frontdesk admin user
	const ancorlandUser = await prisma.user.upsert({
		where: { id: "68412c97c0c093fb4f0b0a13" },
		update: {},
		create: {
			id: "68412c97c0c093fb4f0b0a13",
			email: "acl-frontdesk-admin@domain.com",
			userName: "ancorland.frontdesk",
			password: ancorlandHashedPassword,
			role: "hms_frontdesk_admin",
			subRole: "staff",
			status: "active",
			loginMethod: "email",
			personId: ancorlandPerson.id,
			organizationId: ancorlandOrg.id,
		},
	});

	console.log("Ancorland frontdesk admin created:", ancorlandUser.email);

	// Create person for Security Admin
	const securityPerson = await prisma.person.upsert({
		where: { id: "68412c97c0c093fb4f0b0a14" },
		update: {},
		create: {
			id: "68412c97c0c093fb4f0b0a14",
			personalInfo: {
				firstName: "Security",
				lastName: "Admin",
				age: 32,
				nationality: "US",
				primaryLanguage: "English",
				gender: "male",
			},
			contactInfo: {
				email: "acl-security-admin@domain.com",
				phones: [
					{
						type: "mobile",
						countryCode: "+1",
						number: "5551234568",
						isPrimary: true,
					},
				],
				address: {
					street: "456 Hotel Ave",
					city: "Miami",
					state: "FL",
					country: "USA",
					postalCode: "33101",
				},
			},
			metadata: {
				isActive: true,
				status: "active",
				isDeleted: false,
			},
		},
	});

	console.log(
		"Security person created:",
		securityPerson.personalInfo?.firstName,
		securityPerson.personalInfo?.lastName,
	);

	// Hash password for Security user
	const securityHashedPassword = await argon2.hash("Test123!");

	// Create Security admin user
	const securityUser = await prisma.user.upsert({
		where: { id: "68412c97c0c093fb4f0b0a15" },
		update: {},
		create: {
			id: "68412c97c0c093fb4f0b0a15",
			email: "acl-security-admin@domain.com",
			userName: "ancorland.security",
			password: securityHashedPassword,
			role: "dms_hr_admin",
			subRole: "staff",
			status: "active",
			loginMethod: "email",
			personId: securityPerson.id,
			organizationId: ancorlandOrg.id,
		},
	});

	console.log("Ancorland security admin created:", securityUser.email);
	console.log("Seeding completed successfully!");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("Error during seeding:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
