import { notFound } from "next/navigation";
import { HomeHero } from "@/components/sections/HomeHero";
import { HomeSections } from "@/components/sections/HomeSections";
import { isLocale } from "@/lib/i18n";
import { getHomeStats } from "@/server/queries/home";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const stats = await getHomeStats();
  return <><HomeHero locale={locale} avsCount={stats.avs}/><HomeSections locale={locale} liveStats={stats}/></>;
}
