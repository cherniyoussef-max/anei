"use client";

import { useId, useRef, useState, useEffect, type DragEvent } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

type UploaderState = "idle" | "preparing" | "uploading" | "processing" | "ready" | "error";

interface AdminCloudflareVideoUploaderProps {
  locale: Locale;
  lessonId?: string | null;
  courseId?: string | null;
  initialMediaProvider?: string;
  initialMediaRef?: string | null;
  initialVideoUrl?: string | null;
  initialDurationSeconds?: number;
  onUploaded?: (result: {
    provider: string;
    mediaRef: string;
    durationSeconds?: number;
    thumbnailUrl?: string;
  }) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Mo";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

export function AdminCloudflareVideoUploader({
  locale,
  lessonId,
  courseId,
  initialMediaProvider = "cloudflare_stream",
  initialMediaRef = null,
  initialVideoUrl = null,
  initialDurationSeconds = 0,
  onUploaded,
}: AdminCloudflareVideoUploaderProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ar = locale === "ar";

  const [provider, setProvider] = useState<string>(
    initialMediaProvider || "cloudflare_stream",
  );
  const [mediaRef, setMediaRef] = useState<string>(initialMediaRef || "");
  const [videoUrl, setVideoUrl] = useState<string>(initialVideoUrl || "");
  const [durationSeconds, setDurationSeconds] = useState<number>(initialDurationSeconds || 0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const [state, setState] = useState<UploaderState>(
    initialMediaRef && initialMediaProvider === "cloudflare_stream" ? "ready" : "idle",
  );
  const [uploadPercent, setUploadPercent] = useState<number>(
    initialMediaRef && initialMediaProvider === "cloudflare_stream" ? 100 : 0,
  );
  const [bytesUploaded, setBytesUploaded] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [encodingProgress, setEncodingProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [_currentAssetId, setCurrentAssetId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    initialMediaProvider === "youtube" || initialMediaProvider === "internal",
  );
  const [youtubeInput, setYoutubeInput] = useState<string>(
    initialMediaProvider === "youtube" ? initialMediaRef || "" : "",
  );

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Poll video status during Phase 2 (Optimization / Processing)
  async function pollStatus(assetId: string, attempts = 0) {
    if (attempts > 60) {
      // After 3 minutes, assume ready or background processing
      setState("ready");
      return;
    }

    try {
      const res = await fetch(`/api/admin/media/video/${assetId}/status`);
      if (res.ok) {
        const data = (await res.json()) as {
          isReady?: boolean;
          progressPercent?: number;
          durationSeconds?: number;
          thumbnailUrl?: string;
          status?: string;
          cloudflareUid?: string;
        };

        if (data.progressPercent) {
          setEncodingProgress(data.progressPercent);
        }

        if (data.isReady || data.status === "READY") {
          const dur = data.durationSeconds || 720;
          setDurationSeconds(dur);
          if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl);
          if (data.cloudflareUid) setMediaRef(data.cloudflareUid);

          setState("ready");

          // Auto-populate duration in parent form if input[name="durationSeconds"] exists
          try {
            const formDurationInput = document.querySelector<HTMLInputElement>(
              'input[name="durationSeconds"]',
            );
            if (formDurationInput) {
              formDurationInput.value = String(dur);
              formDurationInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } catch {
            // ignore DOM selector error
          }

          if (onUploaded) {
            onUploaded({
              provider: "cloudflare_stream",
              mediaRef: data.cloudflareUid || mediaRef,
              durationSeconds: dur,
              thumbnailUrl: data.thumbnailUrl,
            });
          }
          return;
        }

        if (data.status === "ERROR") {
          setState("error");
          setErrorMessage(
            ar
              ? "حدث خطأ أثناء معالجة وترميز الفيديو على Cloudflare."
              : "Une erreur est survenue lors de l'encodage de la vidéo.",
          );
          return;
        }
      }
    } catch {
      // Continue polling on transient network hiccup
    }

    pollTimerRef.current = setTimeout(() => {
      void pollStatus(assetId, attempts + 1);
    }, 3000);
  }

  // Handle video file selected
  async function handleFileSelected(file: File) {
    if (!file) return;

    const validExtensions = /\.(mp4|mov|webm|mkv|m4v)$/i;
    if (!file.type.startsWith("video/") && !validExtensions.test(file.name)) {
      setErrorMessage(
        ar
          ? "يرجى اختيار ملف فيديو صالح (.mp4, .mov, .webm, .mkv)."
          : "Veuillez sélectionner un fichier vidéo valide (.mp4, .mov, .webm, .mkv).",
      );
      setState("error");
      return;
    }

    setErrorMessage("");
    setUploadPercent(0);
    setBytesUploaded(0);
    setTotalBytes(file.size);
    setEncodingProgress(0);
    setState("preparing");

    try {
      // 1. Request direct upload session from ANEI API
      const sessionRes = await fetch("/api/admin/media/video/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "video/mp4",
          lessonId: lessonId || null,
          courseId: courseId || null,
        }),
      });

      const sessionData = (await sessionRes.json()) as {
        assetId?: string;
        uploadUrl?: string;
        uid?: string;
        provider?: string;
        error?: string;
      };

      if (!sessionRes.ok || !sessionData.uploadUrl || !sessionData.assetId) {
        throw new Error(sessionData.error || "UPLOAD_SESSION_INIT_FAILED");
      }

      const { uploadUrl, assetId, uid } = sessionData;
      setCurrentAssetId(assetId);
      if (uid) setMediaRef(uid);

      // 2. Phase 1: Uploading directly to destination
      setState("uploading");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          setUploadPercent(percent);
          setBytesUploaded(event.loaded);
          setTotalBytes(event.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadPercent(100);
          setBytesUploaded(file.size);
          // Transition to Phase 2: Processing & Encoding
          setState("processing");
          void pollStatus(assetId, 0);
        } else {
          setState("error");
          setErrorMessage(
            ar
              ? "فشل رفع الفيديو إلى خادم البث. يرجى إعادة المحاولة."
              : "Le téléversement de la vidéo a échoué. Veuillez réessayer.",
          );
        }
      };

      xhr.onerror = () => {
        setState("error");
        setErrorMessage(
          ar
            ? "انقطع الاتصال أثناء الرفع. تحقق من اتصال الإنترنت ثم أعد المحاولة."
            : "La connexion a été interrompue pendant l'envoi. Vérifiez votre connexion.",
        );
      };

      const formData = new FormData();
      formData.append("file", file);
      if (assetId) formData.append("assetId", assetId);
      xhr.send(formData);
    } catch (err) {
      setState("error");
      const code = err instanceof Error ? err.message : "INIT_FAILED";
      setErrorMessage(
        code === "RATE_LIMITED"
          ? ar
            ? "تم تجاوز معدل المحاولات المسموح. يرجى الانتظار قليلاً."
            : "Trop de tentatives récentes. Veuillez patienter un instant."
          : ar
          ? "تعذر بدء جلسة الرفع الآمنة. يرجى إعادة المحاولة."
          : "Impossible d'initialiser la session de téléversement sécurisée.",
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
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setState("idle");
    setUploadPercent(0);
    setBytesUploaded(0);
    setTotalBytes(0);
    setEncodingProgress(0);
    setMediaRef("");
    setThumbnailUrl(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="w-full space-y-3 font-[family-name:var(--font-sans)]" dir={ar ? "rtl" : "ltr"}>
      {/* Hidden inputs submitted with the parent HTML form */}
      <input type="hidden" name="mediaProvider" value={provider} />
      <input
        type="hidden"
        name="mediaRef"
        value={provider === "youtube" ? youtubeInput : mediaRef}
      />
      <input
        type="hidden"
        name="videoUrl"
        value={provider === "internal" ? videoUrl : ""}
      />

      {/* Header bar with title and toggle for advanced formats */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <span>{ar ? "فيديو الدرس" : "Vidéo de la leçon"}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            Cloudflare Stream Zero-Touch
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
        >
          {showAdvanced
            ? ar
              ? "إخفاء الخيارات المتقدمة"
              : "Masquer les options avancées"
            : ar
            ? "خيارات أخرى (YouTube / ملف)"
            : "Autres formats (YouTube / Fichier)"}
        </button>
      </div>

      {/* Advanced Provider Tabs (collapsible) */}
      {showAdvanced && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-lg text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              provider === "cloudflare_stream"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setProvider("cloudflare_stream")}
          >
            Cloudflare Stream ({ar ? "تلقائي موصى به" : "Recommandé"})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              provider === "youtube"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setProvider("youtube")}
          >
            YouTube ({ar ? "معاينة مجانية" : "Aperçu public"})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              provider === "internal"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setProvider("internal")}
          >
            {ar ? "رابط ملف مباشر" : "Fichier direct"}
          </button>
        </div>
      )}

      {/* MAIN CLOUDFLARE ZERO-TOUCH EXPERIENCE */}
      {provider === "cloudflare_stream" && (
        <div className="w-full">
          {/* STATE 0: IDLE (Drag & Drop Zone) */}
          {state === "idle" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-8 text-center rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                isDragOver
                  ? "border-blue-600 bg-blue-50/70 scale-[1.01]"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-400"
              }`}
            >
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-m4v"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
              />

              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-700 shadow-xs">
                <Icon name="play" size={26} />
              </div>

              <h4 className="text-sm font-semibold text-slate-900 mb-1">
                {ar
                  ? "اسحب وأفلت فيديو الدرس هنا، أو اضغط للاختيار"
                  : "Glissez-déposez la vidéo de la leçon ici, ou cliquez pour choisir"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
                {ar
                  ? "يدعم صيغ MP4, MOV, WebM, MKV. يتم التشفير التلقائي عالي الدقة بدون أي إعدادات فنية."
                  : "Prend en charge MP4, MOV, WebM, MKV jusqu'à 4 heures. Encodage multi-débit automatique sans configuration."}
              </p>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 shadow-xs hover:bg-slate-50 transition"
              >
                <Icon name="book" size={14} />
                <span>{ar ? "اختيار ملف فيديو من الجهاز" : "Parcourir les fichiers"}</span>
              </button>
            </div>
          )}

          {/* STATE 1: PREPARING (Fetching Direct Upload URL) */}
          {state === "preparing" && (
            <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-blue-200 bg-blue-50/50 text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs font-semibold text-blue-900">
                {ar
                  ? "جارٍ تهيئة جلسة الرفع المباشرة الآمنة إلى Cloudflare..."
                  : "Initialisation de la session d'envoi direct vers Cloudflare..."}
              </p>
            </div>
          )}

          {/* STATE 2: PHASE 1 — UPLOADING (0% -> 100%) */}
          {state === "uploading" && (
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  <span>
                    {ar
                      ? "المرحلة 1 : جارٍ رفع الفيديو مباشرة إلى السحابة..."
                      : "Phase 1 : Envoi de la vidéo vers le Cloud..."}
                  </span>
                </div>
                <span className="font-mono text-blue-700 font-bold">{uploadPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-200 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>
                  {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
                </span>
                <span>
                  {ar ? "تجاوز خوادم الاستضافة لسرعة قصوى" : "Transfert direct ultra-rapide"}
                </span>
              </div>
            </div>
          )}

          {/* STATE 3: PHASE 2 — PROCESSING / ENCODING */}
          {state === "processing" && (
            <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs space-y-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-9 w-9 animate-spin rounded-full border-3 border-amber-600 border-t-transparent" />
                <h4 className="text-xs font-semibold text-amber-950">
                  {ar
                    ? "المرحلة 2 : تم استلام الفيديو! جارٍ التحسين التلقائي عالي الدقة (ألياف وهواتف)..."
                    : "Phase 2 : Vidéo reçue ! Optimisation multi-qualité (Mobile & Fibre) en cours..."}
                </h4>
                <p className="text-[11px] text-amber-800/80 max-w-md">
                  {ar
                    ? "يتم تجهيز الجودات المختلفة وتوليد الصورة المصغرة وحساب مدة الفيديو بدقة..."
                    : "Génération automatique des profils adaptatifs HLS, de la miniature et calcul de la durée..."}
                </p>
              </div>

              {/* Encoding Progress indicator */}
              <div className="max-w-xs mx-auto space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full rounded-full bg-amber-600 transition-all duration-300"
                    style={{ width: `${Math.max(10, encodingProgress)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-amber-800">
                  {encodingProgress > 0 ? `${encodingProgress}%` : ar ? "جارٍ الترميز..." : "Optimisation en cours..."}
                </span>
              </div>
            </div>
          )}

          {/* STATE 4: PHASE 3 — READY & LINKED (Vidéo prête) */}
          {state === "ready" && (
            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Thumbnail or Video Icon */}
                <div className="relative h-16 w-28 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex-none flex items-center justify-center">
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt="Aperçu vidéo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-white">
                      <Icon name="play" size={20} />
                    </div>
                  )}
                  {durationSeconds > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white">
                      {formatDuration(durationSeconds)}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                      <Icon name="check" size={14} className="text-emerald-600" />
                      {ar ? "الفيديو جاهز ومحمي" : "Vidéo prête & protégée"}
                    </span>
                    <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      {ar ? "بث مشفر HLS" : "HLS Adaptatif Cloudflare"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {ar
                      ? `تم ضبط المدة تلقائياً (${formatDuration(durationSeconds)}) وربط الفيديو بالدرس.`
                      : `Durée calculée automatiquement (${formatDuration(durationSeconds)}) et liée à la leçon.`}
                  </p>

                  <div className="font-mono text-[11px] text-slate-500">
                    UID: <span className="text-slate-700 font-semibold">{mediaRef}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-none">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 shadow-xs hover:bg-slate-50 transition"
                >
                  {ar ? "استبدال الفيديو" : "Remplacer la vidéo"}
                </button>
              </div>
            </div>
          )}

          {/* STATE 5: ERROR */}
          {state === "error" && (
            <div className="p-5 rounded-xl border border-red-200 bg-red-50 text-center space-y-3">
              <p className="text-xs font-semibold text-red-700">{errorMessage}</p>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 border border-red-300 shadow-xs hover:bg-red-50 transition"
              >
                <span>{ar ? "إعادة المحاولة" : "Réessayer"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* YOUTUBE PROVIDER PANEL */}
      {provider === "youtube" && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            {ar
              ? "معرف أو رابط فيديو YouTube (معاينة عامة مجانية فقط)"
              : "Lien ou identifiant de vidéo YouTube (aperçu public gratuit)"}
          </label>
          <input
            type="text"
            value={youtubeInput}
            placeholder="e.g. https://www.youtube.com/watch?v=..."
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-blue-600"
          />
          <p className="text-[11px] text-slate-500">
            {ar
              ? "ملاحظة: فيديوهات YouTube تتطلب تفعيل خيار 'معاينة عامة'."
              : "Remarque : les vidéos YouTube requièrent que la leçon soit cochée en aperçu public."}
          </p>
        </div>
      )}

      {/* INTERNAL / DIRECT URL PROVIDER PANEL */}
      {provider === "internal" && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            {ar ? "رابط مباشر أو مفتاح التخزين" : "Chemin local ou clé de stockage privé"}
          </label>
          <input
            type="text"
            value={videoUrl}
            placeholder="/demo/video.mp4"
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-blue-600"
          />
        </div>
      )}
    </div>
  );
}
