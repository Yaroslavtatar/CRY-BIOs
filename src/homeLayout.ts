/**
 * Конструктор главной страницы: типы, дефолтный макет и санитайзер.
 * Модуль общий для сервера (валидация перед записью) и клиента (безопасный разбор ответа API).
 * Никакого сырого HTML: все поля — обычный текст, ссылки проходят проверку схемы.
 */

export const BLOCK_TYPES = [
  'announcement',
  'hero',
  'stats',
  'features',
  'opensource',
  'profiles',
  'installer',
  'text',
  'cta',
  'faq',
] as const;

export type HomeBlockType = (typeof BLOCK_TYPES)[number];

export const FEATURE_ICONS = ['sparkles', 'code', 'activity', 'shield', 'globe', 'users', 'star', 'terminal', 'download', 'zap'] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

export interface FeatureItem { icon: FeatureIcon; title: string; text: string }
export interface StatItem { label: string; value: string }
export interface FaqItem { q: string; a: string }

export interface HomeBlockProps {
  // общие
  title?: string;
  subtitle?: string;
  // announcement
  text?: string;
  level?: 'info' | 'warning' | 'success';
  linkLabel?: string;
  linkUrl?: string;
  // hero
  badge?: string;
  titleLine1?: string;
  titleAccent?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  showSecondary?: boolean;
  // stats
  useCustomStats?: boolean;
  stats?: StatItem[];
  // features / faq
  features?: FeatureItem[];
  faq?: FaqItem[];
  // profiles
  limit?: number;
  // text
  body?: string;
  align?: 'left' | 'center';
  // cta
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface HomeBlock {
  id: string;
  type: HomeBlockType;
  enabled: boolean;
  props: HomeBlockProps;
}

export interface HomeLayoutSettings {
  siteName: string;
  tagline: string;
  showHeaderGithub: boolean;
  showFooterInstall: boolean;
  footerNote: string;
}

export interface HomeLayout {
  version: 1;
  updatedAt: string | null;
  settings: HomeLayoutSettings;
  blocks: HomeBlock[];
}

export const BLOCK_META: Record<HomeBlockType, { label: string; description: string; unique: boolean }> = {
  announcement: { label: 'Объявление', description: 'Цветная плашка над шапкой сайта', unique: false },
  hero: { label: 'Главный экран', description: 'Заголовок, описание и кнопки', unique: false },
  stats: { label: 'Счётчики', description: 'Ряд ключевых цифр (авто или свои)', unique: false },
  features: { label: 'Преимущества', description: 'Карточки с иконками', unique: false },
  opensource: { label: 'Open Source / GitHub', description: 'Звёзды, релизы, контрибьюторы', unique: true },
  profiles: { label: 'Каталог профилей', description: 'Активные профили платформы', unique: true },
  installer: { label: 'Установка', description: 'Скрипт install.sh и docker-compose', unique: true },
  text: { label: 'Текстовый блок', description: 'Заголовок и абзацы', unique: false },
  cta: { label: 'Призыв к действию', description: 'Крупная кнопка со ссылкой', unique: false },
  faq: { label: 'Вопросы и ответы', description: 'Раскрывающиеся вопросы', unique: false },
};

export const DEFAULT_SETTINGS: HomeLayoutSettings = {
  siteName: 'CRY BIOS',
  tagline: 'Свободный аналог Guns.lol с открытым кодом',
  showHeaderGithub: true,
  showFooterInstall: true,
  footerNote: '',
};

const DEFAULT_FEATURES: FeatureItem[] = [
  {
    icon: 'sparkles',
    title: 'Экран-заставка (Entry)',
    text: 'Включает фирменный интерактивный слой «Нажмите, чтобы войти» с пульсацией, как на guns.lol. Автоматически запускает фоновые MP3 биты и активирует анимированные динамические эффекты.',
  },
  {
    icon: 'code',
    title: 'Интеграции без ограничений',
    text: 'Тонкая кастомизация цветов, сияния, прозрачности карточек/виджетов, размытия. Запускайте завораживающие динамические эффекты: зеленый ливень Матрицы, Космический шквал, Звездное небо.',
  },
  {
    icon: 'activity',
    title: 'Логи статистики в реальном времени',
    text: 'Отслеживайте источники переходов, операционные системы, браузеры, географию ваших гостей (по нативной локали Accept-Language браузера) в виде интерактивных графиков прямо в панели администрирования.',
  },
];

export function defaultBlockProps(type: HomeBlockType): HomeBlockProps {
  switch (type) {
    case 'announcement':
      return { text: 'Важное объявление для посетителей', level: 'info', linkLabel: '', linkUrl: '' };
    case 'hero':
      return {
        badge: '100% Бесплатно & Открытый Исходный Код',
        titleLine1: 'Суверенность',
        titleAccent: 'Личности',
        description:
          'Профессиональная альтернатива проприетарным сервисам личных мультиссылок. Полный суверенный контроль над вашими данными, плейлистами фоновой музыки, виджетами со своим HTML/CSS кодом, прозрачными бейджами, динамическими темами фона (Матрица, Световой дождь, Звездный вихрь) и аналитикой в реальном времени.',
        primaryLabel: 'ЗАПУСТИТЬ ОНЛАЙН-КОНСТРУКТОР',
        secondaryLabel: 'СКРИПТ УСТАНОВКИ',
        showSecondary: true,
      };
    case 'stats':
      return {
        useCustomStats: false,
        stats: [
          { label: 'Селф-хостинг', value: 'В 1 команду' },
          { label: 'Профилей', value: '100+' },
          { label: 'Лицензия', value: 'MIT' },
        ],
      };
    case 'features':
      return {
        title: 'Guns.lol против CRY BIOS',
        subtitle:
          'Перестаньте переплачивать за галочки верификации, специальные эффекты заднего фона, поддержку стороннего HTML-кода и виджеты отслеживания. Всё это принадлежит вам бесплатно.',
        features: DEFAULT_FEATURES.map((f) => ({ ...f })),
      };
    case 'opensource':
      return {};
    case 'profiles':
      return {
        title: 'Активные профили на платформе',
        subtitle:
          'Выберите пример профиля на нашей запущенной ноде CRY BIOS, чтобы ознакомиться с возможностями глубокой кастомизации.',
        limit: 30,
      };
    case 'installer':
      return {};
    case 'text':
      return { title: 'Заголовок', body: 'Текст блока. Пустая строка начинает новый абзац.', align: 'left' };
    case 'cta':
      return { title: 'Готовы начать?', text: 'Создайте свою страницу за минуту — это бесплатно.', buttonLabel: 'Создать профиль', buttonUrl: '/dashboard' };
    case 'faq':
      return {
        title: 'Частые вопросы',
        faq: [
          { q: 'Это правда бесплатно?', a: 'Да. Платформа с открытым исходным кодом, ограничений по функциям нет.' },
          { q: 'Можно развернуть у себя?', a: 'Да, достаточно одной команды установки или docker-compose.' },
        ],
      };
  }
}

let idCounter = 0;
export function newBlockId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createBlock(type: HomeBlockType): HomeBlock {
  return { id: newBlockId(), type, enabled: true, props: defaultBlockProps(type) };
}

export function getDefaultHomeLayout(): HomeLayout {
  const order: HomeBlockType[] = ['hero', 'stats', 'features', 'opensource', 'profiles', 'installer'];
  return {
    version: 1,
    updatedAt: null,
    settings: { ...DEFAULT_SETTINGS },
    blocks: order.map((type) => ({ id: `default-${type}`, type, enabled: true, props: defaultBlockProps(type) })),
  };
}

/* ---------- санитайзер ---------- */

const MAX_BLOCKS = 40;
const MAX_ITEMS = 12;

function str(v: unknown, max: number, fallback = ''): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : fallback;
}

/** Разрешены только http(s), mailto:, относительные пути и якоря. */
export function sanitizeUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim().slice(0, 500);
  if (!s) return '';
  if (s.startsWith('//')) return '';
  if (s.startsWith('/') || s.startsWith('#')) return s;
  try {
    const u = new URL(s);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

function sanitizeProps(type: HomeBlockType, raw: any): HomeBlockProps {
  const base = defaultBlockProps(type);
  const r = raw && typeof raw === 'object' ? raw : {};
  const out: HomeBlockProps = { ...base };
  const set = <K extends keyof HomeBlockProps>(key: K, value: HomeBlockProps[K]) => {
    out[key] = value;
  };

  switch (type) {
    case 'announcement':
      set('text', str(r.text, 300, base.text));
      set('level', ['info', 'warning', 'success'].includes(r.level) ? r.level : 'info');
      set('linkLabel', str(r.linkLabel, 60));
      set('linkUrl', sanitizeUrl(r.linkUrl));
      break;
    case 'hero':
      set('badge', str(r.badge, 100, base.badge));
      set('titleLine1', str(r.titleLine1, 60, base.titleLine1));
      set('titleAccent', str(r.titleAccent, 60, base.titleAccent));
      set('description', str(r.description, 900, base.description));
      set('primaryLabel', str(r.primaryLabel, 60, base.primaryLabel));
      set('secondaryLabel', str(r.secondaryLabel, 60, base.secondaryLabel));
      set('showSecondary', typeof r.showSecondary === 'boolean' ? r.showSecondary : true);
      break;
    case 'stats': {
      set('useCustomStats', Boolean(r.useCustomStats));
      const items = Array.isArray(r.stats) ? r.stats.slice(0, 6) : base.stats!;
      set(
        'stats',
        items
          .map((i: any) => ({ label: str(i?.label, 40), value: str(i?.value, 30) }))
          .filter((i: StatItem) => i.label || i.value),
      );
      break;
    }
    case 'features': {
      set('title', str(r.title, 120, base.title));
      set('subtitle', str(r.subtitle, 400));
      const items = Array.isArray(r.features) ? r.features.slice(0, MAX_ITEMS) : base.features!;
      set(
        'features',
        items
          .map((i: any) => ({
            icon: (FEATURE_ICONS as readonly string[]).includes(i?.icon) ? (i.icon as FeatureIcon) : 'sparkles',
            title: str(i?.title, 80),
            text: str(i?.text, 400),
          }))
          .filter((i: FeatureItem) => i.title || i.text),
      );
      break;
    }
    case 'profiles': {
      set('title', str(r.title, 120, base.title));
      set('subtitle', str(r.subtitle, 400));
      const n = Number(r.limit);
      set('limit', Number.isFinite(n) ? Math.min(100, Math.max(1, Math.round(n))) : 30);
      break;
    }
    case 'text':
      set('title', str(r.title, 120));
      set('body', str(r.body, 4000));
      set('align', r.align === 'center' ? 'center' : 'left');
      break;
    case 'cta':
      set('title', str(r.title, 120, base.title));
      set('text', str(r.text, 400));
      set('buttonLabel', str(r.buttonLabel, 60, base.buttonLabel));
      set('buttonUrl', sanitizeUrl(r.buttonUrl) || '/dashboard');
      break;
    case 'faq': {
      set('title', str(r.title, 120, base.title));
      const items = Array.isArray(r.faq) ? r.faq.slice(0, MAX_ITEMS) : base.faq!;
      set(
        'faq',
        items
          .map((i: any) => ({ q: str(i?.q, 200), a: str(i?.a, 1200) }))
          .filter((i: FaqItem) => i.q),
      );
      break;
    }
    default:
      break;
  }
  return out;
}

/**
 * Приводит произвольный JSON к валидному макету. Для пустого/битого ввода возвращает дефолтный макет.
 * Блок с неизвестным типом отбрасывается, уникальные блоки (opensource, profiles, installer) не дублируются.
 */
export function sanitizeHomeLayout(input: unknown): HomeLayout {
  const src = input as any;
  if (!src || typeof src !== 'object' || !Array.isArray(src.blocks)) {
    return getDefaultHomeLayout();
  }
  const seenIds = new Set<string>();
  const seenUnique = new Set<HomeBlockType>();
  const blocks: HomeBlock[] = [];

  for (const b of src.blocks.slice(0, MAX_BLOCKS)) {
    if (!b || typeof b !== 'object') continue;
    const type = b.type as HomeBlockType;
    if (!(BLOCK_TYPES as readonly string[]).includes(type)) continue;
    if (BLOCK_META[type].unique) {
      if (seenUnique.has(type)) continue;
      seenUnique.add(type);
    }
    let id = typeof b.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(b.id) ? b.id : newBlockId();
    while (seenIds.has(id)) id = newBlockId();
    seenIds.add(id);
    blocks.push({ id, type, enabled: b.enabled !== false, props: sanitizeProps(type, b.props) });
  }

  const s = src.settings && typeof src.settings === 'object' ? src.settings : {};
  return {
    version: 1,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt.slice(0, 40) : null,
    settings: {
      siteName: str(s.siteName, 40, DEFAULT_SETTINGS.siteName) || DEFAULT_SETTINGS.siteName,
      tagline: str(s.tagline, 120, DEFAULT_SETTINGS.tagline),
      showHeaderGithub: s.showHeaderGithub !== false,
      showFooterInstall: s.showFooterInstall !== false,
      footerNote: str(s.footerNote, 200),
    },
    blocks,
  };
}
