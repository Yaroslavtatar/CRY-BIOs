// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BioPage from '../src/components/BioPage';
import { reconcileDevice } from '../src/canvasLayout';
import type { BioConfig } from '../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const makeConfig = (patch: Partial<BioConfig> = {}): BioConfig =>
  ({
    username: 'alice',
    displayName: 'Alice',
    bio: 'hello world',
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
    ...patch,
  }) as BioConfig;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
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

async function render(el: React.ReactElement) {
  await act(async () => {
    root.render(el);
  });
}

describe('BioPage в режиме канваса', () => {
  it('без canvas.enabled рисует обычную раскладку', async () => {
    await render(<BioPage username="alice" onExit={() => {}} previewConfig={makeConfig()} />);
    expect(container.querySelector('[data-canvas-id]')).toBeNull();
  });

  it('с canvas.enabled рисует каждый элемент в своей рамке', async () => {
    const cfg = makeConfig();
    const canvas = { enabled: true, snap: true, grid: 8, desktop: reconcileDevice(cfg, 'desktop') };
    await render(<BioPage username="alice" onExit={() => {}} previewConfig={{ ...cfg, canvas }} />);
    const ids = Array.from(container.querySelectorAll('[data-canvas-id]')).map((n) => n.getAttribute('data-canvas-id'));
    expect(ids).toEqual(expect.arrayContaining(['avatar', 'username', 'bio', 'block:q1']));
    expect(container.textContent).toContain('be water');
  });

  it('скрытые элементы не рисуются в обычном режиме, но видны в редакторе', async () => {
    const cfg = makeConfig();
    const desktop = reconcileDevice(cfg, 'desktop');
    desktop.frames['bio'] = { ...desktop.frames['bio'], hidden: true };
    const withCanvas = { ...cfg, canvas: { enabled: true, snap: true, grid: 8, desktop } };

    await render(<BioPage username="alice" onExit={() => {}} previewConfig={withCanvas} />);
    expect(container.querySelector('[data-canvas-id="bio"]')).toBeNull();

    await render(
      <BioPage
        username="alice"
        onExit={() => {}}
        previewConfig={withCanvas}
        canvasEditor={{ selectedId: null, onSelect: () => {}, onChangeFrame: () => {}, snap: true, grid: 8, showGrid: true, labelFor: (id) => id }}
      />,
    );
    expect(container.querySelector('[data-canvas-id="bio"]')).not.toBeNull();
  });

  it('использует мобильную раскладку при forceMobile', async () => {
    const cfg = makeConfig();
    const desktop = reconcileDevice(cfg, 'desktop');
    const mobile = reconcileDevice(cfg, 'mobile');
    mobile.frames['avatar'] = { ...mobile.frames['avatar'], x: 11, y: 22 };
    await render(<BioPage username="alice" onExit={() => {}} forceMobile previewConfig={{ ...cfg, canvas: { enabled: true, snap: true, grid: 8, desktop, mobile } }} />);
    const el = container.querySelector('[data-canvas-id="avatar"]') as HTMLElement;
    expect(el.style.left).toBe('11px');
    expect(el.style.top).toBe('22px');
    expect(container.querySelector('[data-canvas-device="mobile"]')).not.toBeNull();
  });

  it('клик по элементу в редакторе выбирает его', async () => {
    const cfg = makeConfig();
    const onSelect = vi.fn();
    await render(
      <BioPage
        username="alice"
        onExit={() => {}}
        previewConfig={{ ...cfg, canvas: { enabled: true, snap: true, grid: 8, desktop: reconcileDevice(cfg, 'desktop') } }}
        canvasEditor={{ selectedId: null, onSelect, onChangeFrame: () => {}, snap: true, grid: 8, showGrid: false, labelFor: (id) => id }}
      />,
    );
    const el = container.querySelector('[data-canvas-id="username"]') as HTMLElement;
    await act(async () => {
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    });
    expect(onSelect).toHaveBeenCalledWith('username');
  });
});
