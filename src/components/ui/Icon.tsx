import type { SVGProps } from "react";

export type IconName =
  | "arrow"
  | "search"
  | "calendar"
  | "clock"
  | "user"
  | "book"
  | "award"
  | "play"
  | "map"
  | "check"
  | "download"
  | "menu"
  | "close"
  | "globe"
  | "shield"
  | "chart"
  | "users"
  | "graduation"
  | "mail"
  | "phone"
  | "spark"
  | "chevron"
  | "bell";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
  award: <><circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-2 4.5 2-1-9"/></>,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 9 6 3-6 3z"/></>,
  map: <><path d="M12 22s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.2 2.5 3.4 5.5 3.4 9S14.2 18.5 12 21c-2.2-2.5-3.4-5.5-3.4-9S9.8 5.5 12 3Z"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.5 7 10 4.2-1.5 7-5.3 7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  users: <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5"/></>,
  graduation: <><path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v6"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  phone: <path d="M6.5 3h3l1.4 4-2 1.5a15 15 0 0 0 6.6 6.6l1.5-2 4 1.4v3a3 3 0 0 1-3.2 3C10.3 19.7 4.3 13.7 3.5 6.2A3 3 0 0 1 6.5 3Z"/>,
  spark: <><path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>
};

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
