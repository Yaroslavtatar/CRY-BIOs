// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LegalPage from '../src/components/LegalPage';
import { resetLegalCache } from '../src/hooks/useLegal';
import { DEFAULT_LEGAL } from '../src/legalConfig';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const mockLegal = (over: Record<string, unknown>) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...DEFAULT_LEGAL, ...over }) })));

const render = async (doc: 'privacy' | 'terms') => {
  await act(async () => { root.render(<LegalPage doc={doc} onExit={() => {}} />); });
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  resetLegalCache();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('LegalPage с данными из админки', () => {
  it('подставляет оператора, реквизиты и контакты', async () => {
    mockLegal({ operatorForm: 'ИП', operatorName: 'Иванов И. И.', taxId: '7700000000', operatorContact: 'help@example.com', abuseContact: 'abuse@example.com' });
    await render('privacy');
    const text = container.textContent || '';
    expect(text).toContain('ИП Иванов И. И.');
    expect(text).toContain('ИНН 7700000000');
    expect(text).toContain('help@example.com');
    expect(text).toContain('abuse@example.com');
    expect(text).not.toContain('[заполните');
  });

  it('показывает заглушки, пока данные не заполнены', async () => {
    mockLegal({});
    await render('terms');
    expect(container.textContent).toContain('[заполните');
  });

  it('выводит дополнительные положения как текст, не как HTML', async () => {
    mockLegal({ termsExtra: 'Первый абзац.\n\n<img src=x onerror=alert(1)>', jurisdiction: 'Российская Федерация' });
    await render('terms');
    expect(container.textContent).toContain('Первый абзац.');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Российская Федерация');
  });

  it('при ошибке сети остаётся на значениях по умолчанию', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await render('privacy');
    expect(container.textContent).toContain('Политика конфиденциальности');
  });
});
