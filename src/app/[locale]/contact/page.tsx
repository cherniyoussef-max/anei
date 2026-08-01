import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/interactive/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { env } from "@/server/env";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  return <>
    <PageHero eyebrow={ar ? "اتصل بنا" : "Contact"} title={ar ? "لنتحدث عن احتياجاتك" : "Parlons de vos besoins"} description={ar ? "للتكوين أو الشراكات أو الدعم أو أي استفسار حول المنصة، فريق الأكاديمية في خدمتك." : "Formation, partenariat, accompagnement ou question sur la plateforme : l’équipe de l’Académie vous répond."}/>
    <section className="section"><div className="container contact-grid"><ContactForm locale={locale}/><aside className="contact-side"><div className="contact-info-card"><span><Icon name="mail" size={20}/></span><div><small>Email</small><strong>{env.CONTACT_EMAIL}</strong></div></div>{env.CONTACT_PHONE?<div className="contact-info-card"><span><Icon name="phone" size={20}/></span><div><small>{ar ? "الهاتف" : "Téléphone"}</small><strong>{env.CONTACT_PHONE}</strong></div></div>:null}<div className="contact-info-card"><span><Icon name="map" size={20}/></span><div><small>{ar ? "الموقع" : "Localisation"}</small><strong>{env.CONTACT_ADDRESS}</strong></div></div><div className="map-placeholder"><div className="map-grid"/><span className="map-pin"><Icon name="map" size={28}/></span><strong>ANEI</strong></div></aside></div></section>
  </>;
}
