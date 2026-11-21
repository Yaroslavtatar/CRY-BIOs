// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MobileBottomNav, MobileSubTabs, type NavGroup } from '../src/components/MobileNav';
import { SIMPLE_TABS } from '../src/uiPrefs';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type T = 'overview' | 'analytics' | 'studio' | 'blocks' | 'profile';
const GROUPS: NavGroup<T>[] = [
  { id: 'home', label: 'Главная', tabs: [{ id: 'overview', label: 'Обзор' }, { id: 'analytics', label: 'Статистика' }] },
  { id: 'build', label: 'Конструктор', tabs: [{ id: 'studio', label: 'Студия' }, { id: 'blocks', label: 'Блоки' }] },
  { id: 'account', label: 'Аккаунт', tabs: [{ id: 'profile', label: 'Профиль' }] },
];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  // jsdom не реализует scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
const byLabel = (re: RegExp) => buttons().find((b) => re.test(b.textContent || ''))!;

describe('MobileBottomNav', () => {
  it('показывает все группы и отмечает текущую', async () => {
    await act(async () => root.render(<MobileBottomNav groups={GROUPS} activeTab="blocks" onSelectTab={() => {}} />));
    expect(container.querySelector('nav')!.getAttribute('aria-label')).toBe('Разделы кабинета');
    expect(buttons().map((b) => b.textContent)).toEqual(['Главная', 'Конструктор', 'Аккаунт']);
    expect(buttons().map((b) => b.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('нажатие на другую группу открывает её первый раздел', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(<MobileBottomNav groups={GROUPS} activeTab="overview" onSelectTab={onSelect} />));
    await act(async () => byLabel(/Конструктор/).click());
    expect(onSelect).toHaveBeenCalledWith('studio');
  });

  it('нажатие на текущую группу не сбрасывает открытый подраздел', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(<MobileBottomNav groups={GROUPS} activeTab="blocks" onSelectTab={onSelect} />));
    await act(async () => byLabel(/Конструктор/).click());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('кнопки не ниже 44px и скрыты на десктопе', async () => {
    await act(async () => root.render(<MobileBottomNav groups={GROUPS} activeTab="overview" onSelectTab={() => {}} />));
    expect(container.querySelector('nav')!.className).toContain('lg:hidden');
    buttons().forEach((b) => expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44));
  });
});

describe('MobileSubTabs', () => {
  it('показывает подразделы только текущей группы', async () => {
    await act(async () => root.render(<MobileSubTabs groups={GROUPS} activeTab="studio" onSelectTab={() => {}} />));
    expect(buttons().map((b) => b.textContent)).toEqual(['Студия', 'Блоки']);
    expect(container.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Конструктор');
    expect(buttons().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false']);
  });

  it('переключает подраздел и докручивает строку к активному', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(<MobileSubTabs groups={GROUPS} activeTab="overview" onSelectTab={onSelect} />));
    await act(async () => byLabel(/Статистика/).click());
    expect(onSelect).toHaveBeenCalledWith('analytics');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});

describe('простой режим', () => {
  it('сохраняет разделы первой необходимости, остальные прячет', () => {
    for (const id of ['overview', 'studio', 'blocks', 'background', 'profile', 'settings']) expect(SIMPLE_TABS).toContain(id);
    for (const id of ['selfhost', 'qr']) expect(SIMPLE_TABS).not.toContain(id as never);
  });
});
