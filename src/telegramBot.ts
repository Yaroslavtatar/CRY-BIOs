import { normalizeRefCode, type ReferralStore } from './referrals';
import { KEY_TTL_MS, type TelegramAuthStore } from './telegramAuth';

/**
 * Telegram-бот для входа по ключу. Работает через long polling (getUpdates):
 * не нужен публичный HTTPS-адрес и настройка webhook, достаточно исходящего доступа к api.telegram.org.
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN      — токен от @BotFather (без него бот выключен, остальной сайт работает)
 *   TELEGRAM_BOT_USERNAME   — необязательно, иначе берётся через getMe
 *   TELEGRAM_API_BASE       — необязательно: прокси/зеркало API, если api.telegram.org недоступен с сервера
 */

export interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number; type: string };
    from?: { id: number; is_bot?: boolean; username?: string };
  };
}

export interface BotDeps {
  store: TelegramAuthStore;
  refs: ReferralStore;
  siteUrl: () => string;
  send: (chatId: number, html: string) => Promise<void>;
  now?: () => number;
}

const KEYS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

/** Не больше 5 ключей за 10 минут на один Telegram-аккаунт (против спама ботом). */
export class KeyRateLimiter {
  private hits = new Map<string, number[]>();
  allow(id: string, now: number): boolean {
    const list = (this.hits.get(id) ?? []).filter((t) => t > now - WINDOW_MS);
    if (list.length >= KEYS_PER_WINDOW) {
      this.hits.set(id, list);
      return false;
    }
    list.push(now);
    this.hits.set(id, list);
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (v.every((t) => t <= now - WINDOW_MS)) this.hits.delete(k);
    }
    return true;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function createBotHandler(deps: BotDeps) {
  const limiter = new KeyRateLimiter();
  const now = () => deps.now?.() ?? Date.now();

  const sendKey = async (chatId: number, telegramId: string, tgUsername: string, refCode: string) => {
    if (!limiter.allow(telegramId, now())) {
      await deps.send(chatId, 'Слишком много запросов ключа. Подождите несколько минут и попробуйте снова.');
      return;
    }
    const { display } = deps.store.issueKey({ telegramId, tgUsername, refCode }, now());
    const linked = deps.store.getUsernameByTelegramId(telegramId);
    const minutes = Math.round(KEY_TTL_MS / 60000);
    const lines = [
      linked ? `Ваш ключ для входа в аккаунт <b>${esc(linked)}</b>:` : 'Ваш ключ для входа или регистрации:',
      '',
      `<code>${display}</code>`,
      '',
      `Введите его на сайте ${esc(deps.siteUrl())}. Ключ одноразовый и действует ${minutes} минут.`,
      'Никому его не передавайте: с ним можно войти в ваш аккаунт.',
    ];
    await deps.send(chatId, lines.join('\n'));
  };

  return async function handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text || !msg.from || msg.from.is_bot) return;
    if (msg.chat?.type !== 'private') return;
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const tgUsername = msg.from.username ?? '';
    const [rawCmd, ...rest] = msg.text.trim().split(/\s+/);
    const cmd = rawCmd.split('@')[0].toLowerCase();

    if (cmd === '/start' || cmd === '/key' || cmd === '/login') {
      const payload = rest.join(' ');
      let refCode = '';
      if (payload.startsWith('ref_')) {
        const code = normalizeRefCode(payload.slice(4));
        const link = code ? deps.refs.getLink(code) : null;
        if (link?.active) refCode = link.code;
      }
      await sendKey(chatId, telegramId, tgUsername, refCode);
      return;
    }
    await deps.send(chatId, 'Чтобы войти на сайт, отправьте /start — я пришлю одноразовый ключ.');
  };
}

export interface RunningBot {
  stop: () => void;
  username: string;
}

/** Запускает long polling. Возвращает null, если токен не задан. */
export async function startTelegramBot(opts: {
  token: string | undefined;
  apiBase?: string;
  username?: string;
  store: TelegramAuthStore;
  refs: ReferralStore;
  siteUrl: () => string;
  log?: (msg: string) => void;
  fetchImpl?: typeof fetch;
}): Promise<RunningBot | null> {
  const token = (opts.token || '').trim();
  if (!token) return null;
  const log = opts.log ?? ((m: string) => console.log(m));
  const doFetch = opts.fetchImpl ?? fetch;
  const base = `${(opts.apiBase || 'https://api.telegram.org').replace(/\/+$/, '')}/bot${token}`;

  const call = async (method: string, body: unknown, timeoutMs = 15000): Promise<any> => {
    const res = await doFetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err: any = new Error(data.description || `Telegram API HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data.result;
  };

  let username = (opts.username || '').replace(/^@/, '');
  try {
    const me = await call('getMe', {});
    username = me.username || username;
  } catch (e: any) {
    if (e.status === 401) {
      log('[telegram] неверный TELEGRAM_BOT_TOKEN, бот не запущен');
      return null;
    }
    log(`[telegram] getMe не удался (${e.message}); продолжаю, бот попробует подключиться позже`);
  }
  // Если раньше был webhook, getUpdates не работает
  await call('deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);

  const handle = createBotHandler({
    store: opts.store,
    refs: opts.refs,
    siteUrl: opts.siteUrl,
    send: async (chatId, html) => {
      await call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
    },
  });

  let stopped = false;
  let offset = 0;
  const loop = async () => {
    let delay = 1000;
    while (!stopped) {
      try {
        const updates: TelegramUpdate[] = await call(
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message'] },
          40000,
        );
        delay = 1000;
        for (const u of updates) {
          offset = u.update_id + 1;
          try {
            await handle(u);
          } catch (e: any) {
            log(`[telegram] ошибка обработки сообщения: ${e.message}`);
          }
        }
      } catch (e: any) {
        if (stopped) break;
        if (e.status === 401) {
          log('[telegram] токен отозван или неверен, бот остановлен');
          return;
        }
        log(`[telegram] getUpdates: ${e.message}; повтор через ${Math.round(delay / 1000)} с`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30000);
      }
    }
  };
  void loop();
  log(`[telegram] бот запущен${username ? `: @${username}` : ''}`);
  return { username, stop: () => { stopped = true; } };
}
