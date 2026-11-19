/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promises as dns } from 'dns';
import multer from 'multer';
import bcrypt from 'bcrypt';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { BioConfig, VisitRecord, AnalyticsSummary, SocialLink } from './src/types';
import * as db from './src/db';
import { writeBackupToFile, streamFullBackup, importFullBackup, previewBackupZip, streamUserBackup, importUserBackup, getMaxBackupBytes } from './src/backup';
import {
  initChunkedUpload,
  saveUploadChunk,
  startImportFromAssembledUpload,
  getImportJob,
  listIncomingBackupFiles,
  startImportFromDisk,
  ensureIncomingDir,
  getChunkBytes,
} from './src/backupUpload';
import { isAllowedMime, isImageMime, type ImageUploadType } from './src/imageProcessing';
import { isVideoMime } from './src/videoProcessing';
import { isAudioMime } from './src/audioProcessing';
import { validateUserPassword, validateAdminPassword } from './src/passwordPolicy';
import { isAccountLocked, recordFailedLogin, clearLoginAttempts } from './src/authLockout';
import { rehostImportMedia } from './src/rehostMedia';
import { getImportPreviewSummary } from './src/gunsImportMap';
import { parseImportInput } from './src/importHub';
import { cleanupAllOrphans, deleteUnusedBetweenConfigs } from './src/uploadCleanup';
import { getStorageStats, runHealthChecks } from './src/storageStats';
import { createAdminAuth, FailureLimiter } from './src/adminAuth';
import { guardProfilePayload, sanitizeVisitHost } from './src/profileGuard';
import { getSiteSettings, updateSiteSettings } from './src/siteSettings';
import { installLogCapture, readLogs, clearLogs, writeAudit, readAudit, getSystemInfo, readHomeLayout, writeHomeLayout, resetHomeLayout } from './src/adminOps';
import { startScheduledBackups } from './src/scheduledBackup';
import { processMedia, resolveUploadFilePath, optimizeAllMedia } from './src/mediaPipeline';
import {
  getPlatformDomainConfig,
  isReservedSlug,
  isReservedUsername,
  isValidSlug,
  normalizeSlug,
  parseSubdomainSlug,
} from './src/platformDomain';
import { getServerMediaCdnUrl } from './src/utils/cdn';
import { registerDiscord, preserveDiscordFields } from './src/discord';
import { createGithubService, isValidRepo, DEFAULT_REPO } from './src/github';
import { getSocialLinks } from './src/socials';

// Разрешённые origin: cbios.ru и cryteam.ru (+ один уровень поддоменов, в т.ч. cdn.*) и CORS_ALLOWED_ORIGINS из окружения
const CBIOS_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?(cbios\.ru|cryteam\.ru)$/;
const EXTRA_CORS_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean)
);

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const o = origin.toLowerCase();
  if (CBIOS_ORIGIN_RE.test(o)) return true;
  return EXTRA_CORS_ORIGINS.has(o);
}

// Establish folders
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

installLogCapture();

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

const adminAuth = createAdminAuth(DATA_DIR);
const adminFailures = new FailureLimiter(10, 15 * 60 * 1000);

// Multer storage config
const storage = multer.diskStorage({
  // Сырая загрузка идёт во временную папку, без расширения из originalname.
  // В uploads попадают только файлы, перекодированные нашим пайплайном.
  destination: (req, file, cb) => {
    cb(null, TMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}.upload`);
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
  limits: { fileSize: getMaxBackupBytes() },
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

const chunkUploadDir = path.join(TMP_DIR, 'chunks');
if (!fs.existsSync(chunkUploadDir)) {
  fs.mkdirSync(chunkUploadDir, { recursive: true });
}

const chunkUpload = multer({
  dest: chunkUploadDir,
  limits: { fileSize: getChunkBytes() + 1024 * 1024 },
});

const BCRYPT_ROUNDS = 10;

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
  // Доверяем X-Forwarded-* только прокси из приватных сетей (Traefik/nginx/Docker),
  // чтобы клиент из интернета не мог подделать свой IP. Переопределяется TRUST_PROXY.
  const trustProxyEnv = process.env.TRUST_PROXY;
  app.set('trust proxy', trustProxyEnv === undefined || trustProxyEnv === ''
    ? 'loopback, linklocal, uniquelocal'
    : (/^\d+$/.test(trustProxyEnv) ? Number(trustProxyEnv) : trustProxyEnv));

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

  // CSP в dev отключена (Vite HMR использует inline/eval)
  const cspEnabled = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: cspEnabled ? {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'", 'https:'],
        'frame-src': ['https:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
      },
    } : false,
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

  const PORT = Number(process.env.PORT) || 3000;

  // Middleware to support simple authentication
  // Сессия: HttpOnly-cookie (браузер, недоступна из JS) или Bearer-токен (API-клиенты, скрипты)
  const SESSION_COOKIE = 'cry_session';

  const readCookie = (req: express.Request, name: string): string | null => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      if (part.slice(0, idx).trim() === name) {
        try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return null; }
      }
    }
    return null;
  };

  const setSessionCookie = (req: express.Request, res: express.Response, token: string) => {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      path: '/',
      maxAge: db.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  };

  const clearSessionCookie = (req: express.Request, res: express.Response) => {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
  };

  // CSRF для cookie-сессии: у небезопасных запросов Origin (если есть) должен совпадать с Host
  const isSameOriginRequest = (req: express.Request): boolean => {
    const origin = req.get('origin');
    if (!origin) return true;
    try {
      return new URL(origin).host.toLowerCase() === getRequestHost(req).toLowerCase();
    } catch {
      return false;
    }
  };

  const getUsernameFromRequest = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const user = db.getUserByToken(authHeader.split(' ')[1]);
      return user ? user.username : null;
    }
    const cookieToken = readCookie(req, SESSION_COOKIE);
    if (!cookieToken) return null;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isSameOriginRequest(req)) return null;
    const user = db.getUserByToken(cookieToken);
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

  // Вход: ограничение по IP отдельно от пары ip:username (против spraying по многим логинам)
  const authIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Слишком много попыток входа с вашего IP. Попробуйте позже.' },
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  });
  // Регистрация: не больше 5 новых аккаунтов в час с одного IP
  const registrations = new FailureLimiter(5, 60 * 60 * 1000);
  // Публичные чтения и аналитика
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again later.' },
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  });
  const visitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false },
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  });
  const visitDedupe = new FailureLimiter(3, 10 * 60 * 1000);
  // Импорт/rehost запускают скачивание и ffmpeg — лимит на пользователя
  const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много импортов. Попробуйте позже.' },
    keyGenerator: (req) => `u:${getUsernameFromRequest(req) || ipKeyGenerator(req.ip || '')}`,
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
    skip: (req) => {
      const url = req.originalUrl || req.url || '';
      return /\/api\/admin\/import-full(\/|$)/.test(url);
    },
  });

  app.get('/api/health', (_req, res) => {
    res.json(runHealthChecks(DATA_DIR));
  });

  // --- API ROUTING ---
  // CORS for uploads (needed for Web Audio / canvas via CDN)
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  // AVIF negotiation for WebP uploads
  app.get('/uploads/:folder/:file', (req, res, next) => {
    const { folder, file } = req.params;
    if (folder === 'thumbs' || !file.endsWith('.webp')) return next();
    if (file !== path.basename(file) || folder !== path.basename(folder)) return next();
    if (!(req.headers.accept || '').includes('image/avif')) return next();
    const avifPath = path.join(UPLOADS_DIR, file.replace(/\.webp$/i, '.avif'));
    if (path.dirname(avifPath) === UPLOADS_DIR && fs.existsSync(avifPath)) {
      res.setHeader('Content-Type', 'image/avif');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.sendFile(avifPath);
    }
    next();
  });

  app.get('/uploads/:file', (req, res, next) => {
    const { file } = req.params;
    if (!file.endsWith('.webp')) return next();
    if (file !== path.basename(file)) return next();
    if (!(req.headers.accept || '').includes('image/avif')) return next();
    const avifPath = path.join(UPLOADS_DIR, file.replace(/\.webp$/i, '.avif'));
    if (path.dirname(avifPath) === UPLOADS_DIR && fs.existsSync(avifPath)) {
      res.setHeader('Content-Type', 'image/avif');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.sendFile(avifPath);
    }
    next();
  });

  const INLINE_UPLOAD_EXTS = new Set([
    '.webp', '.avif', '.png', '.jpg', '.jpeg', '.gif',
    '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.m4a', '.aac',
  ]);
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '30d',
    immutable: true,
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
      // Пользовательский контент не должен исполняться на нашем origin
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      if (!INLINE_UPLOAD_EXTS.has(path.extname(filePath).toLowerCase())) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    },
  }));

  // Режим обслуживания: пользовательская запись закрыта, чтение и вход работают
  app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const p = req.path;
    const writes = /^\/api\/(upload|import-profile|import-gunslol|rehost-import-media)$/.test(p) || /^\/api\/bio\/[^/]+$/.test(p);
    if (!writes) return next();
    const site = getSiteSettings(DATA_DIR);
    if (!site.maintenanceMode) return next();
    return res.status(503).json({ error: site.maintenanceMessage, maintenance: true });
  });

  // Upload endpoint: сначала авторизация, и только потом multer пишет файл на диск
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getUsernameFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized Session' });
    next();
  };

  const uploadUserLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many uploads. Try again later.' },
    keyGenerator: (req) => `u:${getUsernameFromRequest(req) || ipKeyGenerator(req.ip || '')}`,
  });

  const singleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      const status = err instanceof multer.MulterError ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Upload failed' });
    });
  };

  app.post('/api/upload', uploadLimiter, requireAuth, uploadUserLimiter, singleUpload, async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      if (req.file?.path) fs.rmSync(req.file.path, { force: true });
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const tempPath = req.file.path;

    try {
      const uploadTypeRaw = (req.body.uploadType as string) || 'bg';
      const uploadType: ImageUploadType = ['avatar', 'bg', 'image'].includes(uploadTypeRaw)
        ? (uploadTypeRaw as ImageUploadType)
        : 'bg';

      if (isImageMime(req.file.mimetype)) {
        const result = await processMedia({
          dataDir: DATA_DIR,
          uploadsDir: UPLOADS_DIR,
          inputPath: tempPath,
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
          inputPath: tempPath,
          kind: 'video',
        });
        return res.json({ url: result.url, deduplicated: result.deduplicated });
      }

      if (isAudioMime(req.file.mimetype)) {
        const result = await processMedia({
          dataDir: DATA_DIR,
          uploadsDir: UPLOADS_DIR,
          inputPath: tempPath,
          kind: 'audio',
          audioBitrate: '128k',
        });
        return res.json({ url: result.url, deduplicated: result.deduplicated });
      }

      return res.status(415).json({ error: 'Unsupported file type' });
    } catch (err: any) {
      const status = err?.status === 415 ? 415 : (err?.name === 'Error' && /unsupported image format|Input .*(corrupt|unsupported)/i.test(err?.message || '') ? 415 : 500);
      res.status(status).json({ error: status === 415 ? 'Unsupported or corrupt media file' : (err.message || 'Upload processing failed') });
    } finally {
      fs.rmSync(tempPath, { force: true });
    }
  });

  // --- ADMIN PANEL API ---
  app.use('/api/admin', adminLimiter);

  const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminKey = ipKeyGenerator(req.ip || '');
    if (adminFailures.isBlocked(adminKey)) {
      res.setHeader('Retry-After', '900');
      return res.status(429).json({ error: 'Too many failed admin logins. Try again later.' });
    }
    const raw = req.headers['x-admin-password'];
    if (!raw || typeof raw !== 'string') {
      adminFailures.fail(adminKey);
      return res.status(401).json({ error: 'Unauthorized Admin Session. Invalid Admin Password.' });
    }
    let secret = raw;
    try {
      secret = decodeURIComponent(raw);
    } catch {
      secret = raw;
    }
    if (!adminAuth.verify(secret)) {
      adminFailures.fail(adminKey);
      return res.status(401).json({ error: 'Unauthorized Admin Session. Invalid Admin Password.' });
    }
    adminFailures.reset(adminKey);
    next();
  };

  app.get('/api/admin/verify', checkAdminAuth, (req, res) => {
    res.json({ success: true, status: 'Admin Authenticated' });
  });

  app.get('/api/admin/status', checkAdminAuth, (_req, res) => {
    res.json({ usingDefaultPassword: false, ...getSiteSettings(DATA_DIR) });
  });

  app.post('/api/admin/site-settings', checkAdminAuth, (req, res) => {
    const body = req.body ?? {};
    const patch: Partial<ReturnType<typeof getSiteSettings>> = {};
    for (const key of ['hideAdminPanelLink', 'registrationOpen', 'maintenanceMode'] as const) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') return res.status(400).json({ error: `${key} must be a boolean` });
        patch[key] = body[key];
      }
    }
    if ('maintenanceMessage' in body) {
      if (typeof body.maintenanceMessage !== 'string') return res.status(400).json({ error: 'maintenanceMessage must be a string' });
      patch.maintenanceMessage = body.maintenanceMessage;
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No settings provided' });
    const settings = updateSiteSettings(DATA_DIR, patch);
    res.json({ success: true, ...settings });
  });

  // --- Журнал: все успешные изменяющие запросы админа ---
  app.use('/api/admin', (req, res, next) => {
    if (req.method !== 'GET' && !req.path.startsWith('/import-full/chunk')) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          writeAudit(DATA_DIR, { ip: ipKeyGenerator(req.ip || ''), action: `${req.method} ${req.path}` });
        }
      });
    }
    next();
  });

  app.get('/api/admin/overview', checkAdminAuth, (_req, res) => {
    const site = getSiteSettings(DATA_DIR);
    res.json({
      counts: db.getOverviewCounts(),
      system: getSystemInfo(DATA_DIR),
      storage: getStorageStats(DATA_DIR),
      health: runHealthChecks(DATA_DIR),
      settings: site,
    });
  });

  app.get('/api/admin/home-layout', checkAdminAuth, (_req, res) => {
    res.json(readHomeLayout(DATA_DIR));
  });

  app.put('/api/admin/home-layout', checkAdminAuth, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || !Array.isArray(req.body.blocks)) {
      return res.status(400).json({ error: 'Layout must contain a blocks array' });
    }
    res.json(writeHomeLayout(DATA_DIR, req.body));
  });

  app.post('/api/admin/home-layout/reset', checkAdminAuth, (_req, res) => {
    res.json(resetHomeLayout(DATA_DIR));
  });

  app.get('/api/admin/audit', checkAdminAuth, (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    res.json({ entries: readAudit(DATA_DIR, limit) });
  });

  app.get('/api/admin/logs', checkAdminAuth, (req, res) => {
    const limit = parseInt(String(req.query.limit ?? '200'), 10) || 200;
    res.json({ entries: readLogs({ level: String(req.query.level ?? 'all'), limit }) });
  });

  app.delete('/api/admin/logs', checkAdminAuth, (_req, res) => {
    clearLogs();
    res.json({ success: true });
  });

  const USERNAME_RE = /^[a-zA-Z0-9_-]{3,15}$/;

  app.post('/api/admin/user/:username/ban', checkAdminAuth, (req, res) => {
    const username = req.params.username.toLowerCase();
    if (!db.getUser(username)) return res.status(404).json({ error: 'Пользователь не найден' });
    const banned = req.body?.banned !== false;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    db.setUserBanned(username, banned, reason);
    res.json({ success: true, banned });
  });

  app.post('/api/admin/user/:username/reset-sessions', checkAdminAuth, (req, res) => {
    const username = req.params.username.toLowerCase();
    if (!db.getUser(username)) return res.status(404).json({ error: 'Пользователь не найден' });
    db.invalidateUserSessions(username);
    res.json({ success: true });
  });

  app.post('/api/admin/users/bulk', checkAdminAuth, (req, res) => {
    const { action, usernames, reason } = req.body ?? {};
    const allowed = ['verify', 'unverify', 'ban', 'unban', 'reset-sessions', 'delete'];
    if (!allowed.includes(action)) return res.status(400).json({ error: 'Unknown action' });
    if (!Array.isArray(usernames) || usernames.length === 0 || usernames.length > 200) {
      return res.status(400).json({ error: 'usernames must be a list of 1-200 items' });
    }
    let done = 0;
    for (const raw of usernames) {
      if (typeof raw !== 'string' || !USERNAME_RE.test(raw)) continue;
      const username = raw.toLowerCase();
      if (!db.getUser(username)) continue;
      if (action === 'delete') db.deleteUser(username);
      else if (action === 'ban') db.setUserBanned(username, true, typeof reason === 'string' ? reason : '');
      else if (action === 'unban') db.setUserBanned(username, false);
      else if (action === 'reset-sessions') db.invalidateUserSessions(username);
      else {
        const bio = db.getBio(username);
        if (!bio) continue;
        bio.verified = action === 'verify';
        db.saveBio(username, bio);
      }
      done += 1;
    }
    res.json({ success: true, processed: done });
  });

  app.post('/api/admin/analytics/clear', checkAdminAuth, (req, res) => {
    const raw = req.body?.username;
    const username = typeof raw === 'string' && raw ? raw.toLowerCase() : undefined;
    if (username && !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Invalid username' });
    res.json({ success: true, deleted: db.clearAnalytics(username) });
  });

  // --- Бэкапы на диске сервера ---
  const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
  const BACKUP_NAME_RE = /^[A-Za-z0-9._-]{1,80}\.zip$/;

  app.get('/api/admin/backups', checkAdminAuth, (_req, res) => {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json({ files: [] });
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => BACKUP_NAME_RE.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(BACKUPS_DIR, f));
        return { filename: f, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    res.json({ files });
  });

  app.post('/api/admin/backups/run', checkAdminAuth, async (_req, res) => {
    try {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outPath = path.join(BACKUPS_DIR, `backup-manual-${stamp}.zip`);
      const result = await writeBackupToFile(outPath, { includeAnalytics: true, uploadsDir: UPLOADS_DIR, dataDir: DATA_DIR });
      res.json({ success: true, filename: path.basename(outPath), size: result.size });
    } catch (err: any) {
      console.error('[backup] Manual backup failed:', err);
      res.status(500).json({ error: err.message || 'Backup failed' });
    }
  });

  app.get('/api/admin/backups/:name', checkAdminAuth, (req, res) => {
    if (!BACKUP_NAME_RE.test(req.params.name)) return res.status(400).json({ error: 'Invalid file name' });
    const full = path.join(BACKUPS_DIR, req.params.name);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });
    res.download(full, req.params.name);
  });

  app.delete('/api/admin/backups/:name', checkAdminAuth, (req, res) => {
    if (!BACKUP_NAME_RE.test(req.params.name)) return res.status(400).json({ error: 'Invalid file name' });
    fs.rmSync(path.join(BACKUPS_DIR, req.params.name), { force: true });
    res.json({ success: true });
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
      console.error('[preview-backup]', err);
      res.status(400).json({ error: err.message || 'Preview failed' });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore cleanup errors */
        }
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
    adminAuth.setPassword(newPassword);
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
    const dump = db.exportDatabase({ includeAnalytics });
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

  ensureIncomingDir(DATA_DIR);

  app.post('/api/admin/import-full/init', checkAdminAuth, (req, res) => {
    try {
      const { filename, totalSize, totalChunks } = req.body ?? {};
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'filename is required' });
      }
      if (typeof totalSize !== 'number' || typeof totalChunks !== 'number') {
        return res.status(400).json({ error: 'totalSize and totalChunks are required' });
      }
      const result = initChunkedUpload(DATA_DIR, { filename, totalSize, totalChunks });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Init failed' });
    }
  });

  app.post('/api/admin/import-full/chunk', checkAdminAuth, chunkUpload.single('chunk'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No chunk uploaded' });
    }
    const uploadId = req.body?.uploadId;
    const index = Number(req.body?.index);
    if (!uploadId || typeof uploadId !== 'string') {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'uploadId is required' });
    }
    if (!Number.isInteger(index)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'index must be an integer' });
    }
    try {
      const progress = saveUploadChunk(uploadId, index, req.file.path);
      res.json({ success: true, ...progress });
    } catch (err: any) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: err.message || 'Chunk upload failed' });
    }
  });

  app.post('/api/admin/import-full/finish', checkAdminAuth, (req, res) => {
    try {
      const { uploadId } = req.body ?? {};
      if (!uploadId || typeof uploadId !== 'string') {
        return res.status(400).json({ error: 'uploadId is required' });
      }
      const result = startImportFromAssembledUpload(uploadId, {
        uploadsDir: UPLOADS_DIR,
        dataDir: DATA_DIR,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Finish failed' });
    }
  });

  app.get('/api/admin/import-full/status/:jobId', checkAdminAuth, (req, res) => {
    const job = getImportJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Import job not found or expired' });
    }
    res.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      error: job.error,
      userCount: job.userCount,
      uploadCount: job.uploadCount,
    });
  });

  app.get('/api/admin/import-full/incoming', checkAdminAuth, (_req, res) => {
    try {
      const files = listIncomingBackupFiles(DATA_DIR);
      res.json({ success: true, files });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list incoming files' });
    }
  });

  app.post('/api/admin/import-full/from-disk', checkAdminAuth, (req, res) => {
    try {
      const { filename } = req.body ?? {};
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'filename is required' });
      }
      const result = startImportFromDisk(DATA_DIR, filename, {
        uploadsDir: UPLOADS_DIR,
        dataDir: DATA_DIR,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Disk import failed' });
    }
  });

  // Get active Bio directories listing
  app.get('/api/all-bios', (req, res) => {
    const banned = db.getBannedUsernames();
    const bios = db.getAllBios().filter(bio => !banned.has(bio.username));
    const profiles = bios.map(bio => ({
      username: bio.username,
      displayName: bio.displayName,
      bio: bio.bio,
      avatarUrl: bio.avatarUrl,
      verified: bio.verified
    }));
    res.json(profiles);
  });

  // GitHub-репозиторий проекта для главной страницы: данные кэшируются на сервере (лимиты GitHub, токен не уходит клиенту).
  // GITHUB_REPO=owner/name меняет репозиторий (форки), GITHUB_REPO=off отключает блок; GITHUB_TOKEN повышает лимит API.
  const githubRepoEnv = (process.env.GITHUB_REPO ?? DEFAULT_REPO).trim();
  const githubDisabled = githubRepoEnv === '' || githubRepoEnv.toLowerCase() === 'off';
  if (!githubDisabled && !isValidRepo(githubRepoEnv)) {
    console.warn(`[github] GITHUB_REPO="${githubRepoEnv}" некорректен (нужно owner/name), блок GitHub отключён`);
  }
  const githubService = !githubDisabled && isValidRepo(githubRepoEnv)
    ? createGithubService({ repo: githubRepoEnv, token: process.env.GITHUB_TOKEN?.trim() || undefined })
    : null;
  const githubLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

  app.get('/api/github', githubLimiter, async (_req, res) => {
    if (!githubService) return res.json({ enabled: false });
    const result = await githubService.getSnapshot();
    if (!result) {
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({ enabled: true, error: 'GitHub временно недоступен' });
    }
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ enabled: true, ...result });
  });

  // Соцсети проекта задаются переменными SOCIAL_*_URL; невалидные ссылки отбрасываются (один раз пишем в лог)
  const socialLinks = getSocialLinks(process.env, (msg) => console.warn(`[socials] ${msg}`));

  // Макет главной страницы (публичный, кэш короткий)
  app.get('/api/home-layout', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=30');
    res.json(readHomeLayout(DATA_DIR));
  });

  // Public platform config (domain, URLs)
  app.get('/api/public-config', (req, res) => {
    const platform = getPlatformConfig(req);
    const site = getSiteSettings(DATA_DIR);
    res.json({
      ...platform,
      socials: socialLinks,
      hideAdminPanelLink: site.hideAdminPanelLink,
      registrationOpen: site.registrationOpen,
      maintenanceMode: site.maintenanceMode,
      maintenanceMessage: site.maintenanceMode ? site.maintenanceMessage : '',
      mediaCdnUrl: getServerMediaCdnUrl(),
      ssl: {
        wildcardRequired: true,
        provider: 'coolify-traefik',
        setupGuidePath: 'deploy/coolify/SSL_SETUP.md',
      },
    });
  });

  // Get singular page bio data (username or alias slug)
  app.get('/api/bio/:slug', publicLimiter, (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const bio = db.getBioBySlug(slug);
    if (!bio || db.isUserBanned(bio.username)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(bio);
  });

  // Resolve hostname → username (wildcard subdomain or custom domain)
  app.get('/api/resolve-host', publicLimiter, (req, res) => {
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
  app.get('/api/bio-by-host', publicLimiter, (req, res) => {
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

  // Discord: OAuth + disconnect + presence (src/discord.ts)
  app.use('/api/discord', publicLimiter);
  registerDiscord(app, {
    getUsernameFromRequest,
    getBio: (u: string) => db.getBio(u),
    saveBio: (u: string, b: any) => db.saveBio(u, b),
    getAllBios: () => db.getAllBios(),
    createOAuthState: (u: string) => db.createOAuthState(u),
    consumeOAuthState: (st: string) => db.consumeOAuthState(st),
  });

  // Register or Login endpoint
  app.post('/api/auth/login-register', authIpLimiter, authLimiter, (req, res) => {
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
      if (valid && existingUser.banned) {
        return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
      }
      if (valid) {
        clearLoginAttempts(normUsername);
        if (needsRehash) {
          db.updateUserPassword(normUsername, hashPassword(password));
        }
        const sessionToken = crypto.randomUUID();
        db.updateUserToken(normUsername, sessionToken);
        setSessionCookie(req, res, sessionToken);
        return res.json({ token: sessionToken, username: normUsername, isNew: false });
      }

      recordFailedLogin(normUsername);
      return res.status(401).json({ error: authFailMessage });
    }

    if (!getSiteSettings(DATA_DIR).registrationOpen) {
      return res.status(403).json({ error: 'Регистрация новых аккаунтов временно закрыта администратором' });
    }

    const policy = validateUserPassword(password, { isRegistration: true });
    if (!policy.valid) {
      return res.status(400).json({ error: policy.error });
    }

    if (isReservedUsername(normUsername) || db.isAliasSlugTaken(normUsername)) {
      return res.status(400).json({ error: 'Это имя недоступно' });
    }

    const regKey = ipKeyGenerator(req.ip || '');
    if (registrations.isBlocked(regKey)) {
      res.setHeader('Retry-After', '3600');
      return res.status(429).json({ error: 'Слишком много регистраций с вашего IP. Попробуйте позже.' });
    }
    registrations.fail(regKey);

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

    setSessionCookie(req, res, sessionToken);
    res.status(201).json({ token: sessionToken, username: normUsername, isNew: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (authedUser) {
      db.clearUserToken(authedUser);
    }
    clearSessionCookie(req, res);
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
    setSessionCookie(req, res, sessionToken);
    res.json({ success: true, token: sessionToken, message: 'Пароль успешно изменён' });
  });

  // Check auth session validity
  app.get('/api/auth/verify', (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // Миграция старых клиентов: валидный Bearer обмениваем на HttpOnly-cookie
    const bearer = req.headers.authorization;
    if (bearer && bearer.startsWith('Bearer ') && !readCookie(req, SESSION_COOKIE)) {
      setSessionCookie(req, res, bearer.split(' ')[1]);
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

    if (db.getUser(normNewUsername) || isReservedUsername(normNewUsername) || db.isAliasSlugTaken(normNewUsername, authedUser)) {
      return res.status(400).json({ error: 'Username slug is already reserved by another creator' });
    }

    db.updateUsername(authedUser, normNewUsername);

    res.json({ success: true, username: normNewUsername });
  });

  // Unified import hub (guns.lol URL or HTML)
  app.post('/api/import-profile', importLimiter, async (req, res) => {
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
  app.post('/api/import-gunslol', importLimiter, async (req, res) => {
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

  app.post('/api/rehost-import-media', importLimiter, async (req, res) => {
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
  app.post('/api/bio/:username', async (req, res) => {
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
      if (isReservedSlug(alias) || isReservedUsername(alias)) {
        return res.status(400).json({ error: 'Этот alias зарезервирован системой' });
      }
      if (db.isAliasSlugTaken(alias, username)) {
        return res.status(409).json({ error: 'Этот alias уже занят другим пользователем' });
      }
    }

    const oldConfig = db.getBio(username);
    // Discord-поля меняет только OAuth (callback/disconnect), клиентские значения игнорируем
    preserveDiscordFields(payload, oldConfig);
    // verified / uid / customDomain / служебные бейджи — только серверные значения
    const requestedDomain = typeof (payload as any).customDomain === 'string'
      ? (payload as any).customDomain.toLowerCase().trim().replace(/\.$/, '')
      : '';
    const guard = guardProfilePayload(payload as any, oldConfig);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }
    // customDomain: только после подтверждения владения (TXT `_crybios.<домен>` = `cry-bios-verify=<username>`)
    if (requestedDomain !== (oldConfig?.customDomain || '').toLowerCase()) {
      if (!requestedDomain) {
        delete (payload as any).customDomain;
      } else {
        if (!/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(requestedDomain) || requestedDomain === (process.env.BIO_BASE_DOMAIN || 'cbios.ru').toLowerCase() || requestedDomain.endsWith('.' + (process.env.BIO_BASE_DOMAIN || 'cbios.ru').toLowerCase())) {
          return res.status(400).json({ error: 'Некорректный домен' });
        }
        if (db.isCustomDomainTaken(requestedDomain, username) || db.getUser(requestedDomain)) {
          return res.status(400).json({ error: 'Этот домен уже подключён к другому профилю' });
        }
        let verified = false;
        try {
          const records = await dns.resolveTxt(`_crybios.${requestedDomain}`);
          verified = records.some(r => r.join('') === `cry-bios-verify=${username}`);
        } catch { /* нет записи */ }
        if (!verified) {
          return res.status(400).json({ error: `Подтвердите владение доменом: добавьте TXT-запись _crybios.${requestedDomain} со значением cry-bios-verify=${username}` });
        }
        (payload as any).customDomain = requestedDomain;
      }
    }
    db.saveBio(username, payload);

    const allConfigs = db.getAllBios();
    if (oldConfig) {
      deleteUnusedBetweenConfigs(oldConfig, payload, allConfigs, UPLOADS_DIR);
    }

    res.json({ message: 'Profile saved successfully', config: payload });
  });

  // Track visit (anonymous, fast increment)
  app.post('/api/bio/:slug/visit', visitLimiter, (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const bio = db.getBioBySlug(slug);
    if (!bio) {
      return res.status(404).json({ error: 'Lookup target does not exist' });
    }
    const username = bio.username;

    // Накрутка: не больше 3 визитов за 10 минут с одного IP на профиль
    const visitKey = `${ipKeyGenerator(req.ip || '')}:${username}`;
    if (visitDedupe.isBlocked(visitKey)) return res.json({ ok: true });
    visitDedupe.fail(visitKey);

    // Capture analytic headers
    const rawReferrer = String(req.body?.referrer || req.get('Referer') || 'Direct Link').slice(0, 300);
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
      host: sanitizeVisitHost(req.body?.host, req.get('host') || '')
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

  // OpenSource scripts provider — serves repo install.sh
  app.get('/api/install-script', (_req, res) => {
    const scriptPath = path.join(process.cwd(), 'install.sh');
    if (fs.existsSync(scriptPath)) {
      res.setHeader('Content-Type', 'application/x-sh');
      res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
      return res.send(fs.readFileSync(scriptPath, 'utf-8'));
    }
    res.status(404).send('# install.sh not found — clone https://github.com/Yaroslavtatar/CRY-BIOs\n');
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
    // Хэшированные ассеты — навсегда в кэш; index.html — всегда ревалидировать
    app.use(express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));

    // robots.txt и sitemap.xml отдаём настоящими, а не SPA-fallback'ом
    app.get('/robots.txt', (req, res) => {
      const origin = `${req.protocol}://${req.get('host')}`;
      res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
        `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /dashboard\n\nSitemap: ${origin}/sitemap.xml\n`
      );
    });
    app.get('/sitemap.xml', (req, res) => {
      const origin = `${req.protocol}://${req.get('host')}`;
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`
      );
    });
    // Неизвестные «файловые» пути не должны возвращать HTML с кодом 200
    app.get(/\/(llms\.txt|ai-catalog\.json)$|\.(map|txt|json|xml|js|css)$/i, (req, res) => {
      res.status(404).type('text/plain').send('Not found');
    });

    // Fallback everything else to SPA HTML load
    app.get('*', (req, res, next) => {
      // Avoid intercepting /api endpoints
      if (req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Open-Source CRY BIOS Server started on http://0.0.0.0:${PORT}`);
    console.log(`Persisted database synchronized successfully.`);

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
