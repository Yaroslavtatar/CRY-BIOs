// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MinimalAudioBar from '../src/components/MinimalAudioBar';
import PlayerPositioner from '../src/components/PlayerPositioner';
import MobileBioLayout from '../src/components/MobileBioLayout';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const song = { id: '1', url: 'x.mp3', title: 'Track One', artist: 'A' };
const barProps = {
  currentSong: song,
  isPlaying: true,
  isMuted: false,
  audioCurrentTime: 10,
  audioDuration: 100,
  songsCount: 3,
  onPlayPause: () => {},
  onPrev: () => {},
  onNext: () => {},
  onSeek: () => {},
  formatTime: (n: number) => `${n}s`,
};

const render = (el: React.ReactElement) => act(async () => root.render(el));
const $ = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const label = (l: string) => container.querySelector(`[aria-label="${l}"]`) as HTMLElement | null;

describe('MinimalAudioBar: вид плеера', () => {
  it('full — название, прогресс-бар и кнопки переключения', async () => {
    await render(<MinimalAudioBar {...barProps} variant="inline" />);
    expect(container.textContent).toContain('Track One');
    expect(label('Предыдущий')).not.toBeNull();
    expect(label('Следующий')).not.toBeNull();
    expect(container.textContent).toContain('100s'); // длительность
  });

  it('compact — без прогресс-бара и времени', async () => {
    await render(<MinimalAudioBar {...barProps} variant="inline" style="compact" />);
    expect(container.textContent).toContain('Track One');
    expect(container.textContent).not.toContain('100s');
  });

  it('можно скрыть название и кнопки ◀ ▶', async () => {
    await render(<MinimalAudioBar {...barProps} variant="inline" showTrackInfo={false} showSkip={false} />);
    expect(container.textContent).not.toContain('Track One');
    expect(label('Предыдущий')).toBeNull();
    expect(label('Следующий')).toBeNull();
    expect(label('Пауза')).not.toBeNull();
  });

  it('button — одна кнопка звука: клик вызывает onToggleMute, ползунка нет без showVolume', async () => {
    const toggle = vi.fn();
    await render(<MinimalAudioBar {...barProps} style="button" variant="free" onToggleMute={toggle} />);
    expect(container.textContent).not.toContain('Track One');
    expect($('input[type=range]')).toBeNull();
    await act(async () => label('Выключить звук')!.click());
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('button — с громкостью показывает ползунок и передаёт значение', async () => {
    const onVolume = vi.fn();
    await render(<MinimalAudioBar {...barProps} style="button" variant="free" showVolume volume={0.5} onVolumeChange={onVolume} onToggleMute={() => {}} />);
    const range = $('input[type=range]') as HTMLInputElement;
    expect(range).not.toBeNull();
    expect(range.value).toBe('0.5');
  });

  it('button в режиме mute показывает «Включить звук»', async () => {
    await render(<MinimalAudioBar {...barProps} style="button" variant="free" isMuted onToggleMute={() => {}} />);
    expect(label('Включить звук')).not.toBeNull();
  });

  it('прозрачность применяется к плееру', async () => {
    await render(<MinimalAudioBar {...barProps} variant="inline" opacity={0.5} />);
    expect((container.firstElementChild as HTMLElement).style.opacity).toBe('0.5');
  });
});

describe('PlayerPositioner', () => {
  const rect = (r: Partial<DOMRect>) => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {}, ...r }) as DOMRect;

  const mountWith = async (onMove?: (p: any) => void, onClick = vi.fn()) => {
    await render(
      <PlayerPositioner pos={{ x: 50, y: 50 }} onMove={onMove}>
        <button onClick={onClick} style={{ width: 200, height: 60 }}>btn</button>
      </PlayerPositioner>,
    );
    const item = $('[data-testid=player-positioner]')!;
    const layer = item.parentElement!;
    layer.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 800, height: 600 });
    item.getBoundingClientRect = () => rect({ left: 300, top: 270, width: 200, height: 60 });
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();
    item.hasPointerCapture = () => true;
    return { item, onClick, btn: item.querySelector('button')! };
  };

  const fire = (el: Element, type: string, x: number, y: number) =>
    act(async () => {
      const ev = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      (ev as any).pointerId = 1;
      (ev as any).pointerType = 'mouse';
      el.dispatchEvent(ev);
    });

  it('стоит в заданной позиции с якорем-долей свободного места', async () => {
    const { item } = await mountWith();
    expect(item.style.left).toBe('50%');
    expect(item.style.top).toBe('50%');
    expect(item.style.transform).toBe('translate(-50%, -50%)');
  });

  it('без onMove (публичная страница) не перетаскивается и не рисует рамку редактора', async () => {
    const { item } = await mountWith(undefined);
    expect(item.className).not.toContain('cursor-grab');
  });

  it('перетаскивание вызывает onMove с новой позицией (в % свободного места)', async () => {
    const onMove = vi.fn();
    const { item } = await mountWith(onMove);
    // схватили за точку (320, 290): grab = (20, 20)
    await fire(item, 'pointerdown', 320, 290);
    await fire(item, 'pointermove', 400, 350);
    // левый край = 400-20 = 380 → 380/600 = 63.3%; верх = 350-20 = 330 → 330/540 = 61.1%
    await fire(item, 'pointerup', 400, 350);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0].x).toBeCloseTo(63.3, 1);
    expect(onMove.mock.calls[0][0].y).toBeCloseTo(61.1, 1);
  });

  it('обычный клик по кнопке (без движения) работает и ничего не двигает', async () => {
    const onMove = vi.fn();
    const { item, btn, onClick } = await mountWith(onMove);
    await fire(item, 'pointerdown', 320, 290);
    await fire(item, 'pointerup', 320, 290);
    await act(async () => btn.click());
    expect(onMove).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(item.setPointerCapture).not.toHaveBeenCalled(); // захват ломал бы click по кнопкам
  });

  it('клик, завершающий перетаскивание, не нажимает кнопку', async () => {
    const onMove = vi.fn();
    const { item, btn, onClick } = await mountWith(onMove);
    await fire(item, 'pointerdown', 320, 290);
    await fire(item, 'pointermove', 500, 400);
    await fire(item, 'pointerup', 500, 400);
    await act(async () => btn.click()); // click сразу после pointerup, в том же тике
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('MobileBioLayout (регрессия: белые полосы по бокам)', () => {
  it('не добавляет отступы вокруг страницы — фон должен занимать всю ширину', async () => {
    await render(
      <MobileBioLayout config={{ mobileOptimized: true } as any} forceMobile className="min-h-screen w-full">
        <div id="page" />
      </MobileBioLayout>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toMatch(/\bmax-sm:px-|\bpx-\d|\bpb-/);
    expect(wrapper.style.padding).toBe('');
    expect(wrapper.style.paddingBottom).toBe('');
    expect(wrapper.getAttribute('data-mobile')).toBe('true');
  });

  it('forceMobile=false имеет приоритет над media query', async () => {
    await render(
      <MobileBioLayout config={{ mobileOptimized: true } as any} forceMobile={false}>
        <div />
      </MobileBioLayout>,
    );
    expect((container.firstElementChild as HTMLElement).getAttribute('data-mobile')).toBe('false');
  });
});
