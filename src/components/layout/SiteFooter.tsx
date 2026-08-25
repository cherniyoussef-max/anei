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
  const en = locale === "en";
  return (
    <footer className="site-footer v5-site-footer">
      <div className="v5-container footer-grid">
        <div className="footer-brand">
          <Logo locale={locale} />
          <p>{ar ? "تكوين مهني وموارد ومرافقة من أجل تربية دامجة قابلة للتطبيق." : en ? "Professional learning, resources and support for inclusive education in practice." : "Formations, ressources et accompagnement pour une éducation inclusive mise en pratique."}</p>
          <div className="footer-contact"><Icon name="mail" size={17}/><span>{env.CONTACT_EMAIL}</span></div>
          {env.SOCIAL_LINKEDIN_URL || env.SOCIAL_FACEBOOK_URL || env.SOCIAL_INSTAGRAM_URL ? (
            <div className="footer-social">
              {env.SOCIAL_LINKEDIN_URL ? <a href={env.SOCIAL_LINKEDIN_URL} target="_blank" rel="noreferrer" aria-label="LinkedIn"><Icon name="linkedin" size={18}/></a> : null}
              {env.SOCIAL_FACEBOOK_URL ? <a href={env.SOCIAL_FACEBOOK_URL} target="_blank" rel="noreferrer" aria-label="Facebook"><Icon name="facebook" size={18}/></a> : null}
              {env.SOCIAL_INSTAGRAM_URL ? <a href={env.SOCIAL_INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram"><Icon name="instagram" size={18}/></a> : null}
            </div>
          ) : null}
        </div>
        <div className="footer-column"><strong>{ar ? "التعلم" : en ? "Learning" : "Apprendre"}</strong><Link href={`/${locale}/formations`}>{c.nav.courses}</Link><Link href={`/${locale}/webinaires`}>{c.nav.webinars}</Link><Link href={`/${locale}/bibliotheque`}>{c.nav.library}</Link><Link href={`/${locale}/avs`}>{c.nav.avs}</Link></div>
        <div className="footer-column"><strong>{ar ? "الأكاديمية" : en ? "Academy" : "Académie"}</strong><Link href={`/${locale}/about`}>{c.nav.about}</Link><Link href={`/${locale}/actualites`}>{c.nav.news}</Link><Link href={`/${locale}/contact`}>{c.nav.contact}</Link><Link href={`/${locale}/confidentialite`}>{ar ? "الخصوصية" : en ? "Privacy" : "Confidentialité"}</Link><Link href={`/${locale}/conditions`}>{ar ? "الشروط" : en ? "Terms" : "Conditions"}</Link></div>
        <div className="footer-newsletter"><strong>{ar ? "ابق على اطلاع" : en ? "Stay informed" : "Rester informé"}</strong><p>{ar ? "دورات وندوات وموارد جديدة، في رسالة موجزة." : en ? "New courses, webinars and resources in one concise email." : "Nouvelles formations, webinaires et ressources dans un message concis."}</p><NewsletterForm locale={locale}/></div>
      </div>
      <div className="v5-container footer-bottom"><span>© {new Date().getFullYear()} ANEI</span><span>{ar ? "تجربة ثنائية اللغة مصممة للإتاحة" : en ? "A bilingual experience designed for accessibility" : "Une expérience bilingue conçue pour l’accessibilité"}</span></div>
    </footer>
  );
}
