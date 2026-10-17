import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: ReactNode;
}) {
  return (
    <section className="subpage-hero-root">
      <div className="subpage-hero-watermark" aria-hidden="true">
        <Image
          src="/brand/watermark-master-duo.webp"
          alt=""
          width={360}
          height={360}
          className="subpage-watermark-img"
          priority={false}
        />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 subpage-hero-container">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="subpage-hero-breadcrumbs">
            <ol className="flex items-center gap-2 text-xs text-slate-500 mb-3.5">
              {breadcrumbs.map((crumb, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-slate-300 text-[11px]" aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-[#142B47] transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#142B47] font-semibold">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="subpage-hero-copy">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2.5 mb-3.5">
              <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-[#B58D3D]">{eyebrow}</span>
            </div>
          ) : null}
          <h1 className="text-4xl sm:text-5xl font-sans font-bold tracking-[-0.025em] text-slate-900 leading-[1.15] max-w-2xl">
            {title}
          </h1>
          {description ? (
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mt-4 font-normal">
              {description}
            </p>
          ) : null}
          {children ? <div className="subpage-hero-actions mt-6 flex items-center gap-3.5 flex-wrap">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

