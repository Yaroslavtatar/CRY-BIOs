import { useState } from 'react';

/** Название сервиса по адресу эмбеда (для подписи заглушки). */
export function embedLabel(src: string): string {
  try {
    const host = new URL(src).hostname.toLowerCase();
    if (host.includes('spotify')) return 'Spotify';
    if (host.includes('soundcloud')) return 'SoundCloud';
    if (host.includes('vimeo')) return 'Vimeo';
    if (host.includes('youtube')) return 'YouTube';
    return host;
  } catch {
    return 'плеер';
  }
}

interface Props {
  src: string;
  height: string;
  /** Подпись сервиса для заглушки, например «Spotify» */
  label: string;
}

/**
 * Эмбед грузится только после клика: до этого сторонний сервис не получает IP посетителя и не ставит cookie,
 * а страница открывается быстрее.
 */
export default function ClickToLoadEmbed({ src, height, label }: Props) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        style={{ height: `${height}px` }}
        className="w-full flex flex-col items-center justify-center gap-1 rounded-sm border border-white/10 bg-black/40 text-neutral-300 hover:bg-black/60 cursor-pointer px-3 text-center"
      >
        <span className="text-xs font-bold uppercase tracking-wider">Загрузить {label}</span>
        <span className="text-[10px] text-neutral-500 normal-case tracking-normal">Сервис {label} получит ваш IP-адрес и сможет установить cookie</span>
      </button>
    );
  }

  return (
    <iframe
      src={src}
      title={label}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
      width="100%"
      height={height}
      frameBorder="0"
      allowFullScreen
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      className="rounded-sm"
    />
  );
}
