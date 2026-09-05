import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listAdminAvailabilityRules } from "@/server/services/learner-appointments";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAvailabilityForm } from "@/components/admin/AdminAvailabilityForm";
import { AdminAvailabilityCancelButton } from "@/components/admin/AdminAvailabilityCancelButton";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS: Record<number, { fr: string; ar: string }> = {
  0: { fr: "Dimanche", ar: "الأحد" }, 1: { fr: "Lundi", ar: "الإثنين" }, 2: { fr: "Mardi", ar: "الثلاثاء" },
  3: { fr: "Mercredi", ar: "الأربعاء" }, 4: { fr: "Jeudi", ar: "الخميس" }, 5: { fr: "Vendredi", ar: "الجمعة" }, 6: { fr: "Samedi", ar: "السبت" },
};

function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export default async function AdminAvailabilitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireAdminPermission(locale, "availability.manage");
  const ar = locale === "ar";
  const rules = await listAdminAvailabilityRules(session.user.id);
  const timeFormatter = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });

  return <>
    <AdminPageHeader
      locale={locale}
      eyebrow={ar ? "المواعيد" : "Rendez-vous"}
      title={ar ? "إدارة الفتحات المتاحة" : "Gestion des disponibilités"}
      description={ar ? "أنشئ فتحات فردية أو جماعية، مرة واحدة أو أسبوعيًا متكررة." : "Créez des créneaux individuels ou de groupe, ponctuels ou récurrents chaque semaine."}
    />

    <section className="admin-surface">
      <h2>{ar ? "إنشاء فتحات جديدة" : "Créer de nouveaux créneaux"}</h2>
      <AdminAvailabilityForm locale={locale} />
    </section>

    <section className="admin-surface">
      <h2>{ar ? "الفتحات الحالية" : "Créneaux actifs"}</h2>
      {rules.length ? <div className="admin-table-surface"><div className="admin-table-scroll"><table className="admin-data-table">
        <thead><tr>
          <th>{ar ? "التكرار" : "Récurrence"}</th>
          <th>{ar ? "التوقيت" : "Horaire"}</th>
          <th>{ar ? "النوع" : "Type"}</th>
          <th>{ar ? "القادمة (14 يومًا)" : "Prochaines occurrences (14 j)"}</th>
          <th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th>
        </tr></thead>
        <tbody>{rules.map((rule) => <tr key={rule.id}>
          <td>{rule.weekday !== null ? (ar ? `كل ${WEEKDAY_LABELS[rule.weekday].ar}` : `Chaque ${WEEKDAY_LABELS[rule.weekday].fr}`) : rule.specificDate}</td>
          <td dir="ltr">{minuteLabel(rule.startMinute)}–{minuteLabel(rule.endMinute)} · {rule.durationMinutes} min</td>
          <td>{rule.sessionType === "GROUP" ? (ar ? `جماعي (${rule.capacity})` : `Groupe (${rule.capacity})`) : (ar ? "فردي" : "Individuel")}</td>
          <td>{rule.instances.length ? <ul className="admin-availability-instances">{rule.instances.slice(0, 6).map((instance) => <li key={instance.startAt}>
            <span>{timeFormatter.format(new Date(instance.startAt))}</span>
            <strong>{rule.sessionType === "GROUP" ? `${instance.bookedCount}/${rule.capacity}` : instance.bookedCount ? (ar ? "محجوز" : "réservé") : (ar ? "متاح" : "libre")}</strong>
          </li>)}</ul> : <small>{ar ? "لا توجد فتحات قادمة" : "Aucune occurrence à venir"}</small>}</td>
          <td><AdminAvailabilityCancelButton locale={locale} id={rule.id} /></td>
        </tr>)}</tbody>
      </table></div></div> : <div className="admin-empty-state"><strong>{ar ? "لا توجد فتحات بعد" : "Aucun créneau pour le moment"}</strong></div>}
    </section>
  </>;
}
