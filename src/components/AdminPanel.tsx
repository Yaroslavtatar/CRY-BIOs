import React, { useState, useEffect, useRef } from 'react';
import { previewBackupZipClient } from '../utils/backupPreviewClient';
import { uploadBackupInChunks, startDiskImport, type ChunkedUploadProgress } from '../utils/chunkedUpload';
import { Shield, Users, Trash2, Edit2, Download, Upload, LogOut, ArrowLeft, Search, Check, AlertTriangle, RefreshCw, Key, FileJson, CheckCircle2, HardDrive, Database } from 'lucide-react';
import { getThumbUrl } from '../utils/media';

interface AdminUser {
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  visitsCount: number;
}

interface StorageStats {
  uploadsMb: number;
  uploadsFiles: number;
  dbMb: number;
  userCount: number;
  lastBackupAt: string | null;
}

interface IncomingBackupFile {
  filename: string;
  size: number;
  mtime: string;
}

interface BackupPreview {
  version?: number;
  exportedAt?: string;
  userCount?: number;
  uploadCount?: number;
  includeAnalytics?: boolean;
}

interface AdminPanelProps {
  onExit: () => void;
}

export default function AdminPanel({ onExit }: AdminPanelProps) {
  // Authentication states
  const [adminPassword, setAdminPassword] = useState(sessionStorage.getItem('admin_password') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [usingDefaultPassword, setUsingDefaultPassword] = useState(false);
  const [hideAdminPanelLink, setHideAdminPanelLink] = useState(false);
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [userImportTarget, setUserImportTarget] = useState<string | null>(null);

  // Users and Database states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Editing and Deleting sub-states
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // User password change states
  const [changingPasswordUser, setChangingPasswordUser] = useState<AdminUser | null>(null);
  const [newUserPasswordInput, setNewUserPasswordInput] = useState('');

  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // File upload refs for database import
  const dbImportInputRef = useRef<HTMLInputElement | null>(null);
  const fullBackupImportInputRef = useRef<HTMLInputElement | null>(null);
  const userImportInputRef = useRef<HTMLInputElement | null>(null);

  // Backup options
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [backupLoading, setBackupLoading] = useState<'export' | 'import' | null>(null);
  const [importProgress, setImportProgress] = useState<ChunkedUploadProgress | null>(null);
  const [incomingFiles, setIncomingFiles] = useState<IncomingBackupFile[]>([]);
  const [selectedIncomingFile, setSelectedIncomingFile] = useState('');
  const [incomingLoading, setIncomingLoading] = useState(false);

  // Attempt login with stored password on mount
  useEffect(() => {
    if (adminPassword) {
      verifyAdmin(adminPassword);
    }
  }, []);

  const verifyAdmin = async (passwordToVerify: string) => {
    if (!passwordToVerify.trim()) {
      setAuthError('Введите пароль администратора');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/verify', {
        headers: {
          'x-admin-password': encodeURIComponent(passwordToVerify)
        }
      });
      if (!res.ok) {
        throw new Error('Неверный пароль администратора');
      }
      sessionStorage.setItem('admin_password', passwordToVerify);
      setIsAuthenticated(true);
      fetchUsers(passwordToVerify);
      fetchAdminStatus(passwordToVerify);
      fetchStorageStats(passwordToVerify);
      fetchIncomingFiles(passwordToVerify);
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка авторизации');
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchIncomingFiles = async (pass = adminPassword) => {
    setIncomingLoading(true);
    try {
      const res = await fetch('/api/admin/import-full/incoming', {
        headers: { 'x-admin-password': encodeURIComponent(pass) },
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingFiles(data.files || []);
        if (data.files?.length && !selectedIncomingFile) {
          setSelectedIncomingFile(data.files[0].filename);
        }
      }
    } catch { /* ignore */ }
    finally {
      setIncomingLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const fetchStorageStats = async (pass = adminPassword) => {
    try {
      const res = await fetch('/api/admin/storage-stats', {
        headers: { 'x-admin-password': encodeURIComponent(pass) },
      });
      if (res.ok) setStorageStats(await res.json());
    } catch { /* ignore */ }
  };

  const fetchAdminStatus = async (pass = adminPassword) => {
    try {
      const res = await fetch('/api/admin/status', {
        headers: { 'x-admin-password': encodeURIComponent(pass) },
      });
      if (res.ok) {
        const data = await res.json();
        setUsingDefaultPassword(!!data.usingDefaultPassword);
        setHideAdminPanelLink(!!data.hideAdminPanelLink);
      }
    } catch { /* ignore */ }
  };

  const handleToggleHideAdminLink = async (checked: boolean) => {
    setSiteSettingsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': encodeURIComponent(adminPassword),
        },
        body: JSON.stringify({ hideAdminPanelLink: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить настройки');
      setHideAdminPanelLink(checked);
      setSuccessMessage(checked ? 'Ссылка на админ-панель скрыта на главной' : 'Ссылка на админ-панель снова видна');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка сохранения настроек');
    } finally {
      setSiteSettingsLoading(false);
    }
  };

  const handleCleanupOrphans = async () => {
    if (!window.confirm('Удалить все файлы в uploads/, не используемые ни одним профилем?')) return;
    setCleanupLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/cleanup-orphans', {
        method: 'POST',
        headers: { 'x-admin-password': encodeURIComponent(adminPassword) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cleanup failed');
      setSuccessMessage(`Очищено ${data.deleted} файлов (${data.bytesFreedMb} MB)`);
      fetchStorageStats();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleOptimizeMedia = async () => {
    if (!window.confirm('Переоптимизировать все медиафайлы в uploads/? Это может занять несколько минут.')) return;
    setOptimizeLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/optimize-media', {
        method: 'POST',
        headers: { 'x-admin-password': encodeURIComponent(adminPassword) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Optimize failed');
      setSuccessMessage(`Оптимизировано ${data.processed} файлов, сэкономлено ${data.savedMb} MB`);
      fetchStorageStats();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setOptimizeLoading(false);
    }
  };

  const handleExportUser = async (username: string) => {
    try {
      const res = await fetch(`/api/admin/export-user/${username}`, {
        headers: { 'x-admin-password': encodeURIComponent(adminPassword) },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cry_bios_user_${username}_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage(`Пользователь @${username} экспортирован`);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleUserImportClick = (username: string) => {
    setUserImportTarget(username);
    userImportInputRef.current?.click();
  };

  const handleUserImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userImportTarget) return;
    const overwrite = window.confirm(`Импортировать бэкап для @${userImportTarget}? Перезаписать если существует?`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('overwrite', String(overwrite));
      const res = await fetch(`/api/admin/import-user/${userImportTarget}`, {
        method: 'POST',
        headers: { 'x-admin-password': encodeURIComponent(adminPassword) },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setSuccessMessage(`Пользователь @${userImportTarget} импортирован`);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUserImportTarget(null);
      if (userImportInputRef.current) userImportInputRef.current.value = '';
    }
  };

  const fetchUsers = async (pass = adminPassword) => {
    setLoadingUsers(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-admin-password': encodeURIComponent(pass)
        }
      });
      if (!res.ok) throw new Error('Не удалось загрузить пользователей');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAdmin(adminPassword);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setAdminPassword('');
    setIsAuthenticated(false);
    setUsers([]);
    setStorageStats(null);
  };

  // Actions
  const handleDeleteUser = async (usernameToDelete: string) => {
    setActionLoading(`delete-${usernameToDelete}`);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`/api/admin/user/${usernameToDelete}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': encodeURIComponent(adminPassword)
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ошибка удаления пользователя');
      }
      setSuccessMessage(`Пользователь ${usernameToDelete} успешно удален`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка при удалении');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenameUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const oldUsername = editingUser.username;
    const newUsername = newUsernameInput.trim().toLowerCase();

    if (!newUsername) {
      setErrorMessage('Адрес не может быть пустым');
      return;
    }

    setActionLoading(`rename-${oldUsername}`);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/admin/rename-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': encodeURIComponent(adminPassword)
        },
        body: JSON.stringify({ oldUsername, newUsername })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при изменении адреса');
      }
      setSuccessMessage(`Адрес пользователя ${oldUsername} успешно изменен на ${newUsername}`);
      setEditingUser(null);
      setNewUsernameInput('');
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка изменения адреса');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleVerify = async (usernameToVerify: string) => {
    setActionLoading(`verify-${usernameToVerify}`);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`/api/admin/toggle-verify/${usernameToVerify}`, {
        method: 'POST',
        headers: {
          'x-admin-password': encodeURIComponent(adminPassword)
        }
      });
      if (!res.ok) {
        throw new Error('Ошибка изменения верификации');
      }
      setSuccessMessage(`Статус верификации @${usernameToVerify} успешно изменен`);
      fetchUsers(adminPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDatabaseExport = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const query = includeAnalytics ? '' : '?includeAnalytics=false';
      const res = await fetch(`/api/admin/export-db${query}`, {
        headers: {
          'x-admin-password': encodeURIComponent(adminPassword)
        }
      });
      if (!res.ok) throw new Error('Ошибка экспорта базы данных');
      const dump = await res.json();
      
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cry_bios_database_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage('JSON-экспорт базы данных успешно выполнен!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка экспорта базы данных');
    }
  };

  const handleFullBackupExport = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setBackupLoading('export');
    try {
      const query = includeAnalytics ? '' : '?includeAnalytics=false';
      const res = await fetch(`/api/admin/export-full${query}`, {
        headers: {
          'x-admin-password': encodeURIComponent(adminPassword)
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ошибка экспорта полного бэкапа');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cry_bios_full_backup_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage('Полный ZIP-бэкап (БД + медиафайлы) успешно скачан!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка экспорта полного бэкапа');
    } finally {
      setBackupLoading(null);
    }
  };

  const handleFullBackupImportClick = () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (fullBackupImportInputRef.current) {
      fullBackupImportInputRef.current.click();
    }
  };

  const handleFullBackupImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupLoading('import');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const preview = await previewBackupZipClient(file);
      setBackupPreview(preview);
      setPendingBackupFile(file);
      setBackupLoading(null);
    } catch (err: any) {
      setErrorMessage('Ошибка предпросмотра: ' + (err.message || 'некорректный формат'));
      setBackupLoading(null);
      if (fullBackupImportInputRef.current) fullBackupImportInputRef.current.value = '';
    }
  };

  const confirmFullBackupImport = async () => {
    if (!pendingBackupFile) return;

    setBackupLoading('import');
    setImportProgress(null);
    try {
      const result = await uploadBackupInChunks(
        pendingBackupFile,
        adminPassword,
        (progress) => setImportProgress(progress),
      );

      setSuccessMessage(
        `Полный бэкап восстановлен! Пользователей: ${result.userCount}, файлов: ${result.uploadCount}`
      );
      setBackupPreview(null);
      setPendingBackupFile(null);
      fetchUsers();
      fetchStorageStats();
    } catch (err: any) {
      setErrorMessage('Ошибка импорта бэкапа: ' + (err.message || 'некорректный формат'));
    } finally {
      setBackupLoading(null);
      setImportProgress(null);
      if (fullBackupImportInputRef.current) fullBackupImportInputRef.current.value = '';
    }
  };

  const confirmDiskBackupImport = async () => {
    if (!selectedIncomingFile) return;
    if (!window.confirm(`Импортировать ${selectedIncomingFile} с сервера? Текущие данные будут перезаписаны.`)) {
      return;
    }

    setBackupLoading('import');
    setImportProgress(null);
    setErrorMessage('');
    try {
      const result = await startDiskImport(
        selectedIncomingFile,
        adminPassword,
        (progress) => setImportProgress(progress),
      );
      setSuccessMessage(
        `Полный бэкап восстановлен с диска! Пользователей: ${result.userCount}, файлов: ${result.uploadCount}`
      );
      fetchUsers();
      fetchStorageStats();
      fetchIncomingFiles();
    } catch (err: any) {
      setErrorMessage('Ошибка импорта с диска: ' + (err.message || 'не удалось импортировать'));
    } finally {
      setBackupLoading(null);
      setImportProgress(null);
    }
  };

  const handleDatabaseImportClick = () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (dbImportInputRef.current) {
      dbImportInputRef.current.click();
    }
  };

  const handleDatabaseImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmOver = window.confirm(
      'ВНИМАНИЕ! Импорт базы данных полностью перезапишет текущих пользователей, их страницы био и статистику аналитики! Вы действительно хотите продолжить?'
    );
    if (!confirmOver) {
      if (dbImportInputRef.current) dbImportInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const dump = JSON.parse(text);

        const res = await fetch('/api/admin/import-db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': encodeURIComponent(adminPassword)
          },
          body: JSON.stringify({ dump })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Не удалось импортировать базу данных');
        }

        setSuccessMessage('Полная база данных CRY BIOS успешно импортирована и восстановлена!');
        fetchUsers();
      } catch (err: any) {
        setErrorMessage('Ошибка импорта базы данных: ' + (err.message || 'некорректный формат'));
      } finally {
        if (dbImportInputRef.current) dbImportInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPass = newPasswordInput.trim();
    if (!newPass || newPass.length < 4) {
      setErrorMessage('Пароль должен содержать не менее 4 символов');
      return;
    }

    setActionLoading('change-admin-password');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': encodeURIComponent(adminPassword)
        },
        body: JSON.stringify({ newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при изменении пароля');
      }
      setSuccessMessage('Пароль администратора успешно изменен!');
      setAdminPassword(newPass);
      localStorage.setItem('admin_password', newPass);
      setIsChangingPassword(false);
      setNewPasswordInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка изменения пароля');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser) return;
    const targetUser = changingPasswordUser.username;
    const newPass = newUserPasswordInput.trim();

    if (!newPass || newPass.length < 4) {
      setErrorMessage('Пароль должен содержать не менее 4 символов');
      return;
    }

    setActionLoading(`change-user-password-${targetUser}`);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/admin/change-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': encodeURIComponent(adminPassword)
        },
        body: JSON.stringify({ username: targetUser, newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при изменении пароля пользователя');
      }
      setSuccessMessage(`Пароль пользователя @${targetUser} успешно изменен!`);
      setChangingPasswordUser(null);
      setNewUserPasswordInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка изменения пароля пользователя');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users based on query
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#00f2ff]/30 selection:text-white">
      {/* Background aesthetics */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00f2ff]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={onExit}>
            <div className="w-8 h-8 bg-[#00f2ff] rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.3)]">
              <span className="text-black font-black text-xl">C</span>
            </div>
            <div>
              <span className="font-black text-xl tracking-tighter uppercase italic text-white block leading-none">
                CRY BIOS
              </span>
              <span className="text-[8px] block text-[#00f2ff] font-mono tracking-widest uppercase mt-0.5 font-bold">
                Admin Control Room
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onExit}
              className="flex items-center space-x-2 text-xs font-bold font-mono text-neutral-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-4 py-2 rounded-sm transition uppercase tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Главная</span>
            </button>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-xs font-bold font-mono text-red-400 hover:text-red-300 bg-red-500/5 border border-red-500/10 hover:border-red-500/20 px-4 py-2 rounded-sm transition uppercase tracking-wider cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-6xl w-full mx-auto p-6 relative z-10 flex flex-col justify-start">
        {!isAuthenticated ? (
          /* Authentication Form */
          <div className="max-w-md w-full mx-auto my-auto py-12">
            <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-6 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
              <div className="text-center space-y-2">
                <span className="inline-flex bg-[#00f2ff]/10 p-3 rounded-full text-[#00f2ff] mb-2 animate-pulse shadow-[0_0_20px_rgba(0,242,255,0.1)]">
                  <Shield className="w-6 h-6" />
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight italic font-mono">Вход в Админ-Панель</h2>
                <p className="text-[10px] text-neutral-400 uppercase tracking-[0.2em] font-mono font-bold">
                  Защищенная комната управления CRY BIOS
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5 font-mono text-[10px]">
                  <label className="block text-neutral-500 uppercase font-black">Пароль Администратора</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-neutral-600 absolute left-3 top-3" />
                    <input
                      type="password"
                      placeholder="Введите ADMIN_PASSWORD..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 focus:border-[#00f2ff] rounded-sm p-2.5 pl-10 text-xs text-white outline-none font-semibold transition"
                      disabled={authLoading}
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm text-[10px] flex items-start space-x-2 font-mono leading-normal">
                    <span className="flex-shrink-0">🛑</span>
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-[#00f2ff] text-black font-black text-xs uppercase tracking-widest rounded-sm hover:bg-[#00d0e0] active:scale-[0.98] transition shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center justify-center space-x-2 cursor-pointer font-mono"
                >
                  {authLoading ? (
                    <span className="w-4 h-4 border-2 border-t-black border-transparent animate-spin rounded-full" />
                  ) : (
                    <>
                      <span>Войти в систему</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center">
                <span className="text-[9px] text-neutral-600 font-mono">
                  Дефолтный пароль устанавливается в переменной окружения ADMIN_PASSWORD.
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Admin Dashboard */
          <div className="space-y-6 animate-fade-in">
            {/* Coolify / deployment warning */}
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-sm p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-xs font-black font-mono text-amber-400 uppercase tracking-wider">Coolify / Docker</h3>
                <p className="text-[10px] text-neutral-300 font-sans leading-relaxed">
                  При пересоздании контейнера данные внутри него удаляются. Перед каждым деплоем скачайте{' '}
                  <strong className="text-white">полный ZIP-бэкап</strong>. Убедитесь, что в Coolify смонтирован том{' '}
                  <code className="text-amber-300">cry_bios_data:/app/data</code> во вкладке Storages.
                </p>
              </div>
            </div>

            {/* Site settings */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4">
              <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider">Настройки сайта</h3>
              <label className="mt-3 flex items-start gap-3 text-[10px] text-neutral-300 font-sans cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideAdminPanelLink}
                  disabled={siteSettingsLoading}
                  onChange={(e) => handleToggleHideAdminLink(e.target.checked)}
                  className="accent-[#00f2ff] mt-0.5"
                />
                <span>
                  <strong className="text-white block mb-1">Скрыть ссылку «АДМИН-ПАНЕЛЬ» на главной</strong>
                  Убирает ссылку в футере landing page. Страница <code className="text-[#00f2ff]">/admin</code> остаётся доступной по прямому URL.
                </span>
              </label>
            </div>

            {/* Backup options */}
            <label className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={includeAnalytics}
                onChange={(e) => setIncludeAnalytics(e.target.checked)}
                className="accent-[#00f2ff]"
              />
              Включить аналитику в бэкап (снимите для быстрого экспорта перед деплоем)
            </label>

            {(backupLoading === 'export' || backupLoading === 'import') && (
              <div className="bg-[#0b0b0b] border border-[#00f2ff]/30 rounded-sm p-3">
                <div className="flex items-center gap-2 text-[10px] text-[#00f2ff] font-mono uppercase">
                  <span className="w-3 h-3 border border-t-[#00f2ff] border-transparent animate-spin rounded-full" />
                  {backupLoading === 'export'
                    ? 'Формирование ZIP-бэкапа...'
                    : importProgress?.label || 'Восстановление из ZIP-бэкапа...'}
                </div>
                <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                  {importProgress && importProgress.phase === 'upload' && importProgress.total > 0 ? (
                    <div
                      className="h-full bg-[#00f2ff]/60 transition-all duration-300"
                      style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                    />
                  ) : (
                    <div className="h-full bg-[#00f2ff]/60 animate-pulse w-full" />
                  )}
                </div>
                {importProgress?.phase === 'upload' && importProgress.total > 0 && (
                  <p className="mt-2 text-[9px] text-neutral-500 font-mono">
                    Чанки: {importProgress.current}/{importProgress.total}
                  </p>
                )}
              </div>
            )}

            {/* Database backup & restore section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="bg-[#0b0b0b] border border-[#00f2ff]/30 rounded-sm p-4 flex flex-col justify-between space-y-3 sm:col-span-1 lg:col-span-1 xl:col-span-2">
                <div>
                  <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#00f2ff]" />
                    <span>Полный бэкап (ZIP)</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    БД + все медиафайлы (аватарки, фоны, аудио) в одном архиве. Рекомендуется перед деплоем.
                  </p>
                </div>
                <button
                  onClick={handleFullBackupExport}
                  disabled={backupLoading !== null}
                  className="w-full py-2 bg-[#00f2ff]/20 hover:bg-[#00f2ff]/30 border border-[#00f2ff]/40 text-[#00f2ff] rounded-sm font-bold font-mono tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать ZIP</span>
                </button>
              </div>

              <div className="bg-[#0b0b0b] border border-[#00f2ff]/30 rounded-sm p-4 flex flex-col justify-between space-y-3 sm:col-span-1 lg:col-span-1 xl:col-span-2">
                <div>
                  <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-[#00f2ff]" />
                    <span>Восстановить (ZIP)</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    Загрузить полный ZIP-бэкап после пересоздания контейнера. Большие архивы загружаются чанками (8 MB). Текущие данные будут стерты!
                  </p>
                </div>
                <button
                  onClick={handleFullBackupImportClick}
                  disabled={backupLoading !== null}
                  className="w-full py-2 bg-emerald-600/85 hover:bg-emerald-700 text-white rounded-sm font-bold font-mono tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Загрузить ZIP</span>
                </button>
                <input
                  type="file"
                  ref={fullBackupImportInputRef}
                  className="hidden"
                  accept=".zip,application/zip"
                  onChange={handleFullBackupImport}
                />
                <input
                  type="file"
                  ref={userImportInputRef}
                  className="hidden"
                  accept=".zip,application/zip"
                  onChange={handleUserImport}
                />
              </div>

              <div className="bg-[#0b0b0b] border border-amber-500/30 rounded-sm p-4 flex flex-col justify-between space-y-3 sm:col-span-1 lg:col-span-1 xl:col-span-2">
                <div>
                  <h3 className="text-xs font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Импорт с сервера</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    ZIP уже на VPS: <code className="text-[#00f2ff]">data/incoming/</code>. Обход Cloudflare/Traefik — без HTTP upload.
                  </p>
                </div>
                <div className="space-y-2">
                  <select
                    value={selectedIncomingFile}
                    onChange={(e) => setSelectedIncomingFile(e.target.value)}
                    disabled={backupLoading !== null || incomingLoading || incomingFiles.length === 0}
                    className="w-full bg-black border border-white/10 rounded-sm p-2 text-[10px] text-white font-mono outline-none disabled:opacity-50"
                  >
                    {incomingFiles.length === 0 ? (
                      <option value="">Нет файлов в data/incoming/</option>
                    ) : (
                      incomingFiles.map((f) => (
                        <option key={f.filename} value={f.filename}>
                          {f.filename} ({formatFileSize(f.size)})
                        </option>
                      ))
                    )}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fetchIncomingFiles()}
                      disabled={incomingLoading || backupLoading !== null}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 rounded-sm font-bold font-mono text-[10px] uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${incomingLoading ? 'animate-spin' : ''}`} />
                      Обновить
                    </button>
                    <button
                      type="button"
                      onClick={confirmDiskBackupImport}
                      disabled={backupLoading !== null || !selectedIncomingFile}
                      className="flex-1 py-2 bg-amber-600/85 hover:bg-amber-700 text-white rounded-sm font-bold font-mono text-[10px] uppercase cursor-pointer disabled:opacity-50"
                    >
                      Импортировать
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-purple-400" />
                    <span>Экспорт базы данных</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    Лёгкий JSON-дамп без медиафайлов. Для отладки и быстрого просмотра данных.
                  </p>
                </div>
                <button
                  onClick={handleDatabaseExport}
                  className="w-full py-2 bg-purple-700/85 hover:bg-purple-800 text-white rounded-sm font-bold font-mono tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать дамп (JSON)</span>
                </button>
              </div>

              <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Импорт базы данных</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    JSON-дамп без медиафайлов. Картинки после импорта будут недоступны!
                  </p>
                </div>
                <button
                  onClick={handleDatabaseImportClick}
                  className="w-full py-2 bg-emerald-600/85 hover:bg-emerald-700 text-white rounded-sm font-bold font-mono tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Загрузить дамп (JSON)</span>
                </button>
                <input
                  type="file"
                  ref={dbImportInputRef}
                  className="hidden"
                  accept=".json"
                  onChange={handleDatabaseImport}
                />
              </div>

              <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-xs font-black font-mono text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span>Смена пароля админа</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-sans">
                    Изменить текущий пароль для входа в панель управления администратора.
                  </p>
                </div>
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="w-full py-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-[#00f2ff]/30 hover:border-[#00f2ff]/50 text-cyan-400 hover:text-white rounded-sm font-bold font-mono tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer text-[10px] uppercase"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Сменить пароль</span>
                </button>
              </div>

              <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-center items-center text-center space-y-2 font-mono">
                <Users className="w-5 h-5 text-[#00f2ff] mb-1" />
                <div className="text-2xl font-black text-white italic">{users.length}</div>
                <div className="text-[9px] text-neutral-400 uppercase tracking-widest font-black">Всего зарегистрировано</div>
              </div>

              {storageStats && (
                <>
                  <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-center items-center text-center space-y-1 font-mono">
                    <HardDrive className="w-5 h-5 text-emerald-400 mb-1" />
                    <div className="text-xl font-black text-white">{storageStats.uploadsMb} MB</div>
                    <div className="text-[9px] text-neutral-400 uppercase">{storageStats.uploadsFiles} файлов</div>
                  </div>
                  <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-center items-center text-center space-y-1 font-mono">
                    <Database className="w-5 h-5 text-purple-400 mb-1" />
                    <div className="text-xl font-black text-white">{storageStats.dbMb} MB</div>
                    <div className="text-[9px] text-neutral-400 uppercase">SQLite БД</div>
                  </div>
                  <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-2 font-mono col-span-2">
                    <div className="text-[9px] text-neutral-400 uppercase">
                      Последний бэкап: {storageStats.lastBackupAt ? new Date(storageStats.lastBackupAt).toLocaleString('ru-RU') : 'нет'}
                    </div>
                    <button
                      onClick={handleCleanupOrphans}
                      disabled={cleanupLoading}
                      className="w-full py-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-400 rounded-sm text-[10px] font-bold uppercase cursor-pointer disabled:opacity-50"
                    >
                      {cleanupLoading ? 'Очистка...' : 'Очистить неиспользуемые файлы'}
                    </button>
                    <button
                      onClick={handleOptimizeMedia}
                      disabled={optimizeLoading}
                      className="w-full py-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-400 rounded-sm text-[10px] font-bold uppercase cursor-pointer disabled:opacity-50"
                    >
                      {optimizeLoading ? 'Оптимизация...' : 'Оптимизировать все медиа'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {usingDefaultPassword && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-sm text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Используется дефолтный пароль администратора. Задайте ADMIN_PASSWORD через env или смените пароль ниже.</span>
              </div>
            )}

            {/* Notifications */}
            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-sm text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm text-xs font-mono flex items-center space-x-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Users list section */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-wider font-mono text-neutral-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00f2ff]" />
                  <span>Управление пользователями</span>
                </h2>

                <div className="relative max-w-sm w-full font-mono">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Поиск по адресу или нику..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-white/5 focus:border-[#00f2ff] rounded-sm p-2 pl-9 text-xs text-white placeholder-neutral-600 outline-none transition"
                  />
                </div>
              </div>

              {loadingUsers ? (
                <div className="text-center py-12 font-mono text-xs text-neutral-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#00f2ff]" />
                  Загрузка базы данных пользователей...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-neutral-500 text-[10px] uppercase font-black tracking-wider">
                        <th className="py-3 px-4">Адрес (Username)</th>
                        <th className="py-3 px-4">Отображаемое имя</th>
                        <th className="py-3 px-4 text-center">Верификация</th>
                        <th className="py-3 px-4 text-center">Просмотры</th>
                        <th className="py-3 px-4 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-neutral-600 font-medium">
                            Пользователи не найдены.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.username} className="hover:bg-white/[0.02] transition">
                            <td className="py-3.5 px-4 font-bold text-[#00f2ff]">
                              <div className="flex items-center gap-2">
                                {user.avatarUrl && (
                                  <img
                                    src={getThumbUrl(user.avatarUrl)}
                                    alt=""
                                    loading="lazy"
                                    className="w-6 h-6 rounded-full object-cover border border-white/10"
                                  />
                                )}
                                @{user.username}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-neutral-300 max-w-[180px] truncate">
                              {user.displayName}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleToggleVerify(user.username)}
                                disabled={actionLoading === `verify-${user.username}`}
                                className={`inline-flex items-center px-2 py-1 rounded-sm text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                                  user.verified 
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20' 
                                    : 'bg-black/40 border-white/5 text-neutral-500 hover:border-neutral-500 hover:text-neutral-400'
                                }`}
                                title="Переключить статус верификации"
                              >
                                {actionLoading === `verify-${user.username}` ? '...' : user.verified ? 'Verified ✓' : 'Unverified'}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-center text-purple-400 font-bold font-mono">
                              {user.visitsCount.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleExportUser(user.username)}
                                  className="p-1.5 bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:text-emerald-400 rounded-sm transition cursor-pointer text-neutral-400"
                                  title="Экспорт пользователя"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleUserImportClick(user.username)}
                                  className="p-1.5 bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:text-emerald-400 rounded-sm transition cursor-pointer text-neutral-400"
                                  title="Импорт пользователя"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setChangingPasswordUser(user);
                                    setNewUserPasswordInput('');
                                  }}
                                  className="p-1.5 bg-white/5 border border-white/5 hover:border-[#00f2ff]/20 hover:text-[#00f2ff] rounded-sm transition cursor-pointer text-neutral-400"
                                  title="Сменить пароль пользователя"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUser(user);
                                    setNewUsernameInput(user.username);
                                  }}
                                  className="p-1.5 bg-white/5 border border-white/5 hover:border-[#00f2ff]/20 hover:text-[#00f2ff] rounded-sm transition cursor-pointer text-neutral-400"
                                  title="Изменить адрес страницы (Rename)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingUser(user)}
                                  className="p-1.5 bg-red-500/5 border border-red-500/10 hover:border-red-500/30 hover:text-red-400 rounded-sm transition cursor-pointer text-neutral-400"
                                  title="Удалить профиль"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dialogs / Modals */}
            {backupPreview && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0b0b0b] border border-white/10 rounded-sm max-w-md w-full p-6 space-y-4 font-mono">
                  <h3 className="text-sm font-black uppercase text-white">Предпросмотр бэкапа</h3>
                  <div className="text-[11px] text-neutral-400 space-y-1">
                    <p>Версия: {backupPreview.version ?? '?'}</p>
                    <p>Пользователей: {backupPreview.userCount ?? '?'}</p>
                    <p>Файлов: {backupPreview.uploadCount ?? '?'}</p>
                    <p>Дата: {backupPreview.exportedAt ? new Date(backupPreview.exportedAt).toLocaleString('ru-RU') : '?'}</p>
                    <p>Аналитика: {backupPreview.includeAnalytics ? 'включена' : 'выключена'}</p>
                  </div>
                  <p className="text-[10px] text-amber-400">Импорт перезапишет всю БД и uploads/. Продолжить?</p>
                  {importProgress && backupLoading === 'import' && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#00f2ff] font-mono">{importProgress.label}</p>
                      {importProgress.phase === 'upload' && importProgress.total > 0 && (
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00f2ff]/60 transition-all"
                            style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setBackupPreview(null); setPendingBackupFile(null); setBackupLoading(null); }}
                      className="flex-1 py-2 bg-white/5 border border-white/10 text-neutral-400 rounded-sm text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={confirmFullBackupImport}
                      disabled={backupLoading === 'import'}
                      className="flex-1 py-2 bg-red-950/50 border border-red-500/30 text-red-400 rounded-sm text-[10px] font-bold uppercase cursor-pointer disabled:opacity-50"
                    >
                      {backupLoading === 'import' ? 'Импорт...' : 'Импортировать'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rename Modal */}
            {editingUser && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0b0b0b] border border-white/10 rounded-sm max-w-sm w-full p-6 space-y-4 font-mono shadow-[0_0_50px_rgba(0,242,255,0.15)]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-purple-400 font-black uppercase tracking-wider">Изменение адреса био</span>
                    <h3 className="text-base font-black uppercase text-white italic">Изменить @{editingUser.username}</h3>
                  </div>

                  <p className="text-[10px] leading-relaxed text-neutral-400 font-sans">
                    Переименование изменит URL-адрес био. Пользователь всё так же сможет войти под своими старыми кредами, но его адрес био обновится.
                  </p>

                  <form onSubmit={handleRenameUser} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] text-neutral-500 uppercase font-black">Новый адрес (Username)</label>
                      <input
                        type="text"
                        value={newUsernameInput}
                        onChange={(e) => setNewUsernameInput(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none font-bold"
                        placeholder="Например: new_address"
                      />
                    </div>

                    <div className="flex space-x-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="flex-1 py-2 bg-white/5 border border-white/5 text-neutral-400 rounded-sm text-[10px] font-bold uppercase hover:bg-white/10 hover:text-white transition cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === `rename-${editingUser.username}`}
                        className="flex-1 py-2 bg-[#00f2ff] text-black rounded-sm text-[10px] font-black uppercase hover:bg-[#00d0e0] active:scale-95 transition shadow-[0_0_15px_rgba(0,242,255,0.15)] flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        {actionLoading === `rename-${editingUser.username}` ? (
                          <span className="w-3 h-3 border border-t-black border-transparent animate-spin rounded-full" />
                        ) : (
                          <span>Сохранить</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingUser && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0b0b0b] border border-red-500/25 rounded-sm max-w-sm w-full p-6 space-y-4 font-mono shadow-[0_0_50px_rgba(239,68,68,0.15)]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-red-400 font-black uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Опасное действие
                    </span>
                    <h3 className="text-base font-black uppercase text-white italic">Удалить @{deletingUser.username}?</h3>
                  </div>

                  <p className="text-[10px] leading-relaxed text-neutral-400 font-sans">
                    Это действие безвозвратно удалит профиль пользователя, все кастомные настройки его БИО-страницы, ссылки, плейлист и накопленную статистику просмотров.
                  </p>

                  <div className="flex space-x-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingUser(null)}
                      className="flex-1 py-2 bg-white/5 border border-white/5 text-neutral-400 rounded-sm text-[10px] font-bold uppercase hover:bg-white/10 hover:text-white transition cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => handleDeleteUser(deletingUser.username)}
                      disabled={actionLoading === `delete-${deletingUser.username}`}
                      className="flex-1 py-2 bg-red-600 text-white rounded-sm text-[10px] font-black uppercase hover:bg-red-700 active:scale-95 transition shadow-[0_0_15px_rgba(239,68,68,0.25)] flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      {actionLoading === `delete-${deletingUser.username}` ? (
                        <span className="w-3 h-3 border border-t-white border-transparent animate-spin rounded-full" />
                      ) : (
                        <span>Удалить профиль</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Change Password Modal */}
            {isChangingPassword && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0b0b0b] border border-white/10 rounded-sm max-w-sm w-full p-6 space-y-4 font-mono shadow-[0_0_50px_rgba(0,242,255,0.15)]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider">Настройки безопасности</span>
                    <h3 className="text-base font-black uppercase text-white italic">Смена пароля админа</h3>
                  </div>

                  <p className="text-[10px] leading-relaxed text-neutral-400 font-sans">
                    Пожалуйста, укажите новый надежный пароль для входа в панель администратора. Рекомендуется использовать сложную комбинацию.
                  </p>

                  <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] text-neutral-500 uppercase font-black">Новый пароль</label>
                      <input
                        type="password"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none font-bold"
                        placeholder="Минимум 4 символа"
                        required
                        minLength={4}
                      />
                    </div>

                    <div className="flex space-x-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setNewPasswordInput('');
                        }}
                        className="flex-1 py-2 bg-white/5 border border-white/5 text-neutral-400 rounded-sm text-[10px] font-bold uppercase hover:bg-white/10 hover:text-white transition cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === 'change-admin-password'}
                        className="flex-1 py-2 bg-[#00f2ff] text-black rounded-sm text-[10px] font-black uppercase hover:bg-[#00d0e0] active:scale-95 transition shadow-[0_0_15px_rgba(0,242,255,0.15)] flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        {actionLoading === 'change-admin-password' ? (
                          <span className="w-3 h-3 border border-t-black border-transparent animate-spin rounded-full" />
                        ) : (
                          <span>Сменить</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Change User Password Modal */}
            {changingPasswordUser && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0b0b0b] border border-white/10 rounded-sm max-w-sm w-full p-6 space-y-4 font-mono shadow-[0_0_50px_rgba(0,242,255,0.15)]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider">Управление пользователями</span>
                    <h3 className="text-base font-black uppercase text-white italic">Сброс пароля @{changingPasswordUser.username}</h3>
                  </div>

                  <p className="text-[10px] leading-relaxed text-neutral-400 font-sans">
                    Вы можете установить новый пароль для этого пользователя. В целях безопасности текущий пароль пользователя скрыт и не может быть прочитан.
                  </p>

                  <form onSubmit={handleChangeUserPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] text-neutral-500 uppercase font-black">Новый пароль</label>
                      <input
                        type="password"
                        value={newUserPasswordInput}
                        onChange={(e) => setNewUserPasswordInput(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-[#00f2ff] rounded-sm p-2 text-xs text-white outline-none font-bold"
                        placeholder="Минимум 4 символа"
                        required
                        minLength={4}
                      />
                    </div>

                    <div className="flex space-x-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChangingPasswordUser(null);
                          setNewUserPasswordInput('');
                        }}
                        className="flex-1 py-2 bg-white/5 border border-white/5 text-neutral-400 rounded-sm text-[10px] font-bold uppercase hover:bg-white/10 hover:text-white transition cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === `change-user-password-${changingPasswordUser.username}`}
                        className="flex-1 py-2 bg-[#00f2ff] text-black rounded-sm text-[10px] font-black uppercase hover:bg-[#00d0e0] active:scale-95 transition shadow-[0_0_15px_rgba(0,242,255,0.15)] flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        {actionLoading === `change-user-password-${changingPasswordUser.username}` ? (
                          <span className="w-3 h-3 border border-t-black border-transparent animate-spin rounded-full" />
                        ) : (
                          <span>Сменить</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/60 px-6 py-4 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 font-mono text-[9px] text-neutral-600">
          <div>CRY BIOS ADMINISTRATOR COMPILER • VERIFIED NODE</div>
          <div>POWERED BY CRYTEAM DEVELOPERS & SECURE SQLite</div>
        </div>
      </footer>
    </div>
  );
}
