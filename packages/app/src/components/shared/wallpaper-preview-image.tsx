import { resolveWallpaperPreviewSources } from '@navet/app/constants/built-in-wallpapers';
import { sanitizeImageUrl } from '@navet/app/utils/url-security';
import { useEffect, useState } from 'react';

export interface WallpaperPreviewImageProps {
  value: string;
  alt: string;
  className?: string;
  /** Lets a surface that styles itself around an image fall back when no image will arrive. */
  onFailedChange?: (failed: boolean) => void;
}

export function WallpaperPreviewImage({
  value,
  alt,
  className,
  onFailedChange,
}: WallpaperPreviewImageProps) {
  const [hasFailed, setHasFailed] = useState(false);
  const preview = resolveWallpaperPreviewSources(value);
  const safeCustomSource =
    preview?.kind === 'custom'
      ? sanitizeImageUrl(
          preview.imgSrc,
          typeof window === 'undefined' ? undefined : window.location.href
        )
      : null;
  const hasNothingToRender =
    !preview || hasFailed || (preview.kind === 'custom' && !safeCustomSource);

  useEffect(() => {
    setHasFailed(false);
  }, [value]);

  useEffect(() => {
    onFailedChange?.(hasNothingToRender);
  }, [hasNothingToRender, onFailedChange]);

  if (!preview || hasFailed) {
    return null;
  }

  if (preview.kind === 'custom') {
    if (!safeCustomSource) {
      return null;
    }

    return (
      <img
        src={safeCustomSource}
        alt={alt}
        width={1600}
        height={900}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasFailed(true)}
      />
    );
  }

  return (
    <picture>
      <source srcSet={preview.avifSrc} type="image/avif" />
      <source srcSet={preview.webpSrc} type="image/webp" />
      <img
        src={preview.imgSrc}
        alt={alt}
        width={1600}
        height={900}
        className={className}
        loading="lazy"
        onError={() => setHasFailed(true)}
      />
    </picture>
  );
}
