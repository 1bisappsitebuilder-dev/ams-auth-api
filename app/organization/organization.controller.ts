import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";

const logger = getLogger();
const roleLogger = logger.child({ module: "role" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			roleLogger.error(config.ERROR.ROLE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ROLE.ROLE_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			roleLogger.error(`${config.ERROR.USER.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.USER.POPULATE_MUST_BE_STRING });
			return;
		}

		roleLogger.info(`${config.SUCCESS.ROLE.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.RoleFindFirstArgs = {
				where: {
					id,
					OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				},
			};

			if (fields) {
				const includeFields = (fields as string).split(",").reduce(
					(acc, field) => ({
						...acc,
						[field.trim()]: true,
					}),
					{},
				);

				query.select = {
					...query.select,
					...includeFields,
				};
			}

			const role = await prisma.role.findFirst(query);

			if (!role) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ROLE.NOT_FOUND });
				return;
			}

			roleLogger.info(`${config.SUCCESS.ROLE.RETRIEVED}: ${role.id}`);
			res.status(200).json(role);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ROLE.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			roleLogger.error(`${config.ERROR.ROLE.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.ROLE.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			roleLogger.error(`${config.ERROR.ROLE.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.ROLE.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			roleLogger.error(`${config.ERROR.ROLE.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.ROLE.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			roleLogger.error(`${config.ERROR.USER.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.USER.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					roleLogger.error(`${config.ERROR.ROLE.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.ROLE.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		roleLogger.info(
			`${config.SUCCESS.ROLE.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.RoleWhereInput = {
				OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				...(query
					? {
							OR: [
								{ name: { contains: String(query) } },
								{ description: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.RoleFindManyArgs = {
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

			const [roles, total] = await Promise.all([
				prisma.role.findMany(findManyQuery),
				prisma.role.count({ where: whereClause }),
			]);

			roleLogger.info(`Retrieved ${roles.length} roles`);
			res.status(200).json({
				roles,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ROLE.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { name, description } = req.body;

		if (!name) {
			roleLogger.error(config.ERROR.ROLE.INVALID_INPUT);
			res.status(400).json({ error: "Role name is required" });
			return;
		}

		try {
			const existingRole = await prisma.role.findFirst({
				where: { name, deletedAt: null },
			});

			if (existingRole) {
				roleLogger.info(`${config.SUCCESS.ROLE.RETRIEVED}: ${existingRole.id}`);
				res.status(200).json({
					...existingRole,
					message: "Existing role found",
				});
				return;
			}

			const newRole = await prisma.role.create({
				data: {
					name,
					description,
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.CREATED}: ${newRole.id}`);
			res.status(201).json(newRole);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.ROLE.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { name, description } = req.body;

		if (!id) {
			roleLogger.error(config.ERROR.ROLE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ROLE.ROLE_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			roleLogger.error(config.ERROR.ROLE.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.ROLE.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		roleLogger.info(`Updating role: ${id}`);

		try {
			const existingRole = await prisma.role.findUnique({
				where: { id },
			});

			if (!existingRole) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ROLE.NOT_FOUND });
				return;
			}

			const updatedRole = await prisma.role.update({
				where: { id },
				data: {
					...(name && { name }),
					...(description && { description }),
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.UPDATE}: ${updatedRole.id}`);
			res.status(200).json(updatedRole);
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_UPDATING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ROLE.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			roleLogger.error(config.ERROR.ROLE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ROLE.ROLE_ID_REQUIRED });
			return;
		}

		roleLogger.info(`${config.SUCCESS.ROLE.SOFT_DELETING}: ${id}`);

		try {
			const existingRole = await prisma.role.findUnique({
				where: { id },
			});

			if (!existingRole) {
				roleLogger.error(`${config.ERROR.ROLE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ROLE.NOT_FOUND });
				return;
			}

			await prisma.role.update({
				where: { id },
				data: {
					deletedAt: new Date(),
				},
			});

			roleLogger.info(`${config.SUCCESS.ROLE.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.ROLE.DELETED });
		} catch (error) {
			roleLogger.error(`${config.ERROR.ROLE.ERROR_DELETING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ROLE.INTERNAL_SERVER_ERROR });
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
	};
};
