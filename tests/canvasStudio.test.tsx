// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CanvasStudio from '../src/components/CanvasStudio';
import { enableCanvas } from '../src/canvasLayout';
import type { BioConfig } from '../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const baseConfig = (): BioConfig =>
  enableCanvas({
    username: 'alice',
    displayName: 'Alice',
    bio: 'hello',
    avatarUrl: '',
    verified: false,
    customBadge: 'USER',
    sparkles: false,
    primaryColor: '#ffffff',
    textColor: '#ffffff',
    glowColor: '#ffffff',
    fontFamily: 'Inter',
    bgType: 'color',
    bgValue: '#000000',
    bgBlur: 0,
    bgDim: 0,
    audioUrl: '',
    audioTitle: '',
    audioArtist: '',
    audioEnabled: false,
    enterText: 'enter',
    blocks: [{ id: 'q1', type: 'quote', title: 'q', enabled: true, quoteText: 'be water', quoteAuthor: 'bruce' }],
  } as BioConfig);

let latest: BioConfig;
function Harness() {
  const [config, setConfig] = useState(baseConfig);
  latest = config;
  return <CanvasStudio config={config} username="alice" onChange={setConfig} onClose={() => {}} onSave={() => {}} saveStatus="idle" />;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as any).matchMedia ??= (q: string) => ({ matches: q.includes('min-width: 1024px'), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  Element.prototype.scrollIntoView = () => {};
  (globalThis as any).CSS ??= { escape: (s: string) => s };
  window.scrollTo = () => {};
  HTMLCanvasElement.prototype.getContext = (() => null) as any;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const frameEl = (id: string) => container.querySelector(`[data-canvas-id="${id}"]`) as HTMLElement;
const btn = (label: string) => container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

async function drag(id: string, from: [number, number], to: [number, number]) {
  await act(async () => {
    frameEl(id).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: from[0], clientY: from[1] }));
  });
  await act(async () => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: to[0], clientY: to[1] }));
  });
  await act(async () => {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: to[0], clientY: to[1] }));
  });
}

describe('CanvasStudio', () => {
  it('перетаскивание двигает элемент с привязкой к сетке, отмена возвращает назад', async () => {
    await act(async () => root.render(<Harness />));
    const startX = latest.canvas!.desktop!.frames['avatar'].x;
    const startY = latest.canvas!.desktop!.frames['avatar'].y;

    await drag('avatar', [100, 100], [140, 150]);
    const moved = latest.canvas!.desktop!.frames['avatar'];
    expect(moved.x).toBe(Math.round((startX + 40) / 8) * 8);
    expect(moved.y).toBe(Math.round((startY + 50) / 8) * 8);
    expect(btn('Отменить').disabled).toBe(false);

    await act(async () => btn('Отменить').click());
    expect(latest.canvas!.desktop!.frames['avatar']).toMatchObject({ x: startX, y: startY });
    expect(btn('Повторить').disabled).toBe(false);

    await act(async () => btn('Повторить').click());
    expect(latest.canvas!.desktop!.frames['avatar'].x).toBe(moved.x);
  });

  it('весь жест — один шаг истории', async () => {
    await act(async () => root.render(<Harness />));
    const startX = latest.canvas!.desktop!.frames['avatar'].x;
    await act(async () => {
      frameEl('avatar').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
    });
    for (const x of [10, 20, 30, 40]) {
      await act(async () => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 0 }));
      });
    }
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    await act(async () => btn('Отменить').click());
    expect(latest.canvas!.desktop!.frames['avatar'].x).toBe(startX);
    expect(btn('Отменить').disabled).toBe(true);
  });

  it('заблокированный элемент не двигается', async () => {
    await act(async () => root.render(<Harness />));
    await act(async () => {
      frameEl('avatar').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    await act(async () => btn('Заблокировать').click());
    const before = latest.canvas!.desktop!.frames['avatar'];
    expect(before.locked).toBe(true);
    await drag('avatar', [0, 0], [200, 200]);
    expect(latest.canvas!.desktop!.frames['avatar'].x).toBe(before.x);
  });

  it('правка на телефоне создаёт отдельную раскладку, ПК не меняется', async () => {
    await act(async () => root.render(<Harness />));
    expect(latest.canvas!.mobile).toBeUndefined();
    const desktopBefore = JSON.stringify(latest.canvas!.desktop);
    const mobileTab = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-pressed') !== null && /Телефон/.test(b.textContent || ''))!;
    await act(async () => mobileTab.click());
    await drag('avatar', [0, 0], [16, 24]);
    expect(latest.canvas!.mobile).toBeDefined();
    expect(JSON.stringify(latest.canvas!.desktop)).toBe(desktopBefore);
  });

  it('добавление блока создаёт элемент и выбирает его, отмена убирает', async () => {
    await act(async () => root.render(<Harness />));
    const add = Array.from(container.querySelectorAll('button')).find((b) => /Цитата/.test(b.textContent || '') && b.textContent!.includes('+') === false && b.querySelector('svg'))!;
    const before = latest.blocks.length;
    await act(async () => add.click());
    expect(latest.blocks.length).toBe(before + 1);
    await act(async () => btn('Отменить').click());
    expect(latest.blocks.length).toBe(before);
  });
});
