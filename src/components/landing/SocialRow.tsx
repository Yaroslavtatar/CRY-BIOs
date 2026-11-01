import React from 'react';
import SocialIcon from '../SocialIcon';
import { SOCIAL_LABELS, type SocialLink } from '../../socials';

/** Иконки соцсетей проекта. GitHub показывается всегда, остальные — только если владелец инстанса задал ссылки (SOCIAL_*_URL). */
export default function SocialRow({ githubUrl, socials, className = '' }: { githubUrl?: string; socials?: SocialLink[]; className?: string }) {
  const items = [...(githubUrl ? [{ id: 'github', label: 'GitHub', url: githubUrl }] : []), ...(socials ?? []).map((s) => ({ id: s.id as string, label: SOCIAL_LABELS[s.id], url: s.url }))];
  if (items.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`} aria-label="Мы в соцсетях">
      {items.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 hover:border-[#00f2ff]/60 hover:text-[#00f2ff] text-neutral-300 flex items-center justify-center transition"
          >
            <SocialIcon platform={s.id} className="w-5 h-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
