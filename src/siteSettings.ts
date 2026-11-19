import fs from 'fs';
import path from 'path';

export interface SiteSettings {
  hideAdminPanelLink: boolean;
  /** false — новые аккаунты создавать нельзя (вход существующих работает) */
  registrationOpen: boolean;
  /** true — сайт в режиме обслуживания: запись для пользователей закрыта, на главной видна плашка */
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  hideAdminPanelLink: false,
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: 'Идут технические работы. Скоро вернёмся.',
};

function settingsFilePath(dataDir: string): string {
  return path.join(dataDir, 'site_settings.json');
}

function normalize(parsed: Partial<SiteSettings>): SiteSettings {
  return {
    hideAdminPanelLink: Boolean(parsed.hideAdminPanelLink),
    registrationOpen: parsed.registrationOpen !== false,
    maintenanceMode: Boolean(parsed.maintenanceMode),
    maintenanceMessage:
      typeof parsed.maintenanceMessage === 'string' && parsed.maintenanceMessage.trim()
        ? parsed.maintenanceMessage.trim().slice(0, 300)
        : DEFAULT_SETTINGS.maintenanceMessage,
  };
}

export function getSiteSettings(dataDir: string): SiteSettings {
  const filePath = settingsFilePath(dataDir);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return normalize(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<SiteSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSiteSettings(dataDir: string, patch: Partial<SiteSettings>): SiteSettings {
  const current = getSiteSettings(dataDir);
  const next = normalize({ ...current, ...patch });
  fs.writeFileSync(settingsFilePath(dataDir), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
