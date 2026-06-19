import { useState, useEffect } from 'react';
import { CachedImage } from './CachedImage';

interface WikiImageFallbackProps {
  artistName: string;
  className?: string;
}

export const WikiImageFallback = ({ artistName, className }: WikiImageFallbackProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchWikiImage = async () => {
      try {
        const query = encodeURIComponent(`${artistName} singer`);
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=500&origin=*`);
        const data = await response.json();
        
        if (isMounted) {
          if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages) as any[];
            if (pages.length > 0 && pages[0].thumbnail?.source) {
              setImageUrl(pages[0].thumbnail.source);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch wiki image fallback for', artistName, err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchWikiImage();

    return () => { isMounted = false; };
  }, [artistName]);

  if (isLoading) {
    return <div className={`bg-zinc-800 animate-pulse flex items-center justify-center ${className}`}>
      <span className="text-4xl text-zinc-600">{artistName.charAt(0)}</span>
    </div>;
  }

  if (imageUrl) {
    return <CachedImage id={`wiki_${artistName}`} url={imageUrl} alt={artistName} className={`w-full h-full object-cover ${className || ''}`} />;
  }

  return (
    <div className={`w-full h-full flex items-center justify-center text-zinc-500 text-6xl ${className || ''}`}>
      {artistName.charAt(0)}
    </div>
  );
};
