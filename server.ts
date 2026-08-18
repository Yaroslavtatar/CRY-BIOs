/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import bcrypt from 'bcrypt';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { BioConfig, VisitRecord, AnalyticsSummary, SocialLink } from './src/types';
import * as db from './src/db';
import { streamFullBackup, importFullBackup, previewBackupZip, streamUserBackup, importUserBackup } from './src/backup';
import { isAllowedMime, isImageMime, type ImageUploadType } from './src/imageProcessing';
import { isVideoMime } from './src/videoProcessing';
import { isAudioMime } from './src/audioProcessing';
import { validateUserPassword, validateAdminPassword } from './src/passwordPolicy';
import { isAccountLocked, recordFailedLogin, clearLoginAttempts } from './src/authLockout';
import { rehostImportMedia } from './src/rehostMedia';
import { getImportPreviewSummary } from './src/gunsImportMap';
import { parseImportInput } from './src/importHub';
import { cleanupAllOrphans, deleteUnusedBetweenConfigs } from './src/uploadCleanup';
import { getStorageStats, runHealthChecks, isUsingDefaultAdminPassword } from './src/storageStats';
import { getSiteSettings, updateSiteSettings } from './src/siteSettings';
import { startScheduledBackups } from './src/scheduledBackup';
import { processMedia, resolveUploadFilePath, optimizeAllMedia } from './src/mediaPipeline';
import { verifyEdgeSignature, getEdgeUrl, fetchViaEdge } from './src/edgeAuth';
import {
  decodeDiscordBadges,
  mergeBadgesIntoLanyardUser,
  staticDiscordPresenceFromBio,
} from './src/discordBadges';
import {
  getPlatformDomainConfig,
  isReservedSlug,
  isValidSlug,
  normalizeSlug,
  parseSubdomainSlug,
} from './src/platformDomain';
import { getServerMediaCdnUrl } from './src/utils/cdn';

const CBIOS_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?cbios\.ru$/;

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'https://cdn.cbios.ru') return true;
  return CBIOS_ORIGIN_RE.test(origin);
}

// Establish folders
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const TMP_DIR = path.join(DATA_DIR, 'tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

type ImportJob = {
  username: string;
  status: 'running' | 'done' | 'error';
  progress: { current: number; total: number; label: string };
  result?: unknown;
  error?: string;
  listeners: Set<(event: string, data: unknown) => void>;
};

const importJobs = new Map<string, ImportJob>();

function emitImportJob(jobId: string, event: string, data: unknown) {
  const job = importJobs.get(jobId);
  if (!job) return;
  for (const listener of job.listeners) {
    listener(event, data);
  }
}

const ADMIN_PASSWORD_FILE = path.join(DATA_DIR, 'admin_password.txt');

function getAdminPassword(): string {
  if (fs.existsSync(ADMIN_PASSWORD_FILE)) {
    try {
      return fs.readFileSync(ADMIN_PASSWORD_FILE, 'utf-8').trim();
    } catch (e) {
      // Fallback to env or default
    }
  }
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

function saveAdminPassword(newPassword: string) {
  fs.writeFileSync(ADMIN_PASSWORD_FILE, newPassword.trim(), 'utf-8');
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, video, audio.'));
    }
  },
});

const backupUpload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isZip =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.toLowerCase().endsWith('.zip');
    if (isZip) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP backup files are allowed'));
    }
  },
});

const BCRYPT_ROUNDS = 10;
const DEFAULT_ADMIN_PASSWORD = 'admin_secret';

function getRequestHost(req: express.Request): string {
  const forwarded = req.get('x-forwarded-host');
  return (forwarded || req.get('host') || '').split(',')[0].trim();
}

function getPlatformConfig(req?: express.Request) {
  return getPlatformDomainConfig({
    bioBaseDomain: process.env.BIO_BASE_DOMAIN,
    appUrl: process.env.APP_URL,
    requestHost: req ? getRequestHost(req) : undefined,
  });
}

function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password: string, storedHash: string): { valid: boolean; needsRehash: boolean } {
  if (storedHash.startsWith('$2')) {
    return { valid: bcrypt.compareSync(password, storedHash), needsRehash: false };
  }
  if (isLegacySha256Hash(storedHash)) {
    const legacy = crypto.createHash('sha256').update(password).digest('hex');
    const valid = legacy === storedHash;
    return { valid, needsRehash: valid };
  }
  return { valid: false, needsRehash: false };
}

function verifyAdminPassword(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Seed demo profile only when explicitly enabled
if (process.env.SEED_DEMO_USER === 'true' && !db.getBio('cryteam') && !db.getUser('cryteam')) {
  const seedUsername = 'cryteam';
  const seedPasswordHash = hashPassword('demo123');
  const sessionToken = crypto.randomUUID();
  
  db.createUser(seedUsername, seedPasswordHash, sessionToken);
  
  const setupSocials: SocialLink[] = [
    { id: 's1', platform: 'discord', url: 'https://discord.gg/cryteam', label: 'cryteam discord', glow: true },
    { id: 's2', platform: 'github', url: 'https://github.com/cryteam-dev', label: 'github organisation' },
    { id: 's3', platform: 'telegram', url: 'https://t.me/cryteam_news', label: 'telegram channel' },
    { id: 's4', platform: 'youtube', url: 'https://youtube.com/cryteam', label: 'youtube' },
    { id: 's5', platform: 'spotify', url: 'https://spotify.com', label: 'sound playlist' }
  ];

  const defaultBio: BioConfig = {
    username: seedUsername,
    displayName: 'cryteam',
    bio: '⚡ the elite coding squad • premium open-source developers ⚡',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    verified: true,
    customBadge: 'CRYTEAM FOUNDER',
    sparkles: true,
    uid: 731176,
    discordConnected: true,
    discordUsername: 'crytek_d',
    googleConnected: false,
    fontFamily: 'Space Grotesk',
    primaryColor: '#00ffcc',
    textColor: '#ffffff',
    glowColor: '#00e1cc',
    customCSS: `/* Custom landing blink effect */
@keyframes pulseGlow {
  0%, 100% { filter: drop-shadow(0 0 10px rgba(0, 255, 200, 0.6)); }
  50% { filter: drop-shadow(0 0 25px rgba(0, 255, 200, 0.95)); }
}
.glow-card {
  animation: pulseGlow 4s infinite ease-in-out;
  border: 1px solid rgba(0, 255, 200, 0.4);
}`,
    bgType: 'stars',
    bgValue: '#0b0f19',
    bgBlur: 2,
    bgDim: 40,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    audioTitle: 'SoundHelix Song 1',
    audioArtist: 'Open Source Beats',
    audioEnabled: true,
    enterText: 'click to enter cryteam dashboard',
    blocks: [
      {
        id: 'b1',
        type: 'socials',
        title: 'Our Socials Links',
        enabled: true,
        socialsList: setupSocials
      },
      {
        id: 'b2',
        type: 'textbox',
        title: 'Status Announcement',
        enabled: true,
        textboxContent: '🚀 Currently developing our free Open-Source guns.lol bio platform counterpart!',
        textboxStyle: 'glow'
      },
      {
        id: 'b3',
        type: 'status_api',
        title: 'Discord Status Updates',
        enabled: true,
        statusCustomText: '🎮 Coding in Dark Mode (VS Code) • Sleep is for the weak',
        statusProvider: 'custom'
      },
      {
        id: 'b4',
        type: 'html',
        title: 'Embed Block HTML/CSS',
        enabled: true,
        htmlContent: `<div style="padding: 12px; background: rgba(0, 255, 200, 0.1); border-radius: 8px; border: 1px dashed #00ffcc; text-align: center;">
  <p style="color: #00ffcc; font-family: monospace; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 8px #00ffcc;">
    🔱 CRY_SYSTEM_ACTIVE_V2.13 🔱
  </p>
  <span style="color: #66ffdd; font-size: 11px;">Custom open-source guns.lol layouts with unlimited custom code.</span>
</div>`
      },
      {
        id: 'b5',
        type: 'views_counter',
        title: 'Views Check',
        enabled: true
      },
      {
        id: 'b6',
        type: 'quote',
        title: 'Wisdom Quote',
        enabled: true,
        quoteText: 'The code you write today is the open-source legacy of tomorrow.',
        quoteAuthor: 'OpenSource Evangelist'
      }
    ]
  };

  db.saveBio(seedUsername, defaultBio);

  const testVisits: VisitRecord[] = [
    { timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), referrer: 'google.com', device: 'Desktop', browser: 'Chrome', country: 'RU' },
    { timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), referrer: 'google.com', device: 'Mobile', browser: 'Safari', country: 'RU' },
    { timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), referrer: 'github.com', device: 'Desktop', browser: 'Firefox', country: 'US' },
    { timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), referrer: 'guns.lol', device: 'Desktop', browser: 'Chrome', country: 'DE' },
    { timestamp: new Date(Date.now() - 3600000 * 24 * 1).toISOString(), referrer: 'Direct Link', device: 'Mobile', browser: 'Safari', country: 'GB' },
    { timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), referrer: 'telegram.org', device: 'Mobile', browser: 'Chrome', country: 'RU' },
    { timestamp: new Date().toISOString(), referrer: 'Direct Link', device: 'Desktop', browser: 'Chrome', country: 'US' },
    { timestamp: new Date().toISOString(), referrer: 'Direct Link', device: 'Mobile', browser: 'Safari', country: 'RU' },
  ];
  testVisits.forEach(v => db.addAnalytic(seedUsername, v));
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, origin || true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-password'],
  }));

  // Discord OAuth webhook must read raw body for HMAC
  app.post('/api/discord/oauth/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const secret = process.env.CBIOS_EDGE_SECRET?.trim();
    if (!secret) {
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : String(req.body || '');
    const timestamp = req.headers['x-cbios-timestamp'] as string | undefined;
    const signature = req.headers['x-cbios-signature'] as string | undefined;

    if (!verifyEdgeSignature(secret, rawBody, timestamp, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload: {
      state: string;
      discord: {
        id: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
        premiumType: number;
        publicFlags: number;
        linkedAt: string;
      };
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const username = db.consumeOAuthState(payload.state);
    if (!username) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    const bio = db.getBio(username);
    if (!bio) {
      return res.status(404).json({ error: 'Bio not found' });
    }

    bio.discordConnected = true;
    bio.discordId = payload.discord.id;
    bio.discordUsername = payload.discord.username;
    bio.discordDisplayName = payload.discord.displayName;
    bio.discordAvatarHash = payload.discord.avatarHash;
    bio.discordPremiumType = payload.discord.premiumType;
    bio.discordPublicFlags = payload.discord.publicFlags;
    bio.discordLinkedAt = payload.discord.linkedAt;
    db.saveBio(username, bio);

    res.json({ success: true, username });
  });

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
  }));
  app.use(express.json());

  // Канонический URL: name.cbios.ru → cbios.ru/name (когда Traefik уже проксирует поддомен)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    if (req.path.startsWith('/dashboard') || req.path.startsWith('/admin')) return next();
    const platform = getPlatformConfig(req);
    const host = getRequestHost(req).toLowerCase().split(':')[0];
    const subSlug = parseSubdomainSlug(host, platform.baseDomain);
    if (subSlug) {
      const suffix = req.path === '/' ? '' : req.path;
      return res.redirect(301, `${platform.appUrl}/${subSlug}${suffix}`);
    }
    next();
  });

  const PORT = 3000;

  // Middleware to support simple authentication
  const getUsernameFromRequest = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    const user = db.getUserByToken(token);
    return user ? user.username : null;
  };

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
    keyGenerator: (req) => {
      const username = typeof req.body?.username === 'string' ? req.body.username.toLowerCase().trim() : '';
      return `${ipKeyGenerator(req.ip)}:${username}`;
    },
  });

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many uploads. Try again later.' },
  });

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many admin requests. Try again later.' },
  });

  app.get('/api/health', (_req, res) => {
    res.json(runHealthChecks(DATA_DIR));
  });

  // --- API ROUTING ---

  // AVIF negotiation for WebP uploads
  app.get('/uploads/:folder/:file', (req, res, next) => {
    const { folder, file } = req.params;
    if (folder === 'thumbs' || !file.endsWith('.webp')) return next();
    if (!(req.headers.accept || '').includes('image/avif')) return next();
    const avifPath = path.join(UPLOADS_DIR, file.replace(/\.webp$/i, '.avif'));
    if (fs.existsSync(avifPath)) {
      res.setHeader('Content-Type', 'image/avif');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.sendFile(avifPath);
    }
    next();
  });

  app.get('/uploads/:file', (req, res, next) => {
    const { file } = req.params;
    if (!file.endsWith('.webp')) return next();
    if (!(req.headers.accept || '').includes('image/avif')) return next();
    const avifPath = path.join(UPLOADS_DIR, file.replace(/\.webp$/i, '.avif'));
    if (fs.existsSync(avifPath)) {
      res.setHeader('Content-Type', 'image/avif');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.sendFile(avifPath);
    }
    next();
  });

  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '30d',
    immutable: true,
  }));

  // Upload endpoint
  app.post('/api/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const uploadTypeRaw = (req.body.uploadType as string) || 'bg';
      const uploadType: ImageUploadType = ['avatar', 'bg', 'image'].includes(uploadTypeRaw)
        ? (uploadTypeRaw as ImageUploadType)
        : 'bg';

      if (isImageMime(req.file.mimetype)) {
        const result = await processMedia({
          dataDir: DATA_DIR,
          uploadsDir: UPLOADS_DIR,
          inputPath: req.file.path,
          kind: 'image',
          imageType: uploadType,
        });
        return res.json({
          url: result.url,
          thumbUrl: result.thumbUrl,
          avifUrl: result.avifUrl,
          deduplicated: result.deduplicated,
        });
      }

      if (isVideoMime(req.file.mimetype)) {
        const result = await processMedia({
          dataDir: DATA_DIR,
          uploadsDir: UPLOADS_DIR,
          inputPath: req.file.path,
          kind: 'video',
        });
        return res.json({ url: result.url, deduplicated: result.deduplicated });
      }

      if (isAudioMime(req.file.mimetype)) {
        const result = await processMedia({
          dataDir: DATA_DIR,
          uploadsDir: UPLOADS_DIR,
          inputPath: req.file.path,
          kind: 'audio',
          audioBitrate: '128k',
        });
        return res.json({ url: result.url, deduplicated: result.deduplicated });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (err: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: err.message || 'Upload processing failed' });
    }
  });

  // --- ADMIN PANEL API ---
  app.use('/api/admin', adminLimiter);

  const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const secret = req.headers['x-admin-password'];
    if (!secret || typeof secret !== 'string') {
      return res.status(401).json({ error: 'Unauthorized Admin Session. Invalid Admin Password.' });
    }
    const adminPass = getAdminPassword();
    if (!verifyAdminPassword(secret, adminPass)) {
      return res.status(401).json({ error: 'Unauthorized Admin Session. Invalid Admin Password.' });
    }
    next();
  };

  app.get('/api/admin/verify', checkAdminAuth, (req, res) => {
    res.json({ success: true, status: 'Admin Authenticated' });
  });

  app.get('/api/admin/status', checkAdminAuth, (_req, res) => {
    const site = getSiteSettings(DATA_DIR);
    res.json({
      usingDefaultPassword: isUsingDefaultAdminPassword(DATA_DIR),
      hideAdminPanelLink: site.hideAdminPanelLink,
    });
  });

  app.post('/api/admin/site-settings', checkAdminAuth, (req, res) => {
    const { hideAdminPanelLink } = req.body ?? {};
    if (typeof hideAdminPanelLink !== 'boolean') {
      return res.status(400).json({ error: 'hideAdminPanelLink must be a boolean' });
    }
    const settings = updateSiteSettings(DATA_DIR, { hideAdminPanelLink });
    res.json({ success: true, ...settings });
  });

  app.get('/api/admin/storage-stats', checkAdminAuth, (_req, res) => {
    res.json(getStorageStats(DATA_DIR));
  });

  app.post('/api/admin/cleanup-orphans', checkAdminAuth, (_req, res) => {
    try {
      const allConfigs = db.getAllBios();
      const result = cleanupAllOrphans(UPLOADS_DIR, allConfigs);
      res.json({ success: true, ...result, bytesFreedMb: Math.round((result.bytesFreed / (1024 * 1024)) * 100) / 100 });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Cleanup failed' });
    }
  });

  app.post('/api/admin/optimize-media', checkAdminAuth, async (_req, res) => {
    try {
      const result = await optimizeAllMedia(DATA_DIR, UPLOADS_DIR);
      res.json({
        success: true,
        ...result,
        savedMb: Math.round(((result.bytesBefore - result.bytesAfter) / (1024 * 1024)) * 100) / 100,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Optimize failed' });
    }
  });

  app.post('/api/admin/preview-backup', checkAdminAuth, backupUpload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }
    try {
      const preview = await previewBackupZip(req.file.path);
      res.json({ success: true, preview });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Preview failed' });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  });

  app.get('/api/admin/export-user/:username', checkAdminAuth, (req, res) => {
    streamUserBackup(res, req.params.username.toLowerCase(), { uploadsDir: UPLOADS_DIR });
  });

  app.post('/api/admin/import-user/:username', checkAdminAuth, backupUpload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }
    const overwrite = req.body?.overwrite === 'true' || req.body?.overwrite === true;
    try {
      const result = await importUserBackup(req.file.path, req.params.username.toLowerCase(), {
        uploadsDir: UPLOADS_DIR,
        overwrite,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Import failed' });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  });

  app.post('/api/admin/change-password', checkAdminAuth, (req, res) => {
    const { newPassword } = req.body;
    const policy = validateAdminPassword(newPassword);
    if (!policy.valid) {
      return res.status(400).json({ error: policy.error });
    }
    saveAdminPassword(newPassword);
    res.json({ success: true, message: 'Пароль администратора успешно изменен' });
  });

  app.get('/api/admin/users', checkAdminAuth, (req, res) => {
    const users = db.getAllUsersWithStats();
    res.json(users);
  });

  app.delete('/api/admin/user/:username', checkAdminAuth, (req, res) => {
    const { username } = req.params;
    db.deleteUser(username.toLowerCase());
    res.json({ success: true });
  });

  app.post('/api/admin/rename-user', checkAdminAuth, (req, res) => {
    const { oldUsername, newUsername } = req.body;
    if (!oldUsername || !newUsername) {
      return res.status(400).json({ error: 'oldUsername and newUsername are required' });
    }
    const normOld = oldUsername.toLowerCase().trim();
    const normNew = newUsername.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_-]{3,15}$/.test(normNew)) {
      return res.status(400).json({ error: 'New username must be 3-15 alphanumeric characters' });
    }
    if (db.getUser(normNew)) {
      return res.status(400).json({ error: 'Target username already exists' });
    }
    db.updateUsername(normOld, normNew);
    res.json({ success: true, newUsername: normNew });
  });

  app.post('/api/admin/change-user-password', checkAdminAuth, (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Username and newPassword are required' });
    }
    const normUsername = username.toLowerCase().trim();
    const policy = validateUserPassword(newPassword);
    if (!policy.valid) {
      return res.status(400).json({ error: policy.error });
    }
    const user = db.getUser(normUsername);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    db.updateUserPasswordAndInvalidateSessions(normUsername, hashPassword(newPassword));
    res.json({ success: true, message: `Пароль пользователя @${normUsername} изменён. Все сессии сброшены.` });
  });

  app.post('/api/admin/toggle-verify/:username', checkAdminAuth, (req, res) => {
    const username = req.params.username.toLowerCase();
    const bio = db.getBio(username);
    if (!bio) {
      return res.status(404).json({ error: 'Bio not found' });
    }
    bio.verified = !bio.verified;
    db.saveBio(username, bio);
    res.json({ success: true, verified: bio.verified });
  });

  app.get('/api/admin/export-db', checkAdminAuth, (req, res) => {
    const includeAnalytics = req.query.includeAnalytics !== 'false';
    const includeSecrets = req.query.includeSecrets === 'true';
    const dump = db.exportDatabase({ includeAnalytics, includeSecrets });
    res.json(dump);
  });

  app.post('/api/admin/import-db', checkAdminAuth, (req, res) => {
    const { dump } = req.body;
    if (!dump || typeof dump !== 'object') {
      return res.status(400).json({ error: 'Invalid database dump payload' });
    }
    db.importDatabase(dump);
    res.json({ success: true });
  });

  app.get('/api/admin/export-full', checkAdminAuth, (req, res) => {
    const includeAnalytics = req.query.includeAnalytics !== 'false';
    streamFullBackup(res, {
      includeAnalytics,
      uploadsDir: UPLOADS_DIR,
      dataDir: DATA_DIR,
    }).catch((err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Export failed' });
      }
    });
  });

  app.post('/api/admin/import-full', checkAdminAuth, backupUpload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }

    try {
      const result = await importFullBackup(req.file.path, {
        uploadsDir: UPLOADS_DIR,
        dataDir: DATA_DIR,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Import failed' });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  });

  // Get active Bio directories listing
  app.get('/api/all-bios', (req, res) => {
    const bios = db.getAllBios();
    const profiles = bios.map(bio => ({
      username: bio.username,
      displayName: bio.displayName,
      bio: bio.bio,
      avatarUrl: bio.avatarUrl,
      verified: bio.verified
    }));
    res.json(profiles);
  });

  // Public platform config (domain, URLs)
  app.get('/api/public-config', (req, res) => {
    const platform = getPlatformConfig(req);
    const site = getSiteSettings(DATA_DIR);
    res.json({
      ...platform,
      hideAdminPanelLink: site.hideAdminPanelLink,
      mediaCdnUrl: getServerMediaCdnUrl(),
      ssl: {
        wildcardRequired: true,
        provider: 'coolify-traefik',
        setupGuidePath: 'deploy/coolify/SSL_SETUP.md',
      },
    });
  });

  // Get singular page bio data (username or alias slug)
  app.get('/api/bio/:slug', (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const bio = db.getBioBySlug(slug);
    if (!bio) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(bio);
  });

  // Resolve hostname → username (wildcard subdomain or custom domain)
  app.get('/api/resolve-host', (req, res) => {
    const host = (req.query.host as string || getRequestHost(req)).toLowerCase().trim().split(':')[0];
    if (!host) {
      return res.status(400).json({ error: 'Missing host parameter' });
    }

    const platform = getPlatformConfig(req);
    const subdomainSlug = parseSubdomainSlug(host, platform.baseDomain);
    if (subdomainSlug) {
      const bio = db.getBioBySlug(subdomainSlug);
      if (bio) {
        return res.json({ success: true, username: bio.username, slug: subdomainSlug, source: 'subdomain' });
      }
      return res.json({ success: false, reason: 'profile_not_found' });
    }

    const custom = db.getBioByCustomDomain(host);
    if (custom) {
      return res.json({ success: true, username: custom.username, slug: custom.username, source: 'custom_domain' });
    }

    res.json({ success: false, reason: 'no_match' });
  });

  // Legacy: custom domain lookup
  app.get('/api/bio-by-host', (req, res) => {
    const host = (req.query.host as string || '').toLowerCase().trim().split(':')[0];
    if (!host) {
      return res.status(400).json({ error: 'Missing host parameter' });
    }

    const platform = getPlatformConfig(req);
    const subdomainSlug = parseSubdomainSlug(host, platform.baseDomain);
    if (subdomainSlug) {
      const bio = db.getBioBySlug(subdomainSlug);
      if (bio) {
        return res.json({ success: true, username: bio.username });
      }
    }

    const matched = db.getBioByCustomDomain(host);
    if (matched) {
      return res.json({ success: true, username: matched.username });
    }
    res.json({ success: false });
  });

  // Discord OAuth + Lanyard presence
  app.get('/api/discord/oauth/start', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const edgeUrl = getEdgeUrl();
    if (!edgeUrl) {
      return res.status(503).json({ error: 'Discord OAuth не настроен. Задайте CBIOS_EDGE_URL и задеployьте cbios-edge Worker.' });
    }

    const state = db.createOAuthState(authedUser);
    const url = `${edgeUrl.replace(/\/$/, '')}/oauth/start?state=${encodeURIComponent(state)}`;
    res.json({ url });
  });

  app.post('/api/discord/disconnect', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const bio = db.getBio(authedUser);
    if (!bio) {
      return res.status(404).json({ error: 'Bio not found' });
    }

    bio.discordConnected = false;
    bio.discordId = undefined;
    bio.discordUsername = undefined;
    bio.discordDisplayName = undefined;
    bio.discordAvatarHash = undefined;
    bio.discordPremiumType = undefined;
    bio.discordPublicFlags = undefined;
    bio.discordLinkedAt = undefined;
    db.saveBio(authedUser, bio);

    res.json({ success: true });
  });

  app.get('/api/discord/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!/^\d{17,19}$/.test(userId)) {
        return res.status(400).json({ error: 'Invalid Discord user ID' });
      }

      const bio = db.getAllBios().find(b => b.discordId === userId) || null;
      const edgeUrl = getEdgeUrl();

      if (edgeUrl) {
        const lanyardRes = await fetchViaEdge(`/lanyard/${userId}`);
        if (lanyardRes.ok) {
          const data = await lanyardRes.json() as { success?: boolean; data?: any };
          if (data.data?.discord_user && bio) {
            data.data = mergeBadgesIntoLanyardUser(
              data.data,
              bio.discordPublicFlags,
              bio.discordPremiumType,
            );
          } else if (data.data?.discord_user) {
            data.data.discord_user.badges = decodeDiscordBadges(
              data.data.discord_user.public_flags ?? 0,
              0,
            );
          }
          return res.json(data);
        }
      } else {
        const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
        if (lanyardRes.ok) {
          const data = await lanyardRes.json() as { data?: any };
          if (data.data && bio) {
            data.data = mergeBadgesIntoLanyardUser(data.data, bio.discordPublicFlags, bio.discordPremiumType);
          }
          return res.json(data);
        }
      }

      if (bio?.discordConnected) {
        return res.json(staticDiscordPresenceFromBio(bio));
      }

      return res.status(404).json({ success: false, error: 'Discord presence unavailable' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Register or Login endpoint
  app.post('/api/auth/login-register', authLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.trim() === '' || password.trim() === '') {
      return res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
    }

    const normUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_-]{3,15}$/.test(normUsername)) {
      return res.status(400).json({ error: 'Имя: 3–15 символов, латиница, цифры, _ или -' });
    }

    const existingUser = db.getUser(normUsername);
    const authFailMessage = 'Неверное имя пользователя или пароль';

    if (existingUser) {
      if (isAccountLocked(existingUser)) {
        return res.status(429).json({ error: 'Аккаунт временно заблокирован из-за множества неудачных попыток. Попробуйте позже.' });
      }

      const { valid, needsRehash } = verifyPassword(password, existingUser.password_hash);
      if (valid) {
        clearLoginAttempts(normUsername);
        if (needsRehash) {
          db.updateUserPassword(normUsername, hashPassword(password));
        }
        const sessionToken = crypto.randomUUID();
        db.updateUserToken(normUsername, sessionToken);
        return res.json({ token: sessionToken, username: normUsername, isNew: false });
      }

      recordFailedLogin(normUsername);
      return res.status(401).json({ error: authFailMessage });
    }

    const policy = validateUserPassword(password, { isRegistration: true });
    if (!policy.valid) {
      return res.status(400).json({ error: policy.error });
    }

    const sessionToken = crypto.randomUUID();
    db.createUser(normUsername, hashPassword(password), sessionToken);

    const defaultBio: BioConfig = {
        username: normUsername,
        displayName: normUsername,
        bio: 'Just another badass awesome creator page.',
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${normUsername}`,
        verified: false,
        customBadge: 'USER',
        sparkles: false,
        uid: Math.floor(100000 + Math.random() * 900000),
        discordConnected: false,
        googleConnected: false,
        fontFamily: 'Inter',
        primaryColor: '#8a2be2',
        textColor: '#ffffff',
        glowColor: '#a855f7',
        bgType: 'color',
        bgValue: '#0c0a0f',
        bgBlur: 0,
        bgDim: 0,
        audioUrl: '',
        audioTitle: '',
        audioArtist: '',
        audioEnabled: false,
        enterText: 'click to enter',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'socials',
            title: 'My Links',
            enabled: true,
            socialsList: [
              { id: crypto.randomUUID(), platform: 'github', url: 'https://github.com/' + normUsername },
              { id: crypto.randomUUID(), platform: 'telegram', url: 'https://t.me/' }
            ]
          }
        ]
      };

    db.saveBio(normUsername, defaultBio);

    res.status(201).json({ token: sessionToken, username: normUsername, isNew: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (authedUser) {
      db.clearUserToken(authedUser);
    }
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', authLimiter, (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Сессия недействительна' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
    }

    const policy = validateUserPassword(newPassword, { isRegistration: true });
    if (!policy.valid) {
      return res.status(400).json({ error: policy.error });
    }

    const user = db.getUser(authedUser);
    if (!user) {
      return res.status(401).json({ error: 'Сессия недействительна' });
    }

    const { valid } = verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      recordFailedLogin(authedUser);
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    const sessionToken = crypto.randomUUID();
    db.updateUserPassword(authedUser, hashPassword(newPassword));
    db.updateUserToken(authedUser, sessionToken);
    res.json({ success: true, token: sessionToken, message: 'Пароль успешно изменён' });
  });

  // Check auth session validity
  app.get('/api/auth/verify', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ username: authedUser });
  });

  // Change user account username Slug
  app.post('/api/auth/change-username', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized credentials session' });
    }

    const { newUsername } = req.body;
    if (!newUsername || newUsername.trim() === '') {
      return res.status(400).json({ error: 'New username target slug required' });
    }

    const normNewUsername = newUsername.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_-]{3,15}$/.test(normNewUsername)) {
      return res.status(400).json({ error: 'Username must be 3-15 alphanumeric characters, dashes, or underscores' });
    }

    if (db.getUser(normNewUsername)) {
      return res.status(400).json({ error: 'Username slug is already reserved by another creator' });
    }

    db.updateUsername(authedUser, normNewUsername);

    res.json({ success: true, username: normNewUsername });
  });

  // Unified import hub (guns.lol URL or HTML)
  app.post('/api/import-profile', async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const { input } = req.body ?? {};
    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({ error: 'Укажите ссылку guns.lol или HTML страницы' });
    }

    const jobId = crypto.randomUUID();
    const job: ImportJob = {
      username: authedUser,
      status: 'running',
      progress: { current: 0, total: 0, label: 'parse' },
      listeners: new Set(),
    };
    importJobs.set(jobId, job);

    res.json({ success: true, jobId });

    (async () => {
      try {
        emitImportJob(jobId, 'progress', { ...job.progress, label: 'Разбор профиля…' });
        const parsed = await parseImportInput(input);
        emitImportJob(jobId, 'progress', { current: 0, total: 1, label: 'Загрузка медиа…' });

        const withMedia = await rehostImportMedia(
          parsed,
          UPLOADS_DIR,
          TMP_DIR,
          (current, total, label) => {
            job.progress = { current, total, label };
            emitImportJob(jobId, 'progress', job.progress);
          },
          DATA_DIR,
        );

        job.status = 'done';
        job.result = {
          ...withMedia,
          preview: getImportPreviewSummary(withMedia as import('./src/gunsImportMap').GunsImportResult),
        };
        emitImportJob(jobId, 'done', job.result);
      } catch (err: any) {
        job.status = 'error';
        job.error = err.message || 'Import failed';
        emitImportJob(jobId, 'error', { error: job.error });
      } finally {
        setTimeout(() => importJobs.delete(jobId), 15 * 60 * 1000);
      }
    })();
  });

  app.get('/api/import-profile/progress/:jobId', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const job = importJobs.get(req.params.jobId);
    if (!job || job.username !== authedUser) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('progress', job.progress);
    if (job.status === 'done') {
      send('done', job.result);
      return res.end();
    }
    if (job.status === 'error') {
      send('error', { error: job.error });
      return res.end();
    }

    const listener = (event: string, data: unknown) => send(event, data);
    job.listeners.add(listener);

    req.on('close', () => {
      job.listeners.delete(listener);
    });
  });

  // Legacy import endpoint (deprecated, uses import hub)
  app.post('/api/import-gunslol', async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const { targetUsername, input } = req.body;
    const importInput = input || (targetUsername ? `https://guns.lol/${targetUsername.trim()}` : '');
    if (!importInput) {
      return res.status(400).json({ error: 'Target guns.lol username or input required' });
    }

    try {
      const parsed = await parseImportInput(importInput);
      const responseData = await rehostImportMedia(parsed, UPLOADS_DIR, TMP_DIR, undefined, DATA_DIR);
      res.json({
        success: true,
        data: {
          ...responseData,
          preview: getImportPreviewSummary(responseData as import('./src/gunsImportMap').GunsImportResult),
        },
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Import failure' });
    }
  });

  app.post('/api/rehost-import-media', async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    try {
      const payload = req.body as {
        avatarUrl?: string;
        bgType?: string;
        bgValue?: string;
        audioUrl?: string;
        customCursorUrl?: string;
        playlist?: { id: string; url: string; title: string; artist: string }[];
      };

      const rehosted = await rehostImportMedia(payload, UPLOADS_DIR, TMP_DIR, undefined, DATA_DIR);
      res.json({ success: true, data: rehosted });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: `Rehost failure: ${error.message}` });
    }
  });

  // Save/Update Bio Config
  app.post('/api/bio/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    const authedUser = getUsernameFromRequest(req);

    if (!authedUser || authedUser !== username) {
      return res.status(401).json({ error: 'Unauthorized configuration edit session' });
    }

    const payload = req.body as BioConfig;
    if (!payload) {
      return res.status(400).json({ error: 'Payload body missing' });
    }

    // Force strict username preservation
    payload.username = username;

    if (payload.aliasSlug) {
      const alias = normalizeSlug(payload.aliasSlug);
      payload.aliasSlug = alias;
      if (!isValidSlug(alias)) {
        return res.status(400).json({ error: 'Alias slug: только a-z, 0-9, _ и - (1–32 символа)' });
      }
      if (isReservedSlug(alias)) {
        return res.status(400).json({ error: 'Этот alias зарезервирован системой' });
      }
      if (db.isAliasSlugTaken(alias, username)) {
        return res.status(409).json({ error: 'Этот alias уже занят другим пользователем' });
      }
    }

    const oldConfig = db.getBio(username);
    db.saveBio(username, payload);

    const allConfigs = db.getAllBios();
    if (oldConfig) {
      deleteUnusedBetweenConfigs(oldConfig, payload, allConfigs, UPLOADS_DIR);
    }

    res.json({ message: 'Profile saved successfully', config: payload });
  });

  // Track visit (anonymous, fast increment)
  app.post('/api/bio/:slug/visit', (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const bio = db.getBioBySlug(slug);
    if (!bio) {
      return res.status(404).json({ error: 'Lookup target does not exist' });
    }
    const username = bio.username;

    // Capture analytic headers
    const rawReferrer = req.body.referrer || req.get('Referer') || 'Direct Link';
    let referrer = 'Direct Link';
    if (rawReferrer && typeof rawReferrer === 'string') {
      if (rawReferrer.includes('google.com')) referrer = 'Google';
      else if (rawReferrer.includes('yandex')) referrer = 'Yandex';
      else if (rawReferrer.includes('github.com')) referrer = 'GitHub';
      else if (rawReferrer.includes('t.me') || rawReferrer.includes('telegram')) referrer = 'Telegram';
      else if (rawReferrer.includes('youtube.com')) referrer = 'YouTube';
      else if (rawReferrer.includes('discord.com') || rawReferrer.includes('discord.gg')) referrer = 'Discord';
      else if (rawReferrer.includes('guns.lol')) referrer = 'guns.lol';
      else if (rawReferrer !== 'Direct Link') {
        try {
          const urlObj = new URL(rawReferrer);
          referrer = urlObj.hostname;
        } catch (_) {
          referrer = rawReferrer.substring(0, 30);
        }
      }
    }

    // Browser & Device detection
    const userAgent = req.get('User-Agent') || '';
    let browser = 'Other';
    if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';

    let device = 'Desktop';
    if (/Mobi|Android|iPhone|iPad/i.test(userAgent)) {
      device = 'Mobile';
    } else if (/Tablet/i.test(userAgent)) {
      device = 'Tablet';
    }

    const cfCountry = req.get('CF-IPCountry');
    const langHeader = req.get('Accept-Language') || '';
    let country = cfCountry && cfCountry !== 'XX' ? cfCountry : 'Intl';
    if (country === 'Intl') {
      if (langHeader.startsWith('ru')) country = 'RU';
      else if (langHeader.startsWith('en-US') || langHeader.includes('en-US')) country = 'US';
      else if (langHeader.startsWith('en-GB') || langHeader.includes('en-GB')) country = 'GB';
      else if (langHeader.startsWith('de') || langHeader.includes('de')) country = 'DE';
      else if (langHeader.startsWith('fr') || langHeader.includes('fr')) country = 'FR';
      else if (langHeader.startsWith('es') || langHeader.includes('es')) country = 'ES';
      else if (langHeader.startsWith('it') || langHeader.includes('it')) country = 'IT';
      else if (langHeader.includes('kz')) country = 'KZ';
      else if (langHeader.includes('by')) country = 'BY';
      else if (langHeader.includes('ua')) country = 'UA';
      else if (langHeader.split(',')[0]) {
        country = langHeader.split(',')[0].substring(0, 2).toUpperCase();
      }
    }

    const visit: VisitRecord = {
      timestamp: new Date().toISOString(),
      referrer,
      device,
      browser,
      country,
      host: req.body.host || req.get('host') || 'Unknown'
    };

    db.addAnalytic(username, visit);

    res.json({ ok: true });
  });

  // Get Analytics Summary
  app.get('/api/bio/:username/analytics', (req, res) => {
    const username = req.params.username.toLowerCase();
    const authedUser = getUsernameFromRequest(req);

    if (!authedUser || authedUser !== username) {
      return res.status(401).json({ error: 'Unauthorized analytics check' });
    }

    const visits = db.getAnalytics(username);

    // Formulate summaries
    const totalViews = visits.length;
    // Calculate simulated Unique Views (grouping by date + browser + device)
    const uniquesSet = new Set(visits.map(v => {
      const dStr = v.timestamp.slice(0, 13); // group by hour
      return `${dStr}_${v.browser}_${v.device}_${v.country}`;
    }));
    const uniqueViews = uniquesSet.size === 0 && totalViews > 0 ? totalViews : uniquesSet.size;

    // Formulate views trend for last 7 days
    const last7Days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - 3600000 * 24 * i);
      const k = date.toISOString().slice(5, 10); // MM-DD
      last7Days[k] = 0;
    }

    visits.forEach(v => {
      const k = v.timestamp.slice(5, 10); // MM-DD
      if (last7Days[k] !== undefined) {
        last7Days[k]++;
      }
    });

    const visitsOverTime = Object.entries(last7Days).map(([date, views]) => ({ date, views }));

    // Histograms
    const histogram = <K extends keyof VisitRecord>(key: K) => {
      const counts: Record<string, number> = {};
      visits.forEach(v => {
        const val = v[key] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([k, v]) => ({ name: k, count: v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    const referrerRaw = histogram('referrer');
    const deviceRaw = histogram('device');
    const browserRaw = histogram('browser');
    const countryRaw = histogram('country');
    const hostRaw = histogram('host');

    const summary: AnalyticsSummary = {
      username,
      totalViews,
      uniqueViews,
      visitsOverTime,
      referrersHistogram: referrerRaw.map(r => ({ referrer: r.name, count: r.count })),
      devicesHistogram: deviceRaw.map(d => ({ device: d.name, count: d.count })),
      browsersHistogram: browserRaw.map(b => ({ browser: b.name, count: b.count })),
      countriesHistogram: countryRaw.map(c => ({ country: c.name, count: c.count })),
      hostsHistogram: hostRaw.map(h => ({ host: h.name, count: h.count }))
    };

    res.json(summary);
  });

  // OpenSource scripts provider
  app.get('/api/install-script', (req, res) => {
    const platform = getPlatformConfig(req);
    const installOrigin = platform.appUrl;
    // Generates a script config downloader
    const shellScript = `#!/bin/bash
# =====================================================================
#  CRY BIOS (guns.lol OpenSource Alternative) Self-Host Installer
# =====================================================================

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}=====================================================\${NC}"
echo -e "\${GREEN}🚀 Starting CRY BIOS Server Install Wizard (Guns.lol Alternative)\${NC}"
echo -e "\${BLUE}=====================================================\${NC}"

# Check docker presence
if ! [ -x "$(command -v docker)" ]; then
  echo -e "\${RED}Error: docker is not installed. Please install Docker first.\${NC}" >&2
  exit 1
fi

if ! [ -x "$(command -v docker-compose)" ]; then
  echo -e "\${RED}Error: docker-compose is not installed. Please install docker-compose.\${NC}" >&2
  exit 2
fi

# Create space
mkdir -p biogun-stack
cd biogun-stack
mkdir -p data

echo -e "\${BLUE}✍️ Generating docker-compose.yml configuration with persistent binds...\${NC}"

cat << 'EOF' > docker-compose.yml
version: '3.8'

services:
  biogun:
    image: biogun/server:latest
    container_name: biogun_server
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GEMINI_API_KEY=""  # Optional API integration key
    volumes:
      - cry_bios_data:/app/data

volumes:
  cry_bios_data:
    driver: local
EOF

echo -e "\${GREEN}✅ Created docker-compose.yml successfully.\${NC}"
echo -e "\${BLUE}📦 Pulling official Docker images and starting the stack...\${NC}"

docker compose pull || echo -e "\${RED}Image lookup fallback: Project runs containerized locally via standard local node build too\${NC}"
docker compose up -d || echo -e "\${RED}Continuing local npm install configuration wizard.\${NC}"

echo -e "\${BLUE}=====================================================\${NC}"
echo -e "\${GREEN}🎯 Server fully running and bound! URL: ${installOrigin}\${NC}"
echo -e "\${GREEN}📊 Persistent data logs safely synchronized to ./data/\${NC}"
echo -e "\${BLUE}=====================================================\${NC}"
`;
    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
    res.send(shellScript);
  });

  // Multer / upload error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 50 MB for uploads, 500 MB for backups.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err?.message?.includes('Unsupported file type') || err?.message?.includes('Only ZIP')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  // 404 for unhandled API routes before SPA fallback
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // --- VITE DEV MIDDLEWARE AND STATIC PRODUCTION HOSTING ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend compiled bundle
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Fallback everything else to SPA HTML load
    app.get('*', (req, res, next) => {
      // Avoid intercepting /api endpoints
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Open-Source CRY BIOS Server started on http://0.0.0.0:${PORT}`);
    console.log(`Persisted database synchronized successfully.`);

    if (isUsingDefaultAdminPassword(DATA_DIR)) {
      console.warn('[security] WARNING: Using default admin password. Set ADMIN_PASSWORD env or change via admin panel.');
    }

    if (process.env.DISABLE_SCHEDULED_BACKUP !== 'true') {
      startScheduledBackups({
        dataDir: DATA_DIR,
        uploadsDir: UPLOADS_DIR,
        includeAnalytics: true,
      });
    }
  });
}

startServer().catch(err => {
  console.error("Critical crash in server initialization", err);
});
