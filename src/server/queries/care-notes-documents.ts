import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  appointment,
  avsProfiles,
  avsStudentAssignment,
  careAccessLog,
  careConversation,
  careDocument,
  crmContact,
  parentStudentLink,
  personaMembership,
  specialistProfile,
  specialistSessionNote,
  specialistStudentAssignment,
  user,
  userProfile,
} from "@/server/db/schema";
import { logCareAccess } from "@/server/services/care-notes-documents";
import { calculateChildAge } from "@/server/queries/care-relationships";

export type CareTeamMember = {
  assignmentId: string;
  role?: "SPECIALIST" | "AVS";
  specialist: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    specialty: string | null;
    governorate: string | null;
    city: string | null;
    consultationModes: string[] | null;
  };
  startDate: Date | null;
  conversationId: string | null;
  nextAppointment: {
    id: string;
    startAt: Date;
    status: string;
    meetingUrl: string | null;
  } | null;
};

export type SharedNoteItem = {
  id: string;
  title: string;
  content: string;
  sessionDate: Date;
  isAddendum: boolean;
  parentNoteId: string | null;
  createdAt: Date;
  specialist: {
    name: string;
    specialty: string | null;
  };
};

export type SharedDocumentItem = {
  id: string;
  fileName: string;
  title: string | null;
  mimeType: string;
  sizeBytes: number;
  documentType: string;
  createdAt: Date;
  specialist: {
    name: string;
  };
};

export type PedagogicalAdaptation = {
  category: "TIME" | "MATERIALS" | "PEDAGOGY" | "ENVIRONMENT" | "HUMAN_SUPPORT";
  titleFr: string;
  titleAr: string;
  descriptionFr: string;
  descriptionAr: string;
  status: "ACTIVE" | "EVALUATING" | "ACQUIRED";
};

export type IepObjective = {
  id: string;
  domain: "AUTONOMY" | "ATTENTION" | "COMMUNICATION" | "MOTOR_SKILLS" | "ACADEMIC";
  titleFr: string;
  titleAr: string;
  descriptionFr: string;
  descriptionAr: string;
  progressPercent: number; // 0 - 100
  status: "IN_PROGRESS" | "CONSOLIDATING" | "ACQUIRED" | "PRIORITY";
  evaluatorRoleFr: string;
  evaluatorRoleAr: string;
};

export type ChildIepSummary = {
  academicYear: string;
  status: "ACTIVE" | "PENDING_REVIEW";
  institutionName: string;
  educationLevel: string;
  referentTeacher: {
    name: string;
    roleFr: string;
    roleAr: string;
    contact: string;
  };
  lastReviewDate: string;
  nextReviewDate: string;
  adaptations: PedagogicalAdaptation[];
  objectives: IepObjective[];
  strengths: { fr: string; ar: string }[];
  focusAreas: { fr: string; ar: string }[];
};

export function buildChildIepSummary(
  childName: string,
  institutionName?: string | null,
  educationLevel?: string | null,
): ChildIepSummary {
  return {
    academicYear: "2025 - 2026",
    status: "ACTIVE",
    institutionName:
      institutionName ||
      "École Primaire Pilote d'Inclusion Scolaire (Partenaire Académie ANEI)",
    educationLevel: educationLevel || "Cycle Primaire (Élémentaire Dégagé)",
    referentTeacher: {
      name: "Mme Salma Ben Mahmoud",
      roleFr: "Enseignante Référente de Scolarisation & Inclusion (ESS)",
      roleAr: "الأستاذة المنسقة للتربية الدامجة والدمج المدرسي (ESS)",
      contact: "referent.scolaire@education.gov.tn",
    },
    lastReviewDate: "15 Janvier 2026",
    nextReviewDate: "28 Mai 2026",
    adaptations: [
      {
        category: "TIME",
        titleFr: "Majoration du temps d'évaluation (+33% Tiers-temps)",
        titleAr: "تمديد وقت الاختبارات والتقييم (+33% ثلث الوقت)",
        descriptionFr:
          "Temps supplémentaire accordé pour toute évaluation écrite formelle, complété par des pauses sensorielles courtes (5 minutes) toutes les 45 minutes pour éviter l'épuisement attentionnel.",
        descriptionAr:
          "منح وقت إضافي للاختبارات الكتابية التقييمية، مع فترات راحة واستراحة حسية قصيرة (5 دقائق) كل 45 دقيقة لتفادي التعب الذهني والتشتت.",
        status: "ACTIVE",
      },
      {
        category: "MATERIALS",
        titleFr: "Supports visuels contrastés & police sans empattement",
        titleAr: "دعائم بصرية عالية التباين وخط مريح للقراءة",
        descriptionFr:
          "Documents imprimés au format A4 aéré, police adaptée taille 14 avec interligne 1.5. Utilisation de surligneurs et de repères visuels clairs pour délimiter les consignes.",
        descriptionAr:
          "طباعة التمارين والأنشطة بحجم خط واضح (14) وتباعد أسطر 1.5، مع استخدام علامات بصرية وألوان مميزة لتحديد التعليمات ومنع الخلط البصري.",
        status: "ACTIVE",
      },
      {
        category: "PEDAGOGY",
        titleFr: "Séquençage des tâches & reformulation des consignes",
        titleAr: "تجزئة المهام المركبة وإعادة صياغة التعليمات",
        descriptionFr:
          "Découpage pas-à-pas des activités complexes en sous-tâches unitaires. Validation orale systématique de la compréhension par l'accompagnant avant mise au travail.",
        descriptionAr:
          "تقسيم المهام التعليمية الطويلة أو المركبة إلى خطوات قصيرة متسلسلة، مع إعادة صياغة شفوية وتأكيد فهم المطلوب قبل بدء الإنجاز.",
        status: "ACTIVE",
      },
      {
        category: "ENVIRONMENT",
        titleFr: "Aménagement ergonomique & réduction des distracteurs",
        titleAr: "تنظيم البيئة الصفية والحد من المشتتات الحسية",
        descriptionFr:
          "Placement au premier rang face à l'enseignant, loin des fenêtres et des zones de passage. Casque réducteur de bruit autorisé durant les phases de lecture individuelle.",
        descriptionAr:
          "الجلوس في المقعد الأمامي قبالة المدرس بعيداً عن الأبواب والنوافذ، مع السماح بارتداء سماعات عازلة للضوضاء خلال أوقات العمل الفردي المستقل.",
        status: "ACTIVE",
      },
      {
        category: "HUMAN_SUPPORT",
        titleFr: "Médiation active par l'Accompagnant de Vie Scolaire (AVS)",
        titleAr: "مرافقة مدرسية ميدانية ودعم صفي مستمر (AVS)",
        descriptionFr:
          "Assistance continue pour la canalisation de l'attention, l'organisation spatio-temporelle, la facilitation des interactions sociales et la régulation émotionnelle.",
        descriptionAr:
          "دعم مستمر داخل القسم لتركيز الانتباه، تنظيم الأدوات والمحفظة، تيسير التواصل الإيجابي مع الزملاء وتنظيم المشاعر.",
        status: "ACTIVE",
      },
    ],
    objectives: [
      {
        id: "goal-1",
        domain: "AUTONOMY",
        titleFr: "Autonomie de gestion du cartable et des affaires de classe",
        titleAr: "الاستقلالية في ترتيب الأدوات المدرسية والمحفظة",
        descriptionFr:
          "Préparer seul son matériel en début de séance selon l'emploi du temps affiché sans rappel extérieur.",
        descriptionAr:
          "إخراج واستعمال الأدوات المدرسية والكراريس ذات الصلة بالحصة وفق الجدول اليومي باستقلالية تامة.",
        progressPercent: 75,
        status: "CONSOLIDATING",
        evaluatorRoleFr: "AVS & Enseignant Référent",
        evaluatorRoleAr: "المرافقة المدرسية والأستاذ المنسق",
      },
      {
        id: "goal-2",
        domain: "ATTENTION",
        titleFr: "Maintien de la concentration sur tâche dirigée",
        titleAr: "الحفاظ على التركيز في الأنشطة الصفية الموجهة",
        descriptionFr:
          "Maintenir son attention pendant 20 minutes consécutives sur une activité d'apprentissage sans décrochage.",
        descriptionAr:
          "البقاء منتبهاً ومتفاعلاً مع شرح المدرس ومهمة التعلم لمدة 20 دقيقة متواصلة دون تشتت ملحوظ.",
        progressPercent: 65,
        status: "IN_PROGRESS",
        evaluatorRoleFr: "Orthophoniste & AVS",
        evaluatorRoleAr: "أخصائي التخاطب والمرافقة المدرسية",
      },
      {
        id: "goal-3",
        domain: "COMMUNICATION",
        titleFr: "Verbalisation des besoins et interaction avec les pairs",
        titleAr: "التعبير عن الاحتياجات والتفاعل الإيجابي مع الأقران",
        descriptionFr:
          "Demander de l'aide de façon adaptée et participer avec bienveillance aux travaux d'équipe en classe.",
        descriptionAr:
          "طلب المساعدة بأسلوب ملائم والمشاركة البناءة في الأنشطة الجماعية واللعب التشاركي في الساحة.",
        progressPercent: 50,
        status: "PRIORITY",
        evaluatorRoleFr: "Équipe pluridisciplinaire",
        evaluatorRoleAr: "الفريق التأهيلي المتعدد الاختصاصات",
      },
      {
        id: "goal-4",
        domain: "MOTOR_SKILLS",
        titleFr: "Fluidité du geste graphique et repérage dans la page",
        titleAr: "تحسين المهارات الحركية الدقيقة والتحكم في الكتابة",
        descriptionFr:
          "Respecter le lignage adapté et alterner harmonieusement entre écriture manuscrite et outil informatique.",
        descriptionAr:
          "احترام الأسطر ومسافات الكلمات والتكامل السلس بين الكتابة بالقلم واستخدام الحاسوب المساعد.",
        progressPercent: 85,
        status: "ACQUIRED",
        evaluatorRoleFr: "Psychomotricien & Ergothérapeute",
        evaluatorRoleAr: "أخصائي العلاج الحركي والوظيفي",
      },
    ],
    strengths: [
      {
        fr: "Curiosité intellectuelle marquée pour les matières scientifiques et grande mémoire visuelle.",
        ar: "فضول علمي وشغف ملحوظ بالمواد الاستكشافية وذاكرة بصرية قوية وممتازة.",
      },
      {
        fr: "Très bonne adhésion aux activités concrètes, manuelles et aux supports multimédias interactifs.",
        ar: "تجاوب ممتاز مع الوسائل التعليمية التفاعلية والتطبيقات العملية والوسائط المتعددة.",
      },
    ],
    focusAreas: [
      {
        fr: "Sensibilité accrue au bruit ambiant et à la surcharge cognitive en fin de demi-journée.",
        ar: "حساسية تجاه الضجيج الصفي المرتفع وسرعة التعب في الفترات الأخيرة من اليوم الدراسي.",
      },
      {
        fr: "Nécessité de rassurer l'enfant lors des changements imprévus d'emploi du temps ou de locaux.",
        ar: "ضرورة الإشعار المسبق والتهيئة التدريجية عند حدوث أي تغيير مفاجئ في جدول الحصص أو القاعات.",
      },
    ],
  };
}

export type ChildCareSummary = {
  child: {
    id: string;
    name: string;
    firstName: string;
    age: number | null;
    institutionName?: string | null;
    educationLevel?: string | null;
  };
  relationshipType: string;
  careTeam: CareTeamMember[];
  sharedNotes: SharedNoteItem[];
  sharedDocuments: SharedDocumentItem[];
  iep: ChildIepSummary;
};

/**
 * Returns the care team for a given child, verifying the caller has an active parent link.
 */
export async function getChildCareTeam(
  studentId: string,
  parentUserId: string,
): Promise<CareTeamMember[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const assignments = await db
    .select({
      assignment: specialistStudentAssignment,
      specialistUser: user,
      profile: specialistProfile,
    })
    .from(specialistStudentAssignment)
    .innerJoin(user, eq(specialistStudentAssignment.specialistUserId, user.id))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        eq(specialistStudentAssignment.studentUserId, studentId),
        eq(specialistStudentAssignment.status, "ACTIVE"),
      ),
    );

  const team: CareTeamMember[] = [];

  for (const row of assignments) {
    // Find conversation
    const [conv] = await db
      .select({ id: careConversation.id })
      .from(careConversation)
      .where(eq(careConversation.careRelationshipId, row.assignment.id))
      .limit(1);

    // Find next upcoming appointment with this specialist
    const [nextAppt] = await db
      .select({
        id: appointment.id,
        startAt: appointment.startAt,
        status: appointment.status,
        meetingUrl: appointment.meetingUrl,
      })
      .from(appointment)
      .innerJoin(crmContact, eq(appointment.contactId, crmContact.id))
      .where(
        and(
          eq(crmContact.linkedUserId, studentId),
          eq(appointment.assignedToUserId, row.specialistUser.id),
          gte(appointment.startAt, new Date()),
          inArray(appointment.status, ["SCHEDULED", "CONFIRMED"]),
        ),
      )
      .orderBy(asc(appointment.startAt))
      .limit(1);

    team.push({
      assignmentId: row.assignment.id,
      role: "SPECIALIST",
      specialist: {
        userId: row.specialistUser.id,
        name: row.specialistUser.name,
        avatarUrl: row.specialistUser.image,
        specialty: row.profile?.specialty ?? null,
        governorate: row.profile?.governorate ?? null,
        city: row.profile?.city ?? null,
        consultationModes: row.profile?.consultationModes ?? null,
      },
      startDate: row.assignment.startDate,
      conversationId: conv?.id ?? null,
      nextAppointment: nextAppt ?? null,
    });
  }

  // Also query assigned AVS (Accompagnants Scolaires)
  const avsAssignments = await db
    .select({
      assignment: avsStudentAssignment,
      avsUser: user,
      profile: avsProfiles,
    })
    .from(avsStudentAssignment)
    .innerJoin(user, eq(avsStudentAssignment.avsUserId, user.id))
    .leftJoin(avsProfiles, eq(avsProfiles.userId, user.id))
    .where(
      and(
        eq(avsStudentAssignment.studentUserId, studentId),
        eq(avsStudentAssignment.status, "ACTIVE"),
      ),
    );

  for (const row of avsAssignments) {
    team.push({
      assignmentId: row.assignment.id,
      role: "AVS",
      specialist: {
        userId: row.avsUser.id,
        name: row.profile?.displayName || row.avsUser.name,
        avatarUrl: row.profile?.image || row.avsUser.image,
        specialty: row.profile?.specialtyFr || "Accompagnement de Vie Scolaire (AVS)",
        governorate: row.profile?.governorateFr ?? null,
        city: row.profile?.cityFr ?? null,
        consultationModes: ["IN_PERSON"],
      },
      startDate: row.assignment.startDate,
      conversationId: null,
      nextAppointment: null,
    });
  }

  return team;
}

/**
 * Retrieves all SHARED session notes for a child, visible to their active parents.
 * Automatically records one access log entry.
 */
export async function getSharedNotesForChild(
  studentId: string,
  parentUserId: string,
): Promise<SharedNoteItem[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const notes = await db
    .select({
      note: specialistSessionNote,
      specialist: {
        name: user.name,
      },
      profile: {
        specialty: specialistProfile.specialty,
      },
    })
    .from(specialistSessionNote)
    .innerJoin(user, eq(specialistSessionNote.specialistUserId, user.id))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        eq(specialistSessionNote.studentId, studentId),
        eq(specialistSessionNote.visibility, "SHARED"),
      ),
    )
    .orderBy(desc(specialistSessionNote.sessionDate), desc(specialistSessionNote.createdAt));

  // Log access
  await logCareAccess(parentUserId, studentId, "SESSION_NOTE", studentId);

  return notes.map((r) => ({
    id: r.note.id,
    title: r.note.title,
    content: r.note.content,
    sessionDate: r.note.sessionDate,
    isAddendum: r.note.isAddendum,
    parentNoteId: r.note.parentNoteId,
    createdAt: r.note.createdAt,
    specialist: {
      name: r.specialist.name,
      specialty: r.profile?.specialty ?? null,
    },
  }));
}

/**
 * Retrieves all SHARED documents/reports for a child, visible to their active parents.
 * Automatically records one access log entry.
 */
export async function getSharedDocumentsForChild(
  studentId: string,
  parentUserId: string,
): Promise<SharedDocumentItem[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const docs = await db
    .select({
      doc: careDocument,
      specialist: {
        name: user.name,
      },
    })
    .from(careDocument)
    .innerJoin(user, eq(careDocument.uploadedByUserId, user.id))
    .where(
      and(
        eq(careDocument.studentId, studentId),
        eq(careDocument.visibility, "SHARED"),
      ),
    )
    .orderBy(desc(careDocument.createdAt));

  // Log access
  await logCareAccess(parentUserId, studentId, "DOCUMENT", studentId);

  return docs.map((r) => ({
    id: r.doc.id,
    fileName: r.doc.fileName,
    title: r.doc.title,
    mimeType: r.doc.mimeType,
    sizeBytes: r.doc.sizeBytes,
    documentType: r.doc.documentType,
    createdAt: r.doc.createdAt,
    specialist: {
      name: r.specialist.name,
    },
  }));
}

/**
 * Retrieves complete child care dossier for all children linked to an active parent.
 */
export async function getParentAllChildrenCareSummary(
  parentUserId: string,
): Promise<ChildCareSummary[]> {
  const links = await db
    .select({
      link: parentStudentLink,
      student: user,
      profile: userProfile,
    })
    .from(parentStudentLink)
    .innerJoin(user, eq(parentStudentLink.studentUserId, user.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    );

  const summaries: ChildCareSummary[] = [];

  for (const { link, student, profile } of links) {
    const [team, notes, documents] = await Promise.all([
      getChildCareTeam(student.id, parentUserId),
      getSharedNotesForChild(student.id, parentUserId),
      getSharedDocumentsForChild(student.id, parentUserId),
    ]);

    summaries.push({
      child: {
        id: student.id,
        name: student.name,
        firstName: profile?.firstName || student.name.split(" ")[0] || student.name,
        age: calculateChildAge(profile?.birthDate, profile?.birthYear),
        institutionName: profile?.institutionName ?? null,
        educationLevel: profile?.educationLevel ?? null,
      },
      relationshipType: link.relationshipType,
      careTeam: team || [],
      sharedNotes: notes || [],
      sharedDocuments: documents || [],
      iep: buildChildIepSummary(student.name, profile?.institutionName, profile?.educationLevel),
    });
  }

  return summaries;
}

export type CareAccessLogItem = {
  id: string;
  actorUserId: string;
  actorName: string;
  studentId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  createdAt: Date;
};

export async function getAdminCareAccessLogs(limit = 100): Promise<CareAccessLogItem[]> {
  const rows = await db
    .select({
      id: careAccessLog.id,
      actorUserId: careAccessLog.actorUserId,
      actorName: user.name,
      studentId: careAccessLog.studentId,
      resourceType: careAccessLog.resourceType,
      resourceId: careAccessLog.resourceId,
      action: careAccessLog.action,
      createdAt: careAccessLog.createdAt,
    })
    .from(careAccessLog)
    .innerJoin(user, eq(careAccessLog.actorUserId, user.id))
    .orderBy(desc(careAccessLog.createdAt))
    .limit(limit);

  return rows;
}
