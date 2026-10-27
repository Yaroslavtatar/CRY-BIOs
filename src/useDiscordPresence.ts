import { useEffect, useState } from 'react';
import { staticDiscordPresenceFromBio } from './discordBadges';

const POLL_MS = 30_000;

interface DiscordConfigSlice {
  discordConnected?: boolean;
  discordId?: string;
  discordUsername?: string;
  discordDisplayName?: string;
  discordAvatarHash?: string | null;
  discordPremiumType?: number;
  discordPublicFlags?: number;
}

/**
 * Presence привязанного Discord-аккаунта.
 * Сразу отдаёт данные из OAuth (аватар, имя, бейджи), затем обновляет live-статус из Lanyard каждые 30 с.
 * Если Lanyard недоступен или пользователь не на его сервере — остаётся OAuth-карточка (source === 'oauth').
 */
export function useDiscordPresence(config: DiscordConfigSlice | null | undefined): any | null {
  const connected = Boolean(config?.discordConnected && config?.discordId);
  const id = config?.discordId;
  const [presence, setPresence] = useState<any | null>(null);

  const fallback = connected ? staticDiscordPresenceFromBio(config as DiscordConfigSlice)?.data ?? null : null;
  const fallbackKey = [
    id,
    config?.discordUsername,
    config?.discordDisplayName,
    config?.discordAvatarHash,
    config?.discordPremiumType,
    config?.discordPublicFlags,
  ].join('|');

  useEffect(() => {
    if (!connected || !id) {
      setPresence(null);
      return;
    }
    setPresence(fallback);

    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/discord/${id}`);
        const body = await res.json();
        if (!cancelled && body?.success && body.data?.discord_user) setPresence(body.data);
      } catch {
        /* остаёмся на текущих данных */
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // fallback пересчитывается из тех же полей, что входят в fallbackKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, id, fallbackKey]);

  return connected ? presence ?? fallback : null;
}
