import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LEGAL,
  formatLegalDate,
  formatOperator,
  isLegalConfigured,
  normalizeLegal,
  requisitesLines,
  splitParagraphs,
} from '../src/legalConfig';
import { getLegalSettings, updateLegalSettings } from '../src/legalSettings';

describe('normalizeLegal', () => {
  it('подставляет значения по умолчанию для пустого ввода', () => {
    expect(normalizeLegal({})).toEqual(DEFAULT_LEGAL);
    expect(normalizeLegal(null)).toEqual(DEFAULT_LEGAL);
  });

  it('обрезает по лимиту и убирает управляющие символы', () => {
    const n = normalizeLegal({ operatorName: 'А'.repeat(500), address: 'ул.\u0000 Ленина\n1' });
    expect(n.operatorName).toHaveLength(200);
    expect(n.address).toBe('ул. Ленина1');
  });

  it('сохраняет переводы строк в дополнительных текстах', () => {
    expect(normalizeLegal({ termsExtra: 'a\n\nb' }).termsExtra).toBe('a\n\nb');
  });

  it('отбрасывает некорректный e-mail и дату', () => {
    const n = normalizeLegal({ operatorContact: 'не-почта', abuseContact: 'x@y', lastUpdated: '2026-13-40' });
    expect(n.operatorContact).toBe(DEFAULT_LEGAL.operatorContact);
    expect(n.abuseContact).toBe('');
    expect(n.lastUpdated).toBe(DEFAULT_LEGAL.lastUpdated);
  });
});

describe('форматирование', () => {
  it('склеивает форму и имя оператора', () => {
    expect(formatOperator(normalizeLegal({ operatorForm: 'ИП', operatorName: 'Иванов И. И.' }))).toBe('ИП Иванов И. И.');
  });
  it('собирает реквизиты без пустых полей', () => {
    expect(requisitesLines(normalizeLegal({ taxId: '123', address: 'Москва' }))).toEqual(['ИНН 123', 'Москва']);
  });
  it('делит текст на абзацы', () => {
    expect(splitParagraphs('a\n\n\nb\n\n  ')).toEqual(['a', 'b']);
  });
  it('форматирует дату', () => {
    expect(formatLegalDate('2026-11-21')).toBe('21.11.2026');
  });
  it('определяет, заполнены ли данные оператора', () => {
    expect(isLegalConfigured(DEFAULT_LEGAL)).toBe(false);
    expect(isLegalConfigured(normalizeLegal({ operatorName: 'Иванов', operatorContact: 'a@b.ru' }))).toBe(true);
  });
});

describe('хранение в файле', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('без файла возвращает значения по умолчанию', () => {
    expect(getLegalSettings(dir)).toEqual(DEFAULT_LEGAL);
  });

  it('сохраняет и читает обратно', () => {
    const r = updateLegalSettings(dir, { operatorName: 'Иванов', operatorContact: 'a@b.ru', showRequisitesInFooter: true });
    expect(r.ok).toBe(true);
    const s = getLegalSettings(dir);
    expect(s.operatorName).toBe('Иванов');
    expect(s.showRequisitesInFooter).toBe(true);
  });

  it('обновляет дату редакции при смене текста, но не при смене переключателя', () => {
    updateLegalSettings(dir, { operatorName: 'Иванов', lastUpdated: '2020-01-01' });
    updateLegalSettings(dir, { showRequisitesInFooter: true });
    expect(getLegalSettings(dir).lastUpdated).toBe('2020-01-01');
    updateLegalSettings(dir, { address: 'Москва' });
    expect(getLegalSettings(dir).lastUpdated).not.toBe('2020-01-01');
  });

  it('отклоняет некорректный e-mail и дату, не меняя файл', () => {
    expect(updateLegalSettings(dir, { operatorContact: 'oops' })).toMatchObject({ ok: false });
    expect(updateLegalSettings(dir, { lastUpdated: 'вчера' })).toMatchObject({ ok: false });
    expect(fs.existsSync(path.join(dir, 'legal_settings.json'))).toBe(false);
  });

  it('повреждённый файл не ломает чтение', () => {
    fs.writeFileSync(path.join(dir, 'legal_settings.json'), '{not json');
    expect(getLegalSettings(dir)).toEqual(DEFAULT_LEGAL);
  });
});
