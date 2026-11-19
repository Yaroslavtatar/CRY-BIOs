import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class UnsupportedMediaError extends Error {
  readonly status = 415;
}

export async function processUploadedVideo(
  inputPath: string,
  uploadsDir: string
): Promise<{ filename: string }> {
  const id = crypto.randomUUID();
  const outputFilename = `${id}.mp4`;
  const outputPath = path.join(uploadsDir, outputFilename);

  try {
    await execFileAsync('ffmpeg', [
      '-nostdin',
      '-y',
      '-protocol_whitelist', 'file',
      '-i', inputPath,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease',
      '-c:v', 'libx264',
      '-crf', '30',
      '-preset', 'veryfast',
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 180000 });
  } catch {
    // Никогда не сохраняем исходный файл: он мог быть не медиа (например, HTML с чужим расширением)
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* ignore */ }
    throw new UnsupportedMediaError('Файл не является корректным видео');
  }

  fs.unlinkSync(inputPath);
  return { filename: outputFilename };
}

export function isVideoMime(mimetype: string): boolean {
  return /^video\//.test(mimetype);
}
