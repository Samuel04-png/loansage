/**
 * Thumbnail Generator Cloud Function
 * Generates thumbnails for uploaded collateral images
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sharp from 'sharp';

const storage = admin.storage();

export const generateThumbnail = functions.storage
  .bucket()
  .object()
  .onFinalize(async (object: any) => {
    const filePath = object.name;
    const contentType = object.contentType;

    // Only process images
    if (!filePath || !contentType || !contentType.startsWith('image/')) {
      console.log('Skipping non-image file:', filePath);
      return null;
    }

    // Skip if already a thumbnail
    if (filePath.includes('_thumb')) {
      console.log('Skipping thumbnail file:', filePath);
      return null;
    }

    const bucket = storage.bucket(object.bucket);
    const file = bucket.file(filePath);

    try {
      // Download the original image
      const [imageBuffer] = await file.download();

      // Generate thumbnail (300x300)
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbPath = filePath.replace(/(\.[^.]+)$/, '_thumb$1');
      const thumbFile = bucket.file(thumbPath);

      await thumbFile.save(thumbnailBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            originalFile: filePath,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      // Make thumbnail publicly readable (optional)
      await thumbFile.makePublic();

      console.log(`Thumbnail generated: ${thumbPath}`);
      return null;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  });

