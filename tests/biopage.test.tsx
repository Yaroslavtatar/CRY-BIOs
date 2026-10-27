// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BioPage from '../src/components/BioPage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ID = '123456789012345678';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const bio: any = {
  username: 'alice',
  displayName: 'Alice',
  bio: 'hi',
  avatarUrl: '',
  blocks: [{ id: 'b1', type: 'status_api', title: 'st', enabled: true, statusProvider: 'discord', statusCustomText: 'fallback text' }],
  socials: [],
  layout: ['avatar', 'username', 'discord', 'blocks'],
  discordConnected: true,
  discordId: ID,
  discordUsername: 'ali',
  discordDisplayName: 'Alice D',
  discordPublicFlags: 1 << 22,
};

let container: HTMLDivElement;
let root: Root;

function mockPresence(lanyard: boolean) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === `/api/discord/${ID}`) {
      if (!lanyard) return jsonResponse({ success: false, error: 'Discord presence unavailable' }, 404);
      return jsonResponse({
        success: true,
        data: {
          source: 'lanyard',
          discord_status: 'online',
          discord_user: { id: ID, username: 'ali', display_name: 'Alice D', avatar: null, badges: [] },
          activities: [{ type: 0, name: 'Minecraft' }],
        },
      });
    }
    return jsonResponse({});
  });
}

beforeEach(() => {
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.scrollTo = () => {};
  HTMLCanvasElement.prototype.getContext = (() => null) as any;
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as any;
  HTMLMediaElement.prototype.pause = (() => {}) as any;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

describe('BioPage и Discord', () => {
  it('рисует карточку из данных OAuth, даже если Lanyard недоступен (без вечного скелетона)', async () => {
    mockPresence(false);
    await act(async () => root.render(<BioPage username="alice" onExit={() => {}} previewConfig={bio} />));
    await flush();
    expect(container.textContent).toContain('Alice D');
    expect(container.textContent).toContain('@ali');
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('показывает live-статус и активность из Lanyard', async () => {
    mockPresence(true);
    await act(async () => root.render(<BioPage username="alice" onExit={() => {}} previewConfig={bio} />));
    await flush();
    expect(container.textContent).toContain('Playing Minecraft');
    expect(container.textContent).toContain('Online'); // блок «Discord Статус»
  });

  it('блок статуса с источником Discord без привязки падает назад на свой текст', async () => {
    mockPresence(false);
    const unlinked = { ...bio, discordConnected: false, discordId: undefined };
    await act(async () => root.render(<BioPage username="alice" onExit={() => {}} previewConfig={unlinked} />));
    await flush();
    expect(container.textContent).toContain('fallback text');
  });
});
