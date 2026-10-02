import { Icon } from "@/components/ui/Icon";
import { getProviderMeta } from "@/lib/webinars";
import type { Locale } from "@/types";

export function MeetingProviderBadge({
  provider,
  locale,
  className = "",
}: {
  provider?: string | null;
  locale?: Locale;
  className?: string;
}) {
  const ar = locale === "ar";
  const meta = getProviderMeta(provider);
  const isMeet = meta.id === "google_meet";
  const isTeams = meta.id === "teams";

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.25rem 0.65rem",
    borderRadius: "9999px",
    fontSize: "0.775rem",
    fontWeight: 600,
    backgroundColor: isMeet ? "rgba(0, 121, 107, 0.09)" : isTeams ? "rgba(80, 89, 201, 0.1)" : "rgba(8, 45, 85, 0.08)",
    color: isMeet ? "#00796b" : isTeams ? "#4f58c7" : "#082d55",
    border: `1px solid ${isMeet ? "rgba(0, 121, 107, 0.25)" : isTeams ? "rgba(80, 89, 201, 0.28)" : "rgba(8, 45, 85, 0.18)"}`,
  };

  return (
    <span style={style} className={`meeting-provider-badge ${className}`} dir={ar ? "rtl" : "ltr"}>
      <Icon name={meta.iconName} size={14} />
      <span>{ar ? meta.nameAr : meta.name}</span>
    </span>
  );
}
