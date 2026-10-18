import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import type { Locale } from "@/types";
import { StandaloneAssistantView } from "@/components/ai/StandaloneAssistantView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const title = isAr
    ? "المساعد البيداغوجي الذكي والتربية الدامجة | ANEI"
    : "Assistant Pédagogique IA & Éducation Inclusive | ANEI";
  const description = isAr
    ? "مساعد ذكي تفاعلي مبني على المراجع الرسمية للأكاديمية الوطنية للتربية الدامجة لمرافقة المربين، مرافقي AVS والأولياء."
    : "Assistant IA conversationnel fondé sur les référentiels officiels de l'ANEI (TSA, TDAH, troubles des apprentissages, AVS).";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/assistant`,
      languages: { en: "/en/assistant", ar: "/ar/assistant", fr: "/fr/assistant", "x-default": "/fr/assistant" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: isAr ? "ar_TN" : "fr_FR",
    },
  };
}

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <StandaloneAssistantView locale={locale as Locale} />;
}
