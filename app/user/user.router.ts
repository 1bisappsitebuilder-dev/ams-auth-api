import { Router, Request, Response, NextFunction } from "express";
import { uploadUserFiles } from "../../middleware/upload";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/user";

	/**
	 * @openapi
	 * /api/user/current:
	 *   get:
	 *     summary: Get current user
	 *     description: Get the current authenticated user's information
	 *     tags: [User]
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: Returns current user data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 email:
	 *                   type: string
	 *                 userName:
	 *                   type: string
	 *                 role:
	 *                   type: string
	 *                 subRole:
	 *                   type: string
	 *                 status:
	 *                   type: string
	 *                 person:
	 *                   type: object
	 *                 organization:
	 *                   type: object
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: User not found
	 */
	routes.get("/current", controller.getCurrentUser);

	/**
	 * @openapi
	 * /api/user:
	 *   post:
	 *     summary: Create new user with avatar upload
	 *     description: Create a new user with person data and optional avatar image upload. firstName and lastName must be inside personalInfo object.
	 *     tags: [User]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *               - personalInfo
	 *               - role
	 *               - userName
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 description: User email address
	 *               password:
	 *                 type: string
	 *                 description: User password (minimum 8 characters, optional)
	 *               userName:
	 *                 type: string
	 *                 description: Username
	 *               role:
	 *                 type: string
	 *                 description: User role
	 *               subRole:
	 *                 type: string
	 *                 description: User sub role
	 *               organizationId:
	 *                 type: string
	 *                 description: Organization ID (24-character MongoDB ObjectId)
	 *               avatar:
	 *                 type: string
	 *                 format: binary
	 *                 description: Avatar image file (uploads to Cloudinary)
	 *               folder:
	 *                 type: string
	 *                 description: Cloudinary folder for avatar
	 *                 default: avatars
	 *               personalInfo:
	 *                 type: object
	 *                 description: Personal information (must include firstName and lastName)
	 *                 required:
	 *                   - firstName
	 *                   - lastName
	 *                 properties:
	 *                   firstName:
	 *                     type: string
	 *                     description: First name
	 *                   lastName:
	 *                     type: string
	 *                     description: Last name
	 *               contactInfo:
	 *                 type: object
	 *                 description: Contact information
	 *               identification:
	 *                 type: object
	 *                 description: Identification information
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *               - personalInfo
	 *               - role
	 *               - userName
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 description: User email address
	 *               password:
	 *                 type: string
	 *                 description: User password (minimum 8 characters, optional)
	 *               userName:
	 *                 type: string
	 *                 description: Username
	 *               role:
	 *                 type: string
	 *                 description: User role
	 *               subRole:
	 *                 type: string
	 *                 description: User sub role
	 *               organizationId:
	 *                 type: string
	 *                 description: Organization ID (24-character MongoDB ObjectId)
	 *               avatar:
	 *                 type: string
	 *                 description: Avatar URL (for direct URL updates)
	 *               personalInfo:
	 *                 type: object
	 *                 description: Personal information (must include firstName and lastName)
	 *                 required:
	 *                   - firstName
	 *                   - lastName
	 *                 properties:
	 *                   firstName:
	 *                     type: string
	 *                     description: First name
	 *                   lastName:
	 *                     type: string
	 *                     description: Last name
	 *               contactInfo:
	 *                 type: object
	 *                 description: Contact information
	 *               identification:
	 *                 type: object
	 *                 description: Identification information
	 *     responses:
	 *       201:
	 *         description: User created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                 user:
	 *                   type: object
	 *       400:
	 *         description: Bad request - validation error
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", uploadUserFiles, controller.create);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   get:
	 *     summary: Get user by id
	 *     description: Get user by id with optional select, sort, limit, and populate parameters
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: select
	 *         schema:
	 *           type: string
	 *         description: JSON string of fields to select
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: JSON string of sort criteria
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Number of records to return (default 10)
	 *       - in: query
	 *         name: populate
	 *         schema:
	 *           type: string
	 *         description: JSON string of relations to populate
	 *     responses:
	 *       200:
	 *         description: Returns user data
	 *       404:
	 *         description: User not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/user:
	 *   get:
	 *     summary: Get all users
	 *     description: Get all users with pagination, select, sort, limit, and populate options
	 *     tags: [User]
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
	 *         name: select
	 *         schema:
	 *           type: string
	 *         description: JSON string of fields to select
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: JSON string of sort criteria
	 *       - in: query
	 *         name: populate
	 *         schema:
	 *           type: string
	 *         description: JSON string of relations to populate
	 *     responses:
	 *       200:
	 *         description: Returns paginated users list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   patch:
	 *     summary: Update user with avatar upload
	 *     description: Update user data by id with optional avatar image upload
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 description: User email address
	 *               userName:
	 *                 type: string
	 *                 description: User name
	 *               password:
	 *                 type: string
	 *                 description: User password
	 *               role:
	 *                 type: string
	 *                 description: User role
	 *               subRole:
	 *                 type: string
	 *                 description: User sub role
	 *               status:
	 *                 type: string
	 *                 description: User status
	 *               organizationId:
	 *                 type: string
	 *                 description: Organization ID
	 *               avatar:
	 *                 type: string
	 *                 format: binary
	 *                 description: Avatar image file (uploads to Cloudinary)
	 *               folder:
	 *                 type: string
	 *                 description: Cloudinary folder for avatar
	 *                 default: avatars
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               email:
	 *                 type: string
	 *               userName:
	 *                 type: string
	 *               password:
	 *                 type: string
	 *               role:
	 *                 type: string
	 *               subRole:
	 *                 type: string
	 *               status:
	 *                 type: string
	 *               organizationId:
	 *                 type: string
	 *               avatar:
	 *                 type: string
	 *                 description: Avatar URL (for direct URL updates)
	 *     responses:
	 *       200:
	 *         description: Returns updated user with avatar URL
	 *       404:
	 *         description: User not found
	 */
	routes.patch("/:id", uploadUserFiles, controller.update);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   put:
	 *     summary: Soft delete user
	 *     description: Mark user as deleted without permanently removing the data
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: User marked as deleted successfully
	 *       404:
	 *         description: User not found
	 */
	routes.put("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
