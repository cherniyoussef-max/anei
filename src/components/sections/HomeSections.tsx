import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { courses as courseTranslations, webinars as webinarTranslations, avsProfiles as avsTranslations } from "@/lib/data";
import { formatDate, formatMillimes, t } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { listHomeAvs, listHomeCourses, listHomeWebinars } from "@/server/queries/catalog";

type CourseRow = Awaited<ReturnType<typeof listHomeCourses>>[number];
type WebinarRow = Awaited<ReturnType<typeof listHomeWebinars>>[number];
type AvsRow = Awaited<ReturnType<typeof listHomeAvs>>[number];

function localText(locale: Locale, values: { en: string; fr: string; ar: string }) {
  return values[locale];
}

const categoryLabels: Record<string, { en: string; fr: string; ar: string }> = {
  education: { en: "Foundations", fr: "Fondamentaux", ar: "الأساسيات" },
  avs: { en: "AVS support", fr: "Accompagnement AVS", ar: "مرافقة AVS" },
  "special-needs": { en: "Specific needs", fr: "Besoins spécifiques", ar: "الاحتياجات الخاصة" },
  teaching: { en: "Teaching practice", fr: "Pédagogie", ar: "البيداغوجيا" },
  communication: { en: "Communication", fr: "Communication", ar: "التواصل" },
  family: { en: "Family and school", fr: "Famille & école", ar: "الأسرة والمدرسة" },
};

export function HomeSections({
  locale,
  courses,
  webinars,
  avsProfiles,
}: {
  locale: Locale;
  courses: CourseRow[];
  webinars: WebinarRow[];
  avsProfiles: AvsRow[];
}) {
  const c = t(locale);
  const ar = locale === "ar";
  const en = locale === "en";
  const categoryIcons: IconName[] = ["graduation", "users", "spark", "book", "mail", "shield"];
  const categories = [...new Set(courses.map((course) => course.category))].slice(0, 6);

  return (
    <>
      <section className="section discovery-section">
        <div className="container">
          <div className="section-title-row">
            <SectionHeading
              eyebrow={localText(locale, { en: "Explore by topic", fr: "Explorer par domaine", ar: "استكشف حسب المجال" })}
              title={localText(locale, { en: "Find the right starting point", fr: "Trouvez le bon point de départ", ar: "اختر نقطة البداية المناسبة" })}
              description={localText(locale, {
                en: "Clear topics help you reach the courses most relevant to your role and needs.",
                fr: "Des domaines lisibles pour accéder rapidement aux parcours les plus pertinents pour votre rôle et vos besoins.",
                ar: "مجالات واضحة تساعدك على الوصول إلى المسار الأقرب لدورك واحتياجاتك.",
              })}
            />
            <Link className="text-link desktop-only-link" href={`/${locale}/formations`}>{c.actions.browse}<Icon className="directional-icon" name="arrow" size={17} /></Link>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <Link className="category-card" href={`/${locale}/formations?category=${encodeURIComponent(category)}`} key={category}>
                <span><Icon name={categoryIcons[index] ?? "book"} size={21} /></span>
                <div><strong>{categoryLabels[category]?.[locale] ?? category.replaceAll("-", " ")}</strong><small>{localText(locale, { en: "View courses", fr: "Voir les formations", ar: "عرض الدورات" })}</small></div>
                <Icon className="directional-icon" name="chevron" size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section audience-section">
        <div className="container">
          <div className="section-title-row">
            <SectionHeading
              eyebrow={localText(locale, { en: "For everyone", fr: "Pour tous les publics", ar: "لجميع الفئات" })}
              title={localText(locale, { en: "Who can benefit from ANEI Academy?", fr: "Qui peut bénéficier de l’Académie ANEI ?", ar: "من يمكنه الاستفادة من أكاديمية ANEI؟" })}
              description={localText(locale, {
                en: "Institutions, schools, parents and students — everyone has a dedicated space.",
                fr: "Établissements, écoles, parents et étudiants : chacun dispose d’un espace dédié.",
                ar: "المؤسسات والمدارس والأولياء والتلاميذ: لكل فئة مساحتها الخاصة.",
              })}
            />
          </div>
          <div className="audience-grid">
            {[
              { key: "institution", role: "institution", icon: "map" as IconName, title: { en: "Institutions", fr: "Établissements", ar: "المؤسسات" }, body: { en: "Partnership agreements for public and community institutions, so their teams access sponsored learning remotely.", fr: "Ouvrez des conventions de partenariat pour permettre à vos équipes de se former à distance grâce à la prise en charge.", ar: "اتفاقيات شراكة للمؤسسات العمومية والجمعياتية لتمكين موظفيها من التكوين عن بعد." } },
              { key: "school", role: "teacher", icon: "book" as IconName, title: { en: "Schools & institutes", fr: "Écoles & instituts", ar: "المدارس والمعاهد" }, body: { en: "Stay connected with your students, share activities and build a modern digital learning environment.", fr: "Restez en contact avec vos élèves, partagez vos activités et offrez un environnement numérique de qualité.", ar: "ابق على تواصل دائم مع تلاميذك وانقل أنشطتك التعليمية وقدّم بيئة رقمية أفضل." } },
              { key: "parent", role: "parent", icon: "users" as IconName, title: { en: "Parents", fr: "Parents", ar: "الأولياء" }, body: { en: "Follow your children's progress and activity on the platform from the parent space.", fr: "Suivez la progression et l’activité de vos enfants sur la plateforme depuis l’espace parent.", ar: "تابع تقدم أبنائك ونشاطهم في المنصة من خلال فضاء الولي." } },
              { key: "student", role: "learner", icon: "graduation" as IconName, title: { en: "Students", fr: "Étudiants", ar: "التلاميذ" }, body: { en: "Start reviewing with the best support content and stay in touch with your teachers on the platform.", fr: "Commencez à réviser avec le meilleur contenu et restez en contact avec vos enseignants sur la plateforme.", ar: "ابدأ مراجعتك بأفضل محتوى داعم وابق على تواصل مع أساتذتك عبر المنصة." } },
            ].map((audience) => (
              <Link
                className="audience-card"
                key={audience.key}
                href={`/${locale}/register?role=${audience.role}`}
              >
                <span className="audience-tag"><Icon name="arrow" className="directional-icon" size={14} />{localText(locale, audience.title)}</span>
                <div className="audience-card-body">
                  <span className="audience-icon"><Icon name={audience.icon} size={20} /></span>
                  <h3>{localText(locale, audience.title)}</h3>
                  <p>{localText(locale, audience.body)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <div className="section-title-row">
            <SectionHeading
              eyebrow={localText(locale, { en: "Professional learning", fr: "Se former", ar: "التكوين" })}
              title={localText(locale, { en: "Courses designed for practice", fr: "Des parcours conçus pour la pratique", ar: "مسارات مصممة للممارسة" })}
              description={localText(locale, {
                en: "Structured, practical and certifying content for everyone involved in inclusive education.",
                fr: "Des contenus structurés, pratiques et certifiants pour chaque acteur de l’inclusion.",
                ar: "محتوى منظم وعملي مع شهادات لكل فاعل في التربية الدامجة.",
              })}
            />
            <Link className="text-link desktop-only-link" href={`/${locale}/formations`}>{c.actions.browse}<Icon className="directional-icon" name="arrow" size={17} /></Link>
          </div>
          <div className="course-grid compact-grid">
            {courses.slice(0, 3).map((course, index) => {
              const translated = courseTranslations.find((item) => item.slug === course.slug);
              const title = ar ? course.titleAr : en ? translated?.title.en ?? course.titleFr : course.titleFr;
              const summary = ar ? course.summaryAr : en ? translated?.description.en ?? course.summaryFr : course.summaryFr;
              return (
                <article className="course-card course-card-human" key={course.slug}>
                  <span className="course-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div className="course-card-body">
                    <span className="course-category-label">{categoryLabels[course.category]?.[locale] ?? course.category.replaceAll("-", " ")}</span>
                    <h3>{title}</h3>
                    <p>{summary}</p>
                    <div className="meta-row"><span><Icon name="clock" size={15} />{Math.max(1, Math.round(course.durationMinutes / 60))} h</span>{course.startAt ? <span><Icon name="calendar" size={15} />{formatDate(course.startAt, locale)}</span> : null}</div>
                    <div className="card-footer"><strong>{formatMillimes(course.priceMillimes, locale)}</strong><Link className="text-link" href={`/${locale}/formations/${course.slug}`}>{c.actions.details}<Icon className="directional-icon" name="arrow" size={16} /></Link></div>
                  </div>
                </article>
              );
            })}
            {!courses.length ? <p className="empty-state">{localText(locale, { en: "New courses are on their way.", fr: "De nouvelles formations arrivent bientôt.", ar: "دورات جديدة قادمة قريبًا." })}</p> : null}
          </div>
        </div>
      </section>

      <section className="section human-story-section">
        <div className="container human-story-grid">
          <div className="human-story-photo">
            <Image src="/media/anei-learning-story.webp" alt={localText(locale, { en: "Two people collaborating with educational materials", fr: "Deux personnes collaborant autour d’activités et de supports pédagogiques", ar: "شخصان يتعاونان حول أنشطة ومواد تعليمية" })} width={1200} height={900} sizes="(max-width: 900px) 100vw, 48vw" />
            <div className="human-story-label"><Icon name="spark" size={17} /><span>{localText(locale, { en: "Human-centred learning", fr: "Une pédagogie centrée sur l’humain", ar: "تعلم يركز على الإنسان" })}</span></div>
          </div>
          <div className="human-story-copy">
            <span className="eyebrow">{localText(locale, { en: "More than a catalogue", fr: "Plus qu’un catalogue", ar: "منصة مهنية، وليست مجرد كتالوج" })}</span>
            <h2>{localText(locale, { en: "An experience that helps you understand, apply and progress.", fr: "Une expérience qui aide à comprendre, appliquer, puis progresser.", ar: "مساحة تساعدك على الفهم، التطبيق، ثم التقدم." })}</h2>
            <p>{localText(locale, { en: "ANEI makes every step clear: what to learn, why it matters, how to apply it and what comes next.", fr: "ANEI est pensée pour rendre chaque étape lisible : qu’est-ce que j’apprends, pourquoi, comment je l’applique, et quelle est ma prochaine étape ?", ar: "صُممت ANEI لتجعل كل خطوة واضحة: ماذا أتعلم، لماذا، كيف أطبقه، وما هي الخطوة التالية؟" })}</p>
            <div className="human-story-points">
              <div><span>01</span><strong>{localText(locale, { en: "Learn for your role", fr: "Apprendre selon son rôle", ar: "تعلّم حسب دورك" })}</strong><p>{localText(locale, { en: "Courses for teachers, AVS professionals, specialists and families.", fr: "Des parcours pour enseignants, AVS, spécialistes et familles.", ar: "مسارات للمدرسين وAVS والأخصائيين والأسر." })}</p></div>
              <div><span>02</span><strong>{localText(locale, { en: "Put learning into practice", fr: "Passage à la pratique", ar: "تطبيق عملي" })}</strong><p>{localText(locale, { en: "Objectives, modules and resources connected to field work.", fr: "Objectifs, modules et ressources reliés au terrain.", ar: "أهداف ووحدات وموارد مرتبطة بالميدان." })}</p></div>
              <div><span>03</span><strong>{localText(locale, { en: "See your progress", fr: "Progression visible", ar: "تقدم قابل للمتابعة" })}</strong><p>{localText(locale, { en: "Progress, certificates and resources in one place.", fr: "Progression, certificats et ressources centralisés.", ar: "حفظ التقدم وشهادات وموارد في مساحة واحدة." })}</p></div>
            </div>
            <Link className="btn btn-primary" href={`/${locale}/about`}>{localText(locale, { en: "Discover our approach", fr: "Découvrir notre approche", ar: "اكتشف رؤيتنا" })}<Icon className="directional-icon" name="arrow" size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container webinar-feature">
          <div>
            <SectionHeading
              eyebrow={localText(locale, { en: "Live", fr: "En direct", ar: "مباشر" })}
              title={localText(locale, { en: "Stay connected to practice", fr: "Rester connecté aux pratiques", ar: "تعلم يبقى متصلًا بالممارسات" })}
              description={localText(locale, { en: "Talk with specialists, ask questions and find replays in your account.", fr: "Échangez avec des spécialistes, posez vos questions et retrouvez les replays dans votre espace.", ar: "تبادل مع المختصين واطرح أسئلتك واسترجع التسجيلات في مساحتك." })}
            />
            <Link className="btn btn-secondary" href={`/${locale}/webinaires`}>{c.nav.webinars}<Icon className="directional-icon" name="arrow" size={18} /></Link>
          </div>
          <div className="webinar-stack">
            {webinars.slice(0, 2).map((webinar, index) => {
              const translated = webinarTranslations.find((item) => item.title.fr === webinar.titleFr);
              const title = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
              const time = webinar.startsAt ? new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { hour: "2-digit", minute: "2-digit" }).format(webinar.startsAt) : "";
              return (
                <article className={index === 0 ? "webinar-card active" : "webinar-card"} key={webinar.id}>
                  <div className="date-tile"><strong>{webinar.startsAt?.getDate()}</strong><span>{webinar.startsAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-GB", { month: "short" }).format(webinar.startsAt) : ""}</span></div>
                  <div><span className="status-pill">{localText(locale, webinar.replayUrl ? { en: "Replay", fr: "Replay", ar: "إعادة" } : index === 0 ? { en: "Next live session", fr: "Prochain live", ar: "البث القادم" } : { en: "Coming soon", fr: "À venir", ar: "قريبًا" })}</span><h3>{title}</h3><p>{webinar.trainerName}{time ? ` · ${time}` : ""}</p></div>
                  <Link className="icon-button" href={`/${locale}/webinaires`} aria-label={localText(locale, { en: "View webinars", fr: "Voir les webinaires", ar: "عرض الندوات" })}><Icon className="directional-icon" name="chevron" size={20} /></Link>
                </article>
              );
            })}
            {!webinars.length ? <p className="empty-state">{localText(locale, { en: "No webinars are currently scheduled.", fr: "Aucun webinaire n’est programmé actuellement.", ar: "لا توجد ندوات مجدولة حاليًا." })}</p> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-title-row"><SectionHeading eyebrow={localText(locale, { en: "Qualified network", fr: "Réseau certifié", ar: "شبكة معتمدة" })} title={localText(locale, { en: "Find an AVS near you", fr: "Trouver un AVS près de vous", ar: "اعثر على AVS بالقرب منك" })} description={localText(locale, { en: "Search professional profiles by region and specialism.", fr: "Des profils formés et certifiés par l’Académie, consultables par région et spécialité.", ar: "ملفات مهنية مدرّبة ومعتمدة يمكن البحث فيها حسب الجهة والاختصاص." })} /><Link className="text-link desktop-only-link" href={`/${locale}/avs`}>{c.actions.browse}<Icon className="directional-icon" name="arrow" size={17} /></Link></div>
          <div className="avs-grid home-avs-grid">
            {avsProfiles.slice(0, 3).map((profile) => {
              const translated = avsTranslations.find((item) => item.name === profile.displayName);
              const specialty = ar ? profile.specialtyAr : en ? translated?.specialty.en ?? profile.specialtyFr : profile.specialtyFr;
              const city = ar ? profile.cityAr : en ? translated?.city.en ?? profile.cityFr : profile.cityFr;
              const initials = profile.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("");
              return (
                <article className="avs-card" key={profile.id}>
                  <div className="avs-avatar">{initials}</div>
                  <div className="avs-card-main">
                    <div className="avs-name-row"><h3>{profile.displayName}</h3>{profile.certified ? <span className="certified"><Icon name="check" size={13} />{localText(locale, { en: "Certified", fr: "Certifié", ar: "معتمد" })}</span> : null}</div>
                    <p className="avs-specialty">{specialty}</p>
                    <div className="meta-row"><span><Icon name="map" size={15} />{city}</span></div>
                  </div>
                </article>
              );
            })}
            {!avsProfiles.length ? <p className="empty-state">{localText(locale, { en: "No AVS profiles are currently listed.", fr: "Aucun profil AVS n’est actuellement répertorié.", ar: "لا توجد ملفات مرافق مدرسي حاليًا." })}</p> : null}
          </div>
        </div>
      </section>

    </>
  );
}
