import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";

export function HomeHero({ locale }: { locale: Locale }) {
  const c = t(locale);
  const ar = locale === "ar";
  return (
    <section className="public-hero">
      <div className="container public-hero-grid">
        <div className="hero-copy">
          <h1>{ar ? "نحو ممارسات أكثر دقة وإنسانية." : "Faire de l’inclusion une compétence concrète."}</h1>
          <p>{ar ? "تعلّموا، تعاونوا، وحوّلوا المعرفة إلى ممارسات دامجة." : "Apprendre, coopérer et transformer les connaissances en pratiques inclusives."}</p>

          <form className="hero-search" action={`/${locale}/formations`} method="get" role="search">
            <Icon name="search" size={20}/>
            <input name="q" maxLength={100} aria-label={ar ? "البحث في الدورات" : "Rechercher une formation"} placeholder={ar ? "ابحث عن مهارة، موضوع أو مسار..." : "Rechercher une compétence, un sujet, un parcours..."}/>
            <button className="btn btn-primary" type="submit">{ar ? "بحث" : "Rechercher"}</button>
          </form>

          <div className="hero-actions public-hero-actions">
            <Link className="btn btn-primary btn-lg" href={`/${locale}/formations`}>{c.actions.discover}<Icon name="arrow" size={19}/></Link>
            <Link className="btn btn-ghost btn-lg" href={`/${locale}/dashboard`}><Icon name="play" size={19}/>{ar ? "متابعة تعلّمي" : "Continuer mon apprentissage"}</Link>
          </div>

        </div>

        <figure className="public-hero-figure">
          <div className="public-hero-photo">
            <Image src="/media/anei-hero-learning-v2.webp" alt={ar ? "مربّون يتعاونون حول مواد تعليمية في فضاء للتكوين" : "Équipe éducative collaborant autour de supports pédagogiques en formation"} width={1200} height={900} priority sizes="(max-width: 900px) 100vw, 46vw" />
          </div>
        </figure>
      </div>
    </section>
  );
}
