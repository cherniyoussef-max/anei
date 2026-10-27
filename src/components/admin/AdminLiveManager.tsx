"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  BookOpen,
  GraduationCap,
  Tag,
  Calendar,
  Clock,
  Users,
  Radio,
  ExternalLink,
  Square,
  X,
  Zap,
  Lock,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { AdminSudoModal } from "@/components/admin/AdminSudoModal";
import { detectProviderAndEmbedMode } from "@/lib/live-validation";
import type { Locale } from "@/types";
import type { AdminLiveSessionItem } from "@/server/queries/live";
import type { LiveSessionEmbedMode, LiveSessionProvider, LiveSessionScope } from "@/server/db/schema";

interface CourseOption {
  id: string;
  titleFr: string;
  titleAr: string;
}

interface AttendeeItem {
  id: string;
  joinedAt: Date | string;
  userId: string;
  userName: string;
  userEmail: string;
}

export function AdminLiveManager({
  locale,
  initialSessions,
  courses,
  userRole: _userRole,
}: {
  locale: Locale;
  initialSessions: AdminLiveSessionItem[];
  courses: CourseOption[];
  userRole: string;
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [sessions, setSessions] = useState<AdminLiveSessionItem[]>(initialSessions);
  const [activeTab, setActiveTab] = useState<"LIVE_NOW" | "SCHEDULED" | "ENDED">("LIVE_NOW");
  const [search, setSearch] = useState("");

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [titleFr, setTitleFr] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [externalMeetingUrl, setExternalMeetingUrl] = useState("");
  const [provider, setProvider] = useState<LiveSessionProvider>("GOOGLE_MEET");
  const [embedMode, setEmbedMode] = useState<LiveSessionEmbedMode>("PORTAL_LAUNCH");
  const [scope, setScope] = useState<LiveSessionScope>("GLOBAL_WEBINAR");
  const [category, setCategory] = useState<string>("EDUCATION_INCLUSIVE");
  const [courseId, setCourseId] = useState<string>("");
  const [speakerName, setSpeakerName] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Sudo Modal state
  const [sudoOpen, setSudoOpen] = useState(false);
  const [sudoAction, setSudoAction] = useState<{
    type: "PUSH_BROADCAST" | "DELETE";
    sessionId: string;
    sessionTitle: string;
  } | null>(null);

  // Attendees Modal state
  const [attendeesModalSession, setAttendeesModalSession] = useState<{
    id: string;
    title: string;
    attendees: AttendeeItem[];
    loading: boolean;
  } | null>(null);

  // Quick URL change detection
  function handleUrlChange(url: string) {
    setExternalMeetingUrl(url);
    if (url.trim().length > 5) {
      const detected = detectProviderAndEmbedMode(url);
      setProvider(detected.provider);
      setEmbedMode(detected.embedMode);
    }
  }

  function openMeetNewTab() {
    window.open("https://meet.new", "_blank", "noopener,noreferrer");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr,
          titleAr,
          descriptionFr: descriptionFr || null,
          descriptionAr: descriptionAr || null,
          externalMeetingUrl,
          provider,
          embedMode,
          scope,
          category,
          courseId: courseId || null,
          scheduledStartAt: new Date(scheduledStartAt).toISOString(),
          durationMinutes,
          isBroadcastPushed: false,
          speakerName: speakerName.trim() || null,
          replayUrl: replayUrl.trim() || null,
          status: "SCHEDULED",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(
          data.message || (ar ? "فشل إنشاء الجلسة المباشرة." : "Échec de création de la session en direct.")
        );
        return;
      }

      setIsCreateOpen(false);
      resetForm();
      router.refresh();
      // Optimistic refresh
      if (data.session) {
        setSessions((prev) => [data.session, ...prev]);
      }
    } catch {
      setFormError(ar ? "خطأ في الشبكة." : "Erreur de connexion.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setTitleFr("");
    setTitleAr("");
    setDescriptionFr("");
    setDescriptionAr("");
    setExternalMeetingUrl("");
    setProvider("GOOGLE_MEET");
    setEmbedMode("PORTAL_LAUNCH");
    setScope("GLOBAL_WEBINAR");
    setCategory("EDUCATION_INCLUSIVE");
    setCourseId("");
    setSpeakerName("");
    setReplayUrl("");
    setDurationMinutes(60);
  }

  async function handlePushBroadcast(session: AdminLiveSessionItem) {
    if (
      !window.confirm(
        ar
          ? `هل أنت متأكد من بدء وبث "${session.titleAr}" فوراً لجميع المتعلمين عبر شريط التنبيه؟`
          : `Êtes-vous sûr de vouloir démarrer et pousser immédiatement "${session.titleFr}" à TOUS les apprenants de la plateforme ?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/live/${session.id}/push-broadcast`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.error === "SUDO_REQUIRED") {
        setSudoAction({
          type: "PUSH_BROADCAST",
          sessionId: session.id,
          sessionTitle: ar ? session.titleAr : session.titleFr,
        });
        setSudoOpen(true);
        return;
      }

      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, status: "LIVE_NOW", isBroadcastPushed: true } : s))
        );
        router.refresh();
      } else {
        alert(data.message || (ar ? "فشلت العملية." : "Échec de l'opération."));
      }
    } catch {
      alert(ar ? "خطأ في الشبكة." : "Erreur de réseau.");
    }
  }

  async function handleEndSession(session: AdminLiveSessionItem) {
    if (
      !window.confirm(
        ar
          ? `هل أنت متأكد من إنهاء جلسة "${session.titleAr}" المباشرة؟`
          : `Êtes-vous sûr de vouloir clore la session en direct "${session.titleFr}" ?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/live/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED", isBroadcastPushed: false }),
      });

      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, status: "ENDED", isBroadcastPushed: false } : s))
        );
        router.refresh();
      }
    } catch {
      alert(ar ? "خطأ في الشبكة." : "Erreur de réseau.");
    }
  }

  async function handleDelete(session: AdminLiveSessionItem) {
    if (
      !window.confirm(
        ar
          ? `هل أنت متأكد من حذف الجلسة "${session.titleAr}" نهائياً؟`
          : `Êtes-vous sûr de vouloir supprimer définitivement "${session.titleFr}" ?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/live/${session.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.error === "SUDO_REQUIRED") {
        setSudoAction({
          type: "DELETE",
          sessionId: session.id,
          sessionTitle: ar ? session.titleAr : session.titleFr,
        });
        setSudoOpen(true);
        return;
      }

      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        router.refresh();
      } else {
        alert(data.message || (ar ? "فشل الحذف." : "Échec de la suppression."));
      }
    } catch {
      alert(ar ? "خطأ في الشبكة." : "Erreur réseau.");
    }
  }

  async function openAttendeesList(session: AdminLiveSessionItem) {
    setAttendeesModalSession({
      id: session.id,
      title: ar ? session.titleAr : session.titleFr,
      attendees: [],
      loading: true,
    });

    try {
      const res = await fetch(`/api/admin/live/${session.id}`);
      if (res.ok) {
        const data = await res.json();
        setAttendeesModalSession({
          id: session.id,
          title: ar ? session.titleAr : session.titleFr,
          attendees: data.attendees || [],
          loading: false,
        });
      }
    } catch {
      setAttendeesModalSession(null);
    }
  }

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (activeTab === "LIVE_NOW" && s.status !== "LIVE_NOW") return false;
    if (activeTab === "SCHEDULED" && s.status !== "SCHEDULED") return false;
    if (activeTab === "ENDED" && s.status !== "ENDED" && s.status !== "CANCELLED") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchFr = s.titleFr.toLowerCase().includes(q);
      const matchAr = s.titleAr.toLowerCase().includes(q);
      if (!matchFr && !matchAr) return false;
    }
    return true;
  });

  const liveNowCount = sessions.filter((s) => s.status === "LIVE_NOW").length;
  const scheduledCount = sessions.filter((s) => s.status === "SCHEDULED").length;
  const endedCount = sessions.filter((s) => s.status === "ENDED" || s.status === "CANCELLED").length;

  return (
    <div className="admin-live-manager">
      {/* Top Banner / Actions */}
      <div className="admin-page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#082D55", margin: 0 }}>
            {ar ? "إدارة البث المباشر والندوات" : "Directs & Webinaires en Direct"}
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {ar
              ? "إنشاء وإدارة غرف البث (Google Meet, Zoom, Jitsi)، وتفعيل البث العام للطلاب في الوقت الفعلي."
              : "Création et pilotage des réunions en direct (Meet, Zoom, Jitsi) et diffusion push globale instantanée."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Icon name="spark" size={16} />
            <span>{ar ? "جدولة مباشر جديد" : "Créer un direct"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setActiveTab("LIVE_NOW")}
            style={{
              padding: "0.625rem 1rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              borderBottom: activeTab === "LIVE_NOW" ? "3px solid #DC2626" : "3px solid transparent",
              color: activeTab === "LIVE_NOW" ? "#DC2626" : "#64748B",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#DC2626", display: "inline-block" }} />
            <span>{ar ? "جلسات جارية الآن" : "En direct maintenant"}</span>
            <span style={{ fontSize: "0.75rem", backgroundColor: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 10 }}>
              {liveNowCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SCHEDULED")}
            style={{
              padding: "0.625rem 1rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              borderBottom: activeTab === "SCHEDULED" ? "3px solid #0056D2" : "3px solid transparent",
              color: activeTab === "SCHEDULED" ? "#0056D2" : "#64748B",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>{ar ? "جلسات مبرمجة" : "Programmés"}</span>
            <span style={{ fontSize: "0.75rem", backgroundColor: "#E0F2FE", color: "#0056D2", padding: "2px 6px", borderRadius: 10 }}>
              {scheduledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ENDED")}
            style={{
              padding: "0.625rem 1rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              borderBottom: activeTab === "ENDED" ? "3px solid #64748B" : "3px solid transparent",
              color: activeTab === "ENDED" ? "#1E293B" : "#64748B",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>{ar ? "جلسات منتهية" : "Terminés"}</span>
            <span style={{ fontSize: "0.75rem", backgroundColor: "#F1F5F9", color: "#64748B", padding: "2px 6px", borderRadius: 10 }}>
              {endedCount}
            </span>
          </button>
        </div>

        <div>
          <input
            type="text"
            className="form-input"
            placeholder={ar ? "بحث بالعنوان..." : "Rechercher par titre..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "220px", fontSize: "0.8125rem", padding: "0.375rem 0.625rem" }}
          />
        </div>
      </div>

      {/* Sessions Grid / Table */}
      {filteredSessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
          <p style={{ color: "#64748B", fontSize: "0.9375rem" }}>
            {ar ? "لا توجد جلسات تطابق المعايير المختارة." : "Aucune session ne correspond à cette sélection."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredSessions.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: item.status === "LIVE_NOW" ? "2px solid #DC2626" : "1px solid #E2E8F0",
                boxShadow: item.status === "LIVE_NOW" ? "0 4px 12px rgba(220, 38, 38, 0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
                padding: "1.25rem",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ flex: "1 1 350px", minWidth: "280px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                  {item.status === "LIVE_NOW" ? (
                    <span
                      style={{
                        backgroundColor: "#DC2626",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FFF" }} />
                      {ar ? "مباشر الآن" : "EN DIRECT"}
                    </span>
                  ) : item.status === "SCHEDULED" ? (
                    <span style={{ backgroundColor: "#E0F2FE", color: "#0056D2", fontWeight: 600, fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px" }}>
                      {ar ? "مبرمج" : "Programmé"}
                    </span>
                  ) : (
                    <span style={{ backgroundColor: "#F1F5F9", color: "#64748B", fontWeight: 600, fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px" }}>
                      {ar ? "منتهي" : "Terminé"}
                    </span>
                  )}

                  {item.scope === "GLOBAL_WEBINAR" ? (
                    <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Globe style={{ width: 12, height: 12 }} />
                      {ar ? "ندوة عامة للمنصة" : "Webinaire global plateforme"}
                    </span>
                  ) : (
                    <span style={{ backgroundColor: "#F3E8FF", color: "#6B21A8", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <BookOpen style={{ width: 12, height: 12 }} />
                      {ar ? "جلسة خاصة بالدورة" : "Réservé aux inscrits"}
                    </span>
                  )}

                  {(item.courseTitleFr || item.courseTitleAr) && (
                    <span style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <GraduationCap style={{ width: 12, height: 12 }} />
                      {ar ? `دورة: ${item.courseTitleAr || item.courseTitleFr}` : `Formation : ${item.courseTitleFr || item.courseTitleAr}`}
                    </span>
                  )}

                  {item.category && (
                    <span style={{ backgroundColor: "#F0FDF4", color: "#166534", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Tag style={{ width: 12, height: 12 }} />
                      {item.category === "EDUCATION_INCLUSIVE" ? (ar ? "التربية الدامجة" : "Éducation inclusive")
                        : item.category === "TROUBLES_APPRENTISSAGE" ? (ar ? "صعوبات التعلم" : "Troubles DYS")
                        : item.category === "SANTE_MENTALE" ? (ar ? "الصحة النفسية" : "Santé mentale")
                        : item.category === "PARENTALITE" ? (ar ? "الوالدية" : "Parentalité")
                        : (ar ? "ممارسة مهنية" : "Pratique AVS")}
                    </span>
                  )}

                  <span style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 500 }}>
                    {item.provider === "GOOGLE_MEET" && "Google Meet"}
                    {item.provider === "ZOOM" && "Zoom"}
                    {item.provider === "MICROSOFT_TEAMS" && "Teams"}
                    {item.provider === "JITSI" && "Jitsi Meet"}
                    {item.provider === "CUSTOM_EMBED" && "Custom"}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#082D55", margin: "0.25rem 0" }}>
                  {ar ? item.titleAr : item.titleFr}
                </h3>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.8125rem", color: "#64748B", marginTop: "0.375rem" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Calendar style={{ width: 14, height: 14 }} />
                    {new Date(item.scheduledStartAt).toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Clock style={{ width: 14, height: 14 }} />
                    {item.durationMinutes} min
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => openAttendeesList(item)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0056D2",
                        padding: 0,
                        cursor: "pointer",
                        fontWeight: 600,
                        textDecoration: "underline",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Users style={{ width: 14, height: 14 }} />
                      {item.attendeeCount} {ar ? "حاضر مسجل" : "présence(s) enregistrée(s)"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {item.status === "SCHEDULED" && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ backgroundColor: "#DC2626", color: "#FFF", borderColor: "#DC2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}
                    onClick={() => handlePushBroadcast(item)}
                    title={ar ? "بدء وبث التنبيه لجميع المتعلمين" : "Démarrer et envoyer la bannière push à tous"}
                  >
                    <Radio style={{ width: 14, height: 14 }} />
                    {ar ? "دفع وبدء المباشر" : "Démarrer & Pousser le Live"}
                  </button>
                )}

                {item.status === "LIVE_NOW" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ backgroundColor: "#0284C7", color: "#FFF", borderColor: "#0284C7", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      onClick={() => window.open(`/${locale}/learning/live/${item.id}`, "_blank")}
                    >
                      <ExternalLink style={{ width: 14, height: 14 }} />
                      {ar ? "معاينة القاعة" : "Ouvrir la salle"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      onClick={() => handleEndSession(item)}
                    >
                      <Square style={{ width: 14, height: 14 }} />
                      {ar ? "إنهاء المباشر" : "Terminer"}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#DC2626" }}
                  onClick={() => handleDelete(item)}
                >
                  {ar ? "حذف" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "8px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#082D55", margin: 0 }}>
                {ar ? "إنشاء وبرمجة بث مباشر جديد" : "Créer et programmer un nouveau direct"}
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center" }}
                aria-label={ar ? "إغلاق" : "Fermer"}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {formError && (
              <div style={{ backgroundColor: "#FEE2E2", color: "#DC2626", padding: "0.75rem", borderRadius: "6px", fontSize: "0.875rem", marginBottom: "1rem" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate}>
              {/* Titles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Titre (Français) *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={titleFr}
                    onChange={(e) => setTitleFr(e.target.value)}
                    placeholder="Ex: Webinaire Q&A Pédagogique"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    العنوان (العربية) *
                  </label>
                  <input
                    type="text"
                    required
                    dir="rtl"
                    className="form-input"
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="مثال: جلسة أسئلة وأجوبة مباشرة"
                  />
                </div>
              </div>

              {/* Quick Google Meet helper button */}
              <div style={{ backgroundColor: "#F0Fdf4", border: "1px dashed #86EFAC", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "0.8125rem", color: "#166534", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Zap style={{ width: 14, height: 14 }} />
                      {ar ? "مساعد Google Meet السريع" : "Générateur Google Meet instantané"}
                    </strong>
                    <p style={{ fontSize: "0.75rem", color: "#15803D", margin: "2px 0 0" }}>
                      {ar ? "افتح رابط Meet جديد بنقرة واحدة، ثم الصقه في الحقل أدناه." : "Générez une réunion Meet en 1 clic puis collez l'URL ci-dessous."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openMeetNewTab}
                    className="btn btn-sm"
                    style={{ backgroundColor: "#16A34A", color: "#FFF", borderColor: "#16A34A", fontSize: "0.75rem" }}
                  >
                    meet.new ↗
                  </button>
                </div>
              </div>

              {/* Meeting URL */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  {ar ? "رابط الاجتماع (Google Meet / Zoom / Jitsi) *" : "Lien de la réunion (Meet, Zoom, Jitsi) *"}
                </label>
                <input
                  type="url"
                  required
                  className="form-input"
                  value={externalMeetingUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://meet.google.com/xxx-yyyy-zzz"
                />
                <small style={{ color: "#64748B", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: 2 }}>
                  <Lock style={{ width: 12, height: 12 }} />
                  {ar ? "الرابط محمي ومخفي ولن يُكشف للمتعلمين قبل انطلاق البث المباشر." : "Ce lien est confidentiel côté serveur et ne sera accessible aux apprenants qu'au lancement du direct."}
                </small>
              </div>

              {/* Provider & Embed Mode */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "المنصة" : "Plateforme"}
                  </label>
                  <select
                    className="form-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as LiveSessionProvider)}
                  >
                    <option value="GOOGLE_MEET">Google Meet</option>
                    <option value="JITSI">Jitsi Meet</option>
                    <option value="ZOOM">Zoom</option>
                    <option value="MICROSOFT_TEAMS">Microsoft Teams</option>
                    <option value="CUSTOM_EMBED">Autre / Personnalisé</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "طريقة الإدماج" : "Mode d'affichage"}
                  </label>
                  <select
                    className="form-select"
                    value={embedMode}
                    onChange={(e) => setEmbedMode(e.target.value as LiveSessionEmbedMode)}
                  >
                    <option value="PORTAL_LAUNCH">Portail Hub + Pop-out (Meet/Zoom/Teams)</option>
                    <option value="IFRAME_EMBED">Iframe intégrée (Jitsi)</option>
                  </select>
                </div>
              </div>

              {/* Speaker & Replay */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "المحاضر / المتحدث" : "Intervenant / Formateur"}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    placeholder={ar ? "د. أحمد المنصوري" : "Dr. Claire Martin"}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "رابط التسجيل (Replay)" : "Lien Replay (optionnel)"}
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={replayUrl}
                    onChange={(e) => setReplayUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Scope */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  {ar ? "نطاق الحضور" : "Portée de l'événement"}
                </label>
                <div style={{ display: "flex", gap: "1rem", marginTop: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="scope"
                      value="GLOBAL_WEBINAR"
                      checked={scope === "GLOBAL_WEBINAR"}
                      onChange={() => setScope("GLOBAL_WEBINAR")}
                    />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Globe style={{ width: 14, height: 14, color: "#D97706" }} />
                      {ar ? "ندوة عامة لجميع المتعلمين (Webinaire Global)" : "Webinaire global (Tous les apprenants)"}
                    </span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="scope"
                      value="COURSE_SPECIFIC"
                      checked={scope === "COURSE_SPECIFIC"}
                      onChange={() => setScope("COURSE_SPECIFIC")}
                    />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <BookOpen style={{ width: 14, height: 14, color: "#7C3AED" }} />
                      {ar ? "خاص بمسجلين في دورة" : "Réservé aux inscrits d'un cours"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  {ar ? "تصنيف الندوة *" : "Catégorie thématique *"}
                </label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="EDUCATION_INCLUSIVE">{ar ? "التربية الدامجة" : "Éducation inclusive"}</option>
                  <option value="TROUBLES_APPRENTISSAGE">{ar ? "صعوبات التعلم (DYS)" : "Troubles de l'apprentissage (DYS)"}</option>
                  <option value="SANTE_MENTALE">{ar ? "الصحة النفسية والنمو العصبي" : "Santé mentale & Neurodéveloppement"}</option>
                  <option value="PARENTALITE">{ar ? "الوالدية والتربية المشتركة" : "Parentalité & Coéducation"}</option>
                  <option value="PRATIQUE_AVS">{ar ? "الممارسة المهنية لمرافقي الحياة المدرسية والأخصائيين" : "Pratique professionnelle AVS & Spécialistes"}</option>
                </select>
              </div>

              {/* Course Linkage */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  {scope === "COURSE_SPECIFIC"
                    ? (ar ? "اختر الدورة المرتبطة *" : "Formation associée (Obligatoire) *")
                    : (ar ? "ربط بدورة تدريبية (اختياري)" : "Formation associée (Optionnel)")}
                </label>
                <select
                  className="form-select"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required={scope === "COURSE_SPECIFIC"}
                >
                  <option value="">{ar ? "-- لا توجد دورة مرتبطة --" : "-- Aucune formation liée --"}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {ar ? c.titleAr : c.titleFr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Duration */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "تاريخ ووقت الانطلاق" : "Date et heure de début"}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input"
                    value={scheduledStartAt}
                    onChange={(e) => setScheduledStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    {ar ? "المدة (بالدقائق)" : "Durée (minutes)"}
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    required
                    className="form-input"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid #E2E8F0", paddingTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={busy}
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ وبرمجة" : "Créer le direct")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendees Modal */}
      {attendeesModalSession && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "1.25rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#082D55", margin: 0 }}>
                {ar ? "قائمة الحضور:" : "Participants enregistrés :"} {attendeesModalSession.title}
              </h3>
              <button
                type="button"
                onClick={() => setAttendeesModalSession(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center" }}
                aria-label={ar ? "إغلاق" : "Fermer"}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {attendeesModalSession.loading ? (
              <p style={{ color: "#64748B", fontSize: "0.875rem" }}>{ar ? "جارٍ التحميل..." : "Chargement..."}</p>
            ) : attendeesModalSession.attendees.length === 0 ? (
              <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
                {ar ? "لم ينضم أي طالب لهذه الجلسة حتى الآن." : "Aucun participant n'a encore rejoint cette session."}
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {attendeesModalSession.attendees.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "0.625rem",
                      borderRadius: "6px",
                      backgroundColor: "#F8FAFC",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1E293B", display: "block" }}>{a.userName}</strong>
                      <span style={{ color: "#64748B", fontSize: "0.75rem" }}>{a.userEmail}</span>
                    </div>
                    <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>
                      {new Date(a.joinedAt).toLocaleTimeString(ar ? "ar-TN" : "fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sudo Modal for Push Broadcast or Deletion */}
      <AdminSudoModal
        isOpen={sudoOpen}
        locale={locale}
        actionTitle={
          sudoAction?.type === "PUSH_BROADCAST"
            ? (ar ? "تأكيد بث المباشر لجميع الطلاب" : "Confirmation de diffusion Push Globale")
            : (ar ? "تأكيد حذف الجلسة المباشرة" : "Confirmation de suppression de session live")
        }
        actionDescription={
          sudoAction?.type === "PUSH_BROADCAST"
            ? (ar
                ? `أنت على وشك إرسال تنبيه مباشر إلى جميع مستخدمي المنصة لجلسة: ${sudoAction?.sessionTitle}. أدخل كلمة مرورك للتأكيد.`
                : `Vous êtes sur le point de déclencher la bannière d'alerte globale en temps réel pour tous les utilisateurs pour : ${sudoAction?.sessionTitle}. Confirmez avec votre mot de passe administrateur.`)
            : (ar
                ? `حذف الجلسة "${sudoAction?.sessionTitle}" إجراء لا يمكن التراجع عنه. أدخل كلمة مرورك للمتابعة.`
                : `La suppression de "${sudoAction?.sessionTitle}" est irréversible. Confirmez votre mot de passe administrateur pour valider.`)
        }
        onSuccess={() => {
          setSudoOpen(false);
          if (sudoAction?.type === "PUSH_BROADCAST") {
            const sess = sessions.find((s) => s.id === sudoAction.sessionId);
            if (sess) handlePushBroadcast(sess);
          } else if (sudoAction?.type === "DELETE") {
            const sess = sessions.find((s) => s.id === sudoAction.sessionId);
            if (sess) handleDelete(sess);
          }
          setSudoAction(null);
        }}
        onCancel={() => {
          setSudoOpen(false);
          setSudoAction(null);
        }}
      />
    </div>
  );
}
