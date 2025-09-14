import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
	// Prisma Queries
	console.log("------------------------------------------\n\n\n\n\n");

	// const org = await prisma.organization.create({
	//     data: {
	//         name: "Zen Org",
	//         code: "ZEN",
	//     }
	// })

	const org = await prisma.organization.update({
        where: {
            id: "68c6750c3b00e20f3a5a9b2d"
        },
        data: {
            securityScheme: {
                connect: {
                    id: "68c67ae979e8d9fef909c818"
                }
            }
        }
    })
    console.log(org)

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
