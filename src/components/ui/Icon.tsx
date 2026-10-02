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
  | "bell"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "messenger"
  | "wallet"
  | "gift"
  | "trophy"
  | "bag"
  | "eye"
  | "eye-off"
  | "video"
  | "google"
  | "teams"
  | "link"
  | "copy"
  | "lock"
  | "key";

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
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7M7 7v.01M11 17v-4.5a2.5 2.5 0 0 1 5 0V17M11 10v7"/></>,
  facebook: <><path d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v6h3v-6h2.2l.8-3H14v-1.5c0-.5.2-1 1-1h1V6.2A15 15 0 0 0 14.5 6C12.5 6 11 7.2 11 9.5V10"/><circle cx="12" cy="12" r="9"/></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/></>,
  messenger: <><path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2Zm1 12.3-2.6-2.8-5 2.8 5.5-5.9 2.6 2.8 5.1-2.8-5.6 5.9Z"/></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a2 2 0 1 0 0 4h5"/></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-2-3-6-3-6-.5S9 8 12 8c3 0 6-1 6-3.5S14 5 12 8Z"/></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5"/><path d="M12 13v3M9 21h6M8.5 21c0-2 1-3.5 1.5-4h4c.5.5 1.5 2 1.5 4"/></>,
  bag: <><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  "eye-off": <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>,
  video: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>,
  google: <><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></>,
  teams: <><rect x="3" y="4" width="12" height="16" rx="2"/><circle cx="17.5" cy="8.5" r="2.5"/><path d="M15 14h5a2 2 0 0 1 2 2v2"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>,
  lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3"/></>,
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
