import { X, Globe2 } from 'lucide-react';
import type { SocialLink } from '../types';
import { SOCIAL_PLATFORMS } from '../utils/socialPlatforms';
import SocialIcon from './SocialIcon';

interface SocialPlatformPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (platform: SocialLink['platform']) => void;
}

export default function SocialPlatformPickerModal({
  open,
  onClose,
  onSelect,
}: SocialPlatformPickerModalProps) {
  if (!open) return null;

  const gridPlatforms = SOCIAL_PLATFORMS.filter(p => p.id !== 'x');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider italic">
              Свяжите свои профили в соцсетях
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">Выберите соцсеть, чтобы добавить её в профиль.</p>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {gridPlatforms.map(platform => (
            <button
              key={platform.id}
              type="button"
              onClick={() => { onSelect(platform.id); onClose(); }}
              title={platform.label}
              className="aspect-square rounded-lg bg-white/[0.03] border border-white/10 hover:border-[#00f2ff]/40 hover:bg-white/[0.06] flex items-center justify-center transition cursor-pointer p-2.5"
              style={{ color: platform.brandColor }}
            >
              <SocialIcon platform={platform.id} className="w-6 h-6" />
            </button>
          ))}
        </div>

        <div className="px-4 pb-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => { onSelect('website'); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10 hover:border-[#00f2ff]/40 text-left cursor-pointer transition"
          >
            <Globe2 className="w-5 h-5 text-[#00f2ff] flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Добавить пользовательский URL</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">Используйте свой URL и выберите подходящую иконку.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
