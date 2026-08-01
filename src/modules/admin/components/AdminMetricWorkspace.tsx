import { AdminPageHeader } from "./AdminPageHeader";
import type { Locale } from "@/types";

export function AdminMetricWorkspace({ locale, eyebrow, title, description, metrics, note }: {
  locale: Locale; eyebrow: string; title: string; description: string;
  metrics: { label:string; value:string|number }[]; note?:string;
}) {
  return <><AdminPageHeader locale={locale} eyebrow={eyebrow} title={title} description={description}/>
    <section className="admin-kpi-grid">{metrics.map((metric)=><article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</section>
    <section className="admin-surface admin-placeholder-workspace"><h2>{title}</h2><p>{note ?? description}</p></section></>;
}
