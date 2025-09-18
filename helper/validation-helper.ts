import { Request, Response } from "express";
import { buildErrorResponse } from "../helper/error-handler";
import { config } from "../config/constant";
import { Logger } from "winston";

interface ValidationResult {
	isValid: boolean;
	errorResponse?: object;
	validatedParams?: {
		page: number;
		limit: number;
		order: "asc" | "desc";
		fields?: string;
		sort?: string | object;
		document: boolean;
		pagination: boolean;
		count: boolean;
	};
}

export const validateQueryParams = (req: Request, logger: Logger): ValidationResult => {
	const {
		page = 1,
		limit = 10,
		order = "desc",
		fields,
		sort,
		document,
		pagination,
		count,
	} = req.query;

	// Validate page
	const pageNum = Number(page);
	if (isNaN(pageNum) || pageNum < 1) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_PAGE}: ${page}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_PAGE, 400),
		};
	}

	// Validate limit
	const limitNum = Number(limit);
	if (isNaN(limitNum) || limitNum < 1) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_LIMIT}: ${limit}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse(config.ERROR.QUERY_PARAMS.INVALID_LIMIT, 400),
		};
	}

	// Validate order
	if (order && !["asc", "desc"].includes(order as string)) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_ORDER}: ${order}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse(config.ERROR.QUERY_PARAMS.ORDER_MUST_BE_ASC_OR_DESC, 400),
		};
	}

	// Validate fields
	if (fields && typeof fields !== "string") {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_POPULATE}: ${fields}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse(config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING, 400),
		};
	}

	// Validate sort
	if (sort && typeof sort === "string" && sort.startsWith("{")) {
		try {
			JSON.parse(sort);
		} catch (error) {
			logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_SORT}: ${sort}`);
			return {
				isValid: false,
				errorResponse: buildErrorResponse(config.ERROR.QUERY_PARAMS.SORT_MUST_BE_STRING, 400),
			};
		}
	}

	// Validate document
	if (document !== undefined && (typeof document !== "string" || document !== "true")) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_DOCUMENT}: ${document}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse("Document must be 'true'", 400),
		};
	}
	const documentValue = document === "true";

	// Validate pagination
	if (pagination !== undefined && (typeof pagination !== "string" || pagination !== "true")) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_PAGINATION}: ${pagination}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse("Pagination must be 'true'", 400),
		};
	}
	const paginationValue = pagination === "true";

	// Validate count
	if (count !== undefined && (typeof count !== "string" || count !== "true")) {
		logger.error(`${config.ERROR.QUERY_PARAMS.INVALID_COUNT}: ${count}`);
		return {
			isValid: false,
			errorResponse: buildErrorResponse("Count must be 'true'", 400),
		};
	}
	const countValue = count === "true";

	return {
		isValid: true,
		validatedParams: {
			page: pageNum,
			limit: limitNum,
			order: order as "asc" | "desc",
			fields: fields as string | undefined,
			sort: sort as string | undefined,
			document: documentValue,
			pagination: paginationValue,
			count: countValue,
		},
	};
};
