import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function LocaleNotFound() {
  return (
    <main className="min-h-[70vh] grid place-items-center p-6 bg-[#F8FAFC]">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
        <div className="w-12 h-12 rounded-full bg-[#F0F6FF] text-[#0056D2] grid place-items-center mx-auto mb-4">
          <BookOpen size={24} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">Erreur 404</span>
        <h1 className="text-xl font-bold text-[#1F1F1F] mt-2 mb-2">Page introuvable</h1>
        <p className="text-sm text-[#5E6E82] mb-6">
          La page que vous recherchez n’existe pas, a été déplacée ou nécessite une inscription préalable.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0056D2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00419E]"
            href="/fr/dashboard/formations"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            <span>Mes formations</span>
          </Link>
          <Link
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition hover:bg-[#F8FAFC]"
            href="/fr/formations"
          >
            <span>Catalogue</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
