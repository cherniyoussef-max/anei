import { formatDate } from "@/lib/i18n";
import type { Locale } from "@/types";
import { searchWhatsappMessages } from "@/server/queries/whatsapp";

const STATUS_LABELS: Record<string, { fr: string; ar: string }> = {
  QUEUED: { fr: "En file", ar: "قيد الانتظار" },
  SENT: { fr: "Envoyé", ar: "تم الإرسال" },
  DELIVERED: { fr: "Distribué", ar: "تم التسليم" },
  READ: { fr: "Lu", ar: "تمت القراءة" },
  FAILED: { fr: "Échec", ar: "فشل" },
};

/**
 * WhatsApp message history for a single contact, rendered as a
 * chronological chat thread (inbound/outbound bubbles) rather than a raw
 * table, so an admin can actually follow the conversation at a glance.
 * Read-only by design — the action surface (send/configure) lives on the
 * org WhatsApp page; this section renders the channel's business history
 * without duplicating operational controls.
 */
export async function AdminWhatsAppContactSection({
  organizationId,
  contactId,
  locale,
}: {
  organizationId: string;
  contactId: string;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const { rows } = await searchWhatsappMessages(
    { organizationId, contactId, page: 1, pageSize: 50 },
    { column: "createdAt", direction: "desc" },
  );

  if (!rows.length) {
    return (
      <section className="admin-surface">
        <h3>{ar ? "واتساب" : "WhatsApp"}</h3>
        <p>{ar ? "لا توجد رسائل واتساب لهذه الجهة." : "Aucun message WhatsApp pour ce contact."}</p>
      </section>
    );
  }

  // Oldest first for a natural top-to-bottom conversation reading order —
  // the query itself sorts newest-first for pagination purposes.
  const chronological = [...rows].reverse();

  return (
    <section className="admin-surface">
      <h3>{ar ? "واتساب" : "WhatsApp"}</h3>
      <div className="admin-wa-thread" dir="ltr">
        {chronological.map((row) => {
          const outbound = row.direction === "OUTBOUND";
          const label = STATUS_LABELS[row.status]?.[ar ? "ar" : "fr"] ?? row.status;
          const text = row.templateName
            ? `${ar ? "قالب:" : "Modèle :"} ${row.templateName}`
            : row.textPreview ?? (ar ? "بدون معاينة نصية" : "Sans aperçu texte");
          return (
            <div key={row.id} className={`admin-wa-bubble-row ${outbound ? "is-outbound" : "is-inbound"}`}>
              <div className="admin-wa-bubble">
                <p className="admin-wa-bubble-text" dir="auto">{text}</p>
                <div className="admin-wa-bubble-meta">
                  <span>{label}</span>
                  <span>{formatDate(row.createdAt, locale)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
