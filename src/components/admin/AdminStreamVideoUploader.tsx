"use client";

import { AdminCloudflareVideoUploader } from "@/components/admin/AdminCloudflareVideoUploader";
import type { Locale } from "@/types";

export interface AdminStreamVideoUploaderProps {
  locale: Locale;
  initialMediaProvider?: string;
  initialMediaRef?: string | null;
  initialVideoUrl?: string | null;
  lessonId?: string | null;
  courseId?: string | null;
  initialDurationSeconds?: number;
  onUploaded?: (result: {
    provider: string;
    mediaRef: string;
    durationSeconds?: number;
    thumbnailUrl?: string;
  }) => void;
}

/**
 * Backward-compatible wrapper exposing the full Zero-Touch Cloudflare Video Uploader
 */
export function AdminStreamVideoUploader(props: AdminStreamVideoUploaderProps) {
  return <AdminCloudflareVideoUploader {...props} />;
}
