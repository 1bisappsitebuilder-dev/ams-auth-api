import { getLogger } from "../helper/logger";
import { ZodError } from "zod";

const logger = getLogger();
const validationLogger = logger.child({ module: "validationHelper" });

export interface ValidationResult {
	isValid: boolean;
	error?: string;
}

/**
 * MongoDB ObjectId validation regex
 */
export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Email validation regex
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * URL validation regex
 */
export const URL_REGEX = /^https?:\/\/.+/;

/**
 * Validates if a string is a valid MongoDB ObjectId
 */
export const validateObjectId = (id: string, fieldName = "ID"): ValidationResult => {
	if (!id || typeof id !== "string" || !id.trim()) {
		return { isValid: false, error: `${fieldName} is required` };
	}

	if (!OBJECT_ID_REGEX.test(id)) {
		return { isValid: false, error: `Invalid ${fieldName} format` };
	}

	return { isValid: true };
};

/**
 * Validates if a string is non-empty
 */
export const validateRequiredString = (value: any, fieldName: string): ValidationResult => {
	if (!value || typeof value !== "string" || !value.trim()) {
		return { isValid: false, error: `${fieldName} is required and must be a non-empty string` };
	}
	return { isValid: true };
};

/**
 * Validates if a value is a valid number
 */
export const validateNumber = (
	value: any,
	fieldName: string,
	min?: number,
	max?: number,
): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "number" || isNaN(value)) {
		return { isValid: false, error: `${fieldName} must be a valid number` };
	}

	if (min !== undefined && value < min) {
		return { isValid: false, error: `${fieldName} must be at least ${min}` };
	}

	if (max !== undefined && value > max) {
		return { isValid: false, error: `${fieldName} must be at most ${max}` };
	}

	return { isValid: true };
};

/**
 * Validates if a value is a valid positive number
 */
export const validatePositiveNumber = (value: any, fieldName: string): ValidationResult => {
	return validateNumber(value, fieldName, 0);
};

/**
 * Validates if a value is a valid integer
 */
export const validateInteger = (
	value: any,
	fieldName: string,
	min?: number,
	max?: number,
): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "number" || !Number.isInteger(value)) {
		return { isValid: false, error: `${fieldName} must be a valid integer` };
	}

	if (min !== undefined && value < min) {
		return { isValid: false, error: `${fieldName} must be at least ${min}` };
	}

	if (max !== undefined && value > max) {
		return { isValid: false, error: `${fieldName} must be at most ${max}` };
	}

	return { isValid: true };
};

/**
 * Validates if a value is a valid boolean
 */
export const validateBoolean = (value: any, fieldName: string): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "boolean") {
		return { isValid: false, error: `${fieldName} must be a boolean` };
	}

	return { isValid: true };
};

/**
 * Validates if a value is a valid email
 */
export const validateEmail = (value: any, fieldName: string): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "string" || !EMAIL_REGEX.test(value)) {
		return { isValid: false, error: `${fieldName} must be a valid email address` };
	}

	return { isValid: true };
};

/**
 * Validates if a value is a valid URL
 */
export const validateUrl = (value: any, fieldName: string): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "string" || !URL_REGEX.test(value)) {
		return { isValid: false, error: `${fieldName} must be a valid URL` };
	}

	return { isValid: true };
};

/**
 * Validates if a value is in an allowed enum
 */
export const validateEnum = (
	value: any,
	allowedValues: any[],
	fieldName: string,
): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (!allowedValues.includes(value)) {
		return {
			isValid: false,
			error: `${fieldName} must be one of: ${allowedValues.join(", ")}`,
		};
	}

	return { isValid: true };
};

/**
 * Validates if a value is a valid array
 */
export const validateArray = (
	value: any,
	fieldName: string,
	minLength?: number,
	maxLength?: number,
): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (!Array.isArray(value)) {
		return { isValid: false, error: `${fieldName} must be an array` };
	}

	if (minLength !== undefined && value.length < minLength) {
		return { isValid: false, error: `${fieldName} must have at least ${minLength} items` };
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return { isValid: false, error: `${fieldName} must have at most ${maxLength} items` };
	}

	return { isValid: true };
};

/**
 * Validates if all items in an array are valid ObjectIds
 */
export const validateObjectIdArray = (value: any, fieldName: string): ValidationResult => {
	const arrayValidation = validateArray(value, fieldName);
	if (!arrayValidation.isValid) {
		return arrayValidation;
	}

	if (value && Array.isArray(value)) {
		for (const id of value) {
			const idValidation = validateObjectId(id, `${fieldName} item`);
			if (!idValidation.isValid) {
				return {
					isValid: false,
					error: `All ${fieldName} must be valid MongoDB ObjectIds`,
				};
			}
		}
	}

	return { isValid: true };
};

/**
 * Validates if all items in an array are valid URLs
 */
export const validateUrlArray = (value: any, fieldName: string): ValidationResult => {
	const arrayValidation = validateArray(value, fieldName);
	if (!arrayValidation.isValid) {
		return arrayValidation;
	}

	if (value && Array.isArray(value)) {
		for (const url of value) {
			const urlValidation = validateUrl(url, `${fieldName} item`);
			if (!urlValidation.isValid) {
				return { isValid: false, error: `All ${fieldName} must be valid URLs` };
			}
		}
	}

	return { isValid: true };
};

/**
 * Validates an object's properties against a schema
 */
export const validateObject = (value: any, fieldName: string): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "object" || Array.isArray(value)) {
		return { isValid: false, error: `${fieldName} must be an object` };
	}

	return { isValid: true };
};

/**
 * Validates string length
 */
export const validateStringLength = (
	value: any,
	fieldName: string,
	minLength?: number,
	maxLength?: number,
): ValidationResult => {
	if (value === undefined || value === null) {
		return { isValid: true }; // Optional field
	}

	if (typeof value !== "string") {
		return { isValid: false, error: `${fieldName} must be a string` };
	}

	if (minLength !== undefined && value.length < minLength) {
		return {
			isValid: false,
			error: `${fieldName} must be at least ${minLength} characters long`,
		};
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return {
			isValid: false,
			error: `${fieldName} must be at most ${maxLength} characters long`,
		};
	}

	return { isValid: true };
};

/**
 * Validates a pricing object structure
 */
export const validatePricing = (pricing: any): ValidationResult => {
	const arrayValidation = validateArray(pricing, "pricing");
	if (!arrayValidation.isValid) {
		return arrayValidation;
	}

	if (pricing && Array.isArray(pricing)) {
		for (const price of pricing) {
			const objectValidation = validateObject(price, "pricing item");
			if (!objectValidation.isValid) {
				return objectValidation;
			}

			const priceValidation = validatePositiveNumber(price.price, "price");
			if (!priceValidation.isValid) {
				return priceValidation;
			}

			const currencyValidation = validateRequiredString(price.currency, "currency");
			if (!currencyValidation.isValid) {
				return currencyValidation;
			}
		}
	}

	return { isValid: true };
};

/**
 * NOTE: validateLocation function removed - Location is now a relation via locationId
 * Use Location model validation instead of embedded location object validation
 */

/**
 * Combines multiple validation results
 */
export const combineValidations = (...validations: ValidationResult[]): ValidationResult => {
	for (const validation of validations) {
		if (!validation.isValid) {
			return validation;
		}
	}
	return { isValid: true };
};

/**
 * Validates required fields for creation
 */
export const validateRequiredFields = (data: any, requiredFields: string[]): ValidationResult => {
	for (const field of requiredFields) {
		if (!data[field] || (typeof data[field] === "string" && !data[field].trim())) {
			return { isValid: false, error: `${field} is required` };
		}
	}
	return { isValid: true };
};

// Helper function to format Zod errors into user-friendly messages
export const formatZodErrors = (error: ZodError) => {
	return error.errors.map((err) => {
		const field = err.path.join(".");
		let message = err.message;

		// Customize messages for better UX
		if (err.code === "invalid_type") {
			if (err.received === "undefined") {
				message = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
			} else {
				message = `${field} must be a ${err.expected}`;
			}
		} else if (err.code === "invalid_string") {
			if (err.validation === "email") {
				message = `${field.charAt(0).toUpperCase() + field.slice(1)} must be a valid email address`;
			} else if (err.validation === "regex") {
				message = `${field.charAt(0).toUpperCase() + field.slice(1)} format is invalid`;
			}
		} else if (err.code === "too_small") {
			message = `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${err.minimum} characters`;
		} else if (err.code === "too_big") {
			message = `${field.charAt(0).toUpperCase() + field.slice(1)} must be at most ${err.maximum} characters`;
		}

		return {
			field,
			message,
		};
	});
};

// Helper function to create standardized error responses
export const createValidationErrorResponse = (message: string, errors: any[]) => {
	return {
		status: "error",
		message,
		errors,
		code: 400,
		timestamp: new Date().toISOString(),
	};
};

// Helper function to create standardized success responses
export const createSuccessResponse = (message: string, data?: any) => {
	return {
		status: "success",
		message,
		...(data && { data }),
		timestamp: new Date().toISOString(),
	};
};

// Helper function to create standardized error responses for non-validation errors
export const createErrorResponse = (message: string, code: string = "ERROR", errors?: any[]) => {
	return {
		status: "error",
		message,
		...(errors && { errors }),
		code,
		timestamp: new Date().toISOString(),
	};
};

// Helper function to validate Zod schema and return formatted error response
export const validateWithZod = <T>(
	schema: any,
	data: any,
): { success: true; data: T } | { success: false; error: any } => {
	const validation = schema.safeParse(data);
	if (validation.success) {
		return { success: true, data: validation.data };
	} else {
		return {
			success: false,
			error: createValidationErrorResponse(
				"Validation failed",
				formatZodErrors(validation.error),
			),
		};
	}
};

// Helper function to send validation error response
export const sendValidationError = (res: any, message: string, errors: any[]) => {
	return res.status(400).json(createValidationErrorResponse(message, errors));
};

// Helper function to send success response
export const sendSuccessResponse = (
	res: any,
	message: string,
	data?: any,
	statusCode: number = 200,
) => {
	return res.status(statusCode).json(createSuccessResponse(message, data));
};

// Helper function to send error response
export const sendErrorResponse = (
	res: any,
	message: string,
	code: string = "ERROR",
	errors?: any[],
	statusCode: number = 500,
) => {
	return res.status(statusCode).json(createErrorResponse(message, code, errors));
};

// Helper function to send not found response
export const sendNotFoundResponse = (res: any, resource: string, field: string = "id") => {
	return res
		.status(404)
		.json(
			createErrorResponse(`${resource} not found`, "NOT_FOUND", [
				{ field, message: `${resource} does not exist` },
			]),
		);
};

// Helper function to send conflict response (e.g., duplicate email)
export const sendConflictResponse = (res: any, field: string, message: string) => {
	return res
		.status(409)
		.json(createErrorResponse("Resource conflict", "CONFLICT", [{ field, message }]));
};

// Helper function to send unauthorized response
export const sendUnauthorizedResponse = (res: any, message: string = "Unauthorized") => {
	return res.status(401).json(createErrorResponse(message, "UNAUTHORIZED"));
};

// Helper function to send forbidden response
export const sendForbiddenResponse = (res: any, message: string = "Forbidden") => {
	return res.status(403).json(createErrorResponse(message, "FORBIDDEN"));
};

// Helper function to create standardized query validation error response
export const sendQueryValidationError = (res: any, message: string, field: string = "query") => {
	return res.status(400).json({
		status: "error",
		message,
		code: "VALIDATION_ERROR",
		errors: [{ field, message }],
		timestamp: new Date().toISOString(),
	});
};

// Helper function to handle Prisma errors consistently
export const handlePrismaError = (
	error: any,
): { message: string; code: string; statusCode: number } => {
	// Handle Prisma validation errors
	if (error.code === "P2025") {
		return {
			message: "Record not found",
			code: "NOT_FOUND",
			statusCode: 404,
		};
	}

	if (error.code === "P2002") {
		return {
			message: "A record with this data already exists",
			code: "DUPLICATE_RECORD",
			statusCode: 409,
		};
	}

	if (error.code === "P2003") {
		return {
			message: "Related record constraint failed",
			code: "CONSTRAINT_ERROR",
			statusCode: 400,
		};
	}

	// Handle Prisma argument validation errors (like Invalid SortOrder)
	if (error.message?.includes("Invalid value for argument")) {
		const match = error.message.match(/Invalid value for argument `(\w+)`\. Expected (\w+)\./);
		const field = match?.[1] || "unknown";
		const expected = match?.[2] || "valid value";

		return {
			message: `Invalid value for ${field}. Expected ${expected}.`,
			code: "INVALID_ARGUMENT",
			statusCode: 400,
		};
	}

	// Handle Prisma unknown field errors (like Unknown field 'as' for select statement)
	if (error.message?.includes("Unknown field")) {
		const match = error.message.match(
			/Unknown field `(\w+)` for (\w+) statement on model `(\w+)`/,
		);
		const field = match?.[1] || "unknown";
		const statement = match?.[2] || "query";

		return {
			message: `Invalid field '${field}' in ${statement} statement.`,
			code: "UNKNOWN_FIELD",
			statusCode: 400,
		};
	}

	// Handle other Prisma errors
	if (error.name === "PrismaClientValidationError") {
		return {
			message: "Invalid query parameters",
			code: "VALIDATION_ERROR",
			statusCode: 400,
		};
	}

	if (error.name === "PrismaClientKnownRequestError") {
		return {
			message: "Request processing error",
			code: "REQUEST_ERROR",
			statusCode: 400,
		};
	}

	// Default fallback
	return {
		message: "Internal server error",
		code: "INTERNAL_ERROR",
		statusCode: 500,
	};
};

// Helper function to send Prisma error response
export const sendPrismaErrorResponse = (res: any, error: any, logger?: any) => {
	const { message, code, statusCode } = handlePrismaError(error);

	logger?.error(`Prisma error: ${error.message}`, error);

	// Determine appropriate field name based on error type
	let fieldName = "database";

	// For field selection errors, use "fields"
	if (error.message?.includes("Unknown field") || code === "UNKNOWN_FIELD") {
		fieldName = "fields";
	}
	// For other errors, try to extract model name
	else {
		const modelMatch = error.message?.match(/on model `(\w+)`/);
		if (modelMatch) {
			fieldName = modelMatch[1].toLowerCase();
		}
	}

	return res.status(statusCode).json({
		status: "error",
		message,
		code,
		errors: [{ field: fieldName, message }],
		timestamp: new Date().toISOString(),
	});
};
