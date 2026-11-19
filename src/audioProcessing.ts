import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

import { UnsupportedMediaError } from './videoProcessing';

const execFileAsync = promisify(execFile);

/** Transcode uploaded audio to compact MP3 for faster loading. */
export async function processUploadedAudio(
  inputPath: string,
  uploadsDir: string,
  bitrate: '96k' | '128k' = '128k',
): Promise<{ filename: string }> {
  const id = crypto.randomUUID();
  const outputFilename = `${id}.mp3`;
  const outputPath = path.join(uploadsDir, outputFilename);

  try {
    await execFileAsync('ffmpeg', [
      '-nostdin',
      '-y',
      '-protocol_whitelist', 'file',
      '-i', inputPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', bitrate,
      '-ar', '44100',
      '-ac', '2',
      outputPath,
    ], { timeout: 120000 });
  } catch {
    // Никогда не сохраняем исходный файл: он мог быть не медиа (например, HTML с чужим расширением)
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* ignore */ }
    throw new UnsupportedMediaError('Файл не является корректным аудио');
  }

  fs.unlinkSync(inputPath);
  return { filename: outputFilename };
}

export function isAudioMime(mimetype: string): boolean {
  return /^audio\//.test(mimetype);
}
