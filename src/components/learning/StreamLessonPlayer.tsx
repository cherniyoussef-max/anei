"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  FastForward,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { Locale } from "@/types";

type PlaybackState =
  | { status: "loading" }
  | {
      status: "ready";
      iframeUrl: string;
      hlsUrl?: string;
      durationSeconds?: number;
      token?: string;
    }
  | { status: "unauthorized" }
  | { status: "unavailable" };

interface StreamLessonPlayerProps {
  lessonId: string;
  title: string;
  locale: Locale;
  initialSeconds?: number;
  initiallyCompleted?: boolean;
  nextLessonHref?: string;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75] as const;

export function StreamLessonPlayer({
  lessonId,
  title,
  locale,
  initialSeconds = 0,
  initiallyCompleted = false,
  nextLessonHref,
}: StreamLessonPlayerProps) {
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PlaybackState>({ status: "loading" });
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const [playbackRateIndex, setPlaybackRateIndex] = useState(0);
  const [watchedSeconds, setWatchedSeconds] = useState(initialSeconds);
  const [duration, setDuration] = useState(0);

  const currentRate = PLAYBACK_RATES[playbackRateIndex];

  // Request short-lived signed playback from server
  useEffect(() => {
    let cancelled = false;

    async function loadPlayback() {
      try {
        // Preferred endpoint
        let response = await fetch(`/api/learning/video/${lessonId}/playback`);
        if (!response.ok && response.status === 404) {
          // Fallback legacy endpoint
          response = await fetch(`/api/lessons/${lessonId}/playback`, { method: "POST" });
        }

        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          return setState({ status: "unauthorized" });
        }
        if (!response.ok) {
          return setState({ status: "unavailable" });
        }

        const data = (await response.json()) as {
          iframeUrl?: string;
          hlsUrl?: string;
          durationSeconds?: number;
          token?: string;
        };

        if (!data.iframeUrl) {
          return setState({ status: "unavailable" });
        }

        let finalUrl = data.iframeUrl;
        if (initialSeconds > 0) {
          const sep = finalUrl.includes("?") ? "&" : "?";
          finalUrl = `${finalUrl}${sep}startTime=${Math.floor(initialSeconds)}s`;
        }

        if (data.durationSeconds) setDuration(data.durationSeconds);
        setState({
          status: "ready",
          iframeUrl: finalUrl,
          hlsUrl: data.hlsUrl,
          durationSeconds: data.durationSeconds,
          token: data.token,
        });
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    }

    void loadPlayback();
    return () => {
      cancelled = true;
    };
  }, [lessonId, attempt, initialSeconds]);

  // Save progress & complete at 90%
  const saveProgress = useCallback(
    async (secondsToSave?: number, markCompleted?: boolean) => {
      const sec = typeof secondsToSave === "number" ? secondsToSave : watchedSeconds;
      setSaving(true);
      try {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            watchedSeconds: Math.max(0, Math.floor(sec)),
            completed: Boolean(markCompleted || completed),
          }),
        });
        if (response.ok) {
          const result = (await response.json().catch(() => null)) as {
            lessonCompleted?: boolean;
          } | null;
          if (result?.lessonCompleted || markCompleted) {
            setCompleted(true);
            router.refresh();
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [completed, lessonId, router, watchedSeconds],
  );

  // Listen for Cloudflare Stream Player postMessage events
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Cloudflare Stream messages
      const data = event.data as {
        event?: string;
        currentTime?: number;
        duration?: number;
        percent?: number;
      } | null;

      if (!data || typeof data !== "object") return;

      if (data.currentTime && typeof data.currentTime === "number") {
        setWatchedSeconds(data.currentTime);
      }
      if (data.duration && typeof data.duration === "number") {
        setDuration(data.duration);
      }

      // Auto-completion at 90% of video
      const pct = data.percent ?? (data.duration ? (data.currentTime || 0) / data.duration : 0);
      if (pct >= 0.9 && !completed) {
        setCompleted(true);
        void saveProgress(data.currentTime, true);
      } else if (data.event === "ended" && !completed) {
        setCompleted(true);
        void saveProgress(data.duration || data.currentTime, true);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [completed, saveProgress]);

  // Adjust playback rate via postMessage
  function cyclePlaybackRate() {
    const nextIndex = (playbackRateIndex + 1) % PLAYBACK_RATES.length;
    const nextRate = PLAYBACK_RATES[nextIndex];
    setPlaybackRateIndex(nextIndex);

    // Send command to Cloudflare Stream iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ method: "playbackRate", value: nextRate }),
        "*",
      );
    }
  }

  // Fast-Forward & Complete button
  async function markCompletedAndContinue() {
    setCompleted(true);
    await saveProgress(duration || 300, true);
    router.refresh();
  }

  if (state.status === "loading") {
    return (
      <div className="relative aspect-video w-full flex flex-col items-center justify-center rounded-2xl bg-slate-900 text-white p-6 shadow-md">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-500 border-t-transparent mb-3" />
        <p className="text-xs font-semibold text-slate-300">
          {ar ? "جارٍ إعداد بث الفيديو عالي الدقة..." : en ? "Loading HD secure stream..." : "Chargement du flux vidéo sécurisé..."}
        </p>
      </div>
    );
  }

  if (state.status === "unauthorized") {
    return (
      <div className="relative aspect-video w-full flex flex-col items-center justify-center rounded-2xl bg-slate-900 text-white p-6 text-center shadow-md">
        <p className="text-sm font-semibold text-red-400 mb-2">
          {ar
            ? "غير مصرح لك بمشاهدة هذا الدرس. يرجى التأكد من التسجيل في الدورة."
            : en
            ? "You are not authorized to view this lesson. Please enroll first."
            : "Vous n'êtes pas autorisé à visionner cette leçon. Veuillez vous inscrire au parcours."}
        </p>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="relative aspect-video w-full flex flex-col items-center justify-center rounded-2xl bg-slate-900 text-white p-6 text-center shadow-md space-y-3">
        <p className="text-sm font-medium text-slate-300">
          {ar
            ? "تعذر تحميل الفيديو حاليًا. تحقق من اتصالك بالإنترنت."
            : en
            ? "The video is temporarily unavailable. Check your connection."
            : "La vidéo est temporairement indisponible. Vérifiez votre connexion."}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((v) => v + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>{ar ? "إعادة المحاولة" : en ? "Retry" : "Réessayer"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3" dir={ar ? "rtl" : "ltr"}>
      {/* Stream Video Player Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-xl">
        <iframe
          ref={iframeRef}
          className="h-full w-full border-0"
          src={state.iframeUrl}
          title={title}
          loading="eager"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />

        {/* Floating Top Controls Overlay */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {completed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                <CheckCircle2 size={13} />
                <span>{ar ? "تم إكمال الدرس" : "Leçon validée"}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-950/70 px-2.5 py-0.5 text-[11px] font-medium text-blue-200 backdrop-blur-md">
              <Sparkles size={11} className="text-blue-400" />
              <span>Cloudflare Stream HD</span>
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Playback speed toggle */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="rounded-full border border-white/25 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/80 transition cursor-pointer"
              title={ar ? "سرعة التشغيل" : "Vitesse de lecture"}
            >
              {currentRate}x
            </button>

            {/* Quick pass / validate button */}
            {!completed && (
              <button
                type="button"
                onClick={markCompletedAndContinue}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md hover:bg-blue-600 transition cursor-pointer"
                title={ar ? "تأكيد إكمال الدرس والانتقال للتالي" : "Valider la leçon"}
              >
                <FastForward size={13} className="text-amber-400" />
                <span>{ar ? "إكمال الدرس" : "Valider"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meta Bar below player */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {completed
              ? ar
                ? "تم إكمال هذا الدرس بنجاح"
                : "Leçon complétée"
              : ar
              ? "يتم تتبع تقدمك وحفظ المشاهدة تلقائياً عبر السحابة"
              : "Progression enregistrée automatiquement en temps réel"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!completed ? (
            <button
              type="button"
              onClick={markCompletedAndContinue}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <FastForward size={14} className="text-amber-300" />
              <span>{ar ? "تأكيد إكمال الدرس" : "Marquer comme terminé"}</span>
            </button>
          ) : nextLessonHref ? (
            <Link
              href={nextLessonHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-xs hover:bg-amber-400 transition"
            >
              <span>{ar ? "الدرس التالي" : "Leçon suivante"}</span>
              <ArrowRight size={14} className="rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
