import { PrismaClient, ReservationStatus, FacilityType, Prisma } from "../../generated/prisma";
import { ValidationResult } from "../../utils/validationHelper";

// Facility type availability interface (keeping for backward compatibility)
interface FacilityTypeAvailability {
	facilityType: string; // Changed from roomType to facilityType
	isAvailable: boolean;
	availableCount: number;
	totalCount: number;
	reservedCount: number;
	maintenanceCount: number;
	price?: number;
	facilities?: {
		id: string;
		name: string | null;
		description?: string;
		floor?: any;
		metadata?: any;
	}[];
}

// Detailed facility type availability interface
interface DetailedFacilityTypeAvailability extends Omit<FacilityTypeAvailability, "facilities"> {
	isAvailable: boolean;
	availableCount: number;
	totalCount: number;
	reservedCount: number;
	maintenanceCount: number;
	availableFacilities?: {
		id: string;
		name: string | null;
		description?: string;
		floor?: any;
		metadata?: any;
	}[];
	// Additional facility type fields
	id?: string;
	name?: string;
	code?: string;
	description?: string;
	category?: string;
	metadata?: any; // Polymorphic JSON field containing category-specific data
	organizationId?: string;
	rateTypeId?: string;
	createdAt?: Date;
	updatedAt?: Date;
	imageUrl?: string[];
	// Legacy fields for backward compatibility (deprecated)
	amenities?: string[];
	facilityFeatures?: string[];
	bedType?: string;
	bedCount?: number;
	maxOccupancy?: number;
}

interface FacilityFilter {
	amenities?: string;
	bedType?: string;
	facilityFeatures?: string;
	maxOccupancy?: number;
	priceRange?: {
		min?: number;
		max?: number;
	};
}

interface AvailabilitySearchParams {
	facilityType: string;
	reservationStartDate: Date | string;
	reservationEndDate: Date | string;
	excludeReservationId?: string;
	organizationId?: string;
}

/**
 * Check facility type availability for specific dates
 * @param reservationEndDate The end date of the reservation.
 * @returns An object detailing the availability of the facility type.
 */
export const checkFacilityTypeAvailability = async (
	prisma: PrismaClient,
	{
		facilityType,
		reservationStartDate,
		reservationEndDate,
	}: { facilityType: string; reservationStartDate: Date; reservationEndDate: Date },
): Promise<FacilityTypeAvailability> => {
	// Find all facilities with the specified facility type name
	const facilities = await prisma.facility.findMany({
		where: {
			facilityType: {
				name: facilityType as any, // Use name instead of category
			},
		},
		include: {
			facilityType: {
				select: {
					name: true,
					price: true,
				},
			},
			floor: true,
		},
	});

	// Get all reservations that overlap with the requested date range
	const overlappingReservations = await prisma.reservation.findMany({
		where: {
			OR: [
				{
					AND: [
						{ reservationDate: { lte: reservationEndDate } },
						{ reservationEndDate: { gte: reservationStartDate } },
					],
				},
			],
			status: {
				in: ["RESERVED", "CHECKED_IN"],
			},
		},
		select: {
			facilityId: true,
			facilityType: true,
		},
	});

	// Get all maintenance records that overlap with the requested date range and are PENDING or IN_PROGRESS
	const overlappingMaintenance = await prisma.maintenanceRecord.findMany({
		where: {
			status: {
				in: ["PENDING", "IN_PROGRESS"],
			},
			OR: [
				{
					AND: [
						{ startDate: { lte: reservationEndDate } },
						{ endDate: { gte: reservationStartDate } },
					],
				},
				// Handle cases where endDate is null (ongoing maintenance)
				{
					AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
				},
				// Handle cases where startDate/endDate are null but date falls within range
				{
					AND: [
						{ date: { gte: reservationStartDate } },
						{ date: { lte: reservationEndDate } },
						{ startDate: null },
						{ endDate: null },
					],
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Count reservations for this specific facility type (for facility type reservations without specific facility)
	const facilityTypeReservationsCount = overlappingReservations.filter(
		(reservation) =>
			!reservation.facilityId && reservation.facilityType === (facilityType as string),
	).length;

	// Count reservations for specific facilities of this facility type
	const facilityIds = facilities.map((facility) => facility.id);
	const facilityReservationsCount = overlappingReservations.filter((reservation) =>
		facilityIds.includes(reservation.facilityId || ""),
	).length;

	// Get IDs of facilities that are reserved (have overlapping reservations)
	const reservedFacilityIds = overlappingReservations
		.filter((reservation) => reservation.facilityId)
		.map((reservation) => reservation.facilityId);

	// Get IDs of facilities that are under maintenance
	const maintenanceFacilityIds = overlappingMaintenance.map(
		(maintenance) => maintenance.facilityId,
	);

	// Combine reserved and maintenance facility IDs
	const unavailableFacilityIds = [...reservedFacilityIds, ...maintenanceFacilityIds];

	// Filter out reserved and maintenance facilities to get only available ones
	const availableFacilities = facilities.filter(
		(facility) => !unavailableFacilityIds.includes(facility.id),
	);

	// Calculate available count (use the actual count of available facilities)
	const availableCount = availableFacilities.length;

	return {
		facilityType: facilityType, // Changed field name from roomType to facilityType
		isAvailable: availableCount > 0,
		availableCount,
		totalCount: facilities.length,
		reservedCount: facilityTypeReservationsCount + facilityReservationsCount,
		maintenanceCount: maintenanceFacilityIds.length,
		price: facilities[0]?.facilityType?.price || undefined,
		facilities: availableFacilities.map((facility) => ({
			id: facility.id,
			name: facility.name,
			description: facility.description || undefined,
			floor: facility.floor,
			metadata: facility.metadata || undefined,
		})),
	};
};

/**
 * Get all facility types availability for specific dates
 */
export const checkAllFacilityTypesAvailability = async (
	prisma: PrismaClient,
	{
		reservationStartDate,
		reservationEndDate,
		facilityTypeId,
		code,
		filters,
	}: {
		reservationStartDate: Date;
		reservationEndDate: Date;
		facilityTypeId?: string;
		code?: string;
		filters?: any;
	},
): Promise<DetailedFacilityTypeAvailability[]> => {
	// Base where clause for facilities
	let whereClause: Prisma.FacilityWhereInput = {
		facilityTypeId: {
			not: null,
		},
	};

	// Apply facility filters if provided
	if (filters && Array.isArray(filters) && filters.length > 0) {
		const facilityTypeFilters: Prisma.FacilityTypeWhereInput[] = [];
		const facilityFilters: Prisma.FacilityWhereInput[] = [];

		filters.forEach((filter: any) => {
			// Facility Type level filters
			const facilityTypeCondition: Prisma.FacilityTypeWhereInput = {};

			// Add category filter
			if (filter.category) {
				facilityTypeCondition.category = filter.category;
			}

			// Note: Complex JSON filtering will be implemented later
			// For now, we'll skip the filtering by metadata and rely on post-processing
			// TODO: Implement proper MongoDB JSON query operators for metadata field filtering

			// Facility level filters
			const facilityCondition: Prisma.FacilityWhereInput = {};

			if (filter.name && typeof filter.name === "string") {
				facilityCondition.name = {
					contains: filter.name,
					mode: "insensitive",
				};
			}

			if (filter.priceRange) {
				facilityTypeCondition.price = {};
				if (filter.priceRange.min !== undefined) {
					facilityTypeCondition.price.gte = filter.priceRange.min;
				}
				if (filter.priceRange.max !== undefined) {
					facilityTypeCondition.price.lte = filter.priceRange.max;
				}
			}

			// Add conditions to their respective arrays if they have content
			if (Object.keys(facilityTypeCondition).length > 0) {
				facilityTypeFilters.push(facilityTypeCondition);
			}

			if (Object.keys(facilityCondition).length > 0) {
				facilityFilters.push(facilityCondition);
			}
		});

		if (facilityTypeFilters.length > 0) {
			whereClause.facilityType = {
				OR: facilityTypeFilters,
			};
		}

		if (facilityFilters.length > 0) {
			whereClause = {
				...whereClause,
				OR: facilityFilters,
			};
		}
	}

	// Build facility type where clause
	let facilityTypeWhereClause: Prisma.FacilityTypeWhereInput = {
		facilities: {
			some: whereClause,
		},
	};

	// Filter by specific facility type code if provided
	if (code) {
		facilityTypeWhereClause.code = code;
	}

	// Get all unique facility types with complete data
	const uniqueFacilityTypes = await prisma.facilityType.findMany({
		where: facilityTypeWhereClause,
		select: {
			id: true,
			name: true,
			code: true,
			description: true,
			category: true,
			metadata: true,
			organizationId: true,
			price: true,
			rateTypeId: true,
			createdAt: true,
			updatedAt: true,
			imageUrl: true,
		},
	});

	// Create a map of facility type data by name for easy lookup
	const facilityTypeDataMap = new Map();
	uniqueFacilityTypes.forEach((ft) => {
		facilityTypeDataMap.set(ft.name, ft);
	});

	// Get facility type names for availability check
	const facilityTypeNames = uniqueFacilityTypes.map((ft) => ft.name);

	// Check availability for each facility type name
	const availabilityPromises = facilityTypeNames.map(async (facilityTypeName) => {
		const availability = await checkFacilityTypeAvailability(prisma, {
			facilityType: facilityTypeName,
			reservationStartDate,
			reservationEndDate,
		});

		// Get the complete facility type data
		const facilityTypeData = facilityTypeDataMap.get(facilityTypeName);

		// Keep facilities array in the response
		const { facilities, ...availabilityWithoutFacilities } = availability;

		// Extract metadata from the polymorphic JSON field
		const metadata = facilityTypeData.metadata || {};

		return {
			...availabilityWithoutFacilities,
			availableFacilities: facilities || [], // Include available facilities
			// Include all facility type data
			id: facilityTypeData.id,
			name: facilityTypeData.name,
			code: facilityTypeData.code,
			description: facilityTypeData.description,
			category: facilityTypeData.category,
			metadata: metadata,
			organizationId: facilityTypeData.organizationId,
			rateTypeId: facilityTypeData.rateTypeId,
			createdAt: facilityTypeData.createdAt,
			updatedAt: facilityTypeData.updatedAt,
			imageUrl: facilityTypeData.imageUrl,
			// Legacy fields for backward compatibility (extracted from metadata)
			amenities: metadata.amenities || [],
			facilityFeatures: metadata.roomFeatures || [],
			bedType: metadata.bedType || null,
			bedCount: metadata.bedCount || null,
			maxOccupancy: metadata.maxOccupancy || null,
		} as DetailedFacilityTypeAvailability;
	});

	const results = await Promise.all(availabilityPromises);

	// Post-process filtering for metadata-based filters
	if (filters && Array.isArray(filters) && filters.length > 0) {
		return results.filter((result: DetailedFacilityTypeAvailability) => {
			return filters.every((filter: any) => {
				const metadata = result.metadata || {};

				// Check amenities filter
				if (
					filter.amenities &&
					Array.isArray(filter.amenities) &&
					filter.amenities.length > 0
				) {
					const hasAllAmenities = filter.amenities.every((amenity: string) =>
						(metadata.amenities || []).includes(amenity),
					);
					if (!hasAllAmenities) return false;
				}

				// Check facilityFeatures filter
				if (
					filter.facilityFeatures &&
					Array.isArray(filter.facilityFeatures) &&
					filter.facilityFeatures.length > 0
				) {
					const hasAllFeatures = filter.facilityFeatures.every((feature: string) =>
						(metadata.roomFeatures || []).includes(feature),
					);
					if (!hasAllFeatures) return false;
				}

				// Check bedType filter
				if (filter.bedType && metadata.bedType !== filter.bedType) {
					return false;
				}

				// Check maxOccupancy filter
				if (filter.maxOccupancy && (metadata.maxOccupancy || 0) < filter.maxOccupancy) {
					return false;
				}

				// Check maxOccupancyRange filter
				if (filter.maxOccupancyRange) {
					const maxOccupancy = metadata.maxOccupancy || 0;
					if (
						filter.maxOccupancyRange.min !== undefined &&
						maxOccupancy < filter.maxOccupancyRange.min
					) {
						return false;
					}
					if (
						filter.maxOccupancyRange.max !== undefined &&
						maxOccupancy > filter.maxOccupancyRange.max
					) {
						return false;
					}
				}

				return true;
			});
		});
	}

	return results;
};

/**
 * OPTIMIZED: Get all facility types availability for specific dates with batched queries
 * This version eliminates N+1 queries and reduces database round trips
 */
export const checkAllFacilityTypesAvailabilityOptimized = async (
	prisma: PrismaClient,
	{
		reservationStartDate,
		reservationEndDate,
		facilityTypeId,
		code,
		filters,
	}: {
		reservationStartDate: Date;
		reservationEndDate: Date;
		facilityTypeId?: string;
		code?: string;
		filters?: any;
	},
): Promise<DetailedFacilityTypeAvailability[]> => {
	// Build facility type where clause
	let facilityTypeWhereClause: Prisma.FacilityTypeWhereInput = {};

	// Filter by specific facility type code if provided
	if (code) {
		facilityTypeWhereClause.code = code;
	}

	// Apply basic non-metadata filters at database level
	if (filters && Array.isArray(filters) && filters.length > 0) {
		const facilityTypeFilters: Prisma.FacilityTypeWhereInput[] = [];

		filters.forEach((filter: any) => {
			const facilityTypeCondition: Prisma.FacilityTypeWhereInput = {};

			// Apply price range filter at database level
			if (filter.priceRange) {
				facilityTypeCondition.price = {};
				if (filter.priceRange.min !== undefined) {
					facilityTypeCondition.price.gte = filter.priceRange.min;
				}
				if (filter.priceRange.max !== undefined) {
					facilityTypeCondition.price.lte = filter.priceRange.max;
				}
			}

			if (Object.keys(facilityTypeCondition).length > 0) {
				facilityTypeFilters.push(facilityTypeCondition);
			}
		});

		if (facilityTypeFilters.length > 0) {
			facilityTypeWhereClause = {
				...facilityTypeWhereClause,
				OR: facilityTypeFilters,
			};
		}
	}

	// STEP 1: Get all facility types with their facilities in a single query
	const facilityTypesWithFacilities = await prisma.facilityType.findMany({
		where: {
			...facilityTypeWhereClause,
			facilities: {
				some: {
					facilityTypeId: { not: null },
				},
			},
		},
		select: {
			id: true,
			name: true,
			code: true,
			description: true,
			category: true,
			metadata: true,
			organizationId: true,
			price: true,
			rateTypeId: true,
			createdAt: true,
			updatedAt: true,
			imageUrl: true,
			facilities: {
				select: {
					id: true,
					name: true,
					description: true,
					floor: true,
					metadata: true,
				},
			},
		},
	});

	if (facilityTypesWithFacilities.length === 0) {
		return [];
	}

	// Extract all facility IDs for batch queries
	const allFacilityIds = facilityTypesWithFacilities.flatMap((ft) =>
		ft.facilities.map((f) => f.id),
	);

	// STEP 2: Get all overlapping reservations in a single query
	const overlappingReservations = await prisma.reservation.findMany({
		where: {
			AND: [
				{
					OR: [
						{ facilityId: { in: allFacilityIds } },
						{
							facilityType: {
								in: facilityTypesWithFacilities.map((ft) => ft.name) as any[],
							},
							facilityId: null,
						},
					],
				},
				{
					status: {
						in: ["RESERVED", "CHECKED_IN"],
					},
				},
				{
					OR: [
						{
							reservationDate: { lte: reservationEndDate },
							reservationEndDate: { gte: reservationStartDate },
						},
					],
				},
			],
		},
		select: {
			facilityId: true,
			facilityType: true,
		},
	});

	// STEP 3: Get all overlapping maintenance records in a single query
	const overlappingMaintenance = await prisma.maintenanceRecord.findMany({
		where: {
			facilityId: { in: allFacilityIds },
			status: {
				in: ["PENDING", "IN_PROGRESS"],
			},
			OR: [
				{
					AND: [
						{ startDate: { lte: reservationEndDate } },
						{ endDate: { gte: reservationStartDate } },
					],
				},
				{
					AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
				},
				{
					AND: [
						{ date: { gte: reservationStartDate } },
						{ date: { lte: reservationEndDate } },
						{ startDate: null },
						{ endDate: null },
					],
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Create lookup sets for O(1) performance
	const reservedFacilityIds = new Set(
		overlappingReservations.filter((r) => r.facilityId).map((r) => r.facilityId!),
	);

	const maintenanceFacilityIds = new Set(overlappingMaintenance.map((m) => m.facilityId));

	const unavailableFacilityIds = new Set([...reservedFacilityIds, ...maintenanceFacilityIds]);

	// Count facility type reservations by type
	const facilityTypeReservationCounts = new Map<string, number>();
	overlappingReservations
		.filter((r) => !r.facilityId && r.facilityType)
		.forEach((r) => {
			const count = facilityTypeReservationCounts.get(r.facilityType!) || 0;
			facilityTypeReservationCounts.set(r.facilityType!, count + 1);
		});

	// STEP 4: Process each facility type
	const results: DetailedFacilityTypeAvailability[] = [];

	for (const facilityType of facilityTypesWithFacilities) {
		// Filter available facilities for this type
		const availableFacilities = facilityType.facilities.filter(
			(facility) => !unavailableFacilityIds.has(facility.id),
		);

		// Count reserved facilities for this type
		const reservedFacilitiesCount = facilityType.facilities.filter((facility) =>
			reservedFacilityIds.has(facility.id),
		).length;

		// Count maintenance facilities for this type
		const maintenanceFacilitiesCount = facilityType.facilities.filter((facility) =>
			maintenanceFacilityIds.has(facility.id),
		).length;

		// Count facility type reservations
		const facilityTypeReservationsCount =
			facilityTypeReservationCounts.get(facilityType.name) || 0;

		const totalReservedCount = reservedFacilitiesCount + facilityTypeReservationsCount;
		const availableCount = availableFacilities.length;
		const totalCount = facilityType.facilities.length;

		// Extract metadata
		const metadata = facilityType.metadata || {};

		const result: DetailedFacilityTypeAvailability = {
			facilityType: facilityType.name,
			isAvailable: availableCount > 0,
			availableCount,
			totalCount,
			reservedCount: totalReservedCount,
			maintenanceCount: maintenanceFacilitiesCount,
			availableFacilities: availableFacilities.map((facility) => ({
				id: facility.id,
				name: facility.name,
				description: facility.description || undefined,
				floor: facility.floor,
				metadata: facility.metadata || undefined,
			})),
			// Include all facility type data
			id: facilityType.id,
			name: facilityType.name,
			code: facilityType.code ?? undefined,
			description: facilityType.description ?? undefined,
			category: facilityType.category,
			metadata: metadata,
			organizationId: facilityType.organizationId,
			rateTypeId: facilityType.rateTypeId ?? undefined,
			createdAt: facilityType.createdAt,
			updatedAt: facilityType.updatedAt,
			imageUrl: facilityType.imageUrl,
			// Legacy fields for backward compatibility (extracted from metadata)
			amenities: (metadata as any)?.amenities || [],
			facilityFeatures: (metadata as any)?.roomFeatures || [],
			bedType: (metadata as any)?.bedType || null,
			bedCount: (metadata as any)?.bedCount || null,
			maxOccupancy: (metadata as any)?.maxOccupancy || null,
		};

		results.push(result);
	}

	// STEP 5: Apply metadata-based filters (post-processing)
	if (filters && Array.isArray(filters) && filters.length > 0) {
		return results.filter((result) => {
			return filters.every((filter: any) => {
				const metadata = result.metadata || {};

				// Check amenities filter
				if (
					filter.amenities &&
					Array.isArray(filter.amenities) &&
					filter.amenities.length > 0
				) {
					const hasAllAmenities = filter.amenities.every((amenity: string) =>
						((metadata as any)?.amenities || []).includes(amenity),
					);
					if (!hasAllAmenities) return false;
				}

				// Check facilityFeatures filter
				if (
					filter.facilityFeatures &&
					Array.isArray(filter.facilityFeatures) &&
					filter.facilityFeatures.length > 0
				) {
					const hasAllFeatures = filter.facilityFeatures.every((feature: string) =>
						((metadata as any)?.roomFeatures || []).includes(feature),
					);
					if (!hasAllFeatures) return false;
				}

				// Check bedType filter
				if (filter.bedType && (metadata as any)?.bedType !== filter.bedType) {
					return false;
				}

				// Check maxOccupancy filter
				if (
					filter.maxOccupancy &&
					((metadata as any)?.maxOccupancy || 0) < filter.maxOccupancy
				) {
					return false;
				}

				// Check maxOccupancyRange filter
				if (filter.maxOccupancyRange) {
					const maxOccupancy = (metadata as any)?.maxOccupancy || 0;
					if (
						filter.maxOccupancyRange.min !== undefined &&
						maxOccupancy < filter.maxOccupancyRange.min
					) {
						return false;
					}
					if (
						filter.maxOccupancyRange.max !== undefined &&
						maxOccupancy > filter.maxOccupancyRange.max
					) {
						return false;
					}
				}

				// Check facility name filter
				if (filter.name && typeof filter.name === "string") {
					// This is applied at facility level - check if any facility matches
					// For facility type level, we already have the name, so this filter doesn't apply here
					// TODO: Implement facility-level name filtering if needed
				}

				return true;
			});
		});
	}

	return results;
};

// Helper function for filtered facility type availability
const checkFacilityTypeAvailabilityWithFilters = async (
	prisma: PrismaClient,
	params: {
		facilityType: string;
		reservationStartDate: Date;
		reservationEndDate: Date;
		filters?: any[];
	},
): Promise<FacilityTypeAvailability> => {
	const { facilityType, reservationStartDate, reservationEndDate, filters } = params;

	// Find all facilities with the specified facility type name
	let facilityWhereClause: any = {
		facilityType: {
			name: facilityType as any,
		},
	};

	// Apply filters if provided
	if (filters && Array.isArray(filters) && filters.length > 0) {
		const facilityTypeConditions: any[] = [];

		filters.forEach((filter: any) => {
			const condition: any = {};

			// Note: Complex JSON filtering will be implemented later
			// For now, we'll skip the filtering by metadata and rely on post-processing
			// TODO: Implement proper MongoDB JSON query operators for metadata field filtering

			if (filter.priceRange) {
				condition.price = {};
				if (filter.priceRange.min !== undefined) {
					condition.price.gte = filter.priceRange.min;
				}
				if (filter.priceRange.max !== undefined) {
					condition.price.lte = filter.priceRange.max;
				}
			}

			facilityTypeConditions.push(condition);
		});

		if (facilityTypeConditions.length > 0) {
			facilityWhereClause.facilityType = {
				...facilityWhereClause.facilityType,
				OR: facilityTypeConditions,
			};
		}
	}

	const facilities = await prisma.facility.findMany({
		where: facilityWhereClause,
		include: {
			facilityType: true,
			floor: true,
		},
	});

	// Get all reservations that overlap with the requested date range
	const overlappingReservations = await prisma.reservation.findMany({
		where: {
			OR: [
				{
					AND: [
						{ reservationDate: { lte: reservationEndDate } },
						{ reservationEndDate: { gte: reservationStartDate } },
					],
				},
			],
			status: {
				in: ["RESERVED", "CHECKED_IN"],
			},
		},
		select: {
			facilityId: true,
			facilityType: true,
		},
	});

	// Get all maintenance records that overlap with the requested date range and are PENDING or IN_PROGRESS
	const overlappingMaintenance = await prisma.maintenanceRecord.findMany({
		where: {
			status: {
				in: ["PENDING", "IN_PROGRESS"],
			},
			OR: [
				{
					AND: [
						{ startDate: { lte: reservationEndDate } },
						{ endDate: { gte: reservationStartDate } },
					],
				},
				// Handle cases where endDate is null (ongoing maintenance)
				{
					AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
				},
				// Handle cases where startDate/endDate are null but date falls within range
				{
					AND: [
						{ date: { gte: reservationStartDate } },
						{ date: { lte: reservationEndDate } },
						{ startDate: null },
						{ endDate: null },
					],
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Count reservations for this specific facility type (for facility type reservations without specific facility)
	const facilityTypeReservationsCount = overlappingReservations.filter(
		(reservation) => !reservation.facilityId && reservation.facilityType === facilityType,
	).length;

	// Count reservations for specific facilities of this facility type
	const facilityIds = facilities.map((facility) => facility.id);
	const facilityReservationsCount = overlappingReservations.filter((reservation) =>
		facilityIds.includes(reservation.facilityId || ""),
	).length;

	// Get IDs of facilities that are reserved (have overlapping reservations)
	const reservedFacilityIds = overlappingReservations
		.filter((reservation) => reservation.facilityId)
		.map((reservation) => reservation.facilityId);

	// Get IDs of facilities that are under maintenance
	const maintenanceFacilityIds = overlappingMaintenance.map(
		(maintenance) => maintenance.facilityId,
	);

	// Combine reserved and maintenance facility IDs
	const unavailableFacilityIds = [...reservedFacilityIds, ...maintenanceFacilityIds];

	// Filter out reserved and maintenance facilities to get only available ones
	const availableFacilities = facilities.filter(
		(facility) => !unavailableFacilityIds.includes(facility.id),
	);

	// Calculate available count (use the actual count of available facilities)
	const availableCount = availableFacilities.length;

	return {
		facilityType: facilityType, // Changed field name from roomType to facilityType
		isAvailable: availableCount > 0,
		availableCount,
		totalCount: facilities.length,
		reservedCount: facilityTypeReservationsCount + facilityReservationsCount,
		maintenanceCount: maintenanceFacilityIds.length,
		price: facilities[0]?.facilityType?.price ?? undefined,
		facilities: availableFacilities.map((facility) => ({
			id: facility.id,
			name: facility.name,
			description: facility.description || undefined,
			floor: facility.floor,
			metadata: facility.metadata || undefined,
		})),
	};
};

/**
 * Helper to determine if two date ranges overlap (inclusive)
 */
function isDateRangeOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
	return startA <= endB && endA >= startB;
}

/**
 * Find available facilities with robust overlap checking and logging
 */
const findAvailableFacilitiesWithLock = async (
	prisma: PrismaClient,
	facilityType: string,
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<
	Array<{
		id: string;
		name: string | null;
		description?: string;
		floor?: any;
		roomNumber?: string;
	}>
> => {
	// Find all facilities with the specified facility type name
	const facilities = await prisma.facility.findMany({
		where: {
			facilityType: {
				name: facilityType as any,
			},
		},
		include: {
			facilityType: {
				select: {
					name: true,
					price: true,
				},
			},
			floor: true,
		},
	});

	if (facilities.length === 0) {
		return [];
	}

	// Get all reservations that overlap with the requested date range
	const overlappingReservations = await prisma.reservation.findMany({
		where: {
			facilityId: { in: facilities.map((f) => f.id) },
			status: {
				in: ["RESERVED", "CHECKED_IN"],
			},
			// Overlap condition
			OR: [
				{
					reservationDate: { lte: reservationEndDate },
					reservationEndDate: { gte: reservationStartDate },
				},
			],
		},
		select: {
			id: true,
			facilityId: true,
			reservationDate: true,
			reservationEndDate: true,
			status: true,
		},
	});

	// Get all maintenance records that overlap with the requested date range and are PENDING or IN_PROGRESS
	const overlappingMaintenance = await prisma.maintenanceRecord.findMany({
		where: {
			facilityId: { in: facilities.map((f) => f.id) },
			status: {
				in: ["PENDING", "IN_PROGRESS"],
			},
			OR: [
				{
					AND: [
						{ startDate: { lte: reservationEndDate } },
						{ endDate: { gte: reservationStartDate } },
					],
				},
				// Handle cases where endDate is null (ongoing maintenance)
				{
					AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
				},
				// Handle cases where startDate/endDate are null but date falls within range
				{
					AND: [
						{ date: { gte: reservationStartDate } },
						{ date: { lte: reservationEndDate } },
						{ startDate: null },
						{ endDate: null },
					],
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Debug log: print all overlapping reservations
	if (overlappingReservations.length > 0) {
		console.log(
			"[DEBUG] Overlapping reservations found:",
			overlappingReservations.map((r) => ({
				id: r.id,
				facilityId: r.facilityId,
				reservationDate: r.reservationDate,
				reservationEndDate: r.reservationEndDate,
				status: r.status,
			})),
		);
	}

	// Get IDs of facilities that are reserved (have overlapping reservations)
	const reservedFacilityIds = new Set(overlappingReservations.map((r) => r.facilityId));

	// Get IDs of facilities that are under maintenance
	const maintenanceFacilityIds = new Set(overlappingMaintenance.map((m) => m.facilityId));

	// Combine reserved and maintenance facility IDs
	const unavailableFacilityIds = new Set([...reservedFacilityIds, ...maintenanceFacilityIds]);

	// Filter out reserved and maintenance facilities to get only available ones
	const availableFacilities = facilities.filter(
		(facility) => !unavailableFacilityIds.has(facility.id),
	);

	return availableFacilities.map((facility) => ({
		id: facility.id,
		name: facility.name,
		description: facility.description || undefined,
		floor: facility.floor,
		roomNumber: (facility.metadata as any)?.roomNumber || undefined,
	}));
};

/**
 * Optimized auto-assign room function with robust race condition prevention
 * Uses database-level constraints instead of application-level retries
 */
export const autoAssignRoom = async (
	prisma: Prisma.TransactionClient | PrismaClient,
	reservationId: string,
	dates?: { checkInDate?: Date | string; checkOutDate?: Date | string },
): Promise<{
	success: boolean;
	facilityId?: string;
	error?: string;
	alreadyAssigned?: boolean;
}> => {
	try {
		return await (prisma as PrismaClient).$transaction(
			async (tx) => {
				// Get the reservation with all necessary fields
				let reservation = await tx.reservation.findUnique({
					where: { id: reservationId },
					select: {
						id: true,
						facilityId: true,
						facilityType: true,
						reservationDate: true,
						reservationEndDate: true,
						status: true,
					},
				});

				if (!reservation) {
					throw new Error("Reservation not found.");
				}

				// Check if room is already assigned
				if (reservation.facilityId) {
					// Update dates if provided, then return success with current assignment
					if (dates?.checkInDate || dates?.checkOutDate) {
						const dateUpdateData: { checkInDate?: Date; checkOutDate?: Date } = {};
						if (dates.checkInDate) {
							dateUpdateData.checkInDate = new Date(dates.checkInDate);
						}
						if (dates.checkOutDate) {
							dateUpdateData.checkOutDate = new Date(dates.checkOutDate);
						}
						await tx.reservation.update({
							where: { id: reservationId },
							data: dateUpdateData,
						});
					}

					return {
						success: true,
						facilityId: reservation.facilityId,
						alreadyAssigned: true,
					};
				}

				if (!reservation.facilityType) {
					throw new Error("Reservation is not for a room type, cannot auto-assign.");
				}

				// Update dates if provided
				if (dates?.checkInDate || dates?.checkOutDate) {
					const dateUpdateData: { checkInDate?: Date; checkOutDate?: Date } = {};
					if (dates.checkInDate) {
						dateUpdateData.checkInDate = new Date(dates.checkInDate);
					}
					if (dates.checkOutDate) {
						dateUpdateData.checkOutDate = new Date(dates.checkOutDate);
					}
					reservation = await tx.reservation.update({
						where: { id: reservationId },
						data: dateUpdateData,
						select: {
							id: true,
							facilityId: true,
							facilityType: true,
							reservationDate: true,
							reservationEndDate: true,
							status: true,
						},
					});
				}

				// Use the optimized facility finding function
				const availableFacility = await findAvailableFacility(
					tx,
					reservation.facilityType!,
					reservation.reservationDate,
					reservation.reservationEndDate,
				);

				if (!availableFacility) {
					throw new Error("No available rooms for the specified room type and dates.");
				}

				// Update the reservation with the assigned facility
				await tx.reservation.update({
					where: { id: reservationId },
					data: {
						facilityId: availableFacility.id,
					},
				});

				return {
					success: true,
					facilityId: availableFacility.id,
					alreadyAssigned: false,
				};
			},
			{
				timeout: 10000, // 10 seconds timeout
			},
		);
	} catch (error: any) {
		// Handle specific database errors
		if (error.code === "P2002") {
			// Unique constraint violation - another process got the room
			return {
				success: false,
				error: "Room was just assigned to another reservation. Please try again.",
			};
		}

		// Re-throw other errors
		throw error;
	}
};

/**
 * Ultra-optimized facility finding with atomic operations
 * Uses a single query with proper exclusion logic
 */
export const findAvailableFacilityAtomic = async (
	prisma: PrismaClient | Prisma.TransactionClient,
	facilityType: string,
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<{ id: string; name: string | null; roomNumber?: string } | null> => {
	// Single atomic query that finds the first available facility
	const availableFacility = await prisma.facility.findFirst({
		where: {
			AND: [
				{
					facilityType: {
						name: facilityType as any,
					},
				},

				{
					// Exclude facilities with overlapping reservations
					NOT: {
						reservations: {
							some: {
								AND: [
									{
										status: {
											in: [
												ReservationStatus.RESERVED,
												ReservationStatus.CHECKED_IN,
											],
										},
									},
									{
										OR: [
											{
												reservationDate: { lte: reservationEndDate },
												reservationEndDate: { gte: reservationStartDate },
											},
										],
									},
								],
							},
						},
					},
				},
				{
					// Exclude facilities under maintenance (IN_PROGRESS status)
					NOT: {
						maintenanceRecords: {
							some: {
								AND: [
									{
										status: "IN_PROGRESS",
									},
									{
										OR: [
											{
												AND: [
													{ startDate: { lte: reservationEndDate } },
													{ endDate: { gte: reservationStartDate } },
												],
											},
											// Handle cases where endDate is null (ongoing maintenance)
											{
												AND: [
													{ startDate: { lte: reservationEndDate } },
													{ endDate: null },
												],
											},
										],
									},
								],
							},
						},
					},
				},
			],
		},
		select: {
			id: true,
			name: true,
			metadata: true,
		},
		orderBy: [
			{ name: "asc" }, // Order by name for consistency
		],
	});

	return availableFacility
		? {
				id: availableFacility.id,
				name: availableFacility.name,
				roomNumber: (availableFacility.metadata as any)?.roomNumber || undefined,
			}
		: null;
};

/**
 * Batch atomic facility assignment for multiple reservations
 * More efficient for bulk operations
 */
export const batchAssignFacilities = async (
	prisma: PrismaClient,
	assignments: Array<{
		reservationId: string;
		facilityType: string;
		reservationStartDate: Date;
		reservationEndDate: Date;
	}>,
): Promise<
	Array<{ reservationId: string; success: boolean; facilityId?: string; error?: string }>
> => {
	return await prisma.$transaction(
		async (tx) => {
			const results: Array<{
				reservationId: string;
				success: boolean;
				facilityId?: string;
				error?: string;
			}> = [];

			for (const assignment of assignments) {
				try {
					// Check if reservation already has a facility
					const reservation = await tx.reservation.findUnique({
						where: { id: assignment.reservationId },
						select: { facilityId: true },
					});

					if (!reservation) {
						results.push({
							reservationId: assignment.reservationId,
							success: false,
							error: "Reservation not found",
						});
						continue;
					}

					if (reservation.facilityId) {
						results.push({
							reservationId: assignment.reservationId,
							success: false,
							error: "Reservation already has a facility assigned",
						});
						continue;
					}

					// Find available facility
					const availableFacility = await findAvailableFacilityAtomic(
						tx,
						assignment.facilityType,
						assignment.reservationStartDate,
						assignment.reservationEndDate,
					);

					if (!availableFacility) {
						results.push({
							reservationId: assignment.reservationId,
							success: false,
							error: "No available facilities for the specified type and dates",
						});
						continue;
					}

					// Assign the facility
					await tx.reservation.update({
						where: { id: assignment.reservationId },
						data: { facilityId: availableFacility.id },
					});

					results.push({
						reservationId: assignment.reservationId,
						success: true,
						facilityId: availableFacility.id,
					});
				} catch (error: any) {
					results.push({
						reservationId: assignment.reservationId,
						success: false,
						error: error.message || "Unknown error occurred",
					});
				}
			}

			return results;
		},
		{
			timeout: 30000, // 30 seconds for batch operations
		},
	);
};

/**
 * Check facility availability with optimized queries
 * Uses a single query to get all necessary data including maintenance count
 */
export const checkAvailability = async (
	prisma: PrismaClient,
	facilityType: string,
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<{
	isAvailable: boolean;
	availableCount: number;
	totalCount: number;
	maintenanceCount: number;
	availableFacilities: Array<{ id: string; name: string | null; roomNumber?: string }>;
}> => {
	// Single query to get all facilities and their reservation and maintenance status
	const facilitiesWithReservations = await prisma.facility.findMany({
		where: {
			facilityType: {
				name: facilityType as any,
			},
		},
		select: {
			id: true,
			name: true,
			metadata: true,
			reservations: {
				where: {
					status: {
						in: [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN],
					},
					OR: [
						{
							reservationDate: { lte: reservationEndDate },
							reservationEndDate: { gte: reservationStartDate },
						},
					],
				},
				select: { id: true },
			},
			maintenanceRecords: {
				where: {
					status: {
						in: ["PENDING", "IN_PROGRESS"],
					},
					OR: [
						{
							AND: [
								{ startDate: { lte: reservationEndDate } },
								{ endDate: { gte: reservationStartDate } },
							],
						},
						// Handle cases where endDate is null (ongoing maintenance)
						{
							AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
						},
						// Handle cases where startDate/endDate are null but date falls within range
						{
							AND: [
								{ date: { gte: reservationStartDate } },
								{ date: { lte: reservationEndDate } },
								{ startDate: null },
								{ endDate: null },
							],
						},
					],
				},
				select: { id: true },
			},
		},
		orderBy: [{ name: "asc" }],
	});

	const totalCount = facilitiesWithReservations.length;
	const availableFacilities = facilitiesWithReservations.filter(
		(facility) =>
			facility.reservations.length === 0 && facility.maintenanceRecords.length === 0,
	);
	const availableCount = availableFacilities.length;

	// Calculate maintenance count
	const maintenanceCount = facilitiesWithReservations.filter(
		(facility) => facility.maintenanceRecords.length > 0,
	).length;

	return {
		isAvailable: availableCount > 0,
		availableCount,
		totalCount,
		maintenanceCount,
		availableFacilities: availableFacilities.map((facility) => ({
			id: facility.id,
			name: facility.name,
			roomNumber: (facility.metadata as any)?.roomNumber || undefined,
		})),
	};
};

/**
 * Validate room type availability request
 */
export const validateAvailabilityRequest = (data: any): ValidationResult => {
	if (!data.facilityType || typeof data.facilityType !== "string") {
		return { isValid: false, error: "Facility type is required and must be a string" };
	}

	if (!data.reservationStartDate) {
		return { isValid: false, error: "Reservation start date is required" };
	}

	if (!data.reservationEndDate) {
		return { isValid: false, error: "Reservation end date is required" };
	}

	const reservationStartDate = new Date(data.reservationStartDate);
	const reservationEndDate = new Date(data.reservationEndDate);

	if (isNaN(reservationStartDate.getTime())) {
		return { isValid: false, error: "Reservation start date must be a valid date" };
	}

	if (isNaN(reservationEndDate.getTime())) {
		return { isValid: false, error: "Reservation end date must be a valid date" };
	}

	if (reservationEndDate < reservationStartDate) {
		return {
			isValid: false,
			error: "Reservation end date cannot be before reservation start date",
		};
	}

	// Validate reservation start date is not in the past
	const today = new Date();
	const reservationDay = new Date(
		reservationStartDate.getFullYear(),
		reservationStartDate.getMonth(),
		reservationStartDate.getDate(),
	);
	const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

	if (reservationDay < todayDay) {
		return { isValid: false, error: "Reservation start date cannot be in the past" };
	}

	return { isValid: true };
};

/**
 * Get available facility types for a specific date range
 */
export const getAvailableFacilityTypes = async (
	prisma: PrismaClient,
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<string[]> => {
	const availability = await checkAllFacilityTypesAvailability(prisma, {
		reservationStartDate,
		reservationEndDate,
	});

	return availability
		.filter((facilityType) => facilityType.isAvailable)
		.map((facilityType) => facilityType.facilityType); // Changed from roomType to facilityType
};

/**
 * Optimized facility finding with minimal queries and better performance
 * This version uses a single query with proper indexing strategy
 */
export const findAvailableFacility = async (
	prisma: PrismaClient | Prisma.TransactionClient,
	facilityType: string,
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<{ id: string; name: string | null; roomNumber?: string } | null> => {
	// Use a single optimized query that leverages database indexes
	const availableFacility = await prisma.facility.findFirst({
		where: {
			AND: [
				{
					facilityType: {
						name: facilityType as any,
					},
				},

				{
					// Use NOT EXISTS pattern for better performance
					NOT: {
						reservations: {
							some: {
								AND: [
									{
										status: {
											in: [
												ReservationStatus.RESERVED,
												ReservationStatus.CHECKED_IN,
											],
										},
									},
									{
										OR: [
											{
												reservationDate: { lte: reservationEndDate },
												reservationEndDate: { gte: reservationStartDate },
											},
										],
									},
								],
							},
						},
					},
				},
				{
					// Exclude facilities under maintenance (PENDING or IN_PROGRESS status)
					NOT: {
						maintenanceRecords: {
							some: {
								AND: [
									{
										status: {
											in: ["PENDING", "IN_PROGRESS"],
										},
									},
									{
										OR: [
											{
												AND: [
													{ startDate: { lte: reservationEndDate } },
													{ endDate: { gte: reservationStartDate } },
												],
											},
											// Handle cases where endDate is null (ongoing maintenance)
											{
												AND: [
													{ startDate: { lte: reservationEndDate } },
													{ endDate: null },
												],
											},
											// Handle cases where startDate/endDate are null but date falls within range
											{
												AND: [
													{ date: { gte: reservationStartDate } },
													{ date: { lte: reservationEndDate } },
													{ startDate: null },
													{ endDate: null },
												],
											},
										],
									},
								],
							},
						},
					},
				},
			],
		},
		select: {
			id: true,
			name: true,
			metadata: true,
		},
		orderBy: [
			{ name: "asc" }, // Order by name for consistency
		],
	});

	return availableFacility
		? {
				id: availableFacility.id,
				name: availableFacility.name,
				roomNumber: (availableFacility.metadata as any)?.roomNumber || undefined,
			}
		: null;
};

/**
 * Batch facility availability check for multiple facility types
 * More efficient when checking availability for multiple types at once
 */
export const checkMultipleFacilityTypesAvailability = async (
	prisma: PrismaClient | Prisma.TransactionClient,
	facilityTypes: string[],
	reservationStartDate: Date,
	reservationEndDate: Date,
): Promise<Record<string, { id: string; name: string | null; roomNumber?: string } | null>> => {
	// Get all facilities of the specified types in one query
	const allFacilities = await prisma.facility.findMany({
		where: {
			facilityType: {
				name: { in: facilityTypes as any[] },
			},
		},
		select: {
			id: true,
			name: true,
			metadata: true,
			facilityType: {
				select: {
					name: true,
				},
			},
		},
		orderBy: [{ name: "asc" }],
	});

	// Get all overlapping reservations for these facilities in one query
	const overlappingReservations = await prisma.reservation.findMany({
		where: {
			facilityId: { in: allFacilities.map((f) => f.id) },
			status: {
				in: [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN],
			},
			OR: [
				{
					reservationDate: { lte: reservationEndDate },
					reservationEndDate: { gte: reservationStartDate },
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Get all overlapping maintenance records for these facilities
	const overlappingMaintenance = await prisma.maintenanceRecord.findMany({
		where: {
			facilityId: { in: allFacilities.map((f) => f.id) },
			status: {
				in: ["PENDING", "IN_PROGRESS"],
			},
			OR: [
				{
					AND: [
						{ startDate: { lte: reservationEndDate } },
						{ endDate: { gte: reservationStartDate } },
					],
				},
				// Handle cases where endDate is null (ongoing maintenance)
				{
					AND: [{ startDate: { lte: reservationEndDate } }, { endDate: null }],
				},
				// Handle cases where startDate/endDate are null but date falls within range
				{
					AND: [
						{ date: { gte: reservationStartDate } },
						{ date: { lte: reservationEndDate } },
						{ startDate: null },
						{ endDate: null },
					],
				},
			],
		},
		select: {
			facilityId: true,
		},
	});

	// Create a set of reserved facility IDs for O(1) lookup
	const reservedFacilityIds = new Set(overlappingReservations.map((r) => r.facilityId));

	// Create a set of maintenance facility IDs for O(1) lookup
	const maintenanceFacilityIds = new Set(overlappingMaintenance.map((m) => m.facilityId));

	// Combine reserved and maintenance facility IDs
	const unavailableFacilityIds = new Set([...reservedFacilityIds, ...maintenanceFacilityIds]);

	// Group facilities by type and find the first available for each type
	const facilitiesByType = new Map<string, typeof allFacilities>();
	allFacilities.forEach((facility) => {
		const typeName = facility.facilityType?.name;
		if (typeName) {
			if (!facilitiesByType.has(typeName)) {
				facilitiesByType.set(typeName, []);
			}
			facilitiesByType.get(typeName)!.push(facility);
		}
	});

	// Find first available facility for each type
	const result: Record<string, { id: string; name: string | null; roomNumber?: string } | null> =
		{};

	facilityTypes.forEach((typeName) => {
		const facilities = facilitiesByType.get(typeName) || [];
		const availableFacility = facilities.find((f) => !unavailableFacilityIds.has(f.id));

		result[typeName] = availableFacility
			? {
					id: availableFacility.id,
					name: availableFacility.name,
					roomNumber: (availableFacility.metadata as any)?.roomNumber || undefined,
				}
			: null;
	});

	return result;
};
