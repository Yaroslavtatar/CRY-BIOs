import React from 'react';
import type { NameEffect } from '../types';
import { getNameEffectEntry } from '../utils/nameEffectCatalog';

/** Имя с эффектом. Эффекты «по буквам» оборачивают каждую букву в <span> с индексом --i для сдвига анимации. */
export default function NameText({ effect, text }: { effect?: NameEffect; text: string }) {
  const entry = getNameEffectEntry(effect);
  if (!entry?.letters) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {Array.from(text).map((ch, i) => (
          <span key={i} className="ne-l" style={{ ['--i' as string]: i } as React.CSSProperties}>
            {ch}
          </span>
        ))}
        {entry.caret && <span className="ne-caret">|</span>}
      </span>
    </>
  );
}
