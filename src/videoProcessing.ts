import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function processUploadedVideo(
  inputPath: string,
  uploadsDir: string
): Promise<{ filename: string }> {
  const id = crypto.randomUUID();
  const outputFilename = `${id}.mp4`;
  const outputPath = path.join(uploadsDir, outputFilename);

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease',
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 120000 });
  } catch {
    // Fallback: copy original if ffmpeg fails
    const ext = path.extname(inputPath) || '.mp4';
    const fallbackName = `${id}${ext}`;
    fs.copyFileSync(inputPath, path.join(uploadsDir, fallbackName));
    fs.unlinkSync(inputPath);
    return { filename: fallbackName };
  }

  fs.unlinkSync(inputPath);
  return { filename: outputFilename };
}

export function isVideoMime(mimetype: string): boolean {
  return /^video\//.test(mimetype);
}
