import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db, pool } from "../src/server/db";
import { avsProfiles as avsSeed, courses as courseSeed, newsItems as newsSeed, resources as resourceSeed, webinars as webinarSeed } from "../src/lib/data";
import { account, avsProfiles, certificates, courseModules, courses, enrollments, lessonProgress, lessons, newsPosts, notifications, orders, purchases, resources, user, userProfile, webinarRegistrations, webinars } from "../src/server/db/schema";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing demo seed in production. Use scripts/create-super-admin.ts for initial privileged access.");
}
if (process.env.SEED_DEMO_DATA === "false") {
  throw new Error("SEED_DEMO_DATA=false; demo data generation is disabled.");
}

const tndToMillimes=(value:number)=>Math.round(value*1000);
const durationMinutes=(value:string)=>Math.round(Number.parseFloat(value.replace(",","."))*60);
const videoUrls=["/demo/inclusion-intro.mp4","/demo/avs-practice.mp4","/demo/classroom-tools.mp4"];

async function upsertUser(input:{name:string;email:string;password:string;role:"USER"|"ADMIN"|"SUPER_ADMIN";profileType:"learner"|"teacher"|"avs"|"parent"|"specialist"|"institution"}){
  let [existing]=await db.select().from(user).where(eq(user.email,input.email)).limit(1);
  if(!existing){
    await auth.api.signUpEmail({body:{name:input.name,email:input.email,password:input.password,locale:"fr",profileType:input.profileType}});
    [existing]=await db.select().from(user).where(eq(user.email,input.email)).limit(1);
  }
  if(!existing)throw new Error(`Could not create ${input.email}`);
  const [credentialAccount] = await db.select({ id: account.id }).from(account).where(and(eq(account.userId, existing.id), eq(account.providerId, "credential"))).limit(1);
  if (credentialAccount) {
    const context = await auth.$context;
    const passwordHash = await context.password.hash(input.password);
    await context.internalAdapter.updatePassword(existing.id, passwordHash);
  }
  const [updated]=await db.update(user).set({role:input.role,emailVerified:true,profileType:input.profileType,updatedAt:new Date()}).where(eq(user.id,existing.id)).returning();
  return updated;
}

async function main(){
  console.log("Seeding ANEI...");
  const admin=await upsertUser({name:"Admin ANEI",email:"admin@anei.local",password:"DemoAdmin!!2026",role:"SUPER_ADMIN",profileType:"institution"});
  const learner=await upsertUser({name:"Amal Mansouri",email:"learner@anei.local",password:"DemoLearner!2026",role:"USER",profileType:"teacher"});
  const profileNow = new Date();
  for (const profile of [
    { userId: admin.id, firstName: "Admin", lastName: "ANEI", phoneNumber: "+21620000001", requestedPersona: "ORGANIZATION" },
    { userId: learner.id, firstName: "Amal", lastName: "Mansouri", phoneNumber: "+21620000002", requestedPersona: "STUDENT" },
  ] as const) {
    await db.insert(userProfile).values({
      ...profile,
      birthYear: 1990,
      country: "Tunisie",
      governorate: "Tunis",
      city: "Tunis",
      preferredLocale: "fr",
      educationLevel: "Formation professionnelle",
      institutionName: "ANEI",
      onboardingCompletedAt: profileNow,
      termsAcceptedAt: profileNow,
      privacyAcceptedAt: profileNow,
      updatedAt: profileNow,
    }).onConflictDoUpdate({ target: userProfile.userId, set: { onboardingCompletedAt: profileNow, updatedAt: profileNow } });
  }

  const courseRows=[];
  for(const [index,item] of courseSeed.slice(0, 2).entries()){
    const values={slug:item.slug,titleFr:item.title.fr,titleAr:item.title.ar,summaryFr:item.description.fr,summaryAr:item.description.ar,descriptionFr:`${item.description.fr} Ce parcours combine apports structurés, démonstrations vidéo, activités pratiques et ressources téléchargeables.`,descriptionAr:`${item.description.ar} يجمع هذا المسار بين محتوى منظم وفيديوهات تطبيقية وأنشطة وموارد.`,category:item.category,level:item.level,mode:item.mode,trainerName:item.trainer,durationMinutes:durationMinutes(item.duration),priceMillimes:tndToMillimes(item.price),startAt:new Date(`${item.startDate}T09:00:00+01:00`),published:true,featured:index<2,objectives:item.objectives};
    const [row]=await db.insert(courses).values(values).onConflictDoUpdate({target:courses.slug,set:{...values,updatedAt:new Date()}}).returning();courseRows.push(row);
    const moduleData=[
      {position:1,titleFr:"Fondations et observation",titleAr:"الأسس والملاحظة",descriptionFr:"Comprendre le contexte et observer avec méthode.",descriptionAr:"فهم السياق واعتماد ملاحظة منهجية."},
      {position:2,titleFr:"Pratique et coopération",titleAr:"الممارسة والتعاون",descriptionFr:"Adapter, évaluer et coordonner l’accompagnement.",descriptionAr:"تكييف الممارسة والتقييم وتنسيق المرافقة."},
    ];
    const moduleRows=[];
    for(const moduleItem of moduleData){const [moduleRow]=await db.insert(courseModules).values({courseId:row.id,...moduleItem}).onConflictDoUpdate({target:[courseModules.courseId,courseModules.position],set:moduleItem}).returning();moduleRows.push(moduleRow)}
    const lessonData=[
      {position:1,moduleId:moduleRows[0].id,titleFr:"Comprendre le cadre et les besoins",titleAr:"فهم الإطار والاحتياجات",descriptionFr:"Repères essentiels et vocabulaire partagé.",descriptionAr:"مفاهيم أساسية ولغة مشتركة.",durationSeconds:240,preview:true},
      {position:2,moduleId:moduleRows[0].id,titleFr:"Observer et décider",titleAr:"الملاحظة واتخاذ القرار",descriptionFr:"Méthodes d’observation et analyse de situations.",descriptionAr:"أساليب الملاحظة وتحليل الحالات.",durationSeconds:260,preview:false},
      {position:3,moduleId:moduleRows[1].id,titleFr:"Adapter la pratique",titleAr:"تكييف الممارسة",descriptionFr:"Outils directement réutilisables dans le contexte professionnel.",descriptionAr:"أدوات قابلة للاستخدام مباشرة في السياق المهني.",durationSeconds:300,preview:false},
      {position:4,moduleId:moduleRows[1].id,titleFr:"Évaluer et coopérer",titleAr:"التقييم والتعاون",descriptionFr:"Suivi de progression, communication et coordination.",descriptionAr:"متابعة التقدم والتواصل والتنسيق.",durationSeconds:220,preview:false},
    ];
    for(const lesson of lessonData){await db.insert(lessons).values({courseId:row.id,...lesson,videoUrl:videoUrls[(index+lesson.position-1)%videoUrls.length]}).onConflictDoUpdate({target:[lessons.courseId,lessons.position],set:{...lesson,videoUrl:videoUrls[(index+lesson.position-1)%videoUrls.length]}})}
  }

  const resourceRows=[];
  for(const [index,item] of resourceSeed.slice(0, 2).entries()){
    const slug=["guide-pratique-avs","grille-observation-classe","kit-ecole-inclusive","cooperation-famille-ecole"][index];
    const values={slug,titleFr:item.title.fr,titleAr:item.title.ar,descriptionFr:item.description.fr,descriptionAr:item.description.ar,audienceFr:item.audience.fr,audienceAr:item.audience.ar,type:item.type,priceMillimes:tndToMillimes(item.price),published:true};
    const [row]=await db.insert(resources).values(values).onConflictDoUpdate({target:resources.slug,set:values}).returning();resourceRows.push(row);
  }

  const webinarRows=[];
  for(const [index,item] of webinarSeed.entries()){
    const slug=["ecole-inclusive-action","fonctions-executives","cooperer-familles"][index];
    const values={slug,titleFr:item.title.fr,titleAr:item.title.ar,descriptionFr:item.description.fr,descriptionAr:item.description.ar,trainerName:item.trainer,startsAt:new Date(`${item.date}T${item.time}:00+01:00`),durationMinutes:75,meetingUrl:null,replayUrl:item.status==="replay"?"/demo/inclusion-intro.mp4":null,published:true};
    const [row]=await db.insert(webinars).values(values).onConflictDoUpdate({target:webinars.slug,set:values}).returning();webinarRows.push(row);
  }

  for(const item of avsSeed){const [found]=await db.select().from(avsProfiles).where(eq(avsProfiles.displayName,item.name)).limit(1);if(!found)await db.insert(avsProfiles).values({displayName:item.name,cityFr:item.city.fr,cityAr:item.city.ar,specialtyFr:item.specialty.fr,specialtyAr:item.specialty.ar,availabilityFr:item.availability.fr,availabilityAr:item.availability.ar,bioFr:"Professionnel formé aux pratiques d’accompagnement inclusif.",bioAr:"مختص مكوّن في ممارسات المرافقة الدامجة.",certified:item.certified,visible:true})}

  for(const item of newsSeed){const slug=`actualite-${item.id}`;const values={slug,tagFr:item.tag.fr,tagAr:item.tag.ar,titleFr:item.title.fr,titleAr:item.title.ar,excerptFr:item.excerpt.fr,excerptAr:item.excerpt.ar,contentFr:`${item.excerpt.fr}\n\nCette actualité de démonstration est administrable depuis le back-office ANEI. Remplacez ce contenu par le texte éditorial validé avant publication.`,contentAr:`${item.excerpt.ar}\n\nيمكن إدارة هذا الخبر التجريبي من لوحة تحكم ANEI. استبدل هذا المحتوى بالنص التحريري المعتمد قبل النشر.`,published:true,publishedAt:new Date(`${item.date}T09:00:00+01:00`)};await db.insert(newsPosts).values(values).onConflictDoUpdate({target:newsPosts.slug,set:{...values,updatedAt:new Date()}})}

  const [enrollmentA]=await db.insert(enrollments).values({userId:learner.id,courseId:courseRows[0].id,progressPercent:50,status:"active"}).onConflictDoUpdate({target:[enrollments.userId,enrollments.courseId],set:{progressPercent:50,status:"active",completedAt:null}}).returning();
  const [enrollmentB]=await db.insert(enrollments).values({userId:learner.id,courseId:courseRows[1].id,progressPercent:100,status:"completed",completedAt:new Date()}).onConflictDoUpdate({target:[enrollments.userId,enrollments.courseId],set:{progressPercent:100,status:"completed",completedAt:new Date()}}).returning();
  const completedLessons=await db.select().from(lessons).where(eq(lessons.courseId,courseRows[1].id));for(const lesson of completedLessons){await db.insert(lessonProgress).values({enrollmentId:enrollmentB.id,lessonId:lesson.id,watchedSeconds:lesson.durationSeconds,completed:true}).onConflictDoUpdate({target:[lessonProgress.enrollmentId,lessonProgress.lessonId],set:{watchedSeconds:lesson.durationSeconds,completed:true,updatedAt:new Date()}})}
  const partialLessons=await db.select().from(lessons).where(eq(lessons.courseId,courseRows[0].id)).limit(2);for(const lesson of partialLessons){await db.insert(lessonProgress).values({enrollmentId:enrollmentA.id,lessonId:lesson.id,watchedSeconds:lesson.durationSeconds,completed:true}).onConflictDoNothing({target:[lessonProgress.enrollmentId,lessonProgress.lessonId]})}

  const certCode="ANEI-DEMO-2026-001";const [cert]=await db.select().from(certificates).where(eq(certificates.code,certCode)).limit(1);if(!cert)await db.insert(certificates).values({userId:learner.id,courseId:courseRows[1].id,code:certCode});
  const idem="seed-resource-purchase";let [order]=await db.select().from(orders).where(and(eq(orders.userId,learner.id),eq(orders.idempotencyKey,idem))).limit(1);if(!order){[order]=await db.insert(orders).values({userId:learner.id,itemType:"resource",itemId:resourceRows[0].id,itemLabel:resourceRows[0].titleFr,amountMillimes:resourceRows[0].priceMillimes,status:"paid",provider:"mock",idempotencyKey:idem}).returning()}if(order){await db.insert(purchases).values({userId:learner.id,orderId:order.id,resourceId:resourceRows[0].id}).onConflictDoNothing({target:[purchases.userId,purchases.resourceId]})}
  if(webinarRows[0])await db.insert(webinarRegistrations).values({webinarId:webinarRows[0].id,userId:learner.id}).onConflictDoNothing({target:[webinarRegistrations.webinarId,webinarRegistrations.userId]});
  const [welcome]=await db.select().from(notifications).where(and(eq(notifications.userId,learner.id),eq(notifications.type,"welcome"))).limit(1);if(!welcome)await db.insert(notifications).values({userId:learner.id,type:"welcome",title:"Bienvenue sur ANEI",body:"Votre environnement de démonstration est prêt.",href:"/fr/dashboard"});
  console.log(`Seed complete. Admin: ${admin.email}; learner: ${learner.email}`);
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await pool.end()});
