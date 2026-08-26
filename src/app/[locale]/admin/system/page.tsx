import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { checkRedis } from "@/server/cache/redis";
import {
  cloudflareStreamConfigured, env, flouciConfigured, googleAuthConfigured, whatsappConfigured,
} from "@/server/env";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

type SystemState = "ok" | "warn" | "error" | "disabled" | "unconfigured" | "mock" | "unverified" | "active";

const STATE_META: Record<SystemState, { fr: string; ar: string; icon: string; className: string }> = {
  ok: { fr: "Disponible", ar: "متاح", icon: "✓", className: "ok" },
  warn: { fr: "Dégradé", ar: "متدهور", icon: "!", className: "warn" },
  error: { fr: "Indisponible", ar: "غير متاح", icon: "✗", className: "error" },
  disabled: { fr: "Désactivé", ar: "معطّل", icon: "○", className: "neutral" },
  unconfigured: { fr: "Non configuré", ar: "غير مهيأ", icon: "—", className: "neutral" },
  mock: { fr: "Mode simulation", ar: "وضع المحاكاة", icon: "!", className: "warn" },
  unverified: { fr: "État non vérifiable", ar: "غير قابل للتحقق", icon: "?", className: "neutral" },
  // Recent SUCCEEDED/FAILED outbox activity only proves the worker process ran
  // recently — there is no heartbeat, so this must not read as "available".
  active: { fr: "Actif récemment", ar: "نشاط حديث مكتشف", icon: "✓", className: "ok" },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "system.read");
  const a = locale === "ar";

  let database: SystemState = "error";
  try {
    await db.execute(sql`select 1`);
    database = "ok";
  } catch {
    database = "error";
  }

  const redis = await checkRedis();
  const redisState: SystemState = !redis.configured ? "unconfigured" : redis.available ? "ok" : "error";

  const emailState: SystemState = env.SMTP_HOST !== "localhost" ? "ok" : "unconfigured";
  const googleState: SystemState = googleAuthConfigured ? "ok" : env.ENABLE_GOOGLE_AUTH ? "unconfigured" : "disabled";
  // Local disk storage is an active provider, not a disabled feature — only
  // the private S3-compatible backend is optional/off by default.
  const storageState: SystemState = env.STORAGE_PROVIDER === "local"
    ? "ok"
    : env.STORAGE_BUCKET && env.STORAGE_REGION && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY
      ? "ok"
      : "unconfigured";
  const storageNote = env.STORAGE_PROVIDER === "local"
    ? { fr: "disque local", ar: "قرص محلي" }
    : storageState === "ok"
      ? { fr: "S3 compatible", ar: "متوافق S3" }
      : undefined;
  const streamState: SystemState = cloudflareStreamConfigured
    ? "ok"
    : env.ENABLE_CLOUDFLARE_STREAM ? "unconfigured" : "disabled";
  // A real provider (Flouci) takes priority; otherwise the mock/dev payment
  // path can itself be active even though no real provider is configured —
  // that must not be reported as "disabled".
  const paymentsState: SystemState = flouciConfigured
    ? "ok"
    : env.ENABLE_FLOUCI
      ? "unconfigured"
      : (env.PAYMENT_ALLOW_MOCK || env.PAYMENT_DEFAULT_PROVIDER === "mock")
        ? "mock"
        : "disabled";
  const paymentsNote = paymentsState === "mock" ? { fr: "aucun fournisseur réel", ar: "لا يوجد مزود حقيقي" } : undefined;
  const whatsappState: SystemState = whatsappConfigured
    ? "ok"
    : env.ENABLE_WHATSAPP ? "unconfigured" : "disabled";
  const aiState: SystemState = !env.ENABLE_AI ? "disabled" : env.OPENAI_API_KEY ? "ok" : "unconfigured";
  const mcpState: SystemState = !env.ENABLE_MCP ? "disabled" : !env.ENABLE_AI ? "unconfigured" : "ok";
  const n8nState: SystemState = !env.N8N_WEBHOOK_BASE_URL
    ? "disabled"
    : (env.ANEI_N8N_DISPATCH_TOKEN || env.N8N_ANEI_SERVICE_TOKEN) ? "ok" : "unconfigured";

  // An empty/idle outbox proves nothing about the separate `scripts/worker.ts`
  // process — there is no heartbeat table, so "Operational" is only reported
  // when there is positive evidence (a recently processed event). A stuck
  // PROCESSING lease or an old PENDING backlog is reported as degraded; the
  // absence of any such evidence is reported as neutral/unverified, never ok.
  let workerState: SystemState = "unverified";
  let workerNote: { fr: string; ar: string } | undefined;
  if (database === "ok") {
    const backlog = await db.execute<{
      stuck: number;
      oldest_pending_seconds: number | null;
      recent_processed: number;
    }>(sql`select
      count(*) filter (where status = 'PROCESSING' and locked_at < now() - interval '10 minutes')::int stuck,
      extract(epoch from (now() - min(available_at) filter (where status = 'PENDING')))::int oldest_pending_seconds,
      count(*) filter (where status in ('SUCCEEDED', 'FAILED') and processed_at > now() - interval '15 minutes')::int recent_processed
      from outbox_event`);
    const row = backlog.rows[0];
    if (row && row.stuck > 0) {
      workerState = "warn";
      workerNote = { fr: "verrou de traitement bloqué", ar: "قفل معالجة عالق" };
    } else if (row && (row.oldest_pending_seconds ?? 0) > 3600) {
      workerState = "warn";
      workerNote = { fr: "file d'attente en retard", ar: "قائمة الانتظار متأخرة" };
    } else if (row && row.recent_processed > 0) {
      workerState = "active";
    } else {
      workerState = "unverified";
      workerNote = { fr: "aucune activité récente", ar: "لا يوجد نشاط حديث" };
    }
  } else {
    workerState = "error";
  }

  const rows: [string, SystemState, { fr: string; ar: string } | undefined][] = [
    [a ? "قاعدة البيانات" : "Base de données", database, undefined],
    ["Redis", redisState, undefined],
    [a ? "البريد" : "E-mail", emailState, undefined],
    [a ? "تسجيل Google" : "Google OAuth", googleState, undefined],
    [a ? "التخزين" : "Stockage", storageState, storageNote],
    ["Cloudflare Stream", streamState, undefined],
    [a ? "المدفوعات" : "Paiements", paymentsState, paymentsNote],
    [a ? "واتساب" : "WhatsApp", whatsappState, undefined],
    [a ? "العامل (المهام الخلفية)" : "Worker (tâches asynchrones)", workerState, workerNote],
    [a ? "الذكاء الاصطناعي" : "IA", aiState, undefined],
    ["MCP", mcpState, undefined],
    ["n8n", n8nState, undefined],
  ];

  const whatsappFields: [string, boolean][] = [
    [a ? "الرمز المميز للوصول (Access Token)" : "Jeton d'accès (Access Token)", Boolean(env.WHATSAPP_ACCESS_TOKEN)],
    [a ? "سر التطبيق (App Secret)" : "Secret d'application (App Secret)", Boolean(env.WHATSAPP_APP_SECRET)],
    [a ? "رمز التحقق (Verify Token)" : "Jeton de vérification (Verify Token)", Boolean(env.WHATSAPP_VERIFY_TOKEN)],
    [a ? "تفعيل الميزة (ENABLE_WHATSAPP)" : "Fonctionnalité activée (ENABLE_WHATSAPP)", env.ENABLE_WHATSAPP],
  ];
  const envTemplate = "ENABLE_WHATSAPP=true\nWHATSAPP_ACCESS_TOKEN=collez_votre_jeton_ici\nWHATSAPP_APP_SECRET=collez_votre_secret_ici\nWHATSAPP_VERIFY_TOKEN=choisissez_une_valeur_secrete\nWHATSAPP_API_VERSION=v22.0\nWHATSAPP_API_BASE_URL=https://graph.facebook.com";

  return <>
    <AdminPageHeader locale={locale} eyebrow={a ? "تشغيل آمن" : "Exploitation sûre"} title={a ? "حالة النظام" : "État du système"}
      description={a ? "حالة التكوين والاتصال بدون عرض أي أسرار." : "Configuration et connectivité sans exposition de secrets."}/>
    <section className="admin-system-grid" aria-label={a ? "حالة الخدمات" : "État des services"}>
      {rows.map(([label, state, note]) => {
        const meta = STATE_META[state];
        const detail = a ? meta.ar : meta.fr;
        return <article key={label}>
          <div><strong>{label}</strong><small>{note ? `${detail} — ${a ? note.ar : note.fr}` : detail}</small></div>
          <span className={meta.className} aria-hidden="true">{meta.icon}</span>
        </article>;
      })}
    </section>

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

    <section className="admin-surface admin-system-meta">
      <h2>{a ? "معلومات التطبيق" : "Informations applicatives"}</h2>
      <dl>
        <div><dt>{a ? "الإصدار" : "Version"}</dt><dd>{process.env.npm_package_version ?? "3.4.0"}</dd></div>
        <div><dt>{a ? "البيئة" : "Environnement"}</dt><dd>{env.NODE_ENV}</dd></div>
        <div><dt>{a ? "مزود التخزين" : "Fournisseur de stockage"}</dt><dd>{env.STORAGE_PROVIDER}</dd></div>
      </dl>
    </section>
  </>;
}
