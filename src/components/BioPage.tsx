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
import GlowLayer, { getGlowStyle, ProfileGradientWrapper } from './GlowLayer';
import { getNameEffectClasses, getNameEffectStyle } from '../utils/nameEffects';

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
      const primaryColor = config?.primaryColor || '#00f2ff';

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
  }, [entered, isPlaying, isMuted, volume, config?.primaryColor, config?.audioVisualizerEnabled, config?.audioVisualizerStyle]);

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

  // Handle immediate auto-entrance without splash if click-to-enter is disabled
  useEffect(() => {
    if (config && config.clickToEnterEnabled === false) {
      setEntered(true);
    }
  }, [config]);

  // Track visit on enter (Visitor hit counter logging)
  useEffect(() => {
    if (!previewConfig && entered && username) {
      fetch(`/api/bio/${username}/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrer: document.referrer })
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

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'discord':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.46-.63.872-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
          </svg>
        );
      case 'github':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        );
      case 'telegram':
        return (
          <svg className="w-5 h-5 fill-current animate-pulse" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.944 0a12 12 0 0 0-12 12 12 12 0 0 0 12 12 12 12 0 0 0 12-12 12 12 0 0 0-12-12zm5.892 7.9c-.197 2.067-.842 5.854-1.168 7.601-.138.74-.412.988-.674 1.013-.572.053-.997-.379-1.552-.743-.868-.571-1.36-.922-2.198-1.47-1-.629-.352-.976.218-1.569 1.493-1.554 2.747-2.946 3.541-4.041.11-.15.21-.35.21-.45 0-.08-.09-.13-.21-.13l-.04-.01c-.16.03-2.22 1.41-5.71 3.74-.51.35-.97.52-1.38.51-.45 0-1.33-.24-1.98-.46-.8-.26-1.43-.4-1.37-.84.03-.23.35-.46.96-.71 3.75-1.63 6.25-2.71 7.5-3.23 3.57-1.49 4.31-.13 3.52 1.15z" />
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C.5 8.033.5 12 .5 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C23.5 15.967 23.5 12 23.5 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      case 'steam':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 .002a11.996 11.996 0 0 0-11.96 10.87l6.09 2.52a4.42 4.42 0 0 1 2.76-2.008V8.165a2.536 2.536 0 0 1 1.776-5.013 2.536 2.536 0 0 1-1.776 5.013V11.4a4.432 4.432 0 0 1 2.058.91l4.792-2.106a4.4 4.4 0 0 1-.225-1.39A4.43 4.43 0 0 1 20.14 4.39a4.43 4.43 0 0 1 0 8.85 4.432 4.432 0 0 1-4.425-4.424 4.4 4.4 0 0 1 .184-1.242l-4.73 2.08a4.423 4.423 0 0 1-8.156 1.488l-2.02-.835A12 12 0 0 0 12 24a12 12 0 0 0 12-12A12 12 0 0 0 12 .002z" />
          </svg>
        );
      case 'spotify':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 .007a12 12 0 0 0-12 12s0 12 12 12 12-5.372 12-12-5.371-12-12-12zm5.494 17.311c-.237.389-.74.512-1.129.274-3.051-1.867-6.892-2.29-11.417-1.258-.445.101-.89-.176-.991-.62s.176-.89.62-.991c4.957-1.134 9.191-.65 12.643 1.464.389.237.512.74.274 1.131zm1.467-3.264c-.298.482-.924.64-1.406.342-3.49-2.146-8.811-2.771-12.936-1.517-.542.164-1.114-.145-1.279-.687-.164-.542.145-1.114.687-1.279 4.717-1.432 10.584-.734 14.592 1.731.482.298.64.925.342 1.41zm.126-3.32c-4.185-2.484-11.085-2.713-15.093-1.498-.642.195-1.316-.164-1.511-.806s.164-1.315.806-1.511c4.603-1.397 12.213-1.11 17.026 1.744.577.344.767 1.091.423 1.668-.344.578-1.091.767-1.651.403z" />
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44a1.44 0 1 0 0 2.881 1.44 0 0 0 0-2.881z" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.525.02c1.31 0 2.59.35 3.71 1.01.27.16.54.34.79.54.49-.08.97-.2 1.44-.37.15-.05.3.1.28.26-.06.49-.18.97-.36 1.43v.01l.01-.01c1.17-.4 2.21-1.12 3.01-2.07.12-.13.33-.03.3.15-.31 1.95-1.51 3.61-3.21 4.46v3c-.02 4.29-3.41 7.82-7.7 7.97-4.36.15-8.03-3.21-8.11-7.57C3.31 4.7 6.8 1.04 11.16 1c.21 0 .42.01.63.03l.01.01V4.2l-.12-.02c-.17-.03-.34-.04-.52-.04-2.58.07-4.57 2.25-4.5 4.83.07 2.45 2.1 4.4 4.56 4.33 2.41-.06 4.31-2.11 4.24-4.59l-.02-8.69z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        );
    }
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
        primaryColor={config?.primaryColor}
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
      className={`min-h-screen relative text-white flex items-center justify-center p-4 overflow-x-hidden ${config.monochromeMode ? 'grayscale' : ''}`}
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
        color={config.sparkleColor || config.primaryColor}
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
              style={{ backgroundColor: config.primaryColor }}
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
                  color: config.primaryColor || '#00f2ff',
                  textShadow: `0 0 15px ${config.glowColor || 'rgba(0,242,255,0.3)'}, 0 0 30px ${config.primaryColor || '#00f2ff'}55`
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
          className={`w-full ${mobile.cardPadding} ${mobile.cardMaxWidth} relative z-10 flex flex-col items-center space-y-6 transition-all duration-300 ${
            previewConfig ? 'mt-14' : ''
          }`}
        >
          {(config.layout || ['avatar', 'username', 'location', 'badges', 'discord', 'bio', 'blocks', 'player']).map((section) => {
            if (section === 'avatar') {
              return (
                <div key="avatar">
                <GlowLayer config={config} target="avatar">
                  <div className="relative flex flex-col items-center mb-4">
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
                  <div className="flex flex-col items-center mb-4">
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
                  <div key="badges" className="mb-4 w-full flex justify-center">
                    <BadgeRow
                      badges={config.badges}
                      badgeOpacity={config.badgeOpacity}
                      primaryColor={config.primaryColor}
                    />
                  </div>
                );
              }
            }

            if (section === 'discord') {
              if (config.discordConnected && config.discordId) {
                return (
                  <div key="discord" className="flex flex-col items-center p-3 bg-black/40 border border-white/5 rounded-xl min-w-[240px] shadow-lg mb-4">
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
                  <p key="bio" className="text-[14px] font-sans text-center text-white/90 leading-normal max-w-[320px] px-2 whitespace-pre-line drop-shadow-md mb-4">
                    {config.bio}
                  </p>
                );
              }
            }

            if (section === 'blocks') {
              return (
                <div key="blocks" className="flex flex-col items-center space-y-4 w-full mb-4">
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
                            {block.socialsList && block.socialsList.map((soc: SocialLink) => (
                              <a
                                key={soc.id}
                                href={soc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center text-[22px] transition-all duration-300 hover:scale-110 active:scale-95 text-[#fff2f2] drop-shadow-[0_0_7px_#fff2f2]"
                                title={soc.label || soc.platform}
                              >
                                {getPlatformIcon(soc.platform)}
                              </a>
                            ))}
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
