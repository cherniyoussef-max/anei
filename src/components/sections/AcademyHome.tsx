import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  GraduationCap,
  BookOpen,
  User,
  MonitorPlay,
  Megaphone,
  Mail,
  Users,
  Monitor,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { Locale } from "@/types";
import type { listHomeAvs, listHomeCourses, listHomeWebinars } from "@/server/queries/catalog";
import { AneiLogoAnimated } from "@/components/brand/AneiLogoAnimated";
import { HomePillarsBar } from "@/components/sections/HomePillarsBar";

type CourseRow = Awaited<ReturnType<typeof listHomeCourses>>[number];
type WebinarRow = Awaited<ReturnType<typeof listHomeWebinars>>[number];
type AvsRow = Awaited<ReturnType<typeof listHomeAvs>>[number];

export function AcademyHome({
  locale,
  hasPlayedIntro = false,
}: {
  locale: Locale;
  courses?: CourseRow[];
  webinars?: WebinarRow[];
  avsProfiles?: AvsRow[];
  hasPlayedIntro?: boolean;
  initialUser?: { id: string; role?: string } | null;
}) {
  const ar = locale === "ar";

  return (
    <div className="academy-home">
      {/* 2. HERO SECTION */}
      <section className="hero-root">
        {/* Subtle Brand Logo Emblem Watermark */}
        <div className="hero-arabesque" aria-hidden="true">
          <Image
            src="/brand/anei-watermark-feathered-navy.webp"
            alt=""
            width={2256}
            height={1403}
            priority
          />
        </div>

        <div className="academy-container">
          {/* Centered Academy Emblem Logo with Arabic + French Names & Animated 5-layer intro */}
          <div className="hero-logo-center ah-hero-logo-intro w-[240px] sm:w-[280px] md:w-[320px] mx-auto mb-4">
            <AneiLogoAnimated locale={locale} priority hasPlayedIntro={hasPlayedIntro} />
          </div>

          {/* Hero Grid: Copy (Left) + Classroom Photo with Swooping Curve (Right) */}
          <div className="hero-grid">
            {/* Left Column: Eyebrow, H1, Paragraph, Search Pill */}
            <div className="hero-copy-col">
              <div className="eyebrow-container mb-3.5">
                <span className="gold-line" aria-hidden="true" />
                <span className="text-[13.5px] text-[#3D4A5C] leading-snug">
                  {ar ? (
                    "منصة للتعلم وتبادل الخبرات"
                  ) : (
                    <>
                      Une plateforme d’apprentissage
                      <br />
                      et de partage d’expertise
                    </>
                  )}
                </span>
              </div>

              <h1 className="hero-h1 font-sans font-bold tracking-tight">
                {ar ? (
                  <>
                    من أجل تربية
                    <br />
                    <span className="text-teal">دامجة</span> ومستدامة
                  </>
                ) : (
                  <>
                    Pour une éducation
                    <br />
                    <span className="text-teal">inclusive</span> et durable
                  </>
                )}
              </h1>

              <p className="hero-desc">
                {ar
                  ? "موارد ودورات تكوينية وأدوات لنبني معًا مجتمعًا أكثر عدلاً وشمولاً وتضامنًا."
                  : "Des ressources, des formations et des outils pour construire ensemble une société plus juste, plus inclusive et plus solidaire."}
              </p>

              <form action={`/${locale}/formations`} method="GET" className="hero-search-bar">
                <Search size={18} className="text-[#6B7685] flex-none" />
                <input
                  type="search"
                  name="search"
                  className="hero-search-input"
                  placeholder={ar ? "ابحث عن دورة، أداة، أو موضوع..." : "Rechercher une formation, un outil, un sujet..."}
                  aria-label={ar ? "ابحث عن دورة، أداة، أو موضوع..." : "Rechercher une formation, un outil, un sujet..."}
                />
                <button type="submit" className="hero-search-submit" aria-label={ar ? "بحث" : "Lancer la recherche"}>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </button>
              </form>
            </div>

            {/* Right Column: Hero Photo with Smooth Fade & Double Teal Sweeping Curve */}
            <div className="hero-photo-wrap">
              <Image
                src={ar ? "/media/hero-teacher-children-smooth-rtl.webp" : "/media/hero-teacher-children-smooth.webp"}
                alt={ar ? "معلمة وأطفال يقرؤون معًا في فصل دراسي دامج" : "Enseignante et enfants lisant ensemble dans une classe inclusive"}
                width={1384}
                height={752}
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 650px"
                className="hero-photo-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUICK-ACCESS BAND (6 Cards in a Row) */}
      <section className="quick-access-root" aria-label={ar ? "الوصول السريع" : "Accès rapide"}>
        <div className="academy-container">
          <div className="quick-access-grid">
            <Link href={`/${locale}/formations`} prefetch={true} className="quick-access-card">
              <GraduationCap size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "التكوين" : "Formations"}</span>
            </Link>

            <Link href={`/${locale}/bibliotheque`} prefetch={true} className="quick-access-card">
              <BookOpen size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "المكتبة" : "Bibliothèque"}</span>
            </Link>

            <Link href={`/${locale}/assistant`} prefetch={true} className="quick-access-card bg-amber-50/40 border-amber-200/60 hover:border-amber-300">
              <Sparkles size={32} strokeWidth={1.4} className="quick-access-icon text-[#B58D3D]" />
              <span className="quick-access-label text-slate-900 font-semibold">{ar ? "المساعد الذكي" : "Assistant IA"}</span>
            </Link>

            <Link href={`/${locale}/avs`} prefetch={true} className="quick-access-card">
              <User size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "البحث عن مرافق" : "Trouver un AVS"}</span>
            </Link>

            <Link href={`/${locale}/webinaires`} prefetch={true} className="quick-access-card">
              <MonitorPlay size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "الندوات" : "Webinaires"}</span>
            </Link>

            <Link href={`/${locale}/actualites`} prefetch={true} className="quick-access-card">
              <Megaphone size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "الأخبار" : "Actualités"}</span>
            </Link>

            <Link href={`/${locale}/contact`} prefetch={true} className="quick-access-card">
              <Mail size={32} strokeWidth={1.4} className="quick-access-icon" />
              <span className="quick-access-label">{ar ? "اتصل بنا" : "Contact"}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. "NOS DOMAINES" SECTION */}
      <section className="domaines-root" aria-labelledby="domaines-heading">
        <div className="academy-container">
          <div className="domaines-layout">
            {/* Left Column: Eyebrow, H2, Paragraph, Primary Button */}
            <div className="domaines-copy">
              <div className="eyebrow-container mb-3">
                <span className="gold-line" aria-hidden="true" />
                <span className="eyebrow-label">{ar ? "مجالاتنا" : "NOS DOMAINES"}</span>
              </div>

              <h2 id="domaines-heading" className="domaines-h2 font-sans font-semibold tracking-tight">
                {ar ? (
                  <>
                    محتويات مكيّفة
                    <br />
                    مع <span className="text-teal">احتياجاتكم</span>
                  </>
                ) : (
                  <>
                    Des contenus adaptés
                    <br />
                    à <span className="text-teal">vos besoins</span>
                  </>
                )}
              </h2>

              <p className="domaines-desc">
                {ar
                  ? "عرض متنوع لتعزيز مهاراتكم وإثراء ممارساتكم ومرافقة الدمج في كافة السياقات."
                  : "Une offre variée pour renforcer vos compétences, enrichir vos pratiques et accompagner l'inclusion dans tous les contextes."}
              </p>

              <Link href={`/${locale}/formations`} className="btn-pill-primary w-fit">
                <span>{ar ? "اكتشف مجالاتنا" : "Découvrir nos domaines"}</span>
                <ArrowRight size={17} strokeWidth={2} />
              </Link>
            </div>

            {/* Vertical Divider Line */}
            <div className="domaines-divider" aria-hidden="true" />

            {/* Right Column: 4 Cards in a Row */}
            <div className="domaines-cards-grid">
              {/* Card 1 */}
              <Link href={`/${locale}/formations?category=pedagogie`} className="domaine-card">
                <div className="domaine-photo-wrap">
                  <Image
                    src="/media/domain-pedagogie.jpg"
                    alt={ar ? "البيداغوجيا الدامجة والبرنامج الفردي" : "Pédagogie inclusive et PEI"}
                    width={800}
                    height={488}
                    className="domaine-photo"
                  />
                  <div className="domaine-badge" aria-hidden="true">
                    <BookOpen size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="domaine-content">
                  <h3 className="domaine-title">
                    {ar ? (
                      <>
                        البيداغوجيا الدامجة
                        <br />
                        والبرنامج الفردي
                      </>
                    ) : (
                      <>
                        Pédagogie inclusive
                        <br />
                        et PEI
                      </>
                    )}
                  </h3>
                  <div className="domaine-arrow">
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>

              {/* Card 2 */}
              <Link href={`/${locale}/avs`} className="domaine-card">
                <div className="domaine-photo-wrap">
                  <Image
                    src="/media/domain-avs.jpg"
                    alt={ar ? "مرافقة ودعم المرافقين المدرسيين" : "Accompagnement des AVS"}
                    width={800}
                    height={488}
                    className="domaine-photo"
                  />
                  <div className="domaine-badge" aria-hidden="true">
                    <Users size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="domaine-content">
                  <h3 className="domaine-title">
                    {ar ? (
                      <>
                        مرافقة ودعم
                        <br />
                        المرافقين المدرسيين
                      </>
                    ) : (
                      <>
                        Accompagnement
                        <br />
                        des AVS
                      </>
                    )}
                  </h3>
                  <div className="domaine-arrow">
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>

              {/* Card 3 */}
              <Link href={`/${locale}/bibliotheque`} className="domaine-card">
                <div className="domaine-photo-wrap">
                  <Image
                    src="/media/domain-outils.jpg"
                    alt={ar ? "أدوات وموارد بيداغوجية" : "Outils et ressources pédagogiques"}
                    width={800}
                    height={488}
                    className="domaine-photo"
                  />
                  <div className="domaine-badge" aria-hidden="true">
                    <Monitor size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="domaine-content">
                  <h3 className="domaine-title">
                    {ar ? (
                      <>
                        أدوات وموارد
                        <br />
                        بيداغوجية
                      </>
                    ) : (
                      <>
                        Outils et ressources
                        <br />
                        pédagogiques
                      </>
                    )}
                  </h3>
                  <div className="domaine-arrow">
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>

              {/* Card 4 */}
              <Link href={`/${locale}/webinaires`} className="domaine-card">
                <div className="domaine-photo-wrap">
                  <Image
                    src="/media/domain-webinaires.jpg"
                    alt={ar ? "ندوات وفعاليات" : "Webinaires et événements"}
                    width={800}
                    height={488}
                    className="domaine-photo"
                  />
                  <div className="domaine-badge" aria-hidden="true">
                    <Calendar size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="domaine-content">
                  <h3 className="domaine-title">
                    {ar ? (
                      <>
                        ندوات
                        <br />
                        وفعاليات
                      </>
                    ) : (
                      <>
                        Webinaires
                        <br />
                        et événements
                      </>
                    )}
                  </h3>
                  <div className="domaine-arrow">
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. "À LA UNE" FEATURE BANNER (Depth-of-Field Blur & 12-col Editorial Card) */}
      <section className="alaune-root max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20" aria-labelledby="alaune-heading">
        <div className="rounded-3xl bg-[#F4F7FB] border border-slate-200/80 overflow-hidden shadow-xs grid lg:grid-cols-12 items-center gap-0">
          {/* Image Column with True Optical Depth (Crisp Subject + High Background Depth) */}
          <div className="lg:col-span-6 relative h-[360px] sm:h-[420px] lg:h-[480px] overflow-hidden bg-slate-100 rounded-2xl lg:rounded-none shadow-sm lg:shadow-none">
            {/* Main crisp image: wheelchair subject in classroom 100% sharp */}
            <Image
              src="/media/alaune-classroom.jpg"
              alt={ar ? "فصل دراسي مجهز بكرسي متحرك في المقدمة" : "Salle de classe inclusive avec fauteuil roulant au premier plan"}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority={false}
              className="object-cover object-[30%_center] blur-none"
            />

            {/* Subtle background depth-of-field blur: strictly on the upper 25-35% classroom background */}
            <div
              className="absolute inset-0 pointer-events-none backdrop-blur-[2px]"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, transparent 35%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 35%)",
              }}
              aria-hidden="true"
            />

            {/* Lateral edge blending gradient towards text column */}
            <div
              className="hidden lg:block absolute inset-y-0 end-0 w-28 lg:w-36 pointer-events-none z-10 bg-gradient-to-r rtl:bg-gradient-to-l from-transparent via-transparent to-[#F4F7FB]"
              aria-hidden="true"
            />
            {/* Mobile edge blending (bottom) */}
            <div
              className="lg:hidden absolute inset-x-0 bottom-0 h-16 pointer-events-none z-10 bg-gradient-to-b from-transparent to-[#F4F7FB]"
              aria-hidden="true"
            />

            {/* Contrast border ring */}
            <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/5 pointer-events-none z-10" aria-hidden="true" />
          </div>

          {/* Text Column */}
          <div className="lg:col-span-6 p-8 sm:p-12 lg:ps-10 lg:pe-14 flex flex-col justify-center">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-6 h-[1.5px] bg-[#B58D3D] rounded-full flex-none" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">
                {ar ? "في الصدارة" : "À LA UNE"}
              </span>
            </div>

            {/* H2 Title 100% Sans-Serif */}
            <h2
              id="alaune-heading"
              className="text-3xl sm:text-4xl font-bold text-[#0A192F] tracking-[-0.02em] rtl:tracking-normal leading-[1.2] rtl:leading-[1.38] text-balance font-sans"
            >
              {ar ? (
                <>
                  الدمج، كفاءة
                  <br />
                  تُبنى خطوة بخطوة
                </>
              ) : (
                <>
                  L&apos;inclusion, une compétence
                  <br />
                  qui se construit
                </>
              )}
            </h2>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-600 leading-[1.7] rtl:leading-[1.9] mt-4 max-w-xl font-normal">
              {ar
                ? "موارد وشهادات حية ومستجدات للبقاء على اطلاع والاستلهام من أفضل الممارسات في التربية الدامجة."
                : "Des ressources, des témoignages et des actualités pour rester informé et s'inspirer des meilleures pratiques de terrain."}
            </p>

            {/* CTA Button */}
            <div className="mt-8">
              <Link
                href={`/${locale}/actualites`}
                className="inline-flex items-center gap-2.5 rounded-full bg-[#0A192F] text-white hover:bg-[#0056D2] px-6 py-3 text-sm font-semibold shadow-xs transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2"
              >
                <span>{ar ? "عرض جميع الأخبار" : "Voir toutes les actualités"}</span>
                <ArrowRight size={17} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ACADEMY CORE PILLARS (TRUST & VALUES) */}
      <HomePillarsBar locale={locale} />
    </div>
  );
}
