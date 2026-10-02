"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

interface RegistrationItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userProfileType: string | null;
  status: string;
  answers: Record<string, string> | null;
  accessCode: string | null;
  joinedAt: string | Date | null;
  registeredAt: string | Date;
}

interface WebinarAdminData {
  webinar: {
    id: string;
    titleFr: string;
    titleAr: string;
    meetingProvider: string;
    startsAt: string | Date;
    requireApproval: boolean;
  };
  registrations: RegistrationItem[];
  stats: {
    total: number;
    attended: number;
    pending: number;
    accepted: number;
    members: number;
  };
}

export function AdminWebinarRegistrationsModal({
  webinarId,
  webinarTitle,
  locale,
  isOpen,
  onClose,
}: {
  webinarId: string;
  webinarTitle: string;
  locale: Locale;
  isOpen: boolean;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const [data, setData] = useState<WebinarAdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !webinarId) return;
    let active = true;
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/webinars/${webinarId}/registrations`);
        const d = await res.json();
        if (active) {
          setData(d);
        }
      } catch {
        // ignore
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [isOpen, webinarId]);

  if (!isOpen) return null;

  async function handleApprove(regId: string) {
    setActionLoading(regId);
    try {
      const res = await fetch(`/api/admin/webinars/${webinarId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", registrationId: regId, locale }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              pending: Math.max(0, prev.stats.pending - 1),
              accepted: prev.stats.accepted + 1,
            },
            registrations: prev.registrations.map((r) =>
              r.id === regId ? { ...r, status: "ACCEPTED", accessCode: updated.accessCode } : r
            ),
          };
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(regId: string) {
    setActionLoading(regId);
    try {
      const res = await fetch(`/api/admin/webinars/${webinarId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", registrationId: regId, locale }),
      });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              pending: Math.max(0, prev.stats.pending - 1),
            },
            registrations: prev.registrations.map((r) =>
              r.id === regId ? { ...r, status: "REJECTED" } : r
            ),
          };
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveAll() {
    setActionLoading("all");
    try {
      const res = await fetch(`/api/admin/webinars/${webinarId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_all", locale }),
      });
      if (res.ok) {
        // Refresh list
        const refreshed = await fetch(`/api/admin/webinars/${webinarId}/registrations`).then((r) => r.json());
        setData(refreshed);
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(8, 45, 85, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#00796B" }}>
              {ar ? "إدارة المشاركين واستمارات التسجيل" : "Gestion des inscriptions & formulaires"}
            </span>
            <h3 style={{ margin: "0.2rem 0 0", color: "#082d55", fontSize: "1.2rem", fontWeight: 800 }}>
              {webinarTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.25rem", color: "#64748b", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {/* Stats Row */}
        {data ? (
          <div
            style={{
              padding: "1rem 1.75rem",
              background: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>
                  {ar ? "إجمالي المسجلين" : "Total inscrits"}
                </span>
                <strong style={{ fontSize: "1.25rem", color: "#082d55" }}>{data.stats.total}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#b45309", display: "block" }}>
                  {ar ? "قيد المراجعة" : "En attente"}
                </span>
                <strong style={{ fontSize: "1.25rem", color: "#d97706" }}>{data.stats.pending}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#166534", display: "block" }}>
                  {ar ? "المقبولين (مع الرمز)" : "Validés (avec code)"}
                </span>
                <strong style={{ fontSize: "1.25rem", color: "#16a34a" }}>{data.stats.accepted}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#0369a1", display: "block" }}>
                  {ar ? "حضروا الجلسة" : "Présents au direct"}
                </span>
                <strong style={{ fontSize: "1.25rem", color: "#0284c7" }}>{data.stats.attended}</strong>
              </div>
            </div>

            {data.stats.pending > 0 ? (
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={actionLoading === "all"}
                className="btn btn-primary"
                style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
              >
                {actionLoading === "all"
                  ? (ar ? "جارٍ إرسال الرموز..." : "Envoi des codes...")
                  : (ar ? `قبول الكل (${data.stats.pending}) وإرسال الرموز` : `Valider tous (${data.stats.pending}) & envoyer les codes`)}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Registrations List Content */}
        <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#64748b" }}>
              {ar ? "جارٍ تحميل بيانات المشاركين..." : "Chargement des inscriptions..."}
            </div>
          ) : !data || data.registrations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#64748b" }}>
              <Icon name="users" size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
              <p>{ar ? "لا توجد تسجيلات بعد في هذه الندوة." : "Aucune inscription enregistrée pour le moment."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {data.registrations.map((r) => {
                const isPending = r.status === "PENDING_APPROVAL";
                const isAttended = r.status === "ATTENDED";
                const isRejected = r.status === "REJECTED";
                const isCancelled = r.status === "CANCELLED";
                const answersList = r.answers ? Object.entries(r.answers) : [];

                return (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.75rem",
                      padding: "1rem 1.25rem",
                      background: isPending ? "#fffdf5" : isRejected ? "#fef2f2" : "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ color: "#082d55", fontSize: "1rem" }}>
                            {r.userName || "Participant sans nom"}
                          </strong>
                          {r.userProfileType ? (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "9999px",
                                background: "#e0e7ff",
                                color: "#3730a3",
                                fontWeight: 600,
                              }}
                            >
                              {r.userProfileType}
                            </span>
                          ) : null}
                        </div>
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{r.userEmail}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.25rem 0.65rem",
                            borderRadius: "9999px",
                            background: isPending
                              ? "rgba(245, 158, 11, 0.15)"
                              : isAttended
                              ? "rgba(2, 132, 199, 0.15)"
                              : isRejected
                              ? "rgba(239, 68, 68, 0.15)"
                              : isCancelled
                              ? "rgba(100, 116, 139, 0.15)"
                              : "rgba(22, 163, 74, 0.15)",
                            color: isPending
                              ? "#b45309"
                              : isAttended
                              ? "#0284c7"
                              : isRejected
                              ? "#b91c1c"
                              : isCancelled
                              ? "#475569"
                              : "#15803d",
                          }}
                        >
                          {isPending
                            ? (ar ? "قيد المراجعة ⏳" : "En attente ⏳")
                            : isAttended
                            ? (ar ? "حضر الجلسة ✓" : "Présent au direct ✓")
                            : isRejected
                            ? (ar ? "مرفوض ✕" : "Refusé ✕")
                            : isCancelled
                            ? (ar ? "ملغى ✕" : "Annulé ✕")
                            : (ar ? "مقبول ✓" : "Validé ✓")}
                        </span>

                        {r.accessCode ? (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.5rem",
                              background: "#f1f5f9",
                              borderRadius: "4px",
                              border: "1px solid #cbd5e1",
                            }}
                            title="Code d'accès unique"
                          >
                            {r.accessCode}
                          </span>
                        ) : null}

                        {isPending ? (
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              type="button"
                              onClick={() => handleApprove(r.id)}
                              disabled={actionLoading === r.id}
                              className="btn btn-primary"
                              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                            >
                              {actionLoading === r.id
                                ? (ar ? "جارٍ الإرسال..." : "Validation...")
                                : (ar ? "قبول وإرسال الرمز" : "Valider & envoyer code")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(r.id)}
                              disabled={actionLoading === r.id}
                              style={{
                                fontSize: "0.8rem",
                                padding: "0.35rem 0.65rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #fca5a5",
                                background: "#fff",
                                color: "#b91c1c",
                                cursor: actionLoading === r.id ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {ar ? "رفض" : "Refuser"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Answers Breakdown */}
                    {answersList.length > 0 ? (
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                          fontSize: "0.825rem",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "0.5rem",
                        }}
                      >
                        {answersList.map(([k, v]) => (
                          <div key={k}>
                            <span style={{ color: "#64748b", textTransform: "capitalize", display: "block" }}>
                              {k} :
                            </span>
                            <strong style={{ color: "#1e293b" }}>{v || "—"}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <small style={{ color: "#94a3b8", fontSize: "0.775rem" }}>
                        {ar ? "لا توجد إجابات استمارة مرفقة." : "Aucune réponse de formulaire renseignée."}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
