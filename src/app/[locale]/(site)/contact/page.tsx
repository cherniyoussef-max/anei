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

  const regionalHubs = [
    {
      title: ar ? "المقر الوطني والحرم الجامعي الرئيسي" : "Siège National & Campus Principal",
      city: ar ? "تونس العاصمة" : "Grand Tunis",
      address: ar
        ? "شارع الحبيب بورقيبة، المركز العمراني الشمالي، 1082 تونس"
        : "Avenue Habib Bourguiba, Centre Urbain Nord, 1082 Tunis, Tunisie",
      hours: ar ? "الإثنين - الجمعة: 08:30 - 17:30 | السبت: 09:00 - 13:00" : "Lun - Ven : 08h30 - 17h30 | Sam : 09h00 - 13h00",
      phone: env.CONTACT_PHONE || "+216 71 840 100",
      email: env.CONTACT_EMAIL || "contact@anei.local",
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

  return (
    <>
      <PageHero
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

      <section className="section bg-[#FCFBF8]">
        <div className="container">
          <div className="contact-grid grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
            {/* Form Column */}
            <div className="lg:col-span-7 bg-white p-8 md:p-10 rounded-2xl border border-[#E7E0D3] shadow-sm">
              <div className="mb-6 pb-6 border-b border-[#F1ECE2]">
                <span className="text-xs uppercase font-bold tracking-widest text-[#a66f24]">
                  {ar ? "المراسلة المباشرة" : "Formulaire officiel"}
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-[#082D55] mt-1">
                  {ar ? "أرسل رسالتك إلى إدارة الأكاديمية" : "Transmettez votre message à l'Académie"}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
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
              <div className="bg-[#082D55] text-white p-7 rounded-2xl shadow-md border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-[#c9913f]/10 rounded-full blur-2xl pointer-events-none" />
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#d4af37] bg-white/10 px-3 py-1 rounded-full mb-3">
                  {ar ? "المقر الوطني الرئيسي" : "Siège & Campus National"}
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  {ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l'Éducation Inclusive"}
                </h3>
                <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                  {ar
                    ? "مركز الخبرة والتكوين وإدارة شبكة المرافقة المدرسية على المستوى الوطني."
                    : "Centre d'expertise, d'homologation pédagogique et de supervision du réseau AVS national."}
                </p>

                <div className="space-y-4 text-xs text-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 flex-none mt-0.5">
                      <Icon name="map" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "العنوان البريدي والفعلي" : "Adresse"}</strong>
                      <span>{ar ? "شارع الحبيب بورقيبة، المركز العمراني الشمالي، 1082 تونس" : "Avenue Habib Bourguiba, Centre Urbain Nord, 1082 Tunis"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 flex-none mt-0.5">
                      <Icon name="mail" size={16} />
                    </span>
                    <div>
                      <strong className="block text-white text-xs">{ar ? "البريد الإلكتروني المباشر" : "Email officiel"}</strong>
                      <a href={`mailto:${env.CONTACT_EMAIL}`} className="text-amber-200 hover:underline">
                        {env.CONTACT_EMAIL}
                      </a>
                    </div>
                  </div>

                  {env.CONTACT_PHONE ? (
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 flex-none mt-0.5">
                        <Icon name="phone" size={16} />
                      </span>
                      <div>
                        <strong className="block text-white text-xs">{ar ? "الخط الهاتفي والمساعدة" : "Permanence téléphonique"}</strong>
                        <a href={`tel:${env.CONTACT_PHONE}`} className="text-white hover:underline">
                          <span dir="ltr">{env.CONTACT_PHONE}</span>
                        </a>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 flex-none mt-0.5">
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
                    className="inline-flex items-center gap-2 bg-[#c9913f] hover:bg-[#b07d32] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    <Icon name="map" size={14} />
                    <span>{ar ? "تحديد المسار على خرائط Google" : "Itinéraire Google Maps"}</span>
                  </a>
                </div>
              </div>

              {/* Transit & Accessibility Info Box */}
              <div className="bg-white p-6 rounded-2xl border border-[#E7E0D3] shadow-sm space-y-4">
                <h4 className="font-bold text-[#082D55] text-sm flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                    ✓
                  </span>
                  <span>{ar ? "ولوجية النفاذ وتسهيلات الاستقبال" : "Accès & Mobilité Inclusive"}</span>
                </h4>
                <ul className="text-xs text-slate-600 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="text-[#a66f24] font-bold">•</span>
                    <span>{ar ? "مبنى مجهز بالكامل وفق معايير الإتاحة الشاملة ومصاعد مهيأة (PMR)." : "Bâtiment 100% accessible aux personnes à mobilité réduite (rampes, ascenseurs adaptés)."}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#a66f24] font-bold">•</span>
                    <span>{ar ? "وسائل النقل: مترو الخط 2 (محطة مدينة العلوم) أو حافلات 35 و 44." : "Transports en commun : Métro Ligne 2 (Cité des Sciences), Bus 35 et 44."}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#a66f24] font-bold">•</span>
                    <span>{ar ? "مأوى سيارات مخصص ومجاني لزوار الأكاديمية وأولياء الأمور." : "Parking gratuit réservé aux familles et professionnels sur présentation du RDV."}</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Regional Hubs & Implantation Directory */}
          <div className="mt-16 pt-12 border-t border-[#E7E0D3]">
            <div className="max-w-2xl mb-8">
              <span className="text-xs uppercase font-bold tracking-widest text-[#a66f24]">
                {ar ? "التغطية الوطنية" : "Réseau territorial"}
              </span>
              <h2 className="text-2xl font-bold text-[#082D55] mt-1">
                {ar ? "الأقطاب الإقليمية ومراكز الدعم الميداني" : "Pôles régionaux & centres d'accueil"}
              </h2>
              <p className="text-sm text-slate-600 mt-2">
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
                      ? "bg-white border-[#c9913f]/40 shadow-md ring-1 ring-[#c9913f]/20"
                      : "bg-white border-[#E7E0D3] shadow-sm hover:border-[#082D55]/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#082D55] bg-slate-100 px-2.5 py-1 rounded-md">
                      {hub.city}
                    </span>
                    {hub.isPrimary && (
                      <span className="text-[10px] font-bold text-[#a66f24] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {ar ? "المركز الرئيسي" : "Siège Principal"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-[#082D55] text-base mb-2">{hub.title}</h3>
                  <div className="space-y-2.5 text-xs text-slate-600 mt-4">
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
                      <a href={`tel:${hub.phone}`} className="text-[#082D55] font-semibold hover:underline">
                        <span dir="ltr">{hub.phone}</span>
                      </a>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-slate-400 flex-none mt-0.5"><Icon name="mail" size={14} /></span>
                      <a href={`mailto:${hub.email}`} className="text-[#a66f24] hover:underline">
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
