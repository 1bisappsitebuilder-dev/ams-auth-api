import { ttlockEndpoint } from "../../config/ttlockEndpoint";

export const bulkIcCardHelper = {
	processSingleCardMultiLocks: async (data: any) => {
		const results: Array<{ lockId: any; result: any }> = [];
		for (const lockId of data.lockIds) {
			const cardData = { ...data, lockId };
			delete cardData.lockIds;
			const result = await bulkIcCardHelper.addSingleCard(cardData);
			results.push({ lockId, result });
		}
		return results;
	},

	processMultiCardSingleLock: async (data: any) => {
		const results: Array<{ cardNumber: any; result: any }> = [];
		for (const cardNumber of data.cardNumbers) {
			const cardData = { ...data, cardNumber };
			delete cardData.cardNumbers;
			const result = await bulkIcCardHelper.addSingleCard(cardData);
			results.push({ cardNumber, result });
		}
		return results;
	},

	processMultiCardMultiLocks: async (data: any) => {
		const results: Array<{ lockId: any; cardNumber: any; result: any }> = [];
		for (const operation of data.operations) {
			for (const lockId of operation.lockIds) {
				for (const cardNumber of operation.cardNumbers) {
					const cardData = { ...data, ...operation, lockId, cardNumber };
					delete cardData.operations;
					delete cardData.lockIds;
					delete cardData.cardNumbers;
					const result = await bulkIcCardHelper.addSingleCard(cardData);
					results.push({ lockId, cardNumber, result });
				}
			}
		}
		return results;
	},

	processCSVData: async (csvBuffer: Buffer, formData: any) => {
		// Here you'd parse CSV rows into operations
		console.log("Parsing CSV buffer, Form Data:", formData);
		const csvContent = csvBuffer.toString("utf-8");
		const rows = csvContent
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		const results: Array<{ row: string; result: any }> = [];
		for (const row of rows) {
			const [lockId, cardNumber, cardName, cardType, addType, startDate, endDate] =
				row.split(",");
			const cardData = {
				lockId,
				cardNumber,
				cardName,
				cardType: Number(cardType),
				addType: Number(addType),
				startDate: Number(startDate),
				endDate: Number(endDate),
				...formData,
			};
			const result = await bulkIcCardHelper.addSingleCard(cardData);
			results.push({ row, result });
		}
		return results;
	},

	addSingleCard: async (cardData: any) => {
		try {
			const {
				clientId,
				accessToken,
				lockId,
				cardNumber,
				cardName,
				startDate,
				endDate,
				cardType,
				cyclicConfig,
				addType,
			} = cardData;

			const currentDate = Date.now();

			// Make the actual TTLock API call
			const response = await fetch(ttlockEndpoint.icCard.add, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					clientId: clientId.toString(),
					...(accessToken ? { accessToken: accessToken.toString() } : {}),
					lockId: lockId.toString(),
					cardNumber: cardNumber.toString(),
					...(cardName && { cardName }),
					startDate: startDate.toString(),
					endDate: endDate.toString(),
					...(cardType && { cardType: cardType.toString() }),
					...(cyclicConfig && { cyclicConfig: JSON.stringify(cyclicConfig) }),
					...(addType && { addType: addType.toString() }),
					date: currentDate.toString(),
				}).toString(),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`Failed to add IC card ${cardNumber} for lock ${lockId}. Status: ${response.status}, Response: ${errorText}`,
				);
				return { success: false, error: errorText, status: response.status };
			}

			const result = await response.json();
			return { success: true, result, cardData };
		} catch (error: any) {
			console.error(`Error adding IC card: ${error.message}`);
			return { success: false, error: error.message };
		}
	},
};

export default bulkIcCardHelper;
