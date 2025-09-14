import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { controller } from "./role.controller";
import verifyToken from "../../middleware/verifyToken";

interface IController {
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/role";

	/**
	 * @openapi
	 * components:
	 *   schemas:
	 *     UserRole:
	 *       type: object
	 *       properties:
	 *         id:
	 *           type: string
	 *           description: The auto-generated id of the role
	 *         name:
	 *           type: string
	 *           description: The name of the role
	 *         description:
	 *           type: string
	 *           description: Description of the role (optional)
	 *         createdAt:
	 *           type: string
	 *           format: date-time
	 *         updatedAt:
	 *           type: string
	 *           format: date-time
	 *     CreateUserRole:
	 *       type: object
	 *       required:
	 *         - name
	 *       properties:
	 *         name:
	 *           type: string
	 *           description: The name of the role
	 *         description:
	 *           type: string
	 *           description: Description of the role (optional)
	 *     UpdateUserRole:
	 *       type: object
	 *       properties:
	 *         name:
	 *           type: string
	 *           description: The name of the role
	 *         description:
	 *           type: string
	 *           description: Description of the role
	 */

	/**
	 * @openapi
	 * /api/role:
	 *   get:
	 *     summary: Retrieve a list of roles
	 *     tags: [Role]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           default: 1
	 *         description: Page number for pagination
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           default: 10
	 *           maximum: 100
	 *         description: Number of items per page
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
	 *           default: desc
	 *         description: Sort order
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query string
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects
	 *     responses:
	 *       200:
	 *         description: List of roles retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: success
	 *                 message:
	 *                   type: string
	 *                   example: Roles retrieved successfully
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/UserRole'
	 *                 pagination:
	 *                   type: object
	 *                   properties:
	 *                     page:
	 *                       type: integer
	 *                     limit:
	 *                       type: integer
	 *                     totalCount:
	 *                       type: integer
	 *                     totalPages:
	 *                       type: integer
	 *                     hasNextPage:
	 *                       type: boolean
	 *                     hasPrevPage:
	 *                       type: boolean
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", verifyToken, controller.getAll);

	/**
	 * @openapi
	 * /api/role:
	 *   post:
	 *     summary: Create a new role
	 *     tags: [Role]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/CreateUserRole'
	 *     responses:
	 *       201:
	 *         description: Role created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: success
	 *                 message:
	 *                   type: string
	 *                   example: Role created successfully
	 *                 data:
	 *                   $ref: '#/components/schemas/UserRole'
	 *       400:
	 *         description: Validation error
	 *       409:
	 *         description: Role with this name already exists
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", verifyToken, controller.create);

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   get:
	 *     summary: Get a role by ID
	 *     tags: [Role]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The role ID
	 *     responses:
	 *       200:
	 *         description: Role retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: success
	 *                 message:
	 *                   type: string
	 *                   example: Role retrieved successfully
	 *                 data:
	 *                   $ref: '#/components/schemas/UserRole'
	 *       400:
	 *         description: Invalid role ID format
	 *       404:
	 *         description: Role not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", verifyToken, controller.getById);

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   put:
	 *     summary: Update a role
	 *     tags: [Role]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The role ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/UpdateUserRole'
	 *     responses:
	 *       200:
	 *         description: Role updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: success
	 *                 message:
	 *                   type: string
	 *                   example: Role updated successfully
	 *                 data:
	 *                   $ref: '#/components/schemas/UserRole'
	 *       400:
	 *         description: Validation error or invalid role ID format
	 *       404:
	 *         description: Role not found
	 *       409:
	 *         description: Role with this name already exists
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", verifyToken, controller.update);

	/**
	 * @openapi
	 * /api/role/{id}:
	 *   delete:
	 *     summary: Delete a role
	 *     tags: [Role]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The role ID
	 *     responses:
	 *       200:
	 *         description: Role deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: success
	 *                 message:
	 *                   type: string
	 *                   example: Role deleted successfully
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     id:
	 *                       type: string
	 *       400:
	 *         description: Invalid role ID format
	 *       404:
	 *         description: Role not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", verifyToken, controller.remove);

	route.use(path, routes);
	return route;
};
