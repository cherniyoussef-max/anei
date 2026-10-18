import Link from "next/link";
import Image from "next/image";
import {
  Linkedin,
  Facebook,
  Youtube,
  Mail,
  Clock,
} from "lucide-react";
import type { Locale } from "@/types";
import { env } from "@/server/env";

export function SiteFooter({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const en = locale === "en";


  const platformLinks = [
    { href: `/${locale}`, label: ar ? "الرئيسية" : en ? "Home" : "Accueil" },
    { href: `/${locale}/formations`, label: ar ? "التكوين والمصادقة" : en ? "Certifying Courses" : "Formations certifiantes" },
    { href: `/${locale}/bibliotheque`, label: ar ? "المكتبة الرقمية" : en ? "Resource Library" : "Bibliothèque de ressources" },
    { href: `/${locale}/avs`, label: ar ? "دليل مرافقي AVS" : en ? "AVS Directory" : "Annuaire des AVS" },
    { href: `/${locale}/specialistes`, label: ar ? "دليل الأخصائيين المعتمدين" : en ? "Specialists Directory" : "Annuaire des Spécialistes" },
  ];

  const accompanimentLinks = [
    { href: `/${locale}/webinaires`, label: ar ? "الندوات واللقاءات المباشرة" : en ? "Webinars & Live" : "Webinaires & Directs" },
    { href: `/${locale}/actualites`, label: ar ? "الأخبار والمقالات الميدانية" : en ? "News & Articles" : "Actualités & Dossiers" },
    { href: `/${locale}/contact`, label: ar ? "التواصل المؤسساتي" : en ? "Institutional Contact" : "Contact institutionnel" },
    { href: `/${locale}/connexion`, label: ar ? "فضاء المتعلم والمدرب" : en ? "Learner Portal" : "Espace d'apprentissage" },
  ];

  const legalLinks = [
    { href: `/${locale}/conditions`, label: ar ? "إشعار قانوني والشروط" : en ? "Legal Terms" : "Mentions légales" },
    { href: `/${locale}/confidentialite`, label: ar ? "سياسة الخصوصية" : en ? "Privacy Policy" : "Confidentialité" },
    { href: `/${locale}`, label: ar ? "سهولة الوصول WCAG" : en ? "Accessibility" : "Accessibilité" },
    { href: `/${locale}`, label: ar ? "خريطة الموقع" : en ? "Site map" : "Plan du site" },
  ];

  return (
    <footer className="footer-root v5-site-footer" role="contentinfo">

      {/* =====================================================================
          ÉTAGE 2 : CORPS DU FOOTER SOMBRE (NAVY BLEU #173B5D)
          ===================================================================== */}
      <div className="bg-[#173b5d] text-slate-200 py-14 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
            {/* Colonne 1 : Identité & Mission */}
            <div className="lg:col-span-5 flex flex-col items-start pe-lg-6">
              <Link
                href={`/${locale}`}
                className="footer-crest inline-flex items-center gap-3.5 group hover:opacity-95 transition-opacity"
                aria-label={ar ? "الرئيسية ANEI" : "Accueil ANEI"}
              >
                <Image
                  src="/brand/anei-mark-white-wing.webp?v=white"
                  alt={ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}
                  width={56}
                  height={32}
                  className="h-8 sm:h-9 w-auto object-contain shrink-0"
                  unoptimized
                />
                <div className="flex flex-col">
                  <span className="font-bold text-white text-[15px] sm:text-[16px] leading-snug font-sans tracking-tight">
                    الأكاديمية الوطنية للتربية الدامجة
                  </span>
                  <span className="text-[11px] sm:text-[12px] font-normal text-white/90 leading-tight mt-0.5">
                    L&apos;Académie Nationale de l&apos;Éducation Inclusive
                  </span>
                </div>
              </Link>

              <p className="mt-5 text-sm leading-[1.7] rtl:leading-[1.85] text-slate-300 max-w-md font-normal">
                {ar
                  ? "المنصة الأولى للتميز المتخصصة في التكوين والموارد ومرافقة المهنيين والأسر من أجل تربية دامجة وعادلة في تونس."
                  : "Première plateforme d'excellence dédiée à la formation, aux ressources et à l'accompagnement des professionnels et familles pour une éducation inclusive en Tunisie."}
              </p>
            </div>

            {/* Colonne 2 : Plateforme */}
            <div className="lg:col-span-2 flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C5A059] mb-4">
                {ar ? "المنصة" : en ? "Platform" : "Plateforme"}
              </span>
              <ul className="space-y-2.5">
                {platformLinks.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      href={item.href}
                      className="text-sm text-slate-300 hover:text-white transition-colors duration-150 inline-flex items-center gap-1 group"
                    >
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne 3 : Accompagnement */}
            <div className="lg:col-span-2 flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C5A059] mb-4">
                {ar ? "المرافقة" : en ? "Services" : "Accompagnement"}
              </span>
              <ul className="space-y-2.5">
                {accompanimentLinks.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      href={item.href}
                      className="text-sm text-slate-300 hover:text-white transition-colors duration-150 inline-flex items-center gap-1 group"
                    >
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne 4 : Contact & Réseaux Sociaux */}
            <div className="lg:col-span-3 flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C5A059] mb-4">
                {ar ? "التواصل" : en ? "Contact" : "Contact & Réseaux"}
              </span>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-[#C5A059] shrink-0" />
                  <a
                    href="mailto:contact@anei.tn"
                    className="hover:text-white transition-colors underline-offset-4 hover:underline"
                  >
                    contact@anei.tn
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock size={16} className="text-[#C5A059] shrink-0" />
                  <span>
                    {ar ? "الإثنين - الجمعة · 08:30 - 17:30" : "Lun - Ven · 08:30 - 17:30"}
                  </span>
                </div>
              </div>

              {/* Réseaux sociaux */}
              <div className="mt-6">
                <span className="text-xs font-medium text-slate-400 block mb-2.5">
                  {ar ? "تابعونا على شبكاتنا" : "Suivez-nous sur les réseaux"}
                </span>
                <div className="flex items-center gap-2.5">
                  <a
                    href={env.SOCIAL_LINKEDIN_URL || "https://linkedin.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-full bg-white/[0.08] hover:bg-[#0056D2] text-slate-200 hover:text-white flex items-center justify-center transition-all duration-200 border border-white/10"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href={env.SOCIAL_FACEBOOK_URL || "https://facebook.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-full bg-white/[0.08] hover:bg-[#0056D2] text-slate-200 hover:text-white flex items-center justify-center transition-all duration-200 border border-white/10"
                    aria-label="Facebook"
                  >
                    <Facebook size={16} />
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-full bg-white/[0.08] hover:bg-[#0056D2] text-slate-200 hover:text-white flex items-center justify-center transition-all duration-200 border border-white/10"
                    aria-label="YouTube"
                  >
                    <Youtube size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          ÉTAGE 3 : BARRE LÉGALE INFÉRIEURE (COPYRIGHT & LIENS LÉGAUX)
          ===================================================================== */}
      <div className="bg-[#0f2842] border-t border-white/[0.08] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>
            {ar
              ? `© ${new Date().getFullYear()} الأكاديمية الوطنية للتربية الدامجة (ANEI). جميع الحقوق محفوظة.`
              : `© ${new Date().getFullYear()} L'Académie Nationale de l'Éducation Inclusive (ANEI). Tous droits réservés.`}
          </span>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
            aria-label={ar ? "روابط قانونية" : "Liens légaux"}
          >
            {legalLinks.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className="hover:text-slate-200 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
