// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FxPickerModal from '../src/components/FxPickerModal';
import NameEffectPickerModal from '../src/components/NameEffectPickerModal';
import NameText from '../src/components/NameText';
import { GlowPanel, CardPanel } from '../src/components/GlowPanel';
import { DEFAULT_FX } from '../src/fx/engine';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as any; // в jsdom canvas нет — компоненты должны переживать это
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const render = (el: React.ReactElement) => act(async () => root.render(el));
const byLabel = (l: string) => container.querySelector(`[aria-label="${l}"]`) as HTMLElement;
const btn = (text: string, exact = true) =>
  [...container.querySelectorAll('button')].find((b) => (exact ? b.textContent?.trim() === text : b.textContent?.includes(text))) as HTMLButtonElement;
const click = (el: Element) => act(async () => (el as HTMLElement).click());
const setRange = (el: HTMLInputElement, value: string) =>
  act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('FxPickerModal', () => {
  const open = (value: any, onSave = vi.fn(), onClose = vi.fn()) =>
    render(<FxPickerModal open value={value} onClose={onClose} onSave={onSave} />);

  it('закрытое окно ничего не рисует', async () => {
    await render(<FxPickerModal open={false} value={null} onClose={() => {}} onSave={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('показывает все 12 эффектов и пункт «Без частиц»', async () => {
    await open(null);
    for (const name of ['Снег', 'Дождь', 'Листья', 'Лепестки', 'Светлячки', 'Искры огня', 'Пузыри', 'Конфетти', 'Сердечки', 'Звёзды', 'Пыль', 'Блёстки']) {
      expect(byLabel(name), name).not.toBeNull();
    }
    expect(btn('Без частиц')).toBeDefined();
  });

  it('выбор плитки и «Сохранить» отдают настройки, окно закрывается', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    await open(null, onSave, onClose);
    await click(byLabel('Листья'));
    await click(btn('Сохранить'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'leaves' });
    expect(onClose).toHaveBeenCalled();
  });

  it('«Отмена» ничего не сохраняет', async () => {
    const onSave = vi.fn();
    await open({ ...DEFAULT_FX }, onSave);
    await click(byLabel('Дождь'));
    await click(btn('Отмена'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('«Без частиц» сохраняет null (выключает)', async () => {
    const onSave = vi.fn();
    await open({ ...DEFAULT_FX }, onSave);
    await click(btn('Без частиц'));
    await click(btn('Сохранить'));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('физика: ветер, режим мыши, скорость, обратная гравитация', async () => {
    const onSave = vi.fn();
    await open({ ...DEFAULT_FX, type: 'petals' }, onSave);
    await setRange(byLabel('Ветер') as HTMLInputElement, '0.7');
    await click(btn('Ветер', true)); // режим мыши «Ветер» (не слайдер)
    await setRange(byLabel('Скорость') as HTMLInputElement, '2');
    await click(container.querySelector('[role="switch"]')!);
    await click(btn('Сохранить'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'petals', wind: 0.7, mouse: 'wind', speed: 2, reverse: true });
  });

  it('цвет: «Свой цвет» показывает пипетку и сохраняет выбранный цвет', async () => {
    const onSave = vi.fn();
    await open({ ...DEFAULT_FX, type: 'snow' }, onSave);
    expect(byLabel('Цвет частиц')).toBeNull();
    await click(btn('Свой цвет'));
    const picker = byLabel('Цвет частиц') as HTMLInputElement;
    expect(picker).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(picker, '#00ff88');
      picker.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(btn('Сохранить'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ colorMode: 'custom', color: '#00ff88' });
  });

  it('без выбранного эффекта настройки физики скрыты', async () => {
    await open(null);
    expect(byLabel('Ветер')).toBeNull();
  });
});

describe('NameEffectPickerModal', () => {
  const open = (value: any, onSave = vi.fn(), options?: any) =>
    render(<NameEffectPickerModal open value={value} options={options} previewText="CRYTEAM" onClose={() => {}} onSave={onSave} />);

  it('эффекты разбиты на 7 групп с навигацией', async () => {
    await open('none');
    for (const g of ['Базовые', 'Неон', 'Градиенты', 'Металл и свет', 'Анимации', 'По буквам', 'Искры и ауры']) {
      expect(container.querySelector(`section[data-group="${g}"]`), g).not.toBeNull();
      expect(btn(g, true), `чип ${g}`).toBeDefined();
    }
  });

  it('клик по чипу группы прокручивает к ней', async () => {
    await open('none');
    await click(btn('Неон'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('выбор эффекта и сохранение', async () => {
    const onSave = vi.fn();
    await open('none', onSave);
    await click(byLabel('Золото'));
    await click(btn('Сохранить'));
    expect(onSave).toHaveBeenCalledWith({ effect: 'gold', color: undefined, color2: undefined, speed: undefined });
  });

  it('у неона можно выбрать цвет и скорость — они попадают в результат', async () => {
    const onSave = vi.fn();
    await open('none', onSave);
    await click(byLabel('Неон (бирюзовый)'));
    const color = byLabel('Основной цвет') as HTMLInputElement;
    expect(color).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(color, '#ff0099');
      color.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await setRange(byLabel('Скорость') as HTMLInputElement, '2.5');
    await click(btn('Сохранить'));
    expect(onSave.mock.calls[0][0]).toEqual({ effect: 'neon', color: '#ff0099', color2: undefined, speed: 2.5 });
  });

  it('двухцветный эффект показывает два выбора цвета, хром — ни одного, но есть скорость', async () => {
    await open('none');
    await click(byLabel('Закат'));
    expect(byLabel('Основной цвет')).not.toBeNull();
    expect(byLabel('Второй цвет')).not.toBeNull();
    await click(byLabel('Хром'));
    expect(byLabel('Основной цвет')).toBeNull();
    expect(byLabel('Скорость')).not.toBeNull();
  });

  it('смена эффекта сбрасывает настройки предыдущего', async () => {
    const onSave = vi.fn();
    await open('none', onSave);
    await click(byLabel('Неон (красный)'));
    const color = byLabel('Основной цвет') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(color, '#123456');
      color.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byLabel('Неон (зелёный)'));
    await click(btn('Сохранить'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ effect: 'neon_green', color: undefined });
  });

  it('существующие настройки подставляются при открытии, «Сбросить» их убирает', async () => {
    await open('neon', vi.fn(), { color: '#abcdef', speed: 2 });
    expect((byLabel('Основной цвет') as HTMLInputElement).value).toBe('#abcdef');
    await click(btn('Сбросить настройки'));
    expect(btn('Сбросить настройки')).toBeUndefined();
  });

  it('плитка печатной машинки показывает буквы эффекта, а не «Э|»', async () => {
    await open('none');
    const tile = byLabel('Печатная машинка');
    expect(tile.textContent).toContain('CRY');
    expect(tile.textContent).not.toContain('Э');
  });
});

describe('NameText', () => {
  it('обычный эффект — просто текст', async () => {
    await render(<NameText effect="neon" text="Hello" />);
    expect(container.textContent).toBe('Hello');
    expect(container.querySelector('.ne-l')).toBeNull();
  });

  it('эффект по буквам: каждая буква в своём span с индексом, для скринридеров — цельный текст', async () => {
    await render(<NameText effect="wave" text="Hey" />);
    const letters = [...container.querySelectorAll('.ne-l')] as HTMLElement[];
    expect(letters.map((l) => l.textContent)).toEqual(['H', 'e', 'y']);
    expect(letters.map((l) => l.style.getPropertyValue('--i'))).toEqual(['0', '1', '2']);
    expect(container.querySelector('.sr-only')!.textContent).toBe('Hey');
    expect(container.querySelector('.ne-caret')).toBeNull();
  });

  it('печатная машинка добавляет курсор; пробелы и эмодзи не ломаются', async () => {
    await render(<NameText effect="typewriter" text="a b😀" />);
    expect(container.querySelectorAll('.ne-l')).toHaveLength(4);
    expect(container.querySelector('.ne-caret')).not.toBeNull();
  });
});

describe('GlowPanel и CardPanel', () => {
  const cfg = (o: any = {}) => ({ username: 'u', ...o }) as any;

  it('переключатель включает подсветку; настройки неактивны, пока она выключена', async () => {
    const update = vi.fn();
    await render(<GlowPanel config={cfg()} update={update} />);
    expect(container.querySelector('[aria-disabled="true"]')).not.toBeNull();
    await click(container.querySelector('[role="switch"]')!);
    expect(update).toHaveBeenCalledWith('glowEnabled', true);
  });

  it('6 стилей, выбор стиля, второй цвет только у «Два цвета»', async () => {
    const update = vi.fn();
    await render(<GlowPanel config={cfg({ glowEnabled: true })} update={update} />);
    for (const s of ['Ровное', 'Пульс', 'Дыхание', 'Мерцание', 'Радуга', 'Два цвета']) expect(btn(s, false), s).toBeDefined();
    expect(byLabel('Второй цвет подсветки')).toBeNull();
    await click(btn('Пульс', false));
    expect(update).toHaveBeenCalledWith('glowStyle', 'pulse');
  });

  it('второй цвет и скорость появляются для анимированных стилей', async () => {
    await render(<GlowPanel config={cfg({ glowEnabled: true, glowStyle: 'dual' })} update={vi.fn()} />);
    expect(byLabel('Второй цвет подсветки')).not.toBeNull();
    expect(byLabel('Скорость')).not.toBeNull();
  });

  it('размер, цвет и цели записываются в конфиг', async () => {
    const update = vi.fn();
    await render(<GlowPanel config={cfg({ glowEnabled: true })} update={update} />);
    await setRange(byLabel('Размер свечения') as HTMLInputElement, '30');
    expect(update).toHaveBeenCalledWith('glowSize', 30);
    await click(btn('Локация', false));
    expect(update).toHaveBeenCalledWith('glowTargets', expect.arrayContaining(['location', 'avatar']));
    await click(btn('Аватар', false));
    expect(update).toHaveBeenLastCalledWith('glowTargets', expect.not.arrayContaining(['avatar']));
  });

  it('карточка: по умолчанию выключена, настройки поверхности скрыты', async () => {
    await render(<CardPanel config={cfg()} update={vi.fn()} />);
    expect(byLabel('Непрозрачность')).toBeNull();
    expect(byLabel('Размытие фона')).toBeNull();
  });

  it('стекло показывает настройки поверхности; наклон — угол и подъём', async () => {
    const update = vi.fn();
    await render(<CardPanel config={cfg({ cardStyle: 'glass', cardTilt: true })} update={update} />);
    expect(byLabel('Непрозрачность')).not.toBeNull();
    expect(byLabel('Угол наклона')).not.toBeNull();
    await setRange(byLabel('Размытие фона') as HTMLInputElement, '25');
    expect(update).toHaveBeenCalledWith('cardBlur', 25);
    await click(btn('Стекло', false));
    expect(update).toHaveBeenCalledWith('cardStyle', 'glass');
  });

  it('наклон и блик включаются независимо; не конфликтуют с cardOpacity блоков', async () => {
    const update = vi.fn();
    await render(<CardPanel config={cfg()} update={update} />);
    const switches = [...container.querySelectorAll('[role="switch"]')];
    await click(switches[0]); // наклон
    expect(update).toHaveBeenCalledWith('cardTilt', true);
    await render(<CardPanel config={cfg({ cardStyle: 'glass' })} update={update} />);
    await setRange(byLabel('Непрозрачность') as HTMLInputElement, '0.7');
    expect(update).toHaveBeenCalledWith('cardSurfaceOpacity', 0.7);
    expect(update).not.toHaveBeenCalledWith('cardOpacity', expect.anything());
  });
});
