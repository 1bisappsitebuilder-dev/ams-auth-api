import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { PrismaClient } from "./generated/prisma";
import { config } from "./config/config";
import openApiSpecs from "./docs/openApiSpecs";
import verifyToken from "./middleware/verifyToken";
import { connectDb } from "./config/database";

process.setMaxListeners(50);

const app = express();
const prisma = new PrismaClient();

const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: config.cors.origins,
		credentials: config.cors.credentials,
	},
});

app.use((req: Request, res: Response, next: NextFunction) => {
	(req as any).io = io;
	next();
});
const auth = require("./app/auth")(prisma);
const organization = require("./app/organization")(prisma);
const user = require("./app/user")(prisma);
const person = require("./app/person")(prisma);
const images = require("./app/images")(prisma);
const role = require("./app/role")(prisma);
const accessPolicy = require("./app/access-policy")(prisma);
const permission = require("./app/permission")(prisma);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure CORS
app.use(
	cors({
		origin: config.cors.origins,
		credentials: config.cors.credentials,
	}),
);

// Set up routes that don't need authentication
if (process.env.NODE_ENV !== "production") {
	app.use(`${config.baseApiPath}/docs`, swaggerUi.serve, swaggerUi.setup(openApiSpecs()));
}

// Apply middleware for protected routes, excluding /docs and /auth
app.use(config.baseApiPath, auth);
app.use(config.baseApiPath, user);
app.use(config.baseApiPath, organization);
app.use(config.baseApiPath, person);
app.use(`${config.baseApiPath}/images`, images);
app.use(config.baseApiPath, role);
app.use(config.baseApiPath, accessPolicy);
app.use(config.baseApiPath, permission);

// Set up routes that don't need authentication
app.use(config.baseApiPath, (req: Request, res: Response, next: NextFunction) => {
	if (req.path.startsWith("/docs")) {
		// Skip middleware for the docs, auth, and add IC card routes
		return next();
	}
	verifyToken(req, res, () => {
		next();
	});
});



server.listen(config.port, async () => {
	await connectDb();
	console.log(`Server is running on port ${config.port}`);
});
