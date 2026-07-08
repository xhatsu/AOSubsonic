import { useRef, useEffect } from "react";

export function useHorizontalScroll<T extends HTMLElement>() {
  const elRef = useRef<T>(null);
  
  useEffect(() => {
    const el = elRef.current;
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) return;
        
        // Only prevent default if we actually have horizontal overflow
        if (el.scrollWidth > el.clientWidth) {
          e.preventDefault();
          
          el.scrollBy({
            left: e.deltaY < 0 ? -100 : 100,
            behavior: "smooth"
          });
        }
      };
      
      // Use passive: false to allow preventDefault()
      el.addEventListener("wheel", onWheel, { passive: false });
      
      return () => {
        el.removeEventListener("wheel", onWheel);
      };
    }
  }, []);
  
  return elRef;
}
