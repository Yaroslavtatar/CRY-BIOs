// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ImportMenu from '../src/components/ImportMenu';
import { runProfileImport } from '../src/import/client';
import type { ImportJobResult } from '../src/import/types';
import type { BioConfig } from '../src/types';

vi.mock('../src/import/client', () => ({ runProfileImport: vi.fn() }));
const run = vi.mocked(runProfileImport);

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const config = {
  username: 'alice', displayName: 'Alice', bio: 'old bio', avatarUrl: '',
  blocks: [{ id: 'b1', type: 'socials', title: 'Links', enabled: true, socialsList: [{ id: 's1', platform: 'github', url: 'https://github.com/alice' }] }],
} as unknown as BioConfig;

const result = (patch: Record<string, unknown> = {}, warnings: string[] = []): ImportJobResult => ({
  profile: {
    source: 'linktree', sourceLabel: 'Linktree', sourceUsername: 'alice', displayName: 'Alice Linktree', bio: 'new bio',
    socialsList: [{ id: 'l-1', platform: 'website', url: 'https://alice.dev/', label: 'Site' }, { id: 'l-2', platform: 'instagram', url: 'https://instagram.com/alice' }],
    ...patch,
  } as any,
  warnings,
});

const mount = async (onApply = vi.fn()) => {
  await act(async () => root.render(<ImportMenu config={config} onApply={onApply} />));
  return onApply;
};
const q = <T extends HTMLElement>(sel: string) => container.querySelector<T>(sel);
const byText = (sel: string, re: RegExp) => Array.from(container.querySelectorAll<HTMLElement>(sel)).find((e) => re.test(e.textContent || ''))!;
const choose = (label: RegExp) => act(async () => byText('[role="radio"]', label).click());
const click = (re: RegExp, sel = 'button') => act(async () => byText(sel, re).click());
const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

beforeEach(() => {
  run.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ImportMenu', () => {
  it('показывает платформы, а форму — только после выбора', async () => {
    await mount();
    const radios = Array.from(container.querySelectorAll('[role="radio"]')).map((r) => r.textContent);
    expect(radios).toHaveLength(4);
    expect(radios.join(' ')).toMatch(/guns\.lol.*Linktree.*Telegram.*GitHub/);
    expect(q('#import-input')).toBeNull();

    await choose(/GitHub/);
    expect(q('#import-input')).not.toBeNull();
    expect(container.textContent).toContain('Логин или ссылка на GitHub');
    expect(byText('[role="radio"]', /GitHub/).getAttribute('aria-checked')).toBe('true');
  });

  it('не запускает импорт с пустым полем', async () => {
    await mount();
    await choose(/Linktree/);
    await click(/Импортировать/);
    expect(q('[role="alert"]')?.textContent).toMatch(/Введите ссылку или имя/);
    expect(run).not.toHaveBeenCalled();
  });

  it('полный путь: ввод → предпросмотр → выбор разделов → применение', async () => {
    run.mockResolvedValue(result());
    const onApply = await mount();
    await choose(/Linktree/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'https://linktr.ee/alice');
    await click(/^Импортировать$/);
    await flush();

    expect(run).toHaveBeenCalledWith('linktree', 'https://linktr.ee/alice', expect.any(Object));
    const preview = q('[data-testid="import-preview"]')!;
    expect(preview.textContent).toContain('Alice Linktree');
    expect(preview.textContent).toContain('2 ссылки');
    // «Оформление» у Linktree не поддерживается и не показывается
    expect(preview.textContent).not.toContain('Оформление');

    // отключаем ссылки и применяем только профиль
    await act(async () => byText('label', /Ссылки и соцсети/).querySelector('input')!.click());
    await click(/Применить к профилю/);

    expect(onApply).toHaveBeenCalledTimes(1);
    const next = onApply.mock.calls[0][0] as BioConfig;
    expect(next).toMatchObject({ displayName: 'Alice Linktree', bio: 'new bio' });
    expect(next.blocks[0].socialsList).toHaveLength(1);
    expect(q('[role="status"]')?.textContent).toMatch(/Применено: Имя, описание, аватар/);
    expect(q('[role="status"]')?.textContent).toMatch(/Сохранить/);
  });

  it('по умолчанию отмечает все найденные разделы и объединяет ссылки без потерь', async () => {
    run.mockResolvedValue(result());
    const onApply = await mount();
    await choose(/Linktree/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'alice');
    await click(/^Импортировать$/);
    await flush();
    await click(/Применить к профилю/);
    const links = (onApply.mock.calls[0][0] as BioConfig).blocks[0].socialsList!;
    expect(links.map((l) => l.url)).toEqual(['https://github.com/alice', 'https://alice.dev/', 'https://instagram.com/alice']);
  });

  it('нельзя применить, если ничего не отмечено', async () => {
    run.mockResolvedValue(result());
    await mount();
    await choose(/Linktree/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'alice');
    await click(/^Импортировать$/);
    await flush();
    for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('[data-testid="import-preview"] input[type="checkbox"]'))) {
      await act(async () => input.click());
    }
    expect(byText('button', /Применить к профилю/).hasAttribute('disabled')).toBe(true);
  });

  it('показывает предупреждения источника перед применением', async () => {
    run.mockResolvedValue(result({}, ['Не удалось сохранить на сервере: аватар.']));
    await mount();
    await choose(/Linktree/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'alice');
    await click(/^Импортировать$/);
    await flush();
    expect(q('[data-testid="import-preview"]')?.textContent).toContain('Не удалось сохранить на сервере: аватар.');
  });

  it('показывает ошибку и оставляет форму для повторной попытки', async () => {
    run.mockRejectedValue(new Error('Профиль не найден. Проверьте имя'));
    await mount();
    await choose(/GitHub/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'ghost');
    await click(/^Импортировать$/);
    await flush();
    expect(q('[role="alert"]')?.textContent).toContain('Профиль не найден. Проверьте имя');
    expect(q('#import-input')).not.toBeNull();
    expect(q('[data-testid="import-preview"]')).toBeNull();
  });

  it('сообщает, если на странице нечего переносить', async () => {
    run.mockResolvedValue({ profile: { source: 'telegram', sourceLabel: 'Telegram' } as any, warnings: [] });
    await mount();
    await choose(/Telegram/);
    await setValue(q<HTMLInputElement>('#import-input')!, '@bobby');
    await click(/^Импортировать$/);
    await flush();
    expect(q('[role="alert"]')?.textContent).toMatch(/не нашлось данных/);
  });

  it('подсказывает переключиться, если вставлена ссылка другой платформы', async () => {
    await mount();
    await choose(/GitHub/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'https://t.me/bobby');
    expect(container.textContent).toContain('Похоже на ссылку Telegram');
    await click(/Переключить платформу/);
    expect(byText('[role="radio"]', /Telegram/).getAttribute('aria-checked')).toBe('true');
    expect(q<HTMLInputElement>('#import-input')!.value).toBe('');
  });

  it('ручная вставка HTML есть только у платформ, где она поддерживается', async () => {
    await mount();
    await choose(/guns\.lol/);
    await click(/Вставить HTML вручную/);
    expect(q('textarea#import-input')).not.toBeNull();
    expect(container.textContent).toMatch(/Ctrl\+U/);
    await choose(/Telegram/);
    expect(container.textContent).not.toMatch(/Вставить HTML вручную/);
  });

  it('«Импортировать ещё» возвращает к выбору платформы', async () => {
    run.mockResolvedValue(result());
    await mount();
    await choose(/Linktree/);
    await setValue(q<HTMLInputElement>('#import-input')!, 'alice');
    await click(/^Импортировать$/);
    await flush();
    await click(/Применить к профилю/);
    await click(/Импортировать ещё/);
    expect(q('#import-input')).toBeNull();
    expect(Array.from(container.querySelectorAll('[role="radio"]')).every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });
});
