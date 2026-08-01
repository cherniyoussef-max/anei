import type { Locale } from "@/types";

export function AdminPageHeader({ locale, eyebrow, title, description, actions }: {
  locale: Locale; eyebrow: string; title: string; description: string; actions?: React.ReactNode;
}) {
  return <header className="admin-page-header" dir={locale === "ar" ? "rtl" : "ltr"}>
    <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="admin-page-actions">{actions}</div> : null}
  </header>;
}
