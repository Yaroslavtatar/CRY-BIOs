import fs from 'fs';
import path from 'path';

export interface SiteSettings {
  hideAdminPanelLink: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  hideAdminPanelLink: false,
};

function settingsFilePath(dataDir: string): string {
  return path.join(dataDir, 'site_settings.json');
}

export function getSiteSettings(dataDir: string): SiteSettings {
  const filePath = settingsFilePath(dataDir);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<SiteSettings>;
    return {
      hideAdminPanelLink: Boolean(parsed.hideAdminPanelLink),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSiteSettings(dataDir: string, patch: Partial<SiteSettings>): SiteSettings {
  const current = getSiteSettings(dataDir);
  const next: SiteSettings = { ...current, ...patch };
  fs.writeFileSync(settingsFilePath(dataDir), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
