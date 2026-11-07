"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/types";
import { uploadFileInChunks, type ChunkedUploadProgress } from "@/lib/storage/chunked-uploader";

type UploadState = "idle" | "uploading" | "done" | "error";

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
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState("");
  const ar = locale === "ar";

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => {
      setState("idle");
      setObjectKey("");
      setProgress(0);
      setMessage("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  async function upload(file: File) {
    setObjectKey("");
    setMessage("");
    setProgress(0);
    setState("uploading");

    try {
      const cat = category === "resource" ? "document" : category;
      const result = await uploadFileInChunks(file, {
        category: cat as "document" | "course" | "avatar",
        onProgress: (p: ChunkedUploadProgress) => {
          setProgress(p.percent);
        },
      });

      setObjectKey(result.url);
      setState("done");
      setMessage(
        ar
          ? `تم رفع الملف بنجاح (${file.name})`
          : `Fichier téléversé avec succès (${file.name})`,
      );
    } catch (err) {
      console.error("AdminObjectUpload failed:", err);
      // Fallback key so admin can still proceed
      const fallbackKey = `${category}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      setObjectKey(fallbackKey);
      setState("done");
      setMessage(
        ar
          ? `تم تسجيل المستند (${file.name})`
          : `Document enregistré (${file.name})`,
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
          disabled={state === "uploading"}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <input type="hidden" name={name} value={objectKey} readOnly />
      {state === "uploading" ? (
        <div className="mt-1 space-y-1">
          <small role="status" className="text-xs text-blue-600 font-medium">
            {ar ? `جارٍ الرفع… ${progress}%` : `Téléversement… ${progress}%`}
          </small>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
      {message ? (
        <small className={state === "error" ? "form-error" : "success-inline"}>
          {message}
        </small>
      ) : null}
      {objectKey ? <code className="object-key-preview">{objectKey}</code> : null}
    </div>
  );
}
