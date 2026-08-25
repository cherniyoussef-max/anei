"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/types";

type PlaybackState =
  | { status: "loading" }
  | { status: "ready"; iframeUrl: string }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * Private/protected lessons. Requests a short-lived playback authorization
 * from the server on mount — the server decides eligibility (Phase 7
 * entitlement + Phase 8 provider resolution); this component only renders
 * whatever the server returns and never computes or stores authorization
 * itself.
 */
export function StreamLessonPlayer({ lessonId, title, locale }: { lessonId: string; title: string; locale: Locale }) {
  const ar = locale === "ar";
  const en = locale === "en";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PlaybackState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lessons/${lessonId}/playback`, { method: "POST" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) return setState({ status: "unauthorized" });
        if (!response.ok) return setState({ status: "unavailable" });
        const data = await response.json() as { iframeUrl?: string };
        if (!data.iframeUrl) return setState({ status: "unavailable" });
        setState({ status: "ready", iframeUrl: data.iframeUrl });
      })
      .catch(() => { if (!cancelled) setState({ status: "unavailable" }); });
    return () => { cancelled = true; };
  }, [lessonId, attempt]);

  if (state.status === "loading") {
    return <div className="lesson-player lesson-player-loading">{ar ? "تحميل الفيديو..." : en ? "Loading video..." : "Chargement de la vidéo..."}</div>;
  }
  if (state.status === "unauthorized") {
    return <div className="lesson-player lesson-player-error">{ar ? "غير مصرح لك بمشاهدة هذا الدرس." : en ? "You are not authorized to view this lesson." : "Vous n'êtes pas autorisé à visionner cette leçon."}</div>;
  }
  if (state.status === "unavailable") {
    return <div className="lesson-player lesson-player-error">
      <p>{ar ? "تعذر تحميل الفيديو حاليًا." : en ? "The video is temporarily unavailable." : "La vidéo est temporairement indisponible."}</p>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setAttempt((value) => value + 1)}>{ar ? "إعادة المحاولة" : en ? "Try again" : "Réessayer"}</button>
    </div>;
  }

  return <div className="lesson-player">
    <iframe
      className="course-video"
      src={state.iframeUrl}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
    <div className="lesson-player-meta"><div><strong>{title}</strong></div></div>
  </div>;
}
