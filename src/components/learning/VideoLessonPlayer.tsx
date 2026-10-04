"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  ArrowRight,
  Award,
  X,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  FastForward,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import type { Locale } from "@/types";
import type { LearnerCheckpoint } from "@/server/services/video-checkpoints";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75] as const;

type Props = {
  lessonId: string;
  videoUrl: string;
  title: string;
  initialSeconds: number;
  initiallyCompleted: boolean;
  locale: Locale;
  checkpoints?: LearnerCheckpoint[];
  nextLessonHref?: string;
  previousLessonHref?: string;
  assessmentHref?: string;
  hideMetaBar?: boolean;
};

export function VideoLessonPlayer({
  lessonId,
  videoUrl,
  title,
  initialSeconds,
  initiallyCompleted,
  locale,
  checkpoints = [],
  nextLessonHref,
  previousLessonHref,
  assessmentHref,
  hideMetaBar = false,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";

  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRateIndex, setPlaybackRateIndex] = useState(0);
  const [checkpointState, setCheckpointState] = useState(checkpoints);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [responding, setResponding] = useState(false);
  const [postVideo, setPostVideo] = useState<{
    started: boolean;
    queue: LearnerCheckpoint[];
    index: number;
    score: number;
    total: number;
    done: boolean;
  }>({ started: false, queue: [], index: 0, score: 0, total: 0, done: false });
  const [courseComplete, setCourseComplete] = useState<{ certificateCode: string | null } | null>(null);

  const currentRate = PLAYBACK_RATES[playbackRateIndex];

  // Save progress to server
  const saveProgress = useCallback(
    async (secondsToSave?: number, markCompleted?: boolean) => {
      if (!video.current && typeof secondsToSave === "undefined") return;
      setSaving(true);
      const watchedSeconds = Math.max(
        0,
        Math.floor(typeof secondsToSave !== "undefined" ? secondsToSave : (video.current?.currentTime ?? 0))
      );
      try {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            watchedSeconds,
            completed: Boolean(markCompleted || completed),
          }),
        });
        if (response.ok) {
          const result = (await response.json()) as {
            lessonCompleted?: boolean;
            courseCompleted?: boolean;
            certificateCode?: string | null;
          };
          if (result.lessonCompleted || markCompleted) {
            setCompleted(true);
          }
          if (result.courseCompleted) {
            setCourseComplete({ certificateCode: result.certificateCode ?? null });
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [completed, lessonId]
  );

  const togglePlay = useCallback(() => {
    if (!video.current) return;
    if (video.current.paused) {
      void video.current.play();
    } else {
      video.current.pause();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!container.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.current.requestFullscreen();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!video.current) return;
    video.current.muted = !video.current.muted;
    setIsMuted(video.current.muted);
  }, []);

  function cyclePlaybackRate() {
    if (!video.current) return;
    const nextIndex = (playbackRateIndex + 1) % PLAYBACK_RATES.length;
    setPlaybackRateIndex(nextIndex);
    video.current.playbackRate = PLAYBACK_RATES[nextIndex];
  }

  const skipTime = useCallback(
    (deltaSeconds: number) => {
      if (!video.current) return;
      const target = Math.max(0, Math.min(duration || Infinity, video.current.currentTime + deltaSeconds));
      video.current.currentTime = target;
      setCurrentTime(target);
    },
    [duration]
  );

  // Free seeking without restriction
  function onSeekBarClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!video.current || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const target = fraction * duration;
    video.current.currentTime = target;
    setCurrentTime(target);
  }

  function onTimeUpdate() {
    if (!video.current) return;
    setCurrentTime(video.current.currentTime);
  }

  // Fast-forward & complete video action ("Passer la vidéo")
  async function passVideoAndComplete() {
    if (video.current) {
      video.current.pause();
      if (duration > 0) {
        video.current.currentTime = duration;
        setCurrentTime(duration);
      }
    }
    setCompleted(true);
    await saveProgress(duration || 100, true);

    // If there are checkpoint questions for this lesson, open the quiz right after the video
    if (checkpointState.length > 0) {
      setPostVideo({
        started: true,
        queue: checkpointState,
        index: 0,
        score: 0,
        total: checkpointState.filter((cp) => cp.kind === "QUIZ").length,
        done: false,
      });
    } else {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  }

  // When video reaches end naturally: trigger post-video quiz if any, and save completion
  async function onEnded() {
    setIsPlaying(false);
    await saveProgress(duration || video.current?.currentTime || 0, true);
    setCompleted(true);

    if (checkpointState.length > 0) {
      setPostVideo({
        started: true,
        queue: checkpointState,
        index: 0,
        score: 0,
        total: checkpointState.filter((cp) => cp.kind === "QUIZ").length,
        done: false,
      });
    } else {
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
    }
  }

  // Post-video quiz response
  async function respondToPostVideo(payload: { selectedOptionId?: string; responseText?: string }) {
    const current = postVideo.queue[postVideo.index];
    if (!current || responding) return;
    setResponding(true);
    const response = await fetch(`/api/lessons/${lessonId}/checkpoints/${current.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = response.ok
      ? ((await response.json().catch(() => null)) as { correct?: boolean | null } | null)
      : null;
    setResponding(false);

    const delta = current.kind === "QUIZ" && body?.correct ? 1 : 0;
    const nextIndex = postVideo.index + 1;

    setCheckpointState((prev) =>
      prev.map((cp) => (cp.id === current.id ? { ...cp, answered: true, correct: body?.correct ?? null } : cp))
    );

    if (nextIndex >= postVideo.queue.length) {
      setPostVideo((state) => ({ ...state, score: state.score + delta, done: true }));
      await saveProgress(duration, true);
      confetti({ particleCount: 160, spread: 85, origin: { y: 0.55 } });
    } else {
      setPostVideo((state) => ({ ...state, index: nextIndex, score: state.score + delta }));
    }
    setQuizSelected(null);
    setReflectionText("");
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Keyboard controls
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === "n" && nextLessonHref) {
          event.preventDefault();
          router.push(nextLessonHref);
        }
        if (key === "p" && previousLessonHref) {
          event.preventDefault();
          router.push(previousLessonHref);
        }
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        skipTime(-10);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        skipTime(10);
      } else if (event.code === "KeyM") {
        event.preventDefault();
        toggleMute();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextLessonHref, previousLessonHref, router, togglePlay, skipTime, toggleMute, toggleFullscreen]);

  function onContainerMouseMove() {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => {
      if (isPlaying) setHudVisible(false);
    }, 3000);
  }

  const hudHidden = isFullscreen && !hudVisible && isPlaying;
  const effectiveNextHref = nextLessonHref || assessmentHref;

  return (
    <div className="lesson-player">
      <div
        ref={container}
        onMouseMove={onContainerMouseMove}
        onMouseLeave={() => {
          if (isPlaying) setHudVisible(false);
        }}
        className="relative overflow-hidden rounded-2xl bg-black shadow-lg"
      >
        <video
          ref={video}
          className="aspect-video w-full cursor-pointer"
          preload="metadata"
          poster="/demo/video-poster.svg"
          onClick={togglePlay}
          onLoadedMetadata={() => {
            if (!video.current) return;
            setDuration(video.current.duration);
            if (initialSeconds > 0) {
              video.current.currentTime = Math.min(initialSeconds, Math.max(0, video.current.duration - 1));
            }
          }}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            void saveProgress();
          }}
          onEnded={() => void onEnded()}
        >
          <source src={videoUrl} type="video/mp4" />
          {ar
            ? "المتصفح لا يدعم تشغيل الفيديو."
            : en
            ? "Your browser does not support video playback."
            : "Votre navigateur ne prend pas en charge la vidéo."}
        </video>

        {/* Big play button when paused */}
        {!isPlaying && !postVideo.started ? (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#082D55]/85 text-[#F6F1E7] shadow-xl backdrop-blur-xs transition hover:scale-105 hover:bg-[#082D55]"
            aria-label={ar ? "تشغيل الفيديو" : "Lire la vidéo"}
          >
            <Play size={28} className="translate-x-0.5 rtl:-translate-x-0.5" fill="currentColor" />
          </button>
        ) : null}

        {/* Top Control Bar (Quick Pass / Skip Button) */}
        {!postVideo.started ? (
          <div
            className={`absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none transition-opacity duration-200 ${
              hudHidden ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="pointer-events-auto">
              {completed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                  <CheckCircle2 size={13} />
                  <span>{ar ? "تم إكمال الدرس" : "Leçon terminée"}</span>
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={passVideoAndComplete}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-md transition hover:bg-[#082D55] hover:border-[#C9913F]"
              title={
                ar
                  ? "تجاوز الفيديو وتأكيد إكمال الدرس والانتقال للاختبار"
                  : "Passer la vidéo et valider la leçon pour débloquer la suite"
              }
            >
              <FastForward size={14} className="text-[#C9913F]" />
              <span>
                {checkpointState.length > 0
                  ? ar
                    ? "تجاوز الفيديو إلى الاختبار"
                    : "Passer au quiz"
                  : ar
                  ? "تجاوز الفيديو وإكمال الدرس"
                  : "Passer la vidéo"}
              </span>
            </button>
          </div>
        ) : null}

        {/* Post-Video Quiz Panel (Quizzes appear after the video completes) */}
        {postVideo.started ? (
          <PostVideoQuizPanel
            locale={locale}
            queue={postVideo.queue}
            index={postVideo.index}
            score={postVideo.score}
            total={postVideo.total}
            done={postVideo.done}
            responding={responding}
            quizSelected={quizSelected}
            onQuizSelect={setQuizSelected}
            reflectionText={reflectionText}
            onReflectionChange={setReflectionText}
            onSubmit={(current) =>
              respondToPostVideo(
                current.kind === "QUIZ"
                  ? { selectedOptionId: quizSelected ?? undefined }
                  : { responseText: reflectionText }
              )
            }
            onReplayVideo={() => {
              setPostVideo((prev) => ({ ...prev, started: false }));
              if (video.current) {
                video.current.currentTime = 0;
                void video.current.play();
              }
            }}
            nextHref={effectiveNextHref}
            hasNextLesson={Boolean(nextLessonHref)}
          />
        ) : null}

        {/* HUD Video Controls Bar */}
        {!postVideo.started ? (
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-8 transition-opacity duration-200 ${
              hudHidden ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            {/* Seek Bar (Unrestricted) */}
            <div
              className="group relative flex h-4 w-full cursor-pointer items-center"
              onClick={onSeekBarClick}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              aria-label={ar ? "شريط التقدم" : "Barre de progression"}
            >
              <div className="relative h-1.5 w-full rounded-full bg-white/30 transition-all group-hover:h-2">
                <div
                  className="h-full rounded-full bg-[#C9913F] transition-all"
                  style={{ width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%" }}
                />
                {/* Timeline Question Markers */}
                {duration
                  ? checkpointState.map((cp) => (
                      <span
                        key={cp.id}
                        className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-xs transition ${
                          cp.answered ? "bg-[#082D55]" : "bg-[#C9913F]"
                        }`}
                        style={{
                          left: `${Math.min(100, (Math.min(cp.triggerSeconds, duration) / duration) * 100)}%`,
                        }}
                        title={ar ? cp.promptAr : cp.promptFr}
                      />
                    ))
                  : null}
              </div>
            </div>

            {/* Bottom Row Controls */}
            <div className="flex items-center justify-between gap-2 text-white">
              {/* Left group */}
              <div className="flex items-center gap-2">
                {/* Play / Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                  aria-label={isPlaying ? (ar ? "إيقاف مؤقت" : "Pause") : ar ? "تشغيل" : "Lecture"}
                >
                  {isPlaying ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
                </button>

                {/* Skip -10s */}
                <button
                  type="button"
                  onClick={() => skipTime(-10)}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
                  title={ar ? "رجوع 10 ثوانٍ" : "Reculer de 10s"}
                  aria-label={ar ? "رجوع 10 ثوانٍ" : "Reculer de 10 secondes"}
                >
                  <RotateCcw size={15} />
                </button>

                {/* Skip +10s */}
                <button
                  type="button"
                  onClick={() => skipTime(10)}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
                  title={ar ? "تقديم 10 ثوانٍ" : "Avancer de 10s"}
                  aria-label={ar ? "تقديم 10 ثوانٍ" : "Avancer de 10 secondes"}
                >
                  <RotateCw size={15} />
                </button>

                {/* Mute toggle */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
                  title={isMuted ? (ar ? "تشغيل الصوت" : "Activer le son") : ar ? "كتم الصوت" : "Couper le son"}
                  aria-label={isMuted ? (ar ? "تشغيل الصوت" : "Activer le son") : ar ? "كتم الصوت" : "Couper le son"}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                {/* Time Display */}
                <span className="text-xs font-mono text-white/90" dir="ltr">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right group */}
              <div className="flex items-center gap-2">
                {/* Playback speed */}
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  className="rounded-md border border-white/20 px-2 py-0.5 text-xs font-semibold text-white/90 transition hover:bg-white/15"
                  title={ar ? "سرعة التشغيل" : "Vitesse de lecture"}
                >
                  {currentRate}x
                </button>

                {/* Quick Pass button inside HUD */}
                <button
                  type="button"
                  onClick={passVideoAndComplete}
                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#082D55]"
                >
                  <FastForward size={12} className="text-[#C9913F]" />
                  <span>{ar ? "تجاوز" : "Passer"}</span>
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label={
                    isFullscreen ? (ar ? "الخروج من ملء الشاشة" : "Quitter le plein écran") : ar ? "ملء الشاشة" : "Plein écran"
                  }
                >
                  {isFullscreen ? <Minimize size={16} strokeWidth={2} /> : <Maximize size={16} strokeWidth={2} />}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Completion Modal */}
      {courseComplete ? (
        <CourseCompletionModal
          locale={locale}
          certificateCode={courseComplete.certificateCode}
          onClose={() => setCourseComplete(null)}
        />
      ) : null}

      {/* Meta Bar below player */}
      {!hideMetaBar ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E0D3] bg-[#FCFBF8] p-4">
          <div>
            <h2 className="font-semibold text-[#082D55] text-base">{title}</h2>
            <p className="text-xs text-[#7A7261] mt-0.5">
              {saving
                ? ar
                  ? "جارٍ حفظ التقدم..."
                  : en
                  ? "Saving progress..."
                  : "Enregistrement du parcours..."
                : completed
                ? ar
                  ? "تم إكمال الدرس بنجاح ✓"
                  : "Leçon validée ✓"
                : ar
                ? "يُحفظ التقدم تلقائيًا عند المشاهدة"
                : "La progression est enregistrée automatiquement"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!completed ? (
              <button
                type="button"
                onClick={passVideoAndComplete}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-[#082D55] bg-[#082D55] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#061F3D]"
              >
                <FastForward size={14} className="text-[#C9913F]" />
                <span>
                  {checkpointState.length > 0
                    ? ar
                      ? "تجاوز الفيديو إلى الاختبار"
                      : "Passer au quiz"
                    : ar
                    ? "تجاوز الفيديو وإكمال الدرس"
                    : "Marquer comme terminé"}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>{ar ? "مكتمل" : "Terminé"}</span>
                </span>

                {checkpointState.length > 0 && !postVideo.started ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPostVideo({
                        started: true,
                        queue: checkpointState,
                        index: 0,
                        score: 0,
                        total: checkpointState.filter((cp) => cp.kind === "QUIZ").length,
                        done: false,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E0D3] bg-white px-3 py-1.5 text-xs font-semibold text-[#082D55] shadow-xs hover:border-[#C9913F]"
                  >
                    <BookOpen size={14} className="text-[#C9913F]" />
                    <span>{ar ? "إعادة الاختبار" : "Revoir le quiz"}</span>
                  </button>
                ) : null}

                {effectiveNextHref ? (
                  <Link
                    href={effectiveNextHref}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9913F] bg-[#C9913F] px-4 py-1.5 text-xs font-semibold text-[#082D55] shadow-xs hover:bg-[#e2bd7d]"
                  >
                    <span>
                      {nextLessonHref
                        ? ar
                          ? "الدرس التالي"
                          : "Leçon suivante"
                        : ar
                        ? "بدء التقييم النهائي"
                        : "Passer à l'évaluation"}
                    </span>
                    <ArrowRight size={14} className="rtl:rotate-180" />
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Course completion modal
function CourseCompletionModal({
  locale,
  certificateCode,
  onClose,
}: {
  locale: Locale;
  certificateCode: string | null;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050b18]/90 p-4 text-center backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={ar ? "إغلاق" : en ? "Close" : "Fermer"}
        className={`absolute top-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 ${
          ar ? "left-6" : "right-6"
        }`}
      >
        <X size={18} strokeWidth={1.75} />
      </button>
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F6F1E7]">
          <Award size={30} strokeWidth={1.75} className="text-[#a9752f]" />
        </span>
        <p className="mt-6 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-white">
          {ar
            ? "تهانينا! لقد أتممت الدورة بنجاح"
            : en
            ? "Congratulations! Course completed"
            : "Félicitations, formation terminée !"}
        </p>
        <p className="mt-3 text-sm text-white/70">
          {ar
            ? "لقد أكملت جميع دروس هذه الدورة. شهادتك متاحة الآن."
            : en
            ? "You have completed every lesson in this course. Your certificate is now available."
            : "Vous avez terminé toutes les leçons de cette formation. Votre certificat officiel est désormais disponible."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={
              certificateCode
                ? `/${locale}/certificats/${certificateCode}`
                : `/${locale}/dashboard/certificats`
            }
            className="inline-flex items-center gap-2 rounded-full border border-white bg-white px-5 py-2.5 text-sm font-semibold text-[#082D55]"
          >
            <Award size={16} strokeWidth={1.75} />
            {ar ? "عرض شهادتي" : en ? "View my certificate" : "Voir mon certificat"}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            {ar ? "متابعة التصفح" : en ? "Keep browsing" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Post-Video Quiz Panel (Appears after the video completes)
function PostVideoQuizPanel({
  locale,
  queue,
  index,
  score,
  total,
  done,
  responding,
  quizSelected,
  onQuizSelect,
  reflectionText,
  onReflectionChange,
  onSubmit,
  onReplayVideo,
  nextHref,
  hasNextLesson,
}: {
  locale: Locale;
  queue: LearnerCheckpoint[];
  index: number;
  score: number;
  total: number;
  done: boolean;
  responding: boolean;
  quizSelected: string | null;
  onQuizSelect: (id: string) => void;
  reflectionText: string;
  onReflectionChange: (value: string) => void;
  onSubmit: (current: LearnerCheckpoint) => void;
  onReplayVideo: () => void;
  nextHref?: string;
  hasNextLesson?: boolean;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const current = queue[index];
  const percent = total > 0 ? Math.round((score / total) * 100) : 100;

  if (done) {
    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 p-6 text-center backdrop-blur-md">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#082D55]/90 p-8 text-white shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C9913F]/20 text-[#C9913F]">
            <CheckCircle2 size={32} />
          </span>
          <h3 className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl font-bold">
            {ar ? "أحسنت! أكملت الدرس والاختبار" : en ? "Well done! Lesson & Quiz complete" : "Bravo, leçon et quiz validés !"}
          </h3>
          {total > 0 ? (
            <p className="mt-2 text-base font-semibold text-[#e2bd7d]" dir="ltr">
              {ar ? `النتيجة: ${score}/${total} (${percent}%)` : `Score : ${score}/${total} (${percent}%)`}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-white/70">
            {ar
              ? "تم تسجيل إنجازك بنجاح. يمكنك الآن الانتقال للخطوة التالية أو إعادة مشاهدة الفيديو."
              : "Vos acquis sont validés. Vous pouvez passer à l'étape suivante ou revoir la vidéo."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {nextHref ? (
              <a
                href={nextHref}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C9913F] bg-[#C9913F] px-5 py-2.5 text-sm font-semibold text-[#082D55] shadow-lg transition hover:bg-[#e2bd7d]"
              >
                <span>
                  {hasNextLesson
                    ? ar
                      ? "الدرس التالي"
                      : "Leçon suivante"
                    : ar
                    ? "بدء التقييم النهائي"
                    : "Passer à l'évaluation"}
                </span>
                <ArrowRight size={16} className="rtl:rotate-180" />
              </a>
            ) : null}

            <button
              type="button"
              onClick={onReplayVideo}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <RotateCcw size={15} />
              <span>{ar ? "إعادة مشاهدة الفيديو" : "Revoir la vidéo"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-[#E7E0D3] bg-[#FCFBF8] p-6 text-start shadow-2xl my-auto">
        <div className="flex items-center justify-between border-b border-[#E7E0D3] pb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F1E7] px-3 py-1 text-xs font-semibold text-[#a9752f]">
            {ar
              ? `اختبار تثبيت المعارف — سؤال ${index + 1}/${queue.length}`
              : en
              ? `Comprehension check — Question ${index + 1}/${queue.length}`
              : `Quiz de compréhension — Question ${index + 1}/${queue.length}`}
          </span>
          <button
            type="button"
            onClick={onReplayVideo}
            className="text-xs text-[#7A7261] hover:text-[#082D55] underline"
          >
            {ar ? "العودة للفيديو" : "Retour à la vidéo"}
          </button>
        </div>

        <p className="mt-4 text-base font-semibold text-[#082D55] leading-snug">
          {ar ? current.promptAr : current.promptFr}
        </p>

        {current.kind === "QUIZ" ? (
          <div className="mt-4 flex flex-col gap-2">
            {(current.options ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onQuizSelect(option.id)}
                className={`rounded-xl border px-4 py-2.5 text-start text-sm font-medium transition-all ${
                  quizSelected === option.id
                    ? "border-[#082D55] bg-[#082D55]/5 text-[#082D55] ring-2 ring-[#082D55]/20 font-semibold"
                    : "border-[#E7E0D3] bg-white text-[#3d3a33] hover:border-[#C9913F]"
                }`}
              >
                {ar ? option.textAr : option.textFr}
              </button>
            ))}
            <button
              type="button"
              disabled={!quizSelected || responding}
              onClick={() => onSubmit(current)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {responding
                ? ar
                  ? "جارٍ الإرسال..."
                  : "Validation..."
                : index + 1 >= queue.length
                ? ar
                  ? "إنهاء الاختبار"
                  : "Terminer le quiz"
                : ar
                ? "السؤال التالي"
                : "Question suivante"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              value={reflectionText}
              onChange={(event) => onReflectionChange(event.target.value)}
              rows={4}
              placeholder={
                ar
                  ? "اكتب إجابتك أو ملاحظاتك البيداغوجية هنا..."
                  : "Notez vos réflexions ou réponses ici..."
              }
              className="w-full rounded-xl border border-[#E7E0D3] bg-white p-3 text-sm text-[#082D55] focus:border-[#C9913F] focus:outline-none"
            />
            <button
              type="button"
              disabled={!reflectionText.trim() || responding}
              onClick={() => onSubmit(current)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {responding
                ? ar
                  ? "جارٍ الحفظ..."
                  : "Enregistrement..."
                : index + 1 >= queue.length
                ? ar
                  ? "إنهاء"
                  : "Terminer"
                : ar
                ? "التالي"
                : "Suivant"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
