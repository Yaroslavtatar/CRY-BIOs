import React from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BioConfig } from '../types';

interface MobileBioLayoutProps {
  config: BioConfig;
  children: React.ReactNode;
  className?: string;
}

export default function MobileBioLayout({ config, children, className = '' }: MobileBioLayoutProps) {
  const isViewportMobile = useMediaQuery('(max-width: 640px)');
  const mobileOn = config.mobileOptimized !== false && isViewportMobile;
  const layoutMode = config.layoutMode || 'default';

  if (!mobileOn && layoutMode === 'default' && !isViewportMobile) {
    return <div className={className}>{children}</div>;
  }

  const compact = isViewportMobile || layoutMode === 'compact' || layoutMode === 'sleek';

  return (
    <div
      className={`${className} ${compact ? 'mobile-bio-layout max-sm:px-4 max-sm:pb-[env(safe-area-inset-bottom)]' : ''}`}
      data-layout={layoutMode}
      data-mobile={mobileOn ? 'true' : 'false'}
      style={{
        paddingBottom: mobileOn ? 'max(72px, env(safe-area-inset-bottom, 0px))' : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function useMobileBio(config: BioConfig | null): {
  isMobile: boolean;
  isViewportMobile: boolean;
  compact: boolean;
  nameSize: string;
  avatarSize: string;
  cardPadding: string;
  cardMaxWidth: string;
} {
  const isViewportMobile = useMediaQuery('(max-width: 640px)');
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
