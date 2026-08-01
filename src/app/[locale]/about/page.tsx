import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icon";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const values = [
    ["shield", ar ? "الاحترام" : "Respect", ar ? "نضع كرامة الشخص وحقه في المشاركة في صلب كل ممارسة." : "La dignité de la personne et son droit à participer guident chaque pratique."],
    ["users", ar ? "التعاون" : "Coopération", ar ? "نربط الأسرة والمدرسة والمختصين حول أهداف واضحة ومشتركة." : "Nous relions famille, école et spécialistes autour d’objectifs clairs et partagés."],
    ["spark", ar ? "الابتكار" : "Innovation", ar ? "نحوّل المعرفة العلمية إلى أدوات بسيطة وقابلة للتطبيق." : "Nous transformons les connaissances en outils simples, accessibles et applicables."],
    ["award", ar ? "الجودة" : "Exigence", ar ? "محتوى منظم وتقييم بالكفاءات وتحسين مستمر." : "Des contenus structurés, une évaluation par compétences et une amélioration continue."]
  ] as const;
  return (
    <>
      <PageHero eyebrow={ar ? "من نحن" : "À propos"} title={ar ? "مؤسسة تكوين في خدمة التربية الدامجة" : "Une Académie au service d’une inclusion concrète"} description={ar ? "نجمع التكوين المستمر والموارد المهنية وشبكة من الفاعلين لجعل الدمج ممارسة يومية قابلة للقياس." : "Nous réunissons formation continue, ressources professionnelles et réseau d’acteurs pour faire de l’inclusion une pratique quotidienne et mesurable."}/>
      <section className="section"><div className="container about-human-grid">
        <div className="about-human-photo"><Image src="/media/anei-learning-story.webp" alt={ar ? "متعلم يشارك في تجربة تدريب رقمية" : "Apprenant dans une expérience de formation numérique"} fill sizes="(max-width: 900px) 100vw, 46vw"/><div className="about-human-tag"><Icon name="users" size={17}/><span>{ar ? "المعرفة + الممارسة + التعاون" : "Connaissance + pratique + coopération"}</span></div></div>
        <div><SectionHeading eyebrow={ar ? "مهمتنا" : "Notre mission"} title={ar ? "من المعرفة إلى الممارسة" : "Passer des principes à la pratique"}/><p className="lead-copy">{ar ? "تعمل الأكاديمية على رفع كفاءة كل من يرافق الأطفال والأشخاص ذوي الاحتياجات الخاصة، عبر مسارات عملية وأدوات مشتركة ولغة مهنية موحّدة." : "L’Académie renforce les compétences de celles et ceux qui accompagnent les enfants et personnes à besoins spécifiques, grâce à des parcours pratiques, des outils communs et un langage professionnel partagé."}</p><p>{ar ? "من المدرس إلى المرافق المدرسي، ومن الأخصائي إلى الولي، نساعد كل طرف على فهم دوره والتعاون بفاعلية." : "De l’enseignant à l’AVS, du spécialiste au parent, chaque acteur trouve des repères pour comprendre son rôle et mieux coopérer."}</p><div className="about-mini-principles"><div><span>01</span><strong>{ar ? "رؤية مشتركة" : "Une vision commune"}</strong><p>{ar ? "بيئات وخدمات أكثر قدرة على الاستجابة للاختلاف." : "Des environnements et services qui s’adaptent aux besoins réels."}</p></div><div><span>02</span><strong>{ar ? "هدف قابل للقياس" : "Un objectif mesurable"}</strong><p>{ar ? "ممارسات يمكن ملاحظتها ومتابعتها وتحسينها." : "Des pratiques observables, suivies et améliorées."}</p></div></div></div>
      </div></section>
      <section className="section section-tint"><div className="container"><SectionHeading align="center" eyebrow={ar ? "قيمنا" : "Nos valeurs"} title={ar ? "إطار مهني وإنساني" : "Un cadre professionnel et humain"}/><div className="value-grid">{values.map(([icon, title, text]) => <article className="value-card" key={title}><span className="value-icon"><Icon name={icon} size={24}/></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="section"><div className="container objective-grid"><div><SectionHeading eyebrow={ar ? "أهدافنا" : "Nos objectifs"} title={ar ? "تكوين، ربط، دعم" : "Former, relier, outiller"}/></div><div className="objective-list">{[
        ar ? "تطوير مسارات تكوين مستمر عالية الجودة ومتاحة." : "Développer des parcours de formation continue de qualité et accessibles.",
        ar ? "إنتاج موارد عملية للمدرسة والأسرة والمختصين." : "Produire des ressources immédiatement utiles à l’école, aux familles et aux spécialistes.",
        ar ? "بناء شبكة مهنية موثوقة من المرافقين المدرسيين." : "Construire un réseau professionnel fiable d’AVS certifiés.",
        ar ? "تشجيع التعاون بين القطاعات والمهن." : "Faciliter la coopération entre secteurs, métiers et territoires."
      ].map((item, index) => <div className="objective-item" key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div></div></section>
    </>
  );
}
