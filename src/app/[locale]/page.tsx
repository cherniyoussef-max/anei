import { notFound } from "next/navigation";
import { HomeHero } from "@/components/sections/HomeHero";
import { HomeSections } from "@/components/sections/HomeSections";
import { isLocale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <><HomeHero locale={locale}/><HomeSections locale={locale}/></>;
}
