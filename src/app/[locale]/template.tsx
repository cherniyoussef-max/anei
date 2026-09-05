// Re-mounts on every navigation (unlike layout.tsx), giving every route a
// consistent, subtle fade/slide-in so moving between pages feels smooth
// instead of an abrupt content swap. Respects prefers-reduced-motion via CSS.
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
