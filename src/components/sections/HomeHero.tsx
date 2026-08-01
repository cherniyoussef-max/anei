import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";

export function HomeHero({ locale, avsCount }: { locale: Locale; avsCount: number }) {
  const c = t(locale);
  const ar = locale === "ar";
  return (
    <section className="hero-section hero-human">
      <div className="container hero-grid hero-grid-human">
        <div className="hero-copy">
          <div className="hero-badge"><span className="pulse-dot" />{ar ? "تكوين مهني في التربية الدامجة" : "Formation professionnelle en éducation inclusive"}</div>
          <h1>{ar ? <>التربية الدامجة تبدأ بـ <span>ممارسات أفضل.</span></> : <>Faire de l’inclusion une <span>compétence concrète.</span></>}</h1>
          <p>{ar ? "منصة مهنية ثنائية اللغة تساعد المدرسين والمرافقين والأخصائيين والأسر على التعلم والتعاون وتطبيق ممارسات أكثر دقة وإنسانية." : "Une plateforme bilingue pour aider enseignants, AVS, spécialistes et familles à se former, coopérer et transformer les connaissances en pratiques plus justes et plus humaines."}</p>

          <form className="hero-search" action={`/${locale}/formations`} method="get" role="search">
            <Icon name="search" size={20}/>
            <input name="q" maxLength={100} aria-label={ar ? "البحث في الدورات" : "Rechercher une formation"} placeholder={ar ? "ابحث عن مهارة، موضوع أو مسار..." : "Rechercher une compétence, un sujet, un parcours..."}/>
            <button className="btn btn-primary" type="submit">{ar ? "بحث" : "Rechercher"}</button>
          </form>

          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" href={`/${locale}/formations`}>{c.actions.discover}<Icon name="arrow" size={19}/></Link>
            <Link className="btn btn-ghost btn-lg" href={`/${locale}/dashboard`}><Icon name="play" size={19}/>{ar ? "متابعة تعلّمي" : "Continuer mon apprentissage"}</Link>
          </div>

          <div className="hero-proof-row" aria-label={ar ? "مزايا المنصة" : "Points forts de la plateforme"}>
            <span><Icon name="award" size={17}/>{ar ? "شهادات قابلة للتحقق" : "Certificats vérifiables"}</span>
            <span><Icon name="users" size={17}/>{avsCount} {ar ? "ملف AVS معتمد" : "profils AVS certifiés"}</span>
            <span><Icon name="globe" size={17}/>FR · العربية</span>
          </div>
        </div>

        <div className="hero-photo-stage" aria-label={ar ? "تجربة تعلم رقمية مهنية" : "Expérience de formation professionnelle en ligne"}>
          <div className="hero-photo-frame">
            <Image src="/media/anei-hero-learning.webp" alt={ar ? "متعلم يتابع تكوينًا مهنيًا عبر الحاسوب" : "Apprenant suivant une formation professionnelle sur ordinateur"} fill priority sizes="(max-width: 900px) 100vw, 46vw" />
            <div className="hero-photo-shade" aria-hidden="true"/>
            <div className="hero-photo-caption"><span>{ar ? "تعلّم مرن" : "Apprentissage flexible"}</span><strong>{ar ? "من النظرية إلى الممارسة" : "De la théorie à la pratique"}</strong></div>
          </div>
          <div className="hero-floating-proof proof-top"><span className="floating-icon"><Icon name="award" size={18}/></span><div><strong>{ar ? "مسارات مهنية" : "Parcours professionnels"}</strong><small>{ar ? "تقدم واضح وشهادة" : "Progression claire & certificat"}</small></div></div>
          <div className="hero-floating-proof proof-bottom"><span className="floating-icon blue"><Icon name="calendar" size={18}/></span><div><strong>{ar ? "حي + عند الطلب" : "Live + à la demande"}</strong><small>{ar ? "ندوات وإعادات" : "Webinaires & replays"}</small></div></div>
        </div>
      </div>
    </section>
  );
}
