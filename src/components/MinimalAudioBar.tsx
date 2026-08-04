import React from 'react';
import { Music, SkipBack, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { SongConfig } from '../types';

interface MinimalAudioBarProps {
  currentSong: SongConfig | null;
  isPlaying: boolean;
  isMuted: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  songsCount: number;
  primaryColor?: string;
  variant?: 'minimal' | 'inline' | 'floating';
  hideUntilHover?: boolean;
  showVolume?: boolean;
  volume?: number;
  onToggleMute?: () => void;
  onVolumeChange?: (v: number) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (percent: number) => void;
  formatTime: (sec: number) => string;
}

export default function MinimalAudioBar({
  currentSong,
  isPlaying,
  isMuted,
  audioCurrentTime,
  audioDuration,
  songsCount,
  primaryColor = '#00f2ff',
  variant = 'minimal',
  hideUntilHover = false,
  showVolume = false,
  volume = 0.8,
  onToggleMute,
  onVolumeChange,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  formatTime,
}: MinimalAudioBarProps) {
  if (!currentSong) return null;

  const progress = audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0;

  const positionClass =
    variant === 'floating'
      ? 'fixed bottom-4 left-4 z-50 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))]'
      : variant === 'minimal'
        ? 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] max-sm:w-[calc(100%-2rem)]'
        : 'relative w-full z-10 mb-4';

  const hoverClass = hideUntilHover
    ? 'max-sm:opacity-100 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300'
    : '';

  return (
    <div
      className={`${positionClass} ${hoverClass} w-[min(100%,32rem)] px-3 py-2.5 rounded-xl bg-black/45 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}
      style={{ boxShadow: `0 0 24px ${primaryColor}22` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
          style={{ color: primaryColor }}
        >
          <Music className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white truncate leading-tight">
                {currentSong.title || 'Soundtrack'}
              </p>
              <p className="text-[9px] text-neutral-400 truncate uppercase tracking-wider font-mono">
                {formatTime(audioCurrentTime)}
              </p>
            </div>
            <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0">
              {formatTime(audioDuration)}
            </span>
          </div>

          <div
            className="h-1 bg-white/10 rounded-full cursor-pointer relative group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek((e.clientX - rect.left) / rect.width);
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: primaryColor }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md transition-all opacity-0 group-hover:opacity-100"
              style={{ left: `calc(${progress}% - 5px)` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 text-white/80 flex-shrink-0">
          {showVolume && onToggleMute && (
            <button type="button" onClick={onToggleMute} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-white transition cursor-pointer" title="Громкость">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onPrev}
            disabled={songsCount <= 1}
            className="p-1.5 hover:text-white disabled:opacity-25 transition cursor-pointer"
            title="Предыдущий"
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            className="p-1.5 hover:scale-110 active:scale-95 transition cursor-pointer"
            style={{ color: primaryColor }}
            title={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={songsCount <= 1}
            className="p-1.5 hover:text-white disabled:opacity-25 transition cursor-pointer"
            title="Следующий"
          >
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </div>
      {showVolume && onVolumeChange && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full mt-2 h-1 accent-[var(--accent)]"
          style={{ ['--accent' as string]: primaryColor }}
        />
      )}
    </div>
  );
}
