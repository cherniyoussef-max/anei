"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, User } from "lucide-react";
import type { Locale } from "@/types";
import type { listHomeAvs, listHomeCourses, listHomeWebinars } from "@/server/queries/catalog";

type CourseRow = Awaited<ReturnType<typeof listHomeCourses>>[number];
type WebinarRow = Awaited<ReturnType<typeof listHomeWebinars>>[number];
type AvsRow = Awaited<ReturnType<typeof listHomeAvs>>[number];

export interface TopFeaturedNewsItem {
  id: string;
  slug: string;
  category: string;
  coverImageUrl?: string | null;
  tagFr: string;
  tagAr: string;
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
}

export function AcademyHome({
  locale,
  courses: _courses = [],
  webinars: _webinars = [],
  avsProfiles: _avsProfiles = [],
  hasPlayedIntro: _hasPlayedIntro = false,
  initialUser = null,
  topFeaturedNews = null,
}: {
  locale: Locale;
  courses?: CourseRow[];
  webinars?: WebinarRow[];
  avsProfiles?: AvsRow[];
  hasPlayedIntro?: boolean;
  initialUser?: { id: string; role?: string } | null;
  topFeaturedNews?: TopFeaturedNewsItem | null;
}) {
  const ar = locale === "ar";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".rv").forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const portalHref = initialUser
    ? initialUser.role === "ADMIN" || initialUser.role === "SUPER_ADMIN"
      ? `/${locale}/admin`
      : `/${locale}/dashboard`
    : `/${locale}/login`;

  return (
    <div className="academy-home">
      {/* =====================================================================
          1. HERO SECTION (.top)
          ===================================================================== */}
      <header className="top">
        {/* Animated Golden Lines Curve */}
        <svg className="sw" viewBox="0 0 1440 700" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M-20 600C300 520 620 700 960 600S1300 470 1470 540" />
          <path pathLength="1" className="s2" d="M-20 640C320 570 640 730 980 640S1320 520 1470 580" />
        </svg>

        {/* Watermark Emblems */}
        <Image
          className="wm wm1"
          src="/media/home-v5/logo-watermark.png"
          alt=""
          width={860}
          height={430}
          unoptimized
          aria-hidden="true"
        />
        <Image
          className="wm wm2"
          src="/media/home-v5/logo-watermark-2.png"
          alt=""
          width={420}
          height={210}
          unoptimized
          aria-hidden="true"
        />

        {/* Masked Hero Photograph */}
        <div className="top-photo" aria-hidden="true" />


        <div className="glass g2">
          <i>
            <span className="live" aria-hidden="true" />
          </i>
          <div>
            <b>{ar ? "مباشر وتفاعلي" : "Directs & Masterclasses"}</b>
            <span>{ar ? "لقاءات أسبوعية مع الخبراء" : "Échanges et replays ouverts"}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="wrap top-in">
          <div className="top-txt">
            <div className="tag">
              {ar ? "تعلم · تمكين · إدماج" : "APPRENDRE · OUTILLER · INCLURE"}
            </div>

            <h1>
              {ar ? (
                <>
                  الدمج المدرسي، <em>قوة تكتسب</em>.
                </>
              ) : (
                <>
                  L’inclusion, <em>une force</em> qui s’apprend.
                </>
              )}
            </h1>

            <p>
              {ar
                ? "تكوينات وموارد وخبراء من أجل مدرسة يجد فيها كل طفل مكانه ويحقق إمكاناته."
                : "Formations, ressources et experts pour une école où chaque enfant a sa place."}
            </p>

            {/* Dual Choices (.opts) */}
            <div className="opts">
              <Link href={`/${locale}/formations`} className="opt o1">
                <i>
                  <GraduationCap size={26} strokeWidth={1.8} />
                </i>
                <div>
                  <small>{ar ? "استكشاف" : "EXPLORER"}</small>
                  <b>{ar ? "التكوين المستمر والمسارات" : "Training & Formation continue"}</b>
                  <span>{ar ? "اكتشف البرامج المعتمدة" : "À quoi sert la plateforme ?"}</span>
                </div>
                <em className="rtl:rotate-180">→</em>
              </Link>

              <Link href={portalHref} className="opt o2">
                <i>
                  <User size={26} strokeWidth={1.8} />
                </i>
                <div>
                  <small>{ar ? "فضاء المستخدم" : "CONNEXION"}</small>
                  <b>{ar ? "بوابتكم الخاصة" : "Votre espace"}</b>
                  <span>{ar ? "الولوج إلى دوراتك وشهاداتك" : "Accédez à vos formations"}</span>
                </div>
                <em className="rtl:rotate-180">→</em>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Curved Wave Separator */}
        <svg className="wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40C360 100 1080-20 1440 50V80H0Z" fill="#f7faff" />
        </svg>
      </header>

      {/* =====================================================================
          2. DOMAINS SECTION (.domains) - 6 Vertical Cards
          ===================================================================== */}
      <section className="domains" id="domaines">
        <Image
          className="wm4"
          src="/media/home-v5/logo-watermark-domains.png"
          alt=""
          width={700}
          height={350}
          unoptimized
          aria-hidden="true"
        />

        <div className="wrap">
          <div className="head rv">
            <small>{ar ? "الفئات المستفيدة" : "POUR QUI ?"}</small>
            <h2>{ar ? "من يستفيد من الأكاديمية؟" : "Qui peut bénéficier de l’Académie ?"}</h2>
            <p className="sub">
              {ar
                ? "الأولياء، المعلمون، مرافقو AVS، الأخصائيون والمؤسسات: مساحة مخصصة لكل فئة."
                : "Parents, élèves, enseignants, AVS, spécialistes et établissements : un espace pour chacun."}
            </p>
          </div>

          <div className="row rv">
            {/* Card 1: Formations */}
            <Link href={`/${locale}/formations`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-formations.jpg)",
                  backgroundPosition: "55% center",
                }}
              />
              <span className="pill">
                {ar ? "فضاء التكوين" : "Espace Formations"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "التكوين" : "Formations"}</h3>
              <p>
                {ar
                  ? "مسارات تدريبية مصادق عليها لكل الاختصاصات بالسرعة التي تناسبكم."
                  : "Des parcours certifiants adaptés à chaque profil, à suivre à votre rythme."}
              </p>
            </Link>

            {/* Card 2: Librairie */}
            <Link href={`/${locale}/bibliotheque`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-bibliotheque.jpg)",
                  backgroundPosition: "35% center",
                }}
              />
              <span className="pill">
                {ar ? "المكتبة الرقمية" : "Espace Librairie"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "المكتبة" : "Librairie"}</h3>
              <p>
                {ar
                  ? "أدلة وبطاقات وأدوات عملية جاهزة للاستخدام الصفي المباشر."
                  : "Guides, fiches et outils concrets à utiliser dès demain en classe."}
              </p>
            </Link>

            {/* Card 3: Trouver un AVS */}
            <Link href={`/${locale}/avs`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-avs.jpg)",
                  backgroundPosition: "60% center",
                }}
              />
              <span className="pill">
                {ar ? "دليل AVS" : "Espace AVS"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "دليل مرافقي AVS" : "Trouver un AVS"}</h3>
              <p>
                {ar
                  ? "العثور على المرافق المناسب والمؤهل لاحتياجات طفلكم المدرسية."
                  : "Trouvez l’accompagnant le mieux adapté au besoin de votre enfant."}
              </p>
            </Link>

            {/* Card 4: Spécialistes */}
            <Link href={`/${locale}/specialistes`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-specialistes.jpg)",
                  backgroundPosition: "center",
                }}
              />
              <span className="pill">
                {ar ? "فضاء الخبراء" : "Espace Experts"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "الأخصائيون" : "Spécialistes"}</h3>
              <p>
                {ar
                  ? "أخصائيو نطق، نفسانيون، ومربون: نخبة معتمدة وموثوقة بالقرب منكم."
                  : "Orthophonistes, psychologues, éducateurs : des experts vérifiés près de vous."}
              </p>
            </Link>

            {/* Card 5: Établissements */}
            <Link href={`/${locale}/contact?type=school`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-etablissements.jpg)",
                  backgroundPosition: "48% center",
                }}
              />
              <span className="pill">
                {ar ? "المؤسسات التعليمية" : "Espace Établissements"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "المؤسسات" : "Établissements"}</h3>
              <p>
                {ar
                  ? "شراكات ومرافقة المدارس في استراتيجية الإدماج الشامل والتدريب."
                  : "Partenariats et accompagnement des écoles dans leur démarche inclusive."}
              </p>
            </Link>

            {/* Card 6: Webinaires */}
            <Link href={`/${locale}/webinaires`} className="card">
              <div
                className="bg"
                style={{
                  backgroundImage: "url(/media/home-v5/domain-webinaires.jpg)",
                  backgroundPosition: "center",
                }}
              />
              <span className="pill">
                {ar ? "الندوات التفاعلية" : "Espace Webinaires"} <i className="rtl:rotate-180">→</i>
              </span>
              <h3>{ar ? "الندوات" : "Webinaires"}</h3>
              <p>
                {ar
                  ? "حوار مباشر مع نخبة الخبراء ومشاهدة الإعادات في أي وقت."
                  : "Échangez en direct avec nos experts, puis revoyez les replays."}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. PLATFORM SHOWCASE SECTION (.plat)
          ===================================================================== */}
      <section className="plat">
        <div className="wrap">
          <div className="head rv">
            <small>{ar ? "المنصة التعليمية" : "PLATEFORME D’APPRENTISSAGE"}</small>
            <h2>
              {ar
                ? "بيئة تدريب وتواصل متكاملة لخدمة المدرسة الدامجة"
                : "Un environnement complet au service de l’école inclusive"}
            </h2>
          </div>

          <div className="shot rv">
            <Image
              src="/media/home-v5/platform-showcase.jpg"
              alt={ar ? "واجهة منصة ANEI" : "Aperçu de la plateforme ANEI"}
              width={1280}
              height={720}
              unoptimized
            />
          </div>

          <div className="cta rv">
            <Link href={`/${locale}/formations`} className="btn btn-navy big">
              <span>{ar ? "اكتشف جميع برامج التكوين ←" : "Découvrir tous nos parcours de formation →"}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. A LA UNE SECTION (.une) - Dynamic Featured Content or PPS Fallback
          ===================================================================== */}
      <section className="wrap">
        <div className="une rv">
          <div
            className="ph"
            aria-hidden="true"
            style={
              topFeaturedNews?.coverImageUrl
                ? { backgroundImage: `url(${topFeaturedNews.coverImageUrl})` }
                : undefined
            }
          />
          <div className="tx">
            <div className="tag">
              {topFeaturedNews
                ? ar
                  ? topFeaturedNews.tagAr || "في الصدارة ⭐"
                  : topFeaturedNews.tagFr || "À LA UNE ⭐"
                : ar
                ? "برنامج مميز"
                : "PROGRAMME PHARE"}
            </div>
            <h2>
              {topFeaturedNews
                ? ar
                  ? topFeaturedNews.titleAr
                  : topFeaturedNews.titleFr
                : ar
                ? "صياغة المشروع الفردي للتعلم (PEI/PPS)"
                : "Construire le Projet Personnalisé de Scolarisation (PPS)"}
            </h2>
            <p>
              {topFeaturedNews
                ? ar
                  ? topFeaturedNews.excerptAr
                  : topFeaturedNews.excerptFr
                : ar
                ? "دليل منهجي متكامل ونماذج قابلة للتحميل لتصميم ومتابعة وتقييم التكييفات البيداغوجية لكل تلميذ ذي احتياجات خاصة."
                : "Un guide méthodologique complet et des modèles téléchargeables pour concevoir, suivre et évaluer les aménagements pédagogiques de l'élève à besoins spécifiques."}
            </p>
            <Link
              href={
                topFeaturedNews
                  ? topFeaturedNews.slug.startsWith("formation-")
                    ? `/${locale}/formations/${topFeaturedNews.slug.replace(/^formation-/, "")}`
                    : `/${locale}/actualites/${topFeaturedNews.slug}`
                  : `/${locale}/formations`
              }
              className="btn btn-navy"
            >
              <span>
                {topFeaturedNews
                  ? topFeaturedNews.slug.startsWith("formation-")
                    ? ar
                      ? "اكتشف البرنامج والتسجيل ←"
                      : "Découvrir la formation →"
                    : ar
                    ? "الاطلاع على التفاصيل ←"
                    : "Consulter le dossier →"
                  : ar
                  ? "اكتشف برامج التكوين ←"
                  : "Découvrir les formations →"}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. NEWS & PUBLICATIONS (.news)
          ===================================================================== */}
      <section className="news" id="actualites">
        <div className="wrap">
          <div className="nhead rv">
            <div>
              <small>{ar ? "الأخبار والمقالات" : "ACTUALITÉS"}</small>
              <h2>{ar ? "آخر المستجدات" : "Dernières publications"}</h2>
              <span className="ar">{ar ? "منشورات ومقالات ميدانية" : "آخر المستجدات"}</span>
            </div>
            <Link href={`/${locale}/actualites`} className="btn btn-out">
              <span>{ar ? "عرض الكل ←" : "Tout voir →"}</span>
            </Link>
          </div>

          <div className="ngrid rv">
            {/* News 1 */}
            <Link href={`/${locale}/actualites`} className="nc">
              <div
                className="ni"
                style={{ backgroundImage: "url(/media/home-v5/news-1.jpg)" }}
              >
                <span className="bd w">{ar ? "ندوة" : "Webinaire"}</span>
              </div>
              <div className="nt">
                <small>{ar ? "24 أكتوبر 2026 · مباشر" : "24 oct. 2026 · En direct"}</small>
                <h3>
                  {ar ? "صياغة البرنامج الفردي: المراحل الأساسية" : "Rédiger un PEI : les étapes clés"}
                </h3>
                <span className="more">{ar ? "المزيد ←" : "En savoir plus →"}</span>
              </div>
            </Link>

            {/* News 2 */}
            <Link href={`/${locale}/actualites`} className="nc">
              <div
                className="ni"
                style={{ backgroundImage: "url(/media/home-v5/news-2.jpg)" }}
              >
                <span className="bd f">{ar ? "تكوين" : "Formation"}</span>
              </div>
              <div className="nt">
                <small>{ar ? "15 أكتوبر 2026" : "Publié le 15 oct. 2026"}</small>
                <h3>
                  {ar
                    ? "مرافقة تلميذ ذي طيف التوحد داخل الفصل"
                    : "Accompagner un élève avec autisme en classe"}
                </h3>
                <span className="more">{ar ? "المزيد ←" : "En savoir plus →"}</span>
              </div>
            </Link>

            {/* News 3 */}
            <Link href={`/${locale}/actualites`} className="nc">
              <div
                className="ni"
                style={{ backgroundImage: "url(/media/home-v5/news-3.jpg)" }}
              >
                <span className="bd f">{ar ? "تكوين" : "Formation"}</span>
              </div>
              <div className="nt">
                <small>{ar ? "12 أكتوبر 2026" : "Publié le 12 oct. 2026"}</small>
                <h3>
                  {ar
                    ? "تكييف الحصص الدراسية في الفصل الدامج"
                    : "Adapter ses séances en classe inclusive"}
                </h3>
                <span className="more">{ar ? "المزيد ←" : "En savoir plus →"}</span>
              </div>
            </Link>

            {/* News 4 */}
            <Link href={`/${locale}/actualites`} className="nc">
              <div
                className="ni"
                style={{ backgroundImage: "url(/media/home-v5/news-4.jpg)" }}
              >
                <span className="bd w">{ar ? "إعادة" : "Webinaire"}</span>
              </div>
              <div className="nt">
                <small>{ar ? "تسجيل · 8 أكتوبر 2026" : "Replay · 8 oct. 2026"}</small>
                <h3>
                  {ar ? "اضطرابات التعلم: التشخيص والتدخل" : "Troubles « dys » : repérer et agir"}
                </h3>
                <span className="more">{ar ? "المزيد ←" : "En savoir plus →"}</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
