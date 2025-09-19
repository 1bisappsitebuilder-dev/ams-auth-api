import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
	// Prisma Queries
	console.log("------------------------------------------\n\n\n\n\n");

	const user = await prisma.user.update({
		where: {
			id: "68cbaf1ba866e31b2d055be2"
		},
		data: {
			organization: {
				connect: {
					id: "68cb84108243224dd8d8b0c8"
				}
			}
		}
	});
	console.log(user);

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
