/** Small static Tunisian flag - no external image/CDN dependency, never mirrored in RTL. */
export function TunisiaFlag({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Tunisie"
      className="tunisia-flag"
    >
      <circle cx="256" cy="256" r="256" fill="#e70013" />
      <circle cx="256" cy="256" r="150" fill="#fff" />
      <circle cx="256" cy="256" r="103" fill="#e70013" />
      <circle cx="285" cy="256" r="82" fill="#fff" />
      <path
        fill="#e70013"
        d="M295 175l25 62 65 3-52 41 19 64-57-38-57 38 19-64-52-41 65-3z"
      />
    </svg>
  );
}
