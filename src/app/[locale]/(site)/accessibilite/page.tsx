import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { INSTITUTION } from "@/lib/config/institution";
import { CheckCircle2, Mail, Phone, ShieldCheck, HeartHandshake } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar
      ? "بيان سهولة النفاذ الرقمي (WCAG 2.2 AA) | ANEI"
      : "Déclaration d'accessibilité numérique (WCAG 2.2 AA) | ANEI",
    description: ar
      ? "التزام الأكاديمية الوطنية للتربية الدامجة بتوفير منصة ميسّرة وشاملة وفق معايير النفاذ الرقمي العالمية WCAG 2.2 AA."
      : "Engagement de l'Académie Nationale de l'Éducation Inclusive pour une accessibilité numérique universelle conforme au standard WCAG 2.2 niveau AA.",
  };
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const breadcrumbs = [
    { label: ar ? "الرئيسية" : "Accueil", href: `/${locale}` },
    { label: ar ? "سهولة الوصول" : "Accessibilité" },
  ];

  return (
    <>
      <PageHero
        breadcrumbs={breadcrumbs}
        eyebrow={ar ? "الالتزام المؤسساتي" : "ENGAGEMENT INSTITUTIONNEL"}
        title={
          ar
            ? "بيان سهولة النفاذ الرقمي والشمول"
            : "Déclaration d'accessibilité numérique"
        }
        description={
          ar
            ? "تلتزم الأكاديمية الوطنية للتربية الدامجة بضمان وصول متكافئ وشامل لجميع مستخدميها، بمن فيهم الأشخاص ذوو الإعاقة والمساعدون التربويون."
            : "L'Académie Nationale de l'Éducation Inclusive s'engage à rendre ses services numériques accessibles à l'ensemble des apprenants, enseignants, AVS et familles, conformément aux critères WCAG 2.2 niveau AA."
        }
      />

      <section className="section py-16 bg-[#F7FAFC]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* 1. État de conformité */}
          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-[#dde9f8] shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-[#8C651E]" />
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#0b1f4b]">
                {ar ? "1. حالة الامتثال والمعايير" : "1. État de conformité et référentiel"}
              </h2>
            </div>
            <p className="text-slate-600 leading-relaxed mb-4 text-sm sm:text-base">
              {ar
                ? "تم تطوير المنصة مع اعتماد توجيهات النفاذ إلى محتوى الويب (WCAG 2.2) في المستوى المزدوج (AA). يشمل ذلك بنية برمجية دقيقة تدعم قارئات الشاشات، ملاحة لوحة المفاتيح الكاملة، وتباينات لونية تزيد عن 4.5:1 للنصوص العادية و3:1 للعناصر الرسومية."
                : "La plateforme de l'Académie Nationale de l'Éducation Inclusive est conçue selon les Règles pour l'accessibilité des contenus Web (WCAG 2.2 niveau AA). Cette démarche garantit une expérience équitable et sans barrière sur ordinateur, tablette et mobile."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {ar ? "ملاحة لوحة المفاتيح الكاملة" : "Navigation clavier intégrale"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ar
                      ? "إمكانية تصفح جميع المسارات واستخدام النماذج دون الحاجة إلى فأرة."
                      : "Parcours complet au clavier avec indicateurs de focus visibles et explicites."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {ar ? "ثنائية اللغة ودعم RTL الحقيقي" : "Bilinguisme & Support RTL natif"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ar
                      ? "محاذاة عربية صحيحة مع مراعاة اتجاه القراءة والخطوط الطباعية الملائمة."
                      : "Direction de lecture droite-à-gauche authentique et typographie arabe adaptée."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {ar ? "ملاءمة قارئات الشاشة (NVDA / VoiceOver)" : "Compatibilité lecteurs d'écran"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ar
                      ? "بنية دلالية واضحة مع وسوم ARIA وتسميات صريحة لجميع الأزرار والروابط."
                      : "Balisage sémantique rigoureux, alternatives textuelles et rôles ARIA déclarés."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {ar ? "احترام تفضيلات الحركة (Reduced Motion)" : "Respect des mouvements réduits"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ar
                      ? "تعطيل التحريكات الانتقالية تلقائيًا عند تفعيل خيار تخفيف الحركة في النظام."
                      : "Désactivation automatique des animations pour les utilisateurs sensibles."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Assistance & Signalement */}
          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-[#dde9f8] shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <HeartHandshake className="w-6 h-6 text-[#8C651E]" />
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#0b1f4b]">
                {ar ? "2. الدعم والمساعدة في الوصول" : "2. Assistance et contact accessibilité"}
              </h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-base mb-6">
              {ar
                ? "إذا واجهت أي صعوبة في قراءة محتوى، تحميل دليل، أو إتمام التسجيل في دورة تكوينية، فإن فريق الدعم الفني والبيداغوجي جاهز لتقديم المساعدة المباشرة عبر القنوات التالية:"
                : "Si vous rencontrez une difficulté d'accès à un contenu, un document PDF ou une fonctionnalité de la plateforme, notre référent accessibilité est à votre écoute pour vous orienter et vous transmettre les documents sous format adapté :"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href={`mailto:${INSTITUTION.contactEmail}?subject=Accessibilite`}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#eef4fc] hover:border-[#dde9f8] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-[#0b1f4b] shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    {ar ? "البريد الإلكتروني المباشر" : "Par e-mail"}
                  </span>
                  <strong className="text-sm text-[#0b1f4b]">{INSTITUTION.contactEmail}</strong>
                </div>
              </a>
              <a
                href={`tel:${INSTITUTION.phones.national}`}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#eef4fc] hover:border-[#dde9f8] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-[#0b1f4b] shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    {ar ? "الاتصال الهاتفي" : "Par téléphone"}
                  </span>
                  <strong className="text-sm text-[#0b1f4b]">{INSTITUTION.phones.national}</strong>
                </div>
              </a>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                {ar ? "آخر مراجعة تقنية: أكتوبر 2026" : "Dernière évaluation technique : Octobre 2026"}
              </span>
              <Link
                href={`/${locale}/contact`}
                className="text-xs font-semibold text-[#0b1f4b] hover:text-[#1b3a7a] underline underline-offset-4"
              >
                {ar ? "نموذج التواصل والاستفسار ←" : "Formulaire de contact institutionnel →"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
