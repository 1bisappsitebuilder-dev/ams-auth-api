import { Router, Request, Response, NextFunction } from "express";

interface IController {
	register(req: Request, res: Response, next: NextFunction): Promise<void>;
	login(req: Request, res: Response, next: NextFunction): Promise<void>;
	logout(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/auth";

	/**
	 * @openapi
	 * /api/auth/register:
	 *   post:
	 *     summary: Register
	 *     description: Register a new user
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/User'
	 *     responses:
	 *       200:
	 *         description: Returns the registered user.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/User'
	 */
	routes.post("/register", controller.register);

	/**
	 * @openapi
	 * /api/auth/login:
	 *   post:
	 *     summary: Login
	 *     description: Login a user
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/User'
	 *     responses:
	 *       200:
	 *         description: Returns the logged in user.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/User'
	 */
	routes.post("/login", controller.login);

	/**
	 * @openapi
	 * /api/auth/logout:
	 *   post:
	 *     summary: Logout
	 *     description: Logout a user and clear JWT token
	 *     tags: [Auth]
	 *     responses:
	 *       200:
	 *         description: Successfully logged out.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 */
	routes.post("/logout", controller.logout);

	route.use(path, routes);

	return route;
};
