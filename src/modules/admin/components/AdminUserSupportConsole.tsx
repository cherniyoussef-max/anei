"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CourseItem {
  id: string;
  title_fr: string;
  title_ar: string;
}

interface UserDetailProps {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  locale: string;
  profile_type: string;
  phone_number: string | null;
  phone_verified_at: Date | string | null;
  governorate: string | null;
  city: string | null;
  role: string;
  provider: string;
}

interface AdminUserSupportConsoleProps {
  userId: string;
  user: UserDetailProps;
  allCourses: CourseItem[];
  enrollments: Array<Record<string, unknown>>;
  certificates: Array<Record<string, unknown>>;
  locale: string;
}

export function AdminUserSupportConsole({
  userId,
  user,
  allCourses,
  enrollments,
  certificates,
  locale,
}: AdminUserSupportConsoleProps) {
  const router = useRouter();
  const ar = locale === "ar";

  // Identity state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailVerified, setEmailVerified] = useState(user.email_verified);
  const [prefLocale, setPrefLocale] = useState(user.locale || "fr");
  const [profileType, setProfileType] = useState(user.profile_type || "learner");
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number || "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user.phone_verified_at));
  const [governorate, setGovernorate] = useState(user.governorate || "");
  const [city, setCity] = useState(user.city || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // LMS Enrollment state
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [lmsMsg, setLmsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Certificate state
  const [certCourseId, setCertCourseId] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);
  const [certMsg, setCertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Security & Sessions state
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [secMsg, setSecMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active section tab
  const [activePanel, setActivePanel] = useState<"identity" | "lms" | "certs" | "security">("identity");

  // Handler: Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          emailVerified,
          locale: prefLocale,
          profileType,
          phoneNumber: phoneNumber.trim() || null,
          phoneVerified,
          governorate: governorate.trim() || null,
          city: city.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({
          type: "error",
          text:
            data.error === "EMAIL_EXISTS"
              ? ar
                ? "البريد الإلكتروني مستخدم بالفعل بحساب آخر."
                : "Cet email est déjà associé à un autre compte."
              : ar
              ? "فشل حفظ التعديلات."
              : "Échec de l'enregistrement du profil.",
        });
      } else {
        setProfileMsg({
          type: "success",
          text: ar ? "تم تحديث الملف الشخصي بنجاح." : "Profil mis à jour avec succès.",
        });
        router.refresh();
      }
    } catch {
      setProfileMsg({
        type: "error",
        text: ar ? "حدث خطأ غير متوقع." : "Une erreur imprévue est survenue.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handler: Enroll Course
  const handleEnrollCourse = async () => {
    if (!selectedCourseId) return;
    setEnrolling(true);
    setLmsMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLmsMsg({
          type: "error",
          text:
            data.error === "ALREADY_ENROLLED"
              ? ar
                ? "المستخدم مسجل بالفعل في هذه الدورة."
                : "L'utilisateur est déjà inscrit à cette formation."
              : ar
              ? "فشل تسجيل المستخدم في الدورة."
              : "Échec de l'inscription.",
        });
      } else {
        setLmsMsg({
          type: "success",
          text: ar ? "تم تسجيل المستخدم بنجاح في الدورة." : "Inscription validée avec succès.",
        });
        setSelectedCourseId("");
        router.refresh();
      }
    } catch {
      setLmsMsg({
        type: "error",
        text: ar ? "حدث خطأ أثناء التسجيل." : "Erreur lors de l'inscription.",
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Handler: Modify Enrollment (complete / reset / revoke)
  const handleEnrollmentAction = async (enrollmentId: string, action: "complete" | "reset" | "revoke") => {
    setActionInProgress(enrollmentId + action);
    setLmsMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, action }),
      });
      if (!res.ok) {
        setLmsMsg({
          type: "error",
          text: ar ? "فشل تنفيذ العملية على التسجيل." : "Action sur l'inscription impossible.",
        });
      } else {
        const actionLabel =
          action === "complete"
            ? ar
              ? "تم تمييز الدورة كمكتملة (100%)."
              : "Formation marquée terminée à 100%."
            : action === "reset"
            ? ar
              ? "تمت إعادة تعيين التقدم إلى 0%."
              : "Progression réinitialisée à 0%."
            : ar
            ? "تم سحب التسجيل وإلغاء الوصول."
            : "Inscription révoquée avec succès.";
        setLmsMsg({ type: "success", text: actionLabel });
        router.refresh();
      }
    } catch {
      setLmsMsg({
        type: "error",
        text: ar ? "خطأ غير متوقع." : "Erreur lors du traitement.",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handler: Issue Certificate
  const handleIssueCertificate = async () => {
    if (!certCourseId) return;
    setIssuingCert(true);
    setCertMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: certCourseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCertMsg({
          type: "error",
          text:
            data.error === "ALREADY_ISSUED"
              ? ar
                ? `الشهادة صادرة مسبقاً برمز: ${data.code}`
                : `Certificat déjà émis (Code : ${data.code}).`
              : ar
              ? "تعذر إصدار الشهادة."
              : "Échec de l'émission du certificat.",
        });
      } else {
        setCertMsg({
          type: "success",
          text: ar
            ? `تم إصدار الشهادة الرسمية بنجاح! الرمز: ${data.code}`
            : `Certificat officiel émis avec succès ! Code : ${data.code}`,
        });
        setCertCourseId("");
        router.refresh();
      }
    } catch {
      setCertMsg({
        type: "error",
        text: ar ? "خطأ في الاتصال بالخادم." : "Erreur de communication serveur.",
      });
    } finally {
      setIssuingCert(false);
    }
  };

  // Handler: Revoke Sessions
  const handleRevokeSessions = async () => {
    if (!confirm(ar ? "هل أنت متأكد من إنهاء كافة الجلسات النشطة؟" : "Révoquer toutes les sessions actives de cet utilisateur ?")) return;
    setRevokingSessions(true);
    setSecMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/sessions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setSecMsg({
          type: "error",
          text: ar ? "تعذر إنهاء الجلسات." : "Échec de la révocation des sessions.",
        });
      } else {
        setSecMsg({
          type: "success",
          text: ar
            ? "تم إنهاء كافة الجلسات النشطة فورا (تسجيل خروج قسري)."
            : "Toutes les sessions ont été révoquées (déconnexion forcée immédiate).",
        });
        router.refresh();
      }
    } catch {
      setSecMsg({
        type: "error",
        text: ar ? "خطأ في تنفيذ الإجراء." : "Erreur inattendue.",
      });
    } finally {
      setRevokingSessions(false);
    }
  };

  // Handler: Password Reset
  const handleResetPassword = async () => {
    setResettingPassword(true);
    setSecMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        setSecMsg({
          type: "error",
          text: ar ? "فشل إرسال رابط التعيين." : "Échec de l'envoi du lien de réinitialisation.",
        });
      } else {
        setSecMsg({
          type: "success",
          text: ar
            ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${email}.`
            : `Lien de réinitialisation transmis à ${email}.`,
        });
      }
    } catch {
      setSecMsg({
        type: "error",
        text: ar ? "حدث خطأ أثناء الإرسال." : "Erreur lors de l'envoi.",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="admin-support-console" style={{ marginTop: 24, marginBottom: 28 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          background: "linear-gradient(135deg, #0d2137 0%, #17375e 100%)",
          color: "#fff",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {ar ? "لوحة دعم وتحكم Super Admin" : "Console Support & Contrôle Opérationnel"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#cbd5e1" }}>
              {ar
                ? "تعديل بيانات المستخدم، التحكم في تسجيلات LMS، إصدار الشهادات، وإدارة الأمان."
                : "Édition du profil, gestion des accès LMS, délivrance de certificats & sécurité."}
            </p>
          </div>
        </div>

        {/* Sub-nav switcher */}
        <nav
          style={{
            display: "inline-flex",
            background: "rgba(0,0,0,0.25)",
            padding: 3,
            borderRadius: 8,
            gap: 4,
          }}
          aria-label={ar ? "أقسام الدعم" : "Sections support"}
        >
          <button
            type="button"
            onClick={() => setActivePanel("identity")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: activePanel === "identity" ? "#fff" : "transparent",
              color: activePanel === "identity" ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease",
            }}
          >
            {ar ? "الهوية والاتصال" : "Identité & Contact"}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("lms")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: activePanel === "lms" ? "#fff" : "transparent",
              color: activePanel === "lms" ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease",
            }}
          >
            {ar ? `الدورات (${enrollments.length})` : `Formations LMS (${enrollments.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("certs")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: activePanel === "certs" ? "#fff" : "transparent",
              color: activePanel === "certs" ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease",
            }}
          >
            {ar ? `الشهادات (${certificates.length})` : `Certificats (${certificates.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("security")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: activePanel === "security" ? "#fff" : "transparent",
              color: activePanel === "security" ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease",
            }}
          >
            {ar ? "الأمان والجلسات" : "Sécurité & Accès"}
          </button>
        </nav>
      </header>

      {/* Main Console Body */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: 24,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* PANEL 1: IDENTITÉ & CONTACT */}
        {activePanel === "identity" && (
          <form onSubmit={handleSaveProfile}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "الاسم الكامل" : "Nom complet"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "البريد الإلكتروني" : "Adresse email"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "رقم الهاتف" : "Numéro de téléphone"}
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+216 ..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "نوع الحساب (Profile Type)" : "Profil utilisateur"}
                </label>
                <select
                  value={profileType}
                  onChange={(e) => setProfileType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="learner">{ar ? "متعلم (Learner)" : "Apprenant"}</option>
                  <option value="teacher">{ar ? "معلم / أستاذ (Teacher)" : "Enseignant"}</option>
                  <option value="avs">{ar ? "مرافق مدرسي (AVS)" : "AVS / Accompagnant"}</option>
                  <option value="parent">{ar ? "ولي أمر (Parent)" : "Parent d'élève"}</option>
                  <option value="specialist">{ar ? "أخصائي (Specialist)" : "Spécialiste (Orthophoniste / Psychologue)"}</option>
                  <option value="institution">{ar ? "مؤسسة (Institution)" : "Établissement / École"}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "الولاية" : "Gouvernorat"}
                </label>
                <input
                  type="text"
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  placeholder="Tunis, Sousse, Sfax..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "المدينة / المعتمدية" : "Ville / Municipalité"}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  {ar ? "اللغة المفضلة" : "Langue préférée"}
                </label>
                <select
                  value={prefLocale}
                  onChange={(e) => setPrefLocale(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="fr">Français (FR)</option>
                  <option value="ar">العربية (AR)</option>
                </select>
              </div>
            </div>

            {/* Verification Toggles */}
            <div
              style={{
                marginTop: 20,
                padding: "14px 18px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={emailVerified}
                  onChange={(e) => setEmailVerified(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#0284c7" }}
                />
                <span>
                  {ar ? "البريد الإلكتروني مفعّل رسمياً (Email vérifié)" : "Email vérifié officiellement"}
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={phoneVerified}
                  onChange={(e) => setPhoneVerified(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#0284c7" }}
                />
                <span>
                  {ar ? "رقم الهاتف مفعّل وموثق (Téléphone vérifié)" : "Téléphone validé par OTP / Admin"}
                </span>
              </label>
            </div>

            {/* Actions & Alerts */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="submit"
                disabled={savingProfile}
                className="admin-primary-button"
                style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600 }}
              >
                {savingProfile
                  ? ar
                    ? "جارٍ الحفظ..."
                    : "Enregistrement..."
                  : ar
                  ? "حفظ تعديلات المستخدم"
                  : "Enregistrer les modifications"}
              </button>

              {profileMsg && (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: profileMsg.type === "success" ? "#16a34a" : "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{profileMsg.type === "success" ? "✓" : "⚠"}</span>
                  <span>{profileMsg.text}</span>
                </div>
              )}
            </div>
          </form>
        )}

        {/* PANEL 2: LMS & FORMATIONS */}
        {activePanel === "lms" && (
          <div>
            {/* Manual Enrollment Row */}
            <div
              style={{
                padding: "16px 20px",
                background: "#f1f5f9",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                marginBottom: 20,
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {ar ? "إضافة تسجيل يدوي لدورة جديدة (Inscription manuelle)" : "Accorder l'accès à une nouvelle formation"}
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
                {ar
                  ? "يتيح للمسؤول منح صلاحية الوصول المباشر لأي دورة للمستخدم دون الحاجة للدفع."
                  : "Attribue immédiatement les droits d'accès complets avec la source 'ADMIN'."}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{
                    flex: "1 1 300px",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="">{ar ? "-- اختر الدورة التدريبية --" : "-- Choisir une formation --"}</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {ar ? c.title_ar : c.title_fr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleEnrollCourse}
                  disabled={!selectedCourseId || enrolling}
                  className="admin-primary-button"
                  style={{ padding: "9px 20px", fontSize: 13 }}
                >
                  {enrolling
                    ? ar
                      ? "جارٍ التسجيل..."
                      : "Attribution en cours..."
                    : ar
                    ? "منح الوصول للدورة"
                    : "Inscrire l'utilisateur"}
                </button>
              </div>

              {lmsMsg && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: lmsMsg.type === "success" ? "#16a34a" : "#dc2626",
                  }}
                >
                  {lmsMsg.text}
                </div>
              )}
            </div>

            {/* List of user enrollments with 1-click manipulations */}
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 12 }}>
              {ar ? "الدورات المسجلة حالياً وإدارتها" : "Formations inscrites et actions d'avancement"}
            </h4>

            {enrollments.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 8 }}>
                {ar ? "المستخدم غير مسجل في أي دورة بعد." : "Aucune inscription active pour cet utilisateur."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {enrollments.map((row) => {
                  const item = row as Record<string, unknown>;
                  const enrollmentId = String(item.id);
                  const progress = Number(item.progress_percent) || 0;
                  const status = String(item.status);
                  const courseTitle = String(ar ? item.title_ar : item.title_fr);

                  return (
                    <div
                      key={enrollmentId}
                      style={{
                        padding: "14px 18px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 14,
                      }}
                    >
                      <div style={{ flex: "1 1 260px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: 14, color: "#0f172a" }}>{courseTitle}</strong>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontWeight: 600,
                              background: status === "completed" ? "#dcfce7" : "#e0f2fe",
                              color: status === "completed" ? "#15803d" : "#0369a1",
                            }}
                          >
                            {status === "completed" ? (ar ? "مكتملة" : "Terminée") : ar ? "نشطة" : "En cours"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                          <div style={{ flex: "1 1 140px", maxWidth: 200, background: "#f1f5f9", height: 8, borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: progress === 100 ? "#16a34a" : "#0284c7",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{progress}%</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleEnrollmentAction(enrollmentId, "complete")}
                          disabled={actionInProgress !== null}
                          title={ar ? "تمييز كمكتمل 100%" : "Valider 100% terminé"}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                            cursor: "pointer",
                          }}
                        >
                          {actionInProgress === enrollmentId + "complete"
                            ? "..."
                            : ar
                            ? "✓ تمييز 100% مكتمل"
                            : "✓ Marquer 100% (Terminé)"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEnrollmentAction(enrollmentId, "reset")}
                          disabled={actionInProgress !== null}
                          title={ar ? "إعادة تعيين التقدم إلى 0%" : "Réinitialiser la progression à 0%"}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#f8fafc",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            cursor: "pointer",
                          }}
                        >
                          {actionInProgress === enrollmentId + "reset"
                            ? "..."
                            : ar
                            ? "↺ إعادة تعيين (0%)"
                            : "↺ Réinitialiser (0%)"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(ar ? "هل أنت متأكد من سحب هذا التسجيل وإلغاء الوصول؟" : "Révoquer définitivement l'accès à ce cours ?")) {
                              handleEnrollmentAction(enrollmentId, "revoke");
                            }
                          }}
                          disabled={actionInProgress !== null}
                          title={ar ? "سحب التسجيل" : "Révoquer l'accès"}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#fef2f2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            cursor: "pointer",
                          }}
                        >
                          {actionInProgress === enrollmentId + "revoke"
                            ? "..."
                            : ar
                            ? "✕ سحب الوصول"
                            : "✕ Révoquer l'accès"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PANEL 3: CERTIFICATS */}
        {activePanel === "certs" && (
          <div>
            {/* Manual Cert Issuer */}
            <div
              style={{
                padding: "16px 20px",
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                marginBottom: 20,
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {ar ? "إصدار شهادة رسمية فورية (Émission administrative)" : "Délivrer manuellement un certificat officiel"}
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
                {ar
                  ? "يولد رمز تحقق فريد ANEI معتمد ويسجل الإكمال في قاعدة البيانات بشكل قانوني."
                  : "Génère un code vérifiable unique et valide l'achèvement complet de la formation."}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={certCourseId}
                  onChange={(e) => setCertCourseId(e.target.value)}
                  style={{
                    flex: "1 1 300px",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="">{ar ? "-- اختر الدورة لإصدار الشهادة --" : "-- Choisir une formation --"}</option>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {ar ? c.title_ar : c.title_fr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleIssueCertificate}
                  disabled={!certCourseId || issuingCert}
                  className="admin-primary-button"
                  style={{ padding: "9px 20px", fontSize: 13, background: "#059669" }}
                >
                  {issuingCert
                    ? ar
                      ? "جارٍ الإصدار..."
                      : "Génération en cours..."
                    : ar
                    ? "إصدار الشهادة الآن"
                    : "Délivrer le certificat"}
                </button>
              </div>

              {certMsg && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: certMsg.type === "success" ? "#16a34a" : "#dc2626",
                  }}
                >
                  {certMsg.text}
                </div>
              )}
            </div>

            {/* List of Issued Certificates */}
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 12 }}>
              {ar ? "الشهادات الصادرة لهذا المستخدم" : "Certificats officiels déjà délivrés"}
            </h4>

            {certificates.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 8 }}>
                {ar ? "لم تصدر أي شهادة بعد لهذا المستخدم." : "Aucun certificat délivré à ce jour."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {certificates.map((row) => {
                  const item = row as Record<string, unknown>;
                  const certId = String(item.id);
                  const code = String(item.code);
                  const courseTitle = String(ar ? item.title_ar : item.title_fr);
                  const issuedDate = item.issued_at ? new Date(String(item.issued_at)).toLocaleDateString(locale) : "";

                  return (
                    <div
                      key={certId}
                      style={{
                        padding: "12px 18px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14, color: "#0f172a" }}>{courseTitle}</strong>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {ar ? "تاريخ الإصدار:" : "Délivré le :"} {issuedDate}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <code
                          style={{
                            padding: "4px 8px",
                            background: "#f1f5f9",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0369a1",
                          }}
                        >
                          {code}
                        </code>
                        <a
                          href={`/${locale}/verify/${code}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#0284c7",
                            textDecoration: "underline",
                          }}
                        >
                          {ar ? "تحقق" : "Vérifier"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PANEL 4: SÉCURITÉ & ACCÈS */}
        {activePanel === "security" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Reset Password Card */}
              <div
                style={{
                  padding: "18px 20px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                  {ar ? "إعادة تعيين كلمة المرور" : "Réinitialisation de mot de passe"}
                </h4>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>
                  {ar
                    ? `إرسال رابط آمن ومباشر لإعادة التعيين إلى ${email}.`
                    : `Transmet un email avec un lien d'accès sécurisé à ${email}.`}
                </p>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#fff",
                    color: "#1e293b",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  {resettingPassword
                    ? ar
                      ? "جارٍ الإرسال..."
                      : "Envoi..."
                    : ar
                    ? "إرسال رابط التعيين"
                    : "Envoyer le lien de réinitialisation"}
                </button>
              </div>

              {/* Force Session Revocation */}
              <div
                style={{
                  padding: "18px 20px",
                  background: "#fff1f2",
                  borderRadius: 10,
                  border: "1px solid #fecdd3",
                }}
              >
                <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#9f1239" }}>
                  {ar ? "إنهاء الجلسات النشطة (تسجيل خروج إجباري)" : "Révocation de toutes les sessions"}
                </h4>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#881337" }}>
                  {ar
                    ? "يطرد المستخدم فوراً من كافة الأجهزة والهواتف المفتوحة، مما يلزمه بإعادة تسجيل الدخول."
                    : "Déconnecte immédiatement l'utilisateur de tous ses appareils et navigateurs connectés."}
                </p>
                <button
                  type="button"
                  onClick={handleRevokeSessions}
                  disabled={revokingSessions}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#e11d48",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {revokingSessions
                    ? ar
                      ? "جارٍ الإنهاء..."
                      : "Révocation..."
                    : ar
                    ? "إبطال كافة الجلسات الآن"
                    : "Révoquer toutes les sessions"}
                </button>
              </div>
            </div>

            {secMsg && (
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: secMsg.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: secMsg.type === "success" ? "#15803d" : "#991b1b",
                }}
              >
                {secMsg.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
