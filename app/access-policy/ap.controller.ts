import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";

const logger = getLogger();
const accessPolicyLogger = logger.child({ module: "accessPolicy" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields, includeRoles } = req.query;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			accessPolicyLogger.error("Invalid fields parameter");
			res.status(400).json({ error: "Fields must be a string" });
			return;
		}

		accessPolicyLogger.info(`Getting access policy by ID: ${id}`);

		try {
			const query: Prisma.AccessPolicyFindFirstArgs = {
				where: { id },
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

			// Include roles if requested
			if (includeRoles === "true") {
				query.include = {
					permissions: {
						include: {
							role: true,
						},
					},
				};
			}

			const accessPolicy = await prisma.accessPolicy.findFirst(query);

			if (!accessPolicy) {
				accessPolicyLogger.error(`Access policy not found: ${id}`);
				res.status(404).json({ error: "Access policy not found" });
				return;
			}

			accessPolicyLogger.info(`Retrieved access policy: ${accessPolicy.id}`);
			res.status(200).json(accessPolicy);
		} catch (error) {
			accessPolicyLogger.error(`Error getting access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			page = 1,
			limit = 10,
			sort,
			fields,
			query,
			order = "desc",
			includeRoles,
		} = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			accessPolicyLogger.error(`Invalid page: ${page}`);
			res.status(400).json({ error: "Invalid page number" });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			accessPolicyLogger.error(`Invalid limit: ${limit}`);
			res.status(400).json({ error: "Invalid limit" });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			accessPolicyLogger.error(`Invalid order: ${order}`);
			res.status(400).json({ error: "Order must be 'asc' or 'desc'" });
			return;
		}

		if (fields && typeof fields !== "string") {
			accessPolicyLogger.error(`Invalid fields parameter: ${fields}`);
			res.status(400).json({ error: "Fields must be a string" });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					accessPolicyLogger.error(`Invalid sort: ${sort}`);
					res.status(400).json({ error: "Invalid sort format" });
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		accessPolicyLogger.info(`Getting all access policies, page: ${page}, limit: ${limit}`);

		try {
			const whereClause: Prisma.AccessPolicyWhereInput = {
				...(query
					? {
							OR: [
								{ name: { contains: String(query), mode: "insensitive" } },
								{ description: { contains: String(query), mode: "insensitive" } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.AccessPolicyFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
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

			// Include roles if requested
			if (includeRoles === "true") {
				findManyQuery.include = {
					permissions: {
						include: {
							role: true,
						},
					},
				};
			}

			const [accessPolicies, total] = await Promise.all([
				prisma.accessPolicy.findMany(findManyQuery),
				prisma.accessPolicy.count({ where: whereClause }),
			]);

			accessPolicyLogger.info(`Retrieved ${accessPolicies.length} access policies`);
			res.status(200).json({
				accessPolicies,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			accessPolicyLogger.error(`Error getting access policies: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { name, description } = req.body;

		if (!name) {
			accessPolicyLogger.error("Access policy name is required");
			res.status(400).json({ error: "Access policy name is required" });
			return;
		}

		try {
			// Check if access policy with same name already exists
			const existingPolicy = await prisma.accessPolicy.findFirst({
				where: { name },
			});

			if (existingPolicy) {
				accessPolicyLogger.info(`Access policy already exists: ${existingPolicy.id}`);
				res.status(409).json({
					error: "Access policy with this name already exists",
					existingPolicy,
				});
				return;
			}

			const newAccessPolicy = await prisma.accessPolicy.create({
				data: {
					name,
					description,
				},
			});

			accessPolicyLogger.info(`Created access policy: ${newAccessPolicy.id}`);
			res.status(201).json(newAccessPolicy);
		} catch (error) {
			accessPolicyLogger.error(`Error creating access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { name, description } = req.body;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			accessPolicyLogger.error("No update fields provided");
			res.status(400).json({
				error: "At least one field is required for update",
			});
			return;
		}

		accessPolicyLogger.info(`Updating access policy: ${id}`);

		try {
			const existingPolicy = await prisma.accessPolicy.findUnique({
				where: { id },
			});

			if (!existingPolicy) {
				accessPolicyLogger.error(`Access policy not found: ${id}`);
				res.status(404).json({ error: "Access policy not found" });
				return;
			}

			// Check if name is being changed and if it conflicts with another policy
			if (name && name !== existingPolicy.name) {
				const conflictingPolicy = await prisma.accessPolicy.findFirst({
					where: { name, id: { not: id } },
				});

				if (conflictingPolicy) {
					accessPolicyLogger.error(`Access policy name already exists: ${name}`);
					res.status(409).json({ error: "Access policy with this name already exists" });
					return;
				}
			}

			const updatedPolicy = await prisma.accessPolicy.update({
				where: { id },
				data: {
					...(name && { name }),
					...(description !== undefined && { description }),
				},
			});

			accessPolicyLogger.info(`Updated access policy: ${updatedPolicy.id}`);
			res.status(200).json(updatedPolicy);
		} catch (error) {
			accessPolicyLogger.error(`Error updating access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		accessPolicyLogger.info(`Deleting access policy: ${id}`);

		try {
			const existingPolicy = await prisma.accessPolicy.findUnique({
				where: { id },
				include: {
					permissions: {
						include: {
							role: true,
						},
					},
				},
			});

			if (!existingPolicy) {
				accessPolicyLogger.error(`Access policy not found: ${id}`);
				res.status(404).json({ error: "Access policy not found" });
				return;
			}

			// Check if policy has roles assigned
			if (existingPolicy.permissions.length > 0) {
				accessPolicyLogger.error(`Cannot delete access policy with assigned roles: ${id}`);
				res.status(409).json({
					error: "Cannot delete access policy with assigned roles. Remove roles first.",
					assignedRoles: existingPolicy.permissions.map((role) => role.role),
				});
				return;
			}

			await prisma.accessPolicy.delete({
				where: { id },
			});

			accessPolicyLogger.info(`Deleted access policy: ${id}`);
			res.status(200).json({ message: "Access policy deleted successfully" });
		} catch (error) {
			accessPolicyLogger.error(`Error deleting access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const assignRole = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { roleId, permissions } = req.body;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		if (!roleId) {
			accessPolicyLogger.error("Role ID is required");
			res.status(400).json({ error: "Role ID is required" });
			return;
		}

		if (!permissions || !Array.isArray(permissions)) {
			accessPolicyLogger.error("Permissions array is required");
			res.status(400).json({ error: "Permissions array is required" });
			return;
		}

		accessPolicyLogger.info(`Assigning role ${roleId} to access policy ${id}`);

		try {
			// Check if access policy exists
			const accessPolicy = await prisma.accessPolicy.findUnique({
				where: { id },
			});

			if (!accessPolicy) {
				accessPolicyLogger.error(`Access policy not found: ${id}`);
				res.status(404).json({ error: "Access policy not found" });
				return;
			}

			// Check if role exists
			const role = await prisma.role.findUnique({
				where: { id: roleId },
			});

			if (!role) {
				accessPolicyLogger.error(`Role not found: ${roleId}`);
				res.status(404).json({ error: "Role not found" });
				return;
			}

			// Check if role is already assigned to this policy
			const existingAssignment = await prisma.permission.findUnique({
				where: {
					accessPolicyId_roleId: {
						accessPolicyId: id,
						roleId: roleId,
					},
				},
			});

			if (existingAssignment) {
				accessPolicyLogger.error(`Role already assigned to access policy: ${roleId}`);
				res.status(409).json({ error: "Role already assigned to this access policy" });
				return;
			}

			const assignment = await prisma.permission.create({
				data: {
					accessPolicyId: id,
					roleId: roleId,
					rolePermissions: permissions,
				},
				include: {
					role: true,
					accessPolicy: true,
				},
			});

			accessPolicyLogger.info(`Assigned role to access policy: ${assignment.id}`);
			res.status(201).json(assignment);
		} catch (error) {
			accessPolicyLogger.error(`Error assigning role to access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const removeRole = async (req: Request, res: Response, _next: NextFunction) => {
		const { id, roleId } = req.params;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		if (!roleId) {
			accessPolicyLogger.error("Role ID is required");
			res.status(400).json({ error: "Role ID is required" });
			return;
		}

		accessPolicyLogger.info(`Removing role ${roleId} from access policy ${id}`);

		try {
			const assignment = await prisma.permission.findUnique({
				where: {
					accessPolicyId_roleId: {
						accessPolicyId: id,
						roleId: roleId,
					},
				},
			});

			if (!assignment) {
				accessPolicyLogger.error(
					`Role assignment not found for access policy: ${id}, role: ${roleId}`,
				);
				res.status(404).json({ error: "Role assignment not found" });
				return;
			}

			await prisma.permission.delete({
				where: {
					accessPolicyId_roleId: {
						accessPolicyId: id,
						roleId: roleId,
					},
				},
			});

			accessPolicyLogger.info(`Removed role from access policy: ${assignment.id}`);
			res.status(200).json({ message: "Role removed from access policy successfully" });
		} catch (error) {
			accessPolicyLogger.error(`Error removing role from access policy: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const updateRolePermissions = async (req: Request, res: Response, _next: NextFunction) => {
		const { id, roleId } = req.params;
		const { permissions } = req.body;

		if (!id) {
			accessPolicyLogger.error("Access policy ID is required");
			res.status(400).json({ error: "Access policy ID is required" });
			return;
		}

		if (!roleId) {
			accessPolicyLogger.error("Role ID is required");
			res.status(400).json({ error: "Role ID is required" });
			return;
		}

		if (!permissions || !Array.isArray(permissions)) {
			accessPolicyLogger.error("Permissions array is required");
			res.status(400).json({ error: "Permissions array is required" });
			return;
		}

		accessPolicyLogger.info(`Updating permissions for role ${roleId} in access policy ${id}`);

		try {
			const assignment = await prisma.permission.findUnique({
				where: {
					accessPolicyId_roleId: {
						accessPolicyId: id,
						roleId: roleId,
					},
				},
			});

			if (!assignment) {
				accessPolicyLogger.error(
					`Role assignment not found for access policy: ${id}, role: ${roleId}`,
				);
				res.status(404).json({ error: "Role assignment not found" });
				return;
			}

			const updatedAssignment = await prisma.permission.update({
				where: {
					accessPolicyId_roleId: {
						accessPolicyId: id,
						roleId: roleId,
					},
				},
				data: {
					rolePermissions: permissions,
				},
				include: {
					role: true,
					accessPolicy: true,
				},
			});

			accessPolicyLogger.info(
				`Updated permissions for role in access policy: ${updatedAssignment.id}`,
			);
			res.status(200).json(updatedAssignment);
		} catch (error) {
			accessPolicyLogger.error(`Error updating role permissions: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
		assignRole,
		removeRole,
		updateRolePermissions,
	};
};
