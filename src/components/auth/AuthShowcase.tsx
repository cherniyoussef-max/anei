import Image from "next/image";
import { AneiLogo } from "@/components/brand/AneiLogo";
import type { Locale } from "@/types";

export function AuthShowcase({
  locale,
  mode,
  stage = "welcome",
}: {
  locale: Locale;
  mode: "login" | "register" | "recovery";
  stage?: "welcome" | "verify" | "celebrate" | "reset";
}) {
  const ar = locale === "ar";
  const en = locale === "en";

  let title = "Reprenez votre apprentissage là où vous l’avez laissé";
  let description = "Accédez à vos formations, replays de webinaires, ressources et certificats validés.";
  let guideSrc = "/media/auth-guide-welcome.webp";

  if (mode === "recovery") {
    if (stage === "reset") {
      guideSrc = "/media/auth-guide-welcome.webp";

      if (ar) {
        title = "تأمين حسابك بكلمة مرور جديدة";
        description = "اختر كلمة مرور فريدة وقوية لا تقل عن 15 حرفًا لضمان حماية بياناتك وشهاداتك ومساراتك التعليمية.";
      } else if (en) {
        title = "Secure your account with a new password";
        description = "Choose a unique, robust password with at least 15 characters to safeguard your learning records.";
      } else {
        title = "Définissez un nouveau mot de passe robuste";
        description = "Choisissez un mot de passe d’au moins 15 caractères pour protéger votre espace et vos attestations.";
      }
    } else {
      guideSrc = "/media/auth-guide-verify.webp";

      if (ar) {
        title = "استرجاع حسابك بكل أمان وسهولة";
        description = "أدخل بريدك الإلكتروني المسجل لتلقي رمز أمان مؤقت والوصول إلى مساحتك التعليمية.";
      } else if (en) {
        title = "Secure and seamless account recovery";
        description = "Enter your registered email to receive a secure verification code and restore your learning access.";
      } else {
        title = "Récupérez l’accès à votre espace en toute sécurité";
        description = "Renseignez votre adresse e-mail pour recevoir un code de vérification à usage unique et rétablir votre accès.";
      }
    }
  } else if (mode === "login") {
    guideSrc = "/media/auth-guide-welcome.webp";

    if (ar) {
      title = "تابع تعلّمك ومساراتك باحترافية";
      description = "ادخل إلى دوراتك ووثائقك وندواتك وشهاداتك في بيئة تعليمية آمنة ومريحة.";
    } else if (en) {
      title = "Continue your learning journey";
      description = "Access your courses, materials, webinars and verified certificates.";
    }
  } else if (stage === "verify") {
    guideSrc = "/media/auth-guide-verify.webp";

    if (ar) {
      title = "تأكيد آمن لحسابك الشخصي";
      description = "أرسلنا رابط تأكيد إلى بريدك الإلكتروني لضمان أمان حسابك وخصوصية شهاداتك.";
    } else if (en) {
      title = "Secure Account Verification";
      description = "A verification link has been sent to your email to protect your learning credentials and privacy.";
    } else {
      title = "Vérification sécurisée de votre compte";
      description = "Un lien de confirmation a été transmis à votre adresse pour sécuriser vos accès et vos attestations.";
    }
  } else if (stage === "celebrate") {
    guideSrc = "/media/auth-guide-celebrate.webp";

    if (ar) {
      title = "مرحبًا بك في أكاديمية ANEI!";
      description = "حسابك جاهز تمامًا. يمكنك الآن استكشاف دوراتك ومواردك ومرافقة مسارك بكل سهولة.";
    } else if (en) {
      title = "Welcome to ANEI Academy!";
      description = "Your account is ready. Access your courses, practical resources and inclusive education tools.";
    } else {
      title = "Bienvenue dans l’Académie ANEI !";
      description = "Votre profil est configuré. Accédez immédiatement à vos cours, ressources pratiques et outils d'inclusion.";
    }
  } else {
    // mode === "register" default
    guideSrc = "/media/auth-guide-welcome.webp";

    if (ar) {
      title = "انضم إلى مجتمع التربية الدامجة";
      description = "6 أدوار متخصصة، مسارات تدريبية معتمدة، وأدوات وموارد عملية للميدان.";
    } else if (en) {
      title = "Join the Inclusive Education Platform";
      description = "6 tailored profiles, accredited learning tracks, and practical tools for everyday support.";
    } else {
      title = "Une plateforme unique pour vos formations & certificats";
      description = "6 profils adaptés, des parcours certifiants et des ressources concrètes pour agir sur le terrain.";
    }
  }

  return (
    <aside className="auth-simple-showcase" aria-hidden="false">
      <div className="auth-showcase-copy">
        <div className="mb-3.5">
          <AneiLogo locale={locale} variant="mark" height={32} withText priority />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {/* Clean Character Stage without Floating Badges */}
      <div className="auth-clean-avatar-stage">
        <div className="auth-clean-avatar-frame">
          <Image
            src={guideSrc}
            alt={ar ? "مرشدة أكاديمية ANEI" : "Guide de l’Académie ANEI"}
            width={800}
            height={800}
            priority
            sizes="(max-width: 768px) 140px, 220px"
            className="auth-clean-avatar-img"
          />
        </div>
      </div>
    </aside>
  );
}
