import dotenv from "dotenv";

dotenv.config();

export const config = {
	port: process.env.PORT || 3000,
	baseApiPath: "/api",
	betterStackSourceToken: process.env.BETTER_STACK_SOURCE_TOKEN || "",
	betterStackHost: process.env.BETTER_STACK_HOST || "",
	cors: {
		origins: process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
			: ["http://localhost:3000"],
		credentials: process.env.CORS_CREDENTIALS === "true",
	},
	cloudinary: {
		cloudName: process.env.CLOUDINARY_CLOUD_NAME,
		apiKey: process.env.CLOUDINARY_API_KEY,
		apiSecret: process.env.CLOUDINARY_API_SECRET,
	},
	cardEncoder: {
		apiUrl: process.env.CARD_ENCODER_API_URL || "http://localhost:8080",
	},
};
