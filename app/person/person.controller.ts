import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/constant";
import { handleQueryValidation, executeFormattedQuery } from "../../utils/queryUtils";
import { buildAdvancedWhereClause, getSearchFields } from "../../utils/advancedFilterUtils";
import {
	sendSuccessResponse,
	sendValidationError,
	sendErrorResponse,
	sendPrismaErrorResponse,
} from "../../utils/validationHelper";
import { logActivity } from "../../utils/activityLogger";
import { logAudit } from "../../utils/auditLogger";

const logger = getLogger();
const personLogger = logger.child({ module: "person" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			return sendValidationError(res, "Validation failed", [
				{ field: "id", message: config.ERROR.PERSON.USER_ID_REQUIRED },
			]);
		}

		if (fields && typeof fields !== "string") {
			personLogger.error(`${config.ERROR.PERSON.INVALID_POPULATE}: ${fields}`);
			return sendValidationError(res, "Validation failed", [
				{ field: "fields", message: config.ERROR.PERSON.POPULATE_MUST_BE_STRING },
			]);
		}

		personLogger.info(`${config.SUCCESS.PERSON.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.PersonFindFirstArgs = {
				where: {
					id,
					metadata: {
						is: {
							isDeleted: false,
						},
					},
				},
			};

			if (fields) {
				// Use select when fields are specified
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

			const person = await prisma.person.findFirst(query);

			if (!person) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				return sendErrorResponse(
					res,
					config.ERROR.PERSON.NOT_FOUND,
					"NOT_FOUND",
					[{ field: "id", message: config.ERROR.PERSON.NOT_FOUND }],
					404,
				);
			}

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_PERSON",
				description: `Retrieved person with ID: ${id}`,
				organizationId: person.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Get Person Details" },
			});

			personLogger.info(`${config.SUCCESS.PERSON.RETRIEVED}: ${person.id}`);
			res.status(200).json({
				status: "success",
				message: config.SUCCESS.PERSON.RETRIEVED,
				data: person,
			});
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, personLogger);
			}

			personLogger.error(`${config.ERROR.PERSON.ERROR_GETTING_USER}: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const parsedParams = handleQueryValidation(req, res, personLogger);
		if (!parsedParams) return;

		const {
			page,
			limit,
			skip,
			sort,
			fields,
			query,
			filter,
			order,
			documents,
			pagination,
			count,
		} = parsedParams;

		personLogger.info(
			`${config.SUCCESS.PERSON.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, filter: ${JSON.stringify(filter)}, order: ${order}, format: ${documents ? "documents" : pagination ? "pagination" : count ? "count" : "no-data"}`,
		);

		try {
			// Build base conditions
			const baseConditions: Prisma.PersonWhereInput = {
				metadata: {
					is: {
						isDeleted: false,
					},
				},
			};

			// Get search fields for person and its relations
			const searchFields = getSearchFields("person", ["users"]);

			// Build where clause using advanced filtering
			const whereClause = buildAdvancedWhereClause(
				baseConditions,
				"person",
				query,
				searchFields,
				filter,
			);

			// Define include options for person data
			const includeOptions = {
				users: true,
			};

			const response = await executeFormattedQuery(
				prisma,
				"person",
				whereClause,
				parsedParams,
				"person",
				"person",
				includeOptions,
			);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_ALL_PERSONS",
				description: `Retrieved ${response.data?.length || response.length || 0} person records`,
				page: { url: req.originalUrl, title: "Get All Persons" },
			});

			personLogger.info(`Retrieved person records successfully`);
			res.status(200).json({
				status: "success",
				message: config.SUCCESS.PERSON.GETTING_ALL_USERS,
				data: response.data || response,
			});
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, personLogger);
			}

			personLogger.error(`${config.ERROR.PERSON.ERROR_GETTING_USER}: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { organizationId, personalInfo, contactInfo, identification } = req.body;

		const { firstName, lastName, address, ...otherPersonalInfo } = personalInfo || {};

		if (!firstName || !lastName) {
			personLogger.error(config.ERROR.PERSON.INVALID_ID);
			res.status(400).json({ error: "First name and last name are required" });
			return;
		}

		try {
			const existingPerson = await prisma.person.findFirst({
				where: {
					personalInfo: {
						is: {
							firstName,
							lastName,
						},
					},
					metadata: {
						is: {
							isDeleted: false,
						},
					},
				},
			});

			// Map incoming address to ContactAddress schema
			const incomingAddress = req.body.address || address;
			const mappedAddress = incomingAddress
				? {
						street: incomingAddress.street || "",
						address2: incomingAddress.address2 || "",
						city: incomingAddress.city || "",
						state: incomingAddress.province || incomingAddress.state || "",
						country: incomingAddress.country || "",
						postalCode: incomingAddress.postalCode || "",
						zipCode: incomingAddress.zipCode?.toString() || "",
						houseNumber:
							incomingAddress.houseNo?.toString() ||
							incomingAddress.houseNumber ||
							"",
					}
				: undefined;

			const dataForPerson = {
				...(organizationId && { organizationId }),
				personalInfo: {
					set: {
						firstName,
						lastName,
						...otherPersonalInfo,
						...(personalInfo?.gender && { gender: personalInfo.gender.toLowerCase() }),
						...(personalInfo?.dateOfBirth && {
							dateOfBirth: new Date(personalInfo.dateOfBirth),
						}),
					},
				},
				contactInfo: {
					set: {
						...(contactInfo || {}),
						...(mappedAddress && { address: mappedAddress }),
					},
				},
				...(identification && {
					identification: {
						set: {
							...identification,
							...(identification?.issueDate && {
								issueDate: new Date(identification.issueDate),
							}),
							...(identification?.expiryDate && {
								expiryDate: new Date(identification.expiryDate),
							}),
						},
					},
				}),
			};

			if (existingPerson) {
				personLogger.info(
					`Found existing person, updating with new data: ${existingPerson.id}`,
				);

				const updatedPerson = await prisma.person.update({
					where: { id: existingPerson.id },
					data: dataForPerson,
				});

				// ✅ Log activity for update
				logActivity(req, {
					userId: (req as any).user?.id || "unknown",
					action: "UPDATE_PERSON",
					description: `Updated existing person: ${firstName} ${lastName}`,
					organizationId: updatedPerson.organizationId ?? undefined,
					page: { url: req.originalUrl, title: "Person Update" },
				});

				// ✅ Log audit for update
				logAudit(req, {
					userId: (req as any).user?.id || "unknown",
					action: "UPDATE",
					resource: "persons",
					severity: "MEDIUM",
					entityType: "person",
					entityId: updatedPerson.id,
					changesBefore: {
						personalInfo: existingPerson.personalInfo,
						contactInfo: existingPerson.contactInfo,
						identification: existingPerson.identification,
					},
					changesAfter: {
						personalInfo: updatedPerson.personalInfo,
						contactInfo: updatedPerson.contactInfo,
						identification: updatedPerson.identification,
					},
					description: `Updated existing person: ${firstName} ${lastName}`,
					organizationId: updatedPerson.organizationId ?? undefined,
				});

				personLogger.info(`${config.SUCCESS.PERSON.UPDATE}: ${updatedPerson.id}`);
				res.status(200).json({
					...updatedPerson,
					message: "Existing person found and updated",
				});
				return;
			}

			const personDataToCreate: Prisma.PersonCreateInput = {
				...dataForPerson,
				metadata: {
					isDeleted: false,
					isActive: true,
				},
			};

			const newPerson = await prisma.person.create({
				data: personDataToCreate,
			});

			// ✅ Log activity for creation
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE_PERSON",
				description: `Created new person: ${firstName} ${lastName}`,
				organizationId: newPerson.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Person Creation" },
			});

			// ✅ Log audit for creation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE",
				resource: "persons",
				severity: "LOW",
				entityType: "person",
				entityId: newPerson.id,
				changesBefore: null,
				changesAfter: {
					personalInfo: newPerson.personalInfo,
					contactInfo: newPerson.contactInfo,
					identification: newPerson.identification,
					organizationId: newPerson.organizationId,
				},
				description: `Created new person: ${firstName} ${lastName}`,
				organizationId: newPerson.organizationId ?? undefined,
			});

			personLogger.info(`${config.SUCCESS.PERSON.CREATED}: ${newPerson.id}`);
			res.status(201).json(newPerson);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, personLogger);
			}

			personLogger.error(`${config.ERROR.PERSON.INTERNAL_SERVER_ERROR}: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { organizationId, personalInfo, contactInfo, identification, ...others } = req.body;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			return sendValidationError(res, "Validation failed", [
				{ field: "id", message: config.ERROR.PERSON.USER_ID_REQUIRED },
			]);
		}

		if (Object.keys(req.body).length === 0) {
			personLogger.error(config.ERROR.PERSON.NO_UPDATE_FIELDS);
			return sendValidationError(res, "Validation failed", [
				{ field: "body", message: config.ERROR.PERSON.AT_LEAST_ONE_FIELD_REQUIRED },
			]);
		}

		personLogger.info(`Updating person: ${id}`);

		try {
			const existingPerson = await prisma.person.findUnique({
				where: { id },
			});

			if (!existingPerson) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				return sendErrorResponse(
					res,
					config.ERROR.PERSON.NOT_FOUND,
					"NOT_FOUND",
					[{ field: "id", message: config.ERROR.PERSON.NOT_FOUND }],
					404,
				);
			}

			// Prepare update data
			const updateData: any = {
				...others,
				...(organizationId !== undefined && { organizationId }),
			};

			// Handle personalInfo updates
			if (personalInfo) {
				updateData.personalInfo = {
					...personalInfo,
					...(personalInfo.gender && { gender: personalInfo.gender.toLowerCase() }),
					...(personalInfo.dateOfBirth && {
						dateOfBirth: new Date(personalInfo.dateOfBirth),
					}),
				};
			}

			// Handle contactInfo updates
			if (contactInfo) {
				updateData.contactInfo = contactInfo;
			}

			// Handle identification updates
			if (identification) {
				updateData.identification = {
					...identification,
					...(identification.issueDate && {
						issueDate: new Date(identification.issueDate),
					}),
					...(identification.expiryDate && {
						expiryDate: new Date(identification.expiryDate),
					}),
				};
			}

			const updatedPerson = await prisma.person.update({
				where: { id },
				data: updateData,
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE_PERSON",
				description: `Updated person with ID: ${id}`,
				organizationId: updatedPerson.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Person Update" },
			});

			// ✅ Log audit for update
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE",
				resource: "persons",
				severity: "MEDIUM",
				entityType: "person",
				entityId: id,
				changesBefore: {
					personalInfo: existingPerson.personalInfo,
					contactInfo: existingPerson.contactInfo,
					identification: existingPerson.identification,
					organizationId: existingPerson.organizationId,
					...others,
				},
				changesAfter: {
					personalInfo: updatedPerson.personalInfo,
					contactInfo: updatedPerson.contactInfo,
					identification: updatedPerson.identification,
					organizationId: updatedPerson.organizationId,
					...others,
				},
				description: `Updated person with ID: ${id}`,
				organizationId: updatedPerson.organizationId ?? undefined,
			});

			personLogger.info(`${config.SUCCESS.PERSON.UPDATE}: ${updatedPerson.id}`);
			res.status(200).json(updatedPerson);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, personLogger);
			}

			personLogger.error(`${config.ERROR.PERSON.ERROR_UPDATING_USER}: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			personLogger.error(config.ERROR.PERSON.MISSING_ID);
			return sendValidationError(res, "Validation failed", [
				{ field: "id", message: config.ERROR.PERSON.USER_ID_REQUIRED },
			]);
		}

		personLogger.info(`${config.SUCCESS.PERSON.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.person.findUnique({
				where: { id },
			});

			if (!existingUser) {
				personLogger.error(`${config.ERROR.PERSON.NOT_FOUND}: ${id}`);
				return sendErrorResponse(
					res,
					config.ERROR.PERSON.NOT_FOUND,
					"NOT_FOUND",
					[{ field: "id", message: config.ERROR.PERSON.NOT_FOUND }],
					404,
				);
			}

			await prisma.person.update({
				where: { id },
				data: {
					metadata: {
						isDeleted: true,
					},
				},
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE_PERSON",
				description: `Soft deleted person with ID: ${id}`,
				organizationId: existingUser.organizationId ?? undefined,
				page: { url: req.originalUrl, title: "Person Deletion" },
			});

			// ✅ Log audit for deletion
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE",
				resource: "persons",
				severity: "HIGH",
				entityType: "person",
				entityId: id,
				changesBefore: {
					personalInfo: existingUser.personalInfo,
					contactInfo: existingUser.contactInfo,
					identification: existingUser.identification,
					organizationId: existingUser.organizationId,
					metadata: existingUser.metadata,
				},
				changesAfter: {
					metadata: {
						isDeleted: true,
					},
				},
				description: `Soft deleted person with ID: ${id}`,
				organizationId: existingUser.organizationId ?? undefined,
			});

			personLogger.info(`${config.SUCCESS.PERSON.DELETED}: ${id}`);
			return sendSuccessResponse(res, config.SUCCESS.PERSON.DELETED);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, personLogger);
			}

			personLogger.error(`${config.ERROR.PERSON.ERROR_DELETING_USER}: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
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
