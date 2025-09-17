import { Router, Request, Response, NextFunction } from "express";

interface IPermissionController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	// checkPermissions(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IPermissionController): Router => {
	const routes = Router();
	const path = "/permission";

	/**
	 * @openapi
	 * /api/permission/{id}:
	 *   get:
	 *     summary: Get permission by id
	 *     description: Retrieve permission information by id with optional fields
	 *     tags: [Permission]
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
	 *         description: Returns permission data
	 *       404:
	 *         description: Permission not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/permission:
	 *   get:
	 *     summary: Get all permissions
	 *     description: Retrieve all permissions with pagination, sorting, filtering and optional field selection
	 *     tags: [Permission]
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
	 *         name: accessPolicyId
	 *         schema:
	 *           type: string
	 *         description: Filter by access policy ID
	 *       - in: query
	 *         name: roleId
	 *         schema:
	 *           type: string
	 *         description: Filter by role ID
	 *     responses:
	 *       200:
	 *         description: Returns paginated permissions list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/permission/check:
	 *   get:
	 *     summary: Check role permissions
	 *     description: Check if a role has specific permissions for a resource and action
	 *     tags: [Permission]
	 *     parameters:
	 *       - in: query
	 *         name: roleId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Role ID to check permissions for
	 *       - in: query
	 *         name: resource
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [organization, user, role, app, module]
	 *         description: Resource to check access for
	 *       - in: query
	 *         name: action
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [create, read, update, delete]
	 *         description: Action to check permission for
	 *     responses:
	 *       200:
	 *         description: Returns permission check result
	 *       400:
	 *         description: Missing required parameters
	 */
	// routes.get("/check", controller.checkPermissions);

	/**
	 * @openapi
	 * /api/permission:
	 *   post:
	 *     summary: Create a new permission
	 *     description: Creates a new permission linking a role to an access policy with specific permissions
	 *     tags: [Permission]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - accessPolicyId
	 *               - roleId
	 *             properties:
	 *               accessPolicyId:
	 *                 type: string
	 *                 description: ID of the access policy
	 *               roleId:
	 *                 type: string
	 *                 description: ID of the role
	 *               rolePermissions:
	 *                 type: array
	 *                 items:
	 *                   type: object
	 *                   properties:
	 *                     resource:
	 *                       type: string
	 *                       enum: [organization, user, role, app, module]
	 *                     actions:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                         enum: [create, read, update, delete]
	 *                 description: Array of role permissions
	 *     responses:
	 *       201:
	 *         description: Returns newly created permission
	 *       200:
	 *         description: Returns existing permission if found
	 *       400:
	 *         description: Missing required fields
	 *       404:
	 *         description: Access policy or role not found
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/permission/{id}:
	 *   patch:
	 *     summary: Update permission
	 *     description: Update permission data by id (mainly rolePermissions)
	 *     tags: [Permission]
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
	 *               rolePermissions:
	 *                 type: array
	 *                 items:
	 *                   type: object
	 *                   properties:
	 *                     resource:
	 *                       type: string
	 *                       enum: [organization, user, role, app, module]
	 *                     actions:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                         enum: [create, read, update, delete]
	 *     responses:
	 *       200:
	 *         description: Returns updated permission
	 *       404:
	 *         description: Permission not found
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/permission/{id}:
	 *   delete:
	 *     summary: Delete permission
	 *     description: Permanently delete a permission
	 *     tags: [Permission]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Permission deleted successfully
	 *       404:
	 *         description: Permission not found
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);
	return route;
};
