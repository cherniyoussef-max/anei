"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/types";
import type { LiveSessionEmbedMode, LiveSessionProvider, LiveSessionStatus } from "@/server/db/schema";

export interface StudentLiveRoomData {
  id: string;
  titleFr: string;
  titleAr: string;
  descriptionFr: string | null;
  descriptionAr: string | null;
  provider: LiveSessionProvider;
  embedMode: LiveSessionEmbedMode;
  scope: string;
  courseId: string | null;
  courseTitleFr: string | null;
  courseTitleAr: string | null;
  status: LiveSessionStatus;
  scheduledStartAt: Date | string;
  durationMinutes: number;
  isBroadcastPushed: boolean;
  attendeeCount: number;
  directEmbedUrl: string | null;
}

export function StudentLiveRoom({
  locale,
  initialSession,
  initialHasAttended = false,
}: {
  locale: Locale;
  initialSession: StudentLiveRoomData;
  initialHasAttended?: boolean;
}) {
  const ar = locale === "ar";
  const [session, _setSession] = useState<StudentLiveRoomData>(initialSession);
  const [hasAttended, setHasAttended] = useState(initialHasAttended);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(initialSession.directEmbedUrl);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Notes state
  const [personalNotes, setPersonalNotes] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`live_notes_${initialSession.id}`) || "";
    }
    return "";
  });

  // Countdown timer for scheduled sessions
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    const target = new Date(session.scheduledStartAt).getTime();

    function updateCountdown() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds, isPast: false });
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session.scheduledStartAt]);

  // Save personal notes to localStorage
  function handleNotesChange(text: string) {
    setPersonalNotes(text);
    if (typeof window !== "undefined") {
      localStorage.setItem(`live_notes_${session.id}`, text);
    }
  }

  function downloadNotes() {
    const blob = new Blob([personalNotes], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-webinaire-${session.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleJoinMeeting() {
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/learning/live/${session.id}/join`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "IMPERSONATION_READ_ONLY") {
          setJoinError(
            ar
              ? "عملية الانضمام معطلة في وضع معاينة الدعم (Lecture Seule)."
              : "L'enregistrement de présence est désactivé en mode prévisualisation support."
          );
        } else if (data.error === "LIVE_NOT_STARTED") {
          setJoinError(
            ar
              ? "لم يبدأ البث المباشر بعد. يرجى الانتظار حتى يقوم المدرب بفتح القاعة."
              : "Le direct n'a pas encore commencé. Veuillez patienter jusqu'au démarrage officiel."
          );
        } else {
          setJoinError(data.message || (ar ? "تعذر الانضمام للمباشر." : "Impossible de rejoindre la réunion."));
        }
        return;
      }

      setHasAttended(true);
      const url = data.externalMeetingUrl;
      setMeetingUrl(url);

      // If Google Meet or Zoom (PORTAL_LAUNCH), launch popup window
      if (session.embedMode === "PORTAL_LAUNCH" || session.provider === "GOOGLE_MEET" || session.provider === "ZOOM") {
        const width = 1050;
        const height = 750;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(
          url,
          `anei_live_${session.id}`,
          `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
        );
      }
    } catch {
      setJoinError(ar ? "خطأ في الاتصال بالشبكة." : "Erreur de connexion.");
    } finally {
      setJoining(false);
    }
  }

  const title = ar ? session.titleAr : session.titleFr;
  const description = ar ? session.descriptionAr : session.descriptionFr;

  return (
    <div className="student-live-room max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <Link href={`/${locale}/dashboard`} className="hover:text-[#0056D2] transition-colors">
              {ar ? "لوحة التحكم" : "Tableau de bord"}
            </Link>
            <span>/</span>
            <Link href={`/${locale}/learning/live`} className="hover:text-[#0056D2] transition-colors">
              {ar ? "الندوات والمباشر" : "Directs & Webinaires"}
            </Link>
            <span>/</span>
            <span className="text-[#1E293B] font-medium truncate max-w-[200px]">{title}</span>
          </nav>

          <h1 className="text-xl md:text-2xl font-bold text-[#082D55]">{title}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {session.status === "LIVE_NOW" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-bold text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse"></span>
              {ar ? "🔴 بث مباشر الآن" : "🔴 EN DIRECT"}
            </span>
          ) : session.status === "SCHEDULED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-3 py-1 text-xs font-semibold text-[#0056D2]">
              {ar ? "مبرمج قريباً" : "Session programmée"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#64748B]">
              {ar ? "جلسة منتهية" : "Session terminée"}
            </span>
          )}

          {hasAttended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
              ✓ {ar ? "تم تسجيل الحضور" : "Présence validée"}
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Column Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Screen / Video Hub (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl overflow-hidden border border-[#E2E8F0] bg-white shadow-xs">
            {/* Case 1: Session is LIVE_NOW and IFRAME_EMBED (Jitsi) */}
            {session.status === "LIVE_NOW" && session.embedMode === "IFRAME_EMBED" && meetingUrl ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={meetingUrl}
                  title="Direct Jitsi ANEI"
                  allow="camera; microphone; display-capture; autoplay; clipboard-write"
                  className="w-full h-full border-0"
                />
              </div>
            ) : session.status === "LIVE_NOW" ? (
              /* Case 2: Session is LIVE_NOW and Google Meet / Zoom (PORTAL_LAUNCH) */
              <div className="p-8 md:p-12 text-center bg-linear-to-b from-[#F8FAFC] to-[#EFF6FF] flex flex-col items-center justify-center min-h-[380px]">
                <div className="h-16 w-16 rounded-full bg-[#0056D2]/10 flex items-center justify-center text-3xl mb-4 text-[#0056D2]">
                  {session.provider === "GOOGLE_MEET" ? "🔹" : "🔷"}
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-[#DC2626]/10 px-3 py-1 text-xs font-bold text-[#DC2626] mb-3">
                  <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-ping"></span>
                  {ar ? "المحاضر متصل الآن" : "Direct en cours sur Google Meet"}
                </div>

                <h2 className="text-lg md:text-xl font-bold text-[#082D55] max-w-md mb-2">
                  {ar
                    ? "انضم الآن إلى غرفة Google Meet التفاعلية"
                    : "Rejoignez la salle de direct officielle ANEI"}
                </h2>

                <p className="text-xs md:text-sm text-[#64748B] max-w-md mb-6 leading-relaxed">
                  {ar
                    ? "انقر على الزر أدناه لتسجيل حضورك الأكاديمي وفتح واجهة Google Meet في نافذة مستقلة دون مغادرة منصة ANEI."
                    : "Cliquez ci-dessous pour valider votre présence académique et ouvrir la visioconférence dans une fenêtre calibrée tout en gardant vos notes ANEI ouvertes."}
                </p>

                {joinError && (
                  <div className="rounded-md bg-[#FEE2E2] px-4 py-2 text-xs text-[#DC2626] font-medium mb-4 max-w-md">
                    ⚠️ {joinError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleJoinMeeting}
                  disabled={joining}
                  className="inline-flex items-center gap-2.5 rounded-lg bg-[#0056D2] px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-[#00419e] hover:shadow-lg active:scale-95 text-sm"
                >
                  <span>
                    {joining
                      ? (ar ? "جارٍ تسجيل الحضور..." : "Validation de présence...")
                      : (ar ? "🚀 إطلاق غرفة Google Meet الآن" : "🚀 Lancer l'audio/vidéo Google Meet")}
                  </span>
                  <span aria-hidden="true" className={ar ? "rotate-180" : ""}>&rarr;</span>
                </button>

                {hasAttended && (
                  <p className="text-xs text-[#16A34A] mt-3 font-medium">
                    ✓ {ar ? "تم تسجيل حضورك بنجاح في سجل الجلسة." : "Votre présence est enregistrée dans le journal officiel ANEI."}
                  </p>
                )}
              </div>
            ) : session.status === "SCHEDULED" ? (
              /* Case 3: Session is SCHEDULED (Countdown Stage) */
              <div className="p-8 md:p-12 text-center bg-[#F8FAFC] flex flex-col items-center justify-center min-h-[380px]">
                <div className="h-14 w-14 rounded-full bg-[#0056D2]/10 flex items-center justify-center text-2xl mb-4 text-[#0056D2]">
                  ⏳
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-[#0056D2] mb-1">
                  {ar ? "البث المباشر سينطلق قريباً" : "Ouverture prochaine de la salle"}
                </span>

                <h2 className="text-lg md:text-xl font-bold text-[#082D55] mb-6">
                  {new Date(session.scheduledStartAt).toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </h2>

                {/* Countdown display */}
                <div className="grid grid-cols-4 gap-3 max-w-xs w-full mb-6 text-center">
                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-xs">
                    <span className="block text-2xl font-bold text-[#082D55]">{timeLeft.days}</span>
                    <span className="text-[10px] text-[#64748B] uppercase">{ar ? "يوم" : "Jours"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-xs">
                    <span className="block text-2xl font-bold text-[#082D55]">{timeLeft.hours}</span>
                    <span className="text-[10px] text-[#64748B] uppercase">{ar ? "ساعة" : "Heures"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-xs">
                    <span className="block text-2xl font-bold text-[#082D55]">{timeLeft.minutes}</span>
                    <span className="text-[10px] text-[#64748B] uppercase">{ar ? "دقيقة" : "Min"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-xs">
                    <span className="block text-2xl font-bold text-[#0056D2]">{timeLeft.seconds}</span>
                    <span className="text-[10px] text-[#64748B] uppercase">{ar ? "ثانية" : "Sec"}</span>
                  </div>
                </div>

                <p className="text-xs text-[#64748B] max-w-sm">
                  🔒 {ar ? "رابط الاجتماع سري ومحمي وسيتم تفعيله فور بدء المدرب للبث." : "Le lien de visioconférence est sécurisé et s'activera automatiquement dès le lancement du live."}
                </p>
              </div>
            ) : (
              /* Case 4: Ended */
              <div className="p-8 md:p-12 text-center bg-[#F8FAFC] flex flex-col items-center justify-center min-h-[350px]">
                <div className="h-14 w-14 rounded-full bg-[#E2E8F0] flex items-center justify-center text-2xl mb-4 text-[#64748B]">
                  🏁
                </div>
                <h2 className="text-lg font-bold text-[#082D55] mb-2">
                  {ar ? "هذا البث المباشر قد انتهى" : "Ce webinaire est terminé"}
                </h2>
                <p className="text-xs text-[#64748B] max-w-sm mb-4">
                  {ar
                    ? "شكراً لمشاركتك. يمكنك العودة للدورات أو متابعة الإعلانات القادمة في المنصة."
                    : "Merci pour votre participation. Retrouvez vos cours et certifications sur votre espace."}
                </p>
                <Link
                  href={`/${locale}/dashboard`}
                  className="rounded-md bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00419e]"
                >
                  {ar ? "العودة للوحة التحكم" : "Retour au tableau de bord"}
                </Link>
              </div>
            )}

            {/* In-page live action status notification */}
            {hasAttended && session.status === "LIVE_NOW" && (
              <div className="border-t border-[#E2E8F0] bg-[#F0FDF4] px-4 py-3 flex items-center justify-between text-xs text-[#166534]">
                <div className="flex items-center gap-2">
                  <span>🟢</span>
                  <span>
                    {ar
                      ? "أنت حاضر في هذا المباشر. نافذة الفيديو نشطة."
                      : "Vous participez activement à ce direct."}
                  </span>
                </div>
                {meetingUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(meetingUrl, `live_${session.id}`)}
                    className="font-semibold underline hover:text-[#15803D]"
                  >
                    {ar ? "إعادة فتح نافذة Meet ↗" : "Rouvrir la fenêtre Meet ↗"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Description Block */}
          {description && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#082D55] mb-2">
                {ar ? "عن هذا المباشر" : "À propos de cette session"}
              </h3>
              <p className="text-xs md:text-sm text-[#475569] leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Personal Notes & Live Resources (1 Col) */}
        <div className="space-y-4">
          {/* Notes Area */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#082D55] flex items-center gap-1.5">
                <span>📝</span>
                <span>{ar ? "مذكراتي أثناء المباشر" : "Mes notes personnelles"}</span>
              </h3>
              {personalNotes.trim() && (
                <button
                  type="button"
                  onClick={downloadNotes}
                  className="text-[11px] font-semibold text-[#0056D2] hover:underline"
                >
                  {ar ? "تحميل (.txt)" : "Télécharger"}
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#64748B] mb-3">
              {ar
                ? "سجّل ملاحظاتك ونقاطك الهامة هنا؛ تحفظ تلقائياً في متصفحك."
                : "Notez les points clés en direct ; la sauvegarde est automatique."}
            </p>

            <textarea
              value={personalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={ar ? "اكتب ملاحظاتك وأسئلتك هنا..." : "Écrivez vos remarques, questions ou points clés ici..."}
              className="w-full flex-1 min-h-[220px] rounded-lg border border-[#CBD5E1] p-3 text-xs text-[#1E293B] focus:border-[#0056D2] focus:outline-none resize-none leading-relaxed bg-[#F8FAFC]"
            />
          </div>

          {/* Session Overview Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#082D55]">
              {ar ? "معلومات الفعالية" : "Fiche de l'événement"}
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">{ar ? "المنصة" : "Plateforme"}</span>
                <span className="font-semibold text-[#1E293B]">
                  {session.provider === "GOOGLE_MEET" ? "Google Meet" : session.provider}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">{ar ? "المدة التقديرية" : "Durée estimée"}</span>
                <span className="font-semibold text-[#1E293B]">{session.durationMinutes} min</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">{ar ? "الجمهور" : "Audience"}</span>
                <span className="font-semibold text-[#1E293B]">
                  {session.scope === "GLOBAL_WEBINAR"
                    ? (ar ? "عام لجميع المتعلمين" : "Tous les apprenants")
                    : (ar ? "خاص بالدورة" : "Réservé au cours")}
                </span>
              </div>

              {session.courseTitleFr && (
                <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">{ar ? "الدورة" : "Formation"}</span>
                  <span className="font-semibold text-[#0056D2] truncate max-w-[140px]">
                    {ar ? session.courseTitleAr : session.courseTitleFr}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
