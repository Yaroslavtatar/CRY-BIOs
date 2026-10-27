import React from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BioConfig } from '../types';

interface MobileBioLayoutProps {
  config: BioConfig;
  children: React.ReactNode;
  className?: string;
  /** В предпросмотре дашборда ширина окна браузера не равна ширине «телефона» — режим задаётся явно */
  forceMobile?: boolean;
}

/** Ширина «мобильного» экрана; forceMobile (предпросмотр) имеет приоритет над media query */
export function useIsViewportMobile(forceMobile?: boolean): boolean {
  const mq = useMediaQuery('(max-width: 640px)');
  return forceMobile ?? mq;
}

/**
 * Обёртка без собственных отступов: раньше px-4 и padding-bottom стояли СНАРУЖИ фона страницы,
 * из-за чего по бокам и снизу оставались прозрачные полосы (видна белая подложка).
 * Отступы теперь внутри самой страницы (там же, где рисуется фон).
 */
export default function MobileBioLayout({ config, children, className = '', forceMobile }: MobileBioLayoutProps) {
  const isViewportMobile = useIsViewportMobile(forceMobile);
  const mobileOn = config.mobileOptimized !== false && isViewportMobile;
  const layoutMode = config.layoutMode || 'default';

  return (
    <div
      className={className}
      data-layout={layoutMode}
      data-mobile={mobileOn ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

export function useMobileBio(config: BioConfig | null, forceMobile?: boolean): {
  isMobile: boolean;
  isViewportMobile: boolean;
  compact: boolean;
  nameSize: string;
  avatarSize: string;
  cardPadding: string;
  cardMaxWidth: string;
} {
  const isViewportMobile = useIsViewportMobile(forceMobile);
  const mobileOn = config?.mobileOptimized !== false && isViewportMobile;
  const layoutMode = config?.layoutMode || 'default';
  const compact = isViewportMobile || layoutMode === 'compact' || layoutMode === 'sleek';

  return {
    isMobile: mobileOn,
    isViewportMobile,
    compact,
    nameSize: compact ? 'text-[28px] max-sm:break-words max-w-full' : 'text-[39.5px]',
    avatarSize: compact ? 'w-[80px] h-[80px]' : 'w-[100px] h-[100px]',
    cardPadding: compact ? 'p-4 max-sm:max-w-full' : 'p-6 max-w-lg',
    cardMaxWidth: compact ? 'max-w-full' : 'max-w-lg',
  };
}
