import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type ImageUploadType = 'avatar' | 'bg' | 'image';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = /^video\//;
const AUDIO_MIMES = /^audio\//;

export function isAllowedMime(mimetype: string): boolean {
  return IMAGE_MIMES.has(mimetype) || VIDEO_MIMES.test(mimetype) || AUDIO_MIMES.test(mimetype);
}

export function isImageMime(mimetype: string): boolean {
  return IMAGE_MIMES.has(mimetype);
}

const RESIZE_RULES: Record<ImageUploadType, { width: number; height: number; quality: number }> = {
  avatar: { width: 400, height: 400, quality: 80 },
  bg: { width: 1920, height: 1080, quality: 75 },
  image: { width: 1200, height: 1200, quality: 80 },
};

export async function processUploadedImage(
  inputPath: string,
  uploadsDir: string,
  uploadType: ImageUploadType
): Promise<{ filename: string; thumbFilename?: string }> {
  const id = crypto.randomUUID();
  const outputFilename = `${id}.webp`;
  const outputPath = path.join(uploadsDir, outputFilename);
  const rules = RESIZE_RULES[uploadType];

  await sharp(inputPath)
    .rotate()
    .resize(rules.width, rules.height, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: rules.quality })
    .toFile(outputPath);

  fs.unlinkSync(inputPath);

  if (uploadType === 'avatar') {
    const thumbsDir = path.join(uploadsDir, 'thumbs');
    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }
    const thumbFilename = `${id}.webp`;
    await sharp(outputPath)
      .resize(100, 100, { fit: 'cover' })
      .webp({ quality: 75 })
      .toFile(path.join(thumbsDir, thumbFilename));
    return { filename: outputFilename, thumbFilename };
  }

  return { filename: outputFilename };
}
