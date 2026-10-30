import "dotenv/config";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import {
  courses,
  lessons,
  lessonChapters,
  lessonTranscripts,
  lessonTakeaways,
  lessonFlashcards,
  lessonPracticeActions,
  lessonQuizQuestions,
} from "../src/server/db/schema";

const COURSE_SLUG = "trouble-spectre-autisme-accompagnement-scolaire";

export async function seedLearningUpgrade() {
  console.log("🚀 Seeding Learning Experience Upgrade pedagogical dataset...");

  const [course] = await db.select().from(courses).where(eq(courses.slug, COURSE_SLUG)).limit(1);
  if (!course) {
    console.error("❌ TSA Course not found. Please run seed-autism-course.ts first.");
    return;
  }

  // Find Lesson 1: "De la Triade de Wing à la Dyade Diagnostique du DSM-5-TR"
  const courseLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, course.id))
    .orderBy(lessons.position);

  const targetLesson = courseLessons.find((l) => l.position === 1) || courseLessons[0];
  if (!targetLesson) {
    console.error("❌ No lessons found in course.");
    return;
  }

  console.log(`📌 Target Lesson: "${targetLesson.titleFr}" (ID: ${targetLesson.id})`);

  // 1. Ensure lesson has active local demo video and duration
  await db
    .update(lessons)
    .set({
      videoUrl: "/demo/inclusion-intro.mp4",
      durationSeconds: 580, // ~9.6 minutes
    })
    .where(eq(lessons.id, targetLesson.id));
  console.log("   ✓ Lesson videoUrl updated to /demo/inclusion-intro.mp4");

  // 2. Seed Chapters
  await db.delete(lessonChapters).where(eq(lessonChapters.lessonId, targetLesson.id));
  const chaptersData = [
    {
      titleFr: "1. Introduction & Évolution des Critères",
      titleAr: "1. مقدمة وتطور معايير التشخيص",
      startSeconds: 0,
      position: 1,
    },
    {
      titleFr: "2. La Triade Historique de Lorna Wing (1979)",
      titleAr: "2. ثالوث لورنا وينغ التاريخي (1979)",
      startSeconds: 85, // 01:25
      position: 2,
    },
    {
      titleFr: "3. La Dyade Diagnostique du DSM-5-TR",
      titleAr: "3. الثنائي التشخيصي في DSM-5-TR",
      startSeconds: 210, // 03:30
      position: 3,
    },
    {
      titleFr: "4. Particularités Sensorielles & Niveaux de Soutien",
      titleAr: "4. الخصائص الحسية ومستويات الدعم",
      startSeconds: 380, // 06:20
      position: 4,
    },
    {
      titleFr: "5. Implications Pratiques pour la Classe Ordinaire",
      titleAr: "5. التطبيقات العملية داخل القسم الدامج",
      startSeconds: 495, // 08:15
      position: 5,
    },
  ];

  for (const ch of chaptersData) {
    await db.insert(lessonChapters).values({
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      titleFr: ch.titleFr,
      titleAr: ch.titleAr,
      startSeconds: ch.startSeconds,
      position: ch.position,
    });
  }
  console.log(`   ✓ ${chaptersData.length} chapters seeded`);

  // 3. Seed Transcripts (French & Arabic)
  await db.delete(lessonTranscripts).where(eq(lessonTranscripts.lessonId, targetLesson.id));
  const frCues = [
    { start: 0, end: 12, text: "Bienvenue dans cette formation certifiante de l'Académie Nationale de l'Éducation Inclusive." },
    { start: 13, end: 35, text: "Aujourd'hui, nous explorons les fondements nosographiques du Trouble du Spectre de l'Autisme." },
    { start: 36, end: 60, text: "Pour accompagner efficacement un élève avec TSA en classe ordinaire, il est essentiel de comprendre l'évolution du diagnostic." },
    { start: 61, end: 84, text: "Cette compréhension permet de poser un regard bienveillant, scientifique et ajusté sur les comportements observés." },
    { start: 85, end: 120, text: "Historiquement, dès 1979, la psychiatre britannique Lorna Wing décrit la célèbre triade autistique." },
    { start: 121, end: 160, text: "Cette triade reposait sur trois piliers : les altérations de la communication, les altérations des interactions sociales, et les comportements répétitifs." },
    { start: 161, end: 209, text: "Ce modèle a guidé les praticiens pendant plus de trente ans, notamment à travers le DSM-IV." },
    { start: 210, end: 260, text: "En 2013, le DSM-5 opère une clarification majeure en regroupant ces manifestations en une dyade diagnostique." },
    { start: 261, end: 310, text: "L'Axe A concerne les déficits persistants de la communication et des interactions sociales réciproques." },
    { start: 311, end: 379, text: "L'Axe B regroupe le caractère restreint et répétitif des comportements, des intérêts ou des activités." },
    { start: 380, end: 430, text: "Deuxième révolution majeure du DSM-5 : la reconnaissance officielle des particularités du traitement sensoriel." },
    { start: 431, end: 494, text: "Hyper-réactivité aux bruits de la classe, hypo-sensibilité à la douleur ou recherche de stimulations vestibulaires." },
    { start: 495, end: 545, text: "En classe inclusive, notre rôle d'AVS ou d'enseignant est d'aménager l'environnement avant d'exiger une adaptation de l'élève." },
    { start: 546, end: 580, text: "Retrouvez les fiches synthèses sous la vidéo et testez vos connaissances avec le quiz de validation." },
  ];

  const arCues = [
    { start: 0, end: 12, text: "مرحبًا بكم في هذا التكوين المعتمد من الأكاديمية الوطنية للتربية الدامجة." },
    { start: 13, end: 35, text: "نستكشف اليوم الأسس العلمية والتشخيصية لاضطراب طيف التوحد." },
    { start: 36, end: 60, text: "لمرافقة تلميذ ذي طيف توحد بنجاح في القسم العادي، من الضروري فهم تطور المعايير التشخيصية." },
    { start: 61, end: 84, text: "هذا الفهم العلمي يمكننا من تبني نظرة إيجابية وموضوعية تجاه سلوكيات التلميذ." },
    { start: 85, end: 120, text: "تاريخيًا، ومنذ سنة 1979، وصفت الدكتورة لورنا وينغ الثالوث التوحدي الشهير." },
    { start: 121, end: 160, text: "ارتكز هذا الثالوث على: قصور التواصل، قصور التفاعل الاجتماعي، والاهتمامات النمطية المقيدة." },
    { start: 161, end: 209, text: "ظل هذا النموذج مرجعًا رئيسيًا في الدليل التشخيصي الرابع لأكثر من ثلاثة عقود." },
    { start: 210, end: 260, text: "في سنة 2013، أحدث الدليل التشخيصي الخامس نقلة نوعية بدمج المعايير في ثنائي تشخيصي واضح." },
    { start: 261, end: 310, text: "المجال (أ) يشمل القصور المستمر في التواصل والتفاعل الاجتماعي المتبادل." },
    { start: 311, end: 379, text: "المجال (ب) يشمل الأنماط السلوكية والاهتمامات المقيدة والتكرارية." },
    { start: 380, end: 430, text: "الإضافة النوعية الحاسمة هي الاعتراف الرسمي باضطرابات المعالجة الحسية كمعيار جوهري." },
    { start: 431, end: 494, text: "فرط الحساسية للضجيج المدرسي أو خمول الاستجابة للألم أو البحث عن مثيرات حسية معينة." },
    { start: 495, end: 545, text: "في التربية الدامجة، يتمثل دورنا الأساسي في تكييف البيئة الصفية لتقليل التوتر وتعزيز الاستقلالية." },
    { start: 546, end: 580, text: "اطلعوا على النقاط الأساسية أسفل الفيديو وقوموا بإجراء اختبار التقييم لتأكيد مكتسباتكم." },
  ];

  await db.insert(lessonTranscripts).values([
    {
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      language: "fr",
      cues: frCues,
    },
    {
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      language: "ar",
      cues: arCues,
    },
  ]);
  console.log("   ✓ Bilingual transcripts (FR & AR) seeded");

  // 4. Seed "L'essentiel" (Key Takeaways)
  await db.delete(lessonTakeaways).where(eq(lessonTakeaways.lessonId, targetLesson.id));
  const takeawaysData = [
    {
      titleFr: "Révolution Dyadique (DSM-5-TR)",
      titleAr: "الانتقال إلى النموذج الثنائي",
      summaryFr: "Le diagnostic regroupe désormais la communication et les interactions sociales sous l'Axe A, et les comportements restreints/répétitifs sous l'Axe B.",
      summaryAr: "يدمج التشخيص الحديث التواصل والتفاعل الاجتماعي في المجال (أ)، والسلوكيات النمطية في المجال (ب).",
      timestampSeconds: 210,
      position: 1,
    },
    {
      titleFr: "Reconnaissance Officielle des Particularités Sensorielles",
      titleAr: "الاعتراف الرسمي بالخصائص الحسية",
      summaryFr: "L'hyper ou hypo-réactivité aux stimuli sensoriels (bruit de cloche, néons, textures) fait partie intégrante des critères diagnostiques (Axe B.4).",
      summaryAr: "فرط أو خمول الاستجابة للمؤثرات الحسية (الأصوات، الإضاءة، الملمس) أصبح معيارًا تشخيصيًا رسميًا.",
      timestampSeconds: 380,
      position: 2,
    },
    {
      titleFr: "3 Niveaux de Soutien Fonctionnel",
      titleAr: "3 مستويات لشدة الاحتياج والدعم",
      summaryFr: "La sévérité n'est plus mesurée par des catégories figées mais par le niveau d'aide requis : Niveau 1 (Soutien), Niveau 2 (Important), Niveau 3 (Très important).",
      summaryAr: "تقاس الشدة بمستوى المساعدة المطلوبة: المستوى 1 (دعم)، المستوى 2 (دعم كبير)، المستوى 3 (دعم مكثف).",
      timestampSeconds: 430,
      position: 3,
    },
    {
      titleFr: "Principe Pédagogique Clé en Classe",
      titleAr: "القاعدة البيداغوجية الذهبية في القسم",
      summaryFr: "Aménager l'environnement (visuel, sonore, temporel) avant d'exiger une adaptation comportementale de l'élève.",
      summaryAr: "تكييف البيئة المادية والزمانية والبصرية قبل مطالبة التلميذ بالتكيف السلوكي.",
      timestampSeconds: 495,
      position: 4,
    },
  ];

  for (const tk of takeawaysData) {
    await db.insert(lessonTakeaways).values({
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      titleFr: tk.titleFr,
      titleAr: tk.titleAr,
      summaryFr: tk.summaryFr,
      summaryAr: tk.summaryAr,
      timestampSeconds: tk.timestampSeconds,
      position: tk.position,
      isDraft: false,
    });
  }
  console.log(`   ✓ ${takeawaysData.length} key takeaways seeded`);

  // 5. Seed Flashcards for Spaced Repetition
  await db.delete(lessonFlashcards).where(eq(lessonFlashcards.lessonId, targetLesson.id));
  const flashcardsData = [
    {
      conceptFr: "Dyade diagnostique du DSM-5",
      conceptAr: "الثنائي التشخيصي في DSM-5",
      definitionFr: "Axe A (Communication et interactions sociales réciproques) et Axe B (Comportements, intérêts et activités restreints et répétitifs).",
      definitionAr: "المجال (أ): التواصل والتفاعل الاجتماعي المتبادل. المجال (ب): السلوكيات والاهتمامات النمطية والمقيدة.",
      contextScenarioFr: "Comment classifier la difficulté d'un élève à partager une émotion ?",
      contextScenarioAr: "كيف نصنف صعوبة التلميذ في مشاركة الانفعالات الاجتماعية؟",
      position: 1,
    },
    {
      conceptFr: "Triade de Lorna Wing (1979)",
      conceptAr: "ثالوث لورنا وينغ (1979)",
      definitionFr: "Modèle clinique historique qui séparait la communication verbale/non verbale, les interactions sociales, et l'imagination/comportements répétitifs.",
      definitionAr: "النموذج التاريخي الذي كان يفصل بين التواصل اللفظي/غير اللفظي، التفاعل الاجتماعي، والاهتمامات التكرارية.",
      contextScenarioFr: "Quelle est la principale différence avec le DSM-5 ?",
      contextScenarioAr: "ما هو الفارق الجوهري مع الدليل التشخيصي الخامس؟",
      position: 2,
    },
    {
      conceptFr: "Hyper-réactivité sensorielle",
      conceptAr: "فرط الحساسية الحسية",
      definitionFr: "Réaction de détresse ou de saturation rapide face à des stimuli sensoriels ordinaires (cloche de l'école, néon clignotant, frottement d'étiquettes).",
      definitionAr: "استجابة حادة من الانزعاج أو فرط الاستثارة لمؤثرات حسية معتادة كأصوات الجرس أو الإضاءة القوية.",
      contextScenarioFr: "Un élève se bouche les oreilles lors de la récréation : que suspecter ?",
      contextScenarioAr: "تلميذ يغلق أذنيه عند دق جرس الاستراحة: ما التفسير الأرجح؟",
      position: 3,
    },
    {
      conceptFr: "Niveau 1 de sévérité DSM-5",
      conceptAr: "المستوى الأول للشدة في DSM-5",
      definitionFr: "« Nécessite un soutien » : Sans aide, les difficultés de communication sociale causent des entraves notables, avec des difficultés d'organisation.",
      definitionAr: "«يحتاج إلى دعم»: في غياب المرافقة، تؤدي صعوبات التواصل إلى عوائق وظيفية ملحوظة في التنظيم.",
      contextScenarioFr: "Un élève autonome scolairement mais isolé dans la cour : quel niveau ?",
      contextScenarioAr: "تلميذ مستقل دراسيًا لكنه يواجه صعوبة في الاندماج بالساحة: أي مستوى؟",
      position: 4,
    },
    {
      conceptFr: "Estompage de guidance (Prompt Fading)",
      conceptAr: "التلاشي التدريجي للمساعدة (Prompt Fading)",
      definitionFr: "Technique consistant à réduire progressivement l'intensité de l'aide physique ou verbale pour construire l'autonomie pérenne de l'élève.",
      definitionAr: "استراتيجية تقليل الدعم المادي أو اللفظي تدريجيًا لتمكين التلميذ من الاعتماد على نفسه.",
      contextScenarioFr: "Pourquoi éviter qu'un AVS fasse systématiquement l'exercice à la place de l'élève ?",
      contextScenarioAr: "لماذا يحذر من قيام المرافق بكتابة الإجابة نيابة عن التلميذ؟",
      position: 5,
    },
  ];

  for (const fc of flashcardsData) {
    await db.insert(lessonFlashcards).values({
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      conceptFr: fc.conceptFr,
      conceptAr: fc.conceptAr,
      definitionFr: fc.definitionFr,
      definitionAr: fc.definitionAr,
      contextScenarioFr: fc.contextScenarioFr,
      contextScenarioAr: fc.contextScenarioAr,
      position: fc.position,
      isDraft: false,
    });
  }
  console.log(`   ✓ ${flashcardsData.length} flashcards seeded`);

  // 6. Seed "Mettre en pratique" Classroom Action
  await db.delete(lessonPracticeActions).where(eq(lessonPracticeActions.lessonId, targetLesson.id));
  await db.insert(lessonPracticeActions).values({
    id: crypto.randomUUID(),
    lessonId: targetLesson.id,
    titleFr: "Audit sensoriel bienveillant de votre classe",
    titleAr: "تدقيق حسي ومكاني لبيئة القسم",
    instructionsFr: "Cette semaine en classe ordinaire, observez votre environnement avec les yeux d'un élève à profil sensoriel sensible. Identifiez 2 sources de gêne auditive ou visuelle (ex: place trop proche de la porte ou du radiateur, réverbération sonore). Proposez un micro-aménagement doux à l'équipe.",
    instructionsAr: "خلال هذا الأسبوع، عاين بيئة القسم بنظرة واعية لخصوصيات المعالجة الحسية. حدد مصدرين محتملين للإزعاج الحسي (مثل مقعد مجاور للباب أو إضاءة مباشرة قوية) واقترح تعديلاً بسيطًا بالتعاون مع المعلم.",
    isDraft: false,
  });
  console.log("   ✓ Practical classroom action item seeded");

  // 7. Seed End-of-Lesson Formative Quiz Questions
  await db.delete(lessonQuizQuestions).where(eq(lessonQuizQuestions.lessonId, targetLesson.id));
  const quizData = [
    {
      promptFr: "Quel est le changement conceptuel majeur introduit par le DSM-5 par rapport à la triade de Lorna Wing ?",
      promptAr: "ما هو التغيير المفهومي الرئيسي الذي أحدثه الدليل التشخيصي الخامس مقارنة بثالوث لورنا وينغ؟",
      type: "SINGLE_CHOICE",
      options: [
        { id: "opt1", textFr: "La fusion de la communication et des interactions sociales en un axe unique", textAr: "دمج التواصل والتفاعل الاجتماعي في محور واحد" },
        { id: "opt2", textFr: "La suppression totale du critère des comportements répétitifs", textAr: "الحذف التام لمعيار السلوكيات التكرارية" },
        { id: "opt3", textFr: "L'obligation d'un scanner cérébral pour poser le diagnostic", textAr: "اشتراط فحص بالرنين المغناطيسي لتأكيد التشخيص" },
      ],
      correctOptionIds: ["opt1"],
      explanationFr: "Le DSM-5 a réuni la communication verbale/non-verbale et les interactions sociales sous l'Axe A, formant ainsi une dyade clinique.",
      explanationAr: "قام الدليل الخامس بدمج التواصل والتفاعل الاجتماعي ضمن المجال (أ) لتشكيل الثنائي التشخيصي.",
      timestampSeconds: 210,
      position: 1,
    },
    {
      promptFr: "Dans quel axe du DSM-5 les particularités sensorielles (hyper ou hypo-réactivité) sont-elles intégrées ?",
      promptAr: "ضمن أي مجال في DSM-5 تم إدراج الخصائص والاضطرابات الحسية رسميًا؟",
      type: "SINGLE_CHOICE",
      options: [
        { id: "opt1", textFr: "Axe A (Communication sociale)", textAr: "المجال (أ): التواصل الاجتماعي" },
        { id: "opt2", textFr: "Axe B (Comportements et intérêts restreints/répétitifs)", textAr: "المجال (ب): السلوكيات والاهتمامات النمطية" },
        { id: "opt3", textFr: "Elles ne sont pas reconnues dans le DSM-5", textAr: "لم يتم الاعتراف بها في الدليل الخامس" },
      ],
      correctOptionIds: ["opt2"],
      explanationFr: "Les anomalies de modulation sensorielle constituent le sous-critère 4 de l'Axe B dans le DSM-5.",
      explanationAr: "تعد اضطرابات المعالجة الحسية المعيار الفرعي الرابع ضمن المجال (ب) في DSM-5.",
      timestampSeconds: 380,
      position: 2,
    },
    {
      promptFr: "Cas pratique : Un élève avec TSA se met à crier et refuse d'entrer en classe après la sonnerie. Quelle hypothèse prioritaire devez-vous explorer ?",
      promptAr: "حالة تطبيقية: يصرخ تلميذ ذو طيف توحد ويرفض دخول القسم إثر رنين الجرس. ما الفرضية ذات الأولوية التي ينبغي فحصها؟",
      type: "SINGLE_CHOICE",
      options: [
        { id: "opt1", textFr: "Une opposition volontaire à l'autorité du maître", textAr: "عناد مقصود لمعارضة سلطة المعلم" },
        { id: "opt2", textFr: "Une surcharge auditive intense provoquée par la sonnerie stridente", textAr: "فرط استثارة حسية وانزعاج حاد من صوت الجرس المرتفع" },
        { id: "opt3", textFr: "Un manque de motivation scolaire pour la matière", textAr: "غياب الحافز الدراسي للمادة التعليمية" },
      ],
      correctOptionIds: ["opt2"],
      explanationFr: "L'hyper-réactivité acoustique est très fréquente. Un casque anti-bruit ou une entrée 2 minutes avant la sonnerie désamorce immédiatement ce type de crise.",
      explanationAr: "فرط الاستجابة السمعية شائع جدًا. توفير سماعات عازلة أو الدخول دقيقتين قبل الجرس يحمي التلميذ من الأزمة.",
      timestampSeconds: 430,
      position: 3,
    },
    {
      promptFr: "Comment le DSM-5 définit-il les 3 niveaux de sévérité du TSA ?",
      promptAr: "كيف يحدد الدليل التشخيصي الخامس المستويات الثلاثة لشدة طيف التوحد؟",
      type: "SINGLE_CHOICE",
      options: [
        { id: "opt1", textFr: "Par le niveau d'aide et de soutien requis par la personne", textAr: "وفق مستوى المساعدة والدعم الذي يحتاجه الشخص" },
        { id: "opt2", textFr: "Uniquement par le quotient intellectuel (QI)", textAr: "حصرًا بناءً على معدل الذكاء (QI)" },
        { id: "opt3", textFr: "Par l'âge auquel les premiers mots sont apparus", textAr: "وفق العمر الذي ظهرت فيه الكلمات الأولى" },
      ],
      correctOptionIds: ["opt1"],
      explanationFr: "Les 3 niveaux du DSM-5 évaluent le besoin de soutien fonctionnel : Niveau 1 (Soutien), Niveau 2 (Important), Niveau 3 (Très important).",
      explanationAr: "تقيم المستويات الثلاثة الاحتياج الواقعي للدعم والمرافقة وليس مجرد مقياس ذكاء مجرد.",
      timestampSeconds: 430,
      position: 4,
    },
  ];

  for (const q of quizData) {
    await db.insert(lessonQuizQuestions).values({
      id: crypto.randomUUID(),
      lessonId: targetLesson.id,
      promptFr: q.promptFr,
      promptAr: q.promptAr,
      type: q.type,
      options: q.options,
      correctOptionIds: q.correctOptionIds,
      explanationFr: q.explanationFr,
      explanationAr: q.explanationAr,
      timestampSeconds: q.timestampSeconds,
      position: q.position,
      isDraft: false,
    });
  }
  console.log(`   ✓ ${quizData.length} validation quiz questions seeded`);

  console.log("\n✅ Learning Experience Upgrade dataset successfully seeded!\n");
}

if (require.main === module) {
  seedLearningUpgrade()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
