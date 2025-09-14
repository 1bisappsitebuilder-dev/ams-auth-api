export interface FieldTypeConfig {
	exactMatchFields: string[];
	textSearchFields: string[];
	dateFields: string[];
	arrayFields: string[];
	booleanFields: string[];
	numberFields: string[];
	jsonFields: string[];
}

export interface ModelFilterConfig {
	[modelName: string]: FieldTypeConfig;
}

export interface RelationConfig {
	[relationName: string]: {
		type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
		model: string;
	};
}

export interface AdvancedFilterOptions {
	modelConfigs: ModelFilterConfig;
	relationConfigs: RelationConfig;
	defaultFieldConfig?: FieldTypeConfig;
}

// Default field configurations for common models
export const DEFAULT_MODEL_CONFIGS: ModelFilterConfig = {
	app: {
		exactMatchFields: ["id", "isDeleted"],
		textSearchFields: ["name", "description"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: ["isDeleted", "isActive"],
		numberFields: [],
		jsonFields: ["metadata"],
	},
	module: {
		exactMatchFields: ["id", "appId", "isDeleted"],
		textSearchFields: ["name", "description", "path"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: ["permissions"],
		booleanFields: ["isDeleted", "isActive"],
		numberFields: [],
		jsonFields: ["metadata"],
	},
	facility: {
		exactMatchFields: [
			"id",
			"facilityTypeId",
			"locationId",
			"organizationId",
			"isDeleted",
			"isTimeBased",
		],
		textSearchFields: ["name", "description"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: ["amenities"],
		booleanFields: ["isDeleted", "isTimeBased"],
		numberFields: ["capacity"],
		jsonFields: ["metadata"],
	},
	facilityType: {
		exactMatchFields: ["id", "category", "organizationId", "rateTypeId", "isDeleted"],
		textSearchFields: ["name", "code", "description"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: ["imageUrl", "amenities", "roomFeatures"],
		booleanFields: ["isDeleted"],
		numberFields: ["price", "maxOccupancy"],
		jsonFields: ["metadata"],
	},
	organization: {
		exactMatchFields: ["id", "isDeleted"],
		textSearchFields: ["name", "description", "code"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: ["isDeleted"],
		numberFields: [],
		jsonFields: ["metadata"],
	},
	user: {
		exactMatchFields: ["id", "isDeleted", "roleId", "organizationId"],
		textSearchFields: ["userName", "email"],
		dateFields: ["createdAt", "updatedAt", "lastLogin"],
		arrayFields: [],
		booleanFields: ["isDeleted", "isActive"],
		numberFields: [],
		jsonFields: ["metadata"],
	},
	person: {
		exactMatchFields: ["id", "isDeleted"],
		textSearchFields: [
			"personalInfo.firstName",
			"personalInfo.lastName",
			"contactInfo.email",
			"contactInfo.phones.number",
		],
		dateFields: ["createdAt", "updatedAt", "personalInfo.dateOfBirth"],
		arrayFields: [],
		booleanFields: ["isDeleted", "metadata.isActive", "metadata.isDeleted"],
		numberFields: ["personalInfo.age"],
		jsonFields: ["personalInfo", "contactInfo", "identification", "metadata"],
	},
	reservation: {
		exactMatchFields: ["id", "status", "facilityId", "personId", "reservationNumber"],
		textSearchFields: ["specialRequests", "remarks", "reservationNumber", "facilityType"],
		dateFields: [
			"createdAt",
			"updatedAt",
			"reservationDate",
			"reservationEndDate",
			"checkInDate",
			"checkOutDate",
		],
		arrayFields: [],
		booleanFields: [],
		numberFields: ["guests"],
		jsonFields: [],
	},
	role: {
		exactMatchFields: ["id", "isDeleted"],
		textSearchFields: ["name", "description"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: ["permissions"],
		booleanFields: ["isDeleted"],
		numberFields: [],
		jsonFields: ["metadata"],
	},
	transaction: {
		exactMatchFields: [
			"id",
			"type",
			"status",
			"provider",
			"personId",
			"reservationId",
			"isDeleted",
		],
		textSearchFields: ["providerRef", "currency"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: ["isDeleted"],
		numberFields: ["amount"],
		jsonFields: ["metadata"],
	},
	location: {
		exactMatchFields: ["id", "organizationId"],
		textSearchFields: ["name", "address", "city", "province", "country", "landmark"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: [],
		numberFields: ["latitude", "longitude"],
		jsonFields: ["metadata"],
	},
	appSiteLayout: {
		exactMatchFields: ["id", "userId", "siteId", "status"],
		textSearchFields: ["name", "type"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: [],
		numberFields: [],
		jsonFields: ["config"],
	},
	pageLayout: {
		exactMatchFields: ["id", "userId", "siteId", "status"],
		textSearchFields: ["name", "type"],
		dateFields: ["createdAt", "updatedAt"],
		arrayFields: [],
		booleanFields: [],
		numberFields: [],
		jsonFields: ["config", "sections"],
	},
};

// Default relation configurations
export const DEFAULT_RELATION_CONFIGS: RelationConfig = {
	facilityType: { type: "many-to-one", model: "facilityType" },
	organization: { type: "many-to-one", model: "organization" },
	user: { type: "many-to-one", model: "user" },
	person: { type: "many-to-one", model: "person" },
	role: { type: "many-to-one", model: "role" },
	facility: { type: "many-to-one", model: "facility" },
	location: { type: "many-to-one", model: "location" },
	app: { type: "many-to-one", model: "app" },
	modules: { type: "one-to-many", model: "module" },
	reservations: { type: "one-to-many", model: "reservation" },
	transactions: { type: "one-to-many", model: "transaction" },
	users: { type: "one-to-many", model: "user" },
	facilities: { type: "one-to-many", model: "facility" },
	locations: { type: "one-to-many", model: "location" },
};

export const DEFAULT_FIELD_CONFIG: FieldTypeConfig = {
	exactMatchFields: ["id", "isDeleted"],
	textSearchFields: ["name", "description"],
	dateFields: ["createdAt", "updatedAt"],
	arrayFields: [],
	booleanFields: ["isDeleted"],
	numberFields: [],
	jsonFields: ["metadata"],
};

/**
 * Gets field configuration for a specific model
 */
export const getFieldConfig = (
	modelName: string,
	modelConfigs: ModelFilterConfig,
	defaultConfig: FieldTypeConfig = DEFAULT_FIELD_CONFIG,
): FieldTypeConfig => {
	return modelConfigs[modelName] || defaultConfig;
};

/**
 * Applies field-specific filtering logic based on field type
 */
export const applyFieldFilter = (
	fieldName: string,
	value: any,
	fieldConfig: FieldTypeConfig,
): any => {
	if (fieldConfig.exactMatchFields.includes(fieldName)) {
		// Use exact matching for IDs, enums, booleans, and numbers
		return value;
	} else if (fieldConfig.textSearchFields.includes(fieldName)) {
		// Use contains for text fields
		return {
			contains: value,
			mode: "insensitive",
		};
	} else if (fieldConfig.dateFields.includes(fieldName)) {
		// Handle date fields (support gte, lte, etc.)
		if (typeof value === "object" && value !== null) {
			return value;
		} else {
			return new Date(value);
		}
	} else if (fieldConfig.arrayFields.includes(fieldName)) {
		// Handle array fields
		if (Array.isArray(value)) {
			return { hasSome: value };
		} else {
			return { has: value };
		}
	} else if (fieldConfig.booleanFields.includes(fieldName)) {
		// Handle boolean fields
		if (typeof value === "string") {
			return value.toLowerCase() === "true";
		}
		return Boolean(value);
	} else if (fieldConfig.numberFields.includes(fieldName)) {
		// Handle number fields
		if (typeof value === "object" && value !== null) {
			// Support range queries like { gte: 10, lte: 100 }
			return value;
		}
		return Number(value);
	} else if (fieldConfig.jsonFields.includes(fieldName)) {
		// Handle JSON metadata fields
		return value;
	} else {
		// Default to exact match for unknown fields
		return value;
	}
};

/**
 * Builds nested relation filter conditions
 */
export const buildNestedRelationFilter = (
	filterItem: any,
	options: AdvancedFilterOptions,
	modelName?: string,
): any => {
	const condition: any = {};
	let hasNestedFilters = false;

	Object.keys(filterItem).forEach((key) => {
		if (key.includes(".")) {
			const parts = key.split(".");
			const relationName = parts[0];
			const remainingPath = parts.slice(1).join(".");
			const value = filterItem[key];

			// Check if the first part matches the current model name (self-reference)
			// This handles cases like "person.personalInfo.firstName" when querying Person model
			if (modelName && relationName.toLowerCase() === modelName.toLowerCase()) {
				// This is a self-reference, treat the remaining path as direct nested fields
				const fieldConfig = getFieldConfig(
					modelName,
					options.modelConfigs,
					options.defaultFieldConfig,
				);

				// Handle nested composite types like personalInfo, contactInfo, etc.
				const nestedParts = remainingPath.split(".");
				let currentLevel = condition;

				for (let i = 0; i < nestedParts.length - 1; i++) {
					const part = nestedParts[i];
					if (
						["personalInfo", "contactInfo", "identification", "metadata"].includes(part)
					) {
						if (!currentLevel[part]) {
							currentLevel[part] = { is: {} };
						}
						currentLevel = currentLevel[part].is;
					} else {
						if (!currentLevel[part]) {
							currentLevel[part] = {};
						}
						currentLevel = currentLevel[part];
					}
				}

				// Apply the filter to the final field
				const finalField = nestedParts[nestedParts.length - 1];
				currentLevel[finalField] = applyFieldFilter(finalField, value, fieldConfig);
				hasNestedFilters = true;
				return;
			}

			// Get relation configuration
			const relationConfig = options.relationConfigs[relationName];
			if (!relationConfig) {
				console.warn(`No relation config found for: ${relationName}`);
				return;
			}

			// Get field configuration for the target model
			const fieldConfig = getFieldConfig(
				relationConfig.model,
				options.modelConfigs,
				options.defaultFieldConfig,
			);

			// Initialize the relation condition
			if (!condition[relationName]) {
				if (
					relationConfig.type === "one-to-many" ||
					relationConfig.type === "many-to-many"
				) {
					condition[relationName] = { some: {} };
				} else {
					condition[relationName] = {};
				}
			}

			// Navigate to the correct nesting level
			let currentLevel =
				relationConfig.type === "one-to-many" || relationConfig.type === "many-to-many"
					? condition[relationName].some
					: condition[relationName];

			// Handle further nested relations
			if (remainingPath.includes(".")) {
				const nestedParts = remainingPath.split(".");
				const nestedRelation = nestedParts[0];
				const finalField = nestedParts[nestedParts.length - 1];

				// Navigate through nested relations
				for (let i = 0; i < nestedParts.length - 1; i++) {
					const part = nestedParts[i];
					if (!currentLevel[part]) {
						// Check if this is a known relation or composite type
						const nestedRelationConfig = options.relationConfigs[part];
						if (nestedRelationConfig) {
							if (
								nestedRelationConfig.type === "one-to-many" ||
								nestedRelationConfig.type === "many-to-many"
							) {
								currentLevel[part] = { some: {} };
								currentLevel = currentLevel[part].some;
							} else {
								currentLevel[part] = {};
								currentLevel = currentLevel[part];
							}
						} else if (
							["personalInfo", "contactInfo", "identification", "metadata"].includes(
								part,
							)
						) {
							// Handle composite types
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

				// Apply the filter to the final field
				const finalFieldName = nestedParts[nestedParts.length - 1];
				currentLevel[finalFieldName] = applyFieldFilter(finalFieldName, value, fieldConfig);
			} else {
				// Direct field on the relation
				currentLevel[remainingPath] = applyFieldFilter(remainingPath, value, fieldConfig);
			}

			hasNestedFilters = true;
		}
	});

	return hasNestedFilters ? condition : null;
};

/**
cc * Builds direct field filter conditions (non-nested and composite types)
 */
export const buildDirectFieldFilter = (
	filterItem: any,
	modelName: string,
	options: AdvancedFilterOptions,
): any => {
	const condition: any = {};
	const fieldConfig = getFieldConfig(modelName, options.modelConfigs, options.defaultFieldConfig);
	let hasDirectFilters = false;

	Object.keys(filterItem).forEach((key) => {
		if (!key.includes(".")) {
			// Handle simple direct fields
			const value = filterItem[key];
			condition[key] = applyFieldFilter(key, value, fieldConfig);
			hasDirectFilters = true;
		} else {
			// Handle composite types like personalInfo.firstName
			const parts = key.split(".");
			const firstPart = parts[0];

			// Check if this is a composite type on the current model
			if (["personalInfo", "contactInfo", "identification", "metadata"].includes(firstPart)) {
				const value = filterItem[key];

				// Build nested structure for composite types
				let currentLevel = condition;

				for (let i = 0; i < parts.length - 1; i++) {
					const part = parts[i];
					if (
						["personalInfo", "contactInfo", "identification", "metadata"].includes(part)
					) {
						if (!currentLevel[part]) {
							currentLevel[part] = { is: {} };
						}
						currentLevel = currentLevel[part].is;
					} else {
						if (!currentLevel[part]) {
							currentLevel[part] = {};
						}
						currentLevel = currentLevel[part];
					}
				}

				// Apply the filter to the final field
				const finalField = parts[parts.length - 1];
				currentLevel[finalField] = applyFieldFilter(finalField, value, fieldConfig);
				hasDirectFilters = true;
			}
		}
	});

	return hasDirectFilters ? condition : null;
};

/**
 * Main function to build advanced filter conditions
 */
export const buildAdvancedFilterConditions = <T = any>(
	filters: any[],
	modelName: string,
	options: AdvancedFilterOptions = {
		modelConfigs: DEFAULT_MODEL_CONFIGS,
		relationConfigs: DEFAULT_RELATION_CONFIGS,
		defaultFieldConfig: DEFAULT_FIELD_CONFIG,
	},
): T[] => {
	if (!filters || filters.length === 0) {
		return [];
	}

	const filterConditions: T[] = [];

	filters.forEach((filterItem) => {
		const conditions: any[] = [];

		// Build nested relation filters
		const nestedCondition = buildNestedRelationFilter(filterItem, options, modelName);
		if (nestedCondition) {
			conditions.push(nestedCondition);
		}

		// Build direct field filters
		const directCondition = buildDirectFieldFilter(filterItem, modelName, options);
		if (directCondition) {
			conditions.push(directCondition);
		}

		// Combine conditions for this filter item
		if (conditions.length === 1) {
			filterConditions.push(conditions[0] as T);
		} else if (conditions.length > 1) {
			filterConditions.push({ AND: conditions } as T);
		}
	});

	return filterConditions;
};

/**
 * Enhanced version of buildWhereClause with advanced filtering
 */
export const buildAdvancedWhereClause = <T = any>(
	baseConditions: T,
	modelName: string,
	query?: string,
	searchFields?: string[],
	filters?: any[],
	options?: AdvancedFilterOptions,
): T => {
	const whereClause: any = { ...baseConditions };

	// Add legacy query search if provided
	if (query && searchFields && searchFields.length > 0) {
		const searchConditions = searchFields.map((field) => {
			// Handle nested fields
			if (field.includes(".")) {
				const parts = field.split(".");
				let condition: any = {};
				let current = condition;

				for (let i = 0; i < parts.length - 1; i++) {
					const part = parts[i];
					// Check if this is a composite type that needs 'is' operator
					if (
						["personalInfo", "contactInfo", "identification", "metadata"].includes(part)
					) {
						current[part] = { is: {} };
						current = current[part].is;
					} else if (["users", "reservations", "transactions", "phones"].includes(part)) {
						// Handle one-to-many relations and arrays that need 'some' operator
						current[part] = { some: {} };
						current = current[part].some;
					} else {
						current[part] = {};
						current = current[part];
					}
				}

				const lastPart = parts[parts.length - 1];
				current[lastPart] = { contains: query, mode: "insensitive" };
				return condition;
			} else {
				// Handle direct fields
				return { [field]: { contains: query, mode: "insensitive" } };
			}
		});

		// Add special handling for metadata.roomNumber search
		// Note: JSON field search syntax varies by database type
		// For now, we'll skip JSON field searching until we can implement proper syntax
		// if (modelName === "facility") {
		// 	searchConditions.push({
		// 		metadata: {
		// 			path: ["roomNumber"],
		// 			string_contains: query,
		// 		},
		// 	});
		// }

		// Add special handling for reservation searches in facility metadata
		// if (modelName === "reservation") {
		// 	searchConditions.push({
		// 		facility: {
		// 			metadata: {
		// 				path: ["roomNumber"],
		// 				string_contains: query,
		// 			},
		// 		},
		// 	});
		// }

		whereClause.OR = searchConditions;
	}

	// Add advanced filter if provided
	if (filters && filters.length > 0) {
		const filterConditions = buildAdvancedFilterConditions(filters, modelName, options);
		if (filterConditions.length > 0) {
			if (whereClause.AND) {
				// Ensure AND is always an array
				const existingAnd = Array.isArray(whereClause.AND)
					? whereClause.AND
					: [whereClause.AND];
				whereClause.AND = [...existingAnd, { OR: filterConditions }];
			} else {
				whereClause.AND = [{ OR: filterConditions }];
			}
		}
	}

	return whereClause;
};

/**
 * Helper function to create filter options for a specific model
 */
export const createFilterOptions = (
	customModelConfigs?: Partial<ModelFilterConfig>,
	customRelationConfigs?: Partial<RelationConfig>,
	customDefaultConfig?: Partial<FieldTypeConfig>,
): AdvancedFilterOptions => {
	const modelConfigs: ModelFilterConfig = { ...DEFAULT_MODEL_CONFIGS };
	const relationConfigs: RelationConfig = { ...DEFAULT_RELATION_CONFIGS };
	const defaultFieldConfig: FieldTypeConfig = { ...DEFAULT_FIELD_CONFIG };

	// Only merge defined values to avoid undefined types
	if (customModelConfigs) {
		Object.entries(customModelConfigs).forEach(([key, config]) => {
			if (config) {
				modelConfigs[key] = config;
			}
		});
	}

	if (customRelationConfigs) {
		Object.entries(customRelationConfigs).forEach(([key, config]) => {
			if (config) {
				relationConfigs[key] = config;
			}
		});
	}

	if (customDefaultConfig) {
		Object.entries(customDefaultConfig).forEach(([key, value]) => {
			if (value !== undefined) {
				(defaultFieldConfig as any)[key] = value;
			}
		});
	}

	return {
		modelConfigs,
		relationConfigs,
		defaultFieldConfig,
	};
};

/**
 * Utility to get search fields for basic query search
 */
export const getSearchFields = (
	modelName: string,
	includeRelations: string[] = [],
	options: AdvancedFilterOptions = {
		modelConfigs: DEFAULT_MODEL_CONFIGS,
		relationConfigs: DEFAULT_RELATION_CONFIGS,
		defaultFieldConfig: DEFAULT_FIELD_CONFIG,
	},
): string[] => {
	const fieldConfig = getFieldConfig(modelName, options.modelConfigs, options.defaultFieldConfig);
	const searchFields = [...fieldConfig.textSearchFields];

	// Add relation search fields
	includeRelations.forEach((relationName) => {
		const relationConfig = options.relationConfigs[relationName];
		if (relationConfig) {
			const relationFieldConfig = getFieldConfig(
				relationConfig.model,
				options.modelConfigs,
				options.defaultFieldConfig,
			);
			relationFieldConfig.textSearchFields.forEach((field) => {
				searchFields.push(`${relationName}.${field}`);
			});
		}
	});

	return searchFields;
};
