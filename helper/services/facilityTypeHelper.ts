import {
	FacilityCategory,
	HotelMetadata,
	GymMetadata,
	RestaurantMetadata,
	SportsCourtMetadata,
	ConferenceRoomMetadata,
	ParkingMetadata,
	AmenitySpaceMetadata,
	OtherMetadata,
	HotelMetadataSchema,
	GymMetadataSchema,
	RestaurantMetadataSchema,
	SportsCourtMetadataSchema,
	ConferenceRoomMetadataSchema,
	ParkingMetadataSchema,
	AmenitySpaceMetadataSchema,
	OtherMetadataSchema,
} from "../../zod/facilityType.zod";

// Type guards for runtime type checking
export const isHotelMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is HotelMetadata => {
	return category === "HOTEL" && HotelMetadataSchema.safeParse(metadata).success;
};

export const isGymMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is GymMetadata => {
	return category === "GYM" && GymMetadataSchema.safeParse(metadata).success;
};

export const isRestaurantMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is RestaurantMetadata => {
	return category === "RESTAURANT" && RestaurantMetadataSchema.safeParse(metadata).success;
};

export const isSportsCourtMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is SportsCourtMetadata => {
	return category === "SPORTS_COURT" && SportsCourtMetadataSchema.safeParse(metadata).success;
};

export const isConferenceRoomMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is ConferenceRoomMetadata => {
	return (
		category === "CONFERENCE_ROOM" && ConferenceRoomMetadataSchema.safeParse(metadata).success
	);
};

export const isParkingMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is ParkingMetadata => {
	return category === "PARKING" && ParkingMetadataSchema.safeParse(metadata).success;
};

export const isAmenitySpaceMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is AmenitySpaceMetadata => {
	return category === "AMENITY_SPACE" && AmenitySpaceMetadataSchema.safeParse(metadata).success;
};

export const isOtherMetadata = (
	category: FacilityCategory,
	metadata: any,
): metadata is OtherMetadata => {
	return category === "OTHER" && OtherMetadataSchema.safeParse(metadata).success;
};

// Utility to validate metadata against facility category
export const validateMetadataForCategory = (category: FacilityCategory, metadata: any) => {
	switch (category) {
		case "HOTEL":
			return { success: isHotelMetadata(category, metadata) };
		case "GYM":
			return { success: isGymMetadata(category, metadata) };
		case "RESTAURANT":
			return { success: isRestaurantMetadata(category, metadata) };
		case "SPORTS_COURT":
			return { success: isSportsCourtMetadata(category, metadata) };
		case "CONFERENCE_ROOM":
			return { success: isConferenceRoomMetadata(category, metadata) };
		case "PARKING":
			return { success: isParkingMetadata(category, metadata) };
		case "AMENITY_SPACE":
			return { success: isAmenitySpaceMetadata(category, metadata) };
		case "OTHER":
			return { success: isOtherMetadata(category, metadata) };
		default:
			return { success: false, error: { message: `Unknown facility category: ${category}` } };
	}
};

// Migration helper for legacy data
export const migrateLegacyFacilityType = (legacyData: any) => {
	// If it already has the new structure, return as is
	if (legacyData.category && legacyData.metadata) {
		return legacyData;
	}

	// Default to HOTEL category for legacy data
	const category: FacilityCategory = "HOTEL";
	const metadata: HotelMetadata = {
		bedType: legacyData.bedType || "SINGLE_BED",
		bedCount: legacyData.bedCount || 1,
		maxOccupancy: legacyData.maxOccupancy || 1,
		amenities: legacyData.amenities || [],
		roomFeatures: legacyData.roomFeatures || [],
	};

	return {
		...legacyData,
		category,
		metadata,
	};
};

// Helper to extract capacity based on facility category
export const getFacilityCapacity = (category: FacilityCategory, metadata: any): number | null => {
	switch (category) {
		case "HOTEL":
			if (isHotelMetadata(category, metadata)) {
				return metadata.maxOccupancy;
			}
			break;
		case "GYM":
			if (isGymMetadata(category, metadata)) {
				return metadata.capacity || null;
			}
			break;
		case "RESTAURANT":
			if (isRestaurantMetadata(category, metadata)) {
				return metadata.seatingCapacity || null;
			}
			break;
		case "SPORTS_COURT":
			if (isSportsCourtMetadata(category, metadata)) {
				return metadata.maxPlayers || null;
			}
			break;
		case "CONFERENCE_ROOM":
			if (isConferenceRoomMetadata(category, metadata)) {
				return metadata.seatingCapacity;
			}
			break;
		case "AMENITY_SPACE":
			if (isAmenitySpaceMetadata(category, metadata)) {
				return metadata.capacity || null;
			}
			break;
		case "OTHER":
			if (isOtherMetadata(category, metadata)) {
				return metadata.capacity || null;
			}
			break;
	}
	return null;
};

// Helper to get opening hours based on facility category
export const getOpeningHours = (category: FacilityCategory, metadata: any): string | null => {
	switch (category) {
		case "HOTEL":
			return "24/7"; // Hotels are typically always open
		case "GYM":
			if (isGymMetadata(category, metadata)) {
				return metadata.openingHours || null;
			}
			break;
		case "RESTAURANT":
			if (isRestaurantMetadata(category, metadata)) {
				return metadata.openingHours || null;
			}
			break;
		case "SPORTS_COURT":
			if (isSportsCourtMetadata(category, metadata)) {
				return metadata.openingHours || null;
			}
			break;
		case "AMENITY_SPACE":
			if (isAmenitySpaceMetadata(category, metadata)) {
				return metadata.openingHours || null;
			}
			break;
		case "OTHER":
			if (isOtherMetadata(category, metadata)) {
				return metadata.openingHours || null;
			}
			break;
	}
	return null;
};

// Helper to check if facility requires reservation
export const requiresReservation = (category: FacilityCategory, metadata: any): boolean => {
	if (category === "AMENITY_SPACE" && isAmenitySpaceMetadata(category, metadata)) {
		return metadata.requiresReservation || false;
	}
	// Default reservation requirements by category
	return ["HOTEL", "CONFERENCE_ROOM"].includes(category);
};

// Helper to extract searchable text from metadata for search functionality
export const getSearchableMetadataText = (category: FacilityCategory, metadata: any): string[] => {
	const searchableText: string[] = [];

	switch (category) {
		case "HOTEL":
			if (isHotelMetadata(category, metadata)) {
				searchableText.push(metadata.bedType);
				searchableText.push(...metadata.amenities);
				searchableText.push(...metadata.roomFeatures);
			}
			break;
		case "GYM":
			if (isGymMetadata(category, metadata)) {
				searchableText.push(...(metadata.equipment || []));
				if (metadata.specialtyArea) searchableText.push(metadata.specialtyArea);
			}
			break;
		case "RESTAURANT":
			if (isRestaurantMetadata(category, metadata)) {
				if (metadata.cuisineType) searchableText.push(metadata.cuisineType);
			}
			break;
		case "SPORTS_COURT":
			if (isSportsCourtMetadata(category, metadata)) {
				searchableText.push(metadata.sportType);
				if (metadata.surfaceType) searchableText.push(metadata.surfaceType);
				searchableText.push(...(metadata.equipmentProvided || []));
			}
			break;
		case "CONFERENCE_ROOM":
			if (isConferenceRoomMetadata(category, metadata)) {
				if (metadata.layout) searchableText.push(metadata.layout);
				searchableText.push(...(metadata.equipment || []));
			}
			break;
		case "PARKING":
			if (isParkingMetadata(category, metadata)) {
				if (metadata.vehicleType) searchableText.push(metadata.vehicleType);
				if (metadata.securityLevel) searchableText.push(metadata.securityLevel);
			}
			break;
		case "AMENITY_SPACE":
			if (isAmenitySpaceMetadata(category, metadata)) {
				searchableText.push(metadata.amenityType);
				if (metadata.ageRestriction) searchableText.push(metadata.ageRestriction);
			}
			break;
		case "OTHER":
			if (isOtherMetadata(category, metadata)) {
				searchableText.push(metadata.customType);
				searchableText.push(...(metadata.features || []));
				searchableText.push(...(metadata.requirements || []));
			}
			break;
	}

	return searchableText;
};

// Helper to create default metadata based on facility category
export const createDefaultMetadata = (category: FacilityCategory): any => {
	switch (category) {
		case "HOTEL":
			return {
				bedType: "SINGLE_BED",
				bedCount: 1,
				maxOccupancy: 1,
				amenities: [],
				roomFeatures: [],
			} as HotelMetadata;
		case "GYM":
			return {
				equipment: [],
				hasTrainer: false,
				openingHours: "6:00 AM - 10:00 PM",
			} as GymMetadata;
		case "RESTAURANT":
			return {
				cuisineType: "International",
				seatingCapacity: 50,
				hasDelivery: false,
				hasTakeout: false,
				openingHours: "9:00 AM - 9:00 PM",
			} as RestaurantMetadata;
		case "SPORTS_COURT":
			return {
				sportType: "Multi-purpose",
				isIndoor: false,
				maxPlayers: 10,
				equipmentProvided: [],
			} as SportsCourtMetadata;
		case "CONFERENCE_ROOM":
			return {
				seatingCapacity: 20,
				hasProjector: false,
				hasWhiteboard: false,
				hasVideoConferencing: false,
				hasAudioSystem: false,
				layout: "Theater",
				equipment: [],
			} as ConferenceRoomMetadata;
		case "PARKING":
			return {
				vehicleType: "Car",
				isUnderground: false,
				isCovered: false,
				hasElectricCharging: false,
			} as ParkingMetadata;
		case "AMENITY_SPACE":
			return {
				amenityType: "General",
				capacity: 10,
				requiresReservation: false,
				openingHours: "9:00 AM - 5:00 PM",
			} as AmenitySpaceMetadata;
		case "OTHER":
			return {
				customType: "Other",
				features: [],
				requirements: [],
			} as OtherMetadata;
		default:
			return {};
	}
};
