import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, BookOpen, Calendar } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLiveSessionsForLearner } from "@/server/queries/live";

export const dynamic = "force-dynamic";

export default async function LearnerLiveSessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireUser(locale);
  const liveSessions = await getLiveSessionsForLearner(session.user.id);
  const ar = locale === "ar";

  const liveNow = liveSessions.filter((s) => s.status === "LIVE_NOW");
  const upcoming = liveSessions.filter((s) => s.status === "SCHEDULED");
  const ended = liveSessions.filter((s) => s.status === "ENDED");

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#082D55]">
          {ar ? "الندوات واللقاءات المباشرة" : "Directs & Webinaires en Direct"}
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          {ar
            ? "شارك في الجلسات التفاعلية المباشرة، وحصص الأسئلة والأجوبة مع مؤطري ومختصي منصة ANEI."
            : "Participez aux ateliers en direct, sessions de mentorat et webinaires thématiques animés par nos experts."}
        </p>
      </div>

      {/* Live Now Section */}
      {liveNow.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h2 className="text-base font-bold text-[#DC2626] uppercase tracking-wide">
              {ar ? "جلسات تبث الآن مباشرة" : "En direct maintenant"}
            </h2>
          </div>

          <div className="grid gap-4">
            {liveNow.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border-2 border-[#DC2626] bg-white p-5 shadow-md flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#DC2626] px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{ar ? "مباشر" : "Live"}</span>
                    </span>
                    <span className="text-xs font-semibold text-[#0056D2] inline-flex items-center gap-1">
                      {item.scope === "GLOBAL_WEBINAR" ? (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          <span>{ar ? "ندوة عامة لجميع المتعلمين" : "Webinaire global plateforme"}</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{ar ? (item.courseTitleAr || "خاص بالدورة") : (item.courseTitleFr || "Lié à une formation")}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#082D55]">
                    {ar ? item.titleAr : item.titleFr}
                  </h3>

                  {item.descriptionFr && (
                    <p className="text-xs text-[#64748B] line-clamp-2 max-w-xl">
                      {ar ? item.descriptionAr : item.descriptionFr}
                    </p>
                  )}
                </div>

                <Link
                  href={`/${locale}/learning/live/${item.id}`}
                  className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#B91C1C] transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-1.5"
                >
                  <span>{ar ? "دخول القاعة الآن" : "Rejoindre la salle"}</span>
                  <span aria-hidden="true" className={ar ? "rotate-180" : ""}>&rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Sessions Section */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#082D55]">
          {ar ? "الجلسات والندوات القادمة" : "Sessions programmées"}
        </h2>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] p-8 text-center text-sm text-[#64748B] bg-[#F8FAFC]">
            {ar ? "لا توجد جلسات مباشرة مبرمجة في الوقت الحالي." : "Aucune session en direct n'est programmée pour le moment."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between hover:border-[#0056D2] transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span className="font-semibold text-[#0056D2]">
                      {item.provider === "GOOGLE_MEET" ? "Google Meet" : item.provider}
                    </span>
                    <span>⏳ {item.durationMinutes} min</span>
                  </div>

                  <h3 className="text-base font-bold text-[#082D55] line-clamp-2">
                    {ar ? item.titleAr : item.titleFr}
                  </h3>

                  <p className="text-xs text-[#64748B] line-clamp-2">
                    {ar ? item.descriptionAr : item.descriptionFr}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                  <span className="font-medium text-[#475569] inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(item.scheduledStartAt).toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>

                  <Link
                    href={`/${locale}/learning/live/${item.id}`}
                    className="font-bold text-[#0056D2] hover:underline"
                  >
                    {ar ? "تفاصيل القاعة ←" : "Voir la salle →"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past Sessions Section */}
      {ended.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-[#E2E8F0]">
          <h2 className="text-base font-bold text-[#64748B]">
            {ar ? "جلسات سابقة" : "Sessions passées"}
          </h2>

          <div className="grid gap-2">
            {ended.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-center justify-between text-xs text-[#64748B]"
              >
                <div>
                  <strong className="text-[#1E293B] font-semibold block text-sm">
                    {ar ? item.titleAr : item.titleFr}
                  </strong>
                  <span>
                    {new Date(item.scheduledStartAt).toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <span className="rounded bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  {ar ? "انتهت" : "Terminée"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
