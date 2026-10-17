"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/types";
import type { LearnerLiveSessionSummary } from "@/server/queries/live";

export function GlobalWebinarBanner({
  locale,
  initialSessions = [],
}: {
  locale: Locale;
  initialSessions?: LearnerLiveSessionSummary[];
}) {
  const ar = locale === "ar";
  const [sessions, setSessions] = useState<LearnerLiveSessionSummary[]>(initialSessions);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Poll for pushed live webinars every 20 seconds so students see it in real-time
  useEffect(() => {
    let mounted = true;

    async function fetchPushed() {
      try {
        const res = await fetch("/api/learning/live/pushed", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.sessions)) {
            setSessions(data.sessions);
          }
        }
      } catch {
        // Non-blocking background fetch
      }
    }

    // Run poll every 20s
    const interval = setInterval(fetchPushed, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const activePushed = sessions.filter((s) => !dismissedIds.has(s.id));
  if (activePushed.length === 0) return null;

  const current = activePushed[0];
  const title = ar ? current.titleAr : current.titleFr;

  return (
    <aside
      className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-[#DC2626] to-[#B91C1C] px-4 py-2.5 text-white shadow-md transition-all duration-300"
      role="alert"
      aria-live="assertive"
      aria-label={ar ? "تنبيه بث مباشر في الوقت الفعلي" : "Alerte de webinaire en direct"}
    >
      <div className="flex items-center gap-3 font-medium text-xs sm:text-sm">
        <span className="flex h-3 w-3 relative flex-none">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300"></span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-black/25 px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase text-amber-200">
            {ar ? "🔴 بث مباشر الآن" : "🔴 WEBINAIRE EN DIRECT"}
          </span>
          <strong className="font-semibold text-white truncate max-w-[280px] sm:max-w-md">
            {title}
          </strong>
          <span className="hidden md:inline text-white/80">
            — {ar ? "بتأطير من فريق ANEI الأكاديمي." : "Animé par l'équipe ANEI."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/learning/live/${current.id}`}
          prefetch={false}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1 text-xs font-bold text-[#DC2626] shadow-xs transition-transform hover:scale-105 hover:bg-amber-50 active:scale-95"
        >
          <span>{ar ? "الانضمام إلى القاعة الآن" : "Rejoindre la salle maintenant"}</span>
          <span aria-hidden="true" className={ar ? "rotate-180 inline-block" : "inline-block"}>
            &rarr;
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDismissedIds((prev) => new Set([...prev, current.id]))}
          className="p-1 text-white/70 hover:text-white rounded transition-colors text-xs"
          aria-label={ar ? "إخفاء التنبيه" : "Masquer l'alerte"}
          title={ar ? "إخفاء التنبيه" : "Masquer"}
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
