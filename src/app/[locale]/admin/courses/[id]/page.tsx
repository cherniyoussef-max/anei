import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";

export default async function AdminCourseIdRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/admin/courses/editor/${id}`);
}
