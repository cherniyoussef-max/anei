"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete progress bar when route finishes changing
  useEffect(() => {
    if (!isNavigating) return;

    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    const initialTimer = setTimeout(() => {
      setProgress(100);
      finishTimer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);
    }, 10);

    return () => {
      clearTimeout(initialTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [pathname, searchParams, isNavigating]);

  // Intercept click on internal links to give instantaneous 0ms feedback
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      // Check if it is an internal route change
      try {
        const nextUrl = new URL(href, window.location.href);
        if (
          nextUrl.origin === window.location.origin &&
          nextUrl.pathname !== window.location.pathname
        ) {
          setIsNavigating(true);
          setProgress(25);
          setTimeout(() => setProgress((p) => (p === 25 ? 65 : p)), 150);
          setTimeout(() => setProgress((p) => (p === 65 ? 85 : p)), 400);
        }
      } catch {
        // Ignore invalid URLs
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => document.removeEventListener("click", handleDocumentClick, { capture: true });
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Chargement de la page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.5)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
