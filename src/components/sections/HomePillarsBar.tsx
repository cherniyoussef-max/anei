import type { Locale } from "@/types";

function SproutPillarIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Central stem */}
      <path d="M16 27V15" />
      {/* Top vertical leaf with central vein */}
      <path d="M16 15C13.5 11.2 13.8 6.8 16 4.5C18.2 6.8 18.5 11.2 16 15Z" />
      <path d="M16 6.5V14" />
      {/* Left leaf with vein */}
      <path d="M15 19C10.8 17.5 6.5 19.5 5.5 22.5C7.2 24.2 11.8 24.2 15 20.8" />
      <path d="M7.5 22.5C10 21.8 12.8 20.8 14.8 20.5" />
      {/* Right leaf with vein */}
      <path d="M17 19C21.2 17.5 25.5 19.5 26.5 22.5C24.8 24.2 20.2 24.2 17 20.8" />
      <path d="M24.5 22.5C22 21.8 19.2 20.8 17.2 20.5" />
    </svg>
  );
}

function CommunityPillarIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Center user: head and body */}
      <circle cx="16" cy="10" r="4.2" />
      <path d="M8.5 25.5C8.5 21 11.8 18 16 18C20.2 18 23.5 21 23.5 25.5" />
      {/* Left background user */}
      <circle cx="7.5" cy="12.5" r="3" />
      <path d="M2.5 24C2.5 20.8 5 19 8.2 18.5" />
      {/* Right background user */}
      <circle cx="24.5" cy="12.5" r="3" />
      <path d="M29.5 24C29.5 20.8 27 19 23.8 18.5" />
    </svg>
  );
}

function TargetPillarIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer target circle with opening at top-right for arrow */}
      <path d="M23.2 8.8C21.3 7 18.8 6 16 6C10.5 6 6 10.5 6 16C6 21.5 10.5 26 16 26C21.5 26 26 21.5 26 16C26 14.1 25.4 12.3 24.5 10.8" />
      {/* Inner concentric ring */}
      <circle cx="16" cy="16" r="6" />
      {/* Bullseye center dot */}
      <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
      {/* Arrow shaft hitting bullseye */}
      <path d="M16 16L24.8 7.2" />
      {/* Arrow tail fletching */}
      <path d="M22 6.5L25.5 6.5L25.5 10" />
      <path d="M20.5 8.5L23.5 5.5" />
    </svg>
  );
}

function GlobePillarIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer globe sphere */}
      <circle cx="16" cy="16" r="11.5" />
      {/* Equator line */}
      <path d="M4.5 16H27.5" />
      {/* Longitudinal ellipse meridians */}
      <ellipse cx="16" cy="16" rx="5.5" ry="11.5" />
      {/* Curved latitude arcs */}
      <path d="M7.5 9.5C10 11.5 13 12.5 16 12.5C19 12.5 22 11.5 24.5 9.5" />
      <path d="M7.5 22.5C10 20.5 13 19.5 16 19.5C19 19.5 22 20.5 24.5 22.5" />
    </svg>
  );
}

export function HomePillarsBar({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const en = locale === "en";

  const pillars = [
    {
      id: "expertise",
      icon: SproutPillarIcon,
      line1Fr: "Une expertise",
      line2Fr: "au service de l'inclusion",
      line1Ar: "خبرة متخصصة",
      line2Ar: "في خدمة التربية الدامجة",
      line1En: "Recognized expertise",
      line2En: "for inclusive education",
    },
    {
      id: "community",
      icon: CommunityPillarIcon,
      line1Fr: "Une communauté",
      line2Fr: "engagée et bienveillante",
      line1Ar: "مجتمع ملتزم",
      line2Ar: "وداعم بإيجابية",
      line1En: "A committed",
      line2En: "and caring community",
    },
    {
      id: "resources",
      icon: TargetPillarIcon,
      line1Fr: "Des ressources",
      line2Fr: "fiables et actualisées",
      line1Ar: "موارد موثوقة",
      line2Ar: "ومحيّنة باستمرار",
      line1En: "Reliable and",
      line2En: "up-to-date resources",
    },
    {
      id: "impact",
      icon: GlobePillarIcon,
      line1Fr: "Un impact durable",
      line2Fr: "sur la société",
      line1Ar: "أثر مستدام",
      line2Ar: "على المجتمع",
      line1En: "A lasting impact",
      line2En: "on society",
    },
  ];

  return (
    <section
      className="home-pillars-bar relative bg-[#F4F8FC] border-t border-slate-200/90 py-8 sm:py-10"
      aria-label={ar ? "أسس وقيم الأكاديمية" : en ? "Academy core pillars" : "Piliers d'excellence de l'Académie"}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-slate-200/80">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            const line1 = ar ? pillar.line1Ar : en ? pillar.line1En : pillar.line1Fr;
            const line2 = ar ? pillar.line2Ar : en ? pillar.line2En : pillar.line2Fr;

            return (
              <div
                key={pillar.id}
                className={`flex flex-col items-center justify-center text-center px-3 sm:px-6 py-4 sm:py-2 ${
                  idx % 2 === 1 ? "border-s sm:border-s-0 border-slate-200/80" : ""
                }`}
              >
                {/* Pillar Icon in Ocean Blue #236D97 */}
                <div className="text-[#236D97] mb-3 flex items-center justify-center shrink-0">
                  <Icon className="w-8 h-8 sm:w-9 sm:h-9" />
                </div>

                {/* Pillar Text in Deep Navy #13385A */}
                <p className="text-[13.5px] sm:text-[14.5px] lg:text-[15px] font-semibold text-[#13385a] leading-[1.36] text-center font-sans tracking-tight">
                  <span className="block">{line1}</span>
                  <span className="block">{line2}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
