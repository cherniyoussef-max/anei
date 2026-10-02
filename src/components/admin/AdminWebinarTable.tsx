"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/i18n";
import { MeetingProviderBadge } from "@/components/ui/MeetingProviderBadge";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { AdminWebinarRegistrationsModal } from "@/components/admin/AdminWebinarRegistrationsModal";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import type { WebinarRow } from "@/server/db/schema";

export function AdminWebinarTable({
  items,
  locale,
  page,
  totalPages,
  q,
}: {
  items: WebinarRow[];
  locale: Locale;
  page: number;
  totalPages: number;
  q?: string;
}) {
  const ar = locale === "ar";
  const [selectedWebinar, setSelectedWebinar] = useState<{ id: string; title: string } | null>(null);

  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/webinars?${next}`;
  };

  return (
    <>
      <div className="admin-table-surface">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "العنوان والمعرف" : "Titre & slug"}</th>
                <th>{ar ? "المنصة" : "Plateforme"}</th>
                <th>{ar ? "المدرب" : "Intervenant"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>
                  <span className="sr-only">{ar ? "إجراءات" : "Actions"}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/${locale}/webinaires/${item.slug}`}
                      target="_blank"
                      style={{ color: "#082d55", fontWeight: 700, textDecoration: "none" }}
                    >
                      {ar ? item.titleAr : item.titleFr} ↗
                    </Link>
                    <br />
                    <small className="mono">{item.slug}</small>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
                      <MeetingProviderBadge provider={item.meetingProvider} locale={locale} />
                      {item.meetingUrl ? (
                        <a
                          href={item.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "0.75rem",
                            color: "#0284c7",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                          }}
                        >
                          <Icon name="link" size={12} />
                          {ar ? "فتح الرابط" : "Ouvrir le lien"}
                        </a>
                      ) : (
                        <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                          {ar ? "بدون رابط" : "Aucun lien"}
                        </small>
                      )}
                    </div>
                  </td>
                  <td>{item.trainerName}</td>
                  <td>{formatDate(item.startsAt, locale)}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: item.published ? "rgba(22, 163, 74, 0.1)" : "rgba(100, 116, 139, 0.1)",
                        color: item.published ? "#15803d" : "#475569",
                      }}
                    >
                      {item.published ? (ar ? "منشور" : "Publié") : (ar ? "مؤرشف" : "Archivé")}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedWebinar({
                            id: item.id,
                            title: ar ? item.titleAr : item.titleFr,
                          })
                        }
                        className="btn btn-secondary"
                        style={{
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.75rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          backgroundColor: "#082d55",
                          color: "#ffffff",
                          borderColor: "#082d55",
                        }}
                      >
                        <Icon name="users" size={13} />
                        {ar ? "المشاركون والاستمارات" : "Inscriptions & Réponses"}
                      </button>

                      <Link
                        href={`/${locale}/webinaires/${item.slug}`}
                        target="_blank"
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        {ar ? "معاينة" : "Voir"}
                      </Link>

                      {item.published ? (
                        <AdminDeleteButton
                          locale={locale}
                          endpoint={`/api/admin/webinars/${item.id}`}
                          confirmMessage={ar ? "هل تريد أرشفة هذه الندوة؟" : "Archiver ce webinaire ?"}
                          label={ar ? "أرشفة" : "Archiver"}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!items.length ? (
          <div className="admin-empty-state">
            <strong>{ar ? "لا توجد ندوات بعد" : "Aucun webinaire pour le moment"}</strong>
          </div>
        ) : null}

        <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
          <Link
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            href={href(Math.max(1, page - 1))}
          >
            {ar ? "السابق" : "Précédent"}
          </Link>
          <span>{ar ? `صفحة ${page} من ${totalPages}` : `Page ${page} sur ${totalPages}`}</span>
          <Link
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            href={href(Math.min(totalPages, page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </div>

      {selectedWebinar ? (
        <AdminWebinarRegistrationsModal
          webinarId={selectedWebinar.id}
          webinarTitle={selectedWebinar.title}
          locale={locale}
          isOpen={Boolean(selectedWebinar)}
          onClose={() => setSelectedWebinar(null)}
        />
      ) : null}
    </>
  );
}
