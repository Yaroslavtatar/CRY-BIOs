export interface DiscordBadge {
  id: string;
  label: string;
  icon: 'nitro' | 'nitro_classic' | 'nitro_basic' | 'hypesquad' | 'hypesquad_bravery' | 'hypesquad_brilliance' | 'hypesquad_balance' | 'bug_hunter' | 'bug_hunter_gold' | 'early_supporter' | 'verified_dev' | 'mod' | 'partner' | 'staff' | 'active_dev';
}

const FLAG_STAFF = 1 << 0;
const FLAG_PARTNER = 1 << 1;
const FLAG_HYPESQUAD = 1 << 2;
const FLAG_BUG_HUNTER_L1 = 1 << 3;
const FLAG_HYPESQUAD_BRAVERY = 1 << 6;
const FLAG_HYPESQUAD_BRILLIANCE = 1 << 7;
const FLAG_HYPESQUAD_BALANCE = 1 << 8;
const FLAG_EARLY_SUPPORTER = 1 << 9;
const FLAG_BUG_HUNTER_L2 = 1 << 14;
const FLAG_VERIFIED_DEV = 1 << 17;
const FLAG_EARLY_VERIFIED_DEV = 1 << 22;
const FLAG_MOD = 1 << 18;
const FLAG_ACTIVE_DEV = 1 << 22;

export function decodeDiscordBadges(publicFlags = 0, premiumType = 0): DiscordBadge[] {
  const badges: DiscordBadge[] = [];

  if (premiumType === 2) badges.push({ id: 'nitro', label: 'Nitro', icon: 'nitro' });
  else if (premiumType === 1) badges.push({ id: 'nitro_classic', label: 'Nitro Classic', icon: 'nitro_classic' });
  else if (premiumType === 3) badges.push({ id: 'nitro_basic', label: 'Nitro Basic', icon: 'nitro_basic' });

  if (publicFlags & FLAG_STAFF) badges.push({ id: 'staff', label: 'Discord Staff', icon: 'staff' });
  if (publicFlags & FLAG_PARTNER) badges.push({ id: 'partner', label: 'Partner', icon: 'partner' });
  if (publicFlags & FLAG_HYPESQUAD_BRAVERY) badges.push({ id: 'hypesquad_bravery', label: 'HypeSquad Bravery', icon: 'hypesquad_bravery' });
  else if (publicFlags & FLAG_HYPESQUAD_BRILLIANCE) badges.push({ id: 'hypesquad_brilliance', label: 'HypeSquad Brilliance', icon: 'hypesquad_brilliance' });
  else if (publicFlags & FLAG_HYPESQUAD_BALANCE) badges.push({ id: 'hypesquad_balance', label: 'HypeSquad Balance', icon: 'hypesquad_balance' });
  else if (publicFlags & FLAG_HYPESQUAD) badges.push({ id: 'hypesquad', label: 'HypeSquad', icon: 'hypesquad' });
  if (publicFlags & FLAG_BUG_HUNTER_L2) badges.push({ id: 'bug_hunter_gold', label: 'Bug Hunter Gold', icon: 'bug_hunter_gold' });
  else if (publicFlags & FLAG_BUG_HUNTER_L1) badges.push({ id: 'bug_hunter', label: 'Bug Hunter', icon: 'bug_hunter' });
  if (publicFlags & FLAG_EARLY_SUPPORTER) badges.push({ id: 'early_supporter', label: 'Early Supporter', icon: 'early_supporter' });
  if (publicFlags & FLAG_VERIFIED_DEV || publicFlags & FLAG_EARLY_VERIFIED_DEV) {
    badges.push({ id: 'verified_dev', label: 'Verified Developer', icon: 'verified_dev' });
  }
  if (publicFlags & FLAG_MOD) badges.push({ id: 'mod', label: 'Moderator', icon: 'mod' });
  if (publicFlags & FLAG_ACTIVE_DEV) badges.push({ id: 'active_dev', label: 'Active Developer', icon: 'active_dev' });

  return badges;
}

export function discordAvatarUrl(userId: string, avatarHash?: string | null, size = 128): string {
  if (avatarHash) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
  }
  const index = Number(BigInt(userId) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function mergeBadgesIntoLanyardUser(
  lanyardData: any,
  publicFlags?: number,
  premiumType?: number,
): any {
  if (!lanyardData?.discord_user) return lanyardData;
  return {
    ...lanyardData,
    discord_user: {
      ...lanyardData.discord_user,
      badges: decodeDiscordBadges(publicFlags ?? 0, premiumType ?? 0),
    },
  };
}

export function staticDiscordPresenceFromBio(bio: {
  discordId?: string;
  discordUsername?: string;
  discordDisplayName?: string;
  discordAvatarHash?: string | null;
  discordPremiumType?: number;
  discordPublicFlags?: number;
}) {
  if (!bio.discordId) return null;
  return {
    success: true,
    data: {
      discord_user: {
        id: bio.discordId,
        username: bio.discordUsername || bio.discordId,
        display_name: bio.discordDisplayName || bio.discordUsername,
        avatar: bio.discordAvatarHash,
        badges: decodeDiscordBadges(bio.discordPublicFlags ?? 0, bio.discordPremiumType ?? 0),
      },
      discord_status: 'offline',
      activities: [],
      source: 'oauth',
    },
  };
}
