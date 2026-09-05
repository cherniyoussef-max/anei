"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Play, Pause, Maximize, Minimize, ArrowRight, Award, X } from "lucide-react";
import type { Locale } from "@/types";
import type { LearnerCheckpoint } from "@/server/services/video-checkpoints";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

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
};

export function VideoLessonPlayer({ lessonId, videoUrl, title, initialSeconds, initiallyCompleted, locale, checkpoints = [], nextLessonHref, previousLessonHref }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
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
  const [checkpointState, setCheckpointState] = useState(checkpoints);
  const [activeCheckpoint, setActiveCheckpoint] = useState<LearnerCheckpoint | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [responding, setResponding] = useState(false);
  const [postVideo, setPostVideo] = useState<{ started: boolean; queue: LearnerCheckpoint[]; index: number; score: number; total: number; done: boolean }>({ started: false, queue: [], index: 0, score: 0, total: 0, done: false });
  const [courseComplete, setCourseComplete] = useState<{ certificateCode: string | null } | null>(null);

  const midRollCheckpoints = useMemo(() => checkpointState.filter((cp) => cp.triggerSeconds < (duration || Infinity)).sort((a, b) => a.triggerSeconds - b.triggerSeconds), [checkpointState, duration]);
  const earliestUnanswered = midRollCheckpoints.find((cp) => !cp.answered);

  async function save() {
    if (!video.current) return;
    setSaving(true);
    const watchedSeconds = Math.max(0, Math.floor(video.current.currentTime));
    try {
      const response = await fetch("/api/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, watchedSeconds }) });
      if (response.ok) {
        const result = await response.json() as { lessonCompleted?: boolean; courseCompleted?: boolean; certificateCode?: string | null };
        setCompleted(Boolean(result.lessonCompleted));
        if (result.courseCompleted) {
          setCourseComplete({ certificateCode: result.certificateCode ?? null });
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function togglePlay() {
    if (!video.current) return;
    if (video.current.paused) void video.current.play(); else video.current.pause();
  }

  function toggleFullscreen() {
    if (!container.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current.requestFullscreen();
  }

  function onSeekBarClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!video.current || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    let target = fraction * duration;
    if (earliestUnanswered && target > earliestUnanswered.triggerSeconds) target = earliestUnanswered.triggerSeconds;
    video.current.currentTime = target;
    setCurrentTime(target);
  }

  function onTimeUpdate() {
    if (!video.current) return;
    const t = video.current.currentTime;
    setCurrentTime(t);
    if (activeCheckpoint || postVideo.started) return;
    const due = midRollCheckpoints.find((cp) => !cp.answered && t >= cp.triggerSeconds && !firedRef.current.has(cp.id));
    if (due) {
      firedRef.current.add(due.id);
      video.current.pause();
      setActiveCheckpoint(due);
    }
  }

  async function respondToActiveCheckpoint(payload: { selectedOptionId?: string; responseText?: string }) {
    if (!activeCheckpoint || responding) return;
    setResponding(true);
    const response = await fetch(`/api/lessons/${lessonId}/checkpoints/${activeCheckpoint.id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = response.ok ? await response.json().catch(() => null) as { correct?: boolean | null } | null : null;
    setResponding(false);
    if (!response.ok) return;
    setCheckpointState((prev) => prev.map((cp) => cp.id === activeCheckpoint.id ? { ...cp, answered: true, correct: body?.correct ?? null } : cp));
    if (activeCheckpoint.kind === "QUIZ") {
      setQuizFeedback(body?.correct ? "correct" : "incorrect");
      setTimeout(() => { setActiveCheckpoint(null); setQuizFeedback(null); setQuizSelected(null); void video.current?.play(); }, 1400);
    } else {
      setActiveCheckpoint(null);
      setReflectionText("");
      void video.current?.play();
    }
  }

  async function respondToPostVideo(payload: { selectedOptionId?: string; responseText?: string }) {
    const current = postVideo.queue[postVideo.index];
    if (!current || responding) return;
    setResponding(true);
    const response = await fetch(`/api/lessons/${lessonId}/checkpoints/${current.id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = response.ok ? await response.json().catch(() => null) as { correct?: boolean | null } | null : null;
    setResponding(false);
    const delta = current.kind === "QUIZ" && body?.correct ? 1 : 0;
    const nextIndex = postVideo.index + 1;
    if (nextIndex >= postVideo.queue.length) {
      setPostVideo((state) => ({ ...state, score: state.score + delta, done: true }));
      await save();
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
    } else {
      setPostVideo((state) => ({ ...state, index: nextIndex, score: state.score + delta }));
    }
    setQuizSelected(null);
    setReflectionText("");
  }

  async function onEnded() {
    const total = video.current?.duration ?? Infinity;
    const postRoll = checkpointState.filter((cp) => cp.triggerSeconds >= total);
    if (postRoll.length) {
      setPostVideo({ started: true, queue: postRoll, index: 0, score: 0, total: postRoll.filter((cp) => cp.kind === "QUIZ").length, done: false });
      return;
    }
    await save();
  }

  useEffect(() => {
    function onFullscreenChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "n" && nextLessonHref) { event.preventDefault(); router.push(nextLessonHref); }
      if (key === "p" && previousLessonHref) { event.preventDefault(); router.push(previousLessonHref); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextLessonHref, previousLessonHref, router]);

  function onContainerMouseMove() {
    if (!isFullscreen) return;
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), 3000);
  }

  const hudHidden = isFullscreen && !hudVisible;

  return (
    <div className="lesson-player">
      <div ref={container} onMouseMove={onContainerMouseMove} className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={video}
          className="aspect-video w-full"
          preload="metadata"
          poster="/demo/video-poster.svg"
          onLoadedMetadata={() => {
            if (!video.current) return;
            setDuration(video.current.duration);
            if (initialSeconds > 0) video.current.currentTime = Math.min(initialSeconds, Math.max(0, video.current.duration - 1));
          }}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => { setIsPlaying(false); void save(); }}
          onEnded={() => { setIsPlaying(false); void onEnded(); }}
        >
          <source src={videoUrl} type="video/mp4" />
          {ar ? "المتصفح لا يدعم تشغيل الفيديو." : en ? "Your browser does not support video playback." : "Votre navigateur ne prend pas en charge la vidéo."}
        </video>

        {activeCheckpoint ? (
          <CheckpointOverlay
            locale={locale}
            checkpoint={activeCheckpoint}
            reflectionText={reflectionText}
            onReflectionChange={setReflectionText}
            quizSelected={quizSelected}
            onQuizSelect={setQuizSelected}
            feedback={quizFeedback}
            responding={responding}
            onSubmit={() => respondToActiveCheckpoint(activeCheckpoint.kind === "QUIZ" ? { selectedOptionId: quizSelected ?? undefined } : { responseText: reflectionText })}
          />
        ) : null}

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
            onSubmit={(current) => respondToPostVideo(current.kind === "QUIZ" ? { selectedOptionId: quizSelected ?? undefined } : { responseText: reflectionText })}
            nextLessonHref={nextLessonHref}
          />
        ) : null}

        {!activeCheckpoint && !postVideo.started ? (
          <div className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 transition-opacity duration-200 ${hudHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
            <button type="button" onClick={togglePlay} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25" aria-label={isPlaying ? (ar ? "إيقاف مؤقت" : "Pause") : (ar ? "تشغيل" : "Lecture")}>
              {isPlaying ? <Pause size={18} strokeWidth={1.75} /> : <Play size={18} strokeWidth={1.75} />}
            </button>
            <div className="relative h-2.5 flex-1 cursor-pointer rounded-full bg-white/25" onClick={onSeekBarClick}>
              <div className="h-full rounded-full bg-[#C9913F]" style={{ width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%" }} />
              {duration ? checkpointState.map((cp) => (
                <span
                  key={cp.id}
                  className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 ${cp.answered ? "bg-[#082D55]" : "bg-[#C9913F]"}`}
                  style={{ left: `${Math.min(100, (Math.min(cp.triggerSeconds, duration) / duration) * 100)}%` }}
                  title={ar ? cp.promptAr : cp.promptFr}
                />
              )) : null}
            </div>
            <span className="flex-none text-xs font-medium text-white/90" dir="ltr">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button type="button" onClick={toggleFullscreen} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25" aria-label={isFullscreen ? (ar ? "الخروج من ملء الشاشة" : "Quitter le plein écran") : (ar ? "ملء الشاشة" : "Plein écran")}>
              {isFullscreen ? <Minimize size={17} strokeWidth={1.75} /> : <Maximize size={17} strokeWidth={1.75} />}
            </button>
          </div>
        ) : null}

        {isFullscreen && nextLessonHref && !activeCheckpoint && !postVideo.started ? (
          <Link
            href={nextLessonHref}
            className={`absolute top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-all duration-200 ease-in-out hover:bg-white/30 ${ar ? "left-4" : "right-4"} ${hudHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
          >
            <span>{ar ? "الانتقال إلى الدرس التالي" : "Passer à la leçon suivante"}</span>
            <ArrowRight size={16} strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      {courseComplete ? (
        <CourseCompletionModal
          locale={locale}
          certificateCode={courseComplete.certificateCode}
          onClose={() => setCourseComplete(null)}
        />
      ) : null}
      <div className="lesson-player-meta">
        <div>
          <strong>{title}</strong>
          <small>{saving ? (ar ? "حفظ التقدم..." : en ? "Saving progress..." : "Enregistrement...") : completed ? (ar ? "مكتمل" : en ? "Completed" : "Terminé") : (ar ? "يُحفظ التقدم تلقائيًا" : en ? "Progress is saved automatically" : "Progression sauvegardée automatiquement")}</small>
        </div>
      </div>
    </div>
  );
}

function CourseCompletionModal({ locale, certificateCode, onClose }: { locale: Locale; certificateCode: string | null; onClose: () => void }) {
  const ar = locale === "ar";
  const en = locale === "en";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050b18]/90 p-4 text-center backdrop-blur-md" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        aria-label={ar ? "إغلاق" : en ? "Close" : "Fermer"}
        className={`absolute top-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 ${ar ? "left-6" : "right-6"}`}
      >
        <X size={18} strokeWidth={1.75} />
      </button>
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F6F1E7]">
          <Award size={30} strokeWidth={1.75} className="text-[#a9752f]" />
        </span>
        <p className="mt-6 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-white">
          {ar ? "تهانينا! لقد أتممت الدورة بنجاح" : en ? "Congratulations! Course completed" : "Félicitations, formation terminée !"}
        </p>
        <p className="mt-3 text-sm text-white/70">
          {ar ? "لقد أكملت جميع دروس هذه الدورة. شهادتك متاحة الآن." : en ? "You have completed every lesson in this course. Your certificate is now available." : "Vous avez terminé toutes les leçons de cette formation. Votre certificat est désormais disponible."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={certificateCode ? `/${locale}/certificats/${certificateCode}` : `/${locale}/dashboard/certificats`}
            className="inline-flex items-center gap-2 rounded-full border border-white bg-white px-5 py-2.5 text-sm font-semibold text-[#082D55]"
          >
            <Award size={16} strokeWidth={1.75} />
            {ar ? "عرض شهادتي" : en ? "View my certificate" : "Voir mon certificat"}
          </Link>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20">
            {ar ? "متابعة التصفح" : en ? "Keep browsing" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckpointOverlay({ locale, checkpoint, reflectionText, onReflectionChange, quizSelected, onQuizSelect, feedback, responding, onSubmit }: {
  locale: Locale; checkpoint: LearnerCheckpoint; reflectionText: string; onReflectionChange: (value: string) => void;
  quizSelected: string | null; onQuizSelect: (id: string) => void; feedback: "correct" | "incorrect" | null; responding: boolean; onSubmit: () => void;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F1E7] px-3 py-1 text-xs font-semibold text-[#a9752f]">
          {checkpoint.kind === "QUIZ" ? (ar ? "سؤال سريع" : en ? "Quick check" : "Question rapide") : (ar ? "تأمل" : en ? "Reflection" : "Réflexion")}
        </span>
        <p className="mt-3 text-base font-semibold text-[#082D55]">{ar ? checkpoint.promptAr : checkpoint.promptFr}</p>

        {checkpoint.kind === "QUIZ" ? (
          <div className="mt-4 flex flex-col gap-2">
            {(checkpoint.options ?? []).map((option) => {
              const isSelected = quizSelected === option.id;
              const showFeedback = feedback && isSelected;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => onQuizSelect(option.id)}
                  className={`rounded-xl border px-4 py-2.5 text-start text-sm font-medium transition-all duration-200 ease-in-out ${showFeedback ? (feedback === "correct" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-rose-400 bg-rose-50 text-rose-700") : isSelected ? "border-[#082D55] bg-[#082D55]/5 text-[#082D55]" : "border-[#E7E0D3] text-[#3d3a33] hover:border-[#C9913F]"}`}
                >
                  {ar ? option.textAr : option.textFr}
                </button>
              );
            })}
            <button type="button" disabled={!quizSelected || responding || Boolean(feedback)} onClick={onSubmit} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50">
              {feedback ? (feedback === "correct" ? (ar ? "إجابة صحيحة ✓" : en ? "Correct ✓" : "Bonne réponse ✓") : (ar ? "إجابة غير صحيحة" : en ? "Incorrect" : "Pas tout à fait")) : responding ? (ar ? "جارٍ الإرسال..." : "Envoi...") : (ar ? "تأكيد الإجابة" : en ? "Submit answer" : "Valider la réponse")}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              value={reflectionText}
              onChange={(event) => onReflectionChange(event.target.value)}
              rows={4}
              placeholder={ar ? "اكتب أفكارك هنا..." : en ? "Write your thoughts here..." : "Écrivez vos réflexions ici..."}
              className="w-full rounded-xl border border-[#E7E0D3] p-3 text-sm text-[#082D55] focus:border-[#C9913F] focus:outline-none"
            />
            <button type="button" disabled={!reflectionText.trim() || responding} onClick={onSubmit} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50">
              {responding ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ ومتابعة" : en ? "Save and continue" : "Enregistrer et continuer")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostVideoQuizPanel({ locale, queue, index, score, total, done, responding, quizSelected, onQuizSelect, reflectionText, onReflectionChange, onSubmit, nextLessonHref }: {
  locale: Locale; queue: LearnerCheckpoint[]; index: number; score: number; total: number; done: boolean; responding: boolean;
  quizSelected: string | null; onQuizSelect: (id: string) => void; reflectionText: string; onReflectionChange: (value: string) => void;
  onSubmit: (current: LearnerCheckpoint) => void; nextLessonHref?: string;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const current = queue[index];
  const percent = total > 0 ? Math.round((score / total) * 100) : 100;

  if (done) {
    return (
      <div className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-4 text-center backdrop-blur-sm">
        <div className="max-w-sm">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-white">{ar ? "أحسنت! أكملت الدرس" : en ? "Well done! Lesson complete" : "Bravo, leçon terminée !"}</p>
          {total > 0 ? <p className="mt-2 text-lg font-semibold text-[#e2bd7d]" dir="ltr">{ar ? `النتيجة: ${score}/${total} - ${percent}%` : `Score : ${score}/${total} - ${percent}%`}</p> : null}
          {nextLessonHref ? (
            <a href={nextLessonHref} className="mt-5 inline-flex items-center gap-2 rounded-full border border-white bg-white px-5 py-2.5 text-sm font-semibold text-[#082D55]">
              {ar ? "الدرس التالي" : en ? "Next lesson" : "Leçon suivante"}
              <ArrowRight size={16} strokeWidth={1.75} />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F1E7] px-3 py-1 text-xs font-semibold text-[#a9752f]">
          {ar ? `اختبار ختامي — سؤال ${index + 1}/${queue.length}` : en ? `Formative quiz — question ${index + 1}/${queue.length}` : `Quiz formatif — question ${index + 1}/${queue.length}`}
        </span>
        <p className="mt-3 text-base font-semibold text-[#082D55]">{ar ? current.promptAr : current.promptFr}</p>
        {current.kind === "QUIZ" ? (
          <div className="mt-4 flex flex-col gap-2">
            {(current.options ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onQuizSelect(option.id)}
                className={`rounded-xl border px-4 py-2.5 text-start text-sm font-medium transition-all duration-200 ease-in-out ${quizSelected === option.id ? "border-[#082D55] bg-[#082D55]/5 text-[#082D55]" : "border-[#E7E0D3] text-[#3d3a33] hover:border-[#C9913F]"}`}
              >
                {ar ? option.textAr : option.textFr}
              </button>
            ))}
            <button type="button" disabled={!quizSelected || responding} onClick={() => onSubmit(current)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50">
              {responding ? (ar ? "جارٍ الإرسال..." : "Envoi...") : index + 1 >= queue.length ? (ar ? "إنهاء" : en ? "Finish" : "Terminer") : (ar ? "التالي" : en ? "Next" : "Suivant")}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              value={reflectionText}
              onChange={(event) => onReflectionChange(event.target.value)}
              rows={4}
              placeholder={ar ? "اكتب أفكارك هنا..." : en ? "Write your thoughts here..." : "Écrivez vos réflexions ici..."}
              className="w-full rounded-xl border border-[#E7E0D3] p-3 text-sm text-[#082D55] focus:border-[#C9913F] focus:outline-none"
            />
            <button type="button" disabled={!reflectionText.trim() || responding} onClick={() => onSubmit(current)} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-[#082D55] bg-[#082D55] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:bg-[#061F3D] disabled:cursor-not-allowed disabled:opacity-50">
              {responding ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : index + 1 >= queue.length ? (ar ? "إنهاء" : en ? "Finish" : "Terminer") : (ar ? "التالي" : en ? "Next" : "Suivant")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
