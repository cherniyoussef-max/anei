import type { Locale } from "@/types";

export function TrendChart({ points, locale }: { points: { date: Date; users: number; enrollments: number }[]; locale: Locale }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.users, p.enrollments]));
  return <div className="admin-trend-chart" role="img" aria-label={locale === "ar" ? "تطور المستخدمين والتسجيلات خلال الفترة" : "Évolution des utilisateurs et inscriptions sur la période"}>
    <div className="chart-legend"><span><i className="legend-users"/> {locale === "ar" ? "مستخدمون جدد" : "Nouveaux utilisateurs"}</span><span><i className="legend-enrollments"/> {locale === "ar" ? "تسجيلات" : "Inscriptions"}</span></div>
    <div className="chart-bars">{points.map((point) => <div className="chart-day" key={String(point.date)} title={`${new Date(point.date).toLocaleDateString()}: ${point.users} / ${point.enrollments}`}>
      <span className="bar-users" style={{ height: `${Math.max(2, point.users / max * 100)}%` }}/><span className="bar-enrollments" style={{ height: `${Math.max(2, point.enrollments / max * 100)}%` }}/>
    </div>)}</div>
  </div>;
}

export function Distribution({ rows, locale, empty }: { rows: { label: string; value: number; id?: string }[]; locale: Locale; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="admin-empty">{empty}</p>;
  return <div className="admin-distribution">{rows.map((row, index) => <div key={row.id ?? `${row.label}-${index}`}>
    <div><span>{row.label}</span><strong>{new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-FR").format(row.value)}</strong></div>
    <span className="distribution-track"><i style={{ inlineSize: `${row.value / max * 100}%` }}/></span>
  </div>)}</div>;
}
