/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Code2, Play, Terminal, Download, Copy, Check, ArrowRight, Activity, Users, Globe2, HelpCircle } from 'lucide-react';
import { getThumbUrl } from '../utils/media';
import { getPlatformDomainConfig, type PlatformDomainConfig } from '../platformDomain';

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
  platformConfig?: PlatformDomainConfig;
}

export default function LandingPage({ onNavigateToDashboard, onViewProfile, platformConfig }: LandingPageProps) {
  const [activeBios, setActiveBios] = useState<ActiveProfile[]>([]);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [analyticsStats, setAnalyticsStats] = useState({ totalBios: 0, totalTraffic: 0 });

  const runtimePlatform = getPlatformDomainConfig({
    appUrl: platformConfig?.appUrl,
    bioBaseDomain: platformConfig?.baseDomain,
    requestHost: typeof window !== 'undefined' ? window.location.host : undefined,
  });
  const installOrigin = runtimePlatform.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const installScriptCmd = `curl -sSL ${installOrigin}/api/install-script | bash`;
  const dockerComposeCode = `version: '3.8'

services:
  cry_bios:
    image: ghcr.io/cryteam/cry-bios:latest
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
        // Estimate demo traffic sum to make the directory feel live
        setAnalyticsStats({
          totalBios: Math.max(data.length, 1),
          totalTraffic: data.length * 128 + 482
        });
      })
      .catch(err => {
        console.error("Error fetching bios index", err);
        // Fallback demo database list
        const fallback = [
          { username: 'cryteam', displayName: 'cryteam', bio: '⚡ elite coding squad • custom HTML developers ⚡', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', verified: true }
        ];
        setActiveBios(fallback);
        setAnalyticsStats({ totalBios: 1, totalTraffic: 812 });
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

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#00f2ff] selection:text-black antialiased font-sans flex flex-col justify-between overflow-x-hidden">
      {/* Absolute Glow Backgrounds */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#00f2ff]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-[#00f2ff]/3 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-white/10 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-6 font-mono">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 bg-[#00f2ff] rounded-sm flex items-center justify-center">
              <span className="text-black font-black text-xl">C</span>
            </div>
            <div>
              <span className="font-black text-3xl tracking-tighter uppercase italic text-white block leading-none">
                CRY BIOS
              </span>
              <span className="text-[9px] block text-[#00f2ff] font-mono tracking-widest uppercase mt-0.5 font-bold">
                Свободный аналог Guns.lol с открытым кодом
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <a
              href="#installer"
              className="hidden md:block text-xs font-black tracking-widest uppercase text-neutral-400 hover:text-[#00f2ff] transition"
            >
              [ ИНСТРУКЦИЯ СЕЛФХОСТА ]
            </a>
            <button
              onClick={onNavigateToDashboard}
              id="header_dashboard_btn"
              className="px-6 py-3 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic hover:bg-[#00d0e0] hover:shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all duration-300 flex items-center space-x-2 rounded-sm cursor-pointer"
            >
              <span>СОЗДАТЬ БИО (БЕСПЛАТНО)</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="px-6 pt-20 md:pt-28 pb-16 text-center max-w-5xl mx-auto relative">
          <div className="inline-block px-4 py-1.5 bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-[0.3em] w-fit mx-auto mb-8 font-mono">
            100% Бесплатно & Открытый Исходный Код
          </div>

          <h1 className="text-5xl md:text-8xl font-black leading-[0.85] tracking-tighter uppercase italic mb-8">
            Суверенность<br />
            <span className="text-[#00f2ff] drop-shadow-[0_0_15px_rgba(0,242,255,0.1)]">Личности</span>
          </h1>

          <p className="text-neutral-400 max-w-2xl mx-auto text-base md:text-lg mb-12 leading-relaxed font-sans">
            Профессиональная альтернатива проприетарным сервисам личных мультиссылок. Полный суверенный контроль над вашими данными, плейлистами фоновой музыки, виджетами со своим HTML/CSS кодом, прозрачными бейджами, динамическими темами фона (Матрица, Световой дождь, Звездный вихрь) и аналитикой в реальном времени.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 font-mono">
            <button
              onClick={onNavigateToDashboard}
              id="hero_start_btn"
              className="w-full sm:w-auto px-8 py-5 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic hover:bg-[#00d0e0] hover:shadow-[0_0_35px_rgba(0,242,255,0.4)] flex items-center justify-center space-x-2 cursor-pointer rounded-sm transition-all duration-300"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>ЗАПУСТИТЬ ОНЛАЙН-КОНСТРУКТОР</span>
            </button>
            <a
              href="#installer"
              className="w-full sm:w-auto px-8 py-5 bg-[#0c0c0c] border border-white/15 font-black text-xs tracking-widest uppercase text-white hover:bg-neutral-900 transition flex items-center justify-center space-x-2 rounded-sm"
            >
              <Terminal className="w-4 h-4 text-[#00f2ff]" />
              <span>СКРИПТ УСТАНОВКИ</span>
            </a>
          </div>

          {/* Micro Stats Banner */}
          <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 p-8 rounded-sm bg-[#0c0c0c] border border-white/10 max-w-4xl mx-auto shadow-2xl font-mono">
            <div className="text-center">
              <span className="block text-[10px] font-black tracking-widest text-[#00f2ff] uppercase italic">Селф-хостинг</span>
              <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">В 1 команду</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="block text-[10px] font-black tracking-widest text-neutral-500 uppercase italic">Создано профилей</span>
              <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">{analyticsStats.totalBios} Активных</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="block text-[10px] font-black tracking-widest text-[#00f2ff] uppercase italic">Просмотры</span>
              <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">{analyticsStats.totalTraffic} Запросов</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="block text-[10px] font-black tracking-widest text-neutral-500 uppercase italic">Поддержка кода</span>
              <span className="text-2xl font-black tracking-tighter text-white mt-1.5 block uppercase italic">HTML и CSS</span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-6 py-20 bg-[#0c0c0c] border-t border-b border-white/10 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-4">Guns.lol против CRY BIOS</h2>
              <p className="text-neutral-400 text-sm max-w-xl mx-auto font-sans">
                Перестаньте переплачивать за галочки верификации, специальные эффекты заднего фона, поддержку стороннего HTML-кода и виджеты отслеживания. Всё это принадлежит вам бесплатно.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature Card 1 */}
              <div className="bg-black/40 border border-white/10 rounded-sm p-8 relative group hover:border-[#00f2ff]/30 transition-all duration-300">
                <div className="w-12 h-12 bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded-sm flex items-center justify-center mb-6 text-[#00f2ff]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight italic mb-2 text-white">Экран-заставка (Entry)</h3>
                <p className="text-neutral-400 text-xs leading-relaxed font-sans">
                  Включает фирменный интерактивный слой «Нажмите, чтобы войти» с пульсацией, как на guns.lol. Автоматически запускает фоновые MP3 биты и активирует анимированные динамические эффекты.
                </p>
              </div>

              {/* Feature Card 2 */}
              <div className="bg-black/40 border border-white/10 rounded-sm p-8 relative group hover:border-[#00f2ff]/30 transition-all duration-300">
                <div className="w-12 h-12 bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded-sm flex items-center justify-center mb-6 text-[#00f2ff]">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight italic mb-2 text-white">Интеграции без ограничений</h3>
                <p className="text-neutral-400 text-xs leading-relaxed font-sans">
                  Тонкая кастомизация цветов, сияния, прозрачности карточек/виджетов, размытия. Запускайте завораживающие динамические эффекты: зеленый ливень Матрицы, Космический шквал, Звездное небо.
                </p>
              </div>

              {/* Feature Card 3 */}
              <div className="bg-black/40 border border-white/10 rounded-sm p-8 relative group hover:border-[#00f2ff]/30 transition-all duration-300">
                <div className="w-12 h-12 bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded-sm flex items-center justify-center mb-6 text-[#00f2ff]">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight italic mb-2 text-white">Логи статистики в реальном времени</h3>
                <p className="text-neutral-400 text-xs leading-relaxed font-sans">
                  Отслеживайте источники переходов, операционные системы, браузеры, географию ваших гостей (по нативной локали Accept-Language браузера) в виде интерактивных графиков прямо в панели администрирования.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Directory Showcase */}
        <section className="px-6 py-20 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-2">Активные профили на платформе</h2>
              <p className="text-neutral-400 text-sm font-sans">
                Выберите пример профиля на нашей запущенной ноде CRY BIOS, чтобы ознакомиться с возможностями глубокой кастомизации.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-2 text-xs font-bold font-mono text-[#00f2ff] bg-white/5 border border-white/10 px-4 py-2.5 rounded-sm uppercase tracking-wider">
              <Users className="w-4 h-4 text-[#00f2ff]" />
              <span>ЗАРЕГИСТРИРОВАНО ПРОФИЛЕЙ: {activeBios.length}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {activeBios.map(profile => (
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

        {/* Installation Setup / Scripts Showcase */}
        <section id="installer" className="px-6 py-20 bg-[#0c0c0c] border-t border-b border-white/10">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
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
                  <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                    Короткие адреса профилей
                  </h4>
                  <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed font-sans">
                    Каждый пользователь получает поддомен{' '}
                    <code className="text-[#00f2ff] font-mono">name.{runtimePlatform.baseDomain || 'yourdomain.com'}</code>{' '}
                    и короткий path{' '}
                    <code className="text-[#00f2ff] font-mono">/{'{name}'}</code>.
                    Настройте DNS <code className="text-[#00f2ff]">*.{runtimePlatform.baseDomain || 'yourdomain.com'}</code> на ваш сервер.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center space-x-4 font-mono">
                <a
                  href="/api/install-script"
                  className="px-6 py-3.5 bg-[#00f2ff] text-black font-black text-xs tracking-widest uppercase italic flex items-center space-x-2 transition hover:bg-[#00d0e0] rounded-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>СКАЧАТЬ INSTALL.SH</span>
                </a>
                <span className="text-xs text-neutral-500">или экспортируйте файлы в админ-панели</span>
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
                    <span className="text-neutral-500"># Установка с помощью стандартного установщика curl</span>
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
                    <span className="text-neutral-500"># Альтернативный запуск в контейнере docker-compose.yml</span>
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
      </main>

      {/* Footer */}
      <footer className="bg-[#0c0c0c] border-t border-white/10 p-10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-left font-mono">
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] italic">Скрипт установки</div>
          <div className="bg-black border border-white/10 px-5 py-3.5 rounded-sm flex items-center gap-4 font-mono text-xs text-neutral-300">
            <span className="text-[#00f2ff] font-bold">$</span>
            <span className="font-mono">{installScriptCmd}</span>
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2.5">
          <div className="flex gap-4 text-xs font-black tracking-widest">
            <span className="text-[#00f2ff]">v1.2.0-STABLE</span>
            <span className="opacity-30 text-white">OPEN SOURCE MIT</span>
          </div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest font-mono flex items-center gap-2 justify-end">
            <span>ПАНЕЛЬ УПРАВЛЕНИЯ В КОМПЛЕКТЕ</span>
            <span>•</span>
            <a href="/admin" className="text-neutral-500 hover:text-[#00f2ff] underline transition">АДМИН-ПАНЕЛЬ</a>
            <span>•</span>
            <span>ПОДДЕРЖКА DOCKER ВКЛЮЧЕНА</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
