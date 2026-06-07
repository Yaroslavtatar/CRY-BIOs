/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BioConfig, BlockConfig, SocialLink, AnalyticsSummary, BackgroundType, UserBadge } from '../types';
import AnalyticsView from './AnalyticsView';
import BioPage from './BioPage';
import { Save, LogOut, Layout, Play, Activity, Music, Sparkles, Monitor, Code, Settings, Plus, Trash2, Check, User, Lock, ExternalLink, Globe2, AlertTriangle, FileJson, ArrowLeft, ArrowUp, ArrowDown, Image, Video, Layers, Sliders, Crown, Shield, Gem, Award, Star, Heart, Zap, Code2, Skull, Gamepad2, Coffee, Terminal, CheckCircle2, Flame, Upload } from 'lucide-react';

const renderDashboardBadgeIcon = (iconName: string) => {
  const iconProps = { className: "w-3.5 h-3.5 flex-shrink-0" };
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
    case 'flame': return <Sparkles className="w-3.5 h-3.5 text-[#00f2ff] flex-shrink-0" />;
    case 'skull': return <Skull {...iconProps} />;
    case 'gamepad': return <Gamepad2 {...iconProps} />;
    case 'music': return <Music {...iconProps} />;
    case 'terminal': return <Terminal {...iconProps} />;
    case 'coffee': return <Coffee {...iconProps} />;
    case 'discord':
      return (
        <svg viewBox="0 0 127.14 96.36" className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.22,123.46,27.42,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
        </svg>
      );
    default:
      return <Sparkles {...iconProps} />;
  }
};

interface DashboardProps {
  onExit: () => void;
  onViewProfile: (username: string) => void;
}

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #09070f 0%, #151121 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
  'linear-gradient(45deg, #ff0055 0%, #00ffcc 100%)',
  'linear-gradient(to right, #09203f 0%, #537895 100%)',
  'linear-gradient(to right, #111827, #030712)'
];

export default function Dashboard({ onExit, onViewProfile }: DashboardProps) {
  // Authentication States
  const [username, setUsername] = useState(localStorage.getItem('biogun_username') || '');
  const [token, setToken] = useState(localStorage.getItem('biogun_token') || '');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile configuration states
  const [config, setConfig] = useState<BioConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'layout' | 'background' | 'visuals' | 'audio' | 'blocks' | 'analytics' | 'selfhost'>('overview');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // Interactive connection widgets & Premium Upgrade states
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);

  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [discordInput, setDiscordInput] = useState('');
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleInput, setGoogleInput] = useState('');
  
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'avatarUrl' | 'bgValue' | 'audioUrl' | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('biogun_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) throw new Error('File too large. Maximum size is ~1MB (Server Limit).');
        throw new Error('Upload failed');
      }
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Server returned invalid data format: ' + text.slice(0, 30));
      }

      updateConfigValue(uploadTarget, data.url);
      
      // Auto-switch types for backgrounds if necessary
      if (uploadTarget === 'bgValue') {
        const type = data.url.match(/\.(mp4|webm|ogv)$/i) ? 'video' : 'image';
        updateConfigValue('bgType', type);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error uploading file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadTarget(null);
    }
  };

  // Guns.lol direct importer states
  const [importGunsUsername, setImportGunsUsername] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importMethod, setImportMethod] = useState<'api' | 'html'>('api');

  // Checks and loads active sessions
  useEffect(() => {
    if (token && username) {
      // Validate session
      fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then(() => {
          loadBioConfig(username);
          loadAnalytics(username);
        })
        .catch(() => {
          // expired
          handleLogout();
        });
    }
  }, [token, username]);

  // Load config on command
  const loadBioConfig = (uname: string) => {
    fetch(`/api/bio/${uname}`)
      .then(async res => {
         if (!res.ok) {
           const errText = await res.text();
           throw new Error(`Load config failed: ${res.status} ${errText}`);
         }
         return res.json();
      })
      .then((data: BioConfig) => {
        setConfig(data);
      })
      .catch(err => console.error("Error drawing config", err));
  };

  // Load analytics logs
  const loadAnalytics = (uname: string) => {
    fetch(`/api/bio/${uname}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: AnalyticsSummary) => {
        if (data) setAnalytics(data);
      })
      .catch(err => console.error("Analytics fetch error", err));
  };

  // Parses guns.lol profile HTML client-side for 100% reliable bypass of scrapes
  const parseGunsLolHtml = (htmlContent: string) => {
    // 1. Try to search Next.js hydration embedded JSON segment
    let parsedConfig: any = null;

    // Search for configuration block in script tags or self.__next_f hydration blocks
    const configBlockRegex = /"config"\s*:\s*(\{.+?\})(?:,\s*"premium"|"success"|\}\s*\}\s*\]|,\s*"verified")/g;
    let blockMatch;
    while ((blockMatch = configBlockRegex.exec(htmlContent)) !== null) {
      try {
        let jsonStr = blockMatch[1];
        if (jsonStr.includes('\\"')) {
          jsonStr = jsonStr.replace(/\\"/g, '"');
        }
        const attempt = JSON.parse(jsonStr);
        if (attempt && (attempt.avatar || attempt.bg_color || attempt.socials || attempt.display_name)) {
          parsedConfig = attempt;
          break;
        }
      } catch (e) {
        // seek next match
      }
    }

    if (!parsedConfig) {
      const dataRegex = /\{"data"\s*:\s*(\{.+?\})(?:\s*\}\s*\])/g;
      let dataMatch;
      while ((dataMatch = dataRegex.exec(htmlContent)) !== null) {
        try {
          let cleanText = dataMatch[0];
          cleanText = cleanText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const parsedData = JSON.parse(cleanText);
          if (parsedData && parsedData.data && parsedData.data.config) {
            parsedConfig = parsedData.data.config;
            break;
          }
        } catch (e) {
          // continue
        }
      }
    }

    // 2. Permissive backup regex scanners for keyvalues
    const getValueByRegex = (regex: RegExp, def = '') => {
      const m = htmlContent.match(regex);
      return m ? m[1].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16))) : def;
    };

    // Displays
    let displayName = getValueByRegex(/"display_name"\s*:\s*"([^"]+)"/) || 
                      getValueByRegex(/<title>([^<]+)<\/title>/).replace(/\s*\|.*?$/, '').replace(/\s*guns\.lol\s*$/, '').replace('@', '').trim();

    // Bio Text description
    let bio = getValueByRegex(/"description"\s*:\s*"([^"]*)"/) || '';
    if (!bio) {
      const metaDesc = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || 
                       htmlContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (metaDesc && metaDesc[1]) {
        bio = metaDesc[1].trim();
      }
    }

    // Image Avatar URL 
    let avatarUrl = getValueByRegex(/"avatar"\s*:\s*"([^"]+)"/) ||
                     getValueByRegex(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/);

    if (!avatarUrl) {
      const imgMatch = htmlContent.match(/<img[^>]+src=["'](https:\/\/images\.guns\.lol\/[^"']+)["']/i) ||
                        htmlContent.match(/<img[^>]+src=["'](https:\/\/r2\.guns\.lol\/[^"']+)["']/i);
      if (imgMatch) avatarUrl = imgMatch[1];
    }

    // Video / Image 배경 
    let bgValue = getValueByRegex(/"url"\s*:\s*"([^"]+\.(?:mp4|webm|gif|png|jpg|jpeg)[^"]*)"/) || 
                  getValueByRegex(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
    let bgType: 'video' | 'image' | 'stars' | 'rain' | 'color' = 'stars';
    
    if (bgValue && (bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('/7a64a911-d951-49b6-bfe9-d7c07a9d8c1a'))) {
      bgType = 'video';
    } else if (bgValue && (bgValue.endsWith('.gif') || bgValue.includes('.gif') || bgValue.includes('r2.guns.lol'))) {
      bgType = 'image';
    }

    // Default template fallbacks as parsed from direct HTML
    if (!bgValue) {
      const iframeMatches = htmlContent.match(/background-image\s*:\s*url\(([^)]+)\)/);
      if (iframeMatches) {
        bgType = 'image';
        bgValue = iframeMatches[1].replace(/['"]/g, '');
      }
    }

    // Extracted custom items
    let customCursor = getValueByRegex(/"custom_cursor"\s*:\s*"([^"]+)"/) ||
                       getValueByRegex(/cursor\s*:\s*url\(([^)]+)\)/);
    if (customCursor) {
      customCursor = customCursor.replace(/['"]/g, '').split(' ')[0];
    }

    let backgroundEffects = getValueByRegex(/"background_effects"\s*:\s*"([^"]+)"/) || 'rain';
    let blurVal = parseInt(getValueByRegex(/"blur"\s*:\s*([0-9]+)/) || '2');
    let opacityVal = parseFloat(getValueByRegex(/"opacity"\s*:\s*([0-9\.]+)/) || '0.05') * 100;

    // Soundtrack track audio URL
    let audioUrl = getValueByRegex(/"url"\s*:\s*"([^"]+\.mp3[^"]*)"/) || '';
    if (!audioUrl) {
      const audioMatch = htmlContent.match(/"audio"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
      if (audioMatch) audioUrl = audioMatch[1];
    }
    if (!audioUrl) {
      const rawMp3Match = htmlContent.match(/(https?:\/\/[^\s"'<>]+\.mp3[^\s"'<>]*)/i);
      if (rawMp3Match) audioUrl = rawMp3Match[0];
    }

    // Social Links
    let socialsList: any[] = [];
    const socialsBlockMatch = htmlContent.match(/"socials"\s*:\s*\[([\s\S]+?)\]/);
    if (socialsBlockMatch) {
      const rawSocials = socialsBlockMatch[1];
      const itemRegex = /\{\s*"social"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = itemRegex.exec(rawSocials)) !== null) {
        const platform = m[1].toLowerCase();
        let val = m[2];
        if (val) {
          let url = val;
          if (!url.startsWith('http')) {
            if (platform === 'discord') url = `https://discord.com/users/${val}`;
            else if (platform === 'telegram') url = `https://t.me/${val}`;
            else if (platform === 'github') url = `https://github.com/${val}`;
            else url = `https://${val}`;
          }
          socialsList.push({
            id: `soc-${Math.random().toString(36).substr(2, 5)}`,
            platform: platform === 'custom_url' ? 'website' : platform as any,
            url,
            label: platform
          });
        }
      }
    }

    if (socialsList.length === 0) {
      const anchors = htmlContent.match(/href="([^"]+)"/g);
      if (anchors) {
        const platforms = {
          discord: ['discord.gg', 'discord.com'],
          telegram: ['t.me', 'telegram.me'],
          github: ['github.com'],
          youtube: ['youtube.com', 'youtu.be'],
          instagram: ['instagram.com'],
          tiktok: ['tiktok.com'],
          twitter: ['twitter.com', 'x.com']
        };
        anchors.forEach((anc) => {
          const href = anc.replace('href="', '').replace('"', '');
          Object.entries(platforms).forEach(([platform, urls]) => {
            if (urls.some(u => href.includes(u))) {
              if (!socialsList.some(s => s.platform === platform)) {
                socialsList.push({
                  id: `soc-${Math.random().toString(36).substr(2, 5)}`,
                  platform,
                  url: href,
                  label: `${platform} Link`
                });
              }
            }
          });
        });
      }
    }

    // Apply JSON configurations over any backup parsed elements if Next.js hydrated block found
    if (parsedConfig) {
      displayName = parsedConfig.display_name || displayName;
      bio = parsedConfig.description || bio;
      avatarUrl = parsedConfig.avatar || avatarUrl;
      
      if (parsedConfig.url) {
        bgValue = parsedConfig.url;
        if (bgValue.endsWith('.mp4') || bgValue.includes('.mp4') || bgValue.includes('7a64a911')) {
          bgType = 'video';
        } else {
          bgType = 'image';
        }
      }
      
      customCursor = parsedConfig.custom_cursor || customCursor;
      backgroundEffects = parsedConfig.background_effects || backgroundEffects;
      if (parsedConfig.blur !== undefined) blurVal = parsedConfig.blur;
      if (parsedConfig.opacity !== undefined) opacityVal = parsedConfig.opacity * 100;
      
      if (parsedConfig.audio && Array.isArray(parsedConfig.audio) && parsedConfig.audio.length > 0) {
        const sel = parsedConfig.audio.find((a: any) => a.selected) || parsedConfig.audio[0];
        audioUrl = sel.url || audioUrl;
      }

      if (parsedConfig.socials && Array.isArray(parsedConfig.socials)) {
        socialsList = parsedConfig.socials.map((s: any) => {
          let url = s.value;
          const platform = s.social === 'custom_url' ? 'website' : s.social;
          if (!url.startsWith('http')) {
            if (platform === 'discord') url = `https://discord.com/users/${url}`;
            else if (platform === 'telegram') url = `https://t.me/${url}`;
            else if (platform === 'github') url = `https://github.com/${url}`;
          }
          return {
            id: s.id || `soc-${Math.random().toString(36).substr(2, 5)}`,
            platform,
            url,
            label: s.social
          };
        });
      }
    }

    return {
      displayName: displayName || 'Guns.lol Profile',
      bio: bio || 'Transferred using Open-Source copy paste engine.',
      avatarUrl: avatarUrl || '',
      bgType,
      bgValue: bgValue || '#0c0c0e',
      audioUrl,
      customCursorUrl: customCursor || '',
      snowEffectsEnabled: backgroundEffects === 'rain' || backgroundEffects === 'snow' || backgroundEffects === 'rain_snow',
      bgBlur: blurVal,
      cardOpacity: opacityVal,
      socialsList
    };
  };

  // Handler to migrate/import configurations of user
  const handleImportFromGunsLol = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');

    if (!config) return;

    if (importMethod === 'html') {
      if (!pastedHtml.trim()) {
        setImportError('Пожалуйста, вставьте исходный HTML вашей страницы (Ctrl+U на guns.lol, скопируйте всё и вставьте сюда).');
        return;
      }
      try {
        setImportLoading(true);
        const parsed = parseGunsLolHtml(pastedHtml);

        const updatedConfig = {
          ...config,
          displayName: parsed.displayName,
          bio: parsed.bio,
          avatarUrl: parsed.avatarUrl || config.avatarUrl,
          bgType: parsed.bgType as any,
          bgValue: parsed.bgValue,
          audioUrl: parsed.audioUrl || config.audioUrl,
          audioEnabled: !!parsed.audioUrl,
          audioTitle: parsed.displayName + ' Soundtrack',
          audioArtist: 'GunsLol Importer',
          customCursorUrl: parsed.customCursorUrl || config.customCursorUrl,
          snowEffectsEnabled: parsed.snowEffectsEnabled || config.snowEffectsEnabled,
          bgBlur: parsed.bgBlur !== undefined ? parsed.bgBlur : config.bgBlur,
          cardOpacity: parsed.cardOpacity !== undefined ? parsed.cardOpacity : config.cardOpacity,
          verified: true
        };

        if (parsed.socialsList.length > 0) {
          const blocksCopy = [...config.blocks];
          const existingSocialsIndex = blocksCopy.findIndex(b => b.type === 'socials');
          if (existingSocialsIndex !== -1) {
            blocksCopy[existingSocialsIndex] = {
              ...blocksCopy[existingSocialsIndex],
              socialsList: parsed.socialsList
            };
          } else {
            blocksCopy.push({
              id: 'imported-socs',
              type: 'socials',
              title: 'My Social networks',
              enabled: true,
              socialsList: parsed.socialsList
            });
          }
          updatedConfig.blocks = blocksCopy;
        }

        setConfig(updatedConfig);
        setImportSuccess('Профиль из HTML успешно скопирован! Все поля заполнены. Обязательно нажмите «Сохранить» в правом нижнем углу панели!');
        setPastedHtml('');
      } catch (err: any) {
        setImportError(`Ошибка импорта: ${err.message}`);
      } finally {
        setImportLoading(false);
      }
    } else {
      if (!importGunsUsername.trim()) {
        setImportError('Пожалуйста, введите имя вашего профиля guns.lol');
        return;
      }
      setImportLoading(true);
      fetch('/api/import-gunslol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: importGunsUsername })
      })
        .then(async res => {
          const text = await res.text();
          let body: any = {};
          try { body = JSON.parse(text); } catch (e) {}
          if (!res.ok) throw new Error(body.error || 'Не удалось связаться с сервером');
          return body;
        })
        .then(resData => {
          const parsed = resData.data;
          const updatedConfig = {
            ...config,
            displayName: parsed.displayName,
            bio: parsed.bio,
            avatarUrl: parsed.avatarUrl || config.avatarUrl,
            bgType: parsed.bgType,
            bgValue: parsed.bgValue,
            audioUrl: parsed.audioUrl || config.audioUrl,
            audioEnabled: !!parsed.audioUrl,
            audioTitle: parsed.displayName + ' Wave',
            audioArtist: 'Premium Imported Track',
            verified: true,
            badges: parsed.badges
          };

          if (parsed.socialsList.length > 0) {
            const blocksCopy = [...config.blocks];
            const existingSocialsIndex = blocksCopy.findIndex(b => b.type === 'socials');
            if (existingSocialsIndex !== -1) {
              blocksCopy[existingSocialsIndex] = {
                ...blocksCopy[existingSocialsIndex],
                socialsList: parsed.socialsList
              };
            } else {
              blocksCopy.push({
                id: 'imported-socs',
                type: 'socials',
                title: 'My Links networks',
                enabled: true,
                socialsList: parsed.socialsList
              });
            }
            updatedConfig.blocks = blocksCopy;
          }

          setConfig(updatedConfig);
          setImportSuccess('Профиль с guns.lol успешно перенесен! Спец-значки и бейджи добавлены. Обязательно нажмите «Сохранить» в правом нижнем углу панели!');
          setImportGunsUsername('');
        })
        .catch(err => {
          setImportError(err.message || 'Ошибка сервера. Попробуйте вкладку «Вручную через HTML» ниже!');
        })
        .finally(() => {
          setImportLoading(false);
        });
    }
  };

  const handleLoginRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setAuthError('Please enter username and passcode');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    fetch('/api/auth/login-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUsername, password: loginPassword })
    })
      .then(async res => {
        const text = await res.text();
        let body: any = {};
        try { body = JSON.parse(text); } catch (e) {}
        if (!res.ok) {
          throw new Error(body.error || 'Authing failed');
        }
        return body;
      })
      .then(data => {
        localStorage.setItem('biogun_token', data.token);
        localStorage.setItem('biogun_username', data.username);
        setToken(data.token);
        setUsername(data.username);
        
        loadBioConfig(data.username);
        loadAnalytics(data.username);
      })
      .catch(err => {
        setAuthError(err.message || 'Error executing request');
      })
      .finally(() => {
        setAuthLoading(false);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('biogun_token');
    localStorage.removeItem('biogun_username');
    setToken('');
    setUsername('');
    setConfig(null);
    setAnalytics(null);
  };

  // Profile configuration saves
  const handleSaveConfig = () => {
    if (!config) return;
    setSaveStatus('saving');
    
    fetch(`/api/bio/${username}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(config)
    })
      .then(res => {
        if (!res.ok) throw new Error('Save error');
        return res.json();
      })
      .then(() => {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2500);
      })
      .catch(err => {
        console.error("Save config error", err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      });
  };

  const handleRenameUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim()) {
      setRenameError('Please enter a new username slug');
      return;
    }
    setRenameError('');
    setRenameLoading(true);
    fetch('/api/auth/change-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ newUsername: renameInput })
    })
      .then(async res => {
        const text = await res.text();
        let body: any = {};
        try { body = JSON.parse(text); } catch (e) {}
        if (!res.ok) throw new Error(body.error || 'Failed to rename');
        return body;
      })
      .then(data => {
        setRenameSuccess(true);
        localStorage.setItem('biogun_username', data.username);
        
        setUsername(data.username);
        
        setTimeout(() => {
          setIsRenameModalOpen(false);
          setRenameSuccess(false);
          setRenameInput('');
          loadBioConfig(data.username);
          loadAnalytics(data.username);
        }, 1500);
      })
      .catch(err => {
        setRenameError(err.message || 'Error occurred during rename trigger');
      })
      .finally(() => {
        setRenameLoading(false);
      });
  };

  // Mutator functions for Nested forms
  const updateConfigValue = <K extends keyof BioConfig>(key: K, value: BioConfig[K]) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value
      };
    });
  };

  const handleFileLoadBase64 = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'bgValue' | 'avatarUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateConfigValue(fieldName, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleJSONExport = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cry_bios_override_${username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic blocks helpers
  const updateBlock = (blockId: string, updatedBlock: Partial<BlockConfig>) => {
    if (!config) return;
    const nextBlocks = config.blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, ...updatedBlock } as BlockConfig;
      }
      return b;
    });
    updateConfigValue('blocks', nextBlocks);
  };

  const handleMoveBlockUp = (index: number) => {
    if (!config || index <= 0) return;
    const nextBlocks = [...config.blocks];
    const temp = nextBlocks[index];
    nextBlocks[index] = nextBlocks[index - 1];
    nextBlocks[index - 1] = temp;
    updateConfigValue('blocks', nextBlocks);
  };

  const handleMoveBlockDown = (index: number) => {
    if (!config || index >= config.blocks.length - 1) return;
    const nextBlocks = [...config.blocks];
    const temp = nextBlocks[index];
    nextBlocks[index] = nextBlocks[index + 1];
    nextBlocks[index + 1] = temp;
    updateConfigValue('blocks', nextBlocks);
  };

  const handleAddBlock = (type: BlockConfig['type']) => {
    if (!config) return;
    
    let defaultDetails: Partial<BlockConfig> = { id: Math.random().toString(), type, enabled: true };
    if (type === 'socials') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Social networks',
        socialsList: [
          { id: Math.random().toString(), platform: 'discord', url: 'https://discord.gg/' }
        ]
      };
    } else if (type === 'html') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Custom code embed',
        htmlContent: '<div style="color: #00ffcc; text-align: center;">🔥 Custom coding layout sandbox active!</div>'
      };
    } else if (type === 'textbox') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Notice Board',
        textboxContent: 'Write some scrolling announcement or details here.',
        textboxStyle: 'standard'
      };
    } else if (type === 'quote') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Inspiring quotes',
        quoteText: 'Think open-source, write performant code.',
        quoteAuthor: 'GunsOpen'
      };
    } else if (type === 'status_api') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Status widget',
        statusCustomText: '🎮 Coding in Dark Mode',
        statusProvider: 'custom'
      };
    } else if (type === 'views_counter') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Page view stats monitor'
      };
    } else if (type === 'image') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Featured Image',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
        imageAlt: 'Abstract Design',
        imageHeight: 200,
        imageFit: 'cover'
      };
    } else if (type === 'embed') {
      defaultDetails = {
        ...defaultDetails,
        title: 'Custom Embed Media',
        embedType: 'youtube',
        embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      };
    }

    const nextBlocks = [...config.blocks, defaultDetails as BlockConfig];
    updateConfigValue('blocks', nextBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!config) return;
    const nextBlocks = config.blocks.filter(b => b.id !== blockId);
    updateConfigValue('blocks', nextBlocks);
  };

  const handleAddSocialLink = (blockId: string) => {
    if (!config) return;
    const block = config.blocks.find(b => b.id === blockId);
    if (!block || !block.socialsList) return;

    const newLink: SocialLink = {
      id: Math.random().toString(),
      platform: 'website',
      url: 'https://',
      label: 'My Custom Site',
      glow: false
    };

    updateBlock(blockId, { socialsList: [...block.socialsList, newLink] });
  };

  const handleUpdateSocialLink = (blockId: string, linkId: string, updatedLink: Partial<SocialLink>) => {
    if (!config) return;
    const block = config.blocks.find(b => b.id === blockId);
    if (!block || !block.socialsList) return;

    const nextLinks = block.socialsList.map(s => {
      if (s.id === linkId) return { ...s, ...updatedLink };
      return s;
    });

    updateBlock(blockId, { socialsList: nextLinks });
  };

  const handleDeleteSocialLink = (blockId: string, linkId: string) => {
    if (!config) return;
    const block = config.blocks.find(b => b.id === blockId);
    if (!block || !block.socialsList) return;

    const nextLinks = block.socialsList.filter(s => s.id !== linkId);
    updateBlock(blockId, { socialsList: nextLinks });
  };

  // --- RENDERS ---

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased flex flex-col">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
        accept={uploadTarget === 'audioUrl' ? 'audio/*' : 'image/*,video/*'}
      />
      {/* Header Panel */}
      <header className="border-b border-white/10 bg-[#050505] px-6 py-5 flex justify-between items-center z-20">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onExit}>
          <ArrowLeft className="w-5 h-5 text-neutral-400 hover:text-[#00f2ff] transition" />
          <div>
            <span className="font-black text-sm tracking-widest uppercase italic text-white">
              CRY BIOS CONTROL PANEL
            </span>
            <span className="text-[9px] block text-[#00f2ff] font-mono leading-none tracking-widest uppercase mt-0.5 font-bold">
              Management & Bio Editing
            </span>
          </div>
        </div>

        {token && username && (
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-xs font-mono text-neutral-400 hidden sm:inline-block">
              User: <strong className="text-[#00f2ff]">@{username}</strong>
            </span>
            <button
              onClick={() => onViewProfile(username)}
              className="px-3 py-2 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[10px] text-[#00f2ff] font-bold uppercase tracking-widest rounded-sm flex items-center space-x-1.5 cursor-pointer transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Перейти в свой био</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 hover:bg-red-500/10 hover:border-red-500/20 rounded-sm border border-white/10 text-neutral-400 hover:text-red-400 font-mono text-[10px] uppercase flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выйти из аккаунта</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Frame container */}
      <div className="flex-grow flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* LOGIN WIDGET CONTAINER */}
        {!token && (
          <div className="flex-grow flex items-center justify-center p-6 bg-[#050505] relative">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-[#00f2ff]/4 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="w-full max-w-md bg-[#0c0c0c] border border-white/10 p-8 rounded-sm shadow-2xl relative z-10">
              <div className="text-center mb-6">
                <span className="bg-[#00f2ff] rounded-sm p-3 inline-block text-black mb-4">
                  <User className="w-6 h-6 text-black" />
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">CRY BIOS PORTAL</h2>
                <p className="text-[10px] text-[#00f2ff] mt-1.5 uppercase tracking-[0.2em] font-mono font-bold">
                  Register or login instantly with a password
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-sm flex items-center space-x-2 text-xs text-red-300 font-mono mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLoginRegister} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1.5 tracking-wider font-bold">Username slug</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-neutral-600 font-bold">@</span>
                    <input
                      type="text"
                      placeholder="cryteam_dev"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff]/80 focus:outline-none p-3.5 pl-8 rounded-sm font-mono text-white placeholder-neutral-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1.5 tracking-wider font-bold">Control Passcode</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-neutral-600">🔑</span>
                    <input
                      type="password"
                      placeholder="Your secret passcode"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff]/80 focus:outline-none p-3.5 pl-8 rounded-sm font-mono text-white placeholder-neutral-700"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-sm bg-white/5 border border-white/10 text-[10px] text-neutral-400 leading-relaxed font-sans">
                  ⭐ <strong>Open Source Auto-Provision:</strong> If the username does not exist on this node database, a new creator bio page is generated instantly for you using this passphrase!
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#00f2ff] text-black font-black py-4 rounded-sm uppercase tracking-widest text-xs transition-all duration-300 hover:bg-[#00d0e0] flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                >
                  {authLoading ? (
                    <span className="w-4 h-4 border-2 border-t-black border-transparent animate-spin rounded-full" />
                  ) : (
                    <>
                      <span>Enter Panel / Create Page</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* WORKSPACE LOGGED IN PANEL */}
        {token && username && config && (
          <>
            {/* Left Sector: Accordion Workspace Options */}
            <div className="w-full lg:w-[50%] border-r border-white/10 flex flex-col justify-between overflow-y-auto bg-[#050505]">
              
              {/* Navigation Tabs Options */}
              <div className="p-4 border-b border-white/10 bg-[#0c0c0c] grid grid-cols-4 sm:grid-cols-3 gap-1.5 text-center text-[10px] font-mono whitespace-nowrap overflow-x-auto scrollbar-none">
                {(['overview', 'profile', 'layout', 'background', 'visuals', 'audio', 'blocks', 'analytics', 'selfhost'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`p-2 py-2.5 flex-1 rounded-sm transition font-black uppercase tracking-widest cursor-pointer text-[8px] sm:text-[9px] ${
                      activeTab === tab ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'bg-white/5 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab === 'selfhost' ? 'Host' : tab}
                  </button>
                ))}
              </div>

              {/* Accordion Panels Context */}
              <div className="p-6 flex-grow space-y-6">

                {/* 0. OVERVIEW SECTOR */}
                {activeTab === 'overview' && (() => {
                  const totalViews = analytics?.totalViews || 0;
                  const isCustomAvatar = config.avatarUrl && !config.avatarUrl.includes('api.dicebear.com/7.x/');
                  const isCustomBio = config.bio && config.bio !== 'Just another badass awesome creator page.' && config.bio.trim().length > 3;
                  const hasSocialsBlock = config.blocks.some(b => b.type === 'socials' && b.socialsList && b.socialsList.length > 0);
                  const isDiscordIntegrated = config.discordConnected === true;
                  const isTenViews = totalViews >= 10;

                  let checkedItems = 0;
                  if (isCustomAvatar) checkedItems++;
                  if (isCustomBio) checkedItems++;
                  if (isDiscordIntegrated) checkedItems++;
                  if (hasSocialsBlock) checkedItems++;
                  if (isTenViews) checkedItems++;
                  const completionPercentage = checkedItems * 20;

                  const handleCopyBioURL = () => {
                    const domain = window.location.origin;
                    navigator.clipboard.writeText(`${domain}/u/${username}`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  };

                  return (
                    <div className="space-y-6">
                      {/* Top Welcome Panel / Bio Link Banner */}
                      <div className="p-5 bg-white/5 border border-white/10 rounded-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2ff]/5 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center space-x-3">
                          <img
                            src={config.avatarUrl}
                            alt="avatar"
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover rounded-sm border border-white/15"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-white text-base">Welcome, @{username}!</span>
                              {config.verified && (
                                <span className="bg-[#00f2ff] text-black text-[8px] font-black px-1 rounded-sm uppercase tracking-widest italic" title="Verified Badge">
                                  ✓
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] block text-neutral-400 font-mono italic mt-0.5 uppercase tracking-wider">
                              UID #{config.uid || '731176'} • {config.customBadge || 'CREATOR'}
                            </span>
                          </div>
                        </div>

                        <div className="w-full sm:w-auto">
                          <span className="block text-[8px] uppercase text-neutral-500 font-bold mb-1 font-mono">Your short unique URL address</span>
                          <div className="flex items-center border border-white/10 bg-black/50 rounded-sm overflow-hidden select-all max-w-full">
                            <span className="px-2.5 py-1 text-[10px] text-neutral-400 font-mono break-all line-clamp-1">
                              /{username}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyBioURL}
                              className="px-3 py-1.5 bg-[#00f2ff] text-black text-[9px] uppercase font-black tracking-wider hover:bg-[#00d0e0] transition cursor-pointer flex-shrink-0"
                            >
                              {copiedLink ? 'Copied ✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Account Stats Grid (Обзор аккаунта) */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                          <span className="block text-[8px] uppercase font-bold text-neutral-500 font-mono leading-none">Имя пользователя</span>
                          <span className="text-base font-extrabold text-[#00f2ff] mt-2 block break-all font-mono">@{username}</span>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                          <span className="block text-[8px] uppercase font-bold text-neutral-500 font-mono leading-none">Использовано алиасов</span>
                          <span className="text-base font-extrabold text-white mt-2 block font-mono">
                            {config.aliasSlug ? '1 / 1 slot' : '0 / 1 slots'}
                          </span>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                          <span className="block text-[8px] uppercase font-bold text-neutral-500 font-mono leading-none">UID Индекс</span>
                          <span className="text-base font-extrabold text-purple-400 mt-2 block font-mono">#{config.uid || '731176'}</span>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                          <span className="block text-[8px] uppercase font-bold text-neutral-500 font-mono leading-none">Просмотры профиля</span>
                          <span className="text-base font-extrabold text-amber-400 mt-2 block font-mono">
                            {totalViews} hits
                          </span>
                        </div>
                      </div>

                      {/* --- GUNS.LOL MODERN PROFILE IMPORTER --- */}
                      <div className="p-5 bg-gradient-to-r from-purple-950/30 to-black border border-purple-500/20 rounded-sm relative overflow-hidden space-y-4">
                        <div className="absolute top-0 right-0 w-44 h-44 bg-[#00f2ff]/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex items-center space-x-2.5">
                          <span className="text-lg">📥</span>
                          <div>
                            <h4 className="text-[11px] font-black uppercase text-purple-400 font-mono tracking-widest leading-none">
                              Адаптивный Перенос Данных
                            </h4>
                            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider mt-1">
                              Копирование Вашего Профиля с Guns.lol
                            </h3>
                          </div>
                        </div>

                        <p className="text-[11px] leading-relaxed text-neutral-400 font-sans max-w-2xl">
                          Не хотите настраивать дизайн с нуля? Наша платформа умеет автоматически забирать ваше оформление, аватарку, БИО-описание, бейджи, фоны, ссылки и музыкальный плеер прямо со страницы guns.lol!
                        </p>

                        <div className="border border-white/5 bg-black/40 rounded-sm p-3.5 space-y-3 font-mono text-xs">
                          {/* Method selection */}
                          <div className="flex bg-black/40 p-1 rounded-sm border border-white/5 space-x-1 max-w-sm">
                            <button
                              type="button"
                              onClick={() => { setImportMethod('api'); setImportError(''); setImportSuccess(''); }}
                              className={`flex-1 py-1.5 text-[9px] uppercase tracking-wider font-extrabold rounded-sm transition ${
                                importMethod === 'api' ? 'bg-[#00f2ff] text-black font-black' : 'text-neutral-500 hover:text-white'
                              }`}
                            >
                              Быстрый импорт по нику
                            </button>
                            <button
                              type="button"
                              onClick={() => { setImportMethod('html'); setImportError(''); setImportSuccess(''); }}
                              className={`flex-1 py-1.5 text-[9px] uppercase tracking-wider font-extrabold rounded-sm transition ${
                                importMethod === 'html' ? 'bg-[#00f2ff] text-black font-black' : 'text-neutral-500 hover:text-white'
                              }`}
                            >
                              Вручную через HTML (100% безотказно)
                            </button>
                          </div>

                          <form onSubmit={handleImportFromGunsLol} className="space-y-3.5 pt-1">
                            {importMethod === 'api' ? (
                              <div className="space-y-1.5">
                                <label className="block text-[9px] text-neutral-500 uppercase font-black">Имя пользователя на guns.lol</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-grow">
                                    <span className="absolute left-3.5 top-3 text-neutral-600 font-bold">@</span>
                                    <input
                                      type="text"
                                      placeholder="Например: cryteam"
                                      value={importGunsUsername}
                                      onChange={e => setImportGunsUsername(e.target.value)}
                                      className="w-full bg-black/50 border border-white/10 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white pl-8 outline-none font-semibold font-mono placeholder-neutral-700"
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={importLoading}
                                    className="px-5 bg-[#00f2ff] text-black font-black text-[10px] uppercase tracking-wider rounded-sm hover:bg-[#00d0e0] active:scale-95 transition-all text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.25)] flex-shrink-0"
                                  >
                                    {importLoading ? (
                                      <span className="w-3.5 h-3.5 border-2 border-t-black border-transparent animate-spin rounded-full" />
                                    ) : (
                                      <span>Сканировать</span>
                                    )}
                                  </button>
                                </div>
                                <span className="text-[9px] text-neutral-500 leading-normal block">
                                  ⚠️ Сервер отправит защищенный агент-запрос для мгновенного парсинга метаданных страницы.
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="block text-[9px] text-neutral-500 uppercase font-black">Вставьте исходный код страницы (HTML)</label>
                                <textarea
                                  placeholder="1. Перейдите на свой профиль в браузере (например, guns.lol/cryteam)&#10;2. Нажмите комбинацию клавиш Ctrl+U (или просмотр кода вашей страницы)&#10;3. Выделите весь текст (Ctrl+A), скопируйте его и вставьте сюда..."
                                  value={pastedHtml}
                                  onChange={e => setPastedHtml(e.target.value)}
                                  rows={4}
                                  className="w-full bg-black/50 border border-white/10 focus:border-[#00f2ff] rounded-sm p-3 text-xs text-neutral-300 font-mono outline-none placeholder-neutral-800"
                                />
                                <div className="flex justify-between items-center gap-4">
                                  <span className="text-[9.5px] leading-snug text-neutral-500">
                                    💡 Идеально обходит Cloudflare проверки! Скрипт разберет все фоны, плееры, линки и иконки локально на вашем устройстве.
                                  </span>
                                  <button
                                    type="submit"
                                    disabled={importLoading}
                                    className="px-6 py-2.5 bg-[#00f2ff] text-black font-black text-[10px] uppercase tracking-wider rounded-sm hover:bg-[#00d0e0] active:scale-95 transition-all text-center flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.25)] flex-shrink-0"
                                  >
                                    {importLoading ? (
                                      <span className="w-3.5 h-3.5 border-2 border-t-black border-transparent animate-spin rounded-full" />
                                    ) : (
                                      <span>Импортировать код</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </form>

                          {/* Dynamic Feedback channels */}
                          {importError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm leading-normal text-[10px] flex items-center space-x-2">
                              <span>🛑</span>
                              <span className="font-sans">{importError}</span>
                            </div>
                          )}

                          {importSuccess && (
                            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-sm leading-normal text-[10px] flex items-start space-x-2">
                              <span>✅</span>
                              <span className="font-sans">{importSuccess}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Main Overview Columns (Progress Split) */}
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 items-start mt-2">
                        {/* Right Col: Account Management and Connections */}
                        <div className="md:col-span-5 space-y-4">
                          {/* Inner Card 1: Account control actions */}
                          <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3.5">
                            <span className="block text-[10px] uppercase font-black text-neutral-400 tracking-wider font-mono">
                              🛠️ Действия с аккаунтом
                            </span>

                            <div className="flex flex-col gap-2 font-mono text-[10px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameInput(username);
                                  setIsRenameModalOpen(true);
                                }}
                                className="w-full text-left p-3.5 bg-black/45 border border-white/10 hover:border-[#00f2ff]/30 text-neutral-300 hover:text-white rounded-sm transition font-bold"
                              >
                                [ Изменить имя пользователя ]
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab('profile')}
                                className="w-full text-left p-3.5 bg-black/45 border border-white/10 hover:border-[#00f2ff]/30 text-neutral-300 hover:text-white rounded-sm transition font-bold"
                              >
                                [ Настройка шапки страницы ]
                              </button>
                              
                              {/* Integrated Inline Custom Alias Configurer */}
                              <div className="p-3 bg-black/60 border border-purple-500/10 rounded-sm">
                                <span className="block text-[8px] uppercase text-neutral-500 font-extrabold mb-1.5 font-mono">АЛИАС СТРАНИЦЫ (ВТОРОЙ SLUG)</span>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="cryteam_super"
                                    value={config.aliasSlug || ''}
                                    onChange={e => updateConfigValue('aliasSlug', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                    className="bg-black/80 border border-white/10 rounded-sm p-1.5 text-[10px] text-white flex-grow focus:border-[#00f2ff] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveConfig}
                                    className="px-2.5 py-1 bg-[#8a2be2]/20 hover:bg-[#8a2be2]/40 text-purple-300 border border-[#8a2be2]/40 rounded-sm text-[8px] font-black uppercase transition cursor-pointer"
                                  >
                                    Задать
                                  </button>
                                </div>
                                <span className="text-[7.5px] text-neutral-500 leading-normal block mt-1.5 font-sans italic">
                                  Allows visitors to navigate using an alternative endpoint slug.
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Connections widget (Подключения) */}
                          <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                            <span className="block text-[10px] uppercase font-black text-neutral-400 tracking-wider font-mono">
                              🖇️ Подключения профиля
                            </span>

                            <span className="text-[10px] text-neutral-500 block leading-relaxed font-sans">
                              Свяжите ваши аккаунты Discord и Google с guns.lol для вывода баджей и верификации.
                            </span>

                            <div className="space-y-2 pt-1 font-mono text-[10px]">
                              {/* Discord Connect button structure */}
                              {config.discordConnected ? (
                                <div className="p-2.5 bg-[#5865f2]/10 border border-[#5865f2]/30 rounded-sm flex justify-between items-center text-[#5865f2]">
                                  <div className="flex items-center space-x-2.5">
                                    <span className="text-sm font-bold">👾</span>
                                    <div>
                                      <span className="font-extrabold block text-white text-[10px]">Discord Подключён</span>
                                      <span className="text-[9px] text-[#5865f2]/80 font-mono">@{config.discordUsername || 'unknown'}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateConfigValue('discordConnected', false);
                                      updateConfigValue('discordUsername', '');
                                    }}
                                    className="text-[9px] font-black uppercase hover:underline text-red-400 cursor-pointer"
                                  >
                                    [ Выйти ]
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsDiscordModalOpen(true)}
                                  className="w-full flex items-center justify-between p-3 bg-black/40 border border-white/10 hover:border-[#5865f2]/40 hover:bg-[#5865f2]/5 rounded-sm transition text-left cursor-pointer"
                                >
                                  <span className="font-bold flex items-center space-x-2">
                                    <span className="text-neutral-500">👾</span>
                                    <span className="text-neutral-300">Подключить Discord</span>
                                  </span>
                                  <span className="text-[8px] uppercase tracking-wider text-neutral-500 font-extrabold bg-white/5 px-2 py-0.5 rounded-sm">Link</span>
                                </button>
                              )}

                              {/* Google removed directly as requested */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 1. PROFILE SECTOR */}
                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <User className="w-4 h-4" />
                      <span>Настройка шапки профиля</span>
                    </h3>

                    <div className="space-y-3 font-mono text-xs">
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Отображаемое имя (Никнейм)</label>
                        <input
                          type="text"
                          value={config.displayName}
                          onChange={e => updateConfigValue('displayName', e.target.value)}
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-white text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Описание профиля (БИО)</label>
                        <textarea
                          value={config.bio}
                          onChange={e => updateConfigValue('bio', e.target.value)}
                          rows={3}
                          placeholder="Несколько слов о себе или роде вашей деятельности"
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-sans text-sm font-sans text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Аватар (Прямая ссылка или файл)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={config.avatarUrl}
                            onChange={e => updateConfigValue('avatarUrl', e.target.value)}
                            className="flex-grow bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-xs text-white"
                          />
                          <button 
                            type="button" 
                            onClick={() => { setUploadTarget('avatarUrl'); fileInputRef.current?.click(); }} 
                            className="px-4 py-3 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[10px] text-[#00f2ff] font-bold uppercase tracking-wider rounded-sm flex items-center justify-center cursor-pointer transition-all"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1" /> ФАЙЛ
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Верификация (Значок Галочки)</label>
                          <button
                            type="button"
                            onClick={() => updateConfigValue('verified', !config.verified)}
                            className={`w-full py-2.5 rounded-sm border font-black tracking-widest text-[10px] uppercase transition cursor-pointer ${
                              config.verified ? 'bg-[#00f2ff]/10 border-[#00f2ff]/50 text-[#00f2ff]' : 'bg-black/25 border-white/10 text-neutral-500'
                            }`}
                          >
                            {config.verified ? '[ ВЕРИФИКАЦИЯ АКТИВНА ]' : '[ ОТКЛЮЧЕНА ]'}
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Эффект искр за курсором</label>
                          <button
                            type="button"
                            onClick={() => updateConfigValue('sparkles', !config.sparkles)}
                            className={`w-full py-2.5 rounded-sm border font-black tracking-widest text-[10px] uppercase transition cursor-pointer ${
                              config.sparkles ? 'bg-[#00f2ff]/10 border-[#00f2ff]/40 text-[#00f2ff]' : 'bg-black/25 border-white/10 text-neutral-500'
                            }`}
                          >
                            {config.sparkles ? '[ ЭФФЕКТ ИСКР АКТИВЕН ]' : '[ ОТКЛЮЧЕН ]'}
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Эффекты снегопада (Snow)</label>
                          <button
                            type="button"
                            onClick={() => updateConfigValue('snowEffectsEnabled', !config.snowEffectsEnabled)}
                            className={`w-full py-2.5 rounded-sm border font-black tracking-widest text-[10px] uppercase transition cursor-pointer ${
                              config.snowEffectsEnabled ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-black/25 border-white/10 text-neutral-500'
                            }`}
                          >
                            {config.snowEffectsEnabled ? '[ СНЕГОПАД АКТИВЕН ]' : '[ ОТКЛЮЧЕНО ]'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 pt-4 pb-2">
                         <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Эффекты для имени пользователя</label>
                          <select
                            value={config.nameEffect || 'none'}
                            onChange={e => updateConfigValue('nameEffect', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-white text-xs cursor-pointer"
                          >
                            <option value="none">Отключено (Без эффекта)</option>
                            <option value="glow">Белое Свечение (Glow)</option>
                            <option value="neon">Неон (Пульсирующее Свечение)</option>
                            <option value="neon_red">Красный Неон (Red Glow)</option>
                            <option value="neon_blue">Синий Неон (Blue Glow)</option>
                            <option value="stroke">Обводка (Thick Stroke Hollow)</option>
                            <option value="gradient">Градиент (Purple-Pink)</option>
                            <option value="gradient_fire">Огненный Градиент (Fire)</option>
                            <option value="gradient_ocean">Океанский Градиент (Ocean)</option>
                            <option value="shine">Проблеск (Shine Sweep)</option>
                            <option value="glitch">Глитч (Glitch Pulse)</option>
                            <option value="typewriter">Печатная Машинка (Typewriter)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Собственная надпись на бейдже</label>
                        <input
                          type="text"
                          value={config.customBadge}
                          onChange={e => updateConfigValue('customBadge', e.target.value)}
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Текст на клик-заставке (Click to Enter)</label>
                        <input
                          type="text"
                          value={config.enterText}
                          onChange={e => updateConfigValue('enterText', e.target.value)}
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* CUSTOM TRANSPARENT BADGES SYSTEM CONSTRUCTOR */}
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                      <div className="flex justify-between items-center bg-black/30 p-2.5 border border-white/5 rounded-sm">
                        <div>
                          <h4 className="text-xs font-black font-mono text-white uppercase tracking-wider flex items-center gap-1.5 italic">
                            <Sparkles className="w-3.5 h-3.5 text-[#00f2ff]" />
                            <span>Прозрачные бейджи профиля</span>
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-sans mt-0.5 leading-relaxed">
                            Управляйте коллекцией настраиваемых бейджей с иконками, цветами, эффектом свечения и всплывающей подсказкой (Tooltip). Прекрасно дополняет общую картину, как на guns.lol!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentBadges = config.badges || [
                              { id: 'b-v', type: 'verified', icon: 'shieldcheck', label: 'Verified', description: 'Официально верифицированный профиль платформы', enabled: true, glow: true, glowColor: '#00f2ff' },
                              { id: 'b-p', type: 'premium', icon: 'gem', label: 'Premium', description: 'Премиум-подписка CRY BIOS Pro', enabled: true, glow: true, glowColor: '#a855f7' },
                              { id: 'b-d', type: 'developer', icon: 'code', label: 'Developer', description: 'Разработчик открытого исходного кода CRY BIOS', enabled: true, glow: false, glowColor: '#10b981' }
                            ];
                            const newBadge: UserBadge = {
                              id: `badge-${Date.now()}`,
                              type: 'custom',
                              icon: 'star',
                              label: 'Новый бейдж',
                              description: 'Описание бейджа',
                              enabled: true,
                              glow: false,
                              glowColor: '#00f2ff',
                              bgColor: 'rgba(0, 0, 0, 0.45)',
                              borderColor: 'rgba(255, 255, 255, 0.08)',
                              textColor: '#ffffff'
                            };
                            updateConfigValue('badges', [...currentBadges, newBadge]);
                          }}
                          className="px-3 py-1.5 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] text-[10px] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95 flex-shrink-0"
                        >
                          + Добавить бейдж
                        </button>
                      </div>

                      {(() => {
                        const badgesList = config.badges || [
                          { id: 'b-v', type: 'verified', icon: 'shieldcheck', label: 'Verified', description: 'Официально верифицированный профиль платформы', enabled: true, glow: true, glowColor: '#00f2ff' },
                          { id: 'b-p', type: 'premium', icon: 'gem', label: 'Premium', description: 'Премиум-подписка CRY BIOS Pro', enabled: true, glow: true, glowColor: '#a855f7' },
                          { id: 'b-d', type: 'developer', icon: 'code', label: 'Developer', description: 'Разработчик открытого исходного кода CRY BIOS', enabled: true, glow: false, glowColor: '#10b981' }
                        ];

                        if (badgesList.length === 0) {
                          return (
                            <div className="p-4 bg-white/5 border border-white/5 rounded-sm text-center text-neutral-500 font-mono text-[10px]">
                              Список бейджей пуст. Нажмите кнопку выше, чтобы добавить первый!
                            </div>
                          );
                        }

                        const handleMoveBadge = (index: number, direction: 'up' | 'down') => {
                          const newList = [...badgesList];
                          const targetIndex = direction === 'up' ? index - 1 : index + 1;
                          if (targetIndex < 0 || targetIndex >= newList.length) return;
                          
                          // Swap elements
                          const temp = newList[index];
                          newList[index] = newList[targetIndex];
                          newList[targetIndex] = temp;
                          
                          updateConfigValue('badges', newList);
                        };

                        const handleUpdateBadge = (id: string, fields: Partial<UserBadge>) => {
                          const newList = badgesList.map(b => b.id === id ? { ...b, ...fields } as UserBadge : b);
                          updateConfigValue('badges', newList);
                        };

                        const handleDeleteBadge = (id: string) => {
                          const newList = badgesList.filter(b => b.id !== id);
                          updateConfigValue('badges', newList);
                        };

                        return (
                          <div className="space-y-3">
                            {badgesList.map((badge, idx) => (
                              <div 
                                key={badge.id}
                                className="p-3 bg-white/[0.02] border border-white/10 rounded-sm space-y-3 font-mono transition-colors hover:border-white/15"
                              >
                                {/* Header of individual badge */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="p-1.5 rounded-[4px] border flex items-center justify-center font-bold"
                                      style={{
                                        backgroundColor: badge.bgColor || 'rgba(0, 0, 0, 0.45)',
                                        borderColor: badge.borderColor || 'rgba(255, 255, 255, 0.08)',
                                        color: badge.textColor || '#ffffff',
                                        boxShadow: badge.glow ? `0 0 10px ${badge.glowColor || '#00f2ff'}40` : 'none',
                                      }}
                                    >
                                      {renderDashboardBadgeIcon(badge.icon)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-white uppercase italic tracking-wider">{badge.label || 'Без названия'}</span>
                                        <span className="text-[8px] px-1 bg-white/10 text-neutral-400 rounded-sm font-light select-none">№{idx + 1}</span>
                                      </div>
                                      <span className="text-[9px] text-[#00f2ff]/60 block tracking-normal lowercase">{badge.description || 'нет подсказки'}</span>
                                    </div>
                                  </div>

                                  {/* Arrangement controls & Delete */}
                                  <div className="flex items-center gap-1.5 justify-end">
                                    {/* Order Up */}
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveBadge(idx, 'up')}
                                      className="p-1 px-1.5 bg-white/5 border border-white/10 text-neutral-400 hover:text-white rounded-sm text-[9px] font-bold disabled:opacity-20 cursor-pointer transition-colors"
                                      title="Вверх в порядке отображения"
                                    >
                                      ▲
                                    </button>
                                    {/* Order Down */}
                                    <button
                                      type="button"
                                      disabled={idx === badgesList.length - 1}
                                      onClick={() => handleMoveBadge(idx, 'down')}
                                      className="p-1 px-1.5 bg-white/5 border border-white/10 text-neutral-400 hover:text-white rounded-sm text-[9px] font-bold disabled:opacity-20 cursor-pointer transition-colors"
                                      title="Вниз в порядке отображения"
                                    >
                                      ▼
                                    </button>

                                    {/* Enable / Disable */}
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBadge(badge.id, { enabled: !badge.enabled })}
                                      className={`px-2 py-1 text-[9px] font-bold uppercase rounded-sm border cursor-pointer transition-colors ${
                                        badge.enabled 
                                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                                          : 'bg-red-500/10 border-red-500/30 text-red-500'
                                      }`}
                                    >
                                      {badge.enabled ? 'Вкл' : 'Выкл'}
                                    </button>

                                    {/* Delete */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBadge(badge.id)}
                                      className="p-1 px-2 bg-red-950/40 hover:bg-red-900 border border-red-500/30 hover:border-red-500/60 text-red-400 rounded-sm text-[9px] uppercase font-bold cursor-pointer transition-all"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>

                                {/* Customizers of current badge inline-expansion / grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 shadow-inner p-2.5 bg-black/60 rounded-sm border border-white/5 gap-2.5 text-[10px]">
                                  {/* Title Label */}
                                  <div>
                                    <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1">Название бейджа</label>
                                    <input
                                      type="text"
                                      value={badge.label}
                                      onChange={e => handleUpdateBadge(badge.id, { label: e.target.value })}
                                      className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm py-1 px-2 text-[10px] text-white focus:outline-none"
                                    />
                                  </div>

                                  {/* Tooltip Description */}
                                  <div>
                                    <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1">Текст подсказки (Tooltip)</label>
                                    <input
                                      type="text"
                                      value={badge.description || ''}
                                      onChange={e => handleUpdateBadge(badge.id, { description: e.target.value })}
                                      placeholder="Показывается на наведении"
                                      className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm py-1 px-2 text-[10px] text-white placeholder-neutral-700 focus:outline-none"
                                    />
                                  </div>

                                  {/* Icon Selection */}
                                  <div>
                                    <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1">Иконка бейджа</label>
                                    <select
                                      value={badge.icon}
                                      onChange={e => handleUpdateBadge(badge.id, { icon: e.target.value })}
                                      className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm py-1 px-1.5 text-[10px] text-white focus:outline-none"
                                    >
                                      <option value="crown">👑 Корона (Crown)</option>
                                      <option value="shield">🛡️ Щит (Shield)</option>
                                      <option value="shieldcheck">✅ Вериф галочка (ShieldCheck)</option>
                                      <option value="gem">💎 Алмаз (Gem)</option>
                                      <option value="award">🎖️ Награда (Award)</option>
                                      <option value="star">⭐ Звезда (Star)</option>
                                      <option value="heart">❤️ Сердце (Heart)</option>
                                      <option value="zap">⚡ Молния (Zap)</option>
                                      <option value="code">💻 Разработчик (Code)</option>
                                      <option value="flame">🔥 Огонь (Flame)</option>
                                      <option value="skull">💀 Череп (Skull)</option>
                                      <option value="gamepad">🎮 Геймпад (Gamepad)</option>
                                      <option value="music">🎵 Музыка (Music)</option>
                                      <option value="terminal">📟 Консоль (Terminal)</option>
                                      <option value="coffee">☕ Кофе (Coffee)</option>
                                      <option value="discord">💬 Дискорд (Discord)</option>
                                    </select>
                                  </div>

                                  {/* Neon glow control */}
                                  <div>
                                    <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1">Неоновое свечение</label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateBadge(badge.id, { glow: !badge.glow })}
                                        className={`flex-grow py-1 border rounded-sm font-bold uppercase transition duration-150 cursor-pointer text-[9px] ${
                                          badge.glow 
                                            ? 'bg-[#00f2ff]/10 border-[#00f2ff]/40 text-[#00f2ff]' 
                                            : 'bg-black border-white/10 text-neutral-500'
                                        }`}
                                      >
                                        {badge.glow ? 'Свечение есть' : 'Нет свечения'}
                                      </button>
                                      {badge.glow && (
                                        <input
                                          type="color"
                                          value={badge.glowColor || '#00f2ff'}
                                          onChange={e => handleUpdateBadge(badge.id, { glowColor: e.target.value })}
                                          className="w-10 h-6 bg-transparent border-0 cursor-pointer rounded-sm flex-shrink-0"
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Custom color overrides (Advanced styling for fine design) */}
                                  <div className="sm:col-span-2 grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                                    <div>
                                      <label className="block text-[7px] uppercase tracking-wider text-neutral-600 mb-0.5">Цвет Фона (Hex/RGBA)</label>
                                      <input
                                        type="text"
                                        value={badge.bgColor || 'rgba(0,0,0,0.45)'}
                                        onChange={e => handleUpdateBadge(badge.id, { bgColor: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded-sm py-0.5 px-1.5 text-[9px] text-white font-mono focus:outline-none focus:border-[#00f2ff]"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[7px] uppercase tracking-wider text-neutral-600 mb-0.5">Цвет Текста (Hex)</label>
                                      <input
                                        type="text"
                                        value={badge.textColor || '#ffffff'}
                                        onChange={e => handleUpdateBadge(badge.id, { textColor: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded-sm py-0.5 px-1.5 text-[9px] text-white font-mono focus:outline-none focus:border-[#00f2ff]"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[7px] uppercase tracking-wider text-neutral-600 mb-0.5">Цвет Рамки (Hex/RGBA)</label>
                                      <input
                                        type="text"
                                        value={badge.borderColor || 'rgba(255,255,255,0.08)'}
                                        onChange={e => handleUpdateBadge(badge.id, { borderColor: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded-sm py-0.5 px-1.5 text-[9px] text-white font-mono focus:outline-none focus:border-[#00f2ff]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* LAYOUT CONSTRUCTOR SECTOR */}
                {activeTab === 'layout' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Layout className="w-4 h-4" />
                      <span>Конструктор (Порядок блоков)</span>
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-sans leading-normal">
                      Настройте порядок отображения элементов на вашей био-странице.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-sm p-4 text-[10px]">
                      {(config.layout || ['avatar', 'username', 'badges', 'discord', 'bio', 'blocks', 'player']).map((item, index, arr) => (
                        <div key={item} className="flex items-center justify-between bg-black/40 border border-white/5 p-2.5 mb-2 rounded-sm last:mb-0">
                          <span className="font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2">
                             {item === 'avatar' && '🖼️ Аватар'}
                             {item === 'username' && '📝 Имя пользователя'}
                             {item === 'badges' && '🎖️ Значки / Бейджи'}
                             {item === 'discord' && '👾 Discord Статус'}
                             {item === 'bio' && '💬 Описание профиля'}
                             {item === 'blocks' && '🧩 Дополнительные блоки'}
                             {item === 'player' && '🎵 Музыкальный плеер'}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const newLayout = [...arr];
                                const temp = newLayout[index - 1];
                                newLayout[index - 1] = newLayout[index];
                                newLayout[index] = temp;
                                updateConfigValue('layout', newLayout);
                              }}
                              className="p-1 rounded-sm bg-white/5 hover:bg-white/15 disabled:opacity-30 transition cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === arr.length - 1}
                              onClick={() => {
                                const newLayout = [...arr];
                                const temp = newLayout[index + 1];
                                newLayout[index + 1] = newLayout[index];
                                newLayout[index] = temp;
                                updateConfigValue('layout', newLayout);
                              }}
                              className="p-1 rounded-sm bg-white/5 hover:bg-white/15 disabled:opacity-30 transition cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. BACKGROUND SECTOR */}
                {activeTab === 'background' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Monitor className="w-4 h-4" />
                      <span>Настройка фона страницы</span>
                    </h3>

                    <div className="space-y-4 font-mono text-xs">
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Тип заднего фона</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {([
                            { key: 'color', label: 'Color' },
                            { key: 'gradient', label: 'Gradient' },
                            { key: 'image', label: 'Image' },
                            { key: 'matrix', label: 'Matrix' },
                            { key: 'stars', label: 'Stars' },
                            { key: 'rain', label: 'Rain' }
                          ]).map(t => (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => updateConfigValue('bgType', t.key as BackgroundType)}
                              className={`p-2 rounded-sm border text-[10px] font-black uppercase transition scale-[0.98] cursor-pointer ${
                                config.bgType === t.key ? 'bg-[#00f2ff] text-black border-transparent shadow-[0_0_12px_rgba(0,242,255,0.3)]' : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic bgValue options inputs */}
                      {['color', 'gradient', 'image'].includes(config.bgType) && (
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">
                            {config.bgType === 'color' ? 'HTML Hex-Код цвета' :
                             config.bgType === 'gradient' ? 'CSS Линейный градиент' : 'Ссылка на фоновую картинку'}
                          </label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={config.bgValue}
                                onChange={e => updateConfigValue('bgValue', e.target.value)}
                                className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-xs text-white"
                              />
                              {(config.bgType === 'image' || config.bgType === 'video') && (
                                <button 
                                  type="button" 
                                  onClick={() => { setUploadTarget('bgValue'); fileInputRef.current?.click(); }} 
                                  className="px-4 py-3 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[10px] text-[#00f2ff] font-bold uppercase tracking-wider rounded-sm flex items-center justify-center cursor-pointer transition-all"
                                >
                                  <Upload className="w-3.5 h-3.5 mr-1" /> ФАЙЛ
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {config.bgType === 'gradient' && (
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Быстрые шаблоны градиентов</label>
                          <div className="flex flex-wrap gap-2.5 mt-1.5">
                            {GRADIENT_PRESETS.map((p, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => updateConfigValue('bgValue', p)}
                                className="w-8 h-8 rounded-full border border-white/15 hover:scale-110 transition cursor-pointer"
                                style={{ backgroundImage: p }}
                                title={p}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Размытие фона (Blur)</label>
                          <span className="text-[10px] text-[#00f2ff] font-black block mb-1">{config.bgBlur} px</span>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={config.bgBlur}
                            onChange={e => updateConfigValue('bgBlur', parseInt(e.target.value))}
                            className="w-full accent-[#00f2ff]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Затемнение фона (Dimmer)</label>
                          <span className="text-[10px] text-[#00f2ff] font-black block mb-1">{config.bgDim}%</span>
                          <input
                            type="range"
                            min="0"
                            max="90"
                            value={config.bgDim}
                            onChange={e => updateConfigValue('bgDim', parseInt(e.target.value))}
                            className="w-full accent-[#00f2ff]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* VISUALS SECTOR */}
                {activeTab === 'visuals' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Flame className="w-4 h-4" />
                      <span>Параметры оформления</span>
                    </h3>

                    <div className="space-y-5 font-mono text-xs">
                      {/* Transparency configurations for Card and Badges */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Прозрачность карточки</label>
                          <span className="text-[10px] text-[#00f2ff] font-black block mb-1">{config.cardOpacity !== undefined ? config.cardOpacity : 55}%</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.cardOpacity !== undefined ? config.cardOpacity : 55}
                            onChange={e => updateConfigValue('cardOpacity', parseInt(e.target.value))}
                            className="w-full accent-[#00f2ff]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Прозрачность бейджей</label>
                          <span className="text-[10px] text-[#00f2ff] font-black block mb-1">{config.badgeOpacity !== undefined ? config.badgeOpacity : 10}%</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.badgeOpacity !== undefined ? config.badgeOpacity : 10}
                            onChange={e => updateConfigValue('badgeOpacity', parseInt(e.target.value))}
                            className="w-full accent-[#00f2ff]"
                          />
                        </div>
                      </div>

                      {/* Theme Colors and typography options */}
                      <div className="border-t border-white/10 pt-4 space-y-3">
                        <h4 className="text-[10px] uppercase text-[#00f2ff] font-black tracking-widest mb-2 italic">Цветовая палитра и выбор шрифта</h4>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div>
                            <span className="text-[9px] block text-neutral-500 mb-1 font-bold">Свечение (Основной)</span>
                            <input
                              type="color"
                              value={config.primaryColor}
                              onChange={e => updateConfigValue('primaryColor', e.target.value)}
                              className="w-12 h-10 bg-transparent border-0 cursor-pointer text-center"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] block text-neutral-500 mb-1 font-bold">Цвет текстов</span>
                            <input
                              type="color"
                              value={config.textColor}
                              onChange={e => updateConfigValue('textColor', e.target.value)}
                              className="w-12 h-10 bg-transparent border-0 cursor-pointer text-center"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] block text-neutral-500 mb-1 font-bold">Цвет свечений</span>
                            <input
                              type="color"
                              value={config.glowColor}
                              onChange={e => updateConfigValue('glowColor', e.target.value)}
                              className="w-12 h-10 bg-transparent border-0 cursor-pointer"
                            />
                          </div>

                          <div className="text-left">
                            <span className="text-[9px] block text-neutral-500 mb-1 font-bold">Шрифт страницы</span>
                            <select
                                value={config.fontFamily}
                                onChange={e => updateConfigValue('fontFamily', e.target.value as any)}
                                className="bg-black/80 border border-white/15 rounded-sm p-2 focus:outline-none focus:border-[#00f2ff] text-[10px] w-full font-mono font-bold text-white outline-none"
                            >
                              <option value="Inter">Inter Sans</option>
                              <option value="Space Grotesk">Space Grotesk</option>
                              <option value="JetBrains Mono">JetBrains Mono</option>
                              <option value="Outfit">Outfit Tech</option>
                              <option value="Playfair Display">Playfair Serif</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-2">
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 flex items-center justify-between font-bold">
                            <span>Пользовательский CSS-код (стили)</span>
                            <span className="text-[#00f2ff] text-[8px] font-bold">[ Идеально для тонкой настройки ]</span>
                          </label>
                          <textarea
                            value={config.customCSS || ''}
                            onChange={e => updateConfigValue('customCSS', e.target.value)}
                            rows={3}
                            placeholder=".my-element { border-radius: 5px; }"
                            className="w-full bg-black/50 border border-white/15 hover:border-white/20 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none font-mono text-[10px] text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. AUDIO SECTOR */}
                {activeTab === 'audio' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Music className="w-4 h-4" />
                      <span>Настройка фоновой музыки</span>
                    </h3>

                    <div className="space-y-4 font-mono text-xs">
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Активация аудио-движка</label>
                        <button
                          type="button"
                          onClick={() => updateConfigValue('audioEnabled', !config.audioEnabled)}
                          className={`w-full py-2.5 rounded-sm border font-black text-[10px] uppercase transition tracking-widest cursor-pointer ${
                            config.audioEnabled ? 'bg-[#00f2ff]/10 border-[#00f2ff]/40 text-[#00f2ff]' : 'bg-black/20 border-white/10 text-neutral-500'
                          }`}
                        >
                          {config.audioEnabled ? '[ АВТОПЛЕЙ ГОТОВ К ИСПОЛЬЗОВАНИЮ ]' : '[ ВЫКЛЮЧЕНО ]'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Прямая MP3-ссылка на аудиофайл или ПК</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="https://example.com/sound-beat.mp3"
                            value={config.audioUrl}
                            onChange={e => updateConfigValue('audioUrl', e.target.value)}
                            className="flex-grow bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                          />
                          <button 
                            type="button" 
                            onClick={() => { setUploadTarget('audioUrl'); fileInputRef.current?.click(); }} 
                            className="px-4 py-3 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[10px] text-[#00f2ff] font-bold uppercase tracking-wider rounded-sm flex items-center justify-center cursor-pointer transition-all"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1" /> ФАЙЛ
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Название трека</label>
                          <input
                            type="text"
                            placeholder="Название песни"
                            value={config.audioTitle}
                            onChange={e => updateConfigValue('audioTitle', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Исполнитель / Продюсер (Artist)</label>
                          <input
                            type="text"
                            placeholder="Имя создателя"
                            value={config.audioArtist}
                            onChange={e => updateConfigValue('audioArtist', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="p-3.5 bg-white/5 rounded-sm border border-white/10 text-[10px] leading-relaxed font-sans text-neutral-400">
                        📻 <strong>Важная информация об автоматическом воспроизведении:</strong> Современные интернет-браузеры блокируют нежелательное воспроизведение музыки до первого клика на странице. Наша интерактивная клик-заставка (Click to Enter) прекрасно решает эту проблему — звук зазвучит чистейшим образом сразу после входа в ваш профиль. Ссылка обязательно должна оканчиваться на `.mp3`.
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. BLOCKS SECTOR */}
                {activeTab === 'blocks' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                        <Code className="w-4 h-4" />
                        <span>Конструктор блоков профиля</span>
                      </h3>
                      <span className="text-[10px] font-mono text-neutral-500">{config.blocks.length} блоков</span>
                    </div>

                    <div className="space-y-4">
                      {/* Form to add elements */}
                      <div className="p-4 bg-black/40 border border-white/10 rounded-sm">
                        <span className="text-[10px] block font-mono uppercase text-[#00f2ff] font-bold mb-2.5">➕ Добавить настраиваемый блок</span>
                        <div className="flex flex-wrap gap-2">
                          {(['socials', 'html', 'textbox', 'quote', 'status_api', 'views_counter', 'image', 'embed'] as BlockConfig['type'][]).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleAddBlock(type)}
                              className="px-2.5 py-1.5 bg-white/5 hover:bg-[#00f2ff] hover:text-black rounded-sm text-[10px] font-bold font-mono uppercase tracking-wider transition cursor-pointer"
                            >
                              + {type === 'socials' ? 'Сетка ссылок' :
                                 type === 'html' ? 'Свой HTML' :
                                 type === 'textbox' ? 'Текст' :
                                 type === 'quote' ? 'Цитата' :
                                 type === 'status_api' ? 'Статус дискорда' :
                                 type === 'views_counter' ? 'Просмотры' :
                                 type === 'image' ? 'Изображение' : 'Медиа-плеер'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Display Blocks list */}
                      <div className="space-y-4 font-mono text-xs">
                        {config.blocks.map((block, bIdx) => (
                           <div key={block.id} className="p-4 bg-[#0c0c0c] border border-white/10 rounded-sm relative space-y-3">
                             <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                               <span className="font-bold text-xs text-[#00f2ff] font-mono uppercase flex items-center gap-1.5">
                                 <span className="bg-white/5 text-neutral-400 p-1 rounded-sm font-normal text-[10px]">{bIdx + 1}</span>
                                 {block.type === 'socials' ? '🔗 Сетка контактов / ссылок' :
                                  block.type === 'html' ? '🔱 Интегрированный HTML-песочница' :
                                  block.type === 'textbox' ? '📢 Текстовое окно / Объявление' :
                                  block.type === 'quote' ? '📜 Баннер с цитатой' :
                                  block.type === 'status_api' ? '🛰️ Discord Статус' :
                                  block.type === 'views_counter' ? '🛰️ Счетчик просмотров' :
                                  block.type === 'image' ? '🖼️ Выделенное изображение' : '📻 Медиа-плеер YouTube/Soundcloud'}
                               </span>

                              <div className="flex items-center space-x-2.5">
                                {/* Order Arrangement buttons */}
                                <button
                                  type="button"
                                  disabled={bIdx === 0}
                                  onClick={() => handleMoveBlockUp(bIdx)}
                                  className="text-neutral-400 hover:text-[#00f2ff] disabled:opacity-20 transition cursor-pointer"
                                  title="Переместить вверх"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={bIdx === config.blocks.length - 1}
                                  onClick={() => handleMoveBlockDown(bIdx)}
                                  className="text-neutral-400 hover:text-[#00f2ff] disabled:opacity-20 transition cursor-pointer"
                                  title="Переместить вниз"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <div className="h-4 w-[1px] bg-white/15" />

                                <button
                                  type="button"
                                  onClick={() => updateBlock(block.id, { enabled: !block.enabled })}
                                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                                    block.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-black/30 text-neutral-500'
                                  }`}
                                >
                                  {block.enabled ? 'Активен' : 'Скрыт'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBlock(block.id)}
                                  className="text-neutral-400 hover:text-red-400 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Block Options parameters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Название блока / Заголовок</label>
                                <input
                                  type="text"
                                  value={block.title}
                                  onChange={e => updateBlock(block.id, { title: e.target.value })}
                                  className="w-full bg-black/50 border border-white/10 focus:border-[#00f2ff] rounded-sm px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Идентификатор ID блока</label>
                                <input
                                  type="text"
                                  disabled
                                  value={block.id}
                                  className="w-full bg-black/20 border border-white/5 rounded-sm px-2.5 py-1.5 text-xs text-neutral-600 font-mono"
                                />
                              </div>
                            </div>

                            {/* CUSTOMIZABLE STYLING COMPONENT TOOLBAR */}
							<div className="p-3 bg-black/40 border border-white/10 rounded-sm space-y-3.5">
                              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                                <Sliders className="w-3" /> Индивидуальный дизайн и оформление блока
                              </span>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">Фон (HEX)</label>
                                  <input
                                    type="text"
                                    placeholder="#000000"
                                    value={block.bgColor || ''}
                                    onChange={e => updateBlock(block.id, { bgColor: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] text-white focus:border-[#00f2ff] outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">ЦВЕТ ТЕКСТА (HEX)</label>
                                  <input
                                    type="text"
                                    placeholder="#ffffff"
                                    value={block.textColor || ''}
                                    onChange={e => updateBlock(block.id, { textColor: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] text-white focus:border-[#00f2ff] outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">ЦВЕТ РАМКИ (HEX)</label>
                                  <input
                                    type="text"
                                    placeholder="#ffffff"
                                    value={block.borderColor || ''}
                                    onChange={e => updateBlock(block.id, { borderColor: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] text-white focus:border-[#00f2ff] outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">СКРУГЛЕНИЕ УГЛОВ</label>
                                  <select
                                    value={block.borderRadius || 'sm'}
                                    onChange={e => updateBlock(block.id, { borderRadius: e.target.value as any })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] font-bold text-white focus:border-[#00f2ff] outline-none"
                                  >
                                    <option value="none">Острое (none)</option>
                                    <option value="sm">Малое (sm)</option>
                                    <option value="md">Среднее (md)</option>
                                    <option value="lg">Большое (lg)</option>
                                    <option value="full">Круглое (full)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">ВЫРАВНИВАНИЕ ТЕКСТА</label>
                                  <select
                                    value={block.textAlign || 'center'}
                                    onChange={e => updateBlock(block.id, { textAlign: e.target.value as any })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] font-bold text-white focus:border-[#00f2ff] outline-none"
                                  >
                                    <option value="left font-sans">По левому краю</option>
                                    <option value="center font-sans">По центру</option>
                                    <option value="right font-sans">По правому краю</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[8px] text-neutral-500 uppercase font-black mb-1">РАЗМЕР ШРИФТА</label>
                                  <select
                                    value={block.fontSize || 'sm'}
                                    onChange={e => updateBlock(block.id, { fontSize: e.target.value as any })}
                                    className="w-full bg-black border border-white/10 rounded-sm px-2 py-1 text-[10px] font-bold text-white focus:border-[#00f2ff] outline-none"
                                  >
                                    <option value="xs">Микро (xs)</option>
                                    <option value="sm">Мелкий (sm)</option>
                                    <option value="base">Стандарт (base)</option>
                                    <option value="lg">Крупный (lg)</option>
                                  </select>
                                </div>
                                <div className="flex items-center space-x-2 mt-4 col-span-2">
                                  <label className="text-[10px] text-neutral-400 font-bold flex items-center space-x-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={block.glow || false}
                                      onChange={e => updateBlock(block.id, { glow: e.target.checked })}
                                      className="rounded-sm border border-white/10 bg-black text-[#00f2ff] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span>Включить неоновое свечение теней?</span>
                                  </label>
                                  {block.glow && (
                                    <input
                                      type="text"
                                      placeholder="#00f2ff"
                                      value={block.glowColor || ''}
                                      onChange={e => updateBlock(block.id, { glowColor: e.target.value })}
                                      className="bg-black border border-white/10 rounded-sm px-1.5 py-0.5 text-[9px] w-16 text-white focus:border-[#00f2ff] outline-none"
                                      title="Пользовательский CSS-код цвета свечения"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Type Specific layout editors */}
                            {block.type === 'socials' && block.socialsList && (
                              <div className="space-y-3 mt-2.5">
                                <div className="flex justify-between items-center text-[10px] text-neutral-500 font-bold font-mono">
                                  <span>Список социальных сетей</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddSocialLink(block.id)}
                                    className="text-[#00f2ff] hover:underline cursor-pointer"
                                  >
                                    + ДОБАВИТЬ ПЛАТФОРМУ / ССЫЛКУ
                                  </button>
                                </div>

                                <div className="space-y-2.5">
                                  {block.socialsList.map(soc => (
                                    <div key={soc.id} className="p-3 bg-black/50 border border-white/10 rounded-sm space-y-2">
                                      <div className="grid grid-cols-2 gap-2.5">
                                        <select
                                          value={soc.platform}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { platform: e.target.value as any })}
                                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] font-bold text-white focus:border-[#00f2ff] outline-none"
                                        >
                                          <option value="discord">Иконка Discord</option>
                                          <option value="github">GitHub</option>
                                          <option value="telegram">Telegram</option>
                                          <option value="youtube">YouTube</option>
                                          <option value="steam">Steam Club</option>
                                          <option value="spotify">Spotify</option>
                                          <option value="twitter">X / Twitter</option>
                                          <option value="instagram">Instagram</option>
                                          <option value="tiktok">TikTok</option>
                                        </select>

                                        <input
                                          type="text"
                                          placeholder="Название (например, My GitHub)"
                                          value={soc.label || ''}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { label: e.target.value })}
                                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] placeholder-neutral-700 text-white outline-none focus:border-[#00f2ff]"
                                        />
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          placeholder="Ссылка URL (https://...)"
                                          value={soc.url}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { url: e.target.value })}
                                          className="flex-grow bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] placeholder-neutral-700 focus:border-[#00f2ff] outline-none text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSocialLink(block.id, soc.id)}
                                          className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {block.type === 'textbox' && (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Visual styling</label>
                                    <select
                                      value={block.textboxStyle || 'standard'}
                                      onChange={e => updateBlock(block.id, { textboxStyle: e.target.value as any })}
                                      className="bg-black border border-white/15 rounded-sm p-1.5 focus:border-[#00f2ff] text-[10px] w-full font-bold text-white focus:outline-none"
                                    >
                                      <option value="standard">Standard Solid</option>
                                      <option value="glow">Glint Cosmic Glow</option>
                                      <option value="marquee">Scrolling Marquee</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Announcement Body content</label>
                                  <textarea
                                    value={block.textboxContent || ''}
                                    onChange={e => updateBlock(block.id, { textboxContent: e.target.value })}
                                    rows={2}
                                    className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-sans font-sans text-xs outline-none text-white"
                                  />
                                </div>
                              </div>
                            )}

                            {block.type === 'quote' && (
                              <div className="space-y-2.5">
                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Quote text</label>
                                  <input
                                    type="text"
                                    value={block.quoteText || ''}
                                    onChange={e => updateBlock(block.id, { quoteText: e.target.value })}
                                    className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Author / Speaker</label>
                                  <input
                                    type="text"
                                    value={block.quoteAuthor || ''}
                                    onChange={e => updateBlock(block.id, { quoteAuthor: e.target.value })}
                                    className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {block.type === 'image' && (
                              <div className="space-y-2.5">
                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Image Source URL</label>
                                  <input
                                    type="text"
                                    value={block.imageUrl || ''}
                                    placeholder="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
                                    onChange={e => updateBlock(block.id, { imageUrl: e.target.value })}
                                    className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Click-through URL Link (Optional)</label>
                                    <input
                                      type="text"
                                      value={block.imageLink || ''}
                                      placeholder="https://example.com"
                                      onChange={e => updateBlock(block.id, { imageLink: e.target.value })}
                                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Image Alternative Alt Text</label>
                                    <input
                                      type="text"
                                      value={block.imageAlt || ''}
                                      placeholder="Banner Description"
                                      onChange={e => updateBlock(block.id, { imageAlt: e.target.value })}
                                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Фиксированная высота (px)</label>
                                    <input
                                      type="number"
                                      value={block.imageHeight || 200}
                                      onChange={e => updateBlock(block.id, { imageHeight: parseInt(e.target.value) || 200 })}
                                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Метод обрезки (Object Fit)</label>
                                    <select
                                      value={block.imageFit || 'cover'}
                                      onChange={e => updateBlock(block.id, { imageFit: e.target.value as any })}
                                      className="bg-black border border-white/15 rounded-sm p-2 focus:border-[#00f2ff] text-[11px] w-full font-bold text-white outline-none"
                                    >
                                      <option value="cover">Заполнение/Обрезать лишнее (cover)</option>
                                      <option value="contain">Вписать целиком (contain)</option>
                                      <option value="fill">Растянуть (fill)</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {block.type === 'embed' && (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Провайдер медиа-контента</label>
                                    <select
                                      value={block.embedType || 'youtube'}
                                      onChange={e => updateBlock(block.id, { embedType: e.target.value as any })}
                                      className="bg-black border border-white/15 rounded-sm p-2 focus:border-[#00f2ff] text-[11px] w-full font-bold text-white outline-none"
                                    >
                                      <option value="youtube">Ролик YouTube</option>
                                      <option value="spotify">Плеер Spotify</option>
                                      <option value="soundcloud">Плеер Soundcloud</option>
                                      <option value="custom_iframe">Своя ссылка (Iframe)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Ссылка-оригинал / Поделиться URL</label>
                                    <input
                                      type="text"
                                      value={block.embedUrl || ''}
                                      placeholder={block.embedType === 'spotify' ? 'https://open.spotify.com/track/...' : 'https://www.youtube.com/watch?v=...'}
                                      onChange={e => updateBlock(block.id, { embedUrl: e.target.value })}
                                      className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                    />
                                  </div>
                                </div>
                                <p className="text-[9px] text-[#00f2ff]/60 leading-normal font-sans italic">
                                  💡 Вставляйте обычные стандартные ссылки! Платформа самостоятельно отформатирует стандартные ссылки YouTube и Spotify во встроенные авторизованные аудио/видео-плееры.
                                </p>
                              </div>
                            )}

                            {block.type === 'status_api' && (
                              <div className="space-y-2.5">
                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Статус-сообщение для стриминга</label>
                                  <input
                                    type="text"
                                    value={block.statusCustomText || ''}
                                    onChange={e => updateBlock(block.id, { statusCustomText: e.target.value })}
                                    className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 text-xs text-white outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {block.type === 'html' && (
                              <div>
                                <label className="block text-[9px] uppercase text-neutral-500 mb-1 flex justify-between">
                                  <span>Интегрированный пользовательский HTML-код блока</span>
                                  <span className="text-yellow-400 text-[8px] font-bold">[ Без фильтрации скриптов ]</span>
                                </label>
                                <textarea
                                  value={block.htmlContent || ''}
                                  onChange={e => updateBlock(block.id, { htmlContent: e.target.value })}
                                  rows={5}
                                  placeholder="<div style='background: red;'>Custom block markup</div>"
                                  className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none font-mono text-[10px] outline-none text-white"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. ANALYTICS SECTOR */}
                {activeTab === 'analytics' && (
                  <AnalyticsView
                    analytics={analytics}
                    onRefresh={() => loadAnalytics(username)}
                  />
                )}

                {/* 6. SELF-HOST SECTOR */}
                {activeTab === 'selfhost' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Settings className="w-4 h-4" />
                      <span>Селф-хостинг и Экспорт профиля</span>
                    </h3>

                    <div className="space-y-4 text-xs">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-sm flex gap-3 items-start leading-relaxed font-sans text-neutral-300">
                        <Globe2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-white uppercase tracking-wider text-xs font-mono">Доменные настройки и экспорт</h4>
                          <p className="mt-1 text-[11px]">
                            Чтобы разместить этот профиль на собственном сервере, загрузите полную конфигурацию в виде переносимого файла JSON. Любой экземпляр Docker или Node.js, запущенный на базе нашей опенсорсной платформы, отобразит ваш профиль мгновенно при импорте этого файла!
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3 font-mono">
                        <span className="block text-[10px] uppercase text-neutral-500 font-bold">🛠️ Операции экспорта</span>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            type="button"
                            onClick={handleJSONExport}
                            className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-sm font-bold tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase"
                          >
                            <FileJson className="w-4 h-4" />
                            <span>Экспортировать конфигурацию в JSON</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-sm flex gap-3.5 items-start font-sans text-neutral-300">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-amber-300 uppercase tracking-widest font-mono text-[10px] italic">
                            Привязка домена второго уровня [Временно недоступно]
                          </h4>
                          <p className="text-[11px] mt-1">
                            Привязка пользовательских доменов (например, вашего личного бренда <code className="text-[#00f2ff]">mybrand.lol</code>) в настоящее время временно ограничена в контексте облачного контейнера. Пожалуйста, используйте стандартные пути субдоменов.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky bottom drawer control actions */}
              <div className="p-4 px-6 border-t border-white/10 bg-[#0c0c0c] flex justify-between items-center z-10">
                <span className="text-[10px] font-mono text-neutral-400 font-bold">
                  {saveStatus === 'saving' ? 'Сохранение настроек в базу данных...' :
                   saveStatus === 'success' ? '⚡ Конфигурация успешно синхронизирована!' :
                   saveStatus === 'error' ? '☠️ Ошибка при сохранении конфигурации' : 'Нажмите кнопку сохранения, чтобы применить изменения'}
                </span>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className={`px-5 py-3 rounded-sm text-xs font-black tracking-widest font-mono transition uppercase flex items-center space-x-2 cursor-pointer ${
                    saveStatus === 'success' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.35)]' :
                    saveStatus === 'error' ? 'bg-red-500 text-white' :
                    'bg-[#00f2ff] text-black hover:bg-[#00d0e0] shadow-[0_0_20px_rgba(0,242,255,0.3)]'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus === 'saving' ? 'Сохранение...' : 'Синхронизировать и Сохранить'}</span>
                </button>
              </div>
            </div>

            {/* Right Sector: Live Interactive Bio Preview Frame */}
            <div className="hidden lg:flex lg:w-[50%] bg-[#050505] flex-col overflow-hidden relative border-l border-white/10">
              <div className="p-4 bg-[#0c0c0c] border-b border-white/10 flex justify-between items-center px-6">
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 flex items-center space-x-1.5 uppercase font-bold tracking-wider">
                    <Monitor className="w-3.5 h-3.5 text-[#00f2ff]" />
                    <span>Режим Предпросмотра (В реальном времени)</span>
                  </span>
                </div>
                <div className="flex space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Bio Page renderer in sandbox state preview config mode */}
              <div className="flex-grow overflow-y-auto relative bg-[#040407]">
                <BioPage
                  username={username}
                  onExit={() => {}}
                  previewConfig={config}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* RENAME MODAL DIALOG OVERLAY */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
          <div className="bg-[#0b0b0f] border border-white/10 p-6 rounded-sm max-w-sm w-full space-y-4 font-mono text-white">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#00f2ff] flex items-center gap-1.5 italic">
              <Settings className="w-4 h-4 text-[#00f2ff]" />
              <span>Изменить имя пользователя</span>
            </h4>
            <p className="text-[10px] text-neutral-400 font-sans leading-normal">
              Введите новое имя пользователя. Ваш адрес страницы изменится мгновенно в базе данных. Все конфигурации будут сохранены.
            </p>
            <form onSubmit={handleRenameUsername} className="space-y-4 font-mono">
              <div>
                <label className="block text-[8px] uppercase text-neutral-500 font-bold mb-1.5">Новый адрес URL (SLUG)</label>
                <input
                  type="text"
                  placeholder="new_username_slug"
                  value={renameInput}
                  onChange={e => setRenameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="w-full bg-black border border-white/15 focus:border-[#00f2ff] p-2.5 rounded-sm text-xs outline-none text-white font-sans [color-scheme:dark]"
                />
              </div>

              {renameError && (
                <div className="text-[10px] text-red-400 font-sans p-2 bg-red-400/5 border border-red-400/10 rounded-sm">
                  ☠️ {renameError}
                </div>
              )}

              {renameSuccess && (
                <div className="text-[10px] text-emerald-400 font-sans p-2 bg-emerald-400/5 border border-emerald-400/10 rounded-sm">
                  ✓ Успешно переименовано! Перенаправление...
                </div>
              )}

              <div className="flex justify-end space-x-2 text-[10px] pt-1">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-sm font-bold uppercase transition text-neutral-400 hover:text-white cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={renameLoading}
                  className="px-4 py-2 bg-[#00f2ff] text-black font-black uppercase rounded-sm hover:bg-[#00d0e0] transition flex items-center space-x-1 cursor-pointer"
                >
                  {renameLoading ? (
                    <span className="w-3.5 h-3.5 border border-t-transparent border-black animate-spin rounded-full" />
                  ) : (
                    <span>Сохранить</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCORD CONNECTION INTEGRATION MODAL OVERLAY */}
      {isDiscordModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
          <div className="bg-[#0b0b0f] border border-[#5865f2]/20 p-6 rounded-sm max-w-sm w-full space-y-4 font-mono text-white shadow-[0_0_50px_rgba(88,101,242,0.15)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#5865f2] flex items-center gap-1.5 italic">
              <span>👾</span>
              <span>Discord Authorization popup</span>
            </h4>
            <p className="text-[10px] text-neutral-400 font-sans leading-normal">
              Authorize guns.lol integration node to connect your Discord active status and avatar badge? This updates profile statistics instantly!
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[8px] uppercase text-neutral-500 font-bold mb-1.5">DISCORD ИМЯ ПИЛЬЗОВАТЕЛЯ ИЛИ ID</label>
                <input
                  type="text"
                  placeholder="Например: username123 (без @) или ID..."
                  value={discordInput}
                  onChange={e => setDiscordInput(e.target.value.trim())}
                  className="w-full bg-black border border-white/15 focus:border-[#5865f2] p-2.5 rounded-sm text-xs outline-none text-white font-sans"
                />
              </div>

              <div className="flex justify-end space-x-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDiscordModalOpen(false);
                    setDiscordInput('');
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-sm font-bold uppercase transition text-neutral-400 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (discordInput.trim()) {
                      updateConfigValue('discordConnected', true);
                      updateConfigValue('discordId', discordInput.trim());
                      setDiscordInput('');
                      setIsDiscordModalOpen(false);
                    }
                  }}
                  className="px-4 py-2 bg-[#5865f2] text-white font-black uppercase rounded-sm hover:bg-[#4752c4] transition cursor-pointer"
                >
                  Авторизовать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATOR OR OTHER MODALS DELETED */}
    </div>
  );
}
