import { get, set, keys, delMany } from 'idb-keyval';

// In-memory cache for Object URLs to prevent creating duplicate URLs for the same blob in a single session
export const objectUrlCache = new Map<string, string>();

export async function getCachedImageUrl(id: string, sourceUrl: string): Promise<string> {
  if (!id) return sourceUrl;

  const cacheKey = `cover-${id}`;

  // 1. Check in-memory object URL cache
  if (objectUrlCache.has(cacheKey)) {
    return objectUrlCache.get(cacheKey)!;
  }

  // 2. Check IndexedDB
  try {
    const cachedBlob = await get<Blob>(cacheKey);
    if (cachedBlob) {
      const objectUrl = URL.createObjectURL(cachedBlob);
      objectUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    }
  } catch (error) {
    console.error('Failed to read from IndexedDB cache', error);
  }

  // 3. Fetch from network and cache
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const blob = await response.blob();
    
    // Fire and forget save to IDB
    set(cacheKey, blob).catch(err => console.error('Failed to save to IndexedDB', err));
    
    const objectUrl = URL.createObjectURL(blob);
    objectUrlCache.set(cacheKey, objectUrl);
    return objectUrl;
  } catch (error) {
    console.error('Failed to fetch image', error);
    // Fallback to original URL if fetch fails
    return sourceUrl;
  }
}

export async function getCacheSizeInMB(): Promise<number> {
  try {
    const allKeys = await keys();
    let totalBytes = 0;
    
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('cover-')) {
        const blob = await get<Blob>(key);
        if (blob) {
          totalBytes += blob.size;
        }
      }
    }
    
    return totalBytes / (1024 * 1024);
  } catch (error) {
    console.error('Failed to calculate cache size', error);
    return 0;
  }
}

export async function clearImageCache(): Promise<void> {
  try {
    const allKeys = await keys();
    const coverKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith('cover-'));
    
    await delMany(coverKeys);
    
    // Revoke all object URLs to prevent memory leaks
    objectUrlCache.forEach(url => URL.revokeObjectURL(url));
    objectUrlCache.clear();
  } catch (error) {
    console.error('Failed to clear cache', error);
  }
}
