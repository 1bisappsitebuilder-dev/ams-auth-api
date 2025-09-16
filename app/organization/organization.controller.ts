import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";

const logger = getLogger();
const orgLogger = logger.child({ module: "organization" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			orgLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.ORG_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.POPULATE_MUST_BE_STRING });
			return;
		}

		orgLogger.info(`${config.SUCCESS.ORGANIZATION.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.OrganizationFindFirstArgs = {
				where: {
					id,
					deletedAt: null,
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

			const org = await prisma.organization.findFirst(query);

			if (!org) {
				orgLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ORGANIZATION.NOT_FOUND });
				return;
			}

			orgLogger.info(`${config.SUCCESS.ORGANIZATION.RETRIEVED}: ${org.id}`);
			res.status(200).json(org);
		} catch (error) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					orgLogger.error(`${config.ERROR.ORGANIZATION.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.ORGANIZATION.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		orgLogger.info(
			`${config.SUCCESS.ORGANIZATION.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.OrganizationWhereInput = {
				deletedAt: null,
				...(query
					? {
							OR: [
								{ name: { contains: String(query) } },
								{ code: { contains: String(query) } },
								{ description: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.OrganizationFindManyArgs = {
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

			const [organizations, total] = await Promise.all([
				prisma.organization.findMany(findManyQuery),
				prisma.organization.count({ where: whereClause }),
			]);

			orgLogger.info(`Retrieved ${organizations.length} organizations`);
			res.status(200).json({
				organizations,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.ERROR_GETTING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { name, code, ...others } = req.body;

		if (!name || !code) {
			orgLogger.error(config.ERROR.ORGANIZATION.INVALID_INPUT);
			res.status(400).json({ error: "Name and code are required" });
			return;
		}

		try {
			const existingOrg = await prisma.organization.findFirst({
				where: { code, deletedAt: null },
			});

			if (existingOrg) {
				orgLogger.info(`${config.SUCCESS.ORGANIZATION.RETRIEVED}: ${existingOrg.id}`);
				res.status(200).json({
					...existingOrg,
					message: "Existing organization found",
				});
				return;
			}

			const newOrg = await prisma.organization.create({
				data: {
					name,
					code,
					...others,
				},
			});

			orgLogger.info(`${config.SUCCESS.ORGANIZATION.CREATED}: ${newOrg.id}`);
			res.status(201).json(newOrg);
		} catch (error) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { name, code, ...others } = req.body;

		if (!id) {
			orgLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.ORG_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			orgLogger.error(config.ERROR.ORGANIZATION.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.ORGANIZATION.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		orgLogger.info(`Updating organization: ${id}`);

		try {
			const existingOrg = await prisma.organization.findUnique({
				where: { id },
			});

			if (!existingOrg) {
				orgLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ORGANIZATION.NOT_FOUND });
				return;
			}

			const updatedOrg = await prisma.organization.update({
				where: { id },
				data: {
					...(name && { name }),
					...(code && { code }),
					...others,
				},
			});

			orgLogger.info(`${config.SUCCESS.ORGANIZATION.UPDATE}: ${updatedOrg.id}`);
			res.status(200).json(updatedOrg);
		} catch (error) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.ERROR_UPDATING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			orgLogger.error(config.ERROR.ORGANIZATION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ORGANIZATION.ORG_ID_REQUIRED });
			return;
		}

		orgLogger.info(`${config.SUCCESS.ORGANIZATION.SOFT_DELETING}: ${id}`);

		try {
			const existingOrg = await prisma.organization.findUnique({
				where: { id },
			});

			if (!existingOrg) {
				orgLogger.error(`${config.ERROR.ORGANIZATION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ORGANIZATION.NOT_FOUND });
				return;
			}

			await prisma.organization.update({
				where: { id },
				data: {
					deletedAt: new Date(),
				},
			});

			orgLogger.info(`${config.SUCCESS.ORGANIZATION.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.ORGANIZATION.DELETED });
		} catch (error) {
			orgLogger.error(`${config.ERROR.ORGANIZATION.ERROR_DELETING}: ${error}`);
			res.status(500).json({ error: config.ERROR.ORGANIZATION.INTERNAL_SERVER_ERROR });
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
