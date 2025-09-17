import { Router, Request, Response, NextFunction } from "express";

interface IAccessPolicyController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	assignRole(req: Request, res: Response, next: NextFunction): Promise<void>;
	removeRole(req: Request, res: Response, next: NextFunction): Promise<void>;
	updateRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void>;
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

	/**
	 * @openapi
	 * /api/access-policy/{id}/roles:
	 *   post:
	 *     summary: Assign role to access policy
	 *     description: Assign a role to an access policy with specific permissions
	 *     tags: [AccessPolicy]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - roleId
	 *               - permissions
	 *             properties:
	 *               roleId:
	 *                 type: string
	 *               permissions:
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
	 *       201:
	 *         description: Role assigned to access policy successfully
	 *       404:
	 *         description: Access policy or role not found
	 *       409:
	 *         description: Role already assigned to this access policy
	 */
	routes.post("/:id/roles", controller.assignRole);

	/**
	 * @openapi
	 * /api/access-policy/{id}/roles/{roleId}:
	 *   delete:
	 *     summary: Remove role from access policy
	 *     description: Remove a role assignment from an access policy
	 *     tags: [AccessPolicy]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: roleId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Role removed from access policy successfully
	 *       404:
	 *         description: Role assignment not found
	 */
	routes.delete("/:id/roles/:roleId", controller.removeRole);

	/**
	 * @openapi
	 * /api/access-policy/{id}/roles/{roleId}/permissions:
	 *   patch:
	 *     summary: Update role permissions in access policy
	 *     description: Update permissions for a role within an access policy
	 *     tags: [AccessPolicy]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: roleId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - permissions
	 *             properties:
	 *               permissions:
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
	 *         description: Role permissions updated successfully
	 *       404:
	 *         description: Role assignment not found
	 */
	routes.patch("/:id/roles/:roleId/permissions", controller.updateRolePermissions);

	route.use(path, routes);
	return route;
};
