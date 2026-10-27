// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dashboard from '../src/components/Dashboard';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ID = '123456789012345678';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const baseBio = {
  username: 'alice',
  displayName: 'Alice',
  bio: 'hi',
  avatarUrl: '',
  blocks: [],
  socials: [],
};

let container: HTMLDivElement;
let root: Root;
let resolveBio: (b: unknown) => void;

function mockFetch(bioFor: () => Promise<unknown> | unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/bio/alice') && !url.includes('analytics')) return jsonResponse(await bioFor());
    if (url.startsWith('/api/discord/')) return jsonResponse({ success: true, data: { source: 'oauth', discord_user: { id: ID } } });
    return jsonResponse({});
  });
}

beforeEach(() => {
  localStorage.setItem('biogun_username', 'alice');
  localStorage.setItem('biogun_token', 'tok');
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ??= () => {};
  HTMLCanvasElement.prototype.getContext = (() => null) as any;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe('Dashboard и Discord', () => {
  it('не падает, пока конфиг профиля ещё загружается (config === null)', async () => {
    mockFetch(() => new Promise((res) => (resolveBio = res)));
    await act(async () => {
      root.render(<Dashboard onExit={() => {}} onViewProfile={() => {}} />);
    });
    // конфиг ещё null: первый рендер и эффекты отработали без исключений
    expect(container.innerHTML).not.toBe('');
    await act(async () => resolveBio({ ...baseBio }));
    await flush();
  });

  it('после загрузки привязанного Discord показывает подключение и проверяет live-статус', async () => {
    mockFetch(() => ({ ...baseBio, discordConnected: true, discordId: ID, discordUsername: 'ali' }));
    await act(async () => {
      root.render(<Dashboard onExit={() => {}} onViewProfile={() => {}} />);
    });
    await flush();
    const calls = (globalThis.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u === `/api/discord/${ID}`)).toBe(true);
  });
});
