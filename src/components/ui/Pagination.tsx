import Link from "next/link";
import type { Locale } from "@/types";

function withPage(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  if (page > 1) search.set("page", String(page));
  else search.delete("page");
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  locale,
  basePath,
  page,
  totalPages,
  params,
}: {
  locale: Locale;
  basePath: string;
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const ar = locale === "ar";
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <nav className="pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
      {page > 1 ? (
        <Link className="pagination-link" href={withPage(basePath, params, page - 1)}>
          {ar ? "السابق" : "Précédent"}
        </Link>
      ) : null}
      {start > 1 ? <span aria-hidden="true">…</span> : null}
      {pages.map((item) => (
        <Link
          className={item === page ? "pagination-link active" : "pagination-link"}
          aria-current={item === page ? "page" : undefined}
          href={withPage(basePath, params, item)}
          key={item}
        >
          {item}
        </Link>
      ))}
      {end < totalPages ? <span aria-hidden="true">…</span> : null}
      {page < totalPages ? (
        <Link className="pagination-link" href={withPage(basePath, params, page + 1)}>
          {ar ? "التالي" : "Suivant"}
        </Link>
      ) : null}
    </nav>
  );
}
