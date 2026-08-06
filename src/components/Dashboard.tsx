/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BioConfig, BlockConfig, SocialLink, AnalyticsSummary, BackgroundType, UserBadge } from '../types';
import AnalyticsView from './AnalyticsView';
import BioPage from './BioPage';
import QRCode from 'qrcode';
import { getThumbUrl } from '../utils/media';
import { parseGunsLolHtml, applyGunsImportToConfig, getImportPreviewSummary, getImportPreviewItems, type GunsImportResult, type ImportPreviewItem } from '../gunsImportMap';
import {
  GLOW_TARGET_LABELS,
  LOCATION_STYLE_LABELS,
  LAYOUT_SECTION_LABELS,
  EXTRA_TOGGLE_LABELS,
  LOCATION_ICON_LABELS,
  GLOW_INTENSITY_LABELS,
  LAYOUT_MODE_LABELS,
  VERIFIED_BADGE_LABELS,
  AUDIO_PLAYER_LABELS,
  TEXTBOX_STYLE_LABELS,
  ELEMENT_COLOR_LABELS,
  IMPORT_PREVIEW_STATUS_LABELS,
} from '../dashboardLabels';
import { resolveThemeColor, ELEMENT_COLOR_FIELDS, type ElementColorField } from '../themeColors';
import { NAME_EFFECT_GROUPS, NAME_EFFECT_CATALOG, getNameEffectHint } from '../utils/nameEffectCatalog';
import { SOCIAL_PLATFORMS, getPlatformBrandColor } from '../utils/socialPlatforms';
import SocialIcon from './SocialIcon';
import { Save, LogOut, Layout, Play, Activity, Music, Sparkles, Monitor, Code, Settings, Plus, Trash2, Check, User, Lock, ExternalLink, Globe2, AlertTriangle, FileJson, ArrowLeft, ArrowUp, ArrowDown, Image, Video, Layers, Sliders, Crown, Shield, Gem, Award, Star, Heart, Zap, Code2, Skull, Gamepad2, Coffee, Terminal, CheckCircle2, Flame, Upload, QrCode, Download, Palette, Copy } from 'lucide-react';

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

const PROFILE_PRESETS: Partial<BioConfig>[] = [
  { layoutMode: 'default', primaryColor: '#00f2ff', glowColor: '#00f2ff', bgType: 'stars', bgValue: '#0a0910', nameEffect: 'glow' },
  { layoutMode: 'compact', primaryColor: '#a855f7', glowColor: '#a855f7', bgType: 'aurora', bgValue: '#0c0a0f', mobileOptimized: true },
  { layoutMode: 'sleek', primaryColor: '#00ffcc', glowColor: '#00ffcc', bgType: 'matrix', bgValue: '#050505', profileGradientEnabled: true, profileGradientCss: 'linear-gradient(135deg, #00ffcc, #8b5cf6)' },
];

export default function Dashboard({ onExit, onViewProfile }: DashboardProps) {
  // Authentication States
  const [username, setUsername] = useState(localStorage.getItem('biogun_username') || '');
  const [token, setToken] = useState(localStorage.getItem('biogun_token') || '');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Profile configuration states
  const [config, setConfig] = useState<BioConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'layout' | 'background' | 'visuals' | 'glow' | 'audio' | 'blocks' | 'analytics' | 'selfhost' | 'qr'>('overview');
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
  const [uploadTarget, setUploadTarget] = useState<'avatarUrl' | 'bgValue' | 'audioUrl' | 'imageBlock' | 'playlistTrack' | 'customCursorUrl' | null>(null);
  const [uploadSongId, setUploadSongId] = useState<string | null>(null);
  const [uploadBlockId, setUploadBlockId] = useState<string | null>(null);

  // QR Code generator states
  const [qrText, setQrText] = useState('');
  const [qrFgColor, setQrFgColor] = useState('#00f2ff');
  const [qrBgColor, setQrBgColor] = useState('#050505');
  const [qrMargin, setQrMargin] = useState(2);
  const [qrErrorCorrection, setQrErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [qrIncludeAvatar, setQrIncludeAvatar] = useState(true);
  const [qrAvatarSize, setQrAvatarSize] = useState(0.18);
  const [qrCopied, setQrCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (username) {
      setQrText(`${window.location.origin}/u/${username}`);
    }
  }, [username]);

  useEffect(() => {
    if (activeTab === 'qr' && qrCanvasRef.current && qrText) {
      const renderQR = async () => {
        try {
          const canvas = qrCanvasRef.current!;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Clear previous canvas drawing fully to avoid traces
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          await QRCode.toCanvas(canvas, qrText, {
            width: 320,
            margin: qrMargin,
            color: {
              dark: qrFgColor,
              light: qrBgColor
            },
            errorCorrectionLevel: qrErrorCorrection
          });

          // Draw custom center avatar logo overlay if requested
          if (qrIncludeAvatar && config?.avatarUrl) {
            const img = new window.Image();
            img.crossOrigin = 'anonymous'; // request CORS access
            img.src = config.avatarUrl;
            img.onload = () => {
              const size = canvas.width;
              const logoSize = size * qrAvatarSize;
              const x = (size - logoSize) / 2;
              const y = (size - logoSize) / 2;

              // Draw solid background container behind the avatar to erase underlying QR dots
              ctx.fillStyle = qrBgColor;
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, (logoSize + 10) / 2, 0, Math.PI * 2);
              ctx.fill();

              // Draw circular clipped avatar
              ctx.save();
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, logoSize / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(img, x, y, logoSize, logoSize);
              ctx.restore();

              // Draw a border outline for better polish
              ctx.strokeStyle = qrFgColor;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, logoSize / 2, 0, Math.PI * 2);
              ctx.stroke();
            };
            img.onerror = () => {
              console.warn("Avatar image failed to load for QR Code overlay.");
            };
          }
        } catch (err) {
          console.error("Error drawing custom QR Code on canvas:", err);
        }
      };

      renderQR();
    }
  }, [activeTab, qrText, qrFgColor, qrBgColor, qrMargin, qrErrorCorrection, qrIncludeAvatar, qrAvatarSize, config?.avatarUrl]);

  const handleDownloadPNG = () => {
    if (!qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${username}_qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSVG = async () => {
    try {
      const svgString = await QRCode.toString(qrText, {
        type: 'svg',
        margin: qrMargin,
        color: {
          dark: qrFgColor,
          light: qrBgColor
        },
        errorCorrectionLevel: qrErrorCorrection
      });
      
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${username}_qr.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate SVG QR:", err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;

    const formData = new FormData();
    formData.append('file', file);

    const uploadTypeMap: Record<string, string> = {
      avatarUrl: 'avatar',
      bgValue: 'bg',
      imageBlock: 'image',
    };
    if (uploadTarget in uploadTypeMap) {
      formData.append('uploadType', uploadTypeMap[uploadTarget]);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('biogun_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) throw new Error('File too large. Maximum size is 50 MB.');
        throw new Error('Upload failed');
      }
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Server returned invalid data format: ' + text.slice(0, 30));
      }

      const fileBaseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

      if (uploadTarget === 'playlistTrack' && uploadSongId) {
        const list = (config?.playlist || []).map(s =>
          s.id === uploadSongId
            ? { ...s, url: data.url, title: s.title === 'Песня' || !s.title ? fileBaseName : s.title }
            : s
        );
        updateConfigValue('playlist', list);
      } else if (uploadTarget === 'imageBlock' && uploadBlockId) {
        updateBlock(uploadBlockId, { imageUrl: data.url });
      } else if (uploadTarget === 'customCursorUrl') {
        updateConfigValue('customCursorUrl', data.url);
      } else if (uploadTarget && uploadTarget !== 'playlistTrack' && uploadTarget !== 'imageBlock') {
        updateConfigValue(uploadTarget, data.url);
      }
      
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
      setUploadSongId(null);
      setUploadBlockId(null);
    }
  };

  // JSON configuration importer states and functions
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);
  const [jsonImportError, setJsonImportError] = useState('');
  const [jsonImportSuccess, setJsonImportSuccess] = useState('');

  const handleJSONImportClick = () => {
    setJsonImportError('');
    setJsonImportSuccess('');
    if (jsonImportInputRef.current) {
      jsonImportInputRef.current.click();
    }
  };

  const handleJSONImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedData = JSON.parse(text);

        if (!importedData || typeof importedData !== 'object') {
          throw new Error('Файл не содержит корректный JSON-объект');
        }

        const updatedConfig = {
          ...importedData,
          username: username
        };

        setConfig(updatedConfig);
        setJsonImportSuccess('Конфигурация успешно загружена в панель управления! Нажмите кнопку «Сохранить» в правом верхнем углу, чтобы применить её.');
      } catch (err: any) {
        console.error(err);
        setJsonImportError('Ошибка парсинга JSON: ' + (err.message || 'некорректный формат'));
      } finally {
        if (jsonImportInputRef.current) jsonImportInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Guns.lol direct importer states
  const [importGunsUsername, setImportGunsUsername] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importMethod, setImportMethod] = useState<'api' | 'html'>('html');
  const [importPreview, setImportPreview] = useState('');
  const [importPreviewItems, setImportPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [pendingImport, setPendingImport] = useState<GunsImportResult | null>(null);
  const [importProgress, setImportProgress] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

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

  const rehostImportPayload = async (parsed: GunsImportResult): Promise<GunsImportResult> => {
    const res = await fetch('/api/rehost-import-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        avatarUrl: parsed.avatarUrl,
        bgType: parsed.bgType,
        bgValue: parsed.bgValue,
        audioUrl: parsed.audioUrl,
        customCursorUrl: parsed.customCursorUrl,
        playlist: parsed.playlist,
      }),
    });
    const text = await res.text();
    let body: any = {};
    try { body = JSON.parse(text); } catch { /* ignore */ }
    if (!res.ok) throw new Error(body.error || 'Не удалось загрузить медиа на сервер');
    return { ...parsed, ...body.data, playlist: body.data?.playlist || parsed.playlist };
  };

  const showImportPreview = (parsed: GunsImportResult) => {
    setPendingImport(parsed);
    setImportPreviewItems(getImportPreviewItems(parsed));
    setImportPreview(getImportPreviewSummary(parsed));
  };

  const handleApplyImport = () => {
    if (!config || !pendingImport) return;
    setConfig(applyGunsImportToConfig(config, pendingImport));
    setImportSuccess(`Профиль применён! ${getImportPreviewSummary(pendingImport)}. Нажмите «Сохранить».`);
    setPendingImport(null);
    setImportPreviewItems([]);
    setImportPreview('');
    setPastedHtml('');
    setImportGunsUsername('');
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setImportPreviewItems([]);
    setImportPreview('');
    setImportError('');
  };

  // Handler to migrate/import configurations of user
  const handleImportFromGunsLol = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');
    setImportProgress('');
    handleCancelImport();

    if (!config) return;

    if (importMethod === 'html') {
      if (!pastedHtml.trim()) {
        setImportError('Пожалуйста, вставьте исходный HTML вашей страницы (Ctrl+U на guns.lol, скопируйте всё и вставьте сюда).');
        return;
      }
      try {
        setImportLoading(true);
        setImportProgress('Разбор HTML…');
        const parsed = parseGunsLolHtml(pastedHtml);
        setImportProgress('Загрузка медиа на сервер…');
        const withMedia = await rehostImportPayload(parsed);
        showImportPreview(withMedia);
      } catch (err: any) {
        setImportError(`Ошибка импорта: ${err.message}`);
      } finally {
        setImportLoading(false);
        setImportProgress('');
      }
    } else {
      if (!importGunsUsername.trim()) {
        setImportError('Пожалуйста, введите имя вашего профиля guns.lol');
        return;
      }
      setImportLoading(true);
      setImportProgress('Запрос к guns.lol…');
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
          setImportProgress('Обработка данных…');
          showImportPreview(resData.data);
        })
        .catch(err => {
          setImportError(err.message || 'Ошибка сервера. Переключитесь на «HTML (100% безотказно)» — это обходит Cloudflare.');
          setImportMethod('html');
        })
        .finally(() => {
          setImportLoading(false);
          setImportProgress('');
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
    const sessionToken = token || localStorage.getItem('biogun_token');
    if (sessionToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('biogun_token');
    localStorage.removeItem('biogun_username');
    setToken('');
    setUsername('');
    setConfig(null);
    setAnalytics(null);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      setPasswordChangeError('Заполните оба поля');
      return;
    }
    setPasswordChangeLoading(true);
    setPasswordChangeError('');
    fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка смены пароля');
        if (data.token) {
          localStorage.setItem('biogun_token', data.token);
          setToken(data.token);
        }
        setCurrentPassword('');
        setNewPassword('');
        alert('Пароль успешно изменён');
      })
      .catch(err => setPasswordChangeError(err.message))
      .finally(() => setPasswordChangeLoading(false));
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
          { id: Math.random().toString(), platform: 'discord', url: 'https://discord.gg/', useBrandColor: true }
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
      label: 'Мой сайт',
      glow: false,
      useBrandColor: true,
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
        accept={
          uploadTarget === 'audioUrl' || uploadTarget === 'playlistTrack'
            ? 'audio/*'
            : uploadTarget === 'imageBlock'
              ? 'image/*'
              : 'image/*,video/*'
        }
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
                  ⭐ <strong>Регистрация:</strong> если имя свободно — создаётся новый профиль. Пароль: минимум 8 символов, буквы и цифры.
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
              <div className="p-4 border-b border-white/10 bg-[#0c0c0c] grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
                {(['overview', 'profile', 'layout', 'background', 'visuals', 'glow', 'audio', 'blocks', 'analytics', 'selfhost', 'qr'] as const).map(tab => {
                  let tabName = '';
                  switch (tab) {
                    case 'overview': tabName = 'Обзор'; break;
                    case 'profile': tabName = 'Профиль'; break;
                    case 'layout': tabName = 'Макет'; break;
                    case 'background': tabName = 'Фон'; break;
                    case 'visuals': tabName = 'Эффекты'; break;
                    case 'glow': tabName = 'Glow'; break;
                    case 'audio': tabName = 'Аудио'; break;
                    case 'blocks': tabName = 'Блоки'; break;
                    case 'analytics': tabName = 'Статистика'; break;
                    case 'selfhost': tabName = 'Экспорт'; break;
                    case 'qr': tabName = 'QR'; break;
                    default: tabName = tab;
                  }
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`p-2 py-2.5 rounded-sm transition font-black uppercase tracking-widest cursor-pointer text-[8px] sm:text-[9px] ${
                        activeTab === tab ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {tabName}
                    </button>
                  );
                })}
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
                            src={getThumbUrl(config.avatarUrl)}
                            alt="avatar"
                            referrerPolicy="no-referrer"
                            loading="lazy"
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

                      <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5" />
                          Безопасность аккаунта
                        </h4>
                        <p className="text-[9px] text-neutral-500">Смена пароля завершит все другие активные сессии.</p>
                        {passwordChangeError && (
                          <p className="text-[10px] text-red-400 font-mono">{passwordChangeError}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="password"
                            placeholder="Текущий пароль"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="bg-black/50 border border-white/15 rounded-sm p-2.5 text-xs text-white outline-none focus:border-[#00f2ff]"
                          />
                          <input
                            type="password"
                            placeholder="Новый пароль (8+ символов, буквы и цифры)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="bg-black/50 border border-white/15 rounded-sm p-2.5 text-xs text-white outline-none focus:border-[#00f2ff]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleChangePassword}
                          disabled={passwordChangeLoading}
                          className="px-4 py-2 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[10px] text-[#00f2ff] font-bold uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50"
                        >
                          {passwordChangeLoading ? 'Сохранение...' : 'Сменить пароль'}
                        </button>
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
                                    disabled={importLoading || !!pendingImport}
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
                                  Может не сработать из-за Cloudflare. Если ошибка — используйте HTML-импорт.
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="block text-[9px] text-neutral-500 uppercase font-black">Вставьте исходный код страницы (HTML)</label>
                                <ol className="text-[9px] text-neutral-500 space-y-0.5 list-decimal list-inside font-sans leading-relaxed">
                                  <li>Откройте свой профиль на guns.lol в браузере</li>
                                  <li>Нажмите Ctrl+U (просмотр кода страницы)</li>
                                  <li>Выделите всё (Ctrl+A) и скопируйте (Ctrl+C)</li>
                                  <li>Вставьте код в поле ниже и нажмите «Разобрать»</li>
                                </ol>
                                <textarea
                                  placeholder="Вставьте сюда полный HTML-код страницы guns.lol…"
                                  value={pastedHtml}
                                  onChange={e => setPastedHtml(e.target.value)}
                                  rows={4}
                                  className="w-full bg-black/50 border border-white/10 focus:border-[#00f2ff] rounded-sm p-3 text-xs text-neutral-300 font-mono outline-none placeholder-neutral-800"
                                />
                                <div className="flex justify-between items-center gap-4">
                                  <span className="text-[9.5px] leading-snug text-neutral-500">
                                    Обходит Cloudflare. Медиа загружаются на ваш сервер автоматически.
                                  </span>
                                  <button
                                    type="submit"
                                    disabled={importLoading || !!pendingImport}
                                    className="px-6 py-2.5 bg-[#00f2ff] text-black font-black text-[10px] uppercase tracking-wider rounded-sm hover:bg-[#00d0e0] active:scale-95 transition-all text-center flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.25)] flex-shrink-0"
                                  >
                                    {importLoading ? (
                                      <span className="w-3.5 h-3.5 border-2 border-t-black border-transparent animate-spin rounded-full" />
                                    ) : (
                                      <span>Разобрать</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </form>

                          {importProgress && (
                            <div className="p-2.5 bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 rounded-sm text-[10px] font-mono flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-t-cyan-400 border-transparent animate-spin rounded-full flex-shrink-0" />
                              {importProgress}
                            </div>
                          )}

                          {pendingImport && importPreviewItems.length > 0 && (
                            <div className="p-3.5 bg-black/60 border border-[#00f2ff]/25 rounded-sm space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase text-[#00f2ff] tracking-wider">Предпросмотр импорта</span>
                                <span className="text-[9px] text-neutral-500">{pendingImport.displayName}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {importPreviewItems.map(item => (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-2 p-2 rounded-sm border text-[9px] ${
                                      item.status === 'found'
                                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                                        : item.status === 'partial'
                                          ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                                          : 'bg-neutral-500/5 border-white/5 text-neutral-500'
                                    }`}
                                  >
                                    <span className="font-black flex-shrink-0">
                                      {item.status === 'found' ? '✓' : item.status === 'partial' ? '~' : '✗'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        {item.color && (
                                          <span
                                            className="w-3 h-3 rounded-sm border border-white/20 flex-shrink-0"
                                            style={{ backgroundColor: item.color }}
                                          />
                                        )}
                                        <span className="font-bold uppercase tracking-wide">{item.label}</span>
                                        <span className="text-[8px] opacity-60">({IMPORT_PREVIEW_STATUS_LABELS[item.status]})</span>
                                      </div>
                                      {item.detail && <p className="text-neutral-400 truncate mt-0.5">{item.detail}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleApplyImport}
                                  className="flex-1 py-2 bg-[#00f2ff] text-black font-black text-[10px] uppercase rounded-sm hover:bg-[#00d0e0] transition"
                                >
                                  Применить к профилю
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelImport}
                                  className="px-4 py-2 bg-black/40 border border-white/10 text-neutral-400 font-bold text-[10px] uppercase rounded-sm hover:text-white transition"
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          )}

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
                          {importPreview && !pendingImport && (
                            <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 rounded-sm text-[10px] font-mono">
                              {importPreview}
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
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Верификация</label>
                          <div
                            className={`w-full py-2.5 rounded-sm border font-black tracking-widest text-[10px] uppercase text-center ${
                              config.verified ? 'bg-[#00f2ff]/10 border-[#00f2ff]/50 text-[#00f2ff]' : 'bg-black/25 border-white/5 text-neutral-600'
                            }`}
                          >
                            {config.verified ? '[ ВЕРИФИЦИРОВАН АДМИНОМ ]' : '[ НЕТ ВЕРИФИКАЦИИ ]'}
                          </div>
                          <span className="block text-[8px] text-neutral-600 mt-1 uppercase text-center font-mono">Выдается только администратором</span>
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
                          {config.snowEffectsEnabled && (
                            <select
                              value={config.snowIntensity || 'medium'}
                              onChange={e => updateConfigValue('snowIntensity', e.target.value)}
                              className="w-full mt-2 bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none cursor-pointer"
                            >
                              <option value="low">Низкая интенсивность</option>
                              <option value="medium">Средняя</option>
                              <option value="high">Высокая</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {config.sparkles && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Стиль искр</label>
                            <select
                              value={config.sparkleStyle || 'stars'}
                              onChange={e => updateConfigValue('sparkleStyle', e.target.value)}
                              className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none cursor-pointer"
                            >
                              <option value="stars">Звёзды</option>
                              <option value="dots">Точки</option>
                              <option value="hearts">Сердечки</option>
                              <option value="crosses">Кресты</option>
                              <option value="neon">Неон</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Интенсивность искр</label>
                            <select
                              value={config.sparkleIntensity || 'medium'}
                              onChange={e => updateConfigValue('sparkleIntensity', e.target.value)}
                              className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none cursor-pointer"
                            >
                              <option value="low">Низкая</option>
                              <option value="medium">Средняя</option>
                              <option value="high">Высокая</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 pt-4 pb-2">
                         <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Эффект имени</label>
                          <select
                            value={config.nameEffect || 'none'}
                            onChange={e => updateConfigValue('nameEffect', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none text-white text-xs cursor-pointer"
                          >
                            {NAME_EFFECT_GROUPS.map(group => (
                              <optgroup key={group} label={group}>
                                {NAME_EFFECT_CATALOG.filter(e => e.group === group).map(e => (
                                  <option key={e.id} value={e.id}>{e.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <p className="text-[9px] text-neutral-500 mt-1.5 leading-relaxed">{getNameEffectHint(config.nameEffect)}</p>
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
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Текст на клик-заставке</label>
                        <input
                          type="text"
                          value={config.enterText}
                          onChange={e => updateConfigValue('enterText', e.target.value)}
                          placeholder="Войти"
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-3 focus:outline-none placeholder-neutral-700 text-white text-xs"
                        />
                        <p className="text-[9px] text-neutral-500 mt-1">Экран перед входом на профиль. Всегда включён — настройте только текст.</p>
                      </div>

                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Строка локации</label>
                          <button
                            type="button"
                            onClick={() => updateConfigValue('locationEnabled', !config.locationEnabled)}
                            className={`px-3 py-1 rounded-sm border text-[9px] font-bold uppercase cursor-pointer ${
                              config.locationEnabled ? 'bg-[#00f2ff]/10 border-[#00f2ff]/40 text-[#00f2ff]' : 'bg-black/25 border-white/10 text-neutral-500'
                            }`}
                          >
                            {config.locationEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                          </button>
                        </div>
                        <p className="text-[9px] text-neutral-500">Показывает город или страну под именем.</p>
                        {config.locationEnabled && (
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              placeholder="Москва / Россия"
                              value={config.locationText || ''}
                              onChange={e => updateConfigValue('locationText', e.target.value)}
                              className="w-full bg-black/50 border border-white/15 rounded-sm p-2.5 text-xs text-white outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={config.locationIcon || 'pin'}
                                onChange={e => updateConfigValue('locationIcon', e.target.value)}
                                className="bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none cursor-pointer"
                              >
                                {Object.entries(LOCATION_ICON_LABELS).map(([id, label]) => (
                                  <option key={id} value={id}>{label}</option>
                                ))}
                              </select>
                              <select
                                value={config.locationStyle || 'pill'}
                                onChange={e => updateConfigValue('locationStyle', e.target.value)}
                                className="bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none cursor-pointer"
                              >
                                {Object.entries(LOCATION_STYLE_LABELS).map(([id, meta]) => (
                                  <option key={id} value={id}>{meta.label}</option>
                                ))}
                              </select>
                            </div>
                            {config.locationStyle && LOCATION_STYLE_LABELS[config.locationStyle] && (
                              <p className="text-[9px] text-neutral-500">{LOCATION_STYLE_LABELS[config.locationStyle].hint}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Дополнительно</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(['showViewsCounter', 'showUid', 'monochromeMode', 'parallaxEnabled', 'avatarGlowEnabled', 'linkHoverGlow'] as const).map((key) => {
                            const meta = EXTRA_TOGGLE_LABELS[key];
                            return (
                            <div key={key} className="space-y-1">
                              <button
                                type="button"
                                onClick={() => updateConfigValue(key, !config[key])}
                                className={`w-full py-2 px-2 rounded-sm border text-[8px] font-bold uppercase cursor-pointer ${
                                  config[key] ? 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]' : 'bg-black/20 border-white/10 text-neutral-500'
                                }`}
                              >
                                {meta.label}
                              </button>
                              <p className="text-[8px] text-neutral-600 leading-snug px-0.5">{meta.hint}</p>
                            </div>
                          );})}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            placeholder="Заголовок вкладки браузера"
                            value={config.customPageTitle || ''}
                            onChange={e => updateConfigValue('customPageTitle', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none"
                          />
                          <input
                            type="text"
                            placeholder="URL иконки вкладки (favicon)"
                            value={config.customFaviconUrl || ''}
                            onChange={e => updateConfigValue('customFaviconUrl', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="URL кастомного курсора"
                              value={config.customCursorUrl || ''}
                              onChange={e => updateConfigValue('customCursorUrl', e.target.value)}
                              className="flex-grow bg-black/50 border border-white/15 rounded-sm p-2 text-[10px] text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => { setUploadTarget('customCursorUrl'); fileInputRef.current?.click(); }}
                              className="px-3 py-2 bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] text-[9px] font-bold uppercase rounded-sm cursor-pointer"
                            >
                              ФАЙЛ
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CUSTOM TRANSPARENT BADGES SYSTEM CONSTRUCTOR — временно отключено */}
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                      <div className="p-3 bg-black/30 border border-white/10 rounded-sm">
                        <h4 className="text-xs font-black font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 italic">
                          <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Бейджи профиля</span>
                        </h4>
                        <p className="text-[10px] text-neutral-500 mt-1">Временно отключены — скоро вернутся.</p>
                      </div>
                      {false && (
                      <>
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
                                  {/* Presets Selector */}
                                  <div className="sm:col-span-2 border-b border-white/5 pb-2">
                                    <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1">Применить готовый шаблон бейджа</label>
                                    <select
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'verified') {
                                          handleUpdateBadge(badge.id, { label: 'Verified', description: 'Официально верифицированный профиль', icon: 'shieldcheck', glow: true, glowColor: '#00f2ff' });
                                        } else if (val === 'premium') {
                                          handleUpdateBadge(badge.id, { label: 'Premium', description: 'Премиум-подписка Pro', icon: 'gem', glow: true, glowColor: '#a855f7' });
                                        } else if (val === 'vip') {
                                          handleUpdateBadge(badge.id, { label: 'VIP', description: 'Особо важный гость (VIP)', icon: 'crown', glow: true, glowColor: '#eab308' });
                                        } else if (val === 'seller') {
                                          handleUpdateBadge(badge.id, { label: 'Seller', description: 'Проверенный продавец платформы', icon: 'award', glow: true, glowColor: '#22c55e' });
                                        } else if (val === 'designer') {
                                          handleUpdateBadge(badge.id, { label: 'Designer', description: 'Официальный дизайнер проектов', icon: 'heart', glow: true, glowColor: '#ec4899' });
                                        } else if (val === 'sponsor') {
                                          handleUpdateBadge(badge.id, { label: 'Sponsor', description: 'Почетный спонсор и меценат', icon: 'star', glow: true, glowColor: '#f97316' });
                                        } else if (val === 'coder') {
                                          handleUpdateBadge(badge.id, { label: 'Developer', description: 'Разработчик и создатель кода', icon: 'code', glow: true, glowColor: '#3b82f6' });
                                        }
                                        e.target.value = ''; // Reset
                                      }}
                                      className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm py-1 px-2 text-[10px] text-[#00f2ff] focus:outline-none cursor-pointer"
                                    >
                                      <option value="">-- Выберите шаблон для автозаполнения --</option>
                                      <option value="verified">✅ Верифицирован (Verified)</option>
                                      <option value="premium">💎 Премиум (Premium Pro)</option>
                                      <option value="vip">👑 Особо Важная Персона (VIP)</option>
                                      <option value="seller">🎖️ Проверенный Продавец (Seller)</option>
                                      <option value="designer">❤️ Креативный Дизайнер (Designer)</option>
                                      <option value="sponsor">⭐ Почетный Спонсор (Sponsor)</option>
                                      <option value="coder">💻 Профессиональный Разработчик (Developer)</option>
                                    </select>
                                  </div>

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
                      </>
                      )}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase mb-1 font-bold">Режим layout</label>
                        <select value={config.layoutMode || 'default'} onChange={e => updateConfigValue('layoutMode', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white">
                          {Object.entries(LAYOUT_MODE_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase mb-1 font-bold">Верификация</label>
                        <select value={config.verifiedBadgeStyle || 'inline'} onChange={e => updateConfigValue('verifiedBadgeStyle', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white">
                          {Object.entries(VERIFIED_BADGE_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button type="button" onClick={() => updateConfigValue('mobileOptimized', config.mobileOptimized === false ? true : false)} className={`w-full py-2 rounded-sm border text-[10px] font-bold uppercase ${config.mobileOptimized !== false ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'}`}>
                      Мобильная оптимизация: {config.mobileOptimized !== false ? 'ВКЛ' : 'ВЫКЛ'}
                    </button>
                    <p className="text-[10px] text-neutral-400 font-sans leading-normal">
                      Настройте порядок отображения элементов на вашей био-странице.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-sm p-4 text-[10px]">
                      {(config.layout || ['avatar', 'username', 'location', 'badges', 'discord', 'bio', 'blocks', 'player']).map((item, index, arr) => (
                        <div key={item} className="flex items-center justify-between bg-black/40 border border-white/5 p-2.5 mb-2 rounded-sm last:mb-0">
                          <span className="font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2">
                             {LAYOUT_SECTION_LABELS[item] || item}
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
                            { key: 'video', label: 'Video' },
                            { key: 'matrix', label: 'Matrix' },
                            { key: 'stars', label: 'Stars' },
                            { key: 'rain', label: 'Rain' },
                            { key: 'particles', label: 'Particles' },
                            { key: 'snow', label: 'Snow BG' },
                            { key: 'aurora', label: 'Aurora' },
                            { key: 'plasma', label: 'Plasma' },
                            { key: 'dither', label: 'Dither' }
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
                      {['color', 'gradient', 'image', 'video'].includes(config.bgType) && (
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">
                            {config.bgType === 'color' ? 'HTML Hex-Код цвета' :
                             config.bgType === 'gradient' ? 'CSS Линейный градиент' :
                             config.bgType === 'video' ? 'URL видеофона (MP4/WebM)' : 'Ссылка на фоновую картинку'}
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
                          {config.bgType === 'video' && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => updateConfigValue('bgVideoAudioEnabled', !config.bgVideoAudioEnabled)}
                                className={`py-2 rounded-sm border text-[9px] font-bold uppercase cursor-pointer ${
                                  config.bgVideoAudioEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'
                                }`}
                              >
                                Звук видео
                              </button>
                              <button
                                type="button"
                                onClick={() => updateConfigValue('bgVideoUseAsAudio', !config.bgVideoUseAsAudio)}
                                className={`py-2 rounded-sm border text-[9px] font-bold uppercase cursor-pointer ${
                                  config.bgVideoUseAsAudio ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'
                                }`}
                              >
                                Видео = аудио
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {['matrix', 'stars', 'rain', 'particles'].includes(config.bgType) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Цвет эффекта</label>
                            <input
                              type="color"
                              value={config.bgEffectColor || config.primaryColor || '#00f2ff'}
                              onChange={e => updateConfigValue('bgEffectColor', e.target.value)}
                              className="w-full h-9 bg-black/50 border border-white/15 rounded-sm cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Интенсивность</label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={config.bgEffectIntensity || 5}
                              onChange={e => updateConfigValue('bgEffectIntensity', parseInt(e.target.value))}
                              className="w-full accent-[#00f2ff]"
                            />
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
                      <div className="grid grid-cols-1 gap-4">
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

                        <div className="border-t border-white/10 pt-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-[10px] uppercase text-[#00f2ff] font-black tracking-widest italic">Цвета элементов</h4>
                            <button
                              type="button"
                              onClick={() => {
                                const cleared = { ...config };
                                ELEMENT_COLOR_FIELDS.forEach(field => {
                                  delete (cleared as Record<string, unknown>)[field];
                                });
                                delete cleared.sparkleColor;
                                setConfig(cleared);
                              }}
                              className="text-[8px] uppercase font-bold text-neutral-500 hover:text-[#00f2ff] transition"
                            >
                              Сбросить к основному
                            </button>
                          </div>
                          <p className="text-[9px] text-neutral-500 leading-relaxed">
                            Настройте цвет каждого элемента отдельно. Если не задан — используется «Свечение (Основной)».
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {([...ELEMENT_COLOR_FIELDS, 'sparkleColor'] as const).map(field => {
                              const meta = ELEMENT_COLOR_LABELS[field];
                              const value = (config as Record<string, string | undefined>)[field] || config.primaryColor;
                              return (
                                <div key={field} className="p-2.5 bg-black/30 border border-white/10 rounded-sm space-y-1.5">
                                  <span className="text-[9px] block text-neutral-400 font-bold uppercase tracking-wide">{meta.label}</span>
                                  <input
                                    type="color"
                                    value={value}
                                    onChange={e => updateConfigValue(field as ElementColorField | 'sparkleColor', e.target.value)}
                                    className="w-full h-9 bg-transparent border-0 cursor-pointer"
                                  />
                                  <span className="text-[8px] text-neutral-600 block leading-snug">{meta.hint}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="p-3 bg-black/40 border border-white/10 rounded-sm flex items-center gap-4">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5" style={{ color: resolveThemeColor(config, 'verifiedBadge') }} />
                              <span className="text-[9px] text-neutral-500 uppercase font-bold">Галочка</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: resolveThemeColor(config, 'player') }} />
                              </div>
                              <span className="text-[8px] text-neutral-600 mt-1 block uppercase">Плеер</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-full border" style={{ borderColor: `${resolveThemeColor(config, 'location')}44`, color: resolveThemeColor(config, 'location') }}>
                              <Globe2 className="w-3 h-3" />
                              <span className="text-[8px] font-mono uppercase">LOC</span>
                            </div>
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

                {/* GLOW SETTINGS SECTOR */}
                {activeTab === 'glow' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                      <Sparkles className="w-4 h-4" />
                      <span>Настройки свечения</span>
                    </h3>
                    <div className="space-y-4 font-mono text-xs">
                      <button type="button" onClick={() => updateConfigValue('glowEnabled', !config.glowEnabled)} className={`w-full py-2 rounded-sm border text-[10px] font-bold uppercase ${config.glowEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'}`}>
                        Общее свечение: {config.glowEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                      </button>
                      <p className="text-[9px] text-neutral-500 -mt-2">Подсветка элементов профиля неоновым свечением.</p>
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase mb-1 font-bold">Сила</label>
                        <select value={config.glowIntensity || 'medium'} onChange={e => updateConfigValue('glowIntensity', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white">
                          {Object.entries(GLOW_INTENSITY_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase mb-1 font-bold">Где светится</label>
                        <div className="flex flex-wrap gap-2">
                          {(['avatar', 'username', 'location', 'badges', 'links', 'card'] as const).map(t => (
                            <button key={t} type="button" onClick={() => {
                              const cur = config.glowTargets || ['avatar', 'username', 'badges', 'links'];
                              updateConfigValue('glowTargets', cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]);
                            }} className={`px-2 py-1 rounded-sm border text-[9px] uppercase ${(config.glowTargets || ['avatar', 'username', 'badges', 'links']).includes(t) ? 'bg-[#00f2ff] text-black' : 'bg-black/40 border-white/10 text-neutral-400'}`}>
                              {GLOW_TARGET_LABELS[t] || t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => updateConfigValue('profileGradientEnabled', !config.profileGradientEnabled)} className={`w-full py-2 rounded-sm border text-[10px] font-bold uppercase ${config.profileGradientEnabled ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-black/20 border-white/10 text-neutral-500'}`}>
                        Градиент карточки: {config.profileGradientEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                      </button>
                      {config.profileGradientEnabled && (
                        <input type="text" value={config.profileGradientCss || ''} onChange={e => updateConfigValue('profileGradientCss', e.target.value)} placeholder="linear-gradient(...)" className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white" />
                      )}
                      <button type="button" onClick={() => updateConfigValue('swapBoxColors', !config.swapBoxColors)} className={`w-full py-2 rounded-sm border text-[10px] font-bold uppercase ${config.swapBoxColors ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-black/20 border-white/10 text-neutral-500'}`}>
                        Поменять цвета блоков: {config.swapBoxColors ? 'ВКЛ' : 'ВЫКЛ'}
                      </button>
                      <div className="border-t border-white/10 pt-3 space-y-2">
                        <h4 className="text-[10px] uppercase text-[#00f2ff] font-black">Шаблоны профиля</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {PROFILE_PRESETS.map((preset, i) => (
                            <button key={i} type="button" onClick={() => setConfig({ ...config, ...preset })} className="py-2 px-3 bg-black/40 border border-white/10 hover:border-[#00f2ff]/40 rounded-sm text-[10px] text-left text-neutral-300">
                              Шаблон {i + 1}: {LAYOUT_MODE_LABELS[preset.layoutMode || 'default']} / {preset.bgType}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-white/10 pt-3 space-y-2">
                        <h4 className="text-[10px] uppercase text-[#00f2ff] font-black">Мета для соцсетей</h4>
                        <p className="text-[9px] text-neutral-500">Как профиль выглядит при шаринге в Discord, Telegram и т.д.</p>
                        <input type="text" placeholder="Заголовок (og:title)" value={config.ogTitle || ''} onChange={e => updateConfigValue('ogTitle', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white mb-2" />
                        <input type="text" placeholder="Описание (og:description)" value={config.ogDescription || ''} onChange={e => updateConfigValue('ogDescription', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white mb-2" />
                        <input type="text" placeholder="Картинка превью (og:image URL)" value={config.ogImage || ''} onChange={e => updateConfigValue('ogImage', e.target.value)} className="w-full bg-black/50 border border-white/15 rounded-sm p-2 text-xs text-white" />
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Музыка вкл</label>
                          <button
                            type="button"
                            onClick={() => updateConfigValue('audioEnabled', !config.audioEnabled)}
                            className={`w-full py-2.5 rounded-sm border font-black text-[10px] uppercase transition tracking-widest cursor-pointer ${
                              config.audioEnabled ? 'bg-[#00f2ff]/10 border-[#00f2ff]/40 text-[#00f2ff]' : 'bg-black/20 border-white/10 text-neutral-500'
                            }`}
                          >
                            {config.audioEnabled ? '[ ВКЛЮЧЕНО ]' : '[ ВЫКЛЮЧЕНО ]'}
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Режим источника</label>
                          <select
                            value={config.audioSourceMode || 'single'}
                            onChange={e => updateConfigValue('audioSourceMode', e.target.value)}
                            className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none cursor-pointer"
                          >
                            <option value="single">1 файл</option>
                            <option value="playlist">Плейлист</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Регулятор громкости</label>
                        <button type="button" onClick={() => updateConfigValue('volumeControlVisible', !config.volumeControlVisible)} className={`w-full py-2 rounded-sm border text-[10px] font-bold uppercase ${config.volumeControlVisible ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'}`}>
                          {config.volumeControlVisible ? 'Показан' : 'Скрыт'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Режим плеера</label>
                        <select
                          value={config.audioPlayerMode || 'minimal'}
                          onChange={e => updateConfigValue('audioPlayerMode', e.target.value)}
                          className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none cursor-pointer"
                        >
                          {Object.entries(AUDIO_PLAYER_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {(config.audioSourceMode || 'single') === 'single' ? (
                        <div className="space-y-3 p-3 bg-white/[0.02] border border-white/10 rounded-sm">
                          <div>
                            <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Аудиофайл (URL или загрузка)</label>
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Название</label>
                              <input
                                type="text"
                                value={config.audioTitle}
                                onChange={e => updateConfigValue('audioTitle', e.target.value)}
                                className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Исполнитель</label>
                              <input
                                type="text"
                                value={config.audioArtist}
                                onChange={e => updateConfigValue('audioArtist', e.target.value)}
                                className="w-full bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2.5 text-xs text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Треки плейлиста</label>
                            <button
                              type="button"
                              onClick={() => {
                                const list = config.playlist || [];
                                updateConfigValue('playlist', [...list, {
                                  id: `song-${Date.now()}`,
                                  url: '',
                                  title: 'Песня',
                                  artist: 'Исполнитель'
                                }]);
                              }}
                              className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-[9px] font-bold uppercase rounded-sm cursor-pointer"
                            >
                              + Трек
                            </button>
                          </div>
                          {(!config.playlist || config.playlist.length === 0) ? (
                            <div className="p-4 bg-white/[0.01] border border-white/5 rounded-sm text-center text-neutral-500 text-[10px]">
                              Плейлист пуст. Добавьте треки и загрузите MP3 на каждый.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {config.playlist.map((song, sIdx) => (
                                <div key={song.id} className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/10 rounded-sm group">
                                  <div className="w-8 h-8 rounded-sm bg-[#00f2ff]/10 border border-[#00f2ff]/20 flex items-center justify-center flex-shrink-0">
                                    <Music className="w-3.5 h-3.5 text-[#00f2ff]" />
                                  </div>
                                  <div className="flex-grow min-w-0 grid grid-cols-2 gap-1.5">
                                    <input
                                      type="text"
                                      value={song.title}
                                      onChange={e => {
                                        const list = (config.playlist || []).map(s => s.id === song.id ? { ...s, title: e.target.value } : s);
                                        updateConfigValue('playlist', list);
                                      }}
                                      className="bg-black/50 border border-white/10 rounded-sm px-2 py-1 text-[10px] text-white outline-none"
                                      placeholder="Title"
                                    />
                                    <input
                                      type="text"
                                      value={song.artist}
                                      onChange={e => {
                                        const list = (config.playlist || []).map(s => s.id === song.id ? { ...s, artist: e.target.value } : s);
                                        updateConfigValue('playlist', list);
                                      }}
                                      className="bg-black/50 border border-white/10 rounded-sm px-2 py-1 text-[10px] text-white outline-none"
                                      placeholder="Artist"
                                    />
                                    <input
                                      type="text"
                                      value={song.url}
                                      onChange={e => {
                                        const list = (config.playlist || []).map(s => s.id === song.id ? { ...s, url: e.target.value } : s);
                                        updateConfigValue('playlist', list);
                                      }}
                                      className="col-span-2 bg-black/50 border border-white/10 rounded-sm px-2 py-1 text-[10px] text-neutral-400 outline-none truncate"
                                      placeholder="URL или загрузите файл"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => { setUploadTarget('playlistTrack'); setUploadSongId(song.id); fileInputRef.current?.click(); }}
                                      className="px-2 py-1 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] text-[8px] font-bold uppercase rounded-sm cursor-pointer"
                                    >
                                      ФАЙЛ
                                    </button>
                                    <button
                                      type="button"
                                      disabled={sIdx === 0}
                                      onClick={() => {
                                        const list = [...(config.playlist || [])];
                                        [list[sIdx - 1], list[sIdx]] = [list[sIdx], list[sIdx - 1]];
                                        updateConfigValue('playlist', list);
                                      }}
                                      className="p-0.5 bg-white/5 hover:bg-white/10 disabled:opacity-25 rounded-sm text-[8px] cursor-pointer"
                                    >▲</button>
                                    <button
                                      type="button"
                                      disabled={sIdx === (config.playlist || []).length - 1}
                                      onClick={() => {
                                        const list = [...(config.playlist || [])];
                                        [list[sIdx], list[sIdx + 1]] = [list[sIdx + 1], list[sIdx]];
                                        updateConfigValue('playlist', list);
                                      }}
                                      className="p-0.5 bg-white/5 hover:bg-white/10 disabled:opacity-25 rounded-sm text-[8px] cursor-pointer"
                                    >▼</button>
                                    <button
                                      type="button"
                                      onClick={() => updateConfigValue('playlist', (config.playlist || []).filter(s => s.id !== song.id))}
                                      className="p-0.5 bg-red-950/40 border border-red-500/20 text-red-400 rounded-sm text-[8px] cursor-pointer"
                                    >✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateConfigValue('hidePlayerUntilHover', !config.hidePlayerUntilHover)}
                          className={`flex-1 py-2 rounded-sm border text-[9px] font-bold uppercase cursor-pointer ${
                            config.hidePlayerUntilHover ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'
                          }`}
                        >
                          Плеер при hover
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfigValue('rememberVolume', !config.rememberVolume)}
                          className={`flex-1 py-2 rounded-sm border text-[9px] font-bold uppercase cursor-pointer ${
                            config.rememberVolume ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'
                          }`}
                        >
                          Запомнить громкость
                        </button>
                      </div>

                      <details className="border-t border-white/5 pt-4">
                        <summary className="text-[11px] font-black uppercase tracking-widest text-[#00f2ff] cursor-pointer flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          Аудио визуализатор
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => updateConfigValue('audioVisualizerEnabled', config.audioVisualizerEnabled === false)}
                              className={`py-2 rounded-sm border text-[10px] font-black uppercase cursor-pointer ${
                                config.audioVisualizerEnabled !== false ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/10 text-neutral-500'
                              }`}
                            >
                              {config.audioVisualizerEnabled !== false ? '[ АКТИВЕН ]' : '[ ВЫКЛЮЧЕН ]'}
                            </button>
                            <select
                              value={config.audioVisualizerStyle || 'bars'}
                              onChange={e => updateConfigValue('audioVisualizerStyle', e.target.value)}
                              className="bg-black border border-white/15 rounded-sm p-2 text-xs text-white outline-none"
                            >
                              <option value="bars">Neon Bars</option>
                              <option value="wave">Soundwave</option>
                              <option value="retro">8-Bit Blocks</option>
                              <option value="circular">Cosmic Circle</option>
                              <option value="mirror">Mirror Bars</option>
                              <option value="oscilloscope">Oscilloscope</option>
                              <option value="particles">Particles</option>
                              <option value="aurora">Aurora</option>
                              <option value="pulse">Pulse Rings</option>
                            </select>
                          </div>
                        </div>
                      </details>
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
                                      <div className="grid grid-cols-[auto_1fr_1fr] gap-2.5 items-center">
                                        <div
                                          className="w-9 h-9 rounded-sm border border-white/10 flex items-center justify-center flex-shrink-0"
                                          style={{ color: soc.useBrandColor !== false ? getPlatformBrandColor(soc.platform) : (soc.iconColor || '#ffffff') }}
                                        >
                                          <SocialIcon platform={soc.platform} className="w-4 h-4" />
                                        </div>
                                        <select
                                          value={soc.platform}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { platform: e.target.value as any })}
                                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] font-bold text-white focus:border-[#00f2ff] outline-none"
                                        >
                                          {SOCIAL_PLATFORMS.map(p => (
                                            <option key={p.id} value={p.id}>{p.label}</option>
                                          ))}
                                        </select>

                                        <input
                                          type="text"
                                          placeholder="Подпись (необязательно)"
                                          value={soc.label || ''}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { label: e.target.value })}
                                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] placeholder-neutral-700 text-white outline-none focus:border-[#00f2ff]"
                                        />
                                      </div>

                                      <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                          type="text"
                                          placeholder="Ссылка (https://...)"
                                          value={soc.url}
                                          onChange={e => handleUpdateSocialLink(block.id, soc.id, { url: e.target.value })}
                                          className="flex-grow min-w-[140px] bg-black border border-white/10 rounded-sm px-2.5 py-1 text-[11px] placeholder-neutral-700 focus:border-[#00f2ff] outline-none text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSocialLink(block.id, soc.id, { useBrandColor: soc.useBrandColor === false })}
                                          className={`px-2 py-1 rounded-sm border text-[8px] font-bold uppercase cursor-pointer ${
                                            soc.useBrandColor !== false ? 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]' : 'bg-black/20 border-white/10 text-neutral-500'
                                          }`}
                                        >
                                          Фирм. цвет
                                        </button>
                                        {soc.useBrandColor === false && (
                                          <input
                                            type="color"
                                            value={soc.iconColor || '#ffffff'}
                                            onChange={e => handleUpdateSocialLink(block.id, soc.id, { iconColor: e.target.value })}
                                            className="w-8 h-8 bg-transparent border-0 cursor-pointer"
                                            title="Свой цвет иконки"
                                          />
                                        )}
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
                                    <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Стиль оформления</label>
                                    <select
                                      value={block.textboxStyle || 'standard'}
                                      onChange={e => updateBlock(block.id, { textboxStyle: e.target.value as any })}
                                      className="bg-black border border-white/15 rounded-sm p-1.5 focus:border-[#00f2ff] text-[10px] w-full font-bold text-white focus:outline-none"
                                    >
                                      {Object.entries(TEXTBOX_STYLE_LABELS).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] uppercase text-neutral-500 mb-1 font-bold">Текст объявления</label>
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
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={block.imageUrl || ''}
                                      placeholder="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
                                      onChange={e => updateBlock(block.id, { imageUrl: e.target.value })}
                                      className="flex-1 bg-black/50 border border-white/15 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUploadTarget('imageBlock');
                                        setUploadBlockId(block.id);
                                        fileInputRef.current?.click();
                                      }}
                                      className="px-3 py-2 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] rounded-sm text-[9px] font-bold uppercase whitespace-nowrap cursor-pointer"
                                    >
                                      Загрузить
                                    </button>
                                  </div>
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
                        <span className="block text-[10px] uppercase text-neutral-500 font-bold">🛠️ Операции экспорта и импорта</span>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            type="button"
                            onClick={handleJSONExport}
                            className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-sm font-bold tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase"
                          >
                            <FileJson className="w-4 h-4" />
                            <span>Экспортировать конфигурацию в JSON</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleJSONImportClick}
                            className="px-4 py-2.5 bg-[#00f2ff] hover:bg-[#00d0e0] text-black rounded-sm font-bold tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase shadow-[0_0_15px_rgba(0,242,255,0.15)]"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Импортировать конфигурацию из JSON</span>
                          </button>
                          <input
                            type="file"
                            ref={jsonImportInputRef}
                            className="hidden"
                            accept=".json"
                            onChange={handleJSONImport}
                          />
                        </div>

                        {jsonImportError && (
                          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm text-[10px]">
                            🛑 {jsonImportError}
                          </div>
                        )}

                        {jsonImportSuccess && (
                          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-sm text-[10px]">
                            ✅ {jsonImportSuccess}
                          </div>
                        )}
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

                {/* 7. QR CODE SECTOR */}
                {activeTab === 'qr' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-black font-mono text-[#00f2ff] uppercase tracking-widest flex items-center gap-2 italic">
                          <QrCode className="w-4 h-4" />
                          <span>QR-код Генератор</span>
                        </h3>
                        <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                          Создайте полностью персонализированный QR-код со своей аватаркой по центру и фирменными цветами для печати или шеринга.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                      {/* Left: Controls Column */}
                      <div className="space-y-4 font-mono text-xs">
                        
                        {/* URL Target Field */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="block text-[10px] uppercase text-neutral-400 font-bold">🔗 Адрес ссылки</span>
                            <button
                              type="button"
                              onClick={() => setQrText(`${window.location.origin}/u/${username}`)}
                              className="text-[8px] text-[#00f2ff] hover:underline uppercase font-extrabold cursor-pointer"
                            >
                              Сброс
                            </button>
                          </div>
                          <input
                            type="text"
                            value={qrText}
                            onChange={e => setQrText(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-black/60 border border-white/10 focus:border-[#00f2ff] rounded-sm p-2 text-[10px] text-white outline-none"
                          />
                        </div>

                        {/* Presets Grid */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                          <span className="block text-[10px] uppercase text-neutral-400 font-bold flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-[#00f2ff]" />
                            <span>Цветовые шаблоны</span>
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { name: 'Cyberpunk', dark: '#00f2ff', light: '#050505' },
                              { name: 'Monochrome', dark: '#000000', light: '#ffffff' },
                              { name: 'Neon Green', dark: '#00ff66', light: '#090a0d' },
                              { name: 'Electric Pink', dark: '#ff007f', light: '#06050a' },
                              { name: 'Sunset Gold', dark: '#f59e0b', light: '#0f0905' },
                              { name: 'Stellar Red', dark: '#ff3333', light: '#07070a' }
                            ].map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setQrFgColor(preset.dark);
                                  setQrBgColor(preset.light);
                                }}
                                className="p-2 bg-black/45 hover:bg-black/80 border border-white/5 hover:border-white/20 rounded-sm flex items-center space-x-2 text-left cursor-pointer transition text-[9px]"
                              >
                                <span className="flex space-x-0.5 flex-shrink-0">
                                  <span className="w-3 h-3 rounded-full border border-white/10 inline-block" style={{ backgroundColor: preset.dark }} />
                                  <span className="w-3 h-3 rounded-full border border-white/10 inline-block" style={{ backgroundColor: preset.light }} />
                                </span>
                                <span className="text-neutral-300 truncate">{preset.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Colors Picker */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                          <span className="block text-[10px] uppercase text-neutral-400 font-bold">🎨 Свои цвета</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[8px] text-neutral-500 uppercase font-bold">Цвет точек (QR)</label>
                              <div className="flex items-center space-x-2 bg-black/50 border border-white/10 rounded-sm p-1">
                                <input
                                  type="color"
                                  value={qrFgColor}
                                  onChange={e => setQrFgColor(e.target.value)}
                                  className="w-7 h-7 bg-transparent border-0 cursor-pointer outline-none"
                                />
                                <input
                                  type="text"
                                  value={qrFgColor}
                                  onChange={e => setQrFgColor(e.target.value)}
                                  className="bg-transparent text-[10px] font-mono text-white outline-none w-16"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[8px] text-neutral-500 uppercase font-bold">Цвет фона</label>
                              <div className="flex items-center space-x-2 bg-black/50 border border-white/10 rounded-sm p-1">
                                <input
                                  type="color"
                                  value={qrBgColor}
                                  onChange={e => setQrBgColor(e.target.value)}
                                  className="w-7 h-7 bg-transparent border-0 cursor-pointer outline-none"
                                />
                                <input
                                  type="text"
                                  value={qrBgColor}
                                  onChange={e => setQrBgColor(e.target.value)}
                                  className="bg-transparent text-[10px] font-mono text-white outline-none w-16"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Logo overlay configurations */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                          <span className="block text-[10px] uppercase text-neutral-400 font-bold">🖼️ Персонализация (Аватарка по центру)</span>
                          
                          <div className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-sm">
                            <span className="text-[10px] text-neutral-300 font-medium">Разместить аватарку в центре QR</span>
                            <button
                              type="button"
                              onClick={() => setQrIncludeAvatar(!qrIncludeAvatar)}
                              className={`px-3 py-1 rounded-sm text-[8px] font-black uppercase tracking-wider border cursor-pointer transition ${
                                qrIncludeAvatar ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-neutral-500'
                              }`}
                            >
                              {qrIncludeAvatar ? 'Активно' : 'Отключено'}
                            </button>
                          </div>

                          {qrIncludeAvatar && (
                            <div className="space-y-2 pt-1 animate-fade-in">
                              <div className="flex justify-between items-center text-[9px] text-neutral-400">
                                <span>Размер логотипа в QR (Рекомендуется 15%-18%)</span>
                                <span className="font-bold text-white">{Math.round(qrAvatarSize * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.10"
                                max="0.25"
                                step="0.01"
                                value={qrAvatarSize}
                                onChange={e => setQrAvatarSize(parseFloat(e.target.value))}
                                className="w-full accent-[#00f2ff] h-1 bg-neutral-800 rounded-lg cursor-pointer"
                              />
                              <span className="block text-[8px] text-neutral-500 leading-normal font-sans">
                                Примечание: При активации логотипа мы принудительно используем уровень коррекции H (High), чтобы сохранить сканируемость кода.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Formatting sliders */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                          <span className="block text-[10px] uppercase text-neutral-400 font-bold">📏 Параметры QR-кода</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[8px] text-neutral-500 font-bold">
                                <span>ВНЕШНЕЕ ПОЛЕ (MARGIN)</span>
                                <span className="text-white">{qrMargin}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="6"
                                step="1"
                                value={qrMargin}
                                onChange={e => setQrMargin(parseInt(e.target.value))}
                                className="w-full accent-[#00f2ff] h-1 bg-neutral-800 rounded-lg cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8px] text-neutral-500 uppercase font-bold">КОРРЕКЦИЯ ОШИБОК</label>
                              <select
                                value={qrErrorCorrection}
                                onChange={e => setQrErrorCorrection(e.target.value as any)}
                                className="w-full bg-black border border-white/10 rounded-sm p-1.5 text-[9px] text-white focus:border-[#00f2ff] outline-none"
                              >
                                <option value="L">Level L (7% восстановление)</option>
                                <option value="M">Level M (15% восстановление)</option>
                                <option value="Q">Level Q (25% восстановление)</option>
                                <option value="H">Level H (30% восстановление - Рекомед)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Right: Live Preview & Exports Column */}
                      <div className="space-y-4 flex flex-col items-center">
                        <div className="p-5 bg-white/5 border border-white/10 rounded-sm w-full flex flex-col items-center justify-center space-y-4">
                          <span className="block text-[9px] uppercase tracking-widest text-[#00f2ff] font-bold font-mono">Предпросмотр</span>
                          
                          {/* Main Live QR Canvas Container */}
                          <div 
                            className="p-4 rounded-sm transition-all duration-300 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/5" 
                            style={{ backgroundColor: qrBgColor }}
                          >
                            <canvas 
                              ref={qrCanvasRef} 
                              className="max-w-full block aspect-square rounded-sm"
                              style={{ width: '220px', height: '220px' }}
                            />
                          </div>

                          <div className="text-center font-mono space-y-1">
                            <span className="block text-[9px] text-neutral-400 truncate max-w-[250px]" title={qrText}>
                              {qrText}
                            </span>
                            <span className="block text-[7.5px] text-neutral-600 uppercase font-bold">Сканируйте камерой телефона</span>
                          </div>
                        </div>

                        {/* Export Action triggers */}
                        <div className="w-full space-y-2 font-mono">
                          <button
                            type="button"
                            onClick={handleDownloadPNG}
                            className="w-full py-3 bg-[#00f2ff] hover:bg-[#00d0e0] text-black rounded-sm font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_20px_rgba(0,242,255,0.15)]"
                          >
                            <Download className="w-4 h-4" />
                            <span>Скачать PNG (Растр)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadSVG}
                            className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white border border-purple-600/30 rounded-sm font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center space-x-2 cursor-pointer"
                          >
                            <FileJson className="w-4 h-4" />
                            <span>Скачать SVG (Вектор)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(qrText);
                              setQrCopied(true);
                              setTimeout(() => setQrCopied(false), 2000);
                            }}
                            className="w-full py-2.5 bg-black/45 hover:bg-black/80 border border-white/10 text-neutral-300 hover:text-white rounded-sm font-bold text-[9px] uppercase tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{qrCopied ? 'Ссылка скопирована ✓' : 'Скопировать ссылку'}</span>
                          </button>
                        </div>

                        <div className="p-3 bg-cyan-950/20 border border-cyan-800/20 rounded-sm w-full text-[9px] leading-relaxed text-cyan-400 font-sans text-center">
                          ℹ️ Вы можете экспортировать векторный формат SVG, который идеально подходит для высококачественной печати без потери резкости!
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
                <div className="flex gap-1 bg-black/40 p-1 rounded-sm border border-white/10">
                  <button type="button" onClick={() => setPreviewMode('desktop')} className={`px-2 py-1 text-[9px] uppercase font-bold rounded-sm ${previewMode === 'desktop' ? 'bg-[#00f2ff] text-black' : 'text-neutral-500'}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewMode('mobile')} className={`px-2 py-1 text-[9px] uppercase font-bold rounded-sm ${previewMode === 'mobile' ? 'bg-[#00f2ff] text-black' : 'text-neutral-500'}`}>Mobile</button>
                </div>
              </div>

              {/* Bio Page renderer in sandbox state preview config mode */}
              <div className={`flex-grow overflow-y-auto relative bg-[#040407] flex justify-center ${previewMode === 'mobile' ? 'p-4' : ''}`}>
                <div
                  className={previewMode === 'mobile' ? 'w-[390px] h-[844px] max-h-full border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl scale-[0.85] origin-top' : 'w-full h-full'}
                  style={previewMode === 'mobile' ? { maxHeight: '844px' } : undefined}
                >
                <BioPage
                  username={username}
                  onExit={() => {}}
                  previewConfig={{ ...config, mobileOptimized: previewMode === 'mobile' ? true : config.mobileOptimized }}
                />
                </div>
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
