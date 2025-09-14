import { ReservationStatus } from "../../generated/prisma";
import {
	ValidationResult,
	validateRequiredString,
	validateObjectId,
	validateEnum,
	validateInteger,
	validateRequiredFields,
} from "../../utils/validationHelper";

// Valid enum values for validation
const validReservationStatuses = Object.values(ReservationStatus);

// Additional guest interface
export interface AdditionalGuest {
	firstName: string;
	lastName: string;
	phone?: string;
}

// Reservation data interface
export interface ReservationCreateData {
	facilityId?: string;
	roomType?: string; // For room type reservations (backward compatibility)
	facilityType?: string; // For facility type reservations (new field name)
	userId?: string;
	// Reservation period (blocks availability)
	reservationDate: string | Date;
	reservationEndDate: string | Date;
	// Actual check-in dates (optional, set during check-in)
	checkInDate?: string | Date;
	checkOutDate?: string | Date;
	guests: number;
	additionalGuests?: AdditionalGuest[];
	specialRequests?: string;
	// User creation fields (when userId is not provided)
	firstName?: string;
	lastName?: string;
	email?: string;
	userName?: string;
	password?: string;
	role?: string;
	subRole?: string;
	organizationId?: string;
	personalInfo?: any;
	contactInfo?: any;
	identification?: any;
}

/**
 * Validates reservation data for creation or update
 */
export const validateReservationData = (data: any, isUpdate: boolean = false): ValidationResult => {
	// Required fields for creation
	if (!isUpdate) {
		// Either facilityId or roomType/facilityType must be provided
		if (!data.facilityId && !data.roomType && !data.facilityType) {
			return {
				isValid: false,
				error: "Either facilityId or facilityType is required",
			};
		}

		// If personId is not provided, we need person creation data
		if (!data.personId) {
			if (!data.firstName || !data.lastName || !data.email) {
				return {
					isValid: false,
					error: "Either personId or person creation data (firstName, lastName, email) is required",
				};
			}

			// Validate email format for new users
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(data.email)) {
				return { isValid: false, error: "Invalid email format" };
			}
		}

		const requiredValidation = validateRequiredFields(data, [
			"reservationDate",
			"reservationEndDate",
			"guests",
		]);
		if (!requiredValidation.isValid) {
			return requiredValidation;
		}

		// Validate facilityId if provided
		if (data.facilityId) {
			const facilityIdValidation = validateObjectId(data.facilityId, "Facility ID");
			if (!facilityIdValidation.isValid) {
				return facilityIdValidation;
			}
		}

		// Validate roomType if provided (backward compatibility)
		if (data.roomType) {
			if (typeof data.roomType !== "string" || !data.roomType.trim()) {
				return { isValid: false, error: "Room type must be a valid string" };
			}
		}

		// Validate facilityType if provided
		if (data.facilityType) {
			if (typeof data.facilityType !== "string" || !data.facilityType.trim()) {
				return { isValid: false, error: "Facility type must be a valid string" };
			}
		}

		// Validate personId if provided
		if (data.personId) {
			const personIdValidation = validateObjectId(data.personId, "Person ID");
			if (!personIdValidation.isValid) {
				return personIdValidation;
			}
		}

		const checkInDateValidation = validateDate(data.checkInDate, "Check-in date");
		if (!checkInDateValidation.isValid) {
			return checkInDateValidation;
		}

		const checkOutDateValidation = validateDate(data.checkOutDate, "Check-out date");
		if (!checkOutDateValidation.isValid) {
			return checkOutDateValidation;
		}

		const guestsValidation = validateInteger(data.guests, "Number of guests", 1);
		if (!guestsValidation.isValid) {
			return guestsValidation;
		}

		// Validate reservation date range
		const dateRangeValidation = validateReservationDateRange(
			data.reservationDate,
			data.reservationEndDate,
		);
		if (!dateRangeValidation.isValid) {
			return dateRangeValidation;
		}

		// Validate reservation date is not in the past
		const reservationFutureValidation = validateReservationDate(data.reservationDate);
		if (!reservationFutureValidation.isValid) {
			return reservationFutureValidation;
		}
	}

	// Optional field validation for both create and update
	if (data.facilityId !== undefined && data.facilityId !== null) {
		const facilityIdValidation = validateObjectId(data.facilityId, "Facility ID");
		if (!facilityIdValidation.isValid) {
			return facilityIdValidation;
		}
	}

	if (data.roomType !== undefined && data.roomType !== null) {
		if (typeof data.roomType !== "string" || !data.roomType.trim()) {
			return { isValid: false, error: "Room type must be a valid string" };
		}
	}

	if (data.facilityType !== undefined && data.facilityType !== null) {
		if (typeof data.facilityType !== "string" || !data.facilityType.trim()) {
			return { isValid: false, error: "Facility type must be a valid string" };
		}
	}

	if (data.personId !== undefined) {
		const personIdValidation = validateObjectId(data.personId, "Person ID");
		if (!personIdValidation.isValid) {
			return personIdValidation;
		}
	}

	if (data.reservationDate !== undefined) {
		const reservationDateValidation = validateDate(data.reservationDate, "Reservation date");
		if (!reservationDateValidation.isValid) {
			return reservationDateValidation;
		}
	}

	if (data.reservationEndDate !== undefined) {
		const reservationEndDateValidation = validateDate(
			data.reservationEndDate,
			"Reservation end date",
		);
		if (!reservationEndDateValidation.isValid) {
			return reservationEndDateValidation;
		}
	}

	if (data.checkInDate !== undefined && data.checkInDate !== null) {
		const checkInDateValidation = validateDate(data.checkInDate, "Check-in date");
		if (!checkInDateValidation.isValid) {
			return checkInDateValidation;
		}
	}

	if (data.checkOutDate !== undefined && data.checkOutDate !== null) {
		const checkOutDateValidation = validateDate(data.checkOutDate, "Check-out date");
		if (!checkOutDateValidation.isValid) {
			return checkOutDateValidation;
		}
	}

	if (data.guests !== undefined) {
		const guestsValidation = validateInteger(data.guests, "Number of guests", 1);
		if (!guestsValidation.isValid) {
			return guestsValidation;
		}
	}

	if (data.status !== undefined) {
		const statusValidation = validateEnum(
			data.status,
			validReservationStatuses,
			"Reservation status",
		);
		if (!statusValidation.isValid) {
			return statusValidation;
		}
	}

	if (data.specialRequests !== undefined && data.specialRequests !== null) {
		if (typeof data.specialRequests !== "string") {
			return { isValid: false, error: "Special requests must be a string" };
		}
	}

	// Validate additional guests
	if (data.additionalGuests !== undefined && data.additionalGuests !== null) {
		const additionalGuestsValidation = validateAdditionalGuests(data.additionalGuests);
		if (!additionalGuestsValidation.isValid) {
			return additionalGuestsValidation;
		}
	}

	// If both dates are provided for update, validate range
	if (data.checkInDate !== undefined && data.checkOutDate !== undefined) {
		const dateRangeValidation = validateDateRange(data.checkInDate, data.checkOutDate);
		if (!dateRangeValidation.isValid) {
			return dateRangeValidation;
		}
	}

	// If both reservation dates are provided for update, validate range
	if (data.reservationDate !== undefined && data.reservationEndDate !== undefined) {
		const dateRangeValidation = validateReservationDateRange(
			data.reservationDate,
			data.reservationEndDate,
		);
		if (!dateRangeValidation.isValid) {
			return dateRangeValidation;
		}
	}

	return { isValid: true };
};

/**
 * Validates reservation ID
 */
export const validateReservationId = (id: string): ValidationResult => {
	if (!id || typeof id !== "string" || !id.trim()) {
		return { isValid: false, error: "Reservation ID is required" };
	}

	return validateObjectId(id, "Reservation ID");
};

/**
 * Validates if update request has at least one field to update
 */
export const validateUpdateFields = (data: any): ValidationResult => {
	if (!data || Object.keys(data).length === 0) {
		return { isValid: false, error: "At least one field is required for update" };
	}
	return { isValid: true };
};

/**
 * Validates date string
 */
const validateDate = (dateString: any, fieldName: string): ValidationResult => {
	if (dateString === null || dateString === undefined) {
		// Allow null or undefined for optional fields
		return { isValid: true };
	}

	const date = new Date(dateString);
	if (isNaN(date.getTime())) {
		return { isValid: false, error: `${fieldName} must be a valid date` };
	}

	return { isValid: true };
};

/**
 * Validates date range (check-out cannot be before check-in)
 */
const validateDateRange = (checkInDate: any, checkOutDate: any): ValidationResult => {
	const checkIn = new Date(checkInDate);
	const checkOut = new Date(checkOutDate);

	if (checkOut < checkIn) {
		return { isValid: false, error: "End date cannot be before start date" };
	}

	return { isValid: true };
};

/**
 * Validates check-in date is not in the past
 */
const validateCheckInDate = (checkInDate: any): ValidationResult => {
	const checkIn = new Date(checkInDate);
	const now = new Date();

	// Set time to start of day for comparison
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const checkInDay = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());

	if (checkInDay < today) {
		return { isValid: false, error: "Check-in date cannot be in the past" };
	}

	return { isValid: true };
};

/**
 * Validates reservation date range (end cannot be before start)
 */
const validateReservationDateRange = (
	reservationDate: any,
	reservationEndDate: any,
): ValidationResult => {
	const startDate = new Date(reservationDate);
	const endDate = new Date(reservationEndDate);

	if (endDate < startDate) {
		return {
			isValid: false,
			error: "Reservation end date cannot be before reservation start date",
		};
	}

	return { isValid: true };
};

/**
 * Validates reservation date is not in the past
 */
const validateReservationDate = (reservationDate: any): ValidationResult => {
	const reservation = new Date(reservationDate);
	const now = new Date();

	// Set time to start of day for comparison
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const reservationDay = new Date(
		reservation.getFullYear(),
		reservation.getMonth(),
		reservation.getDate(),
	);

	if (reservationDay < today) {
		return { isValid: false, error: "Reservation date cannot be in the past" };
	}

	return { isValid: true };
};

/**
 * Validates if a reservation can be modified based on its status
 */
export const validateReservationModification = (status: ReservationStatus): ValidationResult => {
	if (status === ReservationStatus.CHECKED_OUT) {
		return { isValid: false, error: "Cannot modify a checked-out reservation" };
	}

	if (status === ReservationStatus.CANCELLED) {
		return { isValid: false, error: "Cannot modify a cancelled reservation" };
	}

	return { isValid: true };
};

/**
 * Validates status transition
 */
export const validateStatusTransition = (
	currentStatus: ReservationStatus,
	newStatus: ReservationStatus,
): ValidationResult => {
	// Define valid status transitions
	const validTransitions: Record<ReservationStatus, ReservationStatus[]> = {
		[ReservationStatus.PROCESSING]: [ReservationStatus.RESERVED, ReservationStatus.CANCELLED],
		[ReservationStatus.RESERVED]: [
			ReservationStatus.CHECKED_IN,
			ReservationStatus.CANCELLED,
			ReservationStatus.NO_SHOW,
		],
		[ReservationStatus.CHECKED_IN]: [ReservationStatus.CHECKED_OUT],
		[ReservationStatus.CHECKED_OUT]: [], // No transitions from checked out
		[ReservationStatus.CANCELLED]: [], // No transitions from cancelled
		[ReservationStatus.NO_SHOW]: [], // No transitions from no show
	};

	if (validTransitions[currentStatus]?.includes(newStatus)) {
		return { isValid: true };
	}

	return {
		isValid: false,
		error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
	};
};

/**
 * Validates additional guests array
 */
const validateAdditionalGuests = (additionalGuests: any): ValidationResult => {
	if (!Array.isArray(additionalGuests)) {
		return { isValid: false, error: "Additional guests must be an array" };
	}

	for (let i = 0; i < additionalGuests.length; i++) {
		const guest = additionalGuests[i];

		if (!guest || typeof guest !== "object") {
			return {
				isValid: false,
				error: `Guest at index ${i} must be an object`,
			};
		}

		// Validate required fields
		if (!guest.firstName || typeof guest.firstName !== "string") {
			return {
				isValid: false,
				error: `First name is required for guest at index ${i}`,
			};
		}
		if (!guest.lastName || typeof guest.lastName !== "string") {
			return {
				isValid: false,
				error: `Last name is required for guest at index ${i}`,
			};
		}

		// Validate optional phone field
		if (guest.phone !== undefined && typeof guest.phone !== "string") {
			return {
				isValid: false,
				error: `Phone must be a string for guest at index ${i}`,
			};
		}

		// Validate optional gender field
		if (guest.gender !== undefined && typeof guest.gender !== "string") {
			return {
				isValid: false,
				error: `Gender must be a string for guest at index ${i}`,
			};
		}

		// Validate optional age field
		if (guest.age !== undefined && typeof guest.age !== "number") {
			return {
				isValid: false,
				error: `Age must be a number for guest at index ${i}`,
			};
		}

		// Check for unexpected properties
		const allowedKeys = ["firstName", "lastName", "phone", "gender", "age"];
		for (const key in guest) {
			if (!allowedKeys.includes(key)) {
				return {
					isValid: false,
					error: `Unexpected property '${key}' for guest at index ${i}`,
				};
			}
		}
	}

	return { isValid: true };
};
