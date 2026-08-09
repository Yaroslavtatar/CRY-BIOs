import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

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
      '-y',
      '-i', inputPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', bitrate,
      '-ar', '44100',
      '-ac', '2',
      outputPath,
    ], { timeout: 120000 });
  } catch {
    const ext = path.extname(inputPath) || '.mp3';
    const fallbackName = `${id}${ext}`;
    fs.copyFileSync(inputPath, path.join(uploadsDir, fallbackName));
    fs.unlinkSync(inputPath);
    return { filename: fallbackName };
  }

  fs.unlinkSync(inputPath);
  return { filename: outputFilename };
}

export function isAudioMime(mimetype: string): boolean {
  return /^audio\//.test(mimetype);
}
