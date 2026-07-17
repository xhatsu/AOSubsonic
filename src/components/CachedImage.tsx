import { useState, useEffect } from 'react';
import { getCachedImageUrl, objectUrlCache } from '../utils/imageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  id: string;
  url: string;
  fallback?: React.ReactNode;
}

export const CachedImage = ({ id, url, fallback, className, alt, ...props }: CachedImageProps) => {
  const cacheKey = `cover-${id}`;
  const [src, setSrc] = useState<string | null>(objectUrlCache.get(cacheKey) || null);
  const [prevId, setPrevId] = useState(id);

  if (id !== prevId) {
    setPrevId(id);
    setSrc(objectUrlCache.get(cacheKey) || null);
  }

  useEffect(() => {
    if (objectUrlCache.has(cacheKey)) return; // Skip async load if we got it synchronously from memory
    
    let isMounted = true;

    const loadCachedImage = async () => {
      if (!url || !id) return;
      const cachedUrl = await getCachedImageUrl(id, url);
      if (isMounted) {
        setSrc(cachedUrl);
      }
    };

    loadCachedImage();

    return () => {
      isMounted = false;
    };
  }, [id, url]);

  if (!src) {
    if (fallback) return <>{fallback}</>;
    return <div className={`bg-zinc-800 animate-pulse ${className}`} />;
  }

  return <img src={src} className={className} alt={alt || 'Image'} {...props} />;
};
