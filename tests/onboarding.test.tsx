// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Onboarding from '../src/components/Onboarding';
import type { BioConfig } from '../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let latest: BioConfig;
const calls = { save: 0, studio: 0, close: 0 };

function Harness() {
  const [config, setConfig] = useState({ displayName: 'bob', bio: 'hi', primaryColor: '#8a2be2', glowColor: '#a855f7' } as BioConfig);
  latest = config;
  return (
    <Onboarding
      username="bob"
      config={config}
      onChange={setConfig}
      onSave={() => calls.save++}
      onOpenStudio={() => calls.studio++}
      onClose={() => calls.close++}
    />
  );
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  calls.save = calls.studio = calls.close = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (re: RegExp) => Array.from(container.querySelectorAll('button')).find((b) => re.test(b.textContent || b.getAttribute('aria-label') || ''))!;
const click = (re: RegExp) => act(async () => button(re).click());

describe('Onboarding', () => {
  it('проходит шаги, применяет имя и цвет и открывает студию', async () => {
    await act(async () => root.render(<Harness />));
    expect(container.textContent).toContain('Шаг 1 из 4');
    await click(/Дальше/);
    const name = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(name, 'Bobby');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(latest.displayName).toBe('Bobby');
    await click(/Дальше/);
    await click(/Цвет #22d3ee/);
    expect(latest.primaryColor).toBe('#22d3ee');
    expect(latest.glowColor).toBe('#22d3ee');
    await click(/Дальше/);
    await click(/Открыть студию/);
    expect(calls).toEqual({ save: 1, studio: 1, close: 1 });
  });

  it('«Пропустить» сохраняет и закрывает без студии; «Назад» возвращает шаг', async () => {
    await act(async () => root.render(<Harness />));
    await click(/Дальше/);
    await click(/Назад/);
    expect(container.textContent).toContain('Шаг 1 из 4');
    await click(/Пропустить/);
    expect(calls).toEqual({ save: 1, studio: 0, close: 1 });
  });
});
