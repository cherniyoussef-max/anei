import { notFound } from "next/navigation"; import { sql } from "drizzle-orm"; import { isLocale } from "@/lib/i18n"; import { requireAdminPermission } from "@/server/auth/session"; import { db } from "@/server/db"; import { checkRedis } from "@/server/cache/redis"; import { env,googleAuthConfigured } from "@/server/env"; import { whatsappConfigured } from "@/server/whatsapp/config"; import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
export default async function Page({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();await requireAdminPermission(locale,"system.read");let database=false;try{await db.execute(sql`select 1`);database=true}catch{}const redis=await checkRedis(),a=locale==="ar";const rows=[[a?"قاعدة البيانات":"Base de données",database],[a?"Redis":"Redis",redis.configured?redis.available:null],[a?"البريد":"E-mail",env.SMTP_HOST!=="localhost"],[a?"تسجيل Google":"Google OAuth",googleAuthConfigured],[a?"التخزين":"Stockage",env.STORAGE_PROVIDER==="s3-compatible"],[a?"واتساب":"WhatsApp",env.ENABLE_WHATSAPP?whatsappConfigured:null]];
  const whatsappFields: [string, boolean][] = [
    [a ? "الرمز المميز للوصول (Access Token)" : "Jeton d'accès (Access Token)", Boolean(env.WHATSAPP_ACCESS_TOKEN)],
    [a ? "سر التطبيق (App Secret)" : "Secret d'application (App Secret)", Boolean(env.WHATSAPP_APP_SECRET)],
    [a ? "رمز التحقق (Verify Token)" : "Jeton de vérification (Verify Token)", Boolean(env.WHATSAPP_VERIFY_TOKEN)],
    [a ? "تفعيل الميزة (ENABLE_WHATSAPP)" : "Fonctionnalité activée (ENABLE_WHATSAPP)", env.ENABLE_WHATSAPP],
  ];
  const envTemplate = "ENABLE_WHATSAPP=true\nWHATSAPP_ACCESS_TOKEN=collez_votre_jeton_ici\nWHATSAPP_APP_SECRET=collez_votre_secret_ici\nWHATSAPP_VERIFY_TOKEN=choisissez_une_valeur_secrete\nWHATSAPP_API_VERSION=v22.0\nWHATSAPP_API_BASE_URL=https://graph.facebook.com";
  return <><AdminPageHeader locale={locale} eyebrow={a?"تشغيل آمن":"Exploitation sûre"} title={a?"حالة النظام":"État du système"} description={a?"حالة التكوين والاتصال بدون عرض أي أسرار.":"Configuration et connectivité sans exposition de secrets."}/><section className="admin-system-grid">{rows.map(([label,state])=><article key={String(label)}><div><strong>{String(label)}</strong><small>{state===null?(a?"غير مهيأ":"Non configuré"):state?(a?"متاح":"Disponible"):(a?"غير متاح":"Indisponible")}</small></div><span className={state===true?"ok":state===null?"neutral":"error"}>{state===true?"✓":state===null?"—":"!"}</span></article>)}</section>

  <section className="admin-surface admin-system-meta">
    <h2>{a ? "إعداد واتساب (Meta Cloud API)" : "Configuration WhatsApp (Meta Cloud API)"}</h2>
    <p className="small-muted">
      {a
        ? "لأسباب أمنية، لا يتم تخزين هذه الأسرار في قاعدة البيانات — يتم ضبطها فقط في متغيرات البيئة (.env) على الخادم. الحالة أدناه لا تعرض أي قيمة سرية."
        : "Pour des raisons de sécurité, ces secrets ne sont jamais stockés en base de données — ils sont configurés uniquement via les variables d'environnement (.env) du serveur. L'état ci-dessous n'affiche aucune valeur secrète."}
    </p>
    <dl>
      {whatsappFields.map(([label, present]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span className={present ? "ok" : "neutral"}>{present ? "✓" : "—"}</span>{" "}
            {present ? (a ? "مضبوط" : "défini") : (a ? "غير مضبوط بعد" : "pas encore défini")}
          </dd>
        </div>
      ))}
    </dl>
    {!whatsappConfigured ? (
      <>
        <p>
          {a
            ? "انسخ هذا النموذج، واملأ القيم الحقيقية من لوحة Meta for Developers، وأرسله لي لإضافته إلى الخادم — أو أضفه بنفسك إلى ملف .env ثم أعد تشغيل الخادم."
            : "Copiez ce modèle, remplissez les vraies valeurs depuis le tableau de bord Meta for Developers, puis envoyez-le-moi pour que je l'ajoute au serveur — ou ajoutez-le vous-même dans le fichier .env et redémarrez le serveur."}
        </p>
        <pre className="admin-code-block"><code>{envTemplate}</code></pre>
      </>
    ) : (
      <p className="small-muted">{a ? "واتساب مفعّل ويعمل." : "WhatsApp est activé et opérationnel."}</p>
    )}
  </section>

  <section className="admin-surface admin-system-meta"><h2>{a?"معلومات التطبيق":"Informations applicatives"}</h2><dl><div><dt>{a?"الإصدار":"Version"}</dt><dd>{process.env.npm_package_version??"3.4.0"}</dd></div><div><dt>{a?"البيئة":"Environnement"}</dt><dd>{env.NODE_ENV}</dd></div><div><dt>{a?"مزود التخزين":"Fournisseur de stockage"}</dt><dd>{env.STORAGE_PROVIDER}</dd></div></dl></section></>;}
