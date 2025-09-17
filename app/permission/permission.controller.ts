import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";

const logger = getLogger();
const permissionLogger = logger.child({ module: "permission" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.PERMISSION.POPULATE_MUST_BE_STRING });
			return;
		}

		permissionLogger.info(`${config.SUCCESS.PERMISSION.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.PermissionFindFirstArgs = {
				where: {
					id,
				},
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				query.select = fieldSelections;
			}

			const permission = await prisma.permission.findFirst(query);

			if (!permission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERMISSION.NOT_FOUND });
				return;
			}

			permissionLogger.info(`${config.SUCCESS.PERMISSION.RETRIEVED}: ${permission.id}`);
			res.status(200).json(permission);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			page = 1,
			limit = 10,
			sort,
			fields,
			accessPolicyId,
			roleId,
			order = "desc",
		} = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.PERMISSION.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.PERMISSION.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.PERMISSION.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.PERMISSION.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					permissionLogger.error(`${config.ERROR.PERMISSION.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.PERMISSION.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		permissionLogger.info(
			`${config.SUCCESS.PERMISSION.GETTING_ALL}, page: ${page}, limit: ${limit}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.PermissionWhereInput = {
				...(accessPolicyId ? { accessPolicyId: String(accessPolicyId) } : {}),
				...(roleId ? { roleId: String(roleId) } : {}),
			};

			const findManyQuery: Prisma.PermissionFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { id: order as Prisma.SortOrder },
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				findManyQuery.select = fieldSelections;
			}

			const [permissions, total] = await Promise.all([
				prisma.permission.findMany(findManyQuery),
				prisma.permission.count({ where: whereClause }),
			]);

			permissionLogger.info(`Retrieved ${permissions.length} permissions`);
			res.status(200).json({
				permissions,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { accessPolicyId, roleId, rolePermissions } = req.body;

		if (!accessPolicyId || !roleId) {
			permissionLogger.error(config.ERROR.PERMISSION.INVALID_INPUT);
			res.status(400).json({ error: "Access Policy ID and Role ID are required" });
			return;
		}

		try {
			// Check if the access policy exists
			const accessPolicy = await prisma.accessPolicy.findUnique({
				where: { id: accessPolicyId },
			});

			if (!accessPolicy) {
				permissionLogger.error(
					`${config.ERROR.ACCESS_POLICY.NOT_FOUND}: ${accessPolicyId}`,
				);
				res.status(404).json({ error: config.ERROR.ACCESS_POLICY.NOT_FOUND });
				return;
			}

			// Check if the role exists and is not deleted
			const role = await prisma.role.findFirst({
				where: {
					id: roleId,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			});

			if (!role) {
				permissionLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${roleId}`);
				res.status(404).json({ error: config.ERROR.ROLE.NOT_FOUND });
				return;
			}

			// Check if permission already exists for this access policy and role
			const existingPermission = await prisma.permission.findFirst({
				where: {
					accessPolicyId,
					roleId,
				},
			});

			if (existingPermission) {
				permissionLogger.info(
					`${config.SUCCESS.PERMISSION.RETRIEVED}: ${existingPermission.id}`,
				);
				res.status(200).json({
					...existingPermission,
					message: "Existing permission found",
				});
				return;
			}

			const newPermission = await prisma.permission.create({
				data: {
					accessPolicyId,
					roleId,
					rolePermissions: rolePermissions || [],
				},
				include: {
					accessPolicy: true,
					role: true,
				},
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.CREATED}: ${newPermission.id}`);
			res.status(201).json(newPermission);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { rolePermissions } = req.body;

		if (!id) {
			permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			permissionLogger.error(config.ERROR.PERMISSION.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.PERMISSION.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		permissionLogger.info(`Updating permission: ${id}`);

		try {
			const existingPermission = await prisma.permission.findUnique({
				where: { id },
			});

			if (!existingPermission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERMISSION.NOT_FOUND });
				return;
			}

			const updatedPermission = await prisma.permission.update({
				where: { id },
				data: {
					...(rolePermissions && { rolePermissions }),
				},
				include: {
					accessPolicy: true,
					role: true,
				},
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.UPDATE}: ${updatedPermission.id}`);
			res.status(200).json(updatedPermission);
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_UPDATING}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			permissionLogger.error(config.ERROR.PERMISSION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERMISSION.PERMISSION_ID_REQUIRED });
			return;
		}

		permissionLogger.info(`${config.SUCCESS.PERMISSION.DELETING}: ${id}`);

		try {
			const existingPermission = await prisma.permission.findUnique({
				where: { id },
			});

			if (!existingPermission) {
				permissionLogger.error(`${config.ERROR.PERMISSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERMISSION.NOT_FOUND });
				return;
			}

			await prisma.permission.delete({
				where: { id },
			});

			permissionLogger.info(`${config.SUCCESS.PERMISSION.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.PERMISSION.DELETED });
		} catch (error) {
			permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_DELETING}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
		}
	};

	// Specialized method to check if a role has specific permissions
	// const checkPermissions = async (req: Request, res: Response, _next: NextFunction) => {
	// 	const { roleId, resource, action } = req.query;

	// 	if (!roleId || !resource || !action) {
	// 		permissionLogger.error(config.ERROR.PERMISSION.MISSING_PARAMS);
	// 		res.status(400).json({
	// 			error: "Role ID, Resource, and Action parameters are required",
	// 		});
	// 		return;
	// 	}

	// 	try {
	// 		// Find all permissions for this role
	// 		const permissions = await prisma.permission.findMany({
	// 			where: { roleId: String(roleId) },
	// 			include: {
	// 				accessPolicy: true,
	// 			},
	// 		});

	// 		// Check if any permission grants the requested action on the resource
	// 		const hasPermission = permissions.some((permission) =>
	// 			permission.rolePermissions.some(
	// 				(rp) => rp.resource === resource && rp.actions.includes(action as Action),
	// 			),
	// 		);

	// 		res.status(200).json({
	// 			hasPermission,
	// 			roleId,
	// 			resource,
	// 			action,
	// 		});
	// 	} catch (error) {
	// 		permissionLogger.error(`${config.ERROR.PERMISSION.ERROR_CHECKING}: ${error}`);
	// 		res.status(500).json({ error: config.ERROR.PERMISSION.INTERNAL_SERVER_ERROR });
	// 	}
	// };

	return {
		getById,
		getAll,
		create,
		update,
		remove,
		// checkPermissions,
	};
};
