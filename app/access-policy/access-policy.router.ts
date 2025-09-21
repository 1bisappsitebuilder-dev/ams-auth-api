import { Router, Request, Response, NextFunction } from "express";

interface IAccessPolicyController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IAccessPolicyController): Router => {
	const routes = Router();
	const path = "/access-policy";

	/**
	 * @openapi
	 * /api/access-policy/{id}:
	 *   get:
	 *     summary: Get access policy by id
	 *     description: Retrieve access policy information by id with optional fields and role inclusion
	 *     tags: [AccessPolicy]
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
	 *       - in: query
	 *         name: includeRoles
	 *         schema:
	 *           type: boolean
	 *         description: Whether to include assigned roles
	 *     responses:
	 *       200:
	 *         description: Returns access policy data
	 *       404:
	 *         description: Access policy not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/access-policy:
	 *   get:
	 *     summary: Get all access policies
	 *     description: Retrieve all access policies with pagination, sorting, and optional field selection
	 *     tags: [AccessPolicy]
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
	 *         description: Search query to filter policies (by name or description)
	 *       - in: query
	 *         name: includeRoles
	 *         schema:
	 *           type: boolean
	 *         description: Whether to include assigned roles
	 *     responses:
	 *       200:
	 *         description: Returns paginated access policies list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/access-policy:
	 *   post:
	 *     summary: Create a new access policy
	 *     description: Creates a new access policy
	 *     tags: [AccessPolicy]
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
	 *         description: Returns newly created access policy
	 *       409:
	 *         description: Access policy with this name already exists
	 *       400:
	 *         description: Missing required fields
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/access-policy/{id}:
	 *   patch:
	 *     summary: Update access policy
	 *     description: Update access policy data by id
	 *     tags: [AccessPolicy]
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
	 *         description: Returns updated access policy
	 *       404:
	 *         description: Access policy not found
	 *       409:
	 *         description: Access policy with this name already exists
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/access-policy/{id}:
	 *   delete:
	 *     summary: Delete access policy
	 *     description: Permanently delete an access policy (cannot be deleted if roles are assigned)
	 *     tags: [AccessPolicy]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Access policy deleted successfully
	 *       404:
	 *         description: Access policy not found
	 *       409:
	 *         description: Cannot delete access policy with assigned roles
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);
	return route;
};
