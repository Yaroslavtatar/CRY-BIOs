import type { AdminApi } from '../adminApi';

export interface SectionProps {
  api: AdminApi;
  notify: (tone: 'success' | 'error' | 'info', text: string) => void;
}

export interface AdminUser {
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  visitsCount: number;
  banned: boolean;
  banReason: string;
}

export interface SiteSettings {
  hideAdminPanelLink: boolean;
  registrationOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}
