import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import {
  GraduationCap,
  BookOpen,
  Users,
  Stethoscope,
  Video,
  Mail,
  Shield,
  UserCheck,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "خريطة الموقع | أكاديمية ANEI" : "Plan du site | Académie ANEI",
    description: ar
      ? "دليل كامل وهيكلي لجميع أقسام وصفحات ومسارات منصة الأكاديمية الوطنية للتربية الدامجة."
      : "Arborescence complète et accès direct à toutes les sections, formations, annuaires et ressources de l'Académie ANEI.",
  };
}

export default async function SitemapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const breadcrumbs = [
    { label: ar ? "الرئيسية" : "Accueil", href: `/${locale}` },
    { label: ar ? "خريطة الموقع" : "Plan du site" },
  ];

  const sections = [
    {
      title: ar ? "فضاء التكوين والمسارات" : "Formations & Certifications",
      icon: GraduationCap,
      links: [
        { href: `/${locale}/formations`, label: ar ? "دليل جميع برامج التكوين" : "Catalogue des formations certifiantes" },
        { href: `/${locale}/formations/autisme-tsa-milieu-scolaire`, label: ar ? "مسار طيف التوحد (TSA) في الوسط المدرسي" : "Formation Autisme (TSA) en milieu scolaire" },
        { href: `/${locale}/formations/troubles-dys-pedagogie-differenciee`, label: ar ? "مسار اضطرابات التعلم النوعية (DYS)" : "Formation Troubles DYS & Pédagogie différenciée" },
      ],
    },
    {
      title: ar ? "المكتبة الرقمية والموارد" : "Bibliothèque & Ressources",
      icon: BookOpen,
      links: [
        { href: `/${locale}/bibliotheque`, label: ar ? "المكتبة البيداغوجية الشاملة" : "Bibliothèque de ressources pédagogiques" },
        { href: "/documents/guide-complet-autisme-accompagnement-scolaire-anei.pdf", label: ar ? "تحميل الدليل المنهجي للتوحد (PDF)" : "Guide méthodologique complet Autisme (PDF)" },
        { href: "/documents/guide-complet-autisme-accompagnement-scolaire-anei.html", label: ar ? "قراءة الدليل المنهجي عبر المتصفح" : "Consulter le guide pratique en ligne" },
      ],
    },
    {
      title: ar ? "دليل مرافقي الحياة المدرسية (AVS)" : "Réseau National des AVS",
      icon: Users,
      links: [
        { href: `/${locale}/avs`, label: ar ? "دليل مرافقي AVS وحجز المواعيد" : "Annuaire public des accompagnants AVS" },
        { href: `/${locale}/contact?type=practitioner`, label: ar ? "تقديم طلب اعتماد ممارس AVS" : "Candidater au réseau certifié AVS" },
      ],
    },
    {
      title: ar ? "دليل الأخصائيين المعتمدين" : "Annuaire des Spécialistes",
      icon: Stethoscope,
      links: [
        { href: `/${locale}/specialistes`, label: ar ? "قائمة أخصائيي النطق والعلاج الحركي والنفسي" : "Annuaire des praticiens partenaires" },
        { href: `/${locale}/contact?type=practitioner`, label: ar ? "طلب الانضمام كأخصائي معتمد" : "Demande d'agrément praticien" },
      ],
    },
    {
      title: ar ? "الندوات التفاعلية والمستجدات" : "Webinaires & Actualités",
      icon: Video,
      links: [
        { href: `/${locale}/webinaires`, label: ar ? "جدول الندوات المباشرة والتسجيل" : "Agenda des webinaires et directs" },
        { href: `/${locale}/actualites`, label: ar ? "الأخبار والمقالات والملفات الميدانية" : "Actualités et retours de terrain" },
      ],
    },
    {
      title: ar ? "الفضاءات الشخصية والتسجيل" : "Espaces Utilisateurs & Connexion",
      icon: UserCheck,
      links: [
        { href: `/${locale}/connexion`, label: ar ? "تسجيل الدخول إلى الفضاء التعليمي" : "Connexion à votre espace d'apprentissage" },
        { href: `/${locale}/inscription`, label: ar ? "إنشاء حساب جديد على المنصة" : "Créer un compte apprenant ou professionnel" },
        { href: `/${locale}/mot-de-passe-oublie`, label: ar ? "استعادة كلمة المرور" : "Réinitialisation de mot de passe" },
      ],
    },
    {
      title: ar ? "التواصل والمؤسسة" : "Contact & Établissements",
      icon: Mail,
      links: [
        { href: `/${locale}/contact`, label: ar ? "الاتصال والمقر الوطني والفروع" : "Contact institutionnel & Implantation" },
        { href: `/${locale}/contact?type=school`, label: ar ? "شراكات المدارس والمؤسسات" : "Partenariats scolaires & Établissements" },
        { href: `/${locale}/about`, label: ar ? "عن الأكاديمية ورسالتها" : "À propos de l'Académie ANEI" },
      ],
    },
    {
      title: ar ? "المعلومات القانونية والنفاذ" : "Cadre Légal & Accessibilité",
      icon: Shield,
      links: [
        { href: `/${locale}/conditions`, label: ar ? "الشروط العامة والإشعار القانوني" : "Mentions légales & Conditions" },
        { href: `/${locale}/confidentialite`, label: ar ? "سياسة حماية البيانات والخصوصية" : "Politique de confidentialité" },
        { href: `/${locale}/accessibilite`, label: ar ? "بيان سهولة النفاذ الرقمي (WCAG 2.2 AA)" : "Déclaration d'accessibilité numérique" },
      ],
    },
  ];

  return (
    <>
      <PageHero
        breadcrumbs={breadcrumbs}
        eyebrow={ar ? "الهيكلة الرقمية" : "NAVIGATION RAPIDE"}
        title={ar ? "خريطة الموقع والاستكشاف السريع" : "Plan du site"}
        description={
          ar
            ? "دليل كامل ومنظم لكافة صفحات وخدمات منصة الأكاديمية الوطنية للتربية الدامجة."
            : "Accédez directement à l'ensemble des parcours de formation, outils pratiques, annuaires certifiés et services de l'Académie ANEI."
        }
      />

      <section className="section py-16 bg-[#F7FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {sections.map((section, idx) => {
              const IconComp = section.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-[#dde9f8] shadow-xs flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-[#eef4fc] text-[#0b1f4b] grid place-items-center shrink-0">
                      <IconComp size={18} />
                    </div>
                    <h2 className="font-bold text-[#0b1f4b] text-base leading-snug">
                      {section.title}
                    </h2>
                  </div>
                  <ul className="space-y-2.5 flex-1 text-sm">
                    {section.links.map((link, linkIdx) => (
                      <li key={linkIdx}>
                        <Link
                          href={link.href}
                          className="text-slate-600 hover:text-[#0b1f4b] hover:underline underline-offset-4 transition-colors block leading-relaxed"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
