export function generateReservationNumber(
	type: string, // ROOM, FACILITY, etc.
	month: number, // 1-12
	lastName: string, // guest last name
	timestamp: number, // current timestamp
): string {
	const typeCode = type[0]?.toUpperCase(); // First letter of type
	const monthCode = month.toString().padStart(2, "0"); // 2-digit month
	const lastNameCode = lastName[0]?.toUpperCase(); // First letter of last name
	const timeCode = (timestamp % 1000).toString().padStart(3, "0"); // Last 3 digits of timestamp

	if (!typeCode || !lastNameCode) {
		throw new Error("Invalid type or last name for reservation number generation");
	}

	return `${typeCode}${monthCode}${lastNameCode}${timeCode}`;
}
