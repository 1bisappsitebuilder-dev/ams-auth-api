import { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma";
import {
	uploadImage,
	uploadMultipleImages,
	deleteImage,
	deleteMultipleImages,
	getTransformedImageUrl,
} from "../../helper/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { config } from "../../config/constant";
import {
	sendValidationError,
	sendSuccessResponse,
	sendErrorResponse,
	sendNotFoundResponse,
} from "../../utils/validationHelper";
import { logActivity } from "../../utils/activityLogger";
import { logAudit } from "../../utils/auditLogger";
import { getLogger } from "../../helper/logger";

const logger = getLogger();
const imagesLogger = logger.child({ module: "images" });

export interface ImagesController {
	uploadSingle: (req: Request, res: Response) => Promise<void>;
	uploadMultiple: (req: Request, res: Response) => Promise<void>;
	deleteImage: (req: Request, res: Response) => Promise<void>;
	deleteMultiple: (req: Request, res: Response) => Promise<void>;
	getTransformedImage: (req: Request, res: Response) => Promise<void>;
}

export const controller = (prisma: PrismaClient): ImagesController => {
	/**
	 * Upload a single image
	 */
	const uploadSingle = async (req: Request, res: Response): Promise<void> => {
		try {
			if (!req.file) {
				return sendValidationError(res, "Validation failed", [
					{ field: "file", message: config.ERROR.IMAGE.NO_IMAGE_PROVIDED },
				]);
			}

			const { folder } = req.body;

			const uploadOptions = {
				folder: folder || "uploads",
				quality: "auto",
			};

			const result = await uploadImage(req.file.buffer, uploadOptions);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPLOAD_SINGLE_IMAGE",
				description: `Uploaded single image to folder: ${folder || "uploads"}`,
				page: { url: req.originalUrl, title: "Single Image Upload" },
			});

			// ✅ Log audit for creation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE",
				resource: "images",
				severity: "LOW",
				entityType: "image",
				entityId: result.public_id,
				changesBefore: null,
				changesAfter: {
					public_id: result.public_id,
					url: result.secure_url,
					width: result.width,
					height: result.height,
					format: result.format,
					bytes: result.bytes,
					folder: folder || "uploads",
					created_at: result.created_at,
				},
				description: `Uploaded single image: ${result.public_id}`,
			});

			imagesLogger.info(`Single image uploaded successfully: ${result.public_id}`);

			return sendSuccessResponse(res, config.SUCCESS.IMAGE.UPLOADED, {
				public_id: result.public_id,
				url: result.secure_url,
				width: result.width,
				height: result.height,
				format: result.format,
				bytes: result.bytes,
				created_at: result.created_at,
			});
		} catch (error: any) {
			imagesLogger.error(`Error uploading single image: ${error}`);
			return sendErrorResponse(res, config.ERROR.IMAGE.UPLOAD_FAILED);
		}
	};

	/**
	 * Upload multiple images
	 */
	const uploadMultiple = async (req: Request, res: Response): Promise<void> => {
		try {
			if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
				return sendValidationError(res, "Validation failed", [
					{ field: "files", message: config.ERROR.IMAGE.NO_IMAGE_PROVIDED },
				]);
			}

			const { folder } = req.body;

			const uploadOptions = {
				folder: folder || "uploads",
				quality: "auto",
			};

			const fileBuffers = req.files.map((file: Express.Multer.File) => file.buffer);
			const results = await uploadMultipleImages(fileBuffers, uploadOptions);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "UPLOAD_MULTIPLE_IMAGES",
				description: `Uploaded ${results.length} images to folder: ${folder || "uploads"}`,
				page: { url: req.originalUrl, title: "Multiple Images Upload" },
			});

			// ✅ Log audit for multiple creation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "CREATE",
				resource: "images",
				severity: "LOW",
				entityType: "image",
				entityId: `batch_${Date.now()}`,
				changesBefore: null,
				changesAfter: {
					count: results.length,
					images: results.map((result: UploadApiResponse) => ({
						public_id: result.public_id,
						url: result.secure_url,
						width: result.width,
						height: result.height,
						format: result.format,
						bytes: result.bytes,
						folder: folder || "uploads",
						created_at: result.created_at,
					})),
				},
				description: `Uploaded ${results.length} images to folder: ${folder || "uploads"}`,
			});

			imagesLogger.info(`Multiple images uploaded successfully: ${results.length} images`);

			const responseData = results.map((result: UploadApiResponse) => ({
				public_id: result.public_id,
				url: result.secure_url,
				width: result.width,
				height: result.height,
				format: result.format,
				bytes: result.bytes,
				created_at: result.created_at,
			}));

			return sendSuccessResponse(
				res,
				`${results.length} ${config.SUCCESS.IMAGE.MULTIPLE_UPLOADED}`,
				{ data: responseData, count: results.length },
			);
		} catch (error: any) {
			imagesLogger.error(`Error uploading multiple images: ${error}`);
			return sendErrorResponse(res, config.ERROR.IMAGE.UPLOAD_FAILED);
		}
	};

	/**
	 * Delete a single image
	 */
	const deleteImageHandler = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;

			if (!publicId) {
				return sendValidationError(res, "Validation failed", [
					{ field: "publicId", message: config.ERROR.IMAGE.PUBLIC_ID_REQUIRED },
				]);
			}

			const result = await deleteImage(publicId);

			if (result.result === "ok") {
				// ✅ Log activity
				logActivity(req, {
					userId: (req as any).user?.id || "unknown",
					action: "DELETE_SINGLE_IMAGE",
					description: `Deleted image with public ID: ${publicId}`,
					page: { url: req.originalUrl, title: "Single Image Deletion" },
				});

				// ✅ Log audit for deletion
				logAudit(req, {
					userId: (req as any).user?.id || "unknown",
					action: "DELETE",
					resource: "images",
					severity: "HIGH",
					entityType: "image",
					entityId: publicId,
					changesBefore: {
						public_id: publicId,
						status: "exists",
					},
					changesAfter: {
						public_id: publicId,
						status: "deleted",
						result: result.result,
					},
					description: `Deleted image with public ID: ${publicId}`,
				});

				imagesLogger.info(`Single image deleted successfully: ${publicId}`);

				return sendSuccessResponse(res, config.SUCCESS.IMAGE.DELETED, result);
			} else {
				return sendNotFoundResponse(res, "Image", "publicId");
			}
		} catch (error: any) {
			imagesLogger.error(`Error deleting image: ${error}`);
			return sendErrorResponse(res, config.ERROR.IMAGE.DELETE_FAILED);
		}
	};

	/**
	 * Delete multiple images
	 */
	const deleteMultiple = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicIds } = req.body;

			if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
				return sendValidationError(res, "Validation failed", [
					{ field: "publicIds", message: config.ERROR.IMAGE.PUBLIC_IDS_REQUIRED },
				]);
			}

			const result = await deleteMultipleImages(publicIds);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE_MULTIPLE_IMAGES",
				description: `Deleted ${publicIds.length} images`,
				page: { url: req.originalUrl, title: "Multiple Images Deletion" },
			});

			// ✅ Log audit for multiple deletion
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "DELETE",
				resource: "images",
				severity: "HIGH",
				entityType: "image",
				entityId: `batch_delete_${Date.now()}`,
				changesBefore: {
					count: publicIds.length,
					public_ids: publicIds,
					status: "exists",
				},
				changesAfter: {
					count: publicIds.length,
					public_ids: publicIds,
					status: "deleted",
					result: result,
				},
				description: `Deleted ${publicIds.length} images`,
			});

			imagesLogger.info(`Multiple images deleted successfully: ${publicIds.length} images`);

			return sendSuccessResponse(
				res,
				`${config.SUCCESS.IMAGE.DELETION_COMPLETED} for ${publicIds.length} images`,
				result,
			);
		} catch (error: any) {
			imagesLogger.error(`Error deleting multiple images: ${error}`);
			return sendErrorResponse(res, config.ERROR.IMAGE.DELETE_FAILED);
		}
	};

	/**
	 * Get transformed image URL
	 */
	const getTransformedImage = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const { width, height, crop, quality, format, effect } = req.query;

			if (!publicId) {
				return sendValidationError(res, "Validation failed", [
					{ field: "publicId", message: config.ERROR.IMAGE.PUBLIC_ID_REQUIRED },
				]);
			}

			const transformations: any = {};

			if (width) transformations.width = parseInt(width as string);
			if (height) transformations.height = parseInt(height as string);
			if (crop) transformations.crop = crop;
			if (quality) transformations.quality = quality;
			if (format) transformations.format = format;
			if (effect) transformations.effect = effect;

			const transformedUrl = getTransformedImageUrl(publicId, transformations);

			// ✅ Log activity
			logActivity(req, {
				userId: (req as any).user?.id || "unknown",
				action: "GET_TRANSFORMED_IMAGE",
				description: `Generated transformed image URL for: ${publicId}`,
				page: { url: req.originalUrl, title: "Image Transformation" },
			});

			// ✅ Log audit for transformation
			logAudit(req, {
				userId: (req as any).user?.id || "unknown",
				action: "READ",
				resource: "images",
				severity: "LOW",
				entityType: "image",
				entityId: publicId,
				changesBefore: {
					public_id: publicId,
					transformations: null,
				},
				changesAfter: {
					public_id: publicId,
					transformed_url: transformedUrl,
					transformations: transformations,
				},
				description: `Generated transformed image URL for: ${publicId}`,
			});

			imagesLogger.info(`Transformed image URL generated successfully: ${publicId}`);

			return sendSuccessResponse(res, config.SUCCESS.IMAGE.TRANSFORMED, {
				public_id: publicId,
				transformed_url: transformedUrl,
				transformations: transformations,
			});
		} catch (error: any) {
			imagesLogger.error(`Error generating transformed image URL: ${error}`);
			return sendErrorResponse(res, config.ERROR.IMAGE.TRANSFORM_FAILED);
		}
	};

	return {
		uploadSingle,
		uploadMultiple,
		deleteImage: deleteImageHandler,
		deleteMultiple,
		getTransformedImage,
	};
};
