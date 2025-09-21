import { Router, Request, Response, NextFunction } from "express";

interface IAppController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IAppController): Router => {
	const routes = Router();
	const path = "/app";

	/**
	 * @openapi
	 * /api/app/{id}:
	 *   get:
	 *     summary: Get app by id
	 *     description: Retrieve app information by id with optional fields
	 *     tags: [App]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Returns app data
	 *       404:
	 *         description: App not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/app:
	 *   get:
	 *     summary: Get all apps
	 *     description: Retrieve all apps with pagination, sorting, filtering and optional field selection
	 *     tags: [App]
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *         description: Page number (default 1)
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Records per page (default 10)
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: Field to sort by
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *         description: Sort order (default desc)
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by name, description, or code
	 *     responses:
	 *       200:
	 *         description: Returns paginated apps list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/app:
	 *   post:
	 *     summary: Create a new app
	 *     description: Creates a new app with the provided details
	 *     tags: [App]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - name
	 *               - description
	 *               - code
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 description: Name of the app
	 *               description:
	 *                 type: string
	 *                 description: Description of the app
	 *               icon:
	 *                 type: string
	 *                 description: Optional icon URL for the app
	 *               code:
	 *                 type: string
	 *                 description: Unique code for the app
	 *               withModule:
	 *                 type: boolean
	 *                 description: Indicates if the app includes modules
	 *                 default: true
	 *     responses:
	 *       201:
	 *         description: Returns newly created app
	 *       200:
	 *         description: Returns existing app if found
	 *       400:
	 *         description: Missing required fields
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/app/{id}:
	 *   patch:
	 *     summary: Update app
	 *     description: Update app data by id
	 *     tags: [App]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 description: Name of the app
	 *               description:
	 *                 type: string
	 *                 description: Description of the app
	 *               icon:
	 *                 type: string
	 *                 description: Optional icon URL for the app
	 *               code:
	 *                 type: string
	 *                 description: Unique code for the app
	 *               withModule:
	 *                 type: boolean
	 *                 description: Indicates if the app includes modules
	 *     responses:
	 *       200:
	 *         description: Returns updated app
	 *       404:
	 *         description: App not found
	 *       400:
	 *         description: Invalid input or no fields provided
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/app/{id}:
	 *   delete:
	 *     summary: Delete app
	 *     description: Soft delete an app by setting isDeleted to true
	 *     tags: [App]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: App deleted successfully
	 *       404:
	 *         description: App not found
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);
	return route;
};
