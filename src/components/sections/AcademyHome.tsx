import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { ContactForm } from "@/components/interactive/ContactForm";
import { courses as courseTranslations, webinars as webinarTranslations, avsProfiles as avsTranslations } from "@/lib/data";
import { formatDate, formatMillimes } from "@/lib/i18n";
import type { listHomeAvs, listHomeCourses, listHomeWebinars } from "@/server/queries/catalog";

type CourseRow = Awaited<ReturnType<typeof listHomeCourses>>[number];
type WebinarRow = Awaited<ReturnType<typeof listHomeWebinars>>[number];
type AvsRow = Awaited<ReturnType<typeof listHomeAvs>>[number];

type Copy = { en: string; fr: string; ar: string };
const tx = (locale: Locale, copy: Copy) => copy[locale];

function courseTitle(course: CourseRow, locale: Locale) {
  if (locale === "ar") return course.titleAr;
  if (locale === "en") return courseTranslations.find((item) => item.slug === course.slug)?.title.en ?? course.titleFr;
  return course.titleFr;
}
function courseSummary(course: CourseRow, locale: Locale) {
  if (locale === "ar") return course.summaryAr;
  if (locale === "en") return courseTranslations.find((item) => item.slug === course.slug)?.description.en ?? course.summaryFr;
  return course.summaryFr;
}
function webinarTitle(webinar: WebinarRow, locale: Locale) {
  if (locale === "ar") return webinar.titleAr;
  if (locale === "en") return webinarTranslations.find((item) => item.title.fr === webinar.titleFr)?.title.en ?? webinar.titleFr;
  return webinar.titleFr;
}
function avsSpecialty(profile: AvsRow, locale: Locale) {
  const translated = avsTranslations.find((item) => item.name === profile.displayName);
  if (locale === "ar") return profile.specialtyAr;
  if (locale === "en") return translated?.specialty.en ?? profile.specialtyFr;
  return profile.specialtyFr;
}
function avsCity(profile: AvsRow, locale: Locale) {
  const translated = avsTranslations.find((item) => item.name === profile.displayName);
  if (locale === "ar") return profile.cityAr;
  if (locale === "en") return translated?.city.en ?? profile.cityFr;
  return profile.cityFr;
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

const heroCopy = {
  title: { en: "Tomorrow’s institution, ready today", fr: "L’institution de demain, prête aujourd’hui", ar: "مؤسسة الغد، جاهزة اليوم" },
  lead: {
    en: "ANEI brings professional learning and inclusive school support together in one trusted platform.",
    fr: "ANEI réunit formation professionnelle et accompagnement scolaire inclusif sur une plateforme de confiance.",
    ar: "تجمع ANEI بين التكوين المهني والدعم المدرسي الدامج في منصة موثوقة واحدة.",
  },
  sub: {
    en: "Simplify communication between parents, teachers and administrators through a modern, trustworthy, and technological solution.",
    fr: "Simplifiez la communication entre parents, enseignants et administrateurs grâce à une solution moderne, fiable et technologique.",
    ar: "بسّط التواصل بين الأولياء والمدرسين والإداريين عبر حل حديث وموثوق وتقني.",
  },
  primary: { en: "Request a Demo", fr: "Demander une démo", ar: "اطلب عرضًا تجريبيًا" },
  secondary: { en: "Explore the Platform", fr: "Explorer la plateforme", ar: "استكشف المنصة" },
  photoAlt: {
    en: "Educators collaborating on inclusive learning resources",
    fr: "Équipe éducative collaborant autour de ressources pédagogiques inclusives",
    ar: "فريق تربوي يتعاون حول موارد تعليمية دامجة",
  },
};

const avsCopy = {
  kicker: { en: "Dedicated Service", fr: "Service Dédié", ar: "خدمة مخصصة" },
  title: { en: "Find a Qualified AVS", fr: "Trouver un AVS Qualifié", ar: "ابحث عن مرافق مدرسي مؤهل" },
  lead: {
    en: "Connect families, coordinators and schools with trained and certified school life assistants.",
    fr: "Mettez en relation familles, coordinateurs et établissements scolaires avec des Accompagnants d’Élèves en Situation de Handicap formés et certifiés.",
    ar: "اربط الأسر والمنسقين والمؤسسات التربوية بمرافقين مدرسيين مدرَّبين ومعتمَدين.",
  },
  cards: [
    {
      icon: "check" as const,
      title: { en: "Certified Profiles", fr: "Profils Certifiés", ar: "ملفات معتمدة" },
      body: {
        en: "Every assistant is validated against national pedagogical and ethical standards.",
        fr: "Chaque accompagnant est validé selon les critères pédagogiques et éthiques nationaux.",
        ar: "يتم اعتماد كل مرافق وفق المعايير التربوية والأخلاقية الوطنية.",
      },
    },
    {
      icon: "mail" as const,
      title: { en: "Smooth Communication", fr: "Communication Fluide", ar: "تواصل سلس" },
      body: {
        en: "A secure channel between family, school and professional for continuous follow-up.",
        fr: "Un canal sécurisé entre la famille, l’école et le professionnel pour un suivi continu.",
        ar: "قناة آمنة بين الأسرة والمدرسة والمختص لمتابعة مستمرة.",
      },
    },
    {
      icon: "chart" as const,
      title: { en: "Progress Tracking", fr: "Suivi des Progrès", ar: "متابعة التقدم" },
      body: {
        en: "Built-in reporting tools to measure the development of autonomy.",
        fr: "Outils de compte-rendu intégrés pour mesurer le développement de l’autonomie.",
        ar: "أدوات تقارير مدمجة لقياس تطور الاستقلالية.",
      },
    },
  ],
};

const formationsCopy = {
  kicker: { en: "Pedagogy & Expertise", fr: "Pédagogie & Expertise", ar: "بيداغوجيا وخبرة" },
  title: { en: "Courses & Library Resources", fr: "Formations & Ressources Librairie", ar: "الدورات وموارد المكتبة" },
  link: { en: "Browse the library", fr: "Consulter la librairie", ar: "تصفح المكتبة" },
  cards: [
    {
      tag: { en: "Ongoing Training", fr: "Formation Continue", ar: "تكوين مستمر" },
      title: { en: "Inclusive practices for teachers and AVS", fr: "Pratiques inclusives pour enseignants et AVS", ar: "ممارسات دامجة للمدرسين والمرافقين" },
      body: {
        en: "Certified online modules covering pedagogical adaptation, learning disabilities, autism spectrum and non-violent communication.",
        fr: "Modules certifiants en ligne abordant l’adaptation pédagogique, les troubles DYS, le spectre de l’autisme et la communication non violente.",
        ar: "وحدات معتمَدة عبر الإنترنت تتناول التكيف البيداغوجي واضطرابات التعلم وطيف التوحد والتواصل اللاعنفي.",
      },
      cta: { en: "Enroll in a session", fr: "S’inscrire à la session", ar: "التسجيل في الجلسة" },
    },
    {
      tag: { en: "Pedagogical Library", fr: "Librairie Pédagogique", ar: "مكتبة بيداغوجية" },
      title: { en: "Practical sheets and support guides", fr: "Fiches pratiques et guides d’accompagnement", ar: "بطاقات عملية وأدلة مرافقة" },
      body: {
        en: "Access dozens of downloadable methodological booklets designed by inclusive education experts.",
        fr: "Accédez à des dizaines de livrets méthodologiques téléchargeables conçus par des experts de l’éducation inclusive.",
        ar: "اطّلع على عشرات الكتيبات المنهجية القابلة للتحميل التي أعدّها خبراء التربية الدامجة.",
      },
      cta: { en: "Download resources", fr: "Télécharger les ressources", ar: "تحميل الموارد" },
    },
  ],
};

const contactCopy = {
  kicker: { en: "Talk to our teams", fr: "Échangez avec nos équipes", ar: "تواصل مع فرقنا" },
  title: { en: "Get in Touch", fr: "Prendre Contact", ar: "تواصل معنا" },
  lead: {
    en: "A question about the platform, AVS support or our courses? Write to us.",
    fr: "Une question sur la plateforme, l’accompagnement AVS ou nos cursus de formation ? Écrivez-nous.",
    ar: "لديك سؤال حول المنصة أو مرافقة AVS أو مساراتنا التكوينية؟ راسلنا.",
  },
};

export function AcademyHome({ locale, courses, webinars, avsProfiles }: {
  locale: Locale;
  courses: CourseRow[];
  webinars: WebinarRow[];
  avsProfiles: AvsRow[];
}) {
  const nextWebinar = webinars[0];
  const featuredCourses = courses.slice(0, 2);
  return (
    <div className="academy-home">
      <section className="ah-hero">
        <div className="ah-container">
          <div className="ah-hero-grid">
            <div className="ah-hero-copy">
              <h1 className="ah-hero-title">{tx(locale, heroCopy.title)}</h1>
              <p className="ah-hero-lead">{tx(locale, heroCopy.lead)}</p>
              <p className="ah-hero-sub">{tx(locale, heroCopy.sub)}</p>
              <div className="ah-hero-actions">
                <Link href={`/${locale}/contact`} className="ah-btn">
                  {tx(locale, heroCopy.primary)}
                  <Icon name="arrow" size={16} />
                </Link>
                <Link href={`/${locale}/formations`} className="ah-btn">
                  {tx(locale, heroCopy.secondary)}
                </Link>
              </div>
            </div>

            <div className="ah-visual-col">
              <figure className="ah-hero-media">
                <Image
                  src="/media/anei-audience-professionals.webp"
                  alt={tx(locale, heroCopy.photoAlt)}
                  width={1400}
                  height={1050}
                  priority
                  sizes="(max-width: 1023px) calc(100vw - 32px), 58vw"
                />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className="ah-section is-tinted" aria-labelledby="ah-avs-title">
        <div className="ah-container">
          <span className="ah-section-kicker">{tx(locale, avsCopy.kicker)}</span>
          <h2 className="ah-section-title" id="ah-avs-title">{tx(locale, avsCopy.title)}</h2>
          <p className="ah-section-lead">{tx(locale, avsCopy.lead)}</p>
          <div className="ah-avs-grid">
            {avsCopy.cards.map((card) => (
              <div className="ah-avs-card" key={card.title.en}>
                <Icon name={card.icon} size={28} />
                <h3>{tx(locale, card.title)}</h3>
                <p>{tx(locale, card.body)}</p>
              </div>
            ))}
          </div>
          {avsProfiles.length ? (
            <div className="ah-avs-profiles">
              {avsProfiles.map((profile) => (
                <Link key={profile.id} href={`/${locale}/avs`} className="ah-avs-profile">
                  <span className="ah-avs-profile-avatar" aria-hidden="true">{initials(profile.displayName)}</span>
                  <span className="ah-avs-profile-copy">
                    <strong>{profile.displayName}</strong>
                    <small>{avsSpecialty(profile, locale)} · {avsCity(profile, locale)}</small>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="ah-section" aria-labelledby="ah-formations-title">
        <div className="ah-container">
          <div className="ah-formations-header">
            <div>
              <span className="ah-section-kicker">{tx(locale, formationsCopy.kicker)}</span>
              <h2 className="ah-section-title" id="ah-formations-title">{tx(locale, formationsCopy.title)}</h2>
            </div>
            <Link href={`/${locale}/bibliotheque`} className="ah-formations-link">
              {tx(locale, formationsCopy.link)}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="ah-formations-grid">
            {featuredCourses.length
              ? featuredCourses.map((course) => (
                <div className="ah-formation-card" key={course.id}>
                  <div>
                    <span className="ah-formation-tag">{Math.max(1, Math.round(course.durationMinutes / 60))}h · {course.trainerName}</span>
                    <h3>{courseTitle(course, locale)}</h3>
                    <p>{courseSummary(course, locale)}</p>
                  </div>
                  <Link href={`/${locale}/formations/${course.slug}`} className="ah-formation-btn">
                    {formatMillimes(course.priceMillimes, locale)}
                  </Link>
                </div>
              ))
              : formationsCopy.cards.map((card) => (
                <div className="ah-formation-card" key={card.title.en}>
                  <div>
                    <span className="ah-formation-tag">{tx(locale, card.tag)}</span>
                    <h3>{tx(locale, card.title)}</h3>
                    <p>{tx(locale, card.body)}</p>
                  </div>
                  <Link href={`/${locale}/formations`} className="ah-formation-btn">
                    {tx(locale, card.cta)}
                  </Link>
                </div>
              ))}
          </div>
          {nextWebinar ? (
            <Link href={`/${locale}/webinaires`} className="ah-webinar-note">
              <Icon name="calendar" size={18} />
              <span>
                {tx(locale, { en: "Next webinar", fr: "Prochain webinaire", ar: "الندوة القادمة" })}
                {" · "}
                {webinarTitle(nextWebinar, locale)}
                {nextWebinar.startsAt ? ` · ${formatDate(nextWebinar.startsAt, locale)}` : ""}
              </span>
              <Icon name="arrow" size={16} />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="ah-section is-tinted" id="contact" aria-labelledby="ah-contact-title">
        <div className="ah-container ah-contact-inner">
          <span className="ah-section-kicker">{tx(locale, contactCopy.kicker)}</span>
          <h2 className="ah-section-title" id="ah-contact-title">{tx(locale, contactCopy.title)}</h2>
          <p className="ah-section-lead">{tx(locale, contactCopy.lead)}</p>
          <ContactForm locale={locale} />
        </div>
      </section>
    </div>
  );
}
