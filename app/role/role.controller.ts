import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { CreateRoleSchema, UpdateRoleSchema, ObjectIdSchema } from "../../zod/role.zod";
import { handleQueryValidation, executeFormattedQuery } from "../../utils/queryUtils";
import { buildAdvancedWhereClause, getSearchFields } from "../../utils/advancedFilterUtils";
import {
	sendSuccessResponse,
	sendValidationError,
	sendErrorResponse,
	sendNotFoundResponse,
	sendConflictResponse,
	sendPrismaErrorResponse,
} from "../../utils/validationHelper";
import { logActivity } from "../../utils/activityLogger";
import { logAudit } from "../../utils/auditLogger";
import { config } from "../../config/constant";

const logger = getLogger();
const roleLogger = logger.child({ module: "role" });

export const controller = (prisma: PrismaClient) => {
	const create = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			// Validate request data using Zod
			const validationResult = CreateRoleSchema.safeParse(req.body);
			if (!validationResult.success) {
				const errors = validationResult.error.errors.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				}));
				const errorMessages = errors
					.map((err) => `${err.field}: ${err.message}`)
					.join(", ");
				roleLogger.error(`Validation error: ${errorMessages}`);
				return sendValidationError(res, "Validation failed", errors);
			}

			const validatedData = validationResult.data;

			// Check if role with the same name already exists
			const existingRole = await prisma.userRole.findFirst({
				where: { name: validatedData.name },
			});

			if (existingRole) {
				roleLogger.error(`Role with name "${validatedData.name}" already exists`);
				return sendConflictResponse(res, "name", "Role with this name already exists");
			}

			const role = await prisma.userRole.create({
				data: validatedData,
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE_ROLE",
				description: `Created new role: ${validatedData.name}`,
				page: { url: req.originalUrl, title: "Role Creation" },
			});

			// ✅ Log audit for creation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE",
				resource: "roles",
				severity: "LOW",
				entityType: "role",
				entityId: role.id,
				changesBefore: null,
				changesAfter: {
					...validatedData,
				},
				description: `Created new role: ${validatedData.name}`,
			});

			roleLogger.info(`Role created successfully: ${role.id}`);

			return sendSuccessResponse(res, "Role created successfully", role, 201);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, roleLogger);
			}

			roleLogger.error(`Error Creating Role`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		// Validate and parse query parameters using utility function
		const parsedParams = handleQueryValidation(req, res, roleLogger);
		if (!parsedParams) return; // Response already sent if validation failed

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

		roleLogger.info(
			`Getting all roles: page: ${page}, limit: ${limit}, query: ${query}, order: ${order}, format: ${documents ? "documents" : pagination ? "pagination" : count ? "count" : "no-data"}`,
		);

		try {
			// Build base conditions - UserRole doesn't have isDeleted field
			const baseConditions: Prisma.UserRoleWhereInput = {};

			// Get search fields for role
			const searchFields = getSearchFields("userRole", []);

			// Build where clause using advanced filtering
			const whereClause = buildAdvancedWhereClause(
				baseConditions,
				"userRole",
				query,
				searchFields,
				filter,
			);

			const response = await executeFormattedQuery(
				prisma,
				"userRole",
				whereClause,
				parsedParams,
				"roles",
				"roles",
			);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_ALL_ROLES",
				description: `Retrieved ${response.data?.length || response.length || 0} role records`,
				page: { url: req.originalUrl, title: "Get All Roles" },
			});

			roleLogger.info(`Retrieved roles successfully`);
			return sendSuccessResponse(
				res,
				"Roles retrieved successfully",
				response.data || response,
			);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, roleLogger);
			}

			roleLogger.error(`Error getting the role.`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const idValidation = ObjectIdSchema.safeParse(req.params.id);
			if (!idValidation.success) {
				roleLogger.error(`Invalid role ID: ${req.params.id}`);
				return sendValidationError(res, "Validation failed", [
					{ field: "id", message: "Invalid role ID format" },
				]);
			}

			const roleId = idValidation.data;

			const role = await prisma.userRole.findUnique({
				where: { id: roleId },
			});

			if (!role) {
				roleLogger.error(`Role not found: ${roleId}`);
				return sendNotFoundResponse(res, "Role", "id");
			}

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_ROLE",
				description: `Retrieved role with ID: ${roleId}`,
				page: { url: req.originalUrl, title: "Get Role Details" },
			});

			roleLogger.info(`Role retrieved successfully: ${roleId}`);

			return sendSuccessResponse(res, "Role retrieved successfully", role);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, roleLogger);
			}

			roleLogger.error(`Error getting role: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const idValidation = ObjectIdSchema.safeParse(req.params.id);
			if (!idValidation.success) {
				roleLogger.error(`Invalid role ID: ${req.params.id}`);
				return sendValidationError(res, "Validation failed", [
					{ field: "id", message: "Invalid role ID format" },
				]);
			}

			const roleId = idValidation.data;

			// Validate request data using Zod
			const validationResult = UpdateRoleSchema.safeParse(req.body);
			if (!validationResult.success) {
				const errors = validationResult.error.errors.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				}));
				const errorMessages = errors
					.map((err) => `${err.field}: ${err.message}`)
					.join(", ");
				roleLogger.error(`Validation error: ${errorMessages}`);
				return sendValidationError(res, "Validation failed", errors);
			}

			const validatedData = validationResult.data;

			// Check if role exists
			const existingRole = await prisma.userRole.findUnique({
				where: { id: roleId },
			});

			if (!existingRole) {
				roleLogger.error(`Role not found: ${roleId}`);
				return sendNotFoundResponse(res, "Role", "id");
			}

			// Check if name is being updated and if it conflicts with another role
			if (validatedData.name && validatedData.name !== existingRole.name) {
				const nameConflict = await prisma.userRole.findFirst({
					where: {
						name: validatedData.name,
						id: { not: roleId },
					},
				});

				if (nameConflict) {
					roleLogger.error(`Role with name "${validatedData.name}" already exists`);
					return sendConflictResponse(res, "name", "Role with this name already exists");
				}
			}

			const updatedRole = await prisma.userRole.update({
				where: { id: roleId },
				data: validatedData,
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE_ROLE",
				description: `Updated role with ID: ${roleId}`,
				page: { url: req.originalUrl, title: "Role Update" },
			});

			// ✅ Log audit for update
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPDATE",
				resource: "roles",
				severity: "MEDIUM",
				entityType: "role",
				entityId: roleId,
				changesBefore: {
					...existingRole,
				},
				changesAfter: {
					...updatedRole,
				},
				description: `Updated role with ID: ${roleId}`,
			});

			roleLogger.info(`Role updated successfully: ${roleId}`);

			return sendSuccessResponse(res, "Role updated successfully", updatedRole);
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, roleLogger);
			}

			roleLogger.error(`Error updating role: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const idValidation = ObjectIdSchema.safeParse(req.params.id);
			if (!idValidation.success) {
				roleLogger.error(`Invalid role ID: ${req.params.id}`);
				return sendValidationError(res, "Validation failed", [
					{ field: "id", message: "Invalid role ID format" },
				]);
			}

			const roleId = idValidation.data;

			// Check if role exists
			const existingRole = await prisma.userRole.findUnique({
				where: { id: roleId },
			});

			if (!existingRole) {
				roleLogger.error(`Role not found: ${roleId}`);
				return sendNotFoundResponse(res, "Role", "id");
			}

			await prisma.userRole.delete({
				where: { id: roleId },
			});

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE_ROLE",
				description: `Deleted role with ID: ${roleId}`,
				page: { url: req.originalUrl, title: "Role Deletion" },
			});

			// ✅ Log audit for deletion
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE",
				resource: "roles",
				severity: "HIGH",
				entityType: "role",
				entityId: roleId,
				changesBefore: {
					...existingRole,
				},
				changesAfter: null,
				description: `Deleted role with ID: ${roleId}`,
			});

			roleLogger.info(`Role deleted successfully: ${roleId}`);

			return sendSuccessResponse(res, "Successfully deleted role");
		} catch (error: any) {
			if (error.name?.includes("Prisma") || error.code?.startsWith("P")) {
				return sendPrismaErrorResponse(res, error, roleLogger);
			}

			roleLogger.error(`Error deleting role: ${error}`);
			return sendValidationError(res, config.COMMON.INTERNAL_SERVER_ERROR, [
				{ field: "Error", message: config.COMMON.INTERNAL_SERVER_ERROR },
			]);
		}
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
