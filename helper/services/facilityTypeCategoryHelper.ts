import { z } from "zod";
import {
	FacilityCategorySchema,
	HotelMetadataSchema,
	GymMetadataSchema,
	RestaurantMetadataSchema,
	SportsCourtMetadataSchema,
	ConferenceRoomMetadataSchema,
	ParkingMetadataSchema,
	AmenitySpaceMetadataSchema,
	OtherMetadataSchema,
	ObjectIdSchema,
} from "../../zod/facilityType.zod";

// Category-specific facility type interfaces
export interface CategoryBasedFacilityType {
	name: string;
	description?: string;
	code?: string;
	category: z.infer<typeof FacilityCategorySchema>;
	organizationId: string;
	price?: number;
	rateTypeId?: string;
	imageUrl?: string[];
	metadata: any; // This will be typed based on category
}

// Hotel facility type
export interface HotelFacilityType extends CategoryBasedFacilityType {
	category: "HOTEL";
	metadata: z.infer<typeof HotelMetadataSchema>;
}

// Gym facility type
export interface GymFacilityType extends CategoryBasedFacilityType {
	category: "GYM";
	metadata: z.infer<typeof GymMetadataSchema>;
}

// Restaurant facility type
export interface RestaurantFacilityType extends CategoryBasedFacilityType {
	category: "RESTAURANT";
	metadata: z.infer<typeof RestaurantMetadataSchema>;
}

// Sports Court facility type
export interface SportsCourtFacilityType extends CategoryBasedFacilityType {
	category: "SPORTS_COURT";
	metadata: z.infer<typeof SportsCourtMetadataSchema>;
}

// Conference Room facility type
export interface ConferenceRoomFacilityType extends CategoryBasedFacilityType {
	category: "CONFERENCE_ROOM";
	metadata: z.infer<typeof ConferenceRoomMetadataSchema>;
}

// Parking facility type
export interface ParkingFacilityType extends CategoryBasedFacilityType {
	category: "PARKING";
	metadata: z.infer<typeof ParkingMetadataSchema>;
}

// Amenity Space facility type
export interface AmenitySpaceFacilityType extends CategoryBasedFacilityType {
	category: "AMENITY_SPACE";
	metadata: z.infer<typeof AmenitySpaceMetadataSchema>;
}

// Other facility type
export interface OtherFacilityType extends CategoryBasedFacilityType {
	category: "OTHER";
	metadata: z.infer<typeof OtherMetadataSchema>;
}

// Union type for all facility types
export type TypedFacilityType =
	| HotelFacilityType
	| GymFacilityType
	| RestaurantFacilityType
	| SportsCourtFacilityType
	| ConferenceRoomFacilityType
	| ParkingFacilityType
	| AmenitySpaceFacilityType
	| OtherFacilityType;

// Category price ranges
export const CATEGORY_PRICE_RANGES = {
	HOTEL: { min: 50.0, max: 1000.0, base: 100.0 },
	GYM: { min: 10.0, max: 100.0, base: 25.0 },
	RESTAURANT: { min: 20.0, max: 200.0, base: 50.0 },
	SPORTS_COURT: { min: 20.0, max: 150.0, base: 40.0 },
	CONFERENCE_ROOM: { min: 30.0, max: 300.0, base: 75.0 },
	PARKING: { min: 5.0, max: 50.0, base: 15.0 },
	AMENITY_SPACE: { min: 10.0, max: 100.0, base: 30.0 },
	OTHER: { min: 10.0, max: 200.0, base: 25.0 },
};

// Required fields for each category
export const CATEGORY_REQUIRED_FIELDS = {
	HOTEL: [
		"name",
		"category",
		"organizationId",
		"metadata.bedType",
		"metadata.bedCount",
		"metadata.maxOccupancy",
	],
	GYM: ["name", "category", "organizationId", "metadata.capacity"],
	RESTAURANT: ["name", "category", "organizationId", "metadata.seatingCapacity"],
	SPORTS_COURT: ["name", "category", "organizationId", "metadata.sportType"],
	CONFERENCE_ROOM: ["name", "category", "organizationId", "metadata.seatingCapacity"],
	PARKING: ["name", "category", "organizationId"],
	AMENITY_SPACE: ["name", "category", "organizationId", "metadata.amenityType"],
	OTHER: ["name", "category", "organizationId", "metadata.customType"],
};

// Validation result interface
export interface ValidationResult {
	success: boolean;
	errors?: Array<{
		field: string;
		message: string;
	}>;
	data?: any;
}

/**
 * Get metadata schema for a specific category
 */
export const getMetadataSchemaForCategory = (category: string) => {
	switch (category) {
		case "HOTEL":
			return HotelMetadataSchema;
		case "GYM":
			return GymMetadataSchema;
		case "RESTAURANT":
			return RestaurantMetadataSchema;
		case "SPORTS_COURT":
			return SportsCourtMetadataSchema;
		case "CONFERENCE_ROOM":
			return ConferenceRoomMetadataSchema;
		case "PARKING":
			return ParkingMetadataSchema;
		case "AMENITY_SPACE":
			return AmenitySpaceMetadataSchema;
		case "OTHER":
			return OtherMetadataSchema;
		default:
			throw new Error(`Unknown category: ${category}`);
	}
};

/**
 * Validate facility type data based on category
 */
export const validateFacilityTypeByCategory = (data: any): ValidationResult => {
	try {
		// First validate the basic structure
		const basicSchema = z.object({
			name: z
				.string()
				.min(1, "Name is required")
				.max(255, "Name must be at most 255 characters"),
			description: z
				.string()
				.max(1000, "Description must be at most 1000 characters")
				.optional(),
			code: z.string().max(50, "Code must be at most 50 characters").optional(),
			category: FacilityCategorySchema,
			organizationId: ObjectIdSchema,
			price: z.number().min(0, "Price must be non-negative").optional(),
			rateTypeId: ObjectIdSchema.optional(),
			imageUrl: z.array(z.string().url("Invalid image URL")).optional(),
			metadata: z.any(),
		});

		const basicValidation = basicSchema.safeParse(data);
		if (!basicValidation.success) {
			return {
				success: false,
				errors: basicValidation.error.errors.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				})),
			};
		}

		const { category, metadata, price } = basicValidation.data;

		// Validate price range for category
		if (price !== undefined) {
			const priceRange =
				CATEGORY_PRICE_RANGES[category as keyof typeof CATEGORY_PRICE_RANGES];
			if (price < priceRange.min || price > priceRange.max) {
				return {
					success: false,
					errors: [
						{
							field: "price",
							message: `Price must be between ${priceRange.min} and ${priceRange.max} for ${category} facilities`,
						},
					],
				};
			}
		}

		// Validate metadata based on category
		const metadataSchema = getMetadataSchemaForCategory(category);
		const metadataValidation = metadataSchema.safeParse(metadata);

		if (!metadataValidation.success) {
			return {
				success: false,
				errors: metadataValidation.error.errors.map((err) => ({
					field: `metadata.${err.path.join(".")}`,
					message: err.message,
				})),
			};
		}

		// Validate required fields
		const requiredFields =
			CATEGORY_REQUIRED_FIELDS[category as keyof typeof CATEGORY_REQUIRED_FIELDS];
		const missingFields: string[] = [];

		for (const field of requiredFields) {
			if (field.includes(".")) {
				const [parent, child] = field.split(".");
				if (parent === "metadata") {
					if (!metadata || metadata[child] === undefined || metadata[child] === null) {
						missingFields.push(field);
					}
				}
			} else {
				if (data[field] === undefined || data[field] === null) {
					missingFields.push(field);
				}
			}
		}

		if (missingFields.length > 0) {
			return {
				success: false,
				errors: missingFields.map((field) => ({
					field,
					message: `${field} is required for ${category} facilities`,
				})),
			};
		}

		return {
			success: true,
			data: {
				...basicValidation.data,
				metadata: metadataValidation.data,
			},
		};
	} catch (error: any) {
		return {
			success: false,
			errors: [
				{
					field: "general",
					message: error.message || "Validation failed",
				},
			],
		};
	}
};

/**
 * Check if price is valid for category
 */
export const isValidPriceForCategory = (category: string, price: number): boolean => {
	const priceRange = CATEGORY_PRICE_RANGES[category as keyof typeof CATEGORY_PRICE_RANGES];
	return priceRange ? price >= priceRange.min && price <= priceRange.max : false;
};

/**
 * Get price range for category
 */
export const getPriceRangeForCategory = (category: string) => {
	return CATEGORY_PRICE_RANGES[category as keyof typeof CATEGORY_PRICE_RANGES];
};

/**
 * Get required fields for category
 */
export const getRequiredFieldsForCategory = (category: string): string[] => {
	return CATEGORY_REQUIRED_FIELDS[category as keyof typeof CATEGORY_REQUIRED_FIELDS] || [];
};

/**
 * Create facility type examples for each category
 */
export const createFacilityTypeExamples = () => {
	return {
		HOTEL: {
			name: "Deluxe Ocean Suite",
			description: "Luxurious suite with panoramic ocean views and premium amenities",
			code: "HOTEL_DELUXE_001",
			category: "HOTEL" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 299.99,
			metadata: {
				bedType: "KING_BED" as const,
				bedCount: 1,
				maxOccupancy: 2,
				amenities: ["ROOM_SERVICE", "CONCIERGE_SERVICE", "SPA_SERVICES"],
				roomFeatures: [
					"WIFI",
					"TELEVISION",
					"MINIBAR",
					"SAFE",
					"BALCONY",
					"JACUZZI",
					"OCEAN_VIEW",
				],
			},
		} satisfies HotelFacilityType,

		GYM: {
			name: "Premium Fitness Center",
			description: "State-of-the-art fitness facility with modern equipment",
			code: "GYM_PREMIUM_001",
			category: "GYM" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 45.0,
			metadata: {
				equipment: ["Treadmills", "Elliptical Machines", "Weight Machines", "Free Weights"],
				hasTrainer: true,
				openingHours: "5:00 AM - 11:00 PM",
				capacity: 50,
				specialtyArea: "Cardio and Strength Training",
			},
		} satisfies GymFacilityType,

		RESTAURANT: {
			name: "Mediterranean Bistro",
			description: "Authentic Mediterranean cuisine with fresh ingredients",
			code: "REST_MED_001",
			category: "RESTAURANT" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 75.0,
			metadata: {
				cuisineType: "Mediterranean",
				seatingCapacity: 80,
				hasDelivery: false,
				hasTakeout: true,
				openingHours: "11:00 AM - 10:00 PM",
				menuUrl: "https://example.com/mediterranean-menu",
				avgMealPrice: 45.5,
			},
		} satisfies RestaurantFacilityType,

		SPORTS_COURT: {
			name: "Championship Tennis Court",
			description: "Professional-grade tennis court with premium clay surface",
			code: "TENNIS_CHAMP_001",
			category: "SPORTS_COURT" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 80.0,
			metadata: {
				sportType: "Tennis",
				surfaceType: "Clay",
				isIndoor: false,
				maxPlayers: 4,
				equipmentProvided: ["Net", "Court Lines", "Ball Storage", "Scoreboard"],
				openingHours: "6:00 AM - 10:00 PM",
			},
		} satisfies SportsCourtFacilityType,

		CONFERENCE_ROOM: {
			name: "Executive Boardroom",
			description: "Premium boardroom for executive meetings",
			code: "CONF_EXEC_001",
			category: "CONFERENCE_ROOM" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 150.0,
			metadata: {
				seatingCapacity: 12,
				hasProjector: true,
				hasWhiteboard: true,
				hasVideoConferencing: true,
				hasAudioSystem: true,
				layout: "Boardroom",
				equipment: ["Smart TV", "Conference Phone", "Wireless Presentation System"],
			},
		} satisfies ConferenceRoomFacilityType,

		PARKING: {
			name: "Premium Valet Parking",
			description: "Full-service valet parking with car care",
			code: "PARK_VALET_001",
			category: "PARKING" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 35.0,
			metadata: {
				vehicleType: "Car",
				isUnderground: true,
				isCovered: true,
				hasElectricCharging: true,
				maxVehicleHeight: 2.1,
				securityLevel: "Valet",
			},
		} satisfies ParkingFacilityType,

		AMENITY_SPACE: {
			name: "Infinity Pool",
			description: "Stunning infinity pool with panoramic views",
			code: "AMEN_POOL_001",
			category: "AMENITY_SPACE" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 45.0,
			metadata: {
				amenityType: "Pool",
				capacity: 50,
				requiresReservation: false,
				openingHours: "6:00 AM - 10:00 PM",
				ageRestriction: "All Ages",
				additionalFees: 0,
			},
		} satisfies AmenitySpaceFacilityType,

		OTHER: {
			name: "Event Hall",
			description: "Multi-purpose event and banquet hall",
			code: "OTHER_EVENT_001",
			category: "OTHER" as const,
			organizationId: "68412c97c0c093fb4f0b0a11",
			price: 120.0,
			metadata: {
				customType: "Event Hall",
				description: "Large versatile space for events, weddings, and conferences",
				features: ["Stage", "Sound System", "Lighting", "Catering Kitchen", "Dance Floor"],
				requirements: ["Event Insurance", "Security Deposit"],
				capacity: 200,
				openingHours: "24/7 with reservation",
			},
		} satisfies OtherFacilityType,
	};
};

/**
 * Preprocess facility type data from form submissions
 */
export const preprocessFacilityTypeData = (rawData: any) => {
	if (!rawData || typeof rawData !== "object") {
		return rawData;
	}

	const processed = { ...rawData };

	// Convert string numbers to actual numbers
	if (processed.price !== undefined && typeof processed.price === "string") {
		const parsedPrice = parseFloat(processed.price);
		if (!isNaN(parsedPrice)) {
			processed.price = parsedPrice;
		}
	}

	// Handle metadata string parsing
	if (processed.metadata && typeof processed.metadata === "string") {
		try {
			processed.metadata = JSON.parse(processed.metadata);
		} catch (error) {
			console.error("Failed to parse metadata:", error);
			processed.metadata = {};
		}
	}

	// Handle array fields in metadata
	if (processed.metadata) {
		Object.keys(processed.metadata).forEach((key) => {
			const value = processed.metadata[key];
			if (
				typeof value === "string" &&
				(key.includes("amenities") || key.includes("Features") || key.includes("equipment"))
			) {
				try {
					processed.metadata[key] = JSON.parse(value);
				} catch {
					processed.metadata[key] = value
						.split(",")
						.map((item: string) => item.trim())
						.filter((item: string) => item);
				}
			}
		});
	}

	// Handle imageUrl array
	if (processed.imageUrl && typeof processed.imageUrl === "string") {
		try {
			processed.imageUrl = JSON.parse(processed.imageUrl);
		} catch {
			processed.imageUrl = processed.imageUrl
				.split(",")
				.map((item: string) => item.trim())
				.filter((item: string) => item);
		}
	}

	return processed;
};

/**
 * Get default metadata for category
 */
export const getDefaultMetadataForCategory = (category: string) => {
	switch (category) {
		case "HOTEL":
			return {
				bedType: "QUEEN_BED",
				bedCount: 1,
				maxOccupancy: 2,
				amenities: [],
				roomFeatures: ["WIFI", "PRIVATE_BATHROOM", "AIR_CONDITIONING"],
			};
		case "GYM":
			return {
				equipment: [],
				hasTrainer: false,
				capacity: 20,
			};
		case "RESTAURANT":
			return {
				seatingCapacity: 50,
				hasDelivery: false,
				hasTakeout: false,
			};
		case "SPORTS_COURT":
			return {
				sportType: "Tennis",
				isIndoor: false,
				equipmentProvided: [],
			};
		case "CONFERENCE_ROOM":
			return {
				seatingCapacity: 10,
				hasProjector: false,
				hasWhiteboard: false,
				hasVideoConferencing: false,
				hasAudioSystem: false,
				equipment: [],
			};
		case "PARKING":
			return {
				vehicleType: "Car",
				isUnderground: false,
				isCovered: false,
				hasElectricCharging: false,
			};
		case "AMENITY_SPACE":
			return {
				amenityType: "Pool",
				requiresReservation: false,
			};
		case "OTHER":
			return {
				customType: "General Facility",
				features: [],
				requirements: [],
			};
		default:
			return {};
	}
};

/**
 * Type guards for runtime checking
 */
export const isTypedFacilityType = (data: any): data is TypedFacilityType => {
	return data && typeof data === "object" && typeof data.category === "string" && data.metadata;
};

export const isHotelFacilityType = (data: any): data is HotelFacilityType => {
	return isTypedFacilityType(data) && data.category === "HOTEL";
};

export const isGymFacilityType = (data: any): data is GymFacilityType => {
	return isTypedFacilityType(data) && data.category === "GYM";
};

export const isRestaurantFacilityType = (data: any): data is RestaurantFacilityType => {
	return isTypedFacilityType(data) && data.category === "RESTAURANT";
};

export const isSportsCourtFacilityType = (data: any): data is SportsCourtFacilityType => {
	return isTypedFacilityType(data) && data.category === "SPORTS_COURT";
};

export const isConferenceRoomFacilityType = (data: any): data is ConferenceRoomFacilityType => {
	return isTypedFacilityType(data) && data.category === "CONFERENCE_ROOM";
};

export const isParkingFacilityType = (data: any): data is ParkingFacilityType => {
	return isTypedFacilityType(data) && data.category === "PARKING";
};

export const isAmenitySpaceFacilityType = (data: any): data is AmenitySpaceFacilityType => {
	return isTypedFacilityType(data) && data.category === "AMENITY_SPACE";
};

export const isOtherFacilityType = (data: any): data is OtherFacilityType => {
	return isTypedFacilityType(data) && data.category === "OTHER";
};
