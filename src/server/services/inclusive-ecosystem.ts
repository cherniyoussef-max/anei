import { db } from "@/server/db";
import {
  user,
  teacherClassrooms,
  teacherClassroomStudents,
  partnerEstablishments,
  establishmentServiceRequests,
  serviceRequestMessages,
  specialistClassroomTips,
} from "@/server/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import {
  computeRecommendedAdaptations,
  DifficultyKey,
} from "@/lib/inclusive-taxonomy";

export interface DemoStudentInit {
  displayName: string;
  difficulties: DifficultyKey[];
  personalNote?: string;
}

const DEFAULT_DEMO_STUDENTS: DemoStudentInit[] = [
  { displayName: "Amine B.", difficulties: ["dys"], personalNote: "Préfère quand les consignes sont lues à voix haute." },
  { displayName: "Salma K.", difficulties: ["tdah", "comp"], personalNote: "Prévoir des étapes découpées et un minuteur visuel." },
  { displayName: "Youssef M.", difficulties: ["vis"], personalNote: "Contraste élevé nécessaire et placement au premier rang." },
  { displayName: "Ines T.", difficulties: ["tsa"], personalNote: "Avertir avant chaque transition, consignes très explicites." },
  { displayName: "Rayan H.", difficulties: ["aud"], personalNote: "Consignes écrites et schémas au tableau." },
  { displayName: "Nour A.", difficulties: [], personalNote: "" },
];

/**
 * Ensures a teacher has a default classroom and returns it with its students.
 */
export async function getOrCreateTeacherClassroom(teacherUserId: string) {
  let [classroom] = await db
    .select()
    .from(teacherClassrooms)
    .where(eq(teacherClassrooms.teacherUserId, teacherUserId))
    .limit(1);

  if (!classroom) {
    const [created] = await db
      .insert(teacherClassrooms)
      .values({
        teacherUserId,
        className: "Ma classe inclusive (4ème)",
        palettePreset: "Classique",
      })
      .returning();
    classroom = created;

    // Seed initial students
    for (const s of DEFAULT_DEMO_STUDENTS) {
      const adaptations = computeRecommendedAdaptations(s.difficulties);
      await db.insert(teacherClassroomStudents).values({
        classroomId: classroom.id,
        teacherUserId,
        displayName: s.displayName,
        difficulties: s.difficulties,
        adaptations,
        personalNote: s.personalNote || "",
        downloadStatus: "A_TELECHARGER",
      });
    }
  }

  const students = await db
    .select()
    .from(teacherClassroomStudents)
    .where(eq(teacherClassroomStudents.classroomId, classroom.id))
    .orderBy(asc(teacherClassroomStudents.createdAt));

  const tips = await db
    .select()
    .from(specialistClassroomTips)
    .where(eq(specialistClassroomTips.isPublished, true))
    .orderBy(desc(specialistClassroomTips.createdAt));

  return {
    classroom,
    students,
    tips,
  };
}

/**
 * Ensures a partner establishment exists for this manager (or returns demo default)
 */
export async function getOrCreatePartnerEstablishment(managerUserId: string) {
  let [est] = await db
    .select()
    .from(partnerEstablishments)
    .where(eq(partnerEstablishments.managerUserId, managerUserId))
    .limit(1);

  if (!est) {
    // If user has no establishment yet, check if any establishment exists or create default Ibn Khaldoun
    const [created] = await db
      .insert(partnerEstablishments)
      .values({
        managerUserId,
        name: "Collège Ibn Khaldoun",
        level: "Collège",
        region: "Tunis",
        studentCount: 480,
        needsBreakdownJson: { dys: 12, tdah: 8, vis: 2, aud: 1, tsa: 5, comp: 14 },
        existingResourcesJson: ["salle"],
        constraintsJson: ["mat", "forme"],
        partnershipStage: 2,
      })
      .returning();
    est = created;

    // Seed initial requests
    const r1 = await db
      .insert(establishmentServiceRequests)
      .values({
        referenceCode: "D-2026-014",
        establishmentId: est.id,
        serviceType: "form",
        urgency: "Normale",
        concernedCount: 12,
        situationDescription: "Formation sur l'accueil des élèves avec TDAH en classe ordinaire.",
        stage: 2,
      })
      .returning();

    await db.insert(serviceRequestMessages).values({
      requestId: r1[0].id,
      senderRole: "Académie",
      senderName: "Conseiller Académique",
      body: "Demande reçue. Un formateur spécialisé est en cours d'affectation pour votre établissement.",
    });

    const r2 = await db
      .insert(establishmentServiceRequests)
      .values({
        referenceCode: "D-2026-011",
        establishmentId: est.id,
        serviceType: "cons",
        urgency: "Urgente",
        concernedCount: 1,
        situationDescription: "Conseil personnalisé pour un élève de 6e qui refuse d'écrire.",
        stage: 3,
        scheduledRdvJson: { d: "14/10/2026", h: "10h", mo: "En ligne" },
      })
      .returning();

    await db.insert(serviceRequestMessages).values([
      {
        requestId: r2[0].id,
        senderRole: "Académie",
        senderName: "Dr. Amel Bouazizi",
        body: "Rendez-vous proposé le 14/10 à 10h en visio-conférence.",
      },
      {
        requestId: r2[0].id,
        senderRole: "Établissement",
        senderName: "Direction Collège",
        body: "Parfait, nous confirmons la présence du professeur principal et de la coordinatrice.",
      },
    ]);

    const r3 = await db
      .insert(establishmentServiceRequests)
      .values({
        referenceCode: "D-2026-007",
        establishmentId: est.id,
        serviceType: "mat",
        urgency: "Normale",
        concernedCount: 3,
        situationDescription: "Prêt de 3 loupes électroniques et d'un clavier adapté.",
        stage: 4,
      })
      .returning();

    await db.insert(serviceRequestMessages).values({
      requestId: r3[0].id,
      senderRole: "Académie",
      senderName: "Pôle Matériel Adapté",
      body: "Matériel remis le 20/09. Merci de le retourner en fin d'année scolaire après inventaire.",
    });
  }

  // Fetch requests & messages
  const requests = await db
    .select()
    .from(establishmentServiceRequests)
    .where(eq(establishmentServiceRequests.establishmentId, est.id))
    .orderBy(desc(establishmentServiceRequests.createdAt));

  // Group messages by requestId
  const allMessages = await db
    .select()
    .from(serviceRequestMessages)
    .orderBy(asc(serviceRequestMessages.createdAt));

  const messagesByRequestId = allMessages.reduce<Record<string, typeof allMessages>>((acc, msg) => {
    if (!acc[msg.requestId]) acc[msg.requestId] = [];
    acc[msg.requestId].push(msg);
    return acc;
  }, {});

  return {
    establishment: est,
    requests: requests.map((r) => ({
      ...r,
      messages: messagesByRequestId[r.id] || [],
    })),
  };
}

/**
 * Returns full workspace data for the Specialist view.
 */
export async function getSpecialistWorkspaceData(specialistUserId?: string) {
  // Ensure at least one demo establishment and requests exist
  const dummyManager = specialistUserId || "system-demo";
  await getOrCreatePartnerEstablishment(dummyManager);

  // Fetch all establishments
  const allEstablishments = await db.select().from(partnerEstablishments);

  // Fetch all service requests
  const requests = await db
    .select({
      id: establishmentServiceRequests.id,
      referenceCode: establishmentServiceRequests.referenceCode,
      establishmentId: establishmentServiceRequests.establishmentId,
      assignedSpecialistUserId: establishmentServiceRequests.assignedSpecialistUserId,
      serviceType: establishmentServiceRequests.serviceType,
      urgency: establishmentServiceRequests.urgency,
      concernedCount: establishmentServiceRequests.concernedCount,
      situationDescription: establishmentServiceRequests.situationDescription,
      stage: establishmentServiceRequests.stage,
      scheduledRdvJson: establishmentServiceRequests.scheduledRdvJson,
      createdAt: establishmentServiceRequests.createdAt,
      updatedAt: establishmentServiceRequests.updatedAt,
      establishmentName: partnerEstablishments.name,
      establishmentLevel: partnerEstablishments.level,
      establishmentRegion: partnerEstablishments.region,
    })
    .from(establishmentServiceRequests)
    .leftJoin(
      partnerEstablishments,
      eq(establishmentServiceRequests.establishmentId, partnerEstablishments.id)
    )
    .orderBy(desc(establishmentServiceRequests.createdAt));

  const allMessages = await db
    .select()
    .from(serviceRequestMessages)
    .orderBy(asc(serviceRequestMessages.createdAt));

  const messagesByRequestId = allMessages.reduce<Record<string, typeof allMessages>>((acc, msg) => {
    if (!acc[msg.requestId]) acc[msg.requestId] = [];
    acc[msg.requestId].push(msg);
    return acc;
  }, {});

  // Fetch or seed default tips
  let tips = await db
    .select()
    .from(specialistClassroomTips)
    .orderBy(desc(specialistClassroomTips.createdAt));

  if (tips.length === 0 && specialistUserId) {
    await db.insert(specialistClassroomTips).values([
      {
        authorSpecialistUserId: specialistUserId,
        authorName: "Dr. Amel Bouazizi (Psychologue scolaire)",
        difficultyKey: "tsa",
        situationTitle: "L'élève panique lors d'un changement imprévu d'activité",
        whatToDo: "Prévenir 5 minutes à l'avance, afficher l'emploi du temps visuel sur son bureau, prévoir un coin calme.",
        whatToAvoid: "Modifier le programme de manière abrupte ou hausser le ton devant l'angoisse.",
        isPublished: true,
      },
      {
        authorSpecialistUserId: specialistUserId,
        authorName: "Karim Mansouri (Orthophoniste Référent)",
        difficultyKey: "dys",
        situationTitle: "L'élève refuse catégoriquement d'écrire en cours",
        whatToDo: "Alléger l'écrit, autoriser la dictée vocale ou un camarade scribe, valoriser la logique et les idées.",
        whatToAvoid: "Forcer la copie au tableau sous peine de retenue ou de mauvaise note.",
        isPublished: true,
      },
    ]);

    tips = await db.select().from(specialistClassroomTips).orderBy(desc(specialistClassroomTips.createdAt));
  }

  return {
    establishments: allEstablishments,
    requests: requests.map((r) => ({
      ...r,
      messages: messagesByRequestId[r.id] || [],
    })),
    tips,
  };
}

/**
 * Public showcase getters for accessible preview routes (/espace-enseignant, /espace-etablissement, /espace-specialiste)
 */
async function getShowcaseFallbackUserId(): Promise<string> {
  const [firstUser] = await db.select({ id: user.id }).from(user).limit(1);
  return firstUser?.id || "d799d1ac-a1b3-4892-b67e-3d481c679d4d";
}

export async function getShowcaseTeacherClassroom() {
  const existing = await db.select().from(teacherClassrooms).limit(1);
  if (existing.length > 0) {
    return getOrCreateTeacherClassroom(existing[0].teacherUserId);
  }
  const fallbackId = await getShowcaseFallbackUserId();
  return getOrCreateTeacherClassroom(fallbackId);
}

export async function getShowcaseEstablishmentProfile() {
  const existing = await db.select().from(partnerEstablishments).limit(1);
  if (existing.length > 0) {
    return getOrCreatePartnerEstablishment(existing[0].managerUserId);
  }
  const fallbackId = await getShowcaseFallbackUserId();
  return getOrCreatePartnerEstablishment(fallbackId);
}

export async function getShowcaseSpecialistWorkspaceData() {
  const fallbackId = await getShowcaseFallbackUserId();
  return getSpecialistWorkspaceData(fallbackId);
}
