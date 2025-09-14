import { Router } from "express";
import { ImagesController } from "./images.controller";
import { uploadSingle, uploadMultiple } from "../../middleware/upload";

export const router = (router: Router, controller: ImagesController): Router => {
	/**
	 * @openapi
	 * /api/images/upload-single:
	 *   post:
	 *     tags:
	 *       - Images
	 *     summary: Upload a single image
	 *     description: Upload a single image to Cloudinary
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               image:
	 *                 type: string
	 *                 format: binary
	 *                 description: Image file to upload
	 *               folder:
	 *                 type: string
	 *                 description: Cloudinary folder name
	 *                 default: uploads
	 *             required:
	 *               - image
	 *     responses:
	 *       200:
	 *         description: Image uploaded successfully
	 *       400:
	 *         description: No image file provided
	 *       500:
	 *         description: Failed to upload image
	 */
	router.post("/upload-single", uploadSingle, controller.uploadSingle);

	/**
	 * @openapi
	 * /api/images/upload-multiple:
	 *   post:
	 *     tags:
	 *       - Images
	 *     summary: Upload multiple images
	 *     description: Upload multiple images to Cloudinary (max 10 images)
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               images:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                   format: binary
	 *                 description: Image files to upload (max 10)
	 *               folder:
	 *                 type: string
	 *                 description: Cloudinary folder name
	 *                 default: uploads
	 *             required:
	 *               - images
	 *     responses:
	 *       200:
	 *         description: Images uploaded successfully
	 *       400:
	 *         description: No image files provided
	 *       500:
	 *         description: Failed to upload images
	 */
	router.post("/upload-multiple", uploadMultiple, controller.uploadMultiple);

	/**
	 * @openapi
	 * /api/images/delete/{publicId}:
	 *   delete:
	 *     tags:
	 *       - Images
	 *     summary: Delete a single image
	 *     description: Delete an image from Cloudinary using its public ID
	 *     parameters:
	 *       - in: path
	 *         name: publicId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Cloudinary public ID of the image to delete
	 *     responses:
	 *       200:
	 *         description: Image deleted successfully
	 *       400:
	 *         description: Public ID is required
	 *       404:
	 *         description: Image not found or already deleted
	 *       500:
	 *         description: Failed to delete image
	 */
	router.delete("/delete/:publicId", controller.deleteImage);

	/**
	 * @openapi
	 * /api/images/delete-multiple:
	 *   delete:
	 *     tags:
	 *       - Images
	 *     summary: Delete multiple images
	 *     description: Delete multiple images from Cloudinary using their public IDs
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               publicIds:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Array of Cloudinary public IDs to delete
	 *             required:
	 *               - publicIds
	 *     responses:
	 *       200:
	 *         description: Images deletion completed
	 *       400:
	 *         description: Array of public IDs is required
	 *       500:
	 *         description: Failed to delete images
	 */
	router.delete("/delete-multiple", controller.deleteMultiple);

	/**
	 * @openapi
	 * /api/images/transform/{publicId}:
	 *   get:
	 *     tags:
	 *       - Images
	 *     summary: Get transformed image URL
	 *     description: Generate a transformed image URL with specified transformations
	 *     parameters:
	 *       - in: path
	 *         name: publicId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Cloudinary public ID of the image
	 *       - in: query
	 *         name: width
	 *         schema:
	 *           type: integer
	 *         description: Image width
	 *       - in: query
	 *         name: height
	 *         schema:
	 *           type: integer
	 *         description: Image height
	 *       - in: query
	 *         name: crop
	 *         schema:
	 *           type: string
	 *         description: Crop mode (fill, scale, fit, etc.)
	 *       - in: query
	 *         name: quality
	 *         schema:
	 *           type: string
	 *         description: Image quality
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *         description: Image format (jpg, png, webp, etc.)
	 *       - in: query
	 *         name: effect
	 *         schema:
	 *           type: string
	 *         description: Image effect
	 *     responses:
	 *       200:
	 *         description: Transformed image URL generated successfully
	 *       400:
	 *         description: Public ID is required
	 *       500:
	 *         description: Failed to generate transformed image URL
	 */
	router.get("/transform/:publicId", controller.getTransformedImage);

	return router;
};
