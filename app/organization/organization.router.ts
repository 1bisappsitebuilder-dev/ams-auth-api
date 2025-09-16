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
	const path = "/organization";

	/**
	 * @openapi
	 * /api/organization/{id}:
	 *   get:
	 *     summary: Get organization by id
	 *     description: Get organization by id with optional fields to include
	 *     tags: [Organization]
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
	 *         description: Comma-separated list of fields to include (e.g. users,apps,branding)
	 *     responses:
	 *       200:
	 *         description: Returns organization data
	 *       404:
	 *         description: Organization not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/organization:
	 *   get:
	 *     summary: Get all organizations
	 *     description: Get all organizations with pagination, sorting, and field selection
	 *     tags: [Organization]
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
	 *         description: Search query to filter results (by name, code, or description)
	 *     responses:
	 *       200:
	 *         description: Returns paginated organizations list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/organization:
	 *   post:
	 *     summary: Create a new organization
	 *     description: Creates a new organization or returns existing one if found with same name and code
	 *     tags: [Organization]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - name
	 *               - code
	 *             properties:
	 *               name:
	 *                 type: string
	 *               code:
	 *                 type: string
	 *               description:
	 *                 type: string
	 *               branding:
	 *                 type: object
	 *                 properties:
	 *                   logo:
	 *                     type: string
	 *                   background:
	 *                     type: string
	 *                   font:
	 *                     type: string
	 *                   colors:
	 *                     type: object
	 *                     properties:
	 *                       primary: { type: string }
	 *                       secondary: { type: string }
	 *                       accent: { type: string }
	 *                       success: { type: string }
	 *                       warning: { type: string }
	 *                       danger: { type: string }
	 *                       info: { type: string }
	 *                       light: { type: string }
	 *                       dark: { type: string }
	 *                       neutral: { type: string }
	 *     responses:
	 *       201:
	 *         description: Returns newly created organization
	 *       200:
	 *         description: Returns existing organization if found
	 *       400:
	 *         description: Missing required fields
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/organization/{id}:
	 *   patch:
	 *     summary: Update organization
	 *     description: Update organization data by id
	 *     tags: [Organization]
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
	 *               code: { type: string }
	 *               description: { type: string }
	 *               branding:
	 *                 type: object
	 *                 properties:
	 *                   logo: { type: string }
	 *                   background: { type: string }
	 *                   font: { type: string }
	 *                   colors:
	 *                     type: object
	 *                     properties:
	 *                       primary: { type: string }
	 *                       secondary: { type: string }
	 *                       accent: { type: string }
	 *                       success: { type: string }
	 *                       warning: { type: string }
	 *                       danger: { type: string }
	 *                       info: { type: string }
	 *                       light: { type: string }
	 *                       dark: { type: string }
	 *                       neutral: { type: string }
	 *     responses:
	 *       200:
	 *         description: Returns updated organization
	 *       404:
	 *         description: Organization not found
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/organization/{id}:
	 *   delete:
	 *     summary: Soft delete organization
	 *     description: Mark organization as deleted without permanently removing the data
	 *     tags: [Organization]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Organization marked as deleted successfully
	 *       404:
	 *         description: Organization not found
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);
	return route;
};
