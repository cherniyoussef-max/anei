import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { NewsletterForm } from "@/components/interactive/NewsletterForm";
import { env } from "@/server/env";

export function SiteFooter({ locale }: { locale: Locale }) {
  const c = t(locale);
  const ar = locale === "ar";
  return (
    <footer className="site-footer">
      <div className="container footer-intro">
        <div><span className="footer-kicker">ANEI</span><h2>{ar ? "معرفة أوضح، ممارسة أفضل، دمج أكثر واقعية." : "Mieux comprendre, mieux agir, mieux inclure."}</h2></div>
        <Link className="btn btn-light" href={`/${locale}/formations`}>{ar ? "استكشف الدورات" : "Explorer les formations"}<Icon name="arrow" size={17}/></Link>
      </div>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo locale={locale} />
          <p>{ar ? "منصة للتكوين المستمر من أجل تربية ميسّرة وإنسانية قائمة على الكفاءات." : "Une plateforme de formation continue dédiée à une éducation accessible, humaine et fondée sur les compétences."}</p>
          <div className="footer-contact"><Icon name="mail" size={17}/><span>{env.CONTACT_EMAIL}</span></div>
        </div>
        <div className="footer-column"><strong>{ar ? "التعلم" : "Apprendre"}</strong><Link href={`/${locale}/formations`}>{c.nav.courses}</Link><Link href={`/${locale}/webinaires`}>{c.nav.webinars}</Link><Link href={`/${locale}/bibliotheque`}>{c.nav.library}</Link><Link href={`/${locale}/avs`}>{c.nav.avs}</Link></div>
        <div className="footer-column"><strong>{ar ? "الأكاديمية" : "Académie"}</strong><Link href={`/${locale}/about`}>{c.nav.about}</Link><Link href={`/${locale}/actualites`}>{c.nav.news}</Link><Link href={`/${locale}/contact`}>{c.nav.contact}</Link><Link href={`/${locale}/confidentialite`}>{ar ? "الخصوصية" : "Confidentialité"}</Link><Link href={`/${locale}/conditions`}>{ar ? "الشروط" : "Conditions"}</Link></div>
        <div className="footer-newsletter"><strong>{ar ? "ابق على اطلاع" : "Rester informé"}</strong><p>{ar ? "دورات وندوات وموارد جديدة، بدون ضجيج." : "Nouvelles formations, webinaires et ressources — l’essentiel, sans bruit."}</p><NewsletterForm locale={locale}/></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} ANEI</span><span>{ar ? "منصة ثنائية اللغة ومصممة للإتاحة" : "Plateforme bilingue conçue pour l’accessibilité"}</span></div>
    </footer>
  );
}
