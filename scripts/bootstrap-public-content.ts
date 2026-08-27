import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import { avsProfiles, courseModules, courses, lessons, newsPosts, resources, webinars } from "../src/server/db/schema";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_CATALOG_SEED !== "true") {
  throw new Error("Refusing production catalog bootstrap without ALLOW_PRODUCTION_CATALOG_SEED=true.");
}

const courseSeed = [
  {
    slug: "fondements-education-inclusive",
    titleFr: "Fondements de l’éducation inclusive",
    titleAr: "أسس التربية الدامجة",
    summaryFr: "Un parcours structuré pour comprendre les principes, observer les besoins et agir avec méthode.",
    summaryAr: "مسار منظم لفهم المبادئ وملاحظة الاحتياجات والعمل بمنهجية.",
    descriptionFr: "Ce parcours relie les fondements de l’inclusion à des situations professionnelles concrètes, avec des outils d’observation et de coopération.",
    descriptionAr: "يربط هذا المسار أسس الدمج بحالات مهنية عملية، مع أدوات للملاحظة والتعاون.",
    category: "education", level: "beginner", mode: "online", trainerName: "Équipe pédagogique ANEI",
    durationMinutes: 360, priceMillimes: 240000, startAt: new Date("2026-10-05T09:00:00+01:00"), featured: true,
    objectives: { fr: ["Comprendre les principes de l’inclusion", "Observer les besoins sans stigmatiser", "Construire un plan d’action partagé"], ar: ["فهم مبادئ الدمج", "ملاحظة الاحتياجات دون وصم", "بناء خطة عمل مشتركة"] },
  },
  {
    slug: "avs-accompagnement-professionnel",
    titleFr: "AVS : accompagnement professionnel",
    titleAr: "المرافقة المدرسية المهنية AVS",
    summaryFr: "Des repères pratiques pour accompagner l’autonomie, coordonner les acteurs et ajuster les aides.",
    summaryAr: "مرجع عملي لدعم الاستقلالية وتنسيق المتدخلين وتكييف المساعدة.",
    descriptionFr: "Une formation appliquée pour les AVS et équipes éducatives qui souhaitent clarifier leur posture, leurs outils et leur coordination.",
    descriptionAr: "تكوين تطبيقي لمرافقي AVS والفرق التربوية لتوضيح الأدوار والأدوات والتنسيق.",
    category: "avs", level: "intermediate", mode: "hybrid", trainerName: "Équipe pédagogique ANEI",
    durationMinutes: 420, priceMillimes: 320000, startAt: new Date("2026-10-19T09:00:00+01:00"), featured: true,
    objectives: { fr: ["Définir une posture professionnelle", "Soutenir l’autonomie de l’apprenant", "Coopérer avec la famille et l’équipe"], ar: ["تحديد وضعية مهنية واضحة", "دعم استقلالية المتعلم", "التعاون مع الأسرة والفريق"] },
  },
];

const resourceSeed = [
  { slug: "grille-observation-inclusive", titleFr: "Grille d’observation inclusive", titleAr: "شبكة ملاحظة دامجة", descriptionFr: "Une trame concise pour observer l’environnement, les obstacles et les appuis sans réduire l’apprenant à un diagnostic.", descriptionAr: "نموذج موجز لملاحظة البيئة والعوائق وعوامل الدعم دون اختزال المتعلم في التشخيص.", audienceFr: "Enseignants, AVS et spécialistes", audienceAr: "المدرسون ومرافقو AVS والمختصون", type: "sheet", level: "beginner", priceMillimes: 0 },
  { slug: "guide-cooperation-famille-ecole", titleFr: "Guide de coopération famille-école", titleAr: "دليل التعاون بين الأسرة والمدرسة", descriptionFr: "Des repères de préparation, d’écoute et de suivi pour des échanges utiles et respectueux.", descriptionAr: "مبادئ للتحضير والإنصات والمتابعة من أجل تواصل مفيد ومحترم.", audienceFr: "Familles et équipes éducatives", audienceAr: "الأسر والفرق التربوية", type: "guide", level: "beginner", priceMillimes: 0 },
] as const;

const webinarSeed = [
  { slug: "adapter-classe-sans-stigmatiser", titleFr: "Adapter la classe sans stigmatiser", titleAr: "تكييف القسم دون وصم", descriptionFr: "Une session pratique sur les ajustements universels et les adaptations ciblées.", descriptionAr: "جلسة عملية حول التكييفات الشاملة والتعديلات الموجهة.", trainerName: "Équipe pédagogique ANEI", startsAt: new Date("2026-09-24T18:00:00+01:00") },
  { slug: "cooperer-avec-les-familles", titleFr: "Coopérer avec les familles", titleAr: "التعاون مع الأسر", descriptionFr: "Préparer des échanges clairs, partager les observations et décider ensemble.", descriptionAr: "إعداد تواصل واضح وتبادل الملاحظات واتخاذ القرار معًا.", trainerName: "Équipe pédagogique ANEI", startsAt: new Date("2026-10-15T18:00:00+01:00") },
] as const;

const newsSeed = [
  { slug: "ouverture-inscriptions-automne-2026", tagFr: "Formations", tagAr: "التكوين", titleFr: "Ouverture des inscriptions – automne 2026", titleAr: "فتح التسجيلات لخريف 2026", excerptFr: "Deux parcours professionnels ouvrent leurs inscriptions pour accompagner les pratiques inclusives.", excerptAr: "فتح التسجيل في مسارين مهنيين لدعم الممارسات الدامجة.", contentFr: "Les inscriptions sont ouvertes pour les parcours Fondements de l’éducation inclusive et AVS : accompagnement professionnel. Les programmes privilégient des méthodes applicables, des ressources structurées et la coopération entre acteurs.", contentAr: "فُتح التسجيل في مساري أسس التربية الدامجة والمرافقة المدرسية المهنية. تركز البرامج على أساليب قابلة للتطبيق وموارد منظمة والتعاون بين المتدخلين.", publishedAt: new Date("2026-08-20T09:00:00+01:00") },
  { slug: "nouvelle-bibliotheque-pratique", tagFr: "Ressources", tagAr: "الموارد", titleFr: "Deux nouveaux outils dans la bibliothèque", titleAr: "أداتان جديدتان في المكتبة", excerptFr: "Une grille d’observation et un guide famille-école rejoignent les ressources ANEI.", excerptAr: "إضافة شبكة ملاحظة ودليل للتعاون بين الأسرة والمدرسة إلى موارد ANEI.", contentFr: "La bibliothèque accueille deux outils gratuits conçus pour soutenir l’observation inclusive et la qualité du dialogue entre familles et équipes éducatives.", contentAr: "تضم المكتبة أداتين مجانيتين لدعم الملاحظة الدامجة وتحسين الحوار بين الأسر والفرق التربوية.", publishedAt: new Date("2026-08-14T09:00:00+01:00") },
] as const;

const avsSeed = [
  { displayName: "Profil AVS démonstration 01", cityFr: "Tunis", cityAr: "تونس", specialtyFr: "Autonomie et inclusion scolaire", specialtyAr: "الاستقلالية والدمج المدرسي", availabilityFr: "Exemple non réservable", availabilityAr: "مثال غير متاح للحجز", bioFr: "Profil fictif clairement identifié, destiné à présenter le fonctionnement du réseau ANEI.", bioAr: "ملف افتراضي موضح بوضوح لعرض طريقة عمل شبكة ANEI.", certified: false },
  { displayName: "Profil AVS démonstration 02", cityFr: "Ariana", cityAr: "أريانة", specialtyFr: "Communication et fonctions exécutives", specialtyAr: "التواصل والوظائف التنفيذية", availabilityFr: "Exemple non réservable", availabilityAr: "مثال غير متاح للحجز", bioFr: "Profil fictif clairement identifié, destiné à présenter le fonctionnement du réseau ANEI.", bioAr: "ملف افتراضي موضح بوضوح لعرض طريقة عمل شبكة ANEI.", certified: false },
] as const;

async function main() {
  for (const [courseIndex, item] of courseSeed.entries()) {
    const [course] = await db.insert(courses).values({ ...item, published: true }).onConflictDoUpdate({ target: courses.slug, set: { ...item, published: true, updatedAt: new Date() } }).returning();
    for (const position of [1, 2]) {
      const [courseModule] = await db.insert(courseModules).values({ courseId: course.id, position, titleFr: position === 1 ? "Comprendre et observer" : "Agir et coopérer", titleAr: position === 1 ? "الفهم والملاحظة" : "العمل والتعاون", descriptionFr: "Une séquence directement reliée aux situations professionnelles.", descriptionAr: "وحدة مرتبطة مباشرة بالحالات المهنية." }).onConflictDoUpdate({ target: [courseModules.courseId, courseModules.position], set: { titleFr: position === 1 ? "Comprendre et observer" : "Agir et coopérer", titleAr: position === 1 ? "الفهم والملاحظة" : "العمل والتعاون" } }).returning();
      await db.insert(lessons).values({ courseId: course.id, moduleId: courseModule.id, position, titleFr: position === 1 ? "Repères essentiels" : "Mise en pratique", titleAr: position === 1 ? "مفاهيم أساسية" : "تطبيق عملي", descriptionFr: "Une leçon structurée avec objectifs et activité de transfert.", descriptionAr: "درس منظم بأهداف ونشاط تطبيقي.", durationSeconds: courseIndex === 0 ? 1500 : 1800, preview: false }).onConflictDoUpdate({ target: [lessons.courseId, lessons.position], set: { moduleId: courseModule.id, titleFr: position === 1 ? "Repères essentiels" : "Mise en pratique", titleAr: position === 1 ? "مفاهيم أساسية" : "تطبيق عملي" } });
    }
  }
  for (const item of resourceSeed) await db.insert(resources).values({ ...item, published: true }).onConflictDoUpdate({ target: resources.slug, set: { ...item, published: true } });
  for (const item of webinarSeed) await db.insert(webinars).values({ ...item, durationMinutes: 75, meetingUrl: null, replayUrl: null, published: true }).onConflictDoUpdate({ target: webinars.slug, set: { ...item, durationMinutes: 75, published: true } });
  for (const item of newsSeed) await db.insert(newsPosts).values({ ...item, published: true }).onConflictDoUpdate({ target: newsPosts.slug, set: { ...item, published: true, updatedAt: new Date() } });
  for (const item of avsSeed) {
    const [existing] = await db.select({ id: avsProfiles.id }).from(avsProfiles).where(eq(avsProfiles.displayName, item.displayName)).limit(1);
    if (existing) await db.update(avsProfiles).set({ ...item, visible: true }).where(eq(avsProfiles.id, existing.id));
    else await db.insert(avsProfiles).values({ ...item, visible: true });
  }
  console.log("Public catalog ready: 2 courses, 2 resources, 2 webinars, 2 news posts, 2 AVS profiles.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Public catalog bootstrap failed.");
  process.exitCode = 1;
}).finally(async () => pool.end());
