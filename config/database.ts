import { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";

const prisma = new PrismaClient();
const logger = getLogger();

export async function connectDb() {
	try {
		await prisma.$connect();
		logger.info("Connected to the database successfully.");
	} catch (error) {
		logger.error("Error connecting to the database:", {
			error,
			stack: error instanceof Error ? error.stack : undefined,
		});
		process.exit(1);
	}
}
