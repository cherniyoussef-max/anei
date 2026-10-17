"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Locale } from "@/types";
import { AneiLogo } from "@/components/brand/AneiLogo";
import { ArrowLeft, X } from "lucide-react";

interface AuthShellProps {
  locale: Locale;
  mode: "login" | "register" | "recovery";
  children: ReactNode;
}

export function AuthShell({ locale, mode, children }: AuthShellProps) {
  const pathname = usePathname();
  const ar = locale === "ar";

  const switchHref = mode === "register" ? `/${locale}/connexion` : mode === "recovery" ? `/${locale}/connexion` : `/${locale}/inscription`;
  const switchLabel = mode === "register"
    ? (ar ? "لديك حساب بالفعل؟ تسجيل الدخول ←" : "Déjà un compte ? Se connecter →")
    : mode === "recovery"
    ? (ar ? "تذكرت كلمة المرور؟ تسجيل الدخول ←" : "Mot de passe retrouvé ? Se connecter →")
    : (ar ? "جديد في الأكاديمية؟ إنشاء حساب ←" : "Nouveau sur ANEI ? Créer un compte →");

  return (
    <div className="min-h-screen bg-white text-[#0A192F] flex flex-col selection:bg-[#0A192F] selection:text-white">
      {/* Floating Minimalist Header */}
      <header className="h-20 px-6 sm:px-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-xs sticky top-0 z-40">
        {/* Start: Back/Close & Emblem */}
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}`}
            className="p-2 -m-2 text-slate-400 hover:text-[#0A192F] transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-[#0056D2]"
            aria-label={ar ? "العودة إلى الصفحة الرئيسية" : "Retour à l'accueil"}
            title={ar ? "العودة إلى الصفحة الرئيسية" : "Retour à l'accueil"}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180 hidden sm:block" />
            <X className="w-5 h-5 sm:hidden" />
          </Link>

          <Link
            href={`/${locale}`}
            className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-[#0056D2] rounded-md"
            aria-label="ANEI"
          >
            <AneiLogo locale={locale} variant="mark" withText={false} height={34} />
          </Link>
        </div>

        {/* End: Language Toggle & Contextual Link */}
        <div className="flex items-center gap-5 sm:gap-7 text-sm font-medium">
          <Link
            href={switchHref}
            className="text-slate-600 hover:text-[#0A192F] font-semibold transition-colors hidden sm:inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#0056D2] rounded-md"
          >
            {switchLabel}
          </Link>

          {/* Minimalist Language Switcher */}
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Link
              href={pathname?.replace(`/${locale}`, "/fr") || "/fr/connexion"}
              className={`px-2 py-1 rounded transition-colors ${
                locale === "fr"
                  ? "text-[#0A192F] font-bold bg-slate-100"
                  : "hover:text-[#0A192F]"
              }`}
            >
              FR
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href={pathname?.replace(`/${locale}`, "/ar") || "/ar/connexion"}
              className={`px-2 py-1 rounded transition-colors font-arabic ${
                locale === "ar"
                  ? "text-[#0A192F] font-bold bg-slate-100"
                  : "hover:text-[#0A192F]"
              }`}
            >
              عربي
            </Link>
          </div>
        </div>
      </header>

      {/* Main Central Step Container */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-[580px] w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Discreet Bottom Bar on Mobile */}
      <footer className="sm:hidden border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-500">
        <Link href={switchHref} className="font-semibold text-[#0056D2]">
          {switchLabel}
        </Link>
      </footer>
    </div>
  );
}
