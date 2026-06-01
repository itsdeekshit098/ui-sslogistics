import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const rafId = requestAnimationFrame(() => setIsMobile(mq.matches));
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => {
      cancelAnimationFrame(rafId);
      mq.removeEventListener("change", handler);
    };
  }, [breakpoint]);

  return isMobile;
}
