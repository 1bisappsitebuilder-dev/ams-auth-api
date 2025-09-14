import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { config } from "../config/config";
import { Readable } from "stream";

// Configure Cloudinary
cloudinary.config({
	cloud_name: config.cloudinary.cloudName,
	api_key: config.cloudinary.apiKey,
	api_secret: config.cloudinary.apiSecret,
});

export interface CloudinaryUploadResult {
	public_id: string;
	version: number;
	signature: string;
	width: number;
	height: number;
	format: string;
	resource_type: string;
	created_at: string;
	tags: string[];
	bytes: number;
	type: string;
	etag: string;
	placeholder: boolean;
	url: string;
	secure_url: string;
	folder?: string;
	original_filename?: string;
}

export interface UploadOptions {
	folder?: string;
	quality?: string | number;
	width?: number;
	height?: number;
	crop?: string;
	transformation?: any[];
	tags?: string[];
}

export const uploadImage = async (
	file: Buffer | string,
	options: UploadOptions = {},
): Promise<UploadApiResponse> => {
	try {
		const uploadOptions = {
			resource_type: "image" as const,
			folder: options.folder || "uploads",
			quality: options.quality || "auto",
			...options,
		};

		if (Buffer.isBuffer(file)) {
			// Upload buffer directly using upload_stream
			return new Promise((resolve, reject) => {
				const uploadStream = cloudinary.uploader.upload_stream(
					uploadOptions,
					(error: any, result: UploadApiResponse | undefined) => {
						if (error) {
							reject(error);
						} else if (result) {
							resolve(result);
						} else {
							reject(new Error("Upload failed: No result returned"));
						}
					},
				);

				const stream = new Readable();
				stream.push(file);
				stream.push(null);
				stream.pipe(uploadStream);
			});
		} else {
			// File is a base64 string or file path
			return await cloudinary.uploader.upload(file, uploadOptions);
		}
	} catch (error) {
		throw new Error(`Failed to upload image: ${error}`);
	}
};

export const uploadMultipleImages = async (
	files: (Buffer | string)[],
	options: UploadOptions = {},
): Promise<UploadApiResponse[]> => {
	try {
		const uploadPromises = files.map((file, index) => {
			const fileOptions = {
				...options,
				// Add index to filename to avoid conflicts
				public_id: options.tags?.length ? `${options.tags[0]}_${index}` : `upload_${index}`,
			};
			return uploadImage(file, fileOptions);
		});

		const results = await Promise.all(uploadPromises);
		return results;
	} catch (error) {
		throw new Error(`Failed to upload multiple images: ${error}`);
	}
};

export const deleteImage = async (publicId: string): Promise<any> => {
	try {
		const result = await cloudinary.uploader.destroy(publicId);
		return result;
	} catch (error) {
		throw new Error(`Failed to delete image: ${error}`);
	}
};

export const deleteMultipleImages = async (publicIds: string[]): Promise<any> => {
	try {
		const result = await cloudinary.api.delete_resources(publicIds);
		return result;
	} catch (error) {
		throw new Error(`Failed to delete multiple images: ${error}`);
	}
};

export const getTransformedImageUrl = (publicId: string, transformations: any = {}): string => {
	return cloudinary.url(publicId, {
		secure: true,
		...transformations,
	});
};

export const extractPublicIdFromUrl = (url: string): string | null => {
	try {
		// Handle both http and https URLs
		const urlPattern =
			/https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/(?:v\d+\/)?(.+?)\.[^.]+$/;
		const match = url.match(urlPattern);

		if (match && match[1]) {
			// Remove any transformations and version info to get clean public_id
			let publicId = match[1];

			// Remove transformation parameters (anything before the last slash that contains underscores)
			const parts = publicId.split("/");
			if (parts.length > 1) {
				// If there are transformations, they usually contain underscores and come before the actual public_id
				const lastPart = parts[parts.length - 1];
				const secondLastPart = parts[parts.length - 2];

				// If the second last part contains underscores (transformations), use only the last part
				if (secondLastPart && secondLastPart.includes("_")) {
					publicId = lastPart;
				}
			}

			return publicId;
		}

		return null;
	} catch (error) {
		console.error("Error extracting public ID from URL:", error);
		return null;
	}
};

export const extractPublicIdsFromUrls = (urls: string[]): string[] => {
	return urls
		.map((url) => extractPublicIdFromUrl(url))
		.filter((publicId): publicId is string => publicId !== null);
};

export default cloudinary;
