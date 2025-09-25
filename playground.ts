import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
	// Prisma Queries
	console.log("------------------------------------------\n\n\n\n\n");

	const persons = await prisma.person.findMany({
		where: {
			contactInfo: {
				is: {
					email: "john.doe@example.com"
				}
			}
		}
	});
	console.log(JSON.stringify(persons, null, 2));

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
