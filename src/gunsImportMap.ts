import type {
  BackgroundType,
  BioConfig,
  NameEffect,
  SocialLink,
  SongConfig,
  SparkleStyle,
  UserBadge,
} from './types';

export interface GunsImportResult {
  displayName: string;
  bio: string;
  avatarUrl: string;
  bgType: BackgroundType;
  bgValue: string;
  audioUrl: string;
  playlist: SongConfig[];
  customCursorUrl: string;
  snowEffectsEnabled: boolean;
  sparkles: boolean;
  sparkleStyle?: SparkleStyle;
  nameEffect?: NameEffect;
  bgBlur: number;
  cardOpacity: number;
  socialsList: SocialLink[];
  badges: UserBadge[];
  verified: boolean;
  primaryColor?: string;
  textColor?: string;
  glowColor?: string;
  locationEnabled?: boolean;
  locationText?: string;
  enterText?: string;
  audioPlayerMode?: BioConfig['audioPlayerMode'];
  audioEnabled?: boolean;
  monochromeMode?: boolean;
  fontFamily?: BioConfig['fontFamily'];
  discordId?: string;
  avatarGlowEnabled?: boolean;
  linkHoverGlow?: boolean;
  profileGradientEnabled?: boolean;
  profileGradientCss?: string;
  swapBoxColors?: boolean;
  glowEnabled?: boolean;
  bgEffectColor?: string;
}

export function mapGunsBackgroundEffects(effects: string): {
  bgType?: BackgroundType;
  snowEffectsEnabled?: boolean;
} {
  switch (effects?.toLowerCase()) {
    case 'rain':
      return { bgType: 'rain' };
    case 'snow':
      return { snowEffectsEnabled: true };
    case 'rain_snow':
      return { bgType: 'rain', snowEffectsEnabled: true };
    case 'matrix':
      return { bgType: 'matrix' };
    case 'stars':
      return { bgType: 'stars' };
    case 'aurora':
      return { bgType: 'aurora' };
    case 'plasma':
      return { bgType: 'plasma' };
    case 'dither':
      return { bgType: 'dither' };
    case 'particles':
      return { bgType: 'particles' };
    default:
      return { bgType: 'stars' };
  }
}

const USERNAME_EFFECT_MAP: Record<string, NameEffect> = {
  glow: 'glow',
  typewriter: 'typewriter',
  glitch: 'glitch',
  shuffle: 'shuffle',
  fuzzy: 'fuzzy',
  gradient: 'gradient',
  gradient_fire: 'gradient_fire',
  gradient_ocean: 'gradient_ocean',
  neon: 'neon',
  neon_red: 'neon_red',
  neon_blue: 'neon_blue',
  shine: 'shine',
  rainbow: 'rainbow',
  flicker: 'flicker',
  bounce: 'bounce',
  stroke: 'stroke',
  shadow_3d: 'shadow_3d',
  underline_glow: 'underline_glow',
  cyber: 'cyber',
  none: 'none',
};

export function mapGunsUsernameEffect(raw: string | undefined): NameEffect | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  return USERNAME_EFFECT_MAP[key] || USERNAME_EFFECT_MAP[key.replace(/-/g, '_')] || undefined;
}

const BADGE_ICON_MAP: Record<string, string> = {
  verified: 'shieldcheck',
  premium: 'gem',
  developer: 'code',
  vip: 'crown',
  staff: 'shield',
  booster: 'zap',
  member: 'star',
  custom: 'sparkles',
};

export function parseGunsBadges(parsedConfig: any, html: string): UserBadge[] {
  if (parsedConfig?.badges && Array.isArray(parsedConfig.badges) && parsedConfig.badges.length > 0) {
    return parsedConfig.badges.map((b: any, i: number) => ({
      id: b.id || `imported-badge-${i}`,
      type: (b.type || b.badge || 'custom') as UserBadge['type'],
      icon: b.icon || BADGE_ICON_MAP[b.type || b.badge] || 'sparkles',
      label: b.label || b.name || b.text || 'Badge',
      description: b.description || b.tooltip || '',
      enabled: b.enabled !== false,
      glow: !!b.glow,
      glowColor: b.glow_color || b.glowColor || b.color,
      textColor: b.text_color || b.textColor,
      bgColor: b.bg_color || b.bgColor,
      borderColor: b.border_color || b.borderColor,
      badgeStyle: b.style || 'icon',
      imageUrl: b.image || b.image_url || b.imageUrl,
      showLabel: b.show_label ?? b.showLabel ?? false,
    }));
  }
  return [];
}

function getValueByRegex(html: string, regex: RegExp, def = ''): string {
  const m = html.match(regex);
  return m
    ? m[1]
        .replace(/\\"/g, '"')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    : def;
}

function parseHydrationConfig(html: string): any | null {
  const configBlockRegex = /"config"\s*:\s*(\{.+?\})(?:,\s*"premium"|"success"|\}\s*\}\s*\]|,\s*"verified")/g;
  let blockMatch;
  while ((blockMatch = configBlockRegex.exec(html)) !== null) {
    try {
      let jsonStr = blockMatch[1];
      if (jsonStr.includes('\\"')) jsonStr = jsonStr.replace(/\\"/g, '"');
      const attempt = JSON.parse(jsonStr);
      if (attempt && (attempt.avatar || attempt.bg_color || attempt.socials || attempt.display_name)) {
        return attempt;
      }
    } catch {
      /* next match */
    }
  }

  const dataRegex = /\{"data"\s*:\s*(\{.+?\})(?:\s*\}\s*\])/g;
  let dataMatch;
  while ((dataMatch = dataRegex.exec(html)) !== null) {
    try {
      let cleanText = dataMatch[0].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const parsedData = JSON.parse(cleanText);
      if (parsedData?.data?.config) return parsedData.data.config;
    } catch {
      /* continue */
    }
  }
  return null;
}

function parseSocials(html: string, parsedConfig: any): SocialLink[] {
  let socialsList: SocialLink[] = [];

  if (parsedConfig?.socials && Array.isArray(parsedConfig.socials)) {
    return parsedConfig.socials.map((s: any) => {
      let url = s.value || s.url || '';
      const platform = s.social === 'custom_url' ? 'website' : s.social;
      if (url && !url.startsWith('http')) {
        if (platform === 'discord') url = `https://discord.com/users/${url}`;
        else if (platform === 'telegram') url = `https://t.me/${url}`;
        else if (platform === 'github') url = `https://github.com/${url}`;
        else url = `https://${url}`;
      }
      return {
        id: s.id || `soc-${Math.random().toString(36).substr(2, 5)}`,
        platform,
        url,
        label: s.social,
      };
    });
  }

  const socialsBlockMatch = html.match(/"socials"\s*:\s*\[([\s\S]+?)\]/);
  if (socialsBlockMatch) {
    const itemRegex = /\{\s*"social"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = itemRegex.exec(socialsBlockMatch[1])) !== null) {
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
          platform: platform === 'custom_url' ? 'website' : (platform as SocialLink['platform']),
          url,
          label: platform,
        });
      }
    }
  }

  if (socialsList.length === 0) {
    const platformPatterns: Record<string, RegExp> = {
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
      if (matches?.[0]) {
        const url = matches[0].startsWith('http') ? matches[0] : `https://${matches[0]}`;
        socialsList.push({
          id: `soc-${Math.random().toString(36).substr(2, 5)}`,
          platform: platform as SocialLink['platform'],
          url,
          label: `${platform} Link`,
        });
      }
    });
  }

  return socialsList;
}

function parsePlaylist(parsedConfig: any, html: string, displayName: string): { audioUrl: string; playlist: SongConfig[] } {
  let audioUrl = '';
  let playlist: SongConfig[] = [];

  if (parsedConfig?.audio && Array.isArray(parsedConfig.audio)) {
    playlist = parsedConfig.audio.map((a: any, i: number) => ({
      id: a.id || `track-${i}`,
      url: a.url || '',
      title: a.title || a.name || `${displayName} Track ${i + 1}`,
      artist: a.artist || 'Imported',
    })).filter((s: SongConfig) => s.url);
    const sel = parsedConfig.audio.find((a: any) => a.selected) || parsedConfig.audio[0];
    audioUrl = sel?.url || playlist[0]?.url || '';
  }

  if (!audioUrl) {
    audioUrl = getValueByRegex(html, /"url"\s*:\s*"([^"]+\.mp3[^"]*)"/);
    if (!audioUrl) {
      const audioMatch = html.match(/"audio"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
      if (audioMatch) audioUrl = audioMatch[1];
    }
    if (!audioUrl) {
      const rawMp3Match = html.match(/(https?:\/\/[^\s"'<>]+\.mp3[^\s"'<>]*)/i);
      if (rawMp3Match) audioUrl = rawMp3Match[0];
    }
    if (audioUrl && playlist.length === 0) {
      playlist = [{ id: 'track-0', url: audioUrl, title: `${displayName} Soundtrack`, artist: 'Imported' }];
    }
  }

  return { audioUrl, playlist };
}

export function parseGunsLolHtml(htmlContent: string, fallbackUsername = ''): GunsImportResult {
  const parsedConfig = parseHydrationConfig(htmlContent);
  const get = (regex: RegExp, def = '') => getValueByRegex(htmlContent, regex, def);

  let displayName =
    get(/"display_name"\s*:\s*"([^"]+)"/) ||
    get(/<title>([^<]+)<\/title>/)
      .replace(/\s*\|.*?$/, '')
      .replace(/\s*guns\.lol\s*$/, '')
      .replace('@', '')
      .trim() ||
    fallbackUsername ||
    'Guns.lol Profile';

  let bio = get(/"description"\s*:\s*"([^"]*)"/);
  if (!bio) {
    const metaDesc =
      htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      htmlContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (metaDesc?.[1]) bio = metaDesc[1].trim();
  }

  let avatarUrl =
    get(/"avatar"\s*:\s*"([^"]+)"/) ||
    get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/);
  if (!avatarUrl) {
    const imgMatch =
      htmlContent.match(/<img[^>]+src=["'](https:\/\/images\.guns\.lol\/[^"']+)["']/i) ||
      htmlContent.match(/<img[^>]+src=["'](https:\/\/r2\.guns\.lol\/[^"']+)["']/i);
    if (imgMatch) avatarUrl = imgMatch[1];
  }

  let bgValue = get(/"url"\s*:\s*"([^"]+\.(?:mp4|webm|gif|png|jpg|jpeg)[^"]*)"/) ||
    get(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
  let bgType: BackgroundType = 'stars';

  if (bgValue && (bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('7a64a911'))) {
    bgType = 'video';
  } else if (bgValue && (bgValue.endsWith('.gif') || bgValue.includes('.gif') || bgValue.includes('r2.guns.lol'))) {
    bgType = 'image';
  }

  if (!bgValue) {
    const iframeMatches = htmlContent.match(/background-image\s*:\s*url\(([^)]+)\)/);
    if (iframeMatches) {
      bgType = 'image';
      bgValue = iframeMatches[1].replace(/['"]/g, '');
    }
  }

  let customCursor = get(/"custom_cursor"\s*:\s*"([^"]+)"/) || get(/cursor\s*:\s*url\(([^)]+)\)/);
  if (customCursor) customCursor = customCursor.replace(/['"]/g, '').split(' ')[0];

  let backgroundEffects = get(/"background_effects"\s*:\s*"([^"]+)"/) || 'stars';
  let blurVal = parseInt(get(/"blur"\s*:\s*([0-9]+)/) || '2', 10);
  let opacityVal = parseFloat(get(/"opacity"\s*:\s*([0-9\.]+)/) || '0.05') * 100;
  const sparklesRaw = get(/"sparkles"\s*:\s*(true|false)/) || get(/"cursor_sparkles"\s*:\s*(true|false)/);
  let sparklesEnabled = sparklesRaw === 'true';
  let nameEffectRaw = get(/"username_effect"\s*:\s*"([^"]+)"/) || get(/"name_effect"\s*:\s*"([^"]+)"/);

  if (parsedConfig) {
    displayName = parsedConfig.display_name || displayName;
    bio = parsedConfig.description ?? bio;
    avatarUrl = parsedConfig.avatar || avatarUrl;

    if (parsedConfig.url) {
      bgValue = parsedConfig.url;
      bgType =
        bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('7a64a911') ? 'video' : 'image';
    } else if (parsedConfig.bg_color) {
      bgType = 'color';
      bgValue = parsedConfig.bg_color;
    }

    customCursor = parsedConfig.custom_cursor || customCursor;
    backgroundEffects = parsedConfig.background_effects || backgroundEffects;
    if (parsedConfig.blur !== undefined) blurVal = parsedConfig.blur;
    if (parsedConfig.opacity !== undefined) opacityVal = parsedConfig.opacity * 100;
    if (parsedConfig.sparkles !== undefined) sparklesEnabled = !!parsedConfig.sparkles;
    else if (parsedConfig.cursor_sparkles !== undefined) sparklesEnabled = !!parsedConfig.cursor_sparkles;
    if (parsedConfig.username_effect) nameEffectRaw = parsedConfig.username_effect;
    else if (parsedConfig.name_effect) nameEffectRaw = parsedConfig.name_effect;
  }

  const bgMapping = mapGunsBackgroundEffects(backgroundEffects);
  const resolvedBgType = bgMapping.bgType || bgType;

  const { audioUrl, playlist } = parsePlaylist(parsedConfig, htmlContent, displayName);
  const socialsList = parseSocials(htmlContent, parsedConfig);
  const badges = parseGunsBadges(parsedConfig, htmlContent);

  const verifiedRaw = parsedConfig?.verified ?? get(/"verified"\s*:\s*(true|false)/);
  const verified = verifiedRaw === true || verifiedRaw === 'true';

  const locationText =
    parsedConfig?.location || parsedConfig?.city ||
    get(/"location"\s*:\s*"([^"]+)"/) ||
    get(/"city"\s*:\s*"([^"]+)"/) ||
    '';

  const primaryColor = parsedConfig?.accent_color || parsedConfig?.primary_color || get(/"accent_color"\s*:\s*"([^"]+)"/) || undefined;
  const textColor = parsedConfig?.text_color || get(/"text_color"\s*:\s*"([^"]+)"/) || undefined;
  const glowColor = parsedConfig?.glow_color || parsedConfig?.glow || get(/"glow_color"\s*:\s*"([^"]+)"/) || primaryColor;
  const enterText = parsedConfig?.enter_text || get(/"enter_text"\s*:\s*"([^"]+)"/) || undefined;
  const discordId = parsedConfig?.discord_id || get(/"discord_id"\s*:\s*"([^"]+)"/) || undefined;
  const audioShown = parsedConfig?.audio_shown ?? get(/"audio_shown"\s*:\s*(true|false)/) !== 'false';
  const monochromeMode = parsedConfig?.monochrome === true || get(/"monochrome"\s*:\s*(true|false)/) === 'true';

  const profileGradientCss = parsedConfig?.profile_gradient || get(/"profile_gradient"\s*:\s*"([^"]+)"/) || undefined;
  const swapBoxColors = parsedConfig?.swap_box_colors === true || get(/"swap_box_colors"\s*:\s*(true|false)/) === 'true';
  const glowEnabled = parsedConfig?.glow === true || !!glowColor || get(/"glow"\s*:\s*(true|false)/) === 'true';

  return {
    displayName,
    bio: bio || 'Transferred using Open-Source copy paste engine.',
    avatarUrl: avatarUrl || '',
    bgType: resolvedBgType,
    bgValue: bgValue || '#0c0c0e',
    audioUrl,
    playlist,
    customCursorUrl: customCursor || '',
    snowEffectsEnabled: bgMapping.snowEffectsEnabled ?? false,
    sparkles: sparklesEnabled,
    sparkleStyle: parsedConfig?.sparkle_style as SparkleStyle | undefined,
    nameEffect: mapGunsUsernameEffect(nameEffectRaw),
    bgBlur: blurVal,
    cardOpacity: opacityVal,
    socialsList,
    badges,
    verified,
    primaryColor,
    textColor,
    glowColor,
    locationEnabled: !!locationText,
    locationText: locationText || undefined,
    enterText,
    audioPlayerMode: audioShown ? 'minimal' : 'hidden',
    audioEnabled: !!audioUrl && audioShown,
    monochromeMode,
    discordId,
    avatarGlowEnabled: glowEnabled,
    linkHoverGlow: glowEnabled,
    profileGradientEnabled: !!profileGradientCss,
    profileGradientCss,
    swapBoxColors,
    glowEnabled,
    bgEffectColor: parsedConfig?.background_effects_color || primaryColor,
  };
}

export function getImportPreviewSummary(result: GunsImportResult): string {
  const parts = [
    `Имя: ${result.displayName}`,
    result.nameEffect ? `Эффект имени: ${result.nameEffect}` : null,
    result.locationText ? `Location: ${result.locationText}` : null,
    result.playlist.length ? `Треков: ${result.playlist.length}` : result.audioUrl ? '1 трек' : null,
    result.badges.length ? `Бейджей: ${result.badges.length}` : null,
    result.verified ? 'Verified: да' : 'Verified: нет',
    `Фон: ${result.bgType}${result.snowEffectsEnabled ? ' + снег' : ''}`,
  ].filter(Boolean);
  return parts.join(' • ');
}

export function applyGunsImportToConfig(config: BioConfig, imported: GunsImportResult): BioConfig {
  const updated: BioConfig = {
    ...config,
    displayName: imported.displayName,
    bio: imported.bio,
    avatarUrl: imported.avatarUrl || config.avatarUrl,
    bgType: imported.bgType,
    bgValue: imported.bgValue,
    audioUrl: imported.audioUrl || config.audioUrl,
    audioEnabled: imported.audioEnabled ?? !!imported.audioUrl,
    audioTitle: imported.playlist[0]?.title || imported.displayName + ' Soundtrack',
    audioArtist: imported.playlist[0]?.artist || 'Imported',
    playlist: imported.playlist.length ? imported.playlist : config.playlist,
    audioSourceMode: imported.playlist.length > 1 ? 'playlist' : config.audioSourceMode || 'single',
    audioPlayerMode: imported.audioPlayerMode ?? config.audioPlayerMode,
    customCursorUrl: imported.customCursorUrl || config.customCursorUrl,
    snowEffectsEnabled: imported.snowEffectsEnabled ?? config.snowEffectsEnabled,
    sparkles: imported.sparkles ?? config.sparkles,
    sparkleStyle: imported.sparkleStyle ?? config.sparkleStyle,
    nameEffect: imported.nameEffect || config.nameEffect,
    bgBlur: imported.bgBlur ?? config.bgBlur,
    cardOpacity: imported.cardOpacity ?? config.cardOpacity,
    verified: imported.verified,
    badges: imported.badges.length ? imported.badges : config.badges,
    primaryColor: imported.primaryColor || config.primaryColor,
    textColor: imported.textColor || config.textColor,
    glowColor: imported.glowColor || config.glowColor,
    locationEnabled: imported.locationEnabled ?? config.locationEnabled,
    locationText: imported.locationText || config.locationText,
    enterText: imported.enterText || config.enterText,
    monochromeMode: imported.monochromeMode ?? config.monochromeMode,
    discordId: imported.discordId || config.discordId,
    avatarGlowEnabled: imported.avatarGlowEnabled ?? config.avatarGlowEnabled,
    linkHoverGlow: imported.linkHoverGlow ?? config.linkHoverGlow,
    profileGradientEnabled: imported.profileGradientEnabled ?? config.profileGradientEnabled,
    profileGradientCss: imported.profileGradientCss || config.profileGradientCss,
    swapBoxColors: imported.swapBoxColors ?? config.swapBoxColors,
    glowEnabled: imported.glowEnabled ?? config.glowEnabled,
    bgEffectColor: imported.bgEffectColor || config.bgEffectColor,
  };

  if (imported.socialsList.length > 0) {
    const blocksCopy = [...config.blocks];
    const existingSocialsIndex = blocksCopy.findIndex(b => b.type === 'socials');
    if (existingSocialsIndex !== -1) {
      blocksCopy[existingSocialsIndex] = {
        ...blocksCopy[existingSocialsIndex],
        socialsList: imported.socialsList,
      };
    } else {
      blocksCopy.push({
        id: 'imported-socs',
        type: 'socials',
        title: 'My Social networks',
        enabled: true,
        socialsList: imported.socialsList,
      });
    }
    updated.blocks = blocksCopy;
  }

  return updated;
}
