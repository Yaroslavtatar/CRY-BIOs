/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Code2, Play, Terminal, Download, Copy, Check, ArrowRight, Activity, Users, Globe2, HelpCircle, Star, Zap, ChevronDown, Wrench } from 'lucide-react';
import { getThumbUrl } from '../utils/media';
import { getPlatformDomainConfig, type PlatformDomainConfig } from '../platformDomain';
import { useGithub } from '../hooks/useGithub';
import OpenSourceSection from './landing/OpenSourceSection';
import SocialRow from './landing/SocialRow';
import SocialIcon from './SocialIcon';
import { DEFAULT_REPO, dockerImageFor } from '../github';
import { compactNumber, isVersionTag } from '../utils/format';
import type { SocialLink } from '../socials';
import { getDefaultHomeLayout, sanitizeHomeLayout, sanitizeUrl, type HomeBlock, type HomeLayout } from '../homeLayout';

interface ActiveProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
}

interface LandingPageProps {
  onNavigateToDashboard: () => void;
  onViewProfile: (username: string) => void;
  platformConfig?: PlatformDomainConfig & { hideAdminPanelLink?: boolean; maintenanceMode?: boolean; maintenanceMessage?: string; socials?: SocialLink[] };
  /** Макет передан извне (предпросмотр в конструкторе): сетевой запрос макета не выполняется. */
  layout?: HomeLayout;
}

const FEATURE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles, code: Code2, activity: Activity, shield: Shield, globe: Globe2, users: Users, star: Star, terminal: Terminal, download: Download, zap: Zap,
};

const ANNOUNCEMENT_TONES = {
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-100',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-100',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
} as const;

export default function LandingPage({ onNavigateToDashboard, onViewProfile, platformConfig, layout: layoutOverride }: LandingPageProps) {
  const [fetchedLayout, setFetchedLayout] = useState<HomeLayout>(() => getDefaultHomeLayout());
  const layout = layoutOverride ?? fetchedLayout;
  const settings = layout.settings;

  useEffect(() => {
    if (layoutOverride) return;
    let cancelled = false;
    fetch('/api/home-layout')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setFetchedLayout(sanitizeHomeLayout(data)); })
      .catch(() => { /* остаётся макет по умолчанию */ });
    return () => { cancelled = true; };
  }, [layoutOverride]);

  const [activeBios, setActiveBios] = useState<ActiveProfile[]>([]);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const github = useGithub();

  const runtimePlatform = getPlatformDomainConfig({
    appUrl: platformConfig?.appUrl,
    bioBaseDomain: platformConfig?.baseDomain,
    requestHost: typeof window !== 'undefined' ? window.location.host : undefined,
  });
  const installOrigin = runtimePlatform.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const installScriptCmd = `curl -sSL ${installOrigin}/api/install-script | bash`;
  const ghData = github.status === 'ready' ? github.data : null;
  // GITHUB_REPO=off: владелец инстанса скрыл всё, что связано с репозиторием
  const showGithub = github.status !== 'disabled';
  const repoUrl = ghData?.repo.url ?? `https://github.com/${DEFAULT_REPO}`;
  // образ, который реально публикует .github/workflows/docker.yml (имя репозитория в нижнем регистре)
  const dockerImage = ghData?.dockerImage ?? dockerImageFor(DEFAULT_REPO);
  const dockerComposeCode = `version: '3.8'

services:
  cry_bios:
    image: ${dockerImage}
    container_name: cry_bios_server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000`;

  useEffect(() => {
    // Fetch registered bios from API
    fetch('/api/all-bios')
      .then(res => res.json())
      .then((data: ActiveProfile[]) => {
        setActiveBios(data);
      })
      .catch(err => {
        console.error("Error fetching bios index", err);
        // Fallback demo database list
        const fallback = [
          { username: 'cryteam', displayName: 'cryteam', bio: '⚡ elite coding squad • custom HTML developers ⚡', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', verified: true }
        ];
        setActiveBios(fallback);
      });
  }, []);

  const handleCopy = (text: string, type: 'script' | 'docker') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedDocker(true);
      setTimeout(() => setCopiedDocker(false), 2000);
    }
  };

  const renderAnnouncement = (block: HomeBlock) => {
    const p = block.props;
    const tone = ANNOUNCEMENT_TONES[p.level ?? 'info'];
    const href = sanitizeUrl(p.linkUrl);
    return (
      <div key={block.id} className={`relative z-[60] border-b px-4 py-2.5 text-center text-xs sm:text-sm font-sans ${tone}`} role="status">
        <span>{p.text}</span>
        {href && p.linkLabel && (
          <a href={href} className="ml-3 font-bold underline underline-offset-2 hover:opacity-80" {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{p.linkLabel}</a>
        )}
      </div>
    );
  };

  const renderBlock = (block: HomeBlock): React.ReactNode => {
    const p = block.props;
    switch (block.type) {
      case 'announcement':
        return renderAnnouncement(block);
      case 'hero':
        return (
          <section key={block.id} className="px-6 pt-20 md:pt-28 pb-16 text-center max-w-5xl mx-auto relative">
          <a
                href={showGithub ? '#opensource' : undefined}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 hover:border-[#00f2ff]/60 text-[10px] font-bold uppercase tracking-[0.3em] w-fit mx-auto mb-8 font-mono transition"
              >
                {p.badge}
                {ghData && (
                  <span className="inline-flex items-center gap-1 text-[#00f2ff] tracking-normal">
                    <Star className="w-3 h-3 fill-current" />
                    {compactNumber(ghData.repo.stars)}
                  </span>
                )}
              </a>
    
              <h1 className="text-[clamp(1.75rem,9vw,3rem)] md:text-7xl lg:text-8xl font-black leading-[0.9] md:leading-[0.85] tracking-tighter uppercase italic mb-8">
                {p.titleLine1}<br />
                <span className="text-[#00f2ff] drop-shadow-[0_0_15px_rgba(0,242,255,0.1)]">{p.titleAccent}</span>
              </h1>
    
              <p className="text-neutral-400 max-w-2xl mx-auto text-base md:text-lg mb-12 leading-relaxed font-sans">
                {p.description}
              </p>
    
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 font-mono">
                <button
                  onClick={onNavigateToDashboard}
                  id="hero_start_btn"
                  className="w-full sm:w-auto px-8 py-5 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic hover:bg-[#00d0e0] hover:shadow-[0_0_35px_rgba(0,242,255,0.4)] flex items-center justify-center space-x-2 cursor-pointer rounded-sm transition-all duration-300"
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>{p.primaryLabel}</span>
                </button>
                {p.showSecondary !== false && (
                <a
                  href="#installer"
                  className="w-full sm:w-auto px-8 py-5 bg-[#0c0c0c] border border-white/15 font-black text-xs tracking-widest uppercase text-white hover:bg-neutral-900 transition flex items-center justify-center space-x-2 rounded-sm"
                >
                  <Terminal className="w-4 h-4 text-[#00f2ff]" />
                  <span>{p.secondaryLabel}</span>
                </a>
                )}
              </div>
    
            </section>
    
        );
      case 'stats':
        return (
          <section key={block.id} className="px-6 pb-16 max-w-5xl mx-auto relative">
            {p.useCustomStats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-8 rounded-sm bg-[#0c0c0c] border border-white/10 max-w-4xl mx-auto shadow-2xl font-mono">
                {(p.stats ?? []).map((item, i) => (
                  <div key={i} className={`text-center ${i > 0 ? 'sm:border-l sm:border-white/10' : ''}`}>
                    <span className={`block text-[10px] font-black tracking-widest uppercase italic ${i % 2 === 0 ? 'text-[#00f2ff]' : 'text-neutral-400'}`}>{item.label}</span>
                    <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-8 rounded-sm bg-[#0c0c0c] border border-white/10 max-w-4xl mx-auto shadow-2xl font-mono">
                <div className="text-center">
                  <span className="block text-[10px] font-black tracking-widest text-[#00f2ff] uppercase italic">Селф-хостинг</span>
                  <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">В 1 команду</span>
                </div>
                <div className="text-center sm:border-l sm:border-white/10">
                  <span className="block text-[10px] font-black tracking-widest text-neutral-400 uppercase italic">Создано профилей</span>
                  <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">{activeBios.length} Активных</span>
                </div>
                <div className="text-center sm:border-l sm:border-white/10">
                  <span className="block text-[10px] font-black tracking-widest text-[#00f2ff] uppercase italic">GitHub</span>
                  {showGithub ? (
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic hover:text-[#00f2ff] transition">
                      {ghData ? `★ ${compactNumber(ghData.repo.stars)}` : 'Open Source'}
                    </a>
                  ) : (
                    <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">Open Source</span>
                  )}
                </div>
                <div className="text-center sm:border-l sm:border-white/10">
                  <span className="block text-[10px] font-black tracking-widest text-neutral-400 uppercase italic">Лицензия</span>
                  <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">{ghData?.repo.license || 'MIT'}</span>
                </div>
              </div>
            )}
          </section>
        );
      case 'features':
        return (
        <section key={block.id} className="px-6 py-20 bg-[#0c0c0c] border-t border-b border-white/10 relative">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-4">{p.title}</h2>
                <p className="text-neutral-400 text-sm max-w-xl mx-auto font-sans">
                  {p.subtitle}
                </p>
              </div>
  
              <div className="grid md:grid-cols-3 gap-8">
                {(p.features ?? []).map((f, i) => {
                  const Icon = FEATURE_ICON_MAP[f.icon] ?? Sparkles;
                  return (
                    <div key={i} className="bg-black/40 border border-white/10 rounded-sm p-8 relative group hover:border-[#00f2ff]/30 transition-all duration-300">
                      <div className="w-12 h-12 bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded-sm flex items-center justify-center mb-6 text-[#00f2ff]">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight italic mb-2 text-white">{f.title}</h3>
                      <p className="text-neutral-400 text-xs leading-relaxed font-sans">{f.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      case 'opensource':
        return showGithub ? <React.Fragment key={block.id}><OpenSourceSection github={github} /></React.Fragment> : null;
      case 'profiles':
        return (
        <section key={block.id} className="px-6 py-20 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
              <div>
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-2">{p.title}</h2>
                <p className="text-neutral-400 text-sm font-sans">
                  {p.subtitle}
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-2 text-xs font-bold font-mono text-[#00f2ff] bg-white/5 border border-white/10 px-4 py-2.5 rounded-sm uppercase tracking-wider max-w-full">
                <Users className="w-4 h-4 text-[#00f2ff] shrink-0" />
                <span className="break-words">ЗАРЕГИСТРИРОВАНО ПРОФИЛЕЙ: {activeBios.length}</span>
              </div>
            </div>
  
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {activeBios.slice(0, p.limit ?? 30).map(profile => (
                <div
                  key={profile.username}
                  onClick={() => onViewProfile(profile.username)}
                  className="bg-[#0c0c0c] border border-white/10 hover:border-[#00f2ff]/40 p-6 rounded-sm cursor-pointer hover:shadow-[0_0_30px_rgba(0,242,255,0.1)] transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={getThumbUrl(profile.avatarUrl)}
                      alt={profile.username}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-sm object-cover border border-white/10 group-hover:border-[#00f2ff]/60 transition"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm tracking-wide text-white group-hover:text-[#00f2ff] transition">
                          @{profile.username}
                        </span>
                        {profile.verified && (
                          <span className="bg-[#00f2ff] text-black text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest italic" title="Верифицировано">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-400 line-clamp-1 mt-1 max-w-[170px] font-sans">{profile.bio}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:translate-x-1 text-[#00f2ff] transition-all" />
                </div>
              ))}
            </div>
          </section>
        );
      case 'installer':
        return (
        <section key={block.id} id="installer" className="px-6 py-20 bg-[#0c0c0c] border-t border-b border-white/10">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center [&>*]:min-w-0">
              <div>
                <div className="inline-block px-3 py-1 bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-[0.2em] w-fit mb-4 font-mono">
                  Собственный сервер
                </div>
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-4">Установка в одну строчку</h2>
                <p className="text-neutral-400 text-sm leading-relaxed mb-6 font-sans">
                  CRY BIOS спроектирован как ультралёгкое Node.js-приложение без громоздких сторонних enterprise-зависимостей. Вы можете с лёгкостью развернуть платформу на собственном виртуальном сервере, домашнем хосте VPS или контроллере Raspberry Pi за считанные секунды.
                </p>
  
                {/* Second level domain annotation specifically requested */}
                <div className="p-5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex gap-4 items-start font-mono">
                  <Globe2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                      Короткие адреса профилей
                    </h3>
                    <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed font-sans">
                      Каждый пользователь получает поддомен{' '}
                      <code className="text-[#00f2ff] font-mono">name.{runtimePlatform.baseDomain || 'yourdomain.com'}</code>{' '}
                      и короткий path{' '}
                      <code className="text-[#00f2ff] font-mono">/{'{name}'}</code>.
                      Настройте DNS <code className="text-[#00f2ff]">*.{runtimePlatform.baseDomain || 'yourdomain.com'}</code> на ваш сервер.
                    </p>
                  </div>
                </div>
  
                <div className="mt-8 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 font-mono">
                  <a
                    href="/api/install-script"
                    className="px-6 py-3.5 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic flex items-center space-x-2 transition hover:bg-[#00d0e0] rounded-sm whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>СКАЧАТЬ INSTALL.SH</span>
                  </a>
                  <span className="text-xs text-neutral-400 break-words">или экспортируйте файлы в админ-панели</span>
                </div>
              </div>
  
              <div>
                {/* Terminal code UI */}
                <div className="p-1 rounded-sm bg-black border border-white/10 shadow-2xl relative overflow-hidden font-mono">
                  <div className="flex justify-between items-center bg-[#0c0c0c] px-5 py-3 border-b border-white/10">
                    <div className="flex space-x-1.5">
                      <span className="w-2.5 h-2.5 bg-red-500/80 rounded-full inline-block" />
                      <span className="w-2.5 h-2.5 bg-yellow-500/80 rounded-full inline-block" />
                      <span className="w-2.5 h-2.5 bg-green-500/80 rounded-full inline-block" />
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono font-bold tracking-wider">install_cry_bios.sh</span>
                  </div>
  
                  <div className="p-5 font-mono text-xs text-neutral-300 overflow-x-auto space-y-4">
                    <div>
                      <span className="text-neutral-400"># Установка с помощью стандартного установщика curl</span>
                      <div className="flex justify-between items-center bg-white/5 hover:bg-white/10 p-3 rounded-sm border border-white/10 mt-2">
                         <span className="text-[#00f2ff] break-all select-all font-mono font-medium">{installScriptCmd}</span>
                        <button
                          onClick={() => handleCopy(installScriptCmd, 'script')}
                          className="p-1.5 bg-white/5 rounded-sm text-neutral-400 hover:text-white transition cursor-pointer"
                          title="Скопировать команду"
                        >
                          {copiedScript ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
  
                    <div>
                      <span className="text-neutral-400"># Альтернативный запуск в контейнере docker-compose.yml</span>
                      <div className="relative mt-2">
                        <pre className="text-[10px] bg-white/5 p-4 rounded-sm border border-white/10 leading-normal overflow-x-auto text-neutral-300 font-mono">
                          {dockerComposeCode}
                        </pre>
                        <button
                          onClick={() => handleCopy(dockerComposeCode, 'docker')}
                          className="absolute top-3 right-3 p-1.5 bg-white/10 rounded-sm text-neutral-400 hover:text-white transition cursor-pointer"
                          title="Скопировать yaml"
                        >
                          {copiedDocker ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      case 'text':
        return (
          <section key={block.id} className={`px-6 py-16 max-w-3xl mx-auto ${p.align === 'center' ? 'text-center' : 'text-left'}`}>
            {p.title && <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white mb-6">{p.title}</h2>}
            <div className="space-y-4 text-neutral-300 text-base leading-relaxed font-sans">
              {(p.body ?? '').split(/\n{2,}/).filter(Boolean).map((para, i) => (
                <p key={i} className="whitespace-pre-line">{para}</p>
              ))}
            </div>
          </section>
        );
      case 'cta': {
        const url = sanitizeUrl(p.buttonUrl) || '/dashboard';
        const isDashboard = url === '/dashboard';
        const btnCls = 'inline-flex items-center gap-2 px-8 py-4 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic hover:bg-[#00d0e0] hover:shadow-[0_0_35px_rgba(0,242,255,0.4)] rounded-sm transition-all duration-300 cursor-pointer font-mono';
        return (
          <section key={block.id} className="px-6 py-16 max-w-4xl mx-auto">
            <div className="rounded-sm border border-[#00f2ff]/20 bg-[#00f2ff]/[0.04] p-10 text-center">
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white mb-3">{p.title}</h2>
              {p.text && <p className="text-neutral-400 text-sm mb-8 max-w-xl mx-auto font-sans">{p.text}</p>}
              {isDashboard ? (
                <button onClick={onNavigateToDashboard} className={btnCls}>{p.buttonLabel}<ArrowRight className="w-4 h-4" /></button>
              ) : (
                <a href={url} className={btnCls} {...(/^https?:/.test(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{p.buttonLabel}<ArrowRight className="w-4 h-4" /></a>
              )}
            </div>
          </section>
        );
      }
      case 'faq':
        return (
          <section key={block.id} className="px-6 py-16 max-w-3xl mx-auto">
            {p.title && <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white mb-8 text-center">{p.title}</h2>}
            <div className="space-y-3">
              {(p.faq ?? []).map((item, i) => (
                <details key={i} className="group rounded-sm border border-white/10 bg-[#0c0c0c] open:border-[#00f2ff]/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-white">
                    {item.q}
                    <ChevronDown className="w-4 h-4 shrink-0 text-[#00f2ff] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-sm text-neutral-400 leading-relaxed font-sans whitespace-pre-line">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const enabledBlocks = layout.blocks.filter((b) => b.enabled);
  const firstContent = enabledBlocks.findIndex((b) => b.type !== 'announcement');
  const topAnnouncements = enabledBlocks.slice(0, firstContent === -1 ? enabledBlocks.length : firstContent);
  const mainBlocks = enabledBlocks.slice(topAnnouncements.length);

  return (
    <div className="min-h-screen w-full max-w-[100vw] bg-[#050505] text-white selection:bg-[#00f2ff] selection:text-black antialiased font-sans flex flex-col justify-between overflow-x-hidden relative">
      {/* Absolute Glow Backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#00f2ff]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-[#00f2ff]/3 rounded-full blur-[140px] pointer-events-none" />
      </div>

      {platformConfig?.maintenanceMode && (
        <div className="relative z-[60] border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-100 font-sans flex items-center justify-center gap-2" role="status">
          <Wrench className="w-4 h-4" />
          <span>{platformConfig.maintenanceMessage || 'Идут технические работы.'}</span>
        </div>
      )}
      {topAnnouncements.map(renderAnnouncement)}

      {/* Navigation Header */}
      <header className="border-b border-white/10 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-4 sm:py-6 font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center space-x-3 cursor-pointer select-none min-w-0 shrink" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 bg-[#00f2ff] rounded-sm flex items-center justify-center shrink-0">
              <span className="text-black font-black text-xl">C</span>
            </div>
            <div className="min-w-0">
              <span className="font-black text-2xl sm:text-3xl tracking-tighter uppercase italic text-white block leading-none">
                {settings.siteName}
              </span>
              <span className="text-[9px] block text-[#00f2ff] font-mono tracking-widest uppercase mt-0.5 font-bold truncate">
                {settings.tagline}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <a
              href="#installer"
              className="hidden md:block text-xs font-black tracking-widest uppercase text-neutral-400 hover:text-[#00f2ff] transition"
            >
              [ ИНСТРУКЦИЯ СЕЛФХОСТА ]
            </a>
            {showGithub && settings.showHeaderGithub && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="header_github_link"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 border border-white/15 hover:border-[#00f2ff]/60 text-neutral-300 hover:text-[#00f2ff] rounded-sm text-[11px] font-black tracking-widest uppercase transition whitespace-nowrap"
              title="Открыть репозиторий на GitHub"
            >
              <SocialIcon platform="github" className="w-4 h-4" />
              <span>GitHub</span>
              {ghData && (
                <span className="inline-flex items-center gap-1 text-neutral-400 normal-case tracking-normal font-mono" aria-label={`Звёзд: ${ghData.repo.stars}`}>
                  <Star className="w-3 h-3 fill-current" />
                  {compactNumber(ghData.repo.stars)}
                </span>
              )}
            </a>
            )}
            <button
              onClick={onNavigateToDashboard}
              id="header_dashboard_btn"
              className="px-3 sm:px-6 py-2.5 sm:py-3 bg-[#00f2ff] text-black font-black text-[10px] sm:text-xs tracking-widest uppercase italic hover:bg-[#00d0e0] hover:shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all duration-300 flex items-center space-x-2 rounded-sm cursor-pointer whitespace-nowrap"
            >
              <span className="sm:hidden">СОЗДАТЬ БИО</span>
              <span className="hidden sm:inline">СОЗДАТЬ БИО (БЕСПЛАТНО)</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {mainBlocks.map(renderBlock)}
      </main>

      <footer className="bg-[#0c0c0c] border-t border-white/10 p-10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-left font-mono">
        <div className="flex flex-col gap-3">
          {settings.showFooterInstall ? (
            <>
              <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] italic">Скрипт установки</div>
              <div className="bg-black border border-white/10 px-5 py-3.5 rounded-sm flex items-center gap-4 font-mono text-xs text-neutral-300 max-w-[calc(100vw-2rem)] overflow-x-auto">
                <span className="text-[#00f2ff] font-bold shrink-0">$</span>
                <span className="font-mono break-all">{installScriptCmd}</span>
              </div>
            </>
          ) : (
            settings.footerNote && <p className="max-w-md text-xs text-neutral-400 font-sans normal-case tracking-normal">{settings.footerNote}</p>
          )}
          {settings.showFooterInstall && settings.footerNote && <p className="max-w-md text-xs text-neutral-400 font-sans normal-case tracking-normal">{settings.footerNote}</p>}
        </div>
        <div className="flex flex-col items-center md:items-end gap-4">
          <SocialRow githubUrl={showGithub ? repoUrl : undefined} socials={platformConfig?.socials} />
          <div className="flex flex-wrap justify-center md:justify-end gap-x-4 gap-y-1 text-xs font-black tracking-widest">
            {/* версия берётся из GitHub (последний релиз или коммит), а не придумывается */}
            {ghData?.latestRelease && isVersionTag(ghData.latestRelease.tag) ? (
              <a href={ghData.latestRelease.url} target="_blank" rel="noopener noreferrer" className="text-[#00f2ff] hover:underline">
                {ghData.latestRelease.tag}
              </a>
            ) : ghData?.recentCommits[0] ? (
              <a href={ghData.recentCommits[0].url} target="_blank" rel="noopener noreferrer" className="text-[#00f2ff] hover:underline" title={ghData.recentCommits[0].message}>
                {ghData.repo.defaultBranch}@{ghData.recentCommits[0].sha}
              </a>
            ) : null}
            {showGithub ? (
              <a href={`${repoUrl}/blob/${ghData?.repo.defaultBranch ?? 'main'}/LICENSE`} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 text-white">
                OPEN SOURCE {ghData?.repo.license || 'MIT'}
              </a>
            ) : (
              <span className="opacity-60 text-white">OPEN SOURCE</span>
            )}
          </div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest font-mono flex flex-wrap items-center gap-2 justify-center md:justify-end">
            {showGithub && (
              <>
                <a href={`${repoUrl}/issues`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-[#00f2ff] transition">ISSUES</a>
                <span>•</span>
                <a href={`${repoUrl}/blob/${ghData?.repo.defaultBranch ?? 'main'}/SECURITY.md`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-[#00f2ff] transition">БЕЗОПАСНОСТЬ</a>
                <span>•</span>
              </>
            )}
            <span>ПАНЕЛЬ УПРАВЛЕНИЯ В КОМПЛЕКТЕ</span>
            {!platformConfig?.hideAdminPanelLink && (
              <>
                <span>•</span>
                <a href="/admin" className="text-neutral-400 hover:text-[#00f2ff] underline transition">АДМИН-ПАНЕЛЬ</a>
              </>
            )}
            <span>•</span>
            <span>ПОДДЕРЖКА DOCKER ВКЛЮЧЕНА</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
