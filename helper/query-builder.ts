import { Prisma } from "../generated/prisma";

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
