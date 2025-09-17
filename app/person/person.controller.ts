import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";

const logger = getLogger();
const personLogger = logger.child({ module: "person" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERSON.USER_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			personLogger.error(`${config.ERROR.PERSON.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.PERSON.POPULATE_MUST_BE_STRING });
			return;
		}

		personLogger.info(`${config.SUCCESS.PERSON.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.PersonFindFirstArgs = {
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

			const person = await prisma.person.findFirst(query);

			if (!person) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERSON.NOT_FOUND });
				return;
			}

			personLogger.info(`${config.SUCCESS.PERSON.RETRIEVED}: ${person.id}`);
			res.status(200).json(person);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERSON.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			personLogger.error(`${config.ERROR.PERSON.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.PERSON.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			personLogger.error(`${config.ERROR.PERSON.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.PERSON.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			personLogger.error(`${config.ERROR.PERSON.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.PERSON.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			personLogger.error(`${config.ERROR.PERSON.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.PERSON.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					personLogger.error(`${config.ERROR.PERSON.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.PERSON.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		personLogger.info(
			`${config.SUCCESS.PERSON.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.PersonWhereInput = {
				OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
				...(query
					? {
							OR: [
								{ firstName: { contains: String(query) } },
								{ lastName: { contains: String(query) } },
								{ middleName: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.PersonFindManyArgs = {
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

			const [person, total] = await Promise.all([
				prisma.person.findMany(findManyQuery),
				prisma.person.count({ where: whereClause }),
			]);

			personLogger.info(`Retrieved ${person.length} person`);
			res.status(200).json({
				person,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERSON.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { firstName, lastName, ...others } = req.body;

		if (!firstName || !lastName) {
			personLogger.error(config.ERROR.PERSON.INVALID_ID);
			res.status(400).json({ error: "First name and last name are required" });
			return;
		}

		try {
			const existingPerson = await prisma.person.findFirst({
				where: {
					firstName,
					lastName,
					deletedAt: null,
				},
			});

			if (existingPerson) {
				personLogger.info(`${config.SUCCESS.PERSON.RETRIEVED}: ${existingPerson.id}`);
				res.status(200).json({
					...existingPerson,
					message: "Existing person found",
				});
				return;
			}

			const newPerson = await prisma.person.create({
				data: {
					firstName,
					lastName,
					...others,
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.CREATED}: ${newPerson.id}`);
			res.status(201).json(newPerson);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERSON.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { firstName, lastName, ...others } = req.body;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERSON.USER_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			personLogger.error(config.ERROR.PERSON.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.PERSON.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		personLogger.info(`Updating person: ${id}`);

		try {
			const existingPerson = await prisma.person.findUnique({
				where: { id },
			});

			if (!existingPerson) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERSON.NOT_FOUND });
				return;
			}

			const updatedPerson = await prisma.person.update({
				where: { id },
				data: {
					...(firstName && { firstName }),
					...(lastName && { lastName }),
					...others,
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.UPDATE}: ${updatedPerson.id}`);
			res.status(200).json(updatedPerson);
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_UPDATING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERSON.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			res.status(400).json({ error: config.ERROR.PERSON.USER_ID_REQUIRED });
			return;
		}

		personLogger.info(`${config.SUCCESS.PERSON.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.person.findUnique({
				where: { id },
			});

			if (!existingUser) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.PERSON.NOT_FOUND });
				return;
			}

			await prisma.person.update({
				where: { id },
				data: {
					deletedAt: new Date(),
				},
			});

			personLogger.info(`${config.SUCCESS.PERSON.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.PERSON.DELETED });
		} catch (error) {
			personLogger.error(`${config.ERROR.PERSON.ERROR_DELETING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.PERSON.INTERNAL_SERVER_ERROR });
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
