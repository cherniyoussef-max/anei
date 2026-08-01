import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate,isLocale } from "@/lib/i18n";
import { getPublishedNewsBySlug } from "@/server/queries/news";

export const dynamic="force-dynamic";
export default async function NewsDetail({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale))notFound();const item=await getPublishedNewsBySlug(id);if(!item)notFound();const ar=locale==="ar";
  return <section className="section article-page"><div className="container article-shell"><Link className="back-link" href={`/${locale}/actualites`}>← {ar?"كل الأخبار":"Toutes les actualités"}</Link><span className="news-tag">{ar?item.tagAr:item.tagFr}</span><h1>{ar?item.titleAr:item.titleFr}</h1><time>{formatDate(item.publishedAt??item.createdAt,locale)}</time><p className="article-lead">{ar?item.excerptAr:item.excerptFr}</p><div className="article-body">{(ar?item.contentAr:item.contentFr).split("\n").filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div></div></section>;
}
