import Link from "next/link";
import { ArrowLeft, BookOpen, Compass } from "lucide-react";

export default function SiteNotFound() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#f7faff]">
      <div className="max-w-lg w-full text-center bg-white p-8 sm:p-10 rounded-3xl border border-[#dde9f8] shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#eef4fc] text-[#0b1f4b] grid place-items-center mx-auto mb-5 border border-[#dde9f8]">
          <Compass size={32} strokeWidth={1.8} className="text-[#0b1f4b]" aria-hidden="true" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-[#b8923a] bg-[#fbf8f0] border border-[#e3c776]/50 mb-3">
          Erreur 404
        </span>

        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#0b1f4b] mb-3">
          Page introuvable
        </h1>

        <p className="text-sm text-[#46557a] mb-8 leading-relaxed">
          Le document, la formation ou la ressource que vous recherchez n’existe pas, a été déplacé ou est temporairement inaccessible.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0b1f4b] hover:bg-[#1b3a7a] px-6 py-3 text-sm font-semibold text-white transition-all shadow-xs"
            href="/fr"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            <span>Retour à l’accueil</span>
          </Link>
          <Link
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#dde9f8] bg-white hover:bg-[#eef4fc] px-5 py-3 text-sm font-semibold text-[#0b1f4b] transition-colors"
            href="/fr/formations"
          >
            <BookOpen size={16} />
            <span>Catalogue des formations</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
