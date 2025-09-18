import { Response } from "express";

export interface SuccessResponse<T = unknown> {
	status: "success";
	message: string;
	data?: T;
	code?: number;
	timestamp: string;
}

export function buildSuccessResponse<T>(
	message: string,
	data?: T,
	statusCode: number = 200,
): SuccessResponse<T> {
	return {
		status: "success",
		message,
		data,
		code: statusCode,
		timestamp: new Date().toISOString(),
	};
}

// Optional: Keep the original function but rename it for clarity
// export function sendSuccessResponse<T>(
// 	res: Response,
// 	message: string,
// 	data?: T,
// 	statusCode: number = 200,
// ): void {
// 	const response = buildSuccessResponse(message, data, statusCode);
// 	res.status(statusCode).json(response);
// }
