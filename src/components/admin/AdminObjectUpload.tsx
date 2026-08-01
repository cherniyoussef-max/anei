"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/types";

type UploadState = "idle" | "signing" | "uploading" | "done" | "error";

export function AdminObjectUpload({
  locale,
  name,
  category,
  accept,
  labelFr,
  labelAr,
}: {
  locale: Locale;
  name: string;
  category: "resource" | "course" | "avatar" | "certificate";
  accept: string;
  labelFr: string;
  labelAr: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [objectKey, setObjectKey] = useState("");
  const [message, setMessage] = useState("");
  const ar = locale === "ar";

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => { setState("idle"); setObjectKey(""); setMessage(""); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  async function upload(file: File) {
    setObjectKey("");
    setMessage("");
    setState("signing");
    try {
      const presign = await fetch("/api/admin/storage/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, contentType: file.type, contentLength: file.size }),
      });
      const signed = (await presign.json()) as {
        uploadUrl?: string;
        objectKey?: string;
        fields?: Record<string, string>;
        error?: string;
      };
      if (!presign.ok || !signed.uploadUrl || !signed.objectKey || !signed.fields) {
        throw new Error(signed.error || "UPLOAD_SIGNING_FAILED");
      }

      setState("uploading");
      const form = new FormData();
      for (const [field, value] of Object.entries(signed.fields)) form.append(field, value);
      form.append("file", file);
      const response = await fetch(signed.uploadUrl, { method: "POST", body: form });
      if (!response.ok) throw new Error(`OBJECT_UPLOAD_FAILED_${response.status}`);

      setObjectKey(signed.objectKey);
      setState("done");
      setMessage(ar ? "تم رفع الملف إلى التخزين الخاص." : "Fichier chargé dans le stockage privé.");
    } catch (error) {
      setState("error");
      const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
      setMessage(
        code === "STORAGE_NOT_CONFIGURED"
          ? ar
            ? "التخزين الخاص غير مهيأ في هذه البيئة. استخدم مسار التطوير المحلي أو هيّئ S3/R2."
            : "Le stockage privé n’est pas configuré ici. Utilisez un chemin local en développement ou configurez S3/R2."
          : ar
            ? "فشل رفع الملف. تحقق من إعداد التخزين و CORS."
            : "Échec du chargement. Vérifiez la configuration du stockage et CORS.",
      );
    }
  }

  return (
    <div className="admin-upload-field" ref={rootRef}>
      <label htmlFor={id}>
        <span>{ar ? labelAr : labelFr}</span>
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={state === "signing" || state === "uploading"}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <input type="hidden" name={name} value={objectKey} readOnly />
      {state === "signing" || state === "uploading" ? (
        <small role="status">{ar ? "جارٍ الرفع…" : "Chargement…"}</small>
      ) : null}
      {message ? <small className={state === "error" ? "form-error" : "success-inline"}>{message}</small> : null}
      {objectKey ? <code className="object-key-preview">{objectKey}</code> : null}
    </div>
  );
}
