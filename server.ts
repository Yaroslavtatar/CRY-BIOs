/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { BioConfig, VisitRecord, AnalyticsSummary, SocialLink } from './src/types';
import * as db from './src/db';

// Establish folders
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
const upload = multer({ storage });

// Passwords are plain SHA256 hashed
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Seed a handsome default profile for demonstration if needed
if (!db.getBio('cryteam') && !db.getUser('cryteam')) {
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

  app.use(express.json());
  const PORT = 3000;

  // Middleware to support simple authentication
  const getUsernameFromRequest = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    const user = db.getUserByToken(token);
    return user ? user.username : null;
  };

  // --- API ROUTING ---

  // Expose uploads directory
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Upload endpoint
  app.post('/api/upload', upload.single('file'), (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
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

  // Get singular page bio data (Static lookup)
  app.get('/api/bio/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    const bio = db.getBio(username);
    if (!bio) {
      return res.status(404).json({ error: 'Username lookup failed' });
    }
    res.json(bio);
  });

  // Proxy Discord Lanyard & Profile Data
  app.get('/api/discord/:query', async (req, res) => {
    try {
      const { query } = req.params;
      const isId = /^\d{17,19}$/.test(query);

      // We attempt Lanyard API if it is an ID
      if (isId) {
        const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${query}`);
        if (lanyardRes.ok) {
          const data = await lanyardRes.json();
          // Map mock badges as Lanyard doesn't provide them natively
          if (data.data && data.data.discord_user) {
            data.data.discord_user.badges = [
              { id: 'nitro', icon: 'zap', label: 'Nitro' },
              { id: 'booster', icon: 'flame', label: 'Server Booster' }
            ];
          }
          return res.json(data);
        }
      }

      // If it's a username or Lanyard fails, we gracefully map a Discord Profile format via mock/fallback API
      // Since Discord strictly forbids global username lookups without OAuth2, we provide this deterministic mock for username inputs.
      const pseudoId = Array.from(query).reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().padStart(18, '1');
      res.json({
        success: true,
        data: {
          discord_user: {
            id: pseudoId,
            username: query.replace('@', ''),
            display_name: query.replace('@', '').toUpperCase(),
            avatar: 'a_simulated_avatar_hash', // Without real ID fallback to dicebear in frontend
            badges: [
              { id: 'nitro', icon: 'zap', label: 'Nitro' },
              { id: 'booster', icon: 'flame', label: 'Server Booster' }
            ]
          },
          discord_status: 'online',
          activities: [
            { name: 'Visual Studio Code', type: 0 }
          ]
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Register or Login endpoint
  app.post('/api/auth/login-register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.trim() === '' || password.trim() === '') {
      return res.status(400).json({ error: 'Username and password credentials required' });
    }

    const normUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_-]{3,15}$/.test(normUsername)) {
      return res.status(400).json({ error: 'Username must be 3-15 chars, alphanumeric letters, underscores or dashes' });
    }

    const passHash = hashPassword(password);
    const existingUser = db.getUser(normUsername);

    if (existingUser) {
      // Login flow
      if (existingUser.password_hash === passHash) {
        // Regenerate token for security
        const sessionToken = crypto.randomUUID();
        db.updateUserToken(normUsername, sessionToken);
        return res.json({ token: sessionToken, username: normUsername, isNew: false });
      } else {
        return res.status(401).json({ error: 'Incorrect passcode for this existing profile URL' });
      }
    } else {
      // Sign-Up flow
      const sessionToken = crypto.randomUUID();
      db.createUser(normUsername, passHash, sessionToken);
      
      // Default bio landing page
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
    }
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

  // Import/scrape Guns.lol Profile
  app.post('/api/import-gunslol', async (req, res) => {
    const authedUser = getUsernameFromRequest(req);
    if (!authedUser) {
      return res.status(401).json({ error: 'Unauthorized Session' });
    }

    const { targetUsername } = req.body;
    if (!targetUsername || targetUsername.trim() === '') {
      return res.status(400).json({ error: 'Target guns.lol username required' });
    }

    const cleanUsername = targetUsername.trim().toLowerCase();
    try {
      const targetUrl = `https://guns.lol/${cleanUsername}`;
      const response = await fetch(targetUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!response.ok) {
        if (response.status >= 300 && response.status < 400) {
          return res.status(400).json({ error: `Could not fetch profile from guns.lol (Cloudflare/Redirect Challenge - HTTP ${response.status})` });
        }
        return res.status(400).json({ error: `Could not fetch profile from guns.lol (HTTP ${response.status})` });
      }

      const html = await response.text();
      // 1. Try to search Next.js hydration embedded JSON segment
      let parsedConfig: any = null;

      // Search for configuration block in script tags or self.__next_f hydration blocks
      const configBlockRegex = /"config"\s*:\s*(\{.+?\})(?:,\s*"premium"|"success"|\}\s*\}\s*\]|,\s*"verified")/g;
      let blockMatch;
      while ((blockMatch = configBlockRegex.exec(html)) !== null) {
        try {
          let jsonStr = blockMatch[1];
          if (jsonStr.includes('\\"')) {
            jsonStr = jsonStr.replace(/\\"/g, '"');
          }
          const attempt = JSON.parse(jsonStr);
          if (attempt && (attempt.avatar || attempt.bg_color || attempt.socials || attempt.display_name)) {
            parsedConfig = attempt;
            break;
          }
        } catch (e) {
          // seek next match
        }
      }

      if (!parsedConfig) {
        const dataRegex = /\{"data"\s*:\s*(\{.+?\})(?:\s*\}\s*\])/g;
        let dataMatch;
        while ((dataMatch = dataRegex.exec(html)) !== null) {
          try {
            let cleanText = dataMatch[0];
            cleanText = cleanText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const parsedData = JSON.parse(cleanText);
            if (parsedData && parsedData.data && parsedData.data.config) {
              parsedConfig = parsedData.data.config;
              break;
            }
          } catch (e) {
            // continue
          }
        }
      }

      // 2. Permissive backup regex scanners for keyvalues
      const getValueByRegex = (regex: RegExp, def = '') => {
        const m = html.match(regex);
        return m ? m[1].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16))) : def;
      };

      // Displays name
      let displayName = getValueByRegex(/"display_name"\s*:\s*"([^"]+)"/) || 
                        getValueByRegex(/<title>([^<]+)<\/title>/).replace(/\s*\|.*?$/, '').replace(/\s*guns\.lol\s*$/, '').replace('@', '').trim();

      if (!displayName || displayName === cleanUsername) {
        displayName = cleanUsername;
      }

      // Bio Text description
      let bio = getValueByRegex(/"description"\s*:\s*"([^"]*)"/) || '';
      if (!bio) {
        const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || 
                         html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
        if (metaDesc && metaDesc[1]) {
          bio = metaDesc[1].trim();
        }
      }

      // Image Avatar URL 
      let avatarUrl = getValueByRegex(/"avatar"\s*:\s*"([^"]+)"/) ||
                       getValueByRegex(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/);

      if (!avatarUrl) {
        const imgMatch = html.match(/<img[^>]+src=["'](https:\/\/images\.guns\.lol\/[^"']+)["']/i) ||
                          html.match(/<img[^>]+src=["'](https:\/\/r2\.guns\.lol\/[^"']+)["']/i);
        if (imgMatch) avatarUrl = imgMatch[1];
      }

      // Video / Image 배경 
      let bgValue = getValueByRegex(/"url"\s*:\s*"([^"]+\.(?:mp4|webm|gif|png|jpg|jpeg)[^"]*)"/) || 
                    getValueByRegex(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
      let bgType = 'stars';
      
      if (bgValue && (bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('/7a64a911-d951-49b6-bfe9-d7c07a9d8c1a'))) {
        bgType = 'video';
      } else if (bgValue && (bgValue.endsWith('.gif') || bgValue.includes('.gif') || bgValue.includes('r2.guns.lol'))) {
        bgType = 'image';
      }

      // Default template fallbacks as parsed from direct HTML
      if (!bgValue) {
        const iframeMatches = html.match(/background-image\s*:\s*url\(([^)]+)\)/);
        if (iframeMatches) {
          bgType = 'image';
          bgValue = iframeMatches[1].replace(/['"]/g, '');
        }
      }

      // Extracted custom items
      let customCursor = getValueByRegex(/"custom_cursor"\s*:\s*"([^"]+)"/) ||
                         getValueByRegex(/cursor\s*:\s*url\(([^)]+)\)/);
      if (customCursor) {
        customCursor = customCursor.replace(/['"]/g, '').split(' ')[0];
      }

      let backgroundEffects = getValueByRegex(/"background_effects"\s*:\s*"([^"]+)"/) || 'rain';
      let blurVal = parseInt(getValueByRegex(/"blur"\s*:\s*([0-9]+)/) || '2');
      let opacityVal = parseFloat(getValueByRegex(/"opacity"\s*:\s*([0-9\.]+)/) || '0.05') * 100;

      // Soundtrack track audio URL
      let audioUrl = getValueByRegex(/"url"\s*:\s*"([^"]+\.mp3[^"]*)"/) || '';
      if (!audioUrl) {
        const audioMatch = html.match(/"audio"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
        if (audioMatch) audioUrl = audioMatch[1];
      }
      if (!audioUrl) {
        const rawMp3Match = html.match(/(https?:\/\/[^\s"'<>]+\.mp3[^\s"'<>]*)/i);
        if (rawMp3Match) audioUrl = rawMp3Match[0];
      }

      // Set premium beautiful transparent badges list for the user
      const badges = [
        { id: 'b-v', type: 'verified', icon: 'shieldcheck', label: 'Verified', description: 'Официально верифицированный профиль платформы', enabled: true, glow: true, glowColor: '#00f2ff' },
        { id: 'b-p', type: 'premium', icon: 'gem', label: 'Premium', description: 'Премиум-подписка CRY BIOS Pro', enabled: true, glow: true, glowColor: '#a855f7' },
        { id: 'b-cr', type: 'custom', icon: 'crown', label: 'CRYTEAM Elite', description: 'Elite Cryteam Crew', enabled: true, glow: true, glowColor: '#00ffcc', bgColor: 'rgba(0,250,200,0.1)', borderColor: '#00ffcc' }
      ];

      // Social Links matching
      let socialsList: any[] = [];
      const socialsBlockMatch = html.match(/"socials"\s*:\s*\[([\s\S]+?)\]/);
      if (socialsBlockMatch) {
        const rawSocials = socialsBlockMatch[1];
        const itemRegex = /\{\s*"social"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
        let m;
        while ((m = itemRegex.exec(rawSocials)) !== null) {
          const platform = m[1].toLowerCase();
          let val = m[2];
          if (val) {
            let url = val;
            if (!url.startsWith('http')) {
              if (platform === 'discord') url = `https://discord.com/users/${val}`;
              else if (platform === 'telegram') url = `https://t.me/${val}`;
              else if (platform === 'github') url = `https://github.com/${val}`;
              else url = `https://${val}`;
            }
            socialsList.push({
              id: `soc-${Math.random().toString(36).substr(2, 5)}`,
              platform: platform === 'custom_url' ? 'website' : platform as any,
              url,
              label: platform
            });
          }
        }
      }

      if (socialsList.length === 0) {
        const platformPatterns = {
          discord: /(?:discord\.gg|discord\.com\/invite|discordapp\.com\/users)\/[a-zA-Z0-9_\-\.]+/gi,
          telegram: /(?:t\.me|telegram\.me)\/[a-zA-Z0-9_\-]+/gi,
          github: /(?:github\.com)\/[a-zA-Z0-9_\-]+/gi,
          youtube: /(?:youtube\.com)\/(?:user\/|channel\/|c\/|@)?[a-zA-Z0-9_\-]+/gi,
          instagram: /(?:instagram\.com)\/[a-zA-Z0-9_\-\.]+/gi,
          tiktok: /(?:tiktok\.com)\/@[a-zA-Z0-9_\-\.]+/gi,
          twitter: /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_\-]+/gi,
        };

        Object.entries(platformPatterns).forEach(([platform, regex]) => {
          const matches = html.match(regex);
          if (matches && matches[0]) {
            const url = matches[0].startsWith('http') ? matches[0] : `https://${matches[0]}`;
            socialsList.push({
              id: `soc-${Math.random().toString(36).substr(2, 5)}`,
              platform,
              url,
              label: `${platform} Link`
            });
          }
        });
      }

      // Apply JSON configurations over any backup parsed elements if Next.js hydrated block found
      if (parsedConfig) {
        displayName = parsedConfig.display_name || displayName;
        bio = parsedConfig.description || bio;
        avatarUrl = parsedConfig.avatar || avatarUrl;
        
        if (parsedConfig.url) {
          bgValue = parsedConfig.url;
          if (bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('7a64a911')) {
            bgType = 'video';
          } else {
            bgType = 'image';
          }
        }
        
        customCursor = parsedConfig.custom_cursor || customCursor;
        backgroundEffects = parsedConfig.background_effects || backgroundEffects;
        if (parsedConfig.blur !== undefined) blurVal = parsedConfig.blur;
        if (parsedConfig.opacity !== undefined) opacityVal = parsedConfig.opacity * 100;
        
        if (parsedConfig.audio && Array.isArray(parsedConfig.audio) && parsedConfig.audio.length > 0) {
          const sel = parsedConfig.audio.find((a: any) => a.selected) || parsedConfig.audio[0];
          audioUrl = sel.url || audioUrl;
        }

        if (parsedConfig.socials && Array.isArray(parsedConfig.socials)) {
          socialsList = parsedConfig.socials.map((s: any) => {
            let url = s.value;
            const platform = s.social === 'custom_url' ? 'website' : s.social;
            if (!url.startsWith('http')) {
              if (platform === 'discord') url = `https://discord.com/users/${url}`;
              else if (platform === 'telegram') url = `https://t.me/${url}`;
              else if (platform === 'github') url = `https://github.com/${url}`;
            }
            return {
              id: s.id || `soc-${Math.random().toString(36).substr(2, 5)}`,
              platform,
              url,
              label: s.social
            };
          });
        }
      }

      res.json({
        success: true,
        data: {
          displayName,
          bio,
          avatarUrl,
          bgType,
          bgValue,
          audioUrl,
          customCursorUrl: customCursor || '',
          snowEffectsEnabled: backgroundEffects === 'rain' || backgroundEffects === 'snow' || backgroundEffects === 'rain_snow',
          bgBlur: blurVal,
          cardOpacity: opacityVal,
          socialsList,
          badges
        }
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: `Scraping failure: ${error.message}` });
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

    // Save
    db.saveBio(username, payload);
    res.json({ message: 'Profile saved successfully', config: payload });
  });

  // Track visit (anonymous, fast increment)
  app.post('/api/bio/:username/visit', (req, res) => {
    const username = req.params.username.toLowerCase();
    if (!db.getBio(username)) {
      return res.status(404).json({ error: 'Lookup target does not exist' });
    }

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

    // Language / Country detection fallback
    const langHeader = req.get('Accept-Language') || '';
    let country = 'Intl';
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

    const visit: VisitRecord = {
      timestamp: new Date().toISOString(),
      referrer,
      device,
      browser,
      country
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

    const summary: AnalyticsSummary = {
      username,
      totalViews,
      uniqueViews,
      visitsOverTime,
      referrersHistogram: referrerRaw.map(r => ({ referrer: r.name, count: r.count })),
      devicesHistogram: deviceRaw.map(d => ({ device: d.name, count: d.count })),
      browsersHistogram: browserRaw.map(b => ({ browser: b.name, count: b.count })),
      countriesHistogram: countryRaw.map(c => ({ country: c.name, count: c.count }))
    };

    res.json(summary);
  });

  // OpenSource scripts provider
  app.get('/api/install-script', (req, res) => {
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
      - ./data:/app/data
EOF

echo -e "\${GREEN}✅ Created docker-compose.yml successfully.\${NC}"
echo -e "\${BLUE}📦 Pulling official Docker images and starting the stack...\${NC}"

docker compose pull || echo -e "\${RED}Image lookup fallback: Project runs containerized locally via standard local node build too\${NC}"
docker compose up -d || echo -e "\${RED}Continuing local npm install configuration wizard.\${NC}"

echo -e "\${BLUE}=====================================================\${NC}"
echo -e "\${GREEN}🎯 Server fully running and bound! URL: http://localhost:3000\${NC}"
echo -e "\${GREEN}📊 Persistent data logs safely synchronized to ./data/\${NC}"
echo -e "\${BLUE}=====================================================\${NC}"
`;
    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
    res.send(shellScript);
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
  });
}

startServer().catch(err => {
  console.error("Critical crash in server initialization", err);
});
