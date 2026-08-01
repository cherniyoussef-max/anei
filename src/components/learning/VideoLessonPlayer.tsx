"use client";
import { useRef, useState } from "react";
import type { Locale } from "@/types";

export function VideoLessonPlayer({ lessonId, videoUrl, title, initialSeconds, initiallyCompleted, locale }: { lessonId:string; videoUrl:string; title:string; initialSeconds:number; initiallyCompleted:boolean; locale:Locale }) {
  const video = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const ar = locale === "ar";

  async function save() {
    if (!video.current) return;
    setSaving(true);
    const watchedSeconds = Math.max(0, Math.floor(video.current.currentTime));
    try {
      const response = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, watchedSeconds }),
      });
      if (response.ok) {
        const result = await response.json() as { lessonCompleted?: boolean };
        setCompleted(Boolean(result.lessonCompleted));
      }
    } finally {
      setSaving(false);
    }
  }

  return <div className="lesson-player">
    <video
      ref={video}
      className="course-video"
      controls
      preload="metadata"
      poster="/demo/video-poster.svg"
      onLoadedMetadata={() => {
        if (video.current && initialSeconds > 0) video.current.currentTime = Math.min(initialSeconds, Math.max(0, video.current.duration - 1));
      }}
      onPause={() => { void save(); }}
      onEnded={() => { void save(); }}
    >
      <source src={videoUrl} type="video/mp4"/>
      {ar ? "المتصفح لا يدعم تشغيل الفيديو." : "Votre navigateur ne prend pas en charge la vidéo."}
    </video>
    <div className="lesson-player-meta">
      <div>
        <strong>{title}</strong>
        <small>{saving ? (ar ? "حفظ التقدم..." : "Enregistrement...") : completed ? (ar ? "مكتمل ✓" : "Terminé ✓") : (ar ? "يُحفظ التقدم تلقائيًا" : "Progression sauvegardée automatiquement")}</small>
      </div>
    </div>
  </div>;
}
