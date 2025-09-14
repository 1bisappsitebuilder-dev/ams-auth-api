import { Request, Response } from "express";

export interface QueryParams {
	page?: string | number;
	limit?: string | number;
	sort?: string;
	fields?: string;
	query?: string;
	filter?: string | any[];
	order?: string;
	documents?: string | boolean;
	document?: string | boolean; // Accept singular form as well
	pagination?: string | boolean;
	count?: string | boolean;
}

export interface ParsedQueryParams {
	page: number;
	limit: number;
	skip: number;
	sort?: string;
	fields?: string;
	query?: string;
	filter?: any[];
	order: "asc" | "desc";
	documents: boolean;
	pagination: boolean;
	count: boolean;
}

export interface ValidationResult {
	isValid: boolean;
	error?: string;
	statusCode?: number;
	field?: string;
}

const JSON_START_REGEX = /^\s*[{\[]/;

const BOOLEAN_CACHE = new Map([
	["true", true],
	["false", false],
	["1", true],
	["0", false],
	["yes", true],
	["no", false],
]);

const validationCache = new Map<string, ValidationResult>();

const parseBooleanParam = (param: any): boolean => {
	if (typeof param === "boolean") return param;
	if (typeof param === "string") {
		const lower = param.toLowerCase();
		return BOOLEAN_CACHE.get(lower) ?? false;
	}
	return false;
};

export const validatePagination = (page: any, limit: any): ValidationResult => {
	const pageNum = Number(page);
	const limitNum = Number(limit);

	if (pageNum >= 1 && limitNum >= 1 && Number.isInteger(pageNum) && Number.isInteger(limitNum)) {
		return { isValid: true };
	}

	if (!Number.isInteger(pageNum) || pageNum < 1) {
		return {
			isValid: false,
			error: "Invalid page number",
			statusCode: 400,
			field: "page",
		};
	}

	if (!Number.isInteger(limitNum) || limitNum < 1) {
		return {
			isValid: false,
			error: "Invalid limit number",
			statusCode: 400,
			field: "limit",
		};
	}

	return { isValid: true };
};

export const validateOrder = (order: any): ValidationResult => {
	if (!order) return { isValid: true };

	const cacheKey = `order_${order}`;
	let result = validationCache.get(cacheKey);

	if (!result) {
		result =
			order === "asc" || order === "desc"
				? { isValid: true }
				: {
						isValid: false,
						error: "Order must be either 'asc' or 'desc'",
						statusCode: 400,
						field: "order",
					};
		validationCache.set(cacheKey, result);
	}

	return result;
};

export const validateFields = (fields: any): ValidationResult => {
	return !fields || typeof fields === "string"
		? { isValid: true }
		: {
				isValid: false,
				error: "Fields parameter must be a comma-separated string",
				statusCode: 400,
				field: "fields",
			};
};

export const validateSort = (sort: any): ValidationResult => {
	if (!sort) return { isValid: true };

	if (typeof sort === "string" && JSON_START_REGEX.test(sort)) {
		try {
			JSON.parse(sort);
		} catch (error) {
			return {
				isValid: false,
				error: "Sort parameter must be a valid JSON string or field name",
				statusCode: 400,
				field: "sort",
			};
		}
	}

	return { isValid: true };
};

export const validateAndParseFilter = (
	filter: any,
): {
	isValid: boolean;
	parsedFilter?: any[];
	error?: string;
	statusCode?: number;
	field?: string;
} => {
	if (!filter) return { isValid: true, parsedFilter: [] };

	let parsedFilter: any[];

	try {
		if (typeof filter === "string") {
			parsedFilter = JSON.parse(filter);
		} else if (Array.isArray(filter)) {
			parsedFilter = filter;
		} else {
			return {
				isValid: false,
				error: "Filter must be an array of filter objects",
				statusCode: 400,
				field: "filter",
			};
		}

		if (!Array.isArray(parsedFilter)) {
			return {
				isValid: false,
				error: "Filter must be an array of filter objects",
				statusCode: 400,
				field: "filter",
			};
		}
	} catch (error) {
		return {
			isValid: false,
			error: "Filter must be valid JSON array",
			statusCode: 400,
			field: "filter",
		};
	}

	return { isValid: true, parsedFilter };
};

export const validateAndParseQueryParams = (
	queryParams: QueryParams,
): {
	isValid: boolean;
	parsedParams?: ParsedQueryParams;
	error?: string;
	statusCode?: number;
	field?: string;
} => {
	const {
		page = 1,
		limit = 10,
		sort,
		fields,
		query,
		filter,
		order = "desc",
		documents = false,
		document = false,
		pagination = false,
		count = false,
	} = queryParams;

	let result = validatePagination(page, limit);
	if (!result.isValid)
		return {
			isValid: false,
			error: result.error,
			statusCode: result.statusCode,
			field: result.field,
		};

	result = validateOrder(order);
	if (!result.isValid)
		return {
			isValid: false,
			error: result.error,
			statusCode: result.statusCode,
			field: result.field,
		};

	result = validateFields(fields);
	if (!result.isValid)
		return {
			isValid: false,
			error: result.error,
			statusCode: result.statusCode,
			field: result.field,
		};

	result = validateSort(sort);
	if (!result.isValid)
		return {
			isValid: false,
			error: result.error,
			statusCode: result.statusCode,
			field: result.field,
		};

	const filterResult = validateAndParseFilter(filter);
	if (!filterResult.isValid)
		return {
			isValid: false,
			error: filterResult.error,
			statusCode: filterResult.statusCode,
			field: filterResult.field,
		};

	const parsedPage = Number(page);
	const parsedLimit = Number(limit);

	return {
		isValid: true,
		parsedParams: {
			page: parsedPage,
			limit: parsedLimit,
			skip: (parsedPage - 1) * parsedLimit,
			sort: sort as string,
			fields: fields as string,
			query: query as string,
			filter: filterResult.parsedFilter || [],
			order: order as "asc" | "desc",
			documents: parseBooleanParam(documents) || parseBooleanParam(document),
			pagination: parseBooleanParam(pagination),
			count: parseBooleanParam(count),
		},
	};
};

export const buildFieldSelections = (fields: string): Record<string, any> => {
	const result: Record<string, any> = { id: true };

	if (!fields || fields.trim() === "") {
		return result;
	}

	// Known JSON/scalar fields that cannot have nested selections
	const jsonFields = new Set([
		"metadata",
		"devices",
		"personalInfo",
		"contactInfo",
		"identification",
	]);

	const fieldArray = fields.split(",");

	for (let i = 0; i < fieldArray.length; i++) {
		const field = fieldArray[i].trim();

		// Skip empty fields
		if (!field) continue;

		// Validate field name (basic validation - alphanumeric, underscore, dot)
		if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
			continue; // Skip invalid field names
		}

		const parts = field.split(".");

		if (parts.length === 1) {
			// Simple field selection
			result[parts[0]] = true;
		} else {
			// Nested field selection
			let current = result;
			let foundJsonField = false;

			for (let j = 0; j < parts.length - 1; j++) {
				const part = parts[j];

				// Check if current part is a JSON field - if so, we can't go deeper at Prisma level
				if (jsonFields.has(part)) {
					// For JSON fields, we can only select the entire field at Prisma level
					// The filtering of nested JSON properties will be handled post-query
					current[part] = true;
					foundJsonField = true;
					break;
				}

				if (!current[part]) {
					current[part] = { select: {} };
				}
				current = current[part].select;
			}

			// Only add the final field if we didn't encounter a JSON field
			if (!foundJsonField) {
				const finalField = parts[parts.length - 1];

				// Check if the final field is a JSON field
				if (jsonFields.has(finalField)) {
					current[finalField] = true;
				} else {
					current[finalField] = true;
				}
			}
		}
	}

	return result;
};

/**
 * Filters JSON objects based on requested field paths
 * This handles post-query filtering for JSON fields that can't be partially selected at Prisma level
 */
export const filterJsonFields = (data: any, requestedFields: string[]): any => {
	if (!data || !requestedFields.length) return data;

	// Known JSON fields that need post-processing
	const jsonFields = new Set([
		"metadata",
		"devices",
		"personalInfo",
		"contactInfo",
		"identification",
	]);

	// Find all requested paths that involve JSON fields
	const jsonFieldPaths = requestedFields.filter((field) => {
		const parts = field.split(".");
		return parts.some((part) => jsonFields.has(part));
	});

	if (!jsonFieldPaths.length) return data;

	// Create a deep copy to avoid mutating the original data
	const filteredData = JSON.parse(JSON.stringify(data));

	// Process each item in the data (handle both single objects and arrays)
	const processItem = (item: any) => {
		jsonFieldPaths.forEach((fieldPath) => {
			const parts = fieldPath.split(".");

			// Find the JSON field in the path
			let jsonFieldIndex = -1;
			for (let i = 0; i < parts.length; i++) {
				if (jsonFields.has(parts[i])) {
					jsonFieldIndex = i;
					break;
				}
			}

			if (jsonFieldIndex === -1) return;

			// Navigate to the parent of the JSON field
			let current = item;
			for (let i = 0; i < jsonFieldIndex; i++) {
				if (current && typeof current === "object" && current[parts[i]]) {
					current = current[parts[i]];
				} else {
					return; // Path doesn't exist
				}
			}

			// Get the JSON field
			const jsonFieldName = parts[jsonFieldIndex];
			if (!current || !current[jsonFieldName]) return;

			// If we're requesting a nested property within the JSON field
			if (jsonFieldIndex < parts.length - 1) {
				const jsonObject = current[jsonFieldName];
				const nestedPath = parts.slice(jsonFieldIndex + 1);

				// Extract only the requested nested property
				const filteredJsonObject = extractNestedProperty(jsonObject, nestedPath);

				// Replace the entire JSON field with filtered version
				if (filteredJsonObject !== undefined) {
					current[jsonFieldName] = rebuildJsonStructure(nestedPath, filteredJsonObject);
				} else {
					// If the nested property doesn't exist, set to null or remove
					current[jsonFieldName] = null;
				}
			}
			// If we're requesting the entire JSON field, leave it as is
		});
	};

	// Process the data
	if (Array.isArray(filteredData)) {
		filteredData.forEach(processItem);
	} else {
		processItem(filteredData);
	}

	return filteredData;
};

/**
 * Extracts a nested property from a JSON object using a path array
 */
const extractNestedProperty = (obj: any, path: string[]): any => {
	let current = obj;
	for (const key of path) {
		if (current && typeof current === "object" && key in current) {
			current = current[key];
		} else {
			return undefined;
		}
	}
	return current;
};

/**
 * Rebuilds JSON structure with only the requested nested property
 */
const rebuildJsonStructure = (path: string[], value: any): any => {
	if (path.length === 1) {
		return { [path[0]]: value };
	}

	return { [path[0]]: rebuildJsonStructure(path.slice(1), value) };
};

export const buildFilterConditions = <T = any>(filters: any[]): T[] => {
	if (!filters?.length) return [];

	const compositeTypeFields = new Set([
		"personalInfo",
		"contactInfo",
		"identification",
		"metadata",
	]);

	const result: T[] = [];

	for (let i = 0; i < filters.length; i++) {
		const filterObj = filters[i];
		const conditions: any = {};
		const keys = Object.keys(filterObj);

		for (let j = 0; j < keys.length; j++) {
			const key = keys[j];
			const value = filterObj[key];

			if (key.includes(".")) {
				const parts = key.split(".");
				let currentLevel = conditions;

				for (let k = 0; k < parts.length - 1; k++) {
					const part = parts[k];

					if (!currentLevel[part]) {
						if (part.endsWith("s") && k < parts.length - 1) {
							currentLevel[part] = { some: {} };
							currentLevel = currentLevel[part].some;
						} else if (compositeTypeFields.has(part)) {
							currentLevel[part] = { is: {} };
							currentLevel = currentLevel[part].is;
						} else {
							currentLevel[part] = {};
							currentLevel = currentLevel[part];
						}
					} else {
						currentLevel =
							currentLevel[part].some || currentLevel[part].is || currentLevel[part];
					}
				}

				const lastPart = parts[parts.length - 1];
				currentLevel[lastPart] =
					typeof value === "string" ? { contains: value, mode: "insensitive" } : value;
			} else {
				conditions[key] =
					typeof value === "string" ? { contains: value, mode: "insensitive" } : value;
			}
		}

		if (Object.keys(conditions).length > 0) {
			result.push(conditions as T);
		}
	}

	return result;
};

export const buildBasicSearchConditions = (query: string, searchFields: string[]): any => {
	const conditions = new Array(searchFields.length);

	for (let i = 0; i < searchFields.length; i++) {
		const field = searchFields[i];

		if (field.includes(".")) {
			const parts = field.split(".");
			let condition: any = {};
			let current = condition;

			for (let j = 0; j < parts.length - 1; j++) {
				current[parts[j]] = {};
				current = current[parts[j]];
			}

			current[parts[parts.length - 1]] = { contains: query };
			conditions[i] = condition;
		} else {
			conditions[i] = { [field]: { contains: query } };
		}
	}

	return conditions;
};

export const buildWhereClause = <T = any>(
	baseConditions: T,
	query?: string,
	searchFields?: string[],
	filters?: any[],
): T => {
	const whereClause: any = { ...baseConditions };

	if (query && searchFields?.length) {
		whereClause.OR = buildBasicSearchConditions(query, searchFields);
	}

	if (filters?.length) {
		const filterConditions = buildFilterConditions(filters);
		if (filterConditions.length > 0) {
			const andCondition = { OR: filterConditions };
			whereClause.AND = whereClause.AND
				? Array.isArray(whereClause.AND)
					? [...whereClause.AND, andCondition]
					: [whereClause.AND, andCondition]
				: [andCondition];
		}
	}

	return whereClause;
};

export const buildOrderBy = (sort?: string, order: "asc" | "desc" = "desc"): any => {
	// Ensure order has a valid value, default to "desc" if empty or invalid
	const validOrder = order === "asc" || order === "desc" ? order : "desc";

	if (!sort || sort.trim() === "") return { id: validOrder };

	if (typeof sort === "string" && !JSON_START_REGEX.test(sort)) {
		return { [sort.trim()]: validOrder };
	}

	try {
		const parsed = JSON.parse(sort);
		// Validate parsed JSON orderBy object
		if (typeof parsed === "object" && parsed !== null) {
			// Ensure all order values are valid
			const validatedOrder: any = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value === "string" && (value === "asc" || value === "desc")) {
					validatedOrder[key] = value;
				} else {
					validatedOrder[key] = validOrder;
				}
			}
			return Object.keys(validatedOrder).length > 0 ? validatedOrder : { id: validOrder };
		}
		return { id: validOrder };
	} catch (error) {
		return { id: validOrder };
	}
};

export const handleQueryValidation = (
	req: Request,
	res: Response,
	logger?: any,
): ParsedQueryParams | null => {
	const result = validateAndParseQueryParams(req.query);

	if (!result.isValid) {
		logger?.error(`${result.error}: ${JSON.stringify(req.query)}`);
		res.status(result.statusCode!).json({
			status: "error",
			message: result.error,
			code: "VALIDATION_ERROR",
			errors: [{ field: result.field || "query", message: result.error }],
			timestamp: new Date().toISOString(),
		});
		return null;
	}

	return result.parsedParams!;
};

export interface ResponseFormatOptions {
	documents: boolean;
	pagination: boolean;
	count: boolean;
}

const createSuccessResponse = (message: string, data: any) => ({
	status: "success",
	message,
	data,
	timestamp: new Date().toISOString(),
});

export const createDocumentsResponse = <T>(
	data: T[],
	total: number,
	documentType: string,
	summaryFunction?: (data: T[]) => any[],
): any => {
	return createSuccessResponse(`${documentType} documents retrieved successfully`, {
		[documentType]: data,
		totalCount: total,
	});
};

export const createCountResponse = (total: number, entityType: string): any => {
	return createSuccessResponse(`${entityType} count retrieved successfully`, { count: total });
};

export const createStandardPaginatedResponse = <T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
	dataKey: string,
	entityType: string,
): any => {
	const totalPages = Math.ceil(total / limit);

	return createSuccessResponse(`${entityType} retrieved successfully`, {
		[dataKey]: data,
		pagination: {
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	});
};

export const createPaginationOnlyResponse = (
	total: number,
	page: number,
	limit: number,
	entityType: string,
): any => {
	const totalPages = Math.ceil(total / limit);

	return createSuccessResponse(`${entityType} pagination retrieved successfully`, {
		pagination: {
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	});
};

export const createFormattedResponse = <T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
	formatOptions: ResponseFormatOptions,
	entityType: string,
	dataKey: string,
	summaryFunction?: (data: T[]) => any[],
): any => {
	const { documents, pagination, count } = formatOptions;
	const totalPages = Math.ceil(total / limit);

	const flags = (count ? 4 : 0) | (documents ? 2 : 0) | (pagination ? 1 : 0);

	switch (flags) {
		case 7: // All three: count + documents + pagination
			return createSuccessResponse(
				`${entityType} documents, count, and pagination retrieved successfully`,
				{
					[dataKey]: data,
					count: total,
					pagination: {
						total,
						page,
						limit,
						totalPages,
						hasNext: page < totalPages,
						hasPrev: page > 1,
					},
				},
			);

		case 6: // count + documents
			return createSuccessResponse(
				`${entityType} documents and count retrieved successfully`,
				{
					[dataKey]: data,
					count: total,
				},
			);

		case 5: // count + pagination
			return createSuccessResponse(
				`${entityType} pagination and count retrieved successfully`,
				{
					count: total,
					pagination: {
						total,
						page,
						limit,
						totalPages,
						hasNext: page < totalPages,
						hasPrev: page > 1,
					},
				},
			);

		case 4: // count only
			return createCountResponse(total, entityType);

		case 2: // documents only
			return createDocumentsResponse(data, total, dataKey, summaryFunction);

		case 1: // pagination only
			return createPaginationOnlyResponse(total, page, limit, entityType);
		case 3: // documents + pagination
			return createStandardPaginatedResponse(data, total, page, limit, dataKey, entityType);

		default: // No parameters
			return createSuccessResponse(
				`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} endpoint accessed successfully.`,
				{
					message: "No data returned. Please specify query parameters to retrieve data.",
					sampleParameters: {
						document: "Get simplified document format",
						pagination: "Get paginated results",
						count: "Get total count only",
					},
				},
			);
	}
};

export interface PaginatedResponse<T> {
	total: number;
	page: number;
	totalPages: number;
	[key: string]: T[] | number;
}

export const createPaginatedResponse = <T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
	dataKey: string = "data",
): PaginatedResponse<T> => {
	return {
		[dataKey]: data,
		total,
		page,
		totalPages: Math.ceil(total / limit),
	} as PaginatedResponse<T>;
};

export const executeFormattedQuery = async <T>(
	prisma: any,
	model: string,
	whereClause: any,
	parsedParams: ParsedQueryParams,
	entityType: string,
	dataKey: string,
	includeOptions?: any,
	selectOptions?: any,
): Promise<any> => {
	const { page, limit, skip, sort, fields, documents, pagination, count, order } = parsedParams;

	let data: T[] = [];
	let total: number = 0;

	const flags = (count ? 4 : 0) | (documents ? 2 : 0) | (pagination ? 1 : 0);

	try {
		if (flags === 0) {
		} else if (flags === 1) {
			total = await prisma[model].count({ where: whereClause });
		} else if (flags === 4) {
			total = await prisma[model].count({ where: whereClause });
		} else if (flags === 5) {
			total = await prisma[model].count({ where: whereClause });
		} else {
			const findManyQuery: any = {
				where: whereClause,
				skip,
				take: limit,
				orderBy: buildOrderBy(sort, order),
			};

			if (fields && selectOptions) {
				findManyQuery.select = selectOptions;
			} else if (fields) {
				findManyQuery.select = buildFieldSelections(fields);
			} else if (includeOptions) {
				findManyQuery.include = includeOptions;
			}

			[data, total] = await Promise.all([
				prisma[model].findMany(findManyQuery),
				prisma[model].count({ where: whereClause }),
			]);

			// Apply JSON field filtering if fields were specified
			if (fields && data.length > 0) {
				const requestedFields = fields.split(",").map((f) => f.trim());
				data = filterJsonFields(data, requestedFields) as T[];
			}
		}

		const formatOptions: ResponseFormatOptions = { documents, pagination, count };
		return createFormattedResponse(
			data,
			total,
			page,
			limit,
			formatOptions,
			entityType,
			dataKey,
		);
	} catch (error: any) {
		// Re-throw the error to be handled by the calling controller with proper response formatting
		throw error;
	}
};
