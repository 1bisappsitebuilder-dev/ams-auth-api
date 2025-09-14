import { PrismaClient, RateType, FacilityType } from "../../generated/prisma";
import { getLogger } from "../logger";

const logger = getLogger();
const pricingLogger = logger.child({ module: "pricingCalculation" });

export interface PricingCalculationParams {
	rateType?: RateType; // Optional: Used only for tax/discount rates (no pricing)
	facilityType?: FacilityType & { rateType?: RateType | null }; // Primary source for pricing
	reservationDate: Date;
	reservationEndDate: Date;
	guests?: number;
	basePriceOverride?: number; // Allow manual price override
	uom?: string; // Unit of measurement for pricing calculation (HOUR, DAY, NIGHT)
}

export interface PricingResult {
	basePrice: number;
	duration: number;
	unit: string;
	subtotal: number;
	taxAmount: number;
	discountAmount: number;
	totalAmount: number;
	pricePerUnit: number;
	appliedTax: number;
	appliedDiscount: number;
}

/**
 * Calculate pricing for a reservation based on facility type pricing and rate type tax/discount
 * New Model: FacilityType contains the base price, RateType provides tax/discount rates only
 */
export const calculateReservationPricing = (params: PricingCalculationParams): PricingResult => {
	const {
		rateType,
		facilityType,
		reservationDate,
		reservationEndDate,
		guests = 1,
		basePriceOverride,
		uom,
	} = params;

	try {
		// Determine base price source (priority: override > facilityType)
		let basePrice = basePriceOverride || 0;
		let unit = uom || "night"; // Use provided UOM or default to "night"
		let taxRate = 0;
		let discountRate = 0;

		// Primary source: FacilityType price (new pricing model)
		if (!basePrice && facilityType) {
			basePrice = facilityType.price || 0;
			// If facility type has a linked rate type, use its tax/discount
			const linkedRateType = (facilityType as any).rateType;
			if (linkedRateType) {
				taxRate = linkedRateType.defaultTax || 0;
				discountRate = linkedRateType.defaultDiscount || 0;
			}
		}

		// Fallback: Use standalone rateType for tax/discount only (no pricing)
		if (rateType && !facilityType) {
			taxRate = rateType.defaultTax || 0;
			discountRate = rateType.defaultDiscount || 0;
		}

		// Calculate duration based on unit
		const duration = calculateDuration(reservationDate, reservationEndDate, unit);

		// Calculate pricing
		const pricePerUnit = basePrice;
		const subtotal = basePrice * duration;

		// Apply discount first (as percentage)
		const discountAmount = subtotal * (discountRate / 100);
		const afterDiscount = subtotal - discountAmount;

		// Apply tax on discounted amount (as percentage)
		const taxAmount = afterDiscount * (taxRate / 100);
		const totalAmount = afterDiscount + taxAmount;

		const result: PricingResult = {
			basePrice,
			duration,
			unit,
			subtotal,
			taxAmount: Math.round(taxAmount * 100) / 100,
			discountAmount: Math.round(discountAmount * 100) / 100,
			totalAmount: Math.round(totalAmount * 100) / 100,
			pricePerUnit,
			appliedTax: taxRate,
			appliedDiscount: discountRate,
		};

		pricingLogger.info(`Calculated pricing: ${JSON.stringify(result)}`);
		return result;
	} catch (error) {
		pricingLogger.error(`Error calculating pricing: ${error}`);
		throw new Error(
			`Failed to calculate pricing: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

const calculateDuration = (startDate: Date, endDate: Date, unit: string): number => {
	const timeDiff = endDate.getTime() - startDate.getTime();

	switch (unit.toLowerCase()) {
		case "hour":
			return Math.ceil(timeDiff / (1000 * 60 * 60));
		case "day":
		case "night":
			return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
		case "week":
			return Math.ceil(timeDiff / (1000 * 60 * 60 * 24 * 7));
		case "month":
			return Math.ceil(timeDiff / (1000 * 60 * 60 * 24 * 30));
		default:
			// Default to nights for backward compatibility
			return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
	}
};

/**
 * Get rate type with full details for pricing calculation
 */
export const getRateTypeForPricing = async (
	prisma: PrismaClient,
	rateTypeId: string,
): Promise<RateType | null> => {
	try {
		return await prisma.rateType.findUnique({
			where: { id: rateTypeId },
			include: {
				facilityTypes: true,
			},
		});
	} catch (error) {
		pricingLogger.error(`Error fetching rate type: ${error}`);
		return null;
	}
};

/**
 * Get facility type with rate type for pricing calculation
 */
export const getFacilityTypeForPricing = async (
	prisma: PrismaClient,
	facilityTypeId: string,
): Promise<(FacilityType & { rateType?: RateType | null }) | null> => {
	try {
		return await prisma.facilityType.findUnique({
			where: { id: facilityTypeId },
			include: {
				rateType: true,
			},
		});
	} catch (error) {
		pricingLogger.error(`Error fetching facility type: ${error}`);
		return null;
	}
};

/**
 * Validate pricing calculation parameters
 */
export const validatePricingParams = (
	params: PricingCalculationParams,
): { isValid: boolean; error?: string } => {
	if (!params.reservationDate || !params.reservationEndDate) {
		return { isValid: false, error: "Reservation dates are required" };
	}

	if (params.reservationEndDate <= params.reservationDate) {
		return { isValid: false, error: "End date must be after start date" };
	}

	if (!params.facilityType && !params.basePriceOverride) {
		return {
			isValid: false,
			error: "Facility type (for pricing) or base price override is required",
		};
	}

	return { isValid: true };
};
