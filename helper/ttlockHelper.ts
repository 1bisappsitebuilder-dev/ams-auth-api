import { config } from "../config/constant";

export const getCurrentDate = () => {
	return Date.now().toString();
};

export const mapErrorCodeToStatus = (errcode?: number): number => {
	if (errcode === undefined) {
		return 200;
	}
	return config.ERROR.TTLOCK.ERROR_CODES[errcode] || 500;
};

export const getEkeyStatusDescription = (status: number): string => {
	return config.ERROR.TTLOCK.EKEY_STATUS[status] || "Unknown";
};

export const getRecordTypeDescription = (type: number): string => {
	return config.ERROR.TTLOCK.RECORD_TYPE[type] || "Unknown";
};

export const getRecordTypeFromLockDescription = (type: number): string => {
	return config.ERROR.TTLOCK.RECORD_TYPE_FROM_LOCK[type] || "Unknown";
};

/**
 * Decoupled TTLock credentials fetcher for use in all TTLock controllers.
 * Supports both (clientId, clientSecret) and (clientId, accessToken) patterns.
 *
 * @param prisma Prisma client instance
 * @param logger Logger instance
 * @param params Object containing clientId, clientSecret, accessToken, organizationId
 * @returns { clientId, clientSecret?, accessToken? }
 */
export async function getTTLockCredentials(
	prisma: any,
	logger: any,
	params: {
		clientId?: string;
		clientSecret?: string;
		accessToken?: string;
		organizationId?: string;
	},
): Promise<{ clientId: string; clientSecret?: string; accessToken?: string }> {
	let { clientId, clientSecret, accessToken, organizationId } = params;
	let finalClientId = clientId;
	let finalClientSecret = clientSecret;
	let finalAccessToken = accessToken;

	// If both clientId and (clientSecret or accessToken) are provided, use them directly
	if (finalClientId && (finalClientSecret || finalAccessToken)) {
		logger.info("Using provided TTLock credentials directly");
		return {
			clientId: finalClientId,
			clientSecret: finalClientSecret,
			accessToken: finalAccessToken,
		};
	}

	// Otherwise, fetch from organization integration
	if (!organizationId) {
		throw new Error("Organization ID is required when credentials are not provided");
	}
	const organization = await prisma.organization.findUnique({
		where: { id: organizationId },
	});
	if (!organization) {
		throw new Error(`Organization not found: ${organizationId}`);
	}
	const ttlockIntegration = organization.integrations?.find((integration: any) => {
		return (
			integration.provider === "TTlock lock" ||
			integration.name === "TTlock" ||
			(integration.configuration &&
				integration.configuration.clientId &&
				(integration.configuration.clientSecret || integration.configuration.accessToken))
		);
	});
	const config = ttlockIntegration?.configuration as any;
	finalClientId = config?.clientId;
	finalClientSecret = config?.clientSecret;
	finalAccessToken = config?.accessToken;

	if (!finalClientId || (!finalClientSecret && !finalAccessToken)) {
		throw new Error(
			`TTLock integration configuration missing clientId or credential for organization: ${organizationId}`,
		);
	}

	logger.info(`Using TTLock integration from organization: ${organizationId}`);
	return {
		clientId: finalClientId,
		clientSecret: finalClientSecret,
		accessToken: finalAccessToken,
	};
}

/**
 * Finds the TTLock integration for a given organization.
 * @param prisma Prisma client instance
 * @param organization Organization object (should have .integrations array)
 * @returns The TTLock integration object or null if not found
 */
export async function findTTLockIntegration(prisma: any, organization: any) {
	if (!organization?.integrations?.length) return null;
	for (const orgIntegration of organization.integrations) {
		const integration = await prisma.integration.findUnique({
			where: { id: orgIntegration.integrationId },
		});
		if (
			integration &&
			integration.provider &&
			integration.provider.toLowerCase() === "ttlock"
		) {
			return integration;
		}
	}
	return null;
}

/**
 * Increments the TTLock API call count for a given organization and action.
 * @param prisma Prisma client instance
 * @param organization Organization object (should have .integrations array)
 * @param action String key for the API call (e.g., endpoint or action name)
 * @returns The updated total API call count for TTLock
 */
export async function incrementTTLockApiCalls(prisma: any, organization: any, action: string): Promise<{ total: number; perAction: Record<string, number> }> {
	const integration = await findTTLockIntegration(prisma, organization);
	if (!integration) return { total: 0, perAction: {} };

	let apiCalls = integration.apiCalls || {};
	if (typeof apiCalls === 'string') {
		try { apiCalls = JSON.parse(apiCalls); } catch { apiCalls = {}; }
	}
	if (typeof apiCalls !== 'object' || Array.isArray(apiCalls)) apiCalls = {};

	// Increment per-action count
	apiCalls[action] = (apiCalls[action] || 0) + 1;
	// Increment total count
	apiCalls.total = (apiCalls.total || 0) + 1;

	await prisma.integration.update({
		where: { id: integration.id },
		data: { apiCalls },
	});

	return { total: apiCalls.total, perAction: apiCalls };
}
