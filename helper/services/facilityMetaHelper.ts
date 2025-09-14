import { PrismaClient } from "../../generated/prisma";

/**
 * Search facilities by room number within metadata field
 */
export const findFacilitiesByRoomNumber = async (
	prisma: PrismaClient,
	roomNumber: string,
	organizationId?: string,
) => {
	const facilities = await prisma.facility.findMany({
		where: {
			...(organizationId && { organizationId }),
			metadata: {
				not: null,
			},
		},
		include: {
			facilityType: true,
			organization: true,
		},
	});

	// Filter in JavaScript since Prisma JSON path queries are version-dependent
	return facilities.filter((facility) => {
		if (!facility.metadata || typeof facility.metadata !== "object") return false;
		const meta = facility.metadata as any;
		return meta.roomNumber === roomNumber;
	});
};

/**
 * Search facilities by partial room number match
 */
export const findFacilitiesByRoomNumberPattern = async (
	prisma: PrismaClient,
	pattern: string,
	organizationId?: string,
) => {
	const facilities = await prisma.facility.findMany({
		where: {
			...(organizationId && { organizationId }),
			metadata: {
				not: null,
			},
		},
		include: {
			facilityType: true,
			organization: true,
		},
	});

	// Filter in JavaScript for pattern matching
	return facilities.filter((facility) => {
		if (!facility.metadata || typeof facility.metadata !== "object") return false;
		const meta = facility.metadata as any;
		return meta.roomNumber && String(meta.roomNumber).includes(pattern);
	});
};

/**
 * Get room number from facility metadata
 */
export const getRoomNumberFromMetadata = (facility: any): string | null => {
	if (!facility?.metadata || typeof facility.metadata !== "object") return null;
	const metadata = facility.metadata as any;
	return metadata.roomNumber || null;
};

/**
 * Search facilities by any meta property
 */
export const findFacilitiesByMetaProperty = async (
	prisma: PrismaClient,
	propertyPath: string,
	value: any,
	organizationId?: string,
) => {
	const facilities = await prisma.facility.findMany({
		where: {
			...(organizationId && { organizationId }),
			metadata: {
				not: null,
			},
		},
		include: {
			facilityType: true,
			organization: true,
		},
	});

	// Filter in JavaScript for flexible property matching
	return facilities.filter((facility) => {
		if (!facility.metadata || typeof facility.metadata !== "object") return false;
		const meta = facility.metadata as any;

		// Support dot notation like "amenities.wifi" or simple properties like "roomNumber"
		const keys = propertyPath.split(".");
		let current = meta;

		for (const key of keys) {
			if (current && typeof current === "object" && key in current) {
				current = current[key];
			} else {
				return false;
			}
		}

		return current === value;
	});
};

/**
 * Get all room numbers for facilities of a specific facility type
 */
export const getRoomNumbersForFacilityType = async (
	prisma: PrismaClient,
	facilityTypeId: string,
): Promise<string[]> => {
	const facilities = await prisma.facility.findMany({
		where: {
			facilityTypeId,
			metadata: {
				not: null,
			},
		},
		select: {
			metadata: true,
		},
	});

	return facilities
		.map((facility) => {
			if (!facility.metadata || typeof facility.metadata !== "object") return null;
			const meta = facility.metadata as any;
			return meta.roomNumber;
		})
		.filter((roomNumber): roomNumber is string => roomNumber !== null);
};

/**
 * Check if room number is available (not taken by another facility)
 */
export const isRoomNumberAvailable = async (
	prisma: PrismaClient,
	roomNumber: string,
	organizationId: string,
	excludeFacilityId?: string,
): Promise<boolean> => {
	const existingFacilities = await findFacilitiesByRoomNumber(prisma, roomNumber, organizationId);

	if (excludeFacilityId) {
		return !existingFacilities.some((facility) => facility.id !== excludeFacilityId);
	}

	return existingFacilities.length === 0;
};

/**
 * Update room number in facility meta
 */
export const updateRoomNumberInMeta = async (
	prisma: PrismaClient,
	facilityId: string,
	roomNumber: string,
) => {
	const facility = await prisma.facility.findUnique({
		where: { id: facilityId },
		select: { metadata: true },
	});

	const currentMeta = (facility?.metadata as any) || {};
	const updatedMeta = {
		...currentMeta,
		roomNumber,
	};

	return await prisma.facility.update({
		where: { id: facilityId },
		data: { metadata: updatedMeta },
	});
};

/**
 * Enhanced search that includes metadata field searching
 */
export const searchFacilitiesWithMeta = async (
	prisma: PrismaClient,
	searchTerm: string,
	organizationId?: string,
) => {
	// First get regular search results
	const whereClause: any = {
		...(organizationId && { organizationId }),
		OR: [
			{ name: { contains: searchTerm, mode: "insensitive" } },
			{ description: { contains: searchTerm, mode: "insensitive" } },
			{
				facilityType: {
					name: { contains: searchTerm, mode: "insensitive" },
				},
			},
		],
	};

	const regularResults = await prisma.facility.findMany({
		where: whereClause,
		include: {
			facilityType: true,
			organization: true,
		},
	});

	// Then search in metadata fields
	const metaResults = await findFacilitiesByRoomNumberPattern(prisma, searchTerm, organizationId);

	// Combine and deduplicate results
	const allResults = [...regularResults];
	const existingIds = new Set(regularResults.map((f) => f.id));

	for (const metaResult of metaResults) {
		if (!existingIds.has(metaResult.id)) {
			allResults.push(metaResult);
		}
	}

	return allResults;
};
