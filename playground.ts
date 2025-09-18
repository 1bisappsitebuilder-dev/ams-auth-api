import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
	// Prisma Queries
	console.log("------------------------------------------\n\n\n\n\n");

	const role = await prisma.role.findMany();
	console.log(role);

	console.log("\n\n\n\n\n------------------------------------------");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		// process.exit(1);
	});
