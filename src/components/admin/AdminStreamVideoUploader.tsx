"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

type ProviderMode = "cloudflare_stream" | "youtube" | "internal";
type UploadState = "idle" | "requesting_url" | "uploading" | "completed" | "error";

interface AdminStreamVideoUploaderProps {
  locale: Locale;
  initialMediaProvider?: string;
  initialMediaRef?: string | null;
  initialVideoUrl?: string | null;
  onUploaded?: (result: { provider: string; mediaRef: string }) => void;
}

export function AdminStreamVideoUploader({
  locale,
  initialMediaProvider = "cloudflare_stream",
  initialMediaRef = null,
  initialVideoUrl = null,
  onUploaded,
}: AdminStreamVideoUploaderProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [provider, setProvider] = useState<ProviderMode>(
    (initialMediaProvider as ProviderMode) || "cloudflare_stream",
  );
  const [mediaRef, setMediaRef] = useState<string>(initialMediaRef || "");
  const [internalUrl, setInternalUrl] = useState<string>(initialVideoUrl || "");
  const [youtubeInput, setYoutubeInput] = useState<string>(
    initialMediaProvider === "youtube" ? initialMediaRef || "" : "",
  );

  const [uploadState, setUploadState] = useState<UploadState>(
    initialMediaRef && initialMediaProvider === "cloudflare_stream" ? "completed" : "idle",
  );
  const [uploadProgress, setUploadProgress] = useState<number>(
    initialMediaRef && initialMediaProvider === "cloudflare_stream" ? 100 : 0,
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    initialMediaProvider === "youtube" || initialMediaProvider === "internal",
  );

  const ar = locale === "ar";

  async function handleFileSelected(file: File) {
    if (!file) return;

    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
      setErrorMessage(
        ar
          ? "يرجى اختيار ملف فيديو صالح (MP4, MOV, WebM)."
          : "Veuillez sélectionner un fichier vidéo valide (MP4, MOV, WebM).",
      );
      setUploadState("error");
      return;
    }

    setErrorMessage("");
    setUploadProgress(0);
    setUploadState("requesting_url");

    try {
      // 1. Request direct upload URL from backend
      const presignRes = await fetch("/api/admin/media/stream-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const presignData = (await presignRes.json()) as {
        uploadUrl?: string;
        uid?: string;
        error?: string;
      };

      if (!presignRes.ok || !presignData.uploadUrl || !presignData.uid) {
        throw new Error(presignData.error || "STREAM_UPLOAD_URL_FAILED");
      }

      const { uploadUrl, uid } = presignData;

      // 2. Upload file directly to Cloudflare Stream via XHR to report real-time progress
      setUploadState("uploading");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          setUploadState("completed");
          setProvider("cloudflare_stream");
          setMediaRef(uid);
          if (onUploaded) {
            onUploaded({ provider: "cloudflare_stream", mediaRef: uid });
          }
        } else {
          setUploadState("error");
          setErrorMessage(
            ar
              ? "فشل في رفع الفيديو إلى Cloudflare Stream."
              : "Le téléversement vers Cloudflare Stream a échoué.",
          );
        }
      };

      xhr.onerror = () => {
        setUploadState("error");
        setErrorMessage(
          ar
            ? "خطأ في الاتصال أثناء رفع الفيديو. تحقق من اتصالك بالإنترنت."
            : "Erreur de connexion pendant le téléversement de la vidéo.",
        );
      };

      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);
    } catch (err) {
      setUploadState("error");
      const code = err instanceof Error ? err.message : "UPLOAD_FAILED";
      setErrorMessage(
        code === "CLOUDFLARE_STREAM_NOT_CONFIGURED"
          ? ar
            ? "خدمة Cloudflare Stream غير مهيأة بعد. يرجى تهيئة المتغيرات في البيئة."
            : "Cloudflare Stream n'est pas encore configuré dans l'environnement."
          : ar
            ? "تعذر بدء رفع الفيديو."
            : "Impossible d'initialiser le téléversement de la vidéo.",
      );
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileSelected(file);
  }

  function handleReset() {
    setUploadState("idle");
    setUploadProgress(0);
    setMediaRef("");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="admin-stream-video-uploader" style={{ display: "grid", gap: "10px", width: "100%" }}>
      {/* Hidden inputs submitted with the parent form */}
      <input type="hidden" name="mediaProvider" value={provider} />
      <input type="hidden" name="mediaRef" value={provider === "youtube" ? youtubeInput : mediaRef} />
      <input type="hidden" name="videoUrl" value={provider === "internal" ? internalUrl : ""} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ fontWeight: 650, fontSize: "0.92rem", color: "#0f172a" }}>
          {ar ? "فيديو الدرس (Cloudflare Stream)" : "Vidéo de la leçon (Cloudflare Stream)"}
        </span>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: "0.78rem",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          {showAdvanced
            ? ar ? "إخفاء الخيارات المتقدمة" : "Masquer les options avancées"
            : ar ? "خيارات التنسيق الأخرى (YouTube / ملف)" : "Autres formats (YouTube / Fichier)"}
        </button>
      </div>

      {showAdvanced && (
        <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "8px" }}>
          <button
            type="button"
            className={`btn btn-sm ${provider === "cloudflare_stream" ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            onClick={() => setProvider("cloudflare_stream")}
          >
            Cloudflare Stream ({ar ? "الموصى به" : "Recommandé"})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "youtube" ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            onClick={() => setProvider("youtube")}
          >
            YouTube ({ar ? "معاينة مجانية" : "Aperçu"})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "internal" ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            onClick={() => setProvider("internal")}
          >
            {ar ? "ملف MP4 داخلي" : "Fichier MP4 interne"}
          </button>
        </div>
      )}

      {/* CLOUDFLARE STREAM DIRECT UPLOAD PANEL */}
      {provider === "cloudflare_stream" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: isDragOver ? "2px dashed #2563eb" : "1px dashed #cbd5e1",
            borderRadius: "10px",
            background: isDragOver ? "#eff6ff" : "#f8fafc",
            padding: "18px",
            textAlign: "center",
            display: "grid",
            gap: "10px",
            placeItems: "center",
            transition: "all 0.2s ease",
          }}
        >
          {uploadState === "idle" && (
            <>
              <div style={{ color: "#2563eb", background: "#dbeafe", padding: "10px", borderRadius: "999px", display: "inline-flex" }}>
                <Icon name="play" size={24} />
              </div>
              <div style={{ display: "grid", gap: "4px" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
                  {ar ? "اختر ملف الفيديو أو اسحبه هنا" : "Choisissez un fichier vidéo ou glissez-déposez-le ici"}
                </p>
                <small style={{ color: "#64748b" }}>
                  {ar
                    ? "يتم رفع الفيديو مباشرة ومشفر إلى شبكة Cloudflare العالمية (MP4, MOV, WebM حتى 4 ساعات)"
                    : "Téléversement direct et sécurisé vers le réseau mondial Cloudflare (MP4, MOV, WebM jusqu'à 4 heures)"}
                </small>
              </div>

              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: "pointer", fontWeight: 600 }}
              >
                {ar ? "تحديد ملف الفيديو" : "Sélectionner la vidéo"}
              </button>
            </>
          )}

          {uploadState === "requesting_url" && (
            <div style={{ padding: "16px", display: "grid", gap: "8px", placeItems: "center" }}>
              <small style={{ color: "#2563eb", fontWeight: 600 }}>
                {ar ? "جارٍ إعداد نقطة الرفع المباشرة الآمنة..." : "Préparation du lien sécurisé vers Cloudflare Stream..."}
              </small>
            </div>
          )}

          {uploadState === "uploading" && (
            <div style={{ width: "100%", maxWidth: "420px", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>
                <span>{ar ? "جارٍ رفع الفيديو مباشرة إلى Cloudflare..." : "Téléversement direct vers Cloudflare..."}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${uploadProgress}%`,
                    background: "#2563eb",
                    borderRadius: "999px",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                {ar
                  ? "يتم البث والتشفير تلقائياً دون استهلاك سعة خادم الاستضافة."
                  : "Le fichier contourne les limites du serveur pour garantir une vitesse maximale."}
              </small>
            </div>
          )}

          {uploadState === "completed" && (
            <div style={{ display: "grid", gap: "8px", placeItems: "center", width: "100%" }}>
              <div style={{ color: "#16a34a", background: "#dcfce7", padding: "8px", borderRadius: "999px", display: "inline-flex" }}>
                <Icon name="check" size={20} />
              </div>
              <div style={{ display: "grid", gap: "2px" }}>
                <strong style={{ color: "#15803d", fontSize: "0.92rem" }}>
                  {ar ? "تم رفع الفيديو بنجاح وجاهز للبث السريع" : "Vidéo téléversée et prête pour la diffusion"}
                </strong>
                <code style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px", color: "#334155" }}>
                  Cloudflare Stream UID: {mediaRef}
                </code>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                  style={{ fontSize: "0.78rem" }}
                >
                  {ar ? "تغيير الفيديو" : "Remplacer la vidéo"}
                </button>
              </div>
            </div>
          )}

          {uploadState === "error" && (
            <div style={{ display: "grid", gap: "8px", placeItems: "center" }}>
              <small style={{ color: "#dc2626", fontWeight: 600 }}>{errorMessage}</small>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={handleReset}
                style={{ fontSize: "0.8rem" }}
              >
                {ar ? "إعادة المحاولة" : "Réessayer"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* YOUTUBE PROVIDER PANEL */}
      {provider === "youtube" && (
        <div style={{ display: "grid", gap: "6px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600, color: "#334155" }}>
              {ar ? "معرف أو رابط فيديو YouTube (للمعاينة العامة المجانية فقط)" : "Lien ou identifiant vidéo YouTube (aperçu public gratuit)"}
            </span>
            <input
              type="text"
              value={youtubeInput}
              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              onChange={(e) => setYoutubeInput(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </label>
          <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
            {ar
              ? "ملاحظة: فيديوهات YouTube تتطلب تفعيل 'معاينة عامة'."
              : "Remarque : les vidéos YouTube requièrent que la leçon soit cochée en aperçu public."}
          </small>
        </div>
      )}

      {/* INTERNAL PROVIDER PANEL */}
      {provider === "internal" && (
        <div style={{ display: "grid", gap: "6px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600, color: "#334155" }}>
              {ar ? "مفتاح الكائن أو المسار المحلي" : "Chemin local ou clé de stockage privé"}
            </span>
            <input
              type="text"
              value={internalUrl}
              placeholder="/demo/inclusion-intro.mp4"
              onChange={(e) => setInternalUrl(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
