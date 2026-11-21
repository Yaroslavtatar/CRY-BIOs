// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AccountSettings, { TwoFactorCard } from '../src/components/AccountSettings';
import FirstSteps from '../src/components/FirstSteps';
import { DEFAULT_UI_PREFS, accentStyle, isChecklistHidden, isOnboardingPending, readUiPrefs, setChecklistHidden, setOnboardingPending } from '../src/uiPrefs';
import { detectStudioPreset, readStudioPrefs, STUDIO_PRESETS } from '../src/studioPrefs';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const byText = (sel: string, re: RegExp) =>
  Array.from(container.querySelectorAll<HTMLElement>(sel)).find((b) => re.test(b.textContent || b.getAttribute('aria-label') || ''))!;
const click = (re: RegExp, sel = 'button') => act(async () => byText(sel, re).click());
const type = (label: RegExp | string, value: string) =>
  act(async () => {
    const el = Array.from(container.querySelectorAll<HTMLInputElement>('input')).find((i) =>
      typeof label === 'string' ? i.getAttribute('aria-label') === label : label.test(i.getAttribute('aria-label') || ''),
    )!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const flush = () => act(async () => { await Promise.resolve(); });

type Reply = { ok?: boolean; json: unknown };
function mockFetch(routes: Record<string, Reply | Reply[]>) {
  const seen: { url: string; body: any }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    seen.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[url];
    const reply = Array.isArray(r) ? r.shift()! : r;
    if (!reply) throw new Error(`unexpected fetch ${url}`);
    return { ok: reply.ok ?? true, json: async () => reply.json } as Response;
  }));
  return seen;
}

describe('TwoFactorCard', () => {
  it('полный путь: пароль → QR → код → резервные коды → готово', async () => {
    const seen = mockFetch({
      '/api/account/security': [{ json: { twoFactorEnabled: false, recoveryCodesLeft: 0 } }, { json: { twoFactorEnabled: true, recoveryCodesLeft: 10 } }],
      '/api/auth/2fa/setup': { json: { secret: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', qr: 'data:image/png;base64,AAAA' } },
      '/api/auth/2fa/enable': { json: { success: true, recoveryCodes: ['AAAAA-BBBBB', 'CCCCC-DDDDD'] } },
    });
    await act(async () => root.render(<TwoFactorCard username="bob" />));
    await flush();
    await click(/Включить 2FA/);
    await type('Текущий пароль', 'Correct-Horse-9');
    await click(/Продолжить/);
    await flush();

    expect(seen.find((s) => s.url === '/api/auth/2fa/setup')!.body).toEqual({ password: 'Correct-Horse-9' });
    expect(container.querySelector('img')!.getAttribute('src')).toContain('data:image/png');
    expect(container.querySelector('[data-testid="two-factor-secret"]')!.textContent).toBe('ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567');

    const confirm = byText('button', /Подтвердить и включить/) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await type('Код из приложения', '123 456');
    expect((byText('button', /Подтвердить и включить/) as HTMLButtonElement).disabled).toBe(false);
    await click(/Подтвердить и включить/);
    await flush();
    expect(seen.find((s) => s.url === '/api/auth/2fa/enable')!.body).toEqual({ code: '123 456' });

    expect(container.textContent).toContain('AAAAA-BBBBB');
    const done = byText('button', /Готово/) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    await act(async () => (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    expect((byText('button', /Готово/) as HTMLButtonElement).disabled).toBe(false);
    await click(/Готово/);
    await flush();
    expect(container.textContent).toContain('2FA включена');
    expect(container.textContent).not.toContain('AAAAA-BBBBB');
  });

  it('показывает ошибку сервера при неверном коде и остаётся на шаге', async () => {
    mockFetch({
      '/api/account/security': { json: { twoFactorEnabled: false } },
      '/api/auth/2fa/setup': { json: { secret: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', qr: 'data:image/png;base64,AAAA' } },
      '/api/auth/2fa/enable': { ok: false, json: { error: 'Неверный код. Проверьте время на телефоне и попробуйте ещё раз' } },
    });
    await act(async () => root.render(<TwoFactorCard username="bob" />));
    await flush();
    await click(/Включить 2FA/);
    await type('Текущий пароль', 'pw');
    await click(/Продолжить/);
    await flush();
    await type('Код из приложения', '000000');
    await click(/Подтвердить и включить/);
    await flush();
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Неверный код');
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('неверный пароль на старте не пускает к QR', async () => {
    mockFetch({
      '/api/account/security': { json: { twoFactorEnabled: false } },
      '/api/auth/2fa/setup': { ok: false, json: { error: 'Неверный пароль' } },
    });
    await act(async () => root.render(<TwoFactorCard username="bob" />));
    await flush();
    await click(/Включить 2FA/);
    await type('Текущий пароль', 'nope');
    await click(/Продолжить/);
    await flush();
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('Неверный пароль');
    expect(container.querySelector('img')).toBeNull();
  });

  it('когда включена: предупреждает о малом числе кодов и отключает по паролю и коду', async () => {
    const seen = mockFetch({
      '/api/account/security': [{ json: { twoFactorEnabled: true, recoveryCodesLeft: 1 } }, { json: { twoFactorEnabled: false } }],
      '/api/auth/2fa/disable': { json: { success: true } },
    });
    await act(async () => root.render(<TwoFactorCard username="bob" />));
    await flush();
    expect(container.textContent).toContain('Создайте новые');
    await click(/Отключить 2FA/);
    await type('Текущий пароль', 'pw');
    await type('Код подтверждения', '654321');
    await click(/^Отключить$/);
    await flush();
    expect(seen.find((s) => s.url === '/api/auth/2fa/disable')!.body).toEqual({ password: 'pw', code: '654321' });
    expect(container.textContent).toContain('Включить 2FA');
  });
});

describe('AccountSettings: стиль интерфейса', () => {
  const props = { username: 'bob', onRename: vi.fn(), onLogout: vi.fn(), onRestartOnboarding: vi.fn(), onShowChecklist: vi.fn() };

  beforeEach(() => {
    mockFetch({ '/api/account/security': { json: { twoFactorEnabled: false } } });
  });

  it('режим редактора, предпросмотр и акцент сохраняются на устройстве', async () => {
    await act(async () => root.render(<AccountSettings {...props} />));
    await flush();
    expect(readUiPrefs()).toEqual(DEFAULT_UI_PREFS);
    await click(/Простой/);
    await click(/Скрыть/);
    await click(/Акцент #f43f5e/);
    expect(readUiPrefs()).toEqual({ editorMode: 'simple', preview: 'hidden', accent: '#f43f5e' });
    await click(/Цвет темы/);
    expect(readUiPrefs().accent).toBeNull();
  });

  it('готовые стили конструктора выставляют все параметры разом', async () => {
    await act(async () => root.render(<AccountSettings {...props} />));
    await flush();
    await click(/Для телефона/);
    expect(readStudioPrefs()).toEqual({ panelSide: 'right', controls: 'large', showGrid: false });
    expect(detectStudioPreset(readStudioPrefs())).toBe('touch');
    await click(/^Слева/);
    expect(readStudioPrefs().panelSide).toBe('left');
    // ручная правка выводит из пресета
    await click(/Крупные кнопки/);
    expect(detectStudioPreset(readStudioPrefs())).toBeNull();
    expect(STUDIO_PRESETS.map((p) => p.id)).toEqual(['classic', 'touch', 'compact']);
  });

  it('кнопки аккаунта и обучения вызывают переданные действия', async () => {
    await act(async () => root.render(<AccountSettings {...props} />));
    await flush();
    await click(/Сменить имя/);
    await click(/Выйти/);
    await click(/приветственный мастер/);
    await click(/Вернуть чек-лист/);
    expect(props.onRename).toHaveBeenCalledOnce();
    expect(props.onLogout).toHaveBeenCalledOnce();
    expect(props.onRestartOnboarding).toHaveBeenCalledOnce();
    expect(props.onShowChecklist).toHaveBeenCalledOnce();
  });

  it('смена пароля отправляет оба поля', async () => {
    const seen = mockFetch({
      '/api/account/security': { json: { twoFactorEnabled: false } },
      '/api/auth/change-password': { json: { success: true } },
    });
    await act(async () => root.render(<AccountSettings {...props} />));
    await flush();
    await type('Текущий пароль', 'old-Pass-1');
    await type('Новый пароль', 'new-Pass-22');
    await click(/Сменить пароль/);
    await flush();
    expect(seen.find((s) => s.url === '/api/auth/change-password')!.body).toEqual({ currentPassword: 'old-Pass-1', newPassword: 'new-Pass-22' });
    expect(container.textContent).toContain('Пароль изменён');
  });
});

describe('uiPrefs', () => {
  it('битые данные в хранилище не ломают чтение', () => {
    localStorage.setItem('cb_ui_prefs', '{"editorMode":"x","preview":5,"accent":"red; background:url(x)"}');
    expect(readUiPrefs()).toEqual(DEFAULT_UI_PREFS);
    localStorage.setItem('cb_ui_prefs', 'не json');
    expect(readUiPrefs()).toEqual(DEFAULT_UI_PREFS);
  });

  it('акцент — только #rrggbb, текст на светлом акценте тёмный', () => {
    expect(accentStyle(null)).toBeUndefined();
    expect(accentStyle('red')).toBeUndefined();
    expect((accentStyle('#ffee00') as any)['--cb-on-accent']).toBe('#000000');
    expect((accentStyle('#1e1b4b') as any)['--cb-on-accent']).toBe('#ffffff');
    expect((accentStyle('#00f2ff') as any)['--cb-accent']).toBe('#00f2ff');
  });

  it('прогресс онбординга и чек-листа хранится по пользователю', () => {
    setOnboardingPending('bob', true);
    expect(isOnboardingPending('bob')).toBe(true);
    expect(isOnboardingPending('alice')).toBe(false);
    setOnboardingPending('bob', false);
    expect(isOnboardingPending('bob')).toBe(false);
    setChecklistHidden('bob', true);
    expect(isChecklistHidden('bob')).toBe(true);
    expect(isChecklistHidden('alice')).toBe(false);
  });
});

describe('FirstSteps', () => {
  it('считает прогресс, выделяет следующий шаг и ведёт к нему', async () => {
    const go = vi.fn();
    const hide = vi.fn();
    const items = [
      { id: 'a', title: 'Аватар', hint: 'h', done: true, action: 'Профиль', onAction: vi.fn() },
      { id: 'b', title: 'Соцсети', hint: 'h', done: false, action: 'Блоки', onAction: go },
    ];
    await act(async () => root.render(<FirstSteps items={items} onHide={hide} />));
    expect(container.textContent).toContain('Выполнено 1 из 2');
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('50');
    await click(/Блоки/);
    expect(go).toHaveBeenCalledOnce();
    await click(/Скрыть чек-лист/);
    expect(hide).toHaveBeenCalledOnce();
  });
});
