import "dotenv/config";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { hardenPostgresConnectionString } from "../src/server/db/connection-string";
import * as schema from "../src/server/db/schema";
import {
  courses,
  courseModules,
  lessons,
  learningAssessment,
  learningQuestion,
  learningQuestionOption,
  resources,
  enrollments,
  user,
} from "../src/server/db/schema";

const COURSE_SLUG = "trouble-spectre-autisme-accompagnement-scolaire";
const RESOURCE_SLUG = "guide-complet-autisme-accompagnement-scolaire-anei";

async function getDb(connectionString?: string) {
  const rawUrl = connectionString || process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("Missing DATABASE_URL");

  const url = hardenPostgresConnectionString(rawUrl);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export async function seedAutismData(targetDbUrl?: string) {
  const { db, pool } = await getDb(targetDbUrl);

  console.log(`\n======================================================`);
  console.log(`🚀 Starting Seed: Autism Resource, Course, Lessons & Certification Quiz`);
  console.log(`======================================================\n`);

  try {
    // ----------------------------------------------------
    // 1. RESOURCE (Bibliothèque)
    // ----------------------------------------------------
    console.log("📚 1. Seeding Resource in Bibliothèque...");
    const [existingResource] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.slug, RESOURCE_SLUG))
      .limit(1);

    const resourceId = existingResource?.id || crypto.randomUUID();
    const resourcePayload = {
      id: resourceId,
      slug: RESOURCE_SLUG,
      titleFr: "Référentiel Complet : Trouble du Spectre de l'Autisme (TSA) & Accompagnement Scolaire Inclusif",
      titleAr: "الدليل الشامل: اضطراب طيف التوحّد ومرافقة التلميذ في الوسط المدرسي والممارسات المبنية على البراهين",
      descriptionFr:
        "Guide officiel de référence en 3 grands chapitres pour enseignants, AVS et professionnels de l'éducation : fondements neuro-développementaux, posture stratégique de l'accompagnant, pratiques recommandées fondées sur les preuves (EBP) et analyse fonctionnelle des comportements défis (ABC).",
      descriptionAr:
        "دليل مرجعي رسمي في 3 فصول رئيسية للمربين والمرافقين المدرسيين والمختصين: الأسس النمائية العصبية، الدور الاستراتيجي للمرافق المدرسي (AVS)، الممارسات المبنية على البراهين (EBP) والتحليل الوظيفي للسلوكيات التحدّية (ABC).",
      audienceFr: "AVS, Enseignants, Orthophonistes, Psychologues, Équipes éducatives",
      audienceAr: "المرافقون المدرسيون (AVS)، المعلمون، أخصائيو التخاطب، الأخصائيون النفسيون، الفرق التربوية",
      type: "guide",
      level: "beginner",
      priceMillimes: 0, // Gratuit
      coverImage: "/images/resources/autisme-guide-cover.webp",
      downloadUrl: "/documents/guide-complet-autisme-accompagnement-scolaire-anei.pdf",
      published: true,
    };

    if (existingResource) {
      await db.update(resources).set(resourcePayload).where(eq(resources.id, resourceId));
      console.log(`   ✓ Resource updated (ID: ${resourceId})`);
    } else {
      await db.insert(resources).values(resourcePayload);
      console.log(`   ✓ Resource inserted (ID: ${resourceId})`);
    }

    // ----------------------------------------------------
    // 2. COURSE (Formations)
    // ----------------------------------------------------
    console.log("\n🎓 2. Seeding Course in Formations...");
    const [existingCourse] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, COURSE_SLUG))
      .limit(1);

    const courseId = existingCourse?.id || crypto.randomUUID();
    const coursePayload = {
      id: courseId,
      slug: COURSE_SLUG,
      titleFr: "Accompagnement Scolaire & Pratiques Recommandées dans les Troubles du Spectre de l'Autisme (TSA)",
      titleAr: "المرافقة المدرسية والممارسات الموصى بها في اضطرابات طيف التوحد (TSA)",
      summaryFr:
        "Formation certifiante d'excellence sur les troubles du spectre de l'autisme : repérage précoce, structuration de l'espace-temps, gestion des crises et pratiques fondées sur les preuves (EBP).",
      summaryAr:
        "دورة تدريبية معتمدة ومتقدمة حول اضطرابات طيف التوحد: التشخيص النمائي، الهيكلة الزمانية والمكانية، التعامل مع نوبات الغضب والممارسات المبنية على البراهين.",
      descriptionFr:
        "Cette formation approfondie en 4 modules thématiques et 8 leçons interactives outille concrètement les accompagnants (AVS), enseignants et professionnels face aux défis du TSA en classe ordinaire. Vous y apprendrez à décoder la dyade autistique (DSM-5-TR), à aménager la classe avec la structuration TEACCH, à appliquer les 28 pratiques fondées sur les preuves (EBP), à estomper les guidances physiques vers l'autonomie et à conduire une analyse comportementale fonctionnelle (ABC).",
      descriptionAr:
        "تمنحك هذه الدورة الشاملة في 4 وحدات تدريبية و8 دروس تفاعلية الأدوات الميدانية لمرافقة التلميذ ذي طيف التوحد في الفصل العادي بنجاح. ستتعلم تشخيص الثنائي التوحدي (DSM-5-TR)، هندسة بيئة القسم وفق منهجية تيتش (TEACCH)، تطبيق الممارسات المبنية على الأدلة والبراهين (EBP)، التدرج في سحب المساعدة نحو الاستقلالية، وإجراء التحليل الوظيفي للسلوكيات التحدّية (ABC).",
      category: "special-needs",
      level: "intermediate",
      mode: "online",
      trainerName: "Dr. Salma Ben Amor & Équipe Pédagogique ANEI",
      durationMinutes: 360,
      priceMillimes: 0, // Inscription gratuite pour tous
      coverImage: "/images/courses/autisme-formation-cover.webp",
      startAt: new Date("2026-10-18"),
      published: true,
      featured: true,
      objectives: {
        fr: [
          "Comprendre les fondements neurobiologiques et la dyade diagnostique du DSM-5-TR",
          "Maîtriser la structuration spatio-temporelle TEACCH et les emplois du temps visuels",
          "Appliquer les 28 pratiques fondées sur les preuves (EBP) et le prompt fading",
          "Conduire une analyse fonctionnelle ABC face aux comportements défis",
          "Favoriser l'inclusion sociale et la communication alternative et améliorée (CAA)",
        ],
        ar: [
          "فهم الأسس العصبية البيولوجية والثنائي التشخيصي في DSM-5-TR",
          "إتقان الهيكلة المكانية والزمانية وفق منهجية تيتش والجداول البصرية",
          "تطبيق 28 ممارسة قائمة على الأدلة والبراهين (EBP) والتلاشي المنظم للمساعدة",
          "تنفيذ التحليل السلوكي الوظيفي ABC للتعامل الوقائي مع السلوكيات التحدّية",
          "تعزيز الاندماج الاجتماعي واستخدام وسائل التواصل البديل والمعزز (CAA)",
        ],
      },
      updatedAt: new Date(),
    };

    if (existingCourse) {
      await db.update(courses).set(coursePayload).where(eq(courses.id, courseId));
      console.log(`   ✓ Course updated (ID: ${courseId})`);
    } else {
      await db.insert(courses).values(coursePayload);
      console.log(`   ✓ Course inserted (ID: ${courseId})`);
    }

    // ----------------------------------------------------
    // 3. COURSE MODULES (4 modules)
    // ----------------------------------------------------
    console.log("\n📦 3. Seeding Course Modules...");
    const MODULES_DATA = [
      {
        position: 1,
        titleFr: "Module 1 : Fondements Neuro-développementaux & Évolution Diagnostique du TSA",
        titleAr: "الوحدة 1: الأسس النمائية العصبية والتطور التشخيصي لطيف التوحد",
        descriptionFr: "Comprendre l'hétérogénéité du spectre, le passage de la triade à la dyade et les spécificités du fonctionnement cognitif autistique.",
        descriptionAr: "فهم التباين الواسع في طيف التوحد، الانتقال من الثالوث إلى الثنائي التشخيصي وخصائص الإدراك العصبي التوحدي.",
      },
      {
        position: 2,
        titleFr: "Module 2 : Rôle Stratégique & Posture Professionnelle de l'AVS / Accompagnant",
        titleAr: "الوحدة 2: الدور الاستراتيجي والمهام المهنية للمرافق المدرسي (AVS)",
        descriptionFr: "Délimiter la mission de l'accompagnant : médiateur d'apprentissage, facilitateur d'inclusion sans se substituer à l'enseignant ni créer de dépendance.",
        descriptionAr: "تحديد المهام الدقيقة للمرافق: وسيط بيداغوجي وميسر للاندماج الصفي دون الحلول محل المعلم أو تكريس الاعتمادية.",
      },
      {
        position: 3,
        titleFr: "Module 3 : Méthodologies Pédagogiques & Pratiques Fondées sur les Preuves (EBP)",
        titleAr: "الوحدة 3: المنهجيات البيداغوجية والممارسات المبنية على الأدلة والبراهين",
        descriptionFr: "Structuration de l'environnement (TEACCH), outils de communication alternative (PECS), scénarios sociaux et techniques d'estompage (fading).",
        descriptionAr: "الهيكلة البصرية المنظمة (TEACCH)، أدوات التواصل البديل (PECS)، القصص الاجتماعية وتقنيات تلاشي المساعدة.",
      },
      {
        position: 4,
        titleFr: "Module 4 : Gestion des Comportements Défis, Analyse ABC & Grilles Pratiques",
        titleAr: "الوحدة 4: التعامل مع السلوكيات التحدّية، تحليل ABC والشبكات الميدانية",
        descriptionFr: "Décodage des crises sensorielles et émotionnelles, identification des fonctions du comportement (échappement, attention, tangible, sensoriel) et interventions proactives.",
        descriptionAr: "تفكيك نوبات الغضب والاضطراب الحسي، تحديد وظيفة السلوك الحقيقية والتدخلات الاستباقية لتوفير بيئة دامجة آمنة.",
      },
    ];

    const moduleMap = new Map<number, string>();
    for (const mod of MODULES_DATA) {
      const [existingMod] = await db
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(and(eq(courseModules.courseId, courseId), eq(courseModules.position, mod.position)))
        .limit(1);

      const modId = existingMod?.id || crypto.randomUUID();
      const modPayload = {
        id: modId,
        courseId,
        position: mod.position,
        titleFr: mod.titleFr,
        titleAr: mod.titleAr,
        descriptionFr: mod.descriptionFr,
        descriptionAr: mod.descriptionAr,
      };

      if (existingMod) {
        await db.update(courseModules).set(modPayload).where(eq(courseModules.id, modId));
      } else {
        await db.insert(courseModules).values(modPayload);
      }
      moduleMap.set(mod.position, modId);
      console.log(`   ✓ Module ${mod.position} ready (ID: ${modId})`);
    }

    // ----------------------------------------------------
    // 4. LESSONS (8 detailed lessons covering the 3 chapters)
    // ----------------------------------------------------
    console.log("\n📖 4. Seeding Course Lessons (8 interactive lessons)...");
    const LESSONS_DATA = [
      {
        modulePos: 1,
        position: 1,
        durationSeconds: 1800,
        titleFr: "De la Triade de Wing à la Dyade Diagnostique du DSM-5-TR",
        titleAr: "من ثالوث وينغ إلى الثنائي التشخيصي في DSM-5-TR",
        descriptionFr: `### 1. Contexte Historique & Révolution Nosographique
Le Trouble du Spectre de l'Autisme (TSA) est un trouble neuro-développemental précoce caractérisé par une hétérogénéité clinique majeure. Historiquement, Lorna Wing (1979) et le DSM-IV décrivaient une « triade d'altérations » :
1. Altération de la communication verbale et non verbale.
2. Altération des interactions sociales réciproques.
3. Comportements répétitifs, stéréotypés et intérêts restreints.

### 2. Le Modèle Dyadique du DSM-5 et DSM-5-TR
Depuis 2013, le DSM-5 opère une simplification conceptuelle rigoureuse en regroupant les deux premiers pôles en une « dyade » clinique :
- **Axe A : Déficits persistants de la communication et des interactions sociales** dans des contextes variés (réciprocité socio-émotionnelle, communication non verbale, ajustement aux contextes relationnels).
- **Axe B : Caractère restreint et répétitif des comportements, des intérêts ou des activités** (stéréotypies motrices, intolérance au changement, adhésion inflexible aux routines, intérêts hautement circonscrits).

### 3. L'Intégration Cruciale des Particularités Sensorielles
Grande avancée du DSM-5 : la reconnaissance explicite des anomalies de traitement sensoriel (hyper ou hypo-réactivité aux stimuli sensoriels ou intérêt inhabituel pour des aspects sensoriels de l'environnement).

### 4. Niveaux de Sévérité & Besoins de Soutien
Le diagnostic s'accompagne désormais de 3 niveaux d'intensité d'aide requise :
- Niveau 1 : « Nécessite un soutien »
- Niveau 2 : « Nécessite un soutien important »
- Niveau 3 : « Nécessite un soutien très important »`,
        descriptionAr: `### 1. السياق التاريخي والتطور التشخيصي
اضطراب طيف التوحد هو اضطراب نمائي عصبي مبكر يتميز بتباين سريري واسع. تاريخيًا، وصفت لورنا وينغ (1979) والدليل التشخيصي الرابع (DSM-IV) ما عُرف بـ «ثالوث القصور»:
1. قصور في التواصل اللفظي وغير اللفظي.
2. قصور في التفاعل الاجتماعي المتبادل.
3. سلوكيات واهتمامات نمطية وتكرارية ومحدودة.

### 2. النموذج الثنائي الحديث في DSM-5 و DSM-5-TR
منذ عام 2013، أحدث الدليل التشخيصي الخامس نقلة نوعية بدمج المجالين الأولين ليصبح التشخيص مرتكزًا على «ثنائي سريري»:
- **المجال (أ) : قصور مستمر في التواصل الاجتماعي والتفاعل المتبادل** عبر سياقات متعددة (المشاركة الوجدانية، التواصل غير اللفظي، فهم العلاقات وتكييف السلوك).
- **المجال (ب) : أنماط سلوكية أو اهتمامات أو أنشطة مقيدة وتكرارية** (حركات نمطية، تمسك مفرط بالروتين ومقاومة التغيير، اهتمامات ضيقة النطاق).

### 3. إدماج الجانب الحسي كمعيار تشخيصي رسمي
من أهم الإضافات العلمية إدراج فرط أو خمول الاستجابة للمثيرات الحسية (الأصوات، الأضواء، الروائح، الملمس) كمعيار تشخيصي جوهري.

### 4. مستويات الدعم والاحتياج (3 مستويات):
- المستوى 1: «يحتاج إلى دعم»
- المستوى 2: «يحتاج إلى دعم كبير»
- المستوى 3: «يحتاج إلى دعم مكثف للغاية»`,
      },
      {
        modulePos: 1,
        position: 2,
        durationSeconds: 2400,
        titleFr: "Profil Cognitif, Cohérence Centrale & Fonctions Exécutives dans le TSA",
        titleAr: "الملف الإدراكي، التماسك المركزي والوظائف التنفيذية في طيف التوحد",
        descriptionFr: `### 1. La Théorie de l'Esprit (Theory of Mind - ToM)
Mise en évidence par Baron-Cohen et Frith, la théorie de l'esprit désigne la capacité à inférer et attribuer des états mentaux (pensées, intentions, croyances, émotions) à autrui pour anticiper ses comportements. Chez l'élève avec TSA :
- Difficulté à comprendre l'implicite, l'ironie, les métaphores et le second degré.
- Difficulté à concevoir que l'autre puisse posséder une information différente de la sienne (fausse croyance).

### 2. Le Modèle de la Faible Cohérence Centrale (Uta Frith)
Le traitement de l'information privilégie le détail au détriment de la vue d'ensemble (traitement local plutôt que global).
- **Force :** Remarquable acuité visuelle, détection rapide d'erreurs minutieuses, mémoire des détails.
- **Défi scolaire :** Difficulté à synthétiser l'idée générale d'un texte, d'un problème ou d'une consigne composite.

### 3. Le Dysfonctionnement Exécutif
Les fonctions exécutives correspondent au chef d'orchestre cognitif du cerveau :
- **Inhibition motrice et verbale :** Difficulté à réfréner une pulsion immédiate.
- **Flexibilité cognitive :** Résistance anxieuse face à un changement soudain d'activité ou de planning.
- **Planification & Mémoire de travail :** Difficulté à séquencer une tâche complexe en étapes ordonnées.`,
        descriptionAr: `### 1. نظرية العقل (Theory of Mind - ToM)
أوضح بارون كوهين وأوتا فريث أن نظرية العقل هي القدرة على استنتاج وإدراك الحالات الذهنية للآخرين (أفكارهم، نواياهم، معتقداتهم ومشاعرهم). لدى التلميذ ذي طيف التوحد:
- صعوبة استيعاب المعاني الضمنية، الكنايات، التلميحات والسخرية غير المباشرة.
- التعامل مع الكلمات بظاهرها الحرفي الدقيق دون تأويل سياقي.

### 2. ضعف التماسك المركزي (Weak Central Coherence)
يميل الدماغ في طيف التوحد إلى معالجة التفاصيل الدقيقة على حساب النظرة الكلية الشاملة.
- **نقطة قوة:** دقة ملاحظة بصرية استثنائية، انتباه للأخطاء الدقيقة، ذاكرة ممتازة للتفاصيل.
- **تحدٍ مدرسي:** صعوبة استخلاص الفكرة العامة لنص قرائي أو فهم الهدف العام لمسألة مركبة.

### 3. اضطراب الوظائف التنفيذية (Executive Dysfunctions)
الوظائف التنفيذية هي القائد الموجه للعمليات الذهنية داخل الدماغ:
- **المرونة الذهنية:** صعوبة بالغة في الانتقال المفاجئ من نشاط إلى آخر.
- **التخطيط وتنظيم المهام:** عجز عن تجزئة التكليف المدرسي الطويل إلى خطوات تسلسلية مرتبة.
- **كبح الاندفاع:** صعوبة ضبط الاستجابة الفورية عند حدوث مثير مثير للاهتمام.`,
      },
      {
        modulePos: 2,
        position: 3,
        durationSeconds: 2100,
        titleFr: "La Posture de l'AVS : Faciliter l'Autonomie sans Créer de Dépendance",
        titleAr: "الموقف المهني للمرافق: تعزيز الاستقلالية وتجنب فخ الاعتمادية",
        descriptionFr: `### 1. L'Accompagnant Scolaire (AVS) : Définition & Finalité
L'AVS n'est ni un répétiteur scolaire, ni un enseignant bis, ni un soignant médical. Son mandat fondamental est d'être un facilitateur d'inclusion et un catalyseur d'autonomie.
- Il compense les empêchements liés aux particularités neurobiologiques de l'élève.
- Il crée des ponts avec l'enseignant et les pairs sans jamais faire écran physique ou social.

### 2. Le Danger Majeur : La « Dépendance à l'Adulte » (Prompt Dependency)
Une présence trop rapprochée ou continue produit l'effet inverse de l'inclusion :
- L'élève n'agit plus que lorsqu'on lui tient la main ou qu'on lui ordonne verbalement d'agir.
- Les autres élèves s'adressent à l'AVS plutôt qu'à leur camarade.
- L'élève développe une passivité acquise (learned helplessness).

### 3. Les Règles de Posture Éthique :
- **Se tenir à bonne distance :** Prendre du recul physique dès que l'élève est capable de commencer ou poursuivre seul.
- **Ne pas faire à la place :** Guider le geste si nécessaire, mais ne jamais écrire, dessiner ou ranger à la place de l'enfant.
- **Neutralité émotionnelle bienveillante :** Ton de voix calme, débit ralenti, absence de cris ou de gestes brusques.
- **Coopération tripartite :** Coordination quotidienne avec l'enseignant et transmission bienveillante à la famille.`,
        descriptionAr: `### 1. المرافق المدرسي (AVS): التعريف والرسالة
المرافق المدرسي ليس مدرسًا خصوصيًا، وليس بديلاً عن معلم الفصل، وليس معالجًا طبيًا. رسالته المحورية هي تيسير الإدماج وتمكين التلميذ من الاعتماد على نفسه.
- يعوّض الصعوبات الناتجة عن الخصائص النمائية للتلميذ.
- يبني جسور التواصل مع المعلم والزملاء دون أن يتحول إلى حاجز عازل في القسم.

### 2. الخطر الأكبر: الاعتمادية المطلقة على المرافق (Prompt Dependency)
التواجد اللصيق والمفرط يؤدي إلى نتائج عكسية تعيق الاندماج الحقيقي:
- يصبح التلميذ عاجزًا عن المبادرة إلا إذا أُمسكت يده أو وُجهت له أوامر لفظية متكررة.
- يتحدث بقية التلاميذ مع المرافق بدلاً من التفاعل المباشر مع زميلهم.
- وقوع التلميذ في «العجز المكتسب» وضعف تقدير الذات.

### 3. قواعد الموقف المهني والأخلاقي:
- **المسافة الآمنة الذكية:** الابتعاد خطوة إلى الوراء فور تمكن التلميذ من بدء العمل بمفرده.
- **عدم القيام بالعمل بدلاً عن التلميذ:** مساعدة التلميذ على الإنجاز، مع تجنب الكتابة أو الرسم أو جمع الأدوات نيابة عنه.
- **الهدوء الانفعالي الحاني:** صوت هادئ، كلمات واضحة ومقتضبة، خلو تام من الصراخ أو الحركات المباغتة.
- **الشراكة والتنسيق اليومي:** التنسيق المستمر مع معلم القسم وتوثيق الملاحظات الإيجابية في كراس التواصل مع الأولياء.`,
      },
      {
        modulePos: 2,
        position: 4,
        durationSeconds: 2700,
        titleFr: "Aménagements Physiques & Sensoriels de la Classe Ordinaire",
        titleAr: "التهيئة المادية والحسية لفصل التعليم الدامج",
        descriptionFr: `### 1. Pourquoi Aménager la Classe ?
Pour un élève avec TSA, une classe ordinaire peut représenter un environnement sensoriel agressif et déstructurant : néons fluorescents scintillants, bruits de chaises, clameur des voix, affichages multicolores surchargés. L'aménagement ergonomique prévient la fatigue cognitive et l'apparition de crises.

### 2. Les Piliers de l'Aménagement Sensoriel :
- **Atténuation acoustique :** Installation d'embouts silencieux en feutre ou balles de tennis sous les chaises et les tables. Mise à disposition immédiate d'un casque antibruit réducteur de décibels.
- **Aménagement visuel :** Éviter les décorations mobiles au-dessus de la tête de l'élève. Préférer un éclairage indirect ou doux.
- **Le « Coin Calme » (Refuge sensoriel) :** Un espace délimité (paravent, pouf, coussin lesté) où l'élève peut s'isoler 5 à 10 minutes pour faire redescendre sa tension nerveuse sans quitter la classe.

### 3. Emplacement Stratégique du Pupitre :
- Ne jamais placer l'élève près de la porte d'entrée ou de la corbeille à papier (flux permanents de passages).
- Privilégier un coin calme avec vue directe et dégagée sur l'enseignant et le tableau.
- Prévoir un bac individuel étiqueté avec des pictogrammes pour chaque matière.`,
        descriptionAr: `### 1. لماذا نهيئ بيئة القسم؟
تمثل قاعة الدرس العادية بيئة حسية ضاغطة ومربكة للطفل ذي طيف التوحد: وميض أضواء النيون، صرير الكراسي على الأرضية، أصوات الزملاء، والملصقات الجدارية الكثيفة. التهيئة الحكيمة تمنع استنزاف طاقة التلميذ الذهنية وتقي من نوبات الغضب والانهيار الحسي.

### 2. ركائز التهيئة الحسية:
- **خفض الضجيج الصوتي:** وضع قطع لباد عازل أو كرات تنس تحت أرجل الكراسي والطاولات لمنع الاحتكاك المزعج، وتوفير سماعات خافضة للضوضاء في متناول التلميذ.
- **التنظيم البصري المريح:** تقليص المثيرات الجدارية المشوشة، وتفضيل الإضاءة الطبيعية الموزعة بهدوء.
- **«الركن الهادئ» (الملاذ الحسي):** فضاء مخصص داخل القسم (ستار خفيف، وسادة مريحة، بطانية ضاغطة) يتيح للتلميذ تهدئة جهازه العصبي لمدة 5 إلى 10 دقائق دون الحاجة للخروج من الفصل.

### 3. التموضع الاستراتيجي لطاولة التلميذ:
- تجنب وضع التلميذ قرب باب القسم أو سلة المهملات حيث تكثر الحركة والازدحام.
- اختيار موقع جانبي هادئ يضمن رؤية مستقيمة واضحة للسبورة وللمعلم.
- تخصيص صناديق فردية مرقمة ومزودة برموز بصرية لكل مادة دراسية.`,
      },
      {
        modulePos: 3,
        position: 5,
        durationSeconds: 2400,
        titleFr: "La Structuration Visuelle de l'Espace & du Temps (Principes TEACCH)",
        titleAr: "الهيكلة البصرية للمكان والزمان (مبادئ نموذج تيتش TEACCH)",
        descriptionFr: `### 1. Le Programme TEACCH : Origine & Philosophie
Développé à l'Université de Caroline du Nord par Eric Schopler, le programme TEACCH (Treatment and Education of Autistic and Related Communication Handicapped Children) repose sur l'enseignement structuré et l'adaptation de l'environnement aux particularités de la pensée autistique.

### 2. Les 4 Niveaux de Structuration :
1. **La structuration physique de l'espace :** Chaque lieu a une fonction unique et clairement identifiée (zone de travail individuel, zone de groupe, coin calme, zone de loisir).
2. **L'emploi du temps visuel individualisé :** Répond à 3 questions anxiogènes fondamentales : *Que vais-je faire ? Dans quel ordre ? Quand est-ce que ce sera terminé ?*
3. **Le système de travail de gauche à droite :** Bac d'entrée (tâche à accomplir) -> Plan de travail central -> Bac de sortie fermé (tâche achevée).
4. **La clarté visuelle de la tâche :** Les consignes et le matériel sont organisés de façon à ce que l'élève comprenne immédiatement ce qu'on attend de lui sans explication verbale complexe.

### 3. Matérialisation Concrète de la Fin :
Un élève avec TSA angoisse face à l'infini. Il est impératif de matérialiser visuellement la fin : une boîte où ranger la feuille finie, un nombre précis de jetons à insérer, ou une ligne rouge indiquant la fin de l'exercice.`,
        descriptionAr: `### 1. برنامج تيتش (TEACCH): المنشأ والفلسفة
تأسس برنامج تيتش في جامعة كارولينا الشمالية بقيادة إريك شوبلر، ويرتكز على «التعليم المنظم» وتكييف المحيط الخارجي ليناسب طريقة تفكير وإدراك التلميذ التوحدي.

### 2. مستويات الهيكلة الأربعة:
1. **الهيكلة المكانية:** تخصيص وظيفة واضحة وثابتة لكل ركن (مساحة العمل الفردي، مساحة العمل الجماعي، الركن الهادئ، فضاء اللعب).
2. **الجدول البصري اليومي الفردي:** يجيب عن ثلاثة أسئلة مقلقة للتلميذ: *ماذا سأفعل؟ بأي ترتيب؟ ومتى ينتهي الأمر؟*
3. **نظام العمل من اليمين إلى اليسار:** صندوق المهام المطلوبة -> مساحة الإنجاز الوسطى -> صندوق العمل المكتمل.
4. **الوضوح البصري للمهمة:** تنظيم الأدوات والبطاقات بحيث يدرك التلميذ المطلوب منه بمجرد النظر دون الحاجة لشرح كلامي مطول.

### 3. التجسيد المادي لنهاية المهمة:
يشعر التلميذ بالقلق الشديد عند عدم معرفة متى ينتهي التمرين. من الضروري وضع علامة نهاية واضحة: إدخال الورقة في علبة مغلقة، جمع 3 نجوم، أو خط أحمر فاصل يشير لانتهاء المطلوب.`,
      },
      {
        modulePos: 3,
        position: 6,
        durationSeconds: 2400,
        titleFr: "La Hiérarchie des Guidances & la Règle d'Estompage (Prompt Fading)",
        titleAr: "مدرّج المساعدات وقاعدة التلاشي نحو الاستقلالية (Prompt Fading)",
        descriptionFr: `### 1. Qu'est-ce qu'une Guidance (Prompt) ?
Une guidance est une aide supplémentaire fournie à l'élève pour susciter la réponse correcte lorsqu'un stimulus naturel ne suffit pas encore.

### 2. La Hiérarchie des Guidances (Du plus invasif au plus autonome) :
1. **Guidance physique totale (Main sur main) :** L'adulte guide l'ensemble du geste mécanique (100% aide).
2. **Guidance physique partielle :** Soutien léger au niveau du coude ou de l'avant-bras (75% aide).
3. **Modélisation / Démonstration :** L'adulte montre le geste sur son propre support en disant « Fais comme moi » (50% aide).
4. **Guidance gestuelle / visuelle :** Un pointage silencieux du doigt ou présentation d'un pictogramme (25% aide).
5. **Guidance verbale directe :** Une consigne courte et explicite.
6. **Indépendance totale :** L'élève réagit aux signaux naturels du contexte (0% aide adulte).

### 3. La Technique d'Estompage (Fading) & La Règle des 3 Réussites
Pour ne pas enfermer l'élève dans l'assistanat, l'AVS doit appliquer l'estompage systématique :
- **Règle d'or clinique :** Dès que l'élève réussit la tâche 3 fois d'affilée avec le niveau d'aide actuel, l'AVS descend immédiatement au niveau d'aide inférieur.
- Si l'élève échoue ou hésite, remonter temporairement d'un cran puis ré-estomper dès la réussite suivante.`,
        descriptionAr: `### 1. ما هي المساعدة أو التوجيه (Prompt)؟
المساعدة هي دعم إضافي يقدمه المرافق للتلميذ لحثه على إظهار الاستجابة الصحيحة حينما لا تكفي التعليمات الطبيعية بمفردها.

### 2. مدرّج المساعدات (من الأكثر تدخلاً إلى الأكثر استقلالية):
1. **المساعدة الجسدية الكاملة (يدًا بيد):** إمساك يد التلميذ بالكامل لإنجاز الحركة (100% تدخل).
2. **المساعدة الجسدية الجزئية:** لمس خفيف لمرفق أو ذراع التلميذ لتوجيهه (75% تدخل).
3. **النمذجة والمحاكاة (Show & Do):** أداء الحركة أمام التلميذ على ورقة مماثلة (50% تدخل).
4. **التوجيه الإشاري / البصري:** إشارة صامتة بإصبع اليد نحو الهدف أو رمز بياغي (25% تدخل).
5. **التوجيه اللفظي المباشر:** تعليمة مقتضبة محددة.
6. **الاستقلالية التامة:** استجابة التلميذ للمثير الطبيعي في القسم (0% مساعدة خارجية).

### 3. تقنية تلاشي المساعدة (Prompt Fading) وقاعدة النجاحات الثلاثة
لمنع تعويد التلميذ على الاعتمادية، يجب سحب المساعدة تدريجيًا وفق معيار دقيق:
- **قاعدة الذهب السريرية:** بمجرد أن ينجح التلميذ في إنجاز المهمة 3 مرات متتالية بالمستوى الحالي، يجب على المرافق فورًا خفض درجة المساعدة درجة واحدة نحو الاستقلالية.
- في حال تعثر التلميذ، يقدم المرافق دعمًا طفيفًا ثم يعاود الانسحاب فور استعادة النجاح.`,
      },
      {
        modulePos: 3,
        position: 7,
        durationSeconds: 2100,
        titleFr: "Outils Visuels Clés : Le Tableau D'abord-Ensuite & le Time Timer",
        titleAr: "أدوات بصرية محورية: جدول «أولاً - ثم» والمؤقت الزمني Time Timer",
        descriptionFr: `### 1. Le Principe de Premack Appliqué au TSA
Nommé d'après le psychologue David Premack, ce principe stipule qu'un comportement à haute probabilité d'occurrence (activité favorite de l'enfant) peut renforcer efficacement un comportement à faible probabilité d'occurrence (tâche scolaire difficile ou rébarbative).

### 2. Le Tableau « D'abord – Ensuite » (First-Then Board)
Cet outil visuel élémentaire mais extrêmement puissant structure l'effort en reliant directement deux étapes :
- **Case 1 : D'ABORD** (La consigne de travail ciblée, avec quantité finie et mesurable).
- **Case 2 : ENSUITE** (L'activité gratifiante ou la pause sensorielle méritée).
- L'AVS montre le tableau sans argumenter : « D'abord 3 calculs, ensuite les bulles de savon ». L'incertitude disparaît, réduisant drastiquement les conduites d'opposition.

### 3. Le Minuteur Visuel (Time Timer)
L'appréhension du temps est souvent abstraite et source d'angoisse majeure chez les personnes avec TSA :
- Le Time Timer matérialise le temps qui s'écoule par un disque rouge qui disparaît progressivement.
- Il permet à l'élève de constater par lui-même combien de temps il lui reste à travailler ou à jouer, transformant une notion invisible en une réalité visuelle apaisante.`,
        descriptionAr: `### 1. مبدأ بريماك (Premack Principle) في تعديل السلوك
ينص مبدأ بريماك على أن النشاط المفضل للتلميذ الذي يقبل عليه برغبة عالية يمكن استخدامه كمعزز قوي لدفع التلميذ لإنجاز مهمة مدرسية أقل تفضيلاً أو تتطلب جهدًا كبيرًا.

### 2. جدول «أولاً... ثم...» (First-Then Board)
أداة بصرية بسيطة وذات فاعلية استثنائية في تبديد القلق وتحديد الالتزام:
- **الخانة 1 : أولاً** (المهمة المطلوبة بحجم محدد وقابل للقياس، مثل: حل 3 أسطر).
- **الخانة 2 : ثم** (النشاط المعزز المحبب للتلميذ أو الاستراحة في الركن الهادئ).
- يشير المرافق بهدوء إلى اللوحة دون الدخول في جدال كلامي: «أولاً بطاقة التمارين، ثم الجهاز اللوحي لمدة 5 دقائق». وضوح النتيجة يحفز التلميذ ويقلل من نوبات الرفض.

### 3. المؤقت البصري (Time Timer)
يمثل الوقت مفهومًا مجردًا يصعب إدراكه، مما يولد توترًا مستمرًا لدى التلميذ:
- يقوم المؤقت البصري بتجسيد الوقت المتبقي عبر قرص أحمر يتلاشى تدريجيًا وبصمت.
- يرى التلميذ بعينيه كم بقي من الوقت لانتهاء الحصة أو بدء الاستراحة، مما يمنحه إحساسًا بالأمان والتحكم.`,
      },
      {
        modulePos: 4,
        position: 8,
        durationSeconds: 2700,
        titleFr: "L'Analyse Fonctionnelle du Comportement : La Grille ABC Appliquée",
        titleAr: "التحليل الوظيفي للسلوك: شبكة ABC التطبيقية في الوسط المدرسي",
        descriptionFr: `### 1. Tout Comportement a une Fonction
Les comportements dits « défis » ou perturbateurs (cris, morsures, fuites, jets d'objets) ne surviennent jamais par méchanceté ou par hasard : ils constituent des tentatives d'adaptation et de communication face à un environnement inadapté.

### 2. Les 4 Grandes Fonctions du Comportement (Modèle E.A.T.S) :
1. **Échappement / Évitement (Escape) :** Fuir une tâche perçue comme trop pénible, trop longue ou incompréhensible.
2. **Recherche d'Attention :** Provoquer la réaction verbale ou physique de l'adulte ou des pairs.
3. **Accès au Tangible :** Obtenir un objet convoité, une friandise ou une activité spécifique.
4. **Auto-régulation Sensorielle :** Compenser une hypo-stimulation ou soulager une douleur ou surcharge corporelle.

### 3. La Grille ABC (Antecedent – Behavior – Consequence) :
- **A (Antécédent) :** Que s'est-il passé juste avant ? (transition, bruit aigu, demande complexe, consigne collective ambiguë).
- **B (Behavior - Comportement) :** Description factuelle, mesurable et sans jugement du comportement émis.
- **C (Consequence - Conséquence) :** Que s'est-il passé juste après ? Comment l'entourage a-t-il réagi ?

### 4. L'Intervention Proactive vs Réactive :
- L'intervention efficace modifie l'antécédent (A) pour prévenir l'apparition du comportement, plutôt que de punir a posteriori dans la conséquence (C).`,
        descriptionAr: `### 1. كل سلوك له وظيفة ورسالة تواصلية
السلوكيات التي توصف بأنها «تحدّية» أو مضطربة (الصراخ، العض، رمي الأدوات، مغادرة المقعد) لا تصدر أبدًا بدافع العناد أو الإيذاء العمدي، بل هي محاولات للتكيف والتعبير عن ضيق في ظل صعوبة التواصل اللفظي.

### 2. الوظائف الأربع الأساسية للسلوك (نموذج E.A.T.S):
1. **الهروب والتهرب (Escape):** التخلص من مهمة شاقة، طويلة، مبهمة، أو سياق حسي مؤلم.
2. **لفت الانتباه (Attention):** استدعاء تركيز المعلم أو المرافق أو رد فعل الزملاء.
3. **الوصول لمكسب مادي (Tangible):** الرغبة في الحصول على لعبة أو شيء ملموس محدد.
4. **التنظيم الحسي الذاتي (Sensory):** تنظيم داخلي لتهدئة الجهاز العصبي أو استثارة حسية مطلوبة.

### 3. شبكة التحليل السلوكي ABC (النموذج الوظيفي):
- **A - المثير القبلي (Antécédent):** ماذا حدث قبل السلوك مباشرة؟ (صوت جرس مفاجئ، انتقال غير معلن، تعليمة نصية طويلة).
- **B - السلوك الملاحظ (Behavior):** وصف موضوعي دقيق وقابل للقياس للسلوك دون تأويل أو أحكام مسبقة.
- **C - الأثر البعدي (Conséquence):** ماذا حدث فور انتهاء السلوك؟ كيف كانت استجابة المحيط؟ وهل حصل التلميذ دون قصد على ما كان يريده (تعزيز سلبي)؟

### 4. التدخل الاستباقي مقابل التدخل الانفعالي:
- التدخل العلمي الناجح يركز على تعديل المثير القبلي (A) لمنع ظهور السلوك بدلاً من اللجوء للعقاب البعدي غير المجدي.`,
      },
    ];

    for (const lsn of LESSONS_DATA) {
      const moduleId = moduleMap.get(lsn.modulePos);
      const [existingLsn] = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.courseId, courseId), eq(lessons.position, lsn.position)))
        .limit(1);

      const lsnId = existingLsn?.id || crypto.randomUUID();
      const lsnPayload = {
        id: lsnId,
        courseId,
        moduleId,
        position: lsn.position,
        titleFr: lsn.titleFr,
        titleAr: lsn.titleAr,
        descriptionFr: lsn.descriptionFr,
        descriptionAr: lsn.descriptionAr,
        durationSeconds: lsn.durationSeconds,
        documentUrl: "/documents/guide-complet-autisme-accompagnement-scolaire-anei.pdf",
        preview: lsn.position === 1,
        mediaProvider: "internal",
      };

      if (existingLsn) {
        await db.update(lessons).set(lsnPayload).where(eq(lessons.id, lsnId));
      } else {
        await db.insert(lessons).values(lsnPayload);
      }
      console.log(`   ✓ Lesson ${lsn.position}: ${lsn.titleFr.slice(0, 40)}... (ID: ${lsnId})`);
    }

    // ----------------------------------------------------
    // 5. OFFICIAL FINAL CERTIFICATION ASSESSMENT & 20 QUESTIONS
    // ----------------------------------------------------
    console.log("\n📝 5. Seeding Final Certification Assessment (20 Questions)...");
    const [existingAssessment] = await db
      .select({ id: learningAssessment.id })
      .from(learningAssessment)
      .where(eq(learningAssessment.courseId, courseId))
      .limit(1);

    const assessmentId = existingAssessment?.id || crypto.randomUUID();
    const assessmentPayload = {
      id: assessmentId,
      courseId,
      moduleId: null, // Global course assessment
      titleFr: "Évaluation Finale Certifiante : TSA & Pratiques Scolaires Inclusives",
      titleAr: "الاختبار النهائي المعتمد: طيف التوحد والممارسات المدرسية الدامجة",
      instructionsFr:
        "Ce QCM officiel valide l'acquisition des compétences clés en accompagnement scolaire du TSA. Il comprend 20 questions à choix unique couvrant l'ensemble du référentiel ANEI. Score minimum requis pour la certification : 80% (16/20). Durée maximale : 30 minutes. 3 tentatives autorisées.",
      instructionsAr:
        "يصادق هذا الاختبار الرسمي على اكتساب المهارات الأساسية في المرافقة المدرسية لطيف التوحد. يتكون من 20 سؤالاً باختيار أحادي تغطي كامل الدليل المرجعي لـ ANEI. النسبة المطلوبة لنيل الشهادة الرسمية: 80% (16/20). الوقت المتاح: 30 دقيقة. عدد المحاولات: 3.",
      timeLimitSeconds: 1800, // 30 minutes
      passingScore: 80, // 80% requis
      maxAttempts: 3,
      published: true,
      revealAnswersAfterPass: true,
      updatedAt: new Date(),
    };

    if (existingAssessment) {
      await db.update(learningAssessment).set(assessmentPayload).where(eq(learningAssessment.id, assessmentId));
      console.log(`   ✓ Assessment updated (ID: ${assessmentId})`);
    } else {
      await db.insert(learningAssessment).values(assessmentPayload);
      console.log(`   ✓ Assessment inserted (ID: ${assessmentId})`);
    }

    // Clean existing questions if any for clean idempotent rebuild
    await db.delete(learningQuestion).where(eq(learningQuestion.assessmentId, assessmentId));

    // 20 OFFICIAL CERTIFICATION QUESTIONS WITH CLINICAL EXPLANATIONS
    const QUESTIONS_DATA = [
      {
        position: 1,
        points: 5,
        promptFr: "Quel changement nosographique majeur a été introduit par le DSM-5 concernant le diagnostic de l'autisme ?",
        promptAr: "ما هو التغيير التشخيصي الجوهري الذي أدخله الدليل الأمريكي الخامس (DSM-5) في تعريف التوحد؟",
        explanationFr: "Le DSM-5 a fusionné la communication et les interactions sociales en un axe unique, passant de la triade de Wing à une dyade comportementale, tout en intégrant formellement les particularités sensorielles.",
        explanationAr: "قام DSM-5 بدمج مجالي التواصل والتفاعل الاجتماعي في محور واحد، منتقلاً من ثالوث وينغ إلى النموذج الثنائي، مع إدراج الخصائص الحسية كمعيار رسمي.",
        options: [
          { textFr: "Le passage d'une triade à une dyade diagnostique et l'intégration des critères sensoriels", textAr: "الانتقال من ثالوث تشخيصي إلى نموذج ثنائي وإدماج المعايير الحسية رسميًا", isCorrect: true },
          { textFr: "La séparation stricte du syndrome d'Asperger dans une catégorie psychiatrique indépendante", textAr: "الفصل التام لمتلازمة أسبرجر في فئة نفسية مستقلة", isCorrect: false },
          { textFr: "La suppression de l'exigence de comportements restreints et stéréotypés", textAr: "إلغاء شرط وجود السلوكيات المقيدة والنمطية", isCorrect: false },
          { textFr: "L'obligation d'un retard intellectuel associé pour poser le diagnostic", textAr: "اشتراط وجود تأخر ذهني مصاحب لتأكيد التشخيص", isCorrect: false },
        ],
      },
      {
        position: 2,
        points: 5,
        promptFr: "Quelle particularité sensorielle fréquente chez les élèves avec TSA peut provoquer une surcharge en classe ordinaire ?",
        promptAr: "أي من الخصائص الحسية الشائعة لدى تلاميذ طيف التوحد يمكن أن تسبب استنزافًا عصبيًا في الفصل العادي؟",
        explanationFr: "L'hyper-réactivité auditive ou visuelle amplifie les bruits de chaises, les voix croisées ou les néons, provoquant une surcharge cognitive rapide.",
        explanationAr: "فرط الاستجابة السمعية أو البصرية يضخم الأصوات العادية ووميض الأضواء، مما يؤدي إلى إجهاد عصبي سريع.",
        options: [
          { textFr: "L'hyper-réactivité sensorielle (bruits métalliques, néons, clameurs)", textAr: "فرط الحساسية والاستجابة للمثيرات الحسية (أصوات، إضاءة، روائح)", isCorrect: true },
          { textFr: "L'absence totale de perception de la douleur physique", textAr: "الغياب التام للإحساس بالألم الجسدي", isCorrect: false },
          { textFr: "La préférence exclusive pour les aliments acides", textAr: "التفضيل الحصري للأطعمة الحامضة فقط", isCorrect: false },
          { textFr: "L'incapacité physiologique à cligner des yeux", textAr: "العجز الوظيفي عن رمش العينين", isCorrect: false },
        ],
      },
      {
        position: 3,
        points: 5,
        promptFr: "Que désigne la « Théorie de l'Esprit » (Theory of Mind) altérée dans le TSA ?",
        promptAr: "ماذا يقصد بـ «نظرية العقل» (Theory of Mind) التي تتأثر في اضطراب طيف التوحد؟",
        explanationFr: "La théorie de l'esprit est l'aptitude à attribuer des pensées, croyances et intentions à autrui afin de comprendre et prédire ses réactions.",
        explanationAr: "نظرية العقل هي القدرة على إدراك واستنتاج الحالات الذهنية والمشاعر والنوايا لدى الآخرين لتوقع ردود أفعالهم.",
        options: [
          { textFr: "La capacité à inférer et attribuer des états mentaux, croyances et émotions à autrui", textAr: "القدرة على استنتاج ونسب الحالات الذهنية والمعتقدات والمشاعر للآخرين", isCorrect: true },
          { textFr: "Le niveau d'intelligence générale mesuré par le quotient intellectuel (QI)", textAr: "مستوى الذكاء العام المقاس باختبار معامل الذكاء (IQ)", isCorrect: false },
          { textFr: "La mémoire photographique des chiffres et des dates", textAr: "الذاكرة الفوتوغرافية الاستثنائية للأرقام والتواريخ", isCorrect: false },
          { textFr: "L'aptitude à parler plusieurs langues étrangères simultanément", textAr: "القدرة على التحدث بعدة لغات أجنبية في وقت واحد", isCorrect: false },
        ],
      },
      {
        position: 4,
        points: 5,
        promptFr: "Selon le modèle de la « Faible Cohérence Centrale », quel est le style cognitif typique d'un élève avec TSA ?",
        promptAr: "وفق نموذج «ضعف التماسك المركزي»، ما هو النمط الإدراكي المميز لتلميذ طيف التوحد؟",
        explanationFr: "Le traitement cognitif se focalise sur les détails spécifiques au détriment de l'assemblage du sens global.",
        explanationAr: "يركز الدماغ على التفاصيل الجزئية بدقة فائقة على حساب فهم واستيعاب الصورة الكلية العامة.",
        options: [
          { textFr: "Une focalisation sur les détails locaux au détriment de la synthèse globale du contexte", textAr: "التركيز على التفاصيل الجزئية الدقيقة على حساب استيعاب المعنى الكلي للسياق", isCorrect: true },
          { textFr: "Une incapacité totale à mémoriser des faits concrets", textAr: "عجز كامل عن تذكر الحقائق والمعلومات الملموسة", isCorrect: false },
          { textFr: "Une tendance systématique à généraliser sans vérifier les faits", textAr: "ميل دائم للتعميم السريع دون فحص المعطيات", isCorrect: false },
          { textFr: "Une compréhension intuitive et immédiate de l'humour abstrait", textAr: "فهم حدسي وفوري للسخرية والمزاح المجرد", isCorrect: false },
        ],
      },
      {
        position: 5,
        points: 5,
        promptFr: "Face à un changement soudain d'emploi du temps, quel déficit des fonctions exécutives explique la panique de l'élève ?",
        promptAr: "عند حدوث تغيير مفاجئ في جدول الحصص، أي خلل في الوظائف التنفيذية يفسر توتر التلميذ الشديد؟",
        explanationFr: "Le déficit de flexibilité cognitive rend très difficile l'adaptation spontanée à une rupture de routine sans préparation visuelle.",
        explanationAr: "قصور المرونة الذهنية يجعل الانتقال غير المتوقع خارج الروتين المألوف تجربة مربكة ومولدة للهلع دون تهيئة بصرية.",
        options: [
          { textFr: "Le déficit de flexibilité cognitive et de régulation du schéma d'action", textAr: "قصور المرونة الذهنية وصعوبة تعديل المخطط الذهني للنشاط", isCorrect: true },
          { textFr: "La perte brutale de la vision spatiale", textAr: "الفقدان المؤقت للإدراك البصري المكاني", isCorrect: false },
          { textFr: "Un manque de motivation scolaire intrinsèque", textAr: "نقص الدافعية الفردية نحو التعلم المدرسي", isCorrect: false },
          { textFr: "L'absence de mémoire à court terme", textAr: "الانعدام التام للذاكرة قصيرة المدى", isCorrect: false },
        ],
      },
      {
        position: 6,
        points: 5,
        promptFr: "Quelle est la mission prioritaire de l'AVS auprès d'un élève avec TSA en classe ordinaire ?",
        promptAr: "ما هي المهمة ذات الأولوية القصوى للمرافق المدرسي (AVS) مع تلميذ طيف التوحد؟",
        explanationFr: "L'AVS compense les freins pour construire l'autonomie et les liens avec la classe, sans faire écran ni se substituer au travail de l'élève.",
        explanationAr: "مهمة المرافق الأساسية هي تذليل الصعوبات وبناء الاستقلالية الذاتية والاندماج مع الفصل دون أن يتحول لعازل.",
        options: [
          { textFr: "Favoriser l'autonomie progressive et l'inclusion sans créer de dépendance", textAr: "تعزيز الاستقلالية التدريجية والاندماج الصفي دون خلق تبعية واعتمادية", isCorrect: true },
          { textFr: "Écrire les leçons et faire les exercices à la place de l'élève pour aller vite", textAr: "كتابة الدروس وحل التمارين نيابة عن التلميذ لكسب الوقت", isCorrect: false },
          { textFr: "Remplacer l'enseignant pour les matières scientifiques et littéraires", textAr: "تعويض معلم الفصل وتولي تدريس المواد الأساسية", isCorrect: false },
          { textFr: "Isoler systématiquement l'élève dans le couloir dès qu'il hésite", textAr: "عزل التلميذ فورًا في الرواق بمجرد تردده في الإجابة", isCorrect: false },
        ],
      },
      {
        position: 7,
        points: 5,
        promptFr: "Pourquoi l'AVS doit-il éviter de rester continuellement collé à l'élève ?",
        promptAr: "لماذا ينبغي على المرافق المدرسي تجنب الجلوس الملاصق والمستمر للتلميذ طوال اليوم؟",
        explanationFr: "La proximité permanente empêche les pairs d'interagir avec l'élève et génère une dépendance néfaste (prompt dependency).",
        explanationAr: "الالتصاق الدائم يمنع الزملاء من التفاعل الطبيعي مع التلميذ، ويكرس ظاهرة الاعتمادية السلوكية على المساعدة.",
        options: [
          { textFr: "Pour prévenir la dépendance à l'adulte (prompt dependency) et faciliter les interactions avec les pairs", textAr: "لتفادي الاعتمادية على البالغين (Prompt Dependency) وتسهيل تواصل الأقران معه", isCorrect: true },
          { textFr: "Parce que le règlement intérieur interdit aux AVS de s'asseoir", textAr: "لأن النظام الداخلي يمنع المرافقين من الجلوس داخل القاعة", isCorrect: false },
          { textFr: "Pour pouvoir corriger les copies de l'enseignant en toute tranquillité", textAr: "ليتمكن المرافق من تصحيح اختبارات المعلم بهدوء", isCorrect: false },
        ],
      },
      {
        position: 8,
        points: 5,
        promptFr: "Comment s'organise la responsabilité pédagogique entre l'enseignant et l'AVS ?",
        promptAr: "كيف تتوزع المسؤولية البيداغوجية والتعليمية بين معلم الفصل والمرافق المدرسي؟",
        explanationFr: "L'enseignant est l'unique responsable des objectifs d'apprentissage et de l'évaluation ; l'AVS applique les adaptations d'accessibilité décidées en concertation.",
        explanationAr: "المعلم هو المسؤول الأول والأخير عن الأهداف التعليمية والتقييم، بينما يطبق المرافق التكييفات المتفق عليها.",
        options: [
          { textFr: "L'enseignant définit les objectifs et la pédagogie ; l'AVS met en œuvre les adaptations d'accessibilité", textAr: "المعلم يحدد الأهداف والمنهج التعليمي، والمرافق يطبق تكييفات التيسير والإتاحة", isCorrect: true },
          { textFr: "L'AVS décide seul du programme scolaire de l'élève", textAr: "المرافق ينفرد بتحديد البرنامج الدراسي المخصص للتلميذ", isCorrect: false },
          { textFr: "L'enseignant n'intervient jamais auprès de l'élève accompagné", textAr: "المعلم لا يتدخل إطلاقًا مع التلميذ المستفيد من المرافقة", isCorrect: false },
          { textFr: "Les deux professionnels alternent une semaine sur deux la charge de la classe", textAr: "يتبادل الطرفان إدارة وتدريس الفصل أسبوعًا بأسبوع", isCorrect: false },
        ],
      },
      {
        position: 9,
        points: 5,
        promptFr: "Quel aménagement physique simple permet d'atténuer considérablement la pollution sonore d'une classe ?",
        promptAr: "ما هو التدبير المادي البسيط والفعال للحد بشكل كبير من التلوث السمعي داخل الفصل؟",
        explanationFr: "Les patins de feutre ou balles sous les pieds des chaises éliminent les bruits stridents de frottement au sol, très agressifs pour un profil hypersensible.",
        explanationAr: "وضع اللباد أو كرات التنس تحت أرجل المقاعد يزيل الضوضاء الناتجة عن الاحتكاك، والتي تسبب ألمًا حسيًا للتلميذ.",
        options: [
          { textFr: "Poser des patins en feutre ou balles sous les pieds des chaises et tables", textAr: "تثبيت قطع اللباد أو كرات التنس تحت أرجل الكراسي والطاولات", isCorrect: true },
          { textFr: "Repeindre tous les murs de la classe en noir mat", textAr: "إعادة طلاء جميع جدران الفصل باللون الأسود القاتم", isCorrect: false },
          { textFr: "Interdire formellement aux autres élèves de respirer fort", textAr: "منع بقية التلاميذ نهائيًا من التنفس بصوت مسموع", isCorrect: false },
          { textFr: "Fermer les fenêtres et couper la lumière du soleil", textAr: "إغلاق جميع النوافذ وحجب ضوء الشمس بالكامل", isCorrect: false },
        ],
      },
      {
        position: 10,
        points: 5,
        promptFr: "Quel emplacement de table est le plus adapté pour un élève avec TSA dans une classe ordinaire ?",
        promptAr: "أي موقع جلوس يعتبر الأنسب والأكثر أمانًا لتلميذ طيف التوحد داخل الفصل؟",
        explanationFr: "Une zone latérale calme loin des couloirs de circulation limite les distractions et offre une visibilité directe et rassurante sur le tableau.",
        explanationAr: "الموقع الجانبي الهادئ بعيدًا عن حركة الممر يقلل التشتت ويوفر رؤية مستقيمة ومريحة لسبورة الفصل.",
        options: [
          { textFr: "Un endroit calme à l'écart des va-et-vient, avec vue dégagée sur le tableau et accès au coin calme", textAr: "مكان هادئ بعيد عن ممر الحركة والباب، مع رؤية مباشرة للسبورة وسهولة الوصول للركن الهادئ", isCorrect: true },
          { textFr: "Juste à côté de la porte d'entrée et de la poubelle de la classe", textAr: "بمحاذاة باب الدخول وسلة مهملات القاعة مباشرة", isCorrect: false },
          { textFr: "Isolé au milieu du couloir derrière une vitre teintée", textAr: "معزولاً في وسط الرواق خلف لوح زجاجي حاجب", isCorrect: false },
          { textFr: "Au fond de la classe le dos tourné à l'enseignant", textAr: "في آخر الفصل مع إعطاء الظهر للمعلم تمامًا", isCorrect: false },
        ],
      },
      {
        position: 11,
        points: 5,
        promptFr: "Quel est le principe directeur de la structuration de travail dans l'approche TEACCH ?",
        promptAr: "ما هو المبدأ التوجيهي الأساسي لتنظيم مساحة العمل الفردي في منهجية تيتش (TEACCH)؟",
        explanationFr: "L'organisation spatiale séquentielle de gauche à droite (à faire -> en cours -> fini en boîte fermée) sécurise la trajectoire de l'action.",
        explanationAr: "التنظيم البصري التسلسلي من اليمين إلى اليسار (المطلوب -> قيد الإنجاز -> المنتهي في علبة) يمنح التلميذ أمانًا ووضوحًا تامًا.",
        options: [
          { textFr: "L'organisation séquentielle claire (de gauche à droite : à faire, en cours, terminé)", textAr: "التنظيم التسلسلي الواضح لمسار العمل (المطلوب إنجازه، العمل الحالي، العمل المنتهي)", isCorrect: true },
          { textFr: "L'absence volontaire de consignes écrites pour stimuler l'intuition", textAr: "التعمد في إخفاء التعليمات لتحفيز الحدس التلقائي", isCorrect: false },
          { textFr: "La rotation continue des tables de travail toutes les dix minutes", textAr: "التغيير المستمر لأماكن الطاولات كل 10 دقائق", isCorrect: false },
          { textFr: "Le travail exclusif dans l'obscurité totale", textAr: "العمل الحصري داخل الظلام الدامس", isCorrect: false },
        ],
      },
      {
        position: 12,
        points: 5,
        promptFr: "Quel est le bénéfice fondamental de l'utilisation d'un minuteur visuel (type Time Timer) ?",
        promptAr: "ما هي الفائدة الجوهرية لاستخدام المؤقت البصري (مثل Time Timer) مع التلميذ؟",
        explanationFr: "Il convertit le temps abstrait en une grandeur visuelle concrète (le disque qui rétrécit), réduisant l'angoisse liée à l'attente et aux transitions.",
        explanationAr: "يحول مفهوم الوقت المجرد إلى عنصر بصري ملموس ومتحرك، مما يزيل التوتر المرتبط بالانتظار وتغير الحصص.",
        options: [
          { textFr: "Matérialiser visuellement le temps qui s'écoule et rendre prévisible la fin de l'activité", textAr: "تجسيد الوقت المنقضي بصريًا وجعل نهاية النشاط واضحة ومتوقعة للتلميذ", isCorrect: true },
          { textFr: "Chronotétrer l'élève pour le pénaliser s'il dépasse le temps", textAr: "احتساب الوقت لمعاقبة التلميذ في حال تأخره في الحل", isCorrect: false },
          { textFr: "Émettre une sonnerie stridente chaque 30 secondes pour stimuler l'attention", textAr: "إصدار رنين حاد كل نصف دقيقة لتنبيه ذهن التلميذ", isCorrect: false },
          { textFr: "Mesurer la température corporelle de l'accompagnant", textAr: "قياس حرارة جسم المرافق المدرسي", isCorrect: false },
        ],
      },
      {
        position: 13,
        points: 5,
        promptFr: "Sur quel mécanisme psychologique repose l'efficacité de la planche « D'abord – Ensuite » (First-Then Board) ?",
        promptAr: "على أي مبدأ نفسي وسلوكي يستند نجاح لوحة «أولاً... ثم...» (First-Then Board)؟",
        explanationFr: "Le principe de Premack stipule qu'une activité à forte attractivité (le renforçateur 'Ensuite') motive l'accomplissement d'une tâche à faible probabilité ('D'abord').",
        explanationAr: "مبدأ بريماك القائم على ربط إتمام مهمة مدرسية مطلوبة بالحصول المباشر على نشاط محبب ومحفز.",
        options: [
          { textFr: "Le principe de Premack (relier une tâche d'effort à un renforçateur apprécié immédiat)", textAr: "مبدأ بريماك السلوكي (ربط إنجاز مهمة التعلم بنيل نشاط تعزيزي مفضل وفوري)", isCorrect: true },
          { textFr: "L'effet placebo sans fondement scientifique", textAr: "تأثير الإيحاء النفسي الوهمي دون أساس علمي", isCorrect: false },
          { textFr: "La punition négative différée", textAr: "العقاب السلبي المؤجل لعدة أيام", isCorrect: false },
          { textFr: "La saturation sensorielle répétitive", textAr: "الإشباع الحسي التكراري المفرط", isCorrect: false },
        ],
      },
      {
        position: 14,
        points: 5,
        promptFr: "Dans la hiérarchie des guidances, quel niveau représente le degré d'intervention le plus intrusif ?",
        promptAr: "ضمن مدرّج المساعدات (Prompting Hierarchy)، أي مستوى يمثل أقصى درجات التدخل؟",
        explanationFr: "La guidance physique totale (main sur main) guide l'intégralité du geste moteur ; elle doit être estompée au plus vite.",
        explanationAr: "المساعدة الجسدية الكاملة (يدًا بيد) هي الأكثر تدخلاً وتتطلب خطة تلاشٍ سريعة لتفادي الاعتمادية.",
        options: [
          { textFr: "La guidance physique totale (Main sur main / Hand-over-hand)", textAr: "المساعدة الجسدية الكاملة (يدًا بيد / Hand-over-hand)", isCorrect: true },
          { textFr: "La guidance gestuelle par simple pointage du doigt", textAr: "التوجيه الإشاري عبر مجرد الإشارة بالإصبع", isCorrect: false },
          { textFr: "La modélisation visuelle sans contact corporel", textAr: "النمذجة والمحاكاة البصرية دون أي لمس", isCorrect: false },
          { textFr: "Le signal naturel de l'environnement", textAr: "المثير الطبيعي الصادر من محيط الفصل", isCorrect: false },
        ],
      },
      {
        position: 15,
        points: 5,
        promptFr: "Quelle est la « règle des 3 réussites consécutives » dans la technique d'estompage (Prompt Fading) ?",
        promptAr: "ما هي «قاعدة النجاحات الثلاثة المتتالية» في تطبيق استراتيجية تلاشي المساعدة (Prompt Fading)؟",
        explanationFr: "Pour prévenir la dépendance, dès que l'élève réussit 3 fois de suite à un palier N, l'AVS doit impérativement descendre au palier d'aide inférieur.",
        explanationAr: "لضمان التقدم نحو الاستقلالية، عند إنجاز التلميذ للمهمة 3 مرات بنجاح بنفس الدعم، يقلل المرافق المساعدة درجة فورًا.",
        options: [
          { textFr: "Dès 3 réussites consécutives à un palier donné, l'adulte rétrograde d'un cran d'aide vers l'autonomie", textAr: "فور نجاح التلميذ 3 مرات متتالية بالمستوى الحالي، يقلل المرافق درجة المساعدة نحو الاستقلالية", isCorrect: true },
          { textFr: "L'élève doit obtenir 3 zéros consécutifs avant d'avoir le droit à de l'aide", textAr: "ضرورة حصول التلميذ على 3 إخفاقات قبل تقديم أي عون له", isCorrect: false },
          { textFr: "L'AVS doit féliciter l'élève exactement 3 fois par heure sans exception", textAr: "التزام المرافق بالثناء على التلميذ 3 مرات فقط في الساعة", isCorrect: false },
          { textFr: "L'exercice doit être répété 3 années de suite", textAr: "إعادة نفس التمرين الدراسي لثلاث سنوات متتالية", isCorrect: false },
        ],
      },
      {
        position: 16,
        points: 5,
        promptFr: "Quelle est la toute première étape d'apprentissage dans le système de communication PECS ?",
        promptAr: "ما هي الخطوة الأولى التأسيسية في تدريب التلميذ على نظام التواصل بتبادل الصور (PECS)؟",
        explanationFr: "La phase 1 du PECS enseigne l'initiation de la communication : donner physiquement l'image de l'objet désiré dans la main du partenaire.",
        explanationAr: "المرحلة الأولى تركز على المبادرة التلقائية: مد اليد بالصورة ووضعها في يد شريك التواصل للحصول على الشيء المرغوب.",
        options: [
          { textFr: "L'échange physique spontané : donner l'image de l'objet désiré dans la main du partenaire", textAr: "التبادل المادي التلقائي: تسليم صورة الشيء المرغوب في يد شريك التواصل", isCorrect: true },
          { textFr: "La récitation par cœur de l'alphabet à voix haute", textAr: "استظهار الحروف الأبجدية غيبًا بصوت مرتفع", isCorrect: false },
          { textFr: "La composition de phrases grammaticales complexes avec adjectifs", textAr: "تركيب جمل نحوية طويلة تتضمن صفات وأفعالاً مركبة", isCorrect: false },
          { textFr: "La discrimination fine entre 50 pictogrammes similaires", textAr: "التمييز الدقيق بين 50 رمزًا بصريًا متشابهًا في نفس اليوم", isCorrect: false },
        ],
      },
      {
        position: 17,
        points: 5,
        promptFr: "Quel est l'objectif fondamental d'un Scénario Social (Social Story™ de Carol Gray) ?",
        promptAr: "ما هو الهدف الأساسي من كتابة وتطبيق القصص الاجتماعية (Social Stories لـ Carol Gray)؟",
        explanationFr: "Le scénario social explicite avec bienveillance les attentes sociales, les indices contextuels et les réactions adaptées face à une situation donnée.",
        explanationAr: "توضح القصة الاجتماعية المعايير والقواعد السلوكية الضمنية للمواقف الاجتماعية وتزيل الغموض المسبب للقلق.",
        options: [
          { textFr: "Décrire une situation sociale pour expliciter les attentes et lever l'ambiguïté comportementale", textAr: "وصف موقف اجتماعي لتوضيح ما هو متوقع وتبديد الغموض السلوكي والقلق", isCorrect: true },
          { textFr: "Raconter des contes de fées imaginaires pour distraire l'élève", textAr: "سرد قصص خيالية وأساطير لتسلية التلميذ في أوقات الفراغ", isCorrect: false },
          { textFr: "Lister les punitions qui attendent l'élève s'il n'est pas sage", textAr: "سرد قائمة العقوبات التي سيتعرض لها التلميذ إن أخطأ", isCorrect: false },
          { textFr: "Remplacer les manuels scolaires d'histoire et de géographie", textAr: "تعويض المقررات المدرسية للتاريخ والجغرافيا", isCorrect: false },
        ],
      },
      {
        position: 18,
        points: 5,
        promptFr: "Dans la grille d'analyse comportementale ABC, à quoi correspond l'élément « A » ?",
        promptAr: "في شبكة التحليل السلوكي الوظيفي (ABC)، ماذا يمثل العنصر «A»؟",
        explanationFr: "« A » signifie Antécédent : ce qui s'est produit dans l'environnement immédiatement avant l'apparition du comportement observable.",
        explanationAr: "«A» تعني المثير القبلي (Antécédent): كل ما وقع في بيئة التلميذ قبل صدور السلوك مباشرة وكان محفزًا له.",
        options: [
          { textFr: "L'Antécédent : le contexte déclencheur survenu immédiatement avant le comportement", textAr: "المثير القبلي (Antécédent): السياق والمحفز الذي حدث مباشرة قبل السلوك", isCorrect: true },
          { textFr: "L'Attestation médicale délivrée par le médecin", textAr: "الشهادة الطبية المسلمة من الطبيب المعالج", isCorrect: false },
          { textFr: "L'Âge chronologique exact de l'enfant", textAr: "العمر الزمني الدقيق للطفل بالأشهر والأيام", isCorrect: false },
          { textFr: "L'Appétit de l'élève au moment du déjeuner", textAr: "شهية التلميذ أثناء تناول وجبة الغداء", isCorrect: false },
        ],
      },
      {
        position: 19,
        points: 5,
        promptFr: "Lorsqu'un élève jette son cahier pour échapper à un exercice et qu'on le laisse ne pas le faire, quel effet est produit ?",
        promptAr: "عندما يرمي التلميذ كراسه للهروب من تمرين صعب ويُترك دون حل، ما الأثر السلوكي الناتج؟",
        explanationFr: "Il s'agit d'un renforcement négatif involontaire : le comportement inadapté lui a permis d'échapper à la tâche désagréable, il va donc récidiver.",
        explanationAr: "هذا تعزيز سلبي غير مقصود: نال التلميذ الهروب من المهمة الشاقة عبر رمي الكراس، مما يثبت تكرار نفس السلوك مستقبلاً.",
        options: [
          { textFr: "Un renforcement négatif involontaire qui augmente le risque de récidive du comportement défi", textAr: "تعزيز سلبي غير مقصود يثبت السلوك ويزيد من احتمالية تكراره مستقبلاً للهروب من المهام", isCorrect: true },
          { textFr: "Une extinction définitive et immédiate de la crise", textAr: "انطفاء فوري ونهائي لأي سلوكيات تحدّية لاحقة", isCorrect: false },
          { textFr: "Un progrès spectaculaire de l'autonomie en mathématiques", textAr: "تطور باهر ومفاجئ في استقلالية التلميذ في مادة الرياضيات", isCorrect: false },
          { textFr: "Une guérison spontanée du trouble du spectre de l'autisme", textAr: "شفاء تلقائي تام من اضطراب طيف التوحد", isCorrect: false },
        ],
      },
      {
        position: 20,
        points: 5,
        promptFr: "Quelle démarche proactive est recommandée pour prévenir les crises liées aux transitions entre activités ?",
        promptAr: "ما هو الإجراء الاستباقي الموصى به علميًا للوقاية من نوبات التوتر أثناء الانتقال بين الأنشطة؟",
        explanationFr: "Anticiper la transition 3 à 5 minutes avant avec un repère visuel (Time Timer, pictogramme) sécurise le passage à l'étape suivante.",
        explanationAr: "إعلام التلميذ مسبقًا قبل 3 إلى 5 دقائق بالانتقال القادم مدعومًا بمؤشر بصري (مؤقت، بطاقة) يزيل القلق ويهيئ الذهن.",
        options: [
          { textFr: "Avertir visuellement l'élève 3 à 5 minutes à l'avance et désigner la prochaine étape sur l'emploi du temps", textAr: "تهيئة التلميذ بصريًا قبل 3 إلى 5 دقائق والإشارة للنشاط القادم في الجدول اليومي", isCorrect: true },
          { textFr: "Arracher brusquement le matériel des mains de l'élève pour le surprendre", textAr: "انتزاع الأدوات فجأة من يد التلميذ لمفاجأته بانتهاء الوقت", isCorrect: false },
          { textFr: "Crier le mot « FIN ! » très fort près de son oreille", textAr: "الصراخ بكلمة «انتهى!» بصوت مرتفع قرب أذنه", isCorrect: false },
          { textFr: "Changer l'ordre des cours au dernier moment sans rien lui dire", textAr: "تغيير تسلسل الحصص في آخر لحظة دون إخباره بأي شيء", isCorrect: false },
        ],
      },
    ];

    for (const q of QUESTIONS_DATA) {
      const qId = crypto.randomUUID();
      await db.insert(learningQuestion).values({
        id: qId,
        assessmentId,
        promptFr: q.promptFr,
        promptAr: q.promptAr,
        type: "SINGLE_CHOICE",
        position: q.position,
        points: q.points,
        explanationFr: q.explanationFr,
        explanationAr: q.explanationAr,
      });

      let optPos = 1;
      for (const opt of q.options) {
        const optId = crypto.randomUUID();
        await db.insert(learningQuestionOption).values({
          id: optId,
          questionId: qId,
          textFr: opt.textFr,
          textAr: opt.textAr,
          position: optPos,
          isCorrect: opt.isCorrect,
        });
        optPos++;
      }
    }
    console.log(`   ✓ 20 Questions inserted with 4 options each (100 points total)`);

    // ----------------------------------------------------
    // 6. AUTO-ENROLL SEED USERS FOR SEAMLESS TESTING
    // ----------------------------------------------------
    console.log("\n👥 6. Auto-enrolling demo learners in the Autism course...");
    const existingUsers = await db.select({ id: user.id, email: user.email }).from(user);
    for (const u of existingUsers) {
      const [existingEnrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(and(eq(enrollments.userId, u.id), eq(enrollments.courseId, courseId)))
        .limit(1);

      if (!existingEnrollment) {
        const enrollmentId = crypto.randomUUID();
        await db.insert(enrollments).values({
          id: enrollmentId,
          userId: u.id,
          courseId,
          status: "active",
          progressPercent: 0,
          enrolledAt: new Date(),
        });
        console.log(`   ✓ Enrolled user ${u.email}`);
      }
    }

    console.log(`\n======================================================`);
    console.log(`🎉 SUCCESS! Autism Course & Certification Pipeline Seeded Successfully!`);
    console.log(`======================================================\n`);
  } finally {
    if ("end" in pool && typeof pool.end === "function") {
      await pool.end();
    }
  }
}

if (process.argv[1]?.endsWith("seed-autism-course.ts")) {
  seedAutismData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
