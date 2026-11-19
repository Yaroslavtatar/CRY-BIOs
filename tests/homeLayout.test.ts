import { describe, it, expect } from 'vitest';
import { sanitizeHomeLayout, sanitizeUrl, getDefaultHomeLayout, createBlock } from '../src/homeLayout';

describe('sanitizeUrl', () => {
  it('разрешает http(s), mailto, относительные пути и якоря', () => {
    expect(sanitizeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(sanitizeUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeUrl('#installer')).toBe('#installer');
    expect(sanitizeUrl('mailto:a@b.co')).toBe('mailto:a@b.co');
  });
  it('отбрасывает опасные схемы и protocol-relative', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>')).toBe('');
    expect(sanitizeUrl('//evil.com')).toBe('');
    expect(sanitizeUrl(42)).toBe('');
  });
});

describe('sanitizeHomeLayout', () => {
  it('возвращает дефолт для мусора', () => {
    expect(sanitizeHomeLayout(null).blocks.length).toBe(getDefaultHomeLayout().blocks.length);
    expect(sanitizeHomeLayout({ blocks: 'x' }).blocks.length).toBeGreaterThan(0);
  });
  it('отбрасывает неизвестные типы и дубли уникальных блоков', () => {
    const l = sanitizeHomeLayout({ blocks: [{ type: 'script' }, createBlock('profiles'), createBlock('profiles'), createBlock('text')] });
    expect(l.blocks.map((b) => b.type)).toEqual(['profiles', 'text']);
  });
  it('чистит ссылки и ограничивает длину', () => {
    const cta = { ...createBlock('cta'), props: { title: 'x'.repeat(999), buttonUrl: 'javascript:alert(1)' } };
    const l = sanitizeHomeLayout({ blocks: [cta] });
    expect(l.blocks[0].props.buttonUrl).toBe('/dashboard');
    expect(l.blocks[0].props.title!.length).toBe(120);
  });
  it('делает id уникальными и сохраняет enabled=false', () => {
    const a = { ...createBlock('text'), id: 'same', enabled: false };
    const l = sanitizeHomeLayout({ blocks: [a, { ...a }] });
    expect(new Set(l.blocks.map((b) => b.id)).size).toBe(2);
    expect(l.blocks[0].enabled).toBe(false);
  });
  it('ограничивает limit профилей', () => {
    const p = { ...createBlock('profiles'), props: { limit: 99999 } };
    expect(sanitizeHomeLayout({ blocks: [p] }).blocks[0].props.limit).toBe(100);
  });
});
