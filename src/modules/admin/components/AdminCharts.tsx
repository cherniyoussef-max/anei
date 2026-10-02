import type { Locale } from "@/types";

export function TrendChart({ points, locale }: { points: { date: Date; users: number; enrollments: number }[]; locale: Locale }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.users, p.enrollments]));
  const totalUsers = points.reduce((sum, p) => sum + p.users, 0);
  const totalEnrollments = points.reduce((sum, p) => sum + p.enrollments, 0);
  const ar = locale === "ar";
  const numFmt = new Intl.NumberFormat(ar ? "ar-TN" : "fr-FR");
  const startDate = points.length > 0 ? new Date(points[0].date) : null;
  const endDate = points.length > 0 ? new Date(points[points.length - 1].date) : null;
  const dateFmt = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { month: "short", day: "numeric" });

  return (
    <div className="admin-trend-chart" role="img" aria-label={ar ? "تطور المستخدمين والتسجيلات خلال الفترة" : "Évolution des utilisateurs et inscriptions sur la période"}>
      <div className="chart-legend">
        <span className="legend-item">
          <i className="legend-users" />
          <span>{ar ? "مستخدمون جدد" : "Nouveaux utilisateurs"}</span>
          <b className="legend-count">({numFmt.format(totalUsers)})</b>
        </span>
        <span className="legend-item">
          <i className="legend-enrollments" />
          <span>{ar ? "تسجيلات" : "Inscriptions"}</span>
          <b className="legend-count">({numFmt.format(totalEnrollments)})</b>
        </span>
      </div>
      <div className="chart-bars">
        {points.map((point) => (
          <div
            className="chart-day"
            key={String(point.date)}
            title={`${new Date(point.date).toLocaleDateString(ar ? "ar-TN" : "fr-FR")}: ${numFmt.format(point.users)} ${ar ? "مستخدمين" : "utilisateurs"} / ${numFmt.format(point.enrollments)} ${ar ? "تسجيلات" : "inscriptions"}`}
          >
            <span className="bar-users" style={{ height: `${Math.max(3, (point.users / max) * 100)}%` }} />
            <span className="bar-enrollments" style={{ height: `${Math.max(3, (point.enrollments / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      {startDate && endDate ? (
        <div className="chart-axis-dates">
          <span>{dateFmt.format(startDate)}</span>
          <span>{dateFmt.format(endDate)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Distribution({ rows, locale, empty }: { rows: { label: string; value: number; id?: string }[]; locale: Locale; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const ar = locale === "ar";
  const numFmt = new Intl.NumberFormat(ar ? "ar-TN" : "fr-FR");

  if (!rows.length) return <p className="admin-empty">{empty}</p>;
  return (
    <div className="admin-distribution">
      {rows.map((row, index) => {
        const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.id ?? `${row.label}-${index}`}>
            <div className="admin-distribution-meta">
              <span className="admin-distribution-label">{row.label}</span>
              <div className="admin-distribution-values">
                <span className="admin-distribution-pct">{pct}%</span>
                <strong>{numFmt.format(row.value)}</strong>
              </div>
            </div>
            <span className="distribution-track">
              <i style={{ inlineSize: `${Math.max(2, (row.value / max) * 100)}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
