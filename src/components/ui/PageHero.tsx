import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <div className="page-hero-orb page-hero-orb-a" aria-hidden="true" />
      <div className="page-hero-orb page-hero-orb-b" aria-hidden="true" />
      <div className="container page-hero-inner">
        <div className="page-hero-copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          {children ? <div className="page-hero-actions">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
