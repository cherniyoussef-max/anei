import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { getPublishedNews } from "@/server/queries/news";

export const dynamic = "force-dynamic";
export default async function NewsPage({params}:{params:Promise<{locale:string}>}) {
  const { locale } = await params; if(!isLocale(locale)) notFound(); const ar=locale==="ar"; const items=await getPublishedNews();
  return <><PageHero eyebrow={ar?"الأخبار":"Actualités"} title={ar?"أخبار الأكاديمية والفعاليات الجديدة":"L’actualité de l’Académie et de ses programmes"} description={ar?"تكوينات جديدة وفعاليات وشراكات ومصادر مهنية.":"Nouvelles formations, événements, partenariats et ressources professionnelles."}/><section className="section"><div className="container news-page-grid">{items.map((item,index)=><article className={index===0?"news-card featured-news":"news-card"} key={item.id}><div className="news-visual"><span>{String(index+1).padStart(2,"0")}</span></div><div className="news-content"><span className="news-tag">{ar?item.tagAr:item.tagFr}</span><h2>{ar?item.titleAr:item.titleFr}</h2><p>{ar?item.excerptAr:item.excerptFr}</p><div className="news-footer"><time>{formatDate(item.publishedAt??item.createdAt,locale)}</time><Link className="icon-button" href={`/${locale}/actualites/${item.slug}`} aria-label={ar?"قراءة الخبر":"Lire l'actualité"}><Icon name="arrow" size={18}/></Link></div></div></article>)}</div>{!items.length?<div className="container empty-panel"><p>{ar?"لا توجد أخبار منشورة حاليا.":"Aucune actualité publiée pour le moment."}</p></div>:null}</section></>;
}
