import { formatDate } from "@/lib/i18n";
import type { Locale } from "@/types";
import { searchWhatsappMessages } from "@/server/queries/whatsapp";

/**
 * WhatsApp message history for a single contact. Read-only by design — the
 * action surface (send/configure) lives on the org WhatsApp page; this section
 * renders the channel's business history without duplicating operational
 * controls.
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
    { organizationId, contactId, page: 1, pageSize: 25 },
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

  return (
    <section className="admin-surface">
      <h3>{ar ? "واتساب" : "WhatsApp"}</h3>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>{ar ? "الاتجاه" : "Direction"}</th>
              <th>{ar ? "النوع" : "Type"}</th>
              <th>{ar ? "الحالة" : "Statut"}</th>
              <th>{ar ? "القالب / النص" : "Modèle / texte"}</th>
              <th>{ar ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.direction}</td>
                <td>{row.messageType}</td>
                <td>{row.status}</td>
                <td>{row.templateName ?? (row.textPreview ? (row.textPreview.length > 60 ? `${row.textPreview.slice(0, 60)}…` : row.textPreview) : "—")}</td>
                <td>{formatDate(row.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}