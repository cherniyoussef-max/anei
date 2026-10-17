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
  const en = locale === "en";

  const officialEmail = env.CONTACT_EMAIL && !env.CONTACT_EMAIL.endsWith(".local") ? env.CONTACT_EMAIL : "contact@anei.tn";
  const officialPhone = env.CONTACT_PHONE || "+216 71 840 100";

  const regionalHubs = [
    {
      title: ar ? "المقر الوطني والحرم الجامعي الرئيسي" : "Siège National & Campus Principal",
      city: ar ? "تونس العاصمة" : "Grand Tunis",
      address: ar
        ? "شارع الحبيب بورقيبة، المركز العمراني الشمالي، 1082 تونس"
        : "Avenue Habib Bourguiba, Centre Urbain Nord, 1082 Tunis, Tunisie",
      hours: ar ? "الإثنين - الجمعة: 08:30 - 17:30 | السبت: 09:00 - 13:00" : "Lun - Ven : 08h30 - 17h30 | Sam : 09h00 - 13h00",
      phone: officialPhone,
      email: officialEmail,
      transit: ar ? "مترو خفيف خط 2 (محطة مدينة العلوم) • حافلات خط 35 و 44" : "Métro 2 (Station Cité des Sciences) • Bus 35 & 44 • Accès autoroute RN8",
      access: ar ? "مهيأ بالكامل لذوي الإعاقة (PMR) • مواقف سيارات مخصصة" : "Accès PMR universel • Rampes d'accès • Parking réservé",
      isPrimary: true,
    },
    {
      title: ar ? "القطب الإقليمي للوسط والساحل" : "Pôle Régional Sahel & Centre",
      city: ar ? "سوسة - المنستير" : "Sousse",
      address: ar ? "نهج ابن خلدون، سهلول، سوسة" : "Rue Ibn Khaldoun, Sahloul, Sousse",
      hours: ar ? "الإثنين - الجمعة: 09:00 - 16:30" : "Lun - Ven : 09h00 - 16h30",
      phone: "+216 73 360 220",
      email: "sahel@anei.tn",
      transit: ar ? "محطة مترو الساحل سهلول" : "Métro du Sahel (Station Sahloul)",
      access: ar ? "ولوج مهيأ بالكامل" : "Accessible PMR",
      isPrimary: false,
    },
    {
      title: ar ? "القطب الإقليمي للجنوب" : "Pôle Régional Sud",
      city: ar ? "صفاقس" : "Sfax",
      address: ar ? "طريق العين كم 1.5، صفاقس الجديدة" : "Route El Ain Km 1.5, Nouvelle Médina, Sfax",
      hours: ar ? "الإثنين - الجمعة: 09:00 - 16:30" : "Lun - Ven : 09h00 - 16h30",
      phone: "+216 74 420 330",
      email: "sud@anei.tn",
      transit: ar ? "وسط مدينة صفاقس • حافلات النقل الحضري" : "Centre-ville Sfax • Lignes urbaines SORETRAS",
      access: ar ? "ولوج مهيأ بالكامل" : "Accessible PMR",
      isPrimary: false,
    },
  ];

  const breadcrumbs = [
    { label: ar ? "الرئيسية" : "Accueil", href: `/${locale}` },
    { label: ar ? "اتصل بنا" : "Contact" },
  ];

  return (
    <>
      <PageHero
        breadcrumbs={breadcrumbs}
        eyebrow={ar ? "الاتصال والمقر الوطني" : en ? "Contact & Placement" : "Contact & Implantations ANEI"}
        title={ar ? "لنتحدث عن احتياجاتكم في التربية الدامجة" : en ? "Connect with the National Inclusive Academy" : "Parlons de vos besoins d'accompagnement"}
        description={
          ar
            ? "فريق التوجيه التربوي والمرافقة المدرسية في خدمتكم للإجابة عن استفسارات التكوين، حجز المرافقين المدرسيين (AVS)، أو الشراكات المؤسسية."
            : en
            ? "Our academic guidance and inclusion teams are at your service for certifications, AVS appointments, family assistance, and institutional partnerships."
            : "Formations certifiantes, réservation d’AVS qualifiés, accompagnement des familles ou partenariats institutionnels : notre équipe académique vous répond."
        }
      />

      <section className="section bg-white">
        <div className="academy-container">
          <div className="contact-grid grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
            {/* Form Column */}
            <div className="lg:col-span-7 bg-white p-7 sm:p-9 rounded-2xl border border-[#E3E8EF] shadow-[0_4px_16px_rgba(27,58,92,0.06)]">
              <div className="mb-6 pb-6 border-b border-[#E3E8EF]">
                <div className="eyebrow-container mb-2">
                  <span className="gold-line" aria-hidden="true" />
                  <span className="eyebrow-label">
                    {ar ? "المراسلة المباشرة" : "Formulaire officiel"}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 font-sans tracking-tight mt-1">
                  {ar ? "أرسل رسالتك إلى إدارة الأكاديمية" : "Transmettez votre message à l'Académie"}
                </h2>
                <p className="text-sm text-[#3D4A5C] mt-1">
                  {ar
                    ? "تصل رسالتكم مباشرة وبشكل آلي إلى مكتب الدعم والمتابعة عبر البريد الإلكتروني مع إشعار استلام فوري."
                    : "Votre message est transmis directement à notre pôle support avec un accusé de réception automatique par email."}
                </p>
              </div>
              <ContactForm locale={locale} />
            </div>

            {/* Quick Contact & Placement Column */}
            <aside className="lg:col-span-5 space-y-6">
              {/* Primary Headquarter Highlight */}
              <div className="bg-[#1B3A5C] text-white p-7 rounded-2xl shadow-md border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-[#B8925A]/10 rounded-full blur-2xl pointer-events-none" />
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#B8925A] bg-white/10 px-3 py-1 rounded-full mb-3">
                  {ar ? "المقر الوطني الرئيسي" : "Siège & Campus National"}
                </span>
                <h3 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">
                  {ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l'Éducation Inclusive"}
                </h3>
                <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                  {ar
                    ? "مركز الخبرة والتكوين وإدارة شبكة المرافقة المدرسية على المستوى الوطني."
                    : "Centre d'expertise, d'homologation pédagogique et de supervision du réseau AVS national."}
                </p>

                <div className="space-y-4 text-xs text-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#B8925A] flex-none mt-0.5">
                      <Icon name="map" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "العنوان البريدي والفعلي" : "Adresse"}</strong>
                      <span>{ar ? "شارع الحبيب بورقيبة، المركز العمراني الشمالي، 1082 تونس" : "Avenue Habib Bourguiba, Centre Urbain Nord, 1082 Tunis"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#B8925A] flex-none mt-0.5">
                      <Icon name="mail" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "البريد الإلكتروني المباشر" : "Email officiel"}</strong>
                      <a href={`mailto:${officialEmail}`} className="text-amber-200 hover:underline">
                        {officialEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#B8925A] flex-none mt-0.5">
                      <Icon name="phone" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "الخط الهاتفي والمساعدة" : "Permanence téléphonique"}</strong>
                      <a href={`tel:${officialPhone}`} className="text-white hover:underline">
                        <span dir="ltr">{officialPhone}</span>
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#B8925A] flex-none mt-0.5">
                      <Icon name="clock" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "أوقات العمل واستقبال الزوار" : "Horaires d'accueil"}</strong>
                      <span>{ar ? "الإثنين - الجمعة: 08:30 - 17:30" : "Du Lundi au Vendredi : 08h30 - 17h30"}</span>
                      <span className="block text-[11px] text-slate-400">{ar ? "السبت: 09:00 - 13:00 (حسب المواعيد)" : "Samedi : 09h00 - 13h00 (sur rendez-vous)"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2">
                  <a
                    href="https://maps.google.com/?q=Centre+Urbain+Nord+Tunis"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-[#B8925A] hover:bg-[#9E7A45] text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm"
                  >
                    <Icon name="map" size={14} />
                    <span>{ar ? "تحديد المسار على خرائط Google" : "Itinéraire Google Maps"}</span>
                  </a>
                </div>
              </div>

            </aside>
          </div>

          {/* Regional Hubs & Implantation Directory */}
          <div className="mt-16 pt-12 border-t border-[#E3E8EF]">
            <div className="max-w-2xl mb-8">
              <div className="eyebrow-container mb-2">
                <span className="gold-line" aria-hidden="true" />
                <span className="eyebrow-label">
                  {ar ? "التغطية الوطنية" : "Réseau territorial"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-sans tracking-tight mt-1">
                {ar ? "الأقطاب الإقليمية ومراكز الدعم الميداني" : "Pôles régionaux & centres d'accueil"}
              </h2>
              <p className="text-sm text-[#3D4A5C] mt-2">
                {ar
                  ? "تنتشر أقطاب الأكاديمية لضمان متابعة ميدانية وثيقة للأسر والمرافقين المدرسيين في كامل ولايات الجمهورية."
                  : "Des délégations régionales pour assurer la coordination de proximité, les bilans d'inclusion et le suivi des AVS sur tout le territoire."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {regionalHubs.map((hub, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-2xl border transition-all ${
                    hub.isPrimary
                      ? "bg-white border-[#B8925A]/40 shadow-md ring-1 ring-[#B8925A]/20"
                      : "bg-white border-[#E3E8EF] shadow-[0_4px_16px_rgba(27,58,92,0.05)] hover:border-[#1B3A5C]/30 hover:-translate-y-1"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1B3A5C] bg-[#F4F7FA] px-2.5 py-1 rounded-md">
                      {hub.city}
                    </span>
                    {hub.isPrimary && (
                      <span className="text-[10px] font-bold text-[#B8925A] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {ar ? "المركز الرئيسي" : "Siège Principal"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2 font-sans">{hub.title}</h3>
                  <div className="space-y-2.5 text-xs text-[#3D4A5C] mt-4">
                    <p className="flex items-start gap-2">
                      <span className="text-slate-400 flex-none mt-0.5"><Icon name="map" size={14} /></span>
                      <span>{hub.address}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-slate-400 flex-none mt-0.5"><Icon name="clock" size={14} /></span>
                      <span>{hub.hours}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-slate-400 flex-none mt-0.5"><Icon name="phone" size={14} /></span>
                      <a href={`tel:${hub.phone}`} className="text-[#1B3A5C] font-semibold hover:underline">
                        <span dir="ltr">{hub.phone}</span>
                      </a>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-slate-400 flex-none mt-0.5"><Icon name="mail" size={14} /></span>
                      <a href={`mailto:${hub.email}`} className="text-[#B8925A] hover:underline">
                        {hub.email}
                      </a>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
