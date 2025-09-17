import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/role";

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   get:
	 *     summary: Get role by id
	 *     description: Retrieve role information by id with optional fields
	 *     tags: [Role]
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
	 *         description: Returns role data
	 *       404:
	 *         description: Role not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/role:
	 *   get:
	 *     summary: Get all roles
	 *     description: Retrieve all roles with pagination, sorting, and optional field selection
	 *     tags: [Role]
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
	 *         description: Search query to filter roles (by name or description)
	 *     responses:
	 *       200:
	 *         description: Returns paginated roles list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/role:
	 *   post:
	 *     summary: Create a new role
	 *     description: Creates a new role or returns existing one if same name exists
	 *     tags: [Role]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - name
	 *             properties:
	 *               name:
	 *                 type: string
	 *               description:
	 *                 type: string
	 *     responses:
	 *       201:
	 *         description: Returns newly created role
	 *       200:
	 *         description: Returns existing role if found
	 *       400:
	 *         description: Missing required fields
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   patch:
	 *     summary: Update role
	 *     description: Update role data by id
	 *     tags: [Role]
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
	 *               name: { type: string }
	 *               description: { type: string }
	 *     responses:
	 *       200:
	 *         description: Returns updated role
	 *       404:
	 *         description: Role not found
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   delete:
	 *     summary: Soft delete role
	 *     description: Mark role as deleted without permanently removing the data
	 *     tags: [Role]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Role marked as deleted successfully
	 *       404:
	 *         description: Role not found
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);
	return route;
};
