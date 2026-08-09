/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BioConfig, SocialLink, BlockConfig } from '../types';
import { Volume2, VolumeX, Flame, Play, Eye, Share2, CornerDownRight, Quote, Sparkles, Music, SkipBack, Pause, SkipForward, Crown, Shield, ShieldCheck, Gem, Award, Star, Heart, Zap, Code2, Skull, Gamepad2, Coffee, Terminal, CheckCircle2 } from 'lucide-react';
import MinimalAudioBar from './MinimalAudioBar';
import SparkleCanvas from './SparkleCanvas';
import BackgroundCanvas from './BackgroundCanvas';
import LocationLine from './LocationLine';
import MobileBioLayout, { useMobileBio } from './MobileBioLayout';
import VerifiedBadge, { VerifiedAvatarRing } from './VerifiedBadge';
import BadgeRow from './BadgeRow';
import SocialIcon from './SocialIcon';
import GlowLayer, { getGlowStyle, ProfileGradientWrapper } from './GlowLayer';
import { getNameEffectClasses, getNameEffectStyle } from '../utils/nameEffects';
import { getSocialIconColor } from '../utils/socialPlatforms';
import { resolveThemeColor } from '../themeColors';

const renderBadgeIcon = (iconName: string) => {
  const iconProps = { className: "w-3 h-3 flex-shrink-0" };
  switch (iconName?.toLowerCase()) {
    case 'crown': return <Crown {...iconProps} />;
    case 'shield': return <Shield {...iconProps} />;
    case 'shieldcheck': return <CheckCircle2 {...iconProps} />;
    case 'gem': return <Gem {...iconProps} />;
    case 'award': return <Award {...iconProps} />;
    case 'star': return <Star {...iconProps} />;
    case 'heart': return <Heart {...iconProps} />;
    case 'zap': return <Zap {...iconProps} />;
    case 'code': return <Code2 {...iconProps} />;
    case 'flame': return <Flame {...iconProps} />;
    case 'skull': return <Skull {...iconProps} />;
    case 'gamepad': return <Gamepad2 {...iconProps} />;
    case 'music': return <Music {...iconProps} />;
    case 'terminal': return <Terminal {...iconProps} />;
    case 'coffee': return <Coffee {...iconProps} />;
    case 'discord':
      return (
        <svg viewBox="0 0 127.14 96.36" className="w-3 h-3 flex-shrink-0" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.22,123.46,27.42,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
        </svg>
      );
    default:
      return <Sparkles {...iconProps} />;
  }
};

interface BioPageProps {
  username: string;
  onExit: () => void;
  previewConfig?: BioConfig; // If passed, renders in live-preview editor mode
}

export default function BioPage({ username, onExit, previewConfig }: BioPageProps) {
  const [config, setConfig] = useState<BioConfig | null>(previewConfig || null);
  const [loading, setLoading] = useState(!previewConfig);
  const [entered, setEntered] = useState(!!previewConfig);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [visitorCount, setVisitorCount] = useState(137);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(211); // default 3:31 (211 sec)
  const [discordUser, setDiscordUser] = useState<any>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [volume, setVolume] = useState(0.8); // 80% default volume
  const mobile = useMobileBio(config);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Audio Visualizer refs
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Hook to set up Web Audio Analyser safely when audio element is ready
  useEffect(() => {
    if (!entered || !audioRef.current || !config?.audioEnabled) return;

    // Check if the current audio URL is same-origin
    const url = audioRef.current.src || "";
    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin) || !url.startsWith('http');

    // If not same-origin, bypass Web Audio entirely to prevent browsers from muting the audio
    if (!isSameOrigin) {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
        sourceRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    const setupAudioAnalysis = () => {
      try {
        let ctx = audioContextRef.current;
        if (!ctx) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          ctx = new AudioContextClass();
          audioContextRef.current = ctx;
        }

        // Disconnect existing source if any
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch (e) {}
          sourceRef.current = null;
        }

        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 128; // low fftSize for smooth large visualizer bars
        analyserRef.current = analyserNode;

        const source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
        source.connect(analyserNode);
        analyserNode.connect(ctx.destination);
      } catch (err) {
        // Fallback gracefully if Web Audio API is restricted or blocked
        console.warn("Web Audio API binding bypassed (using high-fidelity procedural simulation):", err);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
        sourceRef.current = null;
      }
    };
  }, [entered, audioRef.current, config?.audioEnabled, currentSongIndex]);

  // Visualizer Canvas Drawing Loop
  useEffect(() => {
    if (!entered || !visualizerCanvasRef.current || !config?.audioEnabled || config?.audioVisualizerEnabled === false) return;

    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    const smoothData = new Array(bufferLength).fill(0);
    let localTime = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      localTime += isPlaying ? (0.015 * (volume || 0.5)) : 0.002;

      // 1. Gather audio frequency data (Real-time or Procedural Fallback)
      let hasRealData = false;
      if (analyserRef.current && isPlaying && !isMuted) {
        analyserRef.current.getByteFrequencyData(dataArray);
        // Check if analyser contains real data or just silence due to CORS
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        if (sum > 0) {
          hasRealData = true;
        }
      }

      if (!hasRealData) {
        // High-fidelity procedural frequency wave simulation (synced to play/pause state & volume)
        for (let i = 0; i < bufferLength; i++) {
          if (isPlaying && !isMuted) {
            const factor = 1 - (i / bufferLength); // high frequencies are naturally lower
            const wave1 = Math.sin(localTime * 10 + i * 0.3) * 35;
            const wave2 = Math.cos(localTime * 4 - i * 0.15) * 20;
            const noise = Math.sin(localTime * 18 + i * 0.8) * 12;
            const volumeScale = volume * 1.5;
            let val = (60 + wave1 + wave2 + noise) * factor * volumeScale;
            if (val < 0) val = 0;
            dataArray[i] = Math.min(255, val);
          } else {
            // Soft background pulse when paused/idle
            const wave = Math.sin(localTime * 2 + i * 0.1) * 8;
            let val = 8 + wave;
            if (val < 0) val = 0;
            dataArray[i] = val;
          }
        }
      }

      // Smooth interpolation for fluid aesthetics
      for (let i = 0; i < bufferLength; i++) {
        smoothData[i] += (dataArray[i] - smoothData[i]) * 0.15;
      }

      // 2. Render selected visualizer style
      const style = config?.audioVisualizerStyle || 'bars';
      const primaryColor = resolveThemeColor(config, 'player');

      if (style === 'bars') {
        // Neon frequency bars rising from bottom edge
        const barWidth = (width / bufferLength) * 1.6;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = smoothData[i] / 255;
          const barHeight = percent * (height * 0.28); // Max 28% screen height

          // Glowing linear gradient
          const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.5, `${primaryColor}18`);
          grad.addColorStop(1, `${primaryColor}88`);

          ctx.fillStyle = grad;
          ctx.fillRect(x, height - barHeight, barWidth - 1.5, barHeight);

          // Vivid tip point with neon glow
          if (barHeight > 4) {
            ctx.fillStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 8;
            ctx.fillRect(x, height - barHeight - 1.5, barWidth - 1.5, 2);
            ctx.shadowBlur = 0; // reset shadow
          }
          x += barWidth;
        }
      } else if (style === 'wave') {
        // Continuous organic soundwave stretching across the screen
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = smoothData[i] / 255;
          const offset = percent * (height * 0.12) * Math.sin(localTime + i * 0.15);
          const y = (height * 0.85) + offset; // Positioned near bottom of card

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Semi-transparent depth overlay below the wave line
        ctx.fillStyle = `${primaryColor}08`;
        ctx.beginPath();
        x = 0;
        ctx.moveTo(0, height);
        for (let i = 0; i < bufferLength; i++) {
          const percent = smoothData[i] / 255;
          const offset = percent * (height * 0.12) * Math.sin(localTime + i * 0.15);
          const y = (height * 0.85) + offset;
          ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      } else if (style === 'retro') {
        // 8-bit grid/blocks visualizer
        const barCount = Math.min(32, bufferLength);
        const barWidth = width / barCount;
        const blockHeight = 6;
        const gap = 2.5;

        for (let i = 0; i < barCount; i++) {
          const percent = smoothData[i] / 255;
          const totalHeight = percent * (height * 0.22);
          const blocks = Math.floor(totalHeight / (blockHeight + gap));
          const x = i * barWidth + (barWidth - 10) / 2;

          for (let b = 0; b < blocks; b++) {
            const y = height - b * (blockHeight + gap) - 15;
            const opacity = 0.35 + (b / 15) * 0.65;
            ctx.fillStyle = `${primaryColor}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
            ctx.fillRect(x, y, 8, blockHeight);
          }
        }
      } else if (style === 'circular') {
        // Cosmic circular pulsing spectrum behind the content card
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.28 + 25;

        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `${primaryColor}cc`;
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const percent = smoothData[i] / 255;
          const offset = percent * 50;
          const r = baseRadius + offset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Soft inner steady pulse
        ctx.strokeStyle = `${primaryColor}22`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius - 15, 0, Math.PI * 2);
        ctx.stroke();
      } else if (style === 'mirror') {
        const barWidth = (width / bufferLength) * 1.6;
        const centerX = width / 2;
        for (let i = 0; i < bufferLength; i++) {
          const percent = (isPlaying ? smoothData[i] : smoothData[i] * 0.3) / 255;
          const barHeight = percent * (height * 0.22);
          const offset = (i - bufferLength / 2) * barWidth;
          ctx.fillStyle = `${primaryColor}88`;
          ctx.fillRect(centerX + offset, height - barHeight, barWidth - 1, barHeight);
          ctx.fillRect(centerX - offset - barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } else if (style === 'oscilloscope') {
        if (analyserRef.current) {
          const timeData = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteTimeDomainData(timeData);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const slice = width / timeData.length;
          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = (height * 0.85) + (v - 1) * (height * 0.1);
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * slice, y);
          }
          ctx.stroke();
        }
      } else if (style === 'aurora') {
        for (let w = 0; w < 3; w++) {
          ctx.strokeStyle = `${primaryColor}${['33', '55', '77'][w]}`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = 0; x < width; x += 4) {
            const i = Math.floor((x / width) * bufferLength);
            const y = height * 0.7 + Math.sin(x * 0.01 + localTime * 2 + w) * (smoothData[i] / 255) * 80;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (style === 'pulse') {
        const centerX = width / 2;
        const centerY = height / 2;
        const bass = smoothData.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255;
        for (let r = 1; r <= 4; r++) {
          ctx.strokeStyle = `${primaryColor}${Math.floor((0.4 - r * 0.08) * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 80 * r + bass * 60, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (style === 'particles') {
        for (let i = 0; i < bufferLength; i += 2) {
          const percent = smoothData[i] / 255;
          if (percent < 0.2) continue;
          const x = (i / bufferLength) * width;
          const y = height - percent * height * 0.4;
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.arc(x, y, 2 + percent * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [entered, isPlaying, isMuted, volume, config?.playerAccentColor, config?.primaryColor, config?.audioVisualizerEnabled, config?.audioVisualizerStyle]);

  // Load lanyard if available
  useEffect(() => {
    if (config?.discordConnected && config.discordId) {
      fetch(`/api/discord/${config.discordId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setDiscordUser(data.data);
          }
        })
        .catch(err => console.error("Discord lanyard error", err));
    } else {
      setDiscordUser(null); // Reset
    }
  }, [config?.discordConnected, config?.discordId]);

  // Load config if not in live preview
  useEffect(() => {
    if (previewConfig) {
      setConfig(previewConfig);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/bio/${username}`)
      .then(res => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data: BioConfig) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading profile configuration", err);
        setLoading(false);
      });
  }, [username, previewConfig]);

  // Track visit on enter (Visitor hit counter logging)
  useEffect(() => {
    if (!previewConfig && entered && username) {
      fetch(`/api/bio/${username}/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer: document.referrer,
          host: window.location.hostname,
        }),
      })
        .then(() => {
          // Increment simulated live visitor stat count visually
          setVisitorCount(v => v + 1);
        })
        .catch(err => console.error("Visit log sync error", err));
    }
  }, [entered, username, previewConfig]);

  // Helper to compile final song list
  const getPlaylist = () => {
    if (config?.audioSourceMode === 'playlist' && config?.playlist && config.playlist.length > 0) {
      return config.playlist.filter((s) => s.url);
    }
    if (config?.audioUrl) {
      return [{
        id: 'main',
        url: config.audioUrl,
        title: config.audioTitle || 'Soundtrack',
        artist: config.audioArtist || 'CRY BIOS Player',
      }];
    }
    if (config?.playlist && config.playlist.length > 0) {
      return config.playlist.filter((s) => s.url);
    }
    return [];
  };

  const songs = getPlaylist();
  const currentSong = songs[currentSongIndex] || null;

  const handleNextSong = () => {
    if (songs.length <= 1) return;
    setCurrentSongIndex((prev) => (prev + 1) % songs.length);
  };

  const handlePrevSong = () => {
    if (songs.length <= 1) return;
    setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
  };

  // Audio setup — skip separate audio when video provides sound
  useEffect(() => {
    const useVideoAudio = config?.bgVideoUseAsAudio && config?.bgType === 'video' && config?.bgValue;
    if (!config || !config.audioEnabled || useVideoAudio || !currentSong || !currentSong.url) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio();
    audio.src = currentSong.url;
    audio.loop = songs.length <= 1; // loop if only single track, otherwise play next
    audio.volume = volume;
    audio.muted = isMuted;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setAudioCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (songs.length > 1) {
        handleNextSong();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (entered && !isMuted) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.log("Audio autoplay restricted:", err);
          setIsPlaying(false);
        });
    }

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [currentSong?.url, config?.audioEnabled, config?.bgVideoUseAsAudio, config?.bgType, config?.bgValue, entered, currentSongIndex]);

  // Video background audio after enter
  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video || config?.bgType !== 'video') return;
    if (entered && (config.bgVideoAudioEnabled || config.bgVideoUseAsAudio)) {
      video.muted = isMuted;
      video.volume = volume;
      if (!isMuted) {
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      video.muted = true;
    }
  }, [entered, isMuted, volume, config?.bgType, config?.bgVideoAudioEnabled, config?.bgVideoUseAsAudio]);

  // Remember volume in localStorage
  useEffect(() => {
    if (config?.rememberVolume) {
      const saved = localStorage.getItem(`cry_bios_vol_${username}`);
      if (saved) setVolume(parseFloat(saved));
    }
  }, [config?.rememberVolume, username]);

  useEffect(() => {
    if (config?.rememberVolume) {
      localStorage.setItem(`cry_bios_vol_${username}`, String(volume));
    }
  }, [volume, config?.rememberVolume, username]);

  // OG meta tags
  useEffect(() => {
    if (!config) return;
    const title = config.ogTitle || config.customPageTitle || `${config.displayName || config.username} | CRY BIOS`;
    const description = config.ogDescription || config.bio || '';
    const image = config.ogImage || config.avatarUrl;
    document.title = title;
    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta('og:title', title);
    setMeta('og:description', description);
    if (image) setMeta('og:image', image.startsWith('http') ? image : `${window.location.origin}${image}`);
    if (config.customFaviconUrl) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = config.customFaviconUrl;
    }
  }, [config]);

  // Parallax tilt
  useEffect(() => {
    if (!config?.parallaxEnabled || !entered) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      setParallax({ x, y });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [config?.parallaxEnabled, entered]);

  // Handle live volume adjustments
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Mute toggle helper
  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
      setIsPlaying(false);
    }
  };

  // Play/Pause control helper
  const handlePlayPause = () => {
    if (config?.bgVideoUseAsAudio && bgVideoRef.current) {
      if (isPlaying) {
        bgVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        bgVideoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Background visual styling resolver
  const resolveBackgroundCSS = (): React.CSSProperties => {
    if (!config) return {};

    const style: React.CSSProperties = {
      backgroundColor: config.bgValue && config.bgType === 'color' ? config.bgValue : '#09080e',
      fontFamily: config.fontFamily === 'Inter' ? '"Inter", sans-serif' :
                  config.fontFamily === 'Space Grotesk' ? '"Space Grotesk", sans-serif' :
                  config.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' :
                  config.fontFamily === 'Outfit' ? '"Outfit", sans-serif' : '"Playfair Display", serif'
    };

    // If a gradient is specified
    if (config.bgType === 'gradient' && config.bgValue) {
      style.backgroundImage = config.bgValue;
    }

    // If an image URL is supplied — rendered as lazy <img> layer, not CSS background
    // (see JSX below)

    return style;
  };

  const getBlockStyle = (block: BlockConfig) => {
    const style: React.CSSProperties = {};
    if (block.bgColor) {
      style.backgroundColor = block.bgColor;
    }
    if (block.textColor) {
      style.color = block.textColor;
    }
    if (block.borderColor) {
      style.borderColor = block.borderColor;
    }
    if (block.glow) {
      style.boxShadow = `0 0 15px ${block.glowColor || config?.glowColor || '#00f2ff'}`;
    }
    return style;
  };

  const getBlockClasses = (block: BlockConfig) => {
    const classes = [];
    
    // Custom alignment
    if (block.textAlign) {
      classes.push(`text-${block.textAlign}`);
    }
    
    // Custom font size
    if (block.fontSize === 'xs') classes.push('text-[10px]');
    else if (block.fontSize === 'sm') classes.push('text-xs');
    else if (block.fontSize === 'base') classes.push('text-sm');
    else if (block.fontSize === 'lg') classes.push('text-base');
    
    // Custom border radius
    if (block.borderRadius === 'none') classes.push('rounded-none');
    else if (block.borderRadius === 'sm') classes.push('rounded-sm');
    else if (block.borderRadius === 'md') classes.push('rounded-md');
    else if (block.borderRadius === 'lg') classes.push('rounded-lg');
    else if (block.borderRadius === 'full') classes.push('rounded-full');
    
    return classes.join(' ');
  };

  const getEmbedSrc = (type: BlockConfig['embedType'], url: string) => {
    if (!url) return '';
    
    if (type === 'youtube') {
      let videoId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      } else {
        const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) {
          videoId = shortsMatch[1];
        }
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    
    if (type === 'spotify') {
      if (url.includes('spotify.com') && !url.includes('embed')) {
        return url.replace('spotify.com/', 'spotify.com/embed/');
      }
      return url;
    }
  
    if (type === 'soundcloud') {
      if (url.includes('soundcloud.com') && !url.includes('w.soundcloud.com')) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%2300f2ff&auto_play=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
      }
      return url;
    }
    
    return url;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleEntryClick = () => {
    setEntered(true);
    if (bgVideoRef.current && (config?.bgVideoAudioEnabled || config?.bgVideoUseAsAudio)) {
      bgVideoRef.current.muted = isMuted;
      bgVideoRef.current.play().catch(() => {});
    }
  };

  const hasAudio = config?.audioEnabled && (
    songs.length > 0 ||
    (config.bgVideoUseAsAudio && config.bgType === 'video' && config.bgValue)
  );

  const playerMode = config?.audioPlayerMode || 'minimal';

  const visibleLayout = (config?.layout || ['avatar', 'username', 'location', 'badges', 'discord', 'bio', 'blocks', 'player']).filter((section) => {
    if (!config) return false;
    switch (section) {
      case 'location':
        return !!(config.locationEnabled && config.locationText?.trim());
      case 'discord':
        return !!(config.discordConnected && config.discordId);
      case 'badges':
        return false; // временно отключено
      case 'bio':
        return !!config.bio?.trim();
      case 'blocks':
        return !!(config.blocks?.some(b => b.enabled));
      case 'player':
        return !!(hasAudio && playerMode === 'inline');
      default:
        return true;
    }
  });

  const renderAudioBar = (variant: 'minimal' | 'inline' | 'floating') => {
    if (!hasAudio || playerMode === 'hidden' || playerMode !== variant) return null;
    return (
      <MinimalAudioBar
        currentSong={currentSong || { id: 'v', url: '', title: config?.audioTitle || 'Soundtrack', artist: config?.audioArtist || '' }}
        isPlaying={isPlaying}
        isMuted={isMuted}
        audioCurrentTime={audioCurrentTime}
        audioDuration={audioDuration}
        songsCount={songs.length}
        primaryColor={resolveThemeColor(config, 'player')}
        variant={variant}
        hideUntilHover={config?.hidePlayerUntilHover}
        showVolume={config?.volumeControlVisible}
        volume={volume}
        onToggleMute={toggleMute}
        onVolumeChange={(v) => { setVolume(v); if (v > 0) setIsMuted(false); }}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevSong}
        onNext={handleNextSong}
        onSeek={(pct) => {
          if (audioRef.current && audioDuration) {
            audioRef.current.currentTime = pct * audioDuration;
          }
        }}
        formatTime={formatTime}
      />
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center font-mono text-xs text-neutral-400 z-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#00f2ff] border-white/10 animate-spin" />
          <p>Синхронизация профиля в сети...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center font-mono text-xs text-red-400 z-50 p-6 text-center">
        <div className="p-8 border border-white/10 bg-black/50 rounded-sm max-w-md w-full">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">🛑 ПРОФИЛЬ НЕ НАЙДЕН</h2>
          <p className="text-neutral-500 max-w-sm mx-auto mb-6 text-[11px] leading-relaxed">
            Профиль под именем <code className="text-[#00f2ff]">"{username}"</code> не имеет активных настроек на нашей платформе.
          </p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-white/5 border border-white/10 text-neutral-300 hover:text-white rounded-sm transition cursor-pointer font-bold"
          >
            [ Вернуться в панель ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <MobileBioLayout config={config} className="min-h-screen w-full">
    <div
      className={`min-h-screen relative text-white flex items-center justify-center py-6 p-4 overflow-x-hidden ${config.monochromeMode ? 'grayscale' : ''}`}
      style={resolveBackgroundCSS()}
    >
      {config.bgType === 'video' && config.bgValue && (
        <video
          ref={bgVideoRef}
          autoPlay={entered}
          muted={!entered || !(config.bgVideoAudioEnabled || config.bgVideoUseAsAudio) || isMuted}
          loop
          playsInline
          preload={entered ? 'auto' : 'none'}
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          src={entered ? config.bgValue : undefined}
          onTimeUpdate={(e) => {
            if (config.bgVideoUseAsAudio) {
              setAudioCurrentTime(e.currentTarget.currentTime);
              if (e.currentTarget.duration) setAudioDuration(e.currentTarget.duration);
            }
          }}
        />
      )}

      {config.bgType === 'image' && config.bgValue && (
        <img
          src={config.bgValue}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        />
      )}

      {entered && <BackgroundCanvas config={config} entered={entered} />}

      {entered && config.audioEnabled && (config.audioVisualizerEnabled !== false) && (
        <canvas ref={visualizerCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />
      )}

      <SparkleCanvas
        enabled={!!config.sparkles}
        entered={entered}
        style={config.sparkleStyle}
        color={resolveThemeColor(config, 'sparkle')}
        intensity={config.sparkleIntensity}
      />

      {/* Direct styling override for custom guns.lol cursors */}
      {config.customCursorUrl && (
        <style dangerouslySetInnerHTML={{ __html: `
          * {
            cursor: url(${config.customCursorUrl}) 16 16, auto !important;
          }
        `}} />
      )}

      {/* Dim overlay filters */}
      {entered && config.bgDim > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none z-1"
          style={{ opacity: config.bgDim / 100 }}
        />
      )}

      {/* Background blur filter */}
      {entered && config.bgBlur > 0 && (
        <div
          className="absolute inset-0 pointer-events-none backdrop-blur-md z-1"
          style={{ backdropFilter: `blur(${config.bgBlur}px)` }}
        />
      )}

      {/* Inject custom visual CSS rules safely inside raw style block */}
      {config.customCSS && <style>{config.customCSS}</style>}

      {/* Signature Pre-entrance overlay (Click to enter) */}
      <AnimatePresence>
        {!entered && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            onClick={handleEntryClick}
            className="fixed inset-0 bg-[#050505] z-[9999] flex flex-col items-center justify-center cursor-pointer select-none"
          >
            {/* Ambient Entry Light Flare */}
            <div
              className="absolute w-72 h-72 rounded-full opacity-20 blur-[100px] animate-pulse"
              style={{ backgroundColor: resolveThemeColor(config, 'enterOverlay') }}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0.8 }}
              animate={{ scale: [0.95, 1.02, 0.95], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="text-center font-mono space-y-4 relative z-10 px-6"
            >
              <h2
                className="text-lg md:text-xl font-black tracking-[6px] uppercase italic"
                style={{
                  color: resolveThemeColor(config, 'enterOverlay'),
                  textShadow: `0 0 15px ${config.glowColor || 'rgba(0,242,255,0.3)'}, 0 0 30px ${resolveThemeColor(config, 'enterOverlay')}55`
                }}
              >
                [ {config.enterText || 'Войти'} ]
              </h2>
              <div className="flex items-center justify-center space-x-1.5 text-neutral-500 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-[#00f2ff]" />
                <span>НАЖМИТЕ ДЛЯ ВКЛЮЧЕНИЯ МУЗЫКАЛЬНОГО СОПРОВОЖДЕНИЯ</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating authentic top bar overlay when viewing preview config */}
      {previewConfig && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-black/75 border-b border-white/5 backdrop-blur-md z-[50] px-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={toggleMute} className="text-neutral-400 hover:text-white transition cursor-pointer">
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00f2ff]" />}
            </button>
            <div className="w-[1px] h-4 bg-white/10" />
            <div className="flex items-center space-x-2">
              <img src={config.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} className="w-7 h-7 rounded-full object-cover border border-white/10" loading="lazy" decoding="async" alt="" />
              <div className="flex flex-col text-[10px] leading-tight">
                <span className="text-neutral-400 font-bold font-mono uppercase tracking-wider text-[8px]">ПРЕДПРОСМОТР ШАБЛОНА</span>
                <span className="text-white font-extrabold font-mono text-[9px]">{config.displayName || config.username || 'samurai'}</span>
              </div>
            </div>
          </div>
          <button onClick={onExit} className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-mono rounded text-neutral-300 font-bold transition uppercase tracking-wider cursor-pointer">
            Показать шаблон
          </button>
        </div>
      )}

      {entered && renderAudioBar('minimal')}
      {entered && renderAudioBar('floating')}

      {entered && (
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: parallax.y * 0.4, rotateY: parallax.x * 0.4 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 45 }}
          style={{ transformPerspective: 800, ...getGlowStyle(config, 'card') }}
          className={`w-full ${mobile.cardPadding} ${mobile.cardMaxWidth} relative z-10 flex flex-col items-center space-y-3 transition-all duration-300 ${
            previewConfig ? 'mt-14' : ''
          }`}
        >
          {visibleLayout.map((section) => {
            if (section === 'avatar') {
              return (
                <div key="avatar">
                <GlowLayer config={config} target="avatar">
                  <div className="relative flex flex-col items-center">
                    <VerifiedAvatarRing config={config}>
                      <img
                        src={config.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                        alt={config.displayName}
                        referrerPolicy="no-referrer"
                        loading="eager"
                        decoding="async"
                        className={`${mobile.avatarSize} rounded-full object-cover relative z-10 transition duration-300`}
                        style={
                          config.verified || config.avatarGlowEnabled
                            ? getGlowStyle(config, 'avatar')
                            : { boxShadow: '0 0 15px rgba(0,0,0,0.5)' }
                        }
                      />
                    </VerifiedAvatarRing>
                  </div>
                </GlowLayer>
                </div>
              );
            }

            if (section === 'username') {
              return (
                <div key="username">
                <GlowLayer config={config} target="username">
                  <div className="flex flex-col items-center">
                    <div className="group relative flex items-center justify-center gap-1.5 flex-wrap">
                      <h1
                        className={`${mobile.nameSize} leading-none font-semibold pb-1 ${getNameEffectClasses(config.nameEffect, config.displayName || config.username)}`}
                        style={{
                          ...getNameEffectStyle(config.nameEffect, config.displayName || config.username),
                          ...getGlowStyle(config, 'username'),
                        }}
                      >
                        {config.displayName || config.username}
                      </h1>
                      <VerifiedBadge config={config} />
                    </div>
                  </div>
                </GlowLayer>
                </div>
              );
            }

            if (section === 'location') {
              return (
                <div key="location">
                  <LocationLine config={config} />
                </div>
              );
            }

            if (section === 'badges') {
              if (config.badges && config.badges.filter(b => b.enabled).length > 0) {
                return (
                  <div key="badges" className="w-full flex justify-center">
                    <BadgeRow
                      badges={config.badges}
                      primaryColor={config.primaryColor}
                    />
                  </div>
                );
              }
            }

            if (section === 'discord') {
              if (config.discordConnected && config.discordId) {
                return (
                  <div key="discord" className="flex flex-col items-center p-3 bg-black/40 border border-white/5 rounded-xl min-w-[240px] shadow-lg">
                    {discordUser && discordUser.discord_user ? (
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img 
                            src={`https://cdn.discordapp.com/avatars/${discordUser.discord_user.id}/${discordUser.discord_user.avatar}.png`}
                            className="w-12 h-12 rounded-full border border-white/10"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => { e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                            alt="Discord avatar"
                          />
                          <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-black ${
                            discordUser.discord_status === 'online' ? 'bg-green-500' :
                            discordUser.discord_status === 'idle' ? 'bg-yellow-500' :
                            discordUser.discord_status === 'dnd' ? 'bg-red-500' : 'bg-neutral-500'
                          }`} title={discordUser.discord_status} />
                        </div>
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h1 className="font-bold text-[15px] text-white leading-tight flex items-center gap-1.5 drop-shadow-md">
                              {discordUser.discord_user.display_name || discordUser.discord_user.username}
                            </h1>
                            {discordUser.discord_user.badges && discordUser.discord_user.badges.map((b: any) => (
                              <div key={b.id} className="w-4 h-4 bg-black/40 rounded-sm border border-white/10 flex items-center justify-center text-[#00f2ff]" title={b.label}>
                                {b.id === 'nitro' ? <Zap className="w-3 h-3" /> : <Flame className="w-3 h-3 text-[#f47fff]" />}
                              </div>
                            ))}
                          </div>
                          <h3 className="font-mono text-[11px] text-white/50 tracking-wide leading-tight mt-0.5">
                             @{discordUser.discord_user.username}
                          </h3>
                          {discordUser.activities && discordUser.activities.length > 0 && discordUser.activities[0].name && (
                            <p className="text-[10px] text-white/70 mt-1 line-clamp-1 max-w-[150px]">
                              Playing {discordUser.activities[0].name}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                         <div className="flex flex-col gap-1">
                           <div className="w-20 h-3 bg-white/10 rounded animate-pulse" />
                           <div className="w-12 h-2 bg-white/5 rounded animate-pulse" />
                         </div>
                      </div>
                    )}
                  </div>
                );
              }
            }

            if (section === 'bio') {
              if (config.bio) {
                return (
                  <p key="bio" className="text-[14px] font-sans text-center text-white/90 leading-normal max-w-[320px] px-2 whitespace-pre-line drop-shadow-md">
                    {config.bio}
                  </p>
                );
              }
            }

            if (section === 'blocks') {
              return (
                <div key="blocks" className="flex flex-col items-center space-y-3 w-full">
                  {config.blocks && config.blocks.filter(b => b.enabled).map((block) => {
                    const blockStyle = getBlockStyle(block);
                    const blockClasses = getBlockClasses(block);

                    switch (block.type) {
                      // Social Links Blocks Minimal
                      case 'socials':
                        return (
                          <div 
                            key={block.id} 
                            style={blockStyle}
                            className={`flex flex-wrap items-center justify-center gap-3.5 py-2 mt-2 ${blockClasses}`}
                          >
                            {block.socialsList && block.socialsList.map((soc: SocialLink) => {
                              const iconColor = getSocialIconColor(soc, resolveThemeColor(config, 'link'));
                              return (
                              <a
                                key={soc.id}
                                href={soc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center text-[22px] transition-all duration-300 hover:scale-110 active:scale-95"
                                style={{ color: iconColor, filter: `drop-shadow(0 0 7px ${iconColor}88)` }}
                                title={soc.label || soc.platform}
                              >
                                <SocialIcon platform={soc.platform} className="w-5 h-5" />
                              </a>
                            );})}
                          </div>
                        );

                      // Custom embedded HTML / CSS container code block
                      case 'html':
                        return (
                          <div 
                            key={block.id} 
                            style={blockStyle}
                            className={`w-full max-w-sm bg-transparent !border-none ${blockClasses}`}
                          >
                            <div
                              className="p-3 text-[11px] font-sans text-white/90 drop-shadow-md"
                              dangerouslySetInnerHTML={{ __html: block.htmlContent || '' }}
                            />
                          </div>
                        );

                      // Custom-made guns.lol direct Status profile module!
                      case 'status_api':
                        return (
                          <div 
                            key={block.id} 
                            style={blockStyle}
                            className={`max-w-xs text-center font-mono ${blockClasses}`}
                          >
                            {block.statusCustomText && (
                              <p className="italic font-sans text-[13px] leading-relaxed drop-shadow-md text-white/80">
                                "{block.statusCustomText}"
                              </p>
                            )}
                          </div>
                        );

                      // Interactive tracking profile View page counter block Minimal
                      case 'views_counter':
                        return (
                          <div 
                            key={block.id} 
                            style={blockStyle}
                            className={`fixed bottom-[12px] left-[15px] flex justify-center items-center font-sans z-50 ${blockClasses}`}
                          >
                            <span className="flex items-center space-x-1.5 text-[14px] text-[#f5f5f5] drop-shadow-lg font-semibold tracking-wide">
                              <Eye className="w-[14px] h-[14px]" />
                              <span>{visitorCount}</span>
                            </span>
                          </div>
                        );

                      // Glowing textbox announcement block
                      case 'textbox':
                        return (
                          <div
                            key={block.id}
                            style={{
                              ...blockStyle,
                              backgroundColor: `rgba(0, 0, 0, ${(config.cardOpacity !== undefined ? config.cardOpacity : 20) / 100})`,
                              border: `2px solid rgba(255, 255, 255, 0.04)`,
                              borderRadius: `20px`,
                            }}
                            className={`p-[35px_15px] max-w-[40rem] mx-auto text-center font-sans text-[14px] leading-relaxed text-white drop-shadow-md ${blockClasses} ${
                              block.textboxStyle === 'glow' ? 'shadow-[0_0_16.5px_#ffffff] text-white border-none' : ''
                            }`}
                          >
                            {block.textboxStyle === 'marquee' ? (
                              <div className="whitespace-nowrap animate-marquee">
                                {block.textboxContent || 'КОНТЕНТ НЕ ЗАДАН'}
                              </div>
                            ) : (
                              <p>{block.textboxContent || 'КОНТЕНТ НЕ ЗАДАН'}</p>
                            )}
                          </div>
                        );

                      // Quotes text block
                      case 'quote':
                        return (
                          <div 
                            key={block.id} 
                            style={{
                              ...blockStyle,
                              backgroundColor: 'rgba(0, 0, 0, 0.2)',
                              border: '2px solid rgba(0, 0, 0, 0.1)',
                              borderRadius: '20px'
                            }}
                            className={`p-[35px_15px] max-w-[40rem] mx-auto font-sans text-center text-white/60 relative w-full ${blockClasses}`}
                          >
                            <Quote className="w-4 h-4 text-white/30 absolute top-4 left-6 mix-blend-screen" />
                            <p className="font-sans leading-relaxed text-[14px] tracking-wide text-white drop-shadow-md italic">"{block.quoteText || 'Код без терминала — как рыцарь без меча.'}"</p>
                            {block.quoteAuthor && (
                              <span className="block text-center text-[12px] font-sans text-white/60 tracking-wider uppercase mt-3 font-semibold drop-shadow-md text-nowrap">
                                — {block.quoteAuthor}
                              </span>
                            )}
                          </div>
                        );

                      // Featured Image block
                      case 'image':
                        const imgElement = (
                          <img
                            src={block.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80'}
                            alt={block.imageAlt || 'Изображение'}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            style={{
                              height: block.imageHeight ? `${block.imageHeight}px` : '200px',
                              objectFit: block.imageFit || 'cover',
                            }}
                            className="w-full block"
                          />
                        );
                        return (
                          <div
                            key={block.id}
                            style={{
                              ...blockStyle,
                              backgroundColor: `rgba(0, 0, 0, ${(config.cardOpacity !== undefined ? config.cardOpacity - 10 : 45) / 100})`
                            }}
                            className={`overflow-hidden border border-white/10 rounded-xl ${blockClasses}`}
                          >
                            {block.title && (
                              <div className="px-3.5 py-1.5 border-b border-white/10 bg-black/40 text-[9px] font-mono text-neutral-500 uppercase tracking-widest text-center font-bold">
                                {block.title}
                              </div>
                            )}
                            {block.imageLink ? (
                              <a href={block.imageLink} target="_blank" rel="noopener noreferrer" className="block focus:outline-none hover:opacity-90 transition">
                                {imgElement}
                              </a>
                            ) : (
                              imgElement
                            )}
                          </div>
                        );

                      // Media Embed block
                      case 'embed':
                        const embedSrc = getEmbedSrc(block.embedType, block.embedUrl || '');
                        return (
                          <div
                            key={block.id}
                            style={{
                              ...blockStyle,
                              backgroundColor: `rgba(0, 0, 0, ${(config.cardOpacity !== undefined ? config.cardOpacity - 10 : 45) / 100})`
                            }}
                            className={`overflow-hidden border border-white/10 rounded-xl ${blockClasses}`}
                          >
                            {block.title && (
                              <div className="px-3.5 py-1.5 border-b border-white/10 bg-black/40 text-[9px] font-mono text-neutral-500 uppercase tracking-widest text-center font-bold">
                                {block.title}
                              </div>
                            )}
                            <div className="p-2 justify-center flex">
                              {embedSrc ? (
                                <iframe
                                  src={embedSrc}
                                  width="100%"
                                  height={block.embedType === 'spotify' ? '80' : block.embedType === 'soundcloud' ? '150' : '220'}
                                  frameBorder="0"
                                  allowFullScreen
                                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                  className="rounded-sm"
                                />
                              ) : (
                                <div className="p-4 text-xs text-neutral-500 font-mono text-center w-full">Канал проигрывателя не настроен.</div>
                              )}
                            </div>
                          </div>
                        );

                      default:
                        return null;
                    }
                  })}
                </div>
              );
            }

            if (section === 'player') {
              return <React.Fragment key="player">{renderAudioBar('inline')}</React.Fragment>;
            }
            return null;
          })}
        </motion.div>
      )}
    </div>
    </MobileBioLayout>
  );
}
