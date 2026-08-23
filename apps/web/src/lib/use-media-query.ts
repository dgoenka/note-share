"use client";

import { useEffect, useState } from "react";

/** Client media query hook — defaults to `false` until mounted (SSR-safe). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Softboard freeform drag is desktop/tablet only */
export function useIsMobileBoard(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
