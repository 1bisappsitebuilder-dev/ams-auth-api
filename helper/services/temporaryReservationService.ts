import { PrismaClient, Prisma, TemporaryReservationStatus } from "../../generated/prisma";
import { getLogger } from "../logger";

const logger = getLogger();
const tempReservationLogger = logger.child({ module: "temporaryReservation" });

export interface TemporaryReservationData {
	facilityId?: string;
	facilityType?: string;
	userId: string;
	frontdeskUserId: string;
	sessionId: string;
	reservationDate: Date;
	reservationEndDate: Date;
	guests: number;
	specialRequests?: string;
	pricePerNight?: number;
	totalAmount?: number;
	holdDurationMinutes?: number; // Default 10 minutes
}

export interface TemporaryReservationResult {
	success: boolean;
	temporaryReservationId?: string;
	error?: string;
	conflictingReservation?: any;
}

/**
 * Create a temporary reservation to hold a room/facility
 */
export const createTemporaryReservation = async (
	prisma: PrismaClient,
	data: TemporaryReservationData,
): Promise<TemporaryReservationResult> => {
	try {
		const holdDurationMinutes = data.holdDurationMinutes || 10;
		const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

		// Use transaction to ensure atomicity
		const result = await prisma.$transaction(async (tx) => {
			// Check if there's already an active temporary reservation for this facility/dates
			const existingTempReservation = await tx.temporaryReservation.findFirst({
				where: {
					facilityId: data.facilityId,
					facilityType: data.facilityType,
					reservationDate: { lte: data.reservationEndDate },
					reservationEndDate: { gte: data.reservationDate },
					status: TemporaryReservationStatus.PENDING,
					expiresAt: { gt: new Date() }, // Not expired
				},
				include: {
					frontdeskUser: {
						select: {
							userName: true,
							email: true,
						},
					},
				},
			});

			if (existingTempReservation) {
				return {
					success: false,
					error: `Room is temporarily held by ${existingTempReservation.frontdeskUser.userName} until ${existingTempReservation.expiresAt.toISOString()}`,
					conflictingReservation: existingTempReservation,
				};
			}

			// Check for actual confirmed reservations
			const existingReservation = await tx.reservation.findFirst({
				where: {
					OR: [
						{
							facilityId: data.facilityId,
							reservationDate: { lte: data.reservationEndDate },
							reservationEndDate: { gte: data.reservationDate },
						},
						{
							facilityType: data.facilityType,
							facilityId: null,
							reservationDate: { lte: data.reservationEndDate },
							reservationEndDate: { gte: data.reservationDate },
						},
					],
					status: {
						in: ["RESERVED", "CHECKED_IN"],
					},
				},
			});

			if (existingReservation) {
				return {
					success: false,
					error: "Room is already reserved for the selected dates",
					conflictingReservation: existingReservation,
				};
			}

			// Create the temporary reservation
			const temporaryReservation = await tx.temporaryReservation.create({
				data: {
					facilityId: data.facilityId,
					facilityType: data.facilityType,
					userId: data.userId,
					frontdeskUserId: data.frontdeskUserId,
					sessionId: data.sessionId,
					reservationDate: data.reservationDate,
					reservationEndDate: data.reservationEndDate,
					guests: data.guests,
					specialRequests: data.specialRequests,
					pricePerNight: data.pricePerNight,
					totalAmount: data.totalAmount,
					expiresAt,
					status: TemporaryReservationStatus.PENDING,
				},
			});

			tempReservationLogger.info(
				`Temporary reservation created: ${temporaryReservation.id} for facility: ${data.facilityId} by frontdesk: ${data.frontdeskUserId}`,
			);

			return {
				success: true,
				temporaryReservationId: temporaryReservation.id,
			};
		});

		return result;
	} catch (error) {
		tempReservationLogger.error(`Error creating temporary reservation: ${error}`);
		return {
			success: false,
			error: `Failed to create temporary reservation: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
};

/**
 * Confirm a temporary reservation by converting it to a real reservation
 */
export const confirmTemporaryReservation = async (
	prisma: PrismaClient,
	temporaryReservationId: string,
	additionalReservationData?: any,
): Promise<{ success: boolean; reservationId?: string; error?: string }> => {
	try {
		const result = await prisma.$transaction(async (tx) => {
			// Get the temporary reservation
			const tempReservation = await tx.temporaryReservation.findUnique({
				where: { id: temporaryReservationId },
				include: {
					user: true,
					facility: true,
				},
			});

			if (!tempReservation) {
				return {
					success: false,
					error: "Temporary reservation not found",
				};
			}

			if (tempReservation.status !== TemporaryReservationStatus.PENDING) {
				return {
					success: false,
					error: `Temporary reservation is already ${tempReservation.status.toLowerCase()}`,
				};
			}

			if (tempReservation.expiresAt < new Date()) {
				return {
					success: false,
					error: "Temporary reservation has expired",
				};
			}

			// Create the actual reservation
			const reservation = await tx.reservation.create({
				data: {
					facilityId: tempReservation.facilityId,
					userId: tempReservation.userId,
					facilityType: tempReservation.facilityType,
					reservationDate: tempReservation.reservationDate,
					reservationEndDate: tempReservation.reservationEndDate,
					guests: tempReservation.guests,
					specialRequests: tempReservation.specialRequests,
					pricePerNight: tempReservation.pricePerNight,
					totalAmount: tempReservation.totalAmount,
					status: "RESERVED",
					...additionalReservationData,
				},
			});

			// Mark temporary reservation as confirmed
			await tx.temporaryReservation.update({
				where: { id: temporaryReservationId },
				data: {
					status: TemporaryReservationStatus.CONFIRMED,
				},
			});

			tempReservationLogger.info(
				`Temporary reservation ${temporaryReservationId} confirmed as reservation ${reservation.id}`,
			);

			return {
				success: true,
				reservationId: reservation.id,
			};
		});

		return result;
	} catch (error) {
		tempReservationLogger.error(`Error confirming temporary reservation: ${error}`);
		return {
			success: false,
			error: `Failed to confirm temporary reservation: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
};

/**
 * Cancel a temporary reservation
 */
export const cancelTemporaryReservation = async (
	prisma: PrismaClient,
	temporaryReservationId: string,
): Promise<{ success: boolean; error?: string }> => {
	try {
		await prisma.temporaryReservation.update({
			where: { id: temporaryReservationId },
			data: {
				status: TemporaryReservationStatus.CANCELLED,
			},
		});

		tempReservationLogger.info(`Temporary reservation ${temporaryReservationId} cancelled`);

		return { success: true };
	} catch (error) {
		tempReservationLogger.error(`Error cancelling temporary reservation: ${error}`);
		return {
			success: false,
			error: `Failed to cancel temporary reservation: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
};

/**
 * Clean up expired temporary reservations
 */
export const cleanupExpiredTemporaryReservations = async (
	prisma: PrismaClient,
): Promise<{ cleanedCount: number }> => {
	try {
		const result = await prisma.temporaryReservation.updateMany({
			where: {
				status: TemporaryReservationStatus.PENDING,
				expiresAt: { lt: new Date() },
			},
			data: {
				status: TemporaryReservationStatus.EXPIRED,
			},
		});

		if (result.count > 0) {
			tempReservationLogger.info(`Cleaned up ${result.count} expired temporary reservations`);
		}

		return { cleanedCount: result.count };
	} catch (error) {
		tempReservationLogger.error(`Error cleaning up expired temporary reservations: ${error}`);
		return { cleanedCount: 0 };
	}
};

/**
 * Get temporary reservation by ID
 */
export const getTemporaryReservation = async (
	prisma: PrismaClient,
	temporaryReservationId: string,
) => {
	return await prisma.temporaryReservation.findUnique({
		where: { id: temporaryReservationId },
		include: {
			user: {
				select: {
					id: true,
					userName: true,
					email: true,
				},
			},
			frontdeskUser: {
				select: {
					id: true,
					userName: true,
					email: true,
				},
			},
			facility: {
				select: {
					id: true,
					name: true,
					metadata: true,
					location: true,
				},
			},
		},
	});
};

/**
 * Get active temporary reservations by session
 */
export const getTemporaryReservationsBySession = async (
	prisma: PrismaClient,
	sessionId: string,
) => {
	return await prisma.temporaryReservation.findMany({
		where: {
			sessionId,
			status: TemporaryReservationStatus.PENDING,
			expiresAt: { gt: new Date() },
		},
		include: {
			user: {
				select: {
					id: true,
					userName: true,
					email: true,
				},
			},
			facility: {
				select: {
					id: true,
					name: true,
					metadata: true,
					location: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});
};
