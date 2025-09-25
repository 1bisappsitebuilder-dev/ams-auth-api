import { DMMF } from "@prisma/client/runtime/library";
import { Prisma } from "../generated/prisma";

// ✅ Cast Prisma.dmmf (BaseDMMF) into full DMMF.Document
const dmmf: DMMF.Document = Prisma.dmmf as unknown as DMMF.Document;

export const buildFindManyQuery = <T extends any | undefined>(
	whereClause: T,
	skip: number,
	limit: number,
	order: "asc" | "desc",
	sort?: string | object,
	fields?: string,
): any => {
	const query: any = {
		where: whereClause,
		skip,
		take: limit,
		orderBy: sort
			? typeof sort === "string" && !sort.startsWith("{")
				? { [sort]: order }
				: JSON.parse(sort as string)
			: { id: order as Prisma.SortOrder },
	};

	query.select = getNestedFields(fields);

	return query;
};

export const getNestedFields = (fields?: string) => {
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

		return fieldSelections;
	}
};

/**
 * Look up field metadata in Prisma DMMF for a single field
 */
function getFieldMeta(modelName: string, field: string): DMMF.Field | undefined {
	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (model) {
		return model.fields.find((f) => f.name === field);
	}
	const type = dmmf.datamodel.types.find((t) => t.name === modelName);
	if (type) {
		return type.fields.find((f) => f.name === field);
	}
	return undefined;
}

/**
 * Parse value based on field type
 */
function parseValue(field: DMMF.Field, val: string): any {
	switch (field.type) {
		case "String":
			return val;
		case "Int":
		case "BigInt":
			return parseInt(val, 10);
		case "Float":
		case "Decimal":
			return parseFloat(val);
		case "Boolean":
			return val.toLowerCase() === "true" || val.toLowerCase() === "yes" || val === "1";
		case "DateTime":
			return new Date(val);
		case "Json":
			try {
				return JSON.parse(val);
			} catch {
				return val;
			}
		default:
			// Handle enums and other types as strings
			return val;
	}
}

/**
 * Recursively build Prisma filter condition
 */
function buildCondition(modelName: string, path: string[], value: string): any {
	if (path.length === 0) return {};

	// Get metadata for the current (first) field
	const fieldMeta = getFieldMeta(modelName, path[0]);
	if (!fieldMeta) return {};

	// Terminal field (scalar or enum)
	if (path.length === 1) {
		if (fieldMeta.kind === "scalar" || fieldMeta.kind === "enum") {
			const parsedValue = parseValue(fieldMeta, value);
			if (fieldMeta.isList) {
				return { [path[0]]: { has: parsedValue } };
			}
			return { [path[0]]: parsedValue };
		}
		return {}; // Non-scalar/enum terminal fields are not supported for filtering
	}

	// Non-terminal field: recurse
	const nextModelName = fieldMeta.kind === "object" ? fieldMeta.type : modelName;
	const nestedCondition = buildCondition(nextModelName, path.slice(1), value);

	if (Object.keys(nestedCondition).length === 0) return {};

	if (fieldMeta.kind === "object") {
		if (fieldMeta.isList) {
			// For to-many relations or list composites (e.g., contactInfo.phones)
			return {
				[path[0]]: {
					some: fieldMeta.relationName ? nestedCondition : { is: nestedCondition },
				},
			};
		}
		// For to-one relations or composites (e.g., contactInfo, contactInfo.address)
		return { [path[0]]: fieldMeta.relationName ? nestedCondition : { is: nestedCondition } };
	}

	return {};
}

/**
 * Parse ?filter=key:value,key:value into an array of Prisma conditions
 */
export function buildFilterConditions(modelName: string, filterParam?: string): any[] {
	if (!filterParam) return [];

	const items = filterParam.split(",");

	const groups = new Map<string, string[]>();

	for (const item of items) {
		const [rawKey, rawValue] = item.split(":");
		if (!groups.has(rawKey)) {
			groups.set(rawKey, []);
		}
		groups.get(rawKey)!.push(rawValue);
	}

	const conditions: any[] = [];

	for (const [rawKey, values] of groups) {
		const path = rawKey.split(".");
		if (values.length === 1) {
			const condition = buildCondition(modelName, path, values[0]);
			if (Object.keys(condition).length > 0) {
				conditions.push(condition);
			}
		} else {
			const orConditions = values
				.map((v) => buildCondition(modelName, path, v))
				.filter((c) => Object.keys(c).length > 0);
			if (orConditions.length > 0) {
				conditions.push({ OR: orConditions });
			}
		}
	}

	return conditions;
}
