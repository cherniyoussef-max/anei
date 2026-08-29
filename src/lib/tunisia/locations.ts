/**
 * Static Tunisia administrative division dataset (governorates + delegations).
 *
 * Source: governorate/delegation names compiled from the public reference
 * "List-of-Tunisian-Governorates-and-Delegations-and-Municipality" dataset
 * (24 governorates / 263 delegations, French spelling), cross-checked
 * against the governorate name list already used by
 * src/server/auth/profile.ts (TUNISIA_GOVERNORATES) so stored values never
 * diverge from existing validation/DB rows.
 *
 * Governorate `code` values are the official ISO 3166-2:TN subdivision
 * codes (ISO 3166-2 Newsletter II-3, 2011-12-15; Tunisian Décret n°83-1255).
 * Delegation `code` values are NOT an official numeric code (none was
 * available in the source dataset) - they are a stable, deterministic slug
 * derived from the governorate ISO code + delegation name
 * (e.g. "TN-12-ARIANA-MEDINA"), safe to persist/reference since governorate
 * codes and delegation names do not change casually.
 *
 * Dataset version: compiled 2026-08-29. No runtime network dependency -
 * this file is the single source of truth at build/runtime.
 */

export type TunisiaDelegation = {
  code: string;
  nameFr: string;
  nameAr?: string;
};

export type TunisiaGovernorate = {
  code: string;
  nameFr: string;
  nameAr?: string;
  delegations: TunisiaDelegation[];
};

export const TUNISIA_LOCATIONS: TunisiaGovernorate[] = [
  {
    code: "TN-12",
    nameFr: "Ariana",
    delegations: [
      { code: "TN-12-ARIANA-MEDINA", nameFr: "Ariana Medina" },
      { code: "TN-12-ETTADHAMEN", nameFr: "Ettadhamen" },
      { code: "TN-12-KALAAT-EL-ANDALOUS", nameFr: "Kalaat el Andalous" },
      { code: "TN-12-MNIHLA", nameFr: "Mnihla" },
      { code: "TN-12-RAOUED", nameFr: "Raoued" },
      { code: "TN-12-SIDI-THABET", nameFr: "Sidi Thabet" },
      { code: "TN-12-SOUKRA", nameFr: "Soukra" },
    ],
  },
  {
    code: "TN-31",
    nameFr: "Béja",
    delegations: [
      { code: "TN-31-AMDOUN", nameFr: "Amdoun" },
      { code: "TN-31-BEJA-NORD", nameFr: "Béja Nord" },
      { code: "TN-31-BEJA-SUD", nameFr: "Béja Sud" },
      { code: "TN-31-GOUBELLAT", nameFr: "Goubellat" },
      { code: "TN-31-MEDJEZ-EL-BAB", nameFr: "Medjez El Bab" },
      { code: "TN-31-NEFZA", nameFr: "Nefza" },
      { code: "TN-31-TEBOURSOUK", nameFr: "Teboursouk" },
      { code: "TN-31-TESTOUR", nameFr: "Testour" },
      { code: "TN-31-TIBAR", nameFr: "Tibar" },
    ],
  },
  {
    code: "TN-13",
    nameFr: "Ben Arous",
    delegations: [
      { code: "TN-13-BEN-AROUS", nameFr: "Ben Arous" },
      { code: "TN-13-BOU-MHEL-EL-BASSATINE", nameFr: "Bou Mhel El Bassatine" },
      { code: "TN-13-EL-MOUROUJ", nameFr: "El Mourouj" },
      { code: "TN-13-EZZAHRA", nameFr: "Ezzahra" },
      { code: "TN-13-FOUCHANA", nameFr: "Fouchana" },
      { code: "TN-13-HAMMAM-CHOTT", nameFr: "Hammam Chôtt" },
      { code: "TN-13-HAMMAM-LIF", nameFr: "Hammam Lif" },
      { code: "TN-13-LA-NOUVELLE-MEDINA", nameFr: "La Nouvelle Medina" },
      { code: "TN-13-MEGRINE", nameFr: "Megrine" },
      { code: "TN-13-MOHAMEDIA", nameFr: "Mohamedia" },
      { code: "TN-13-MORNAG", nameFr: "Mornag" },
      { code: "TN-13-RADES", nameFr: "Radès" },
    ],
  },
  {
    code: "TN-23",
    nameFr: "Bizerte",
    delegations: [
      { code: "TN-23-BIZERTE-NORD", nameFr: "Bizerte Nord" },
      { code: "TN-23-BIZERTE-SUD", nameFr: "Bizerte Sud" },
      { code: "TN-23-DJOUMINE", nameFr: "Djoumine" },
      { code: "TN-23-EL-ALIA", nameFr: "El Alia" },
      { code: "TN-23-GHAR-EL-MELH", nameFr: "Ghar El Melh" },
      { code: "TN-23-GHEZALA", nameFr: "Ghezala" },
      { code: "TN-23-MATEUR", nameFr: "Mateur" },
      { code: "TN-23-MENZEL-BOURGUIBA", nameFr: "Menzel Bourguiba" },
      { code: "TN-23-MENZEL-JEMIL", nameFr: "Menzel Jemil" },
      { code: "TN-23-RAS-JABEL", nameFr: "Ras Jabel" },
      { code: "TN-23-SEJENANE", nameFr: "Sejenane" },
      { code: "TN-23-TINJA", nameFr: "Tinja" },
      { code: "TN-23-UTIQUE", nameFr: "Utique" },
      { code: "TN-23-ZARZOUNA", nameFr: "Zarzouna" },
    ],
  },
  {
    code: "TN-81",
    nameFr: "Gabès",
    delegations: [
      { code: "TN-81-EL-HAMMA", nameFr: "El Hamma" },
      { code: "TN-81-EL-METOUIA", nameFr: "El Metouia" },
      { code: "TN-81-GABES-MEDINA", nameFr: "Gabes Medina" },
      { code: "TN-81-GABES-OUEST", nameFr: "Gabes Ouest" },
      { code: "TN-81-GABES-SUD", nameFr: "Gabes Sud" },
      { code: "TN-81-GHANNOUCH", nameFr: "Ghannouch" },
      { code: "TN-81-MARETH", nameFr: "Mareth" },
      { code: "TN-81-MATMATA", nameFr: "Matmata" },
      { code: "TN-81-MENZEL-EL-HABIB", nameFr: "Menzel El Habib" },
      { code: "TN-81-NOUVELLE-MATMATA", nameFr: "Nouvelle Matmata" },
    ],
  },
  {
    code: "TN-71",
    nameFr: "Gafsa",
    delegations: [
      { code: "TN-71-BELKHIR", nameFr: "Belkhir" },
      { code: "TN-71-EL-GUETAR", nameFr: "El Guetar" },
      { code: "TN-71-EL-KSAR", nameFr: "El Ksar" },
      { code: "TN-71-GAFSA-NORD", nameFr: "Gafsa Nord" },
      { code: "TN-71-GAFSA-SUD", nameFr: "Gafsa Sud" },
      { code: "TN-71-MDHILLA", nameFr: "Mdhilla" },
      { code: "TN-71-METLAOUI", nameFr: "Metlaoui" },
      { code: "TN-71-OUM-EL-ARAIES", nameFr: "Oum El Araies" },
      { code: "TN-71-REDEYEF", nameFr: "Redeyef" },
      { code: "TN-71-SIDI-AICH", nameFr: "Sidi Aïch" },
      { code: "TN-71-SNED", nameFr: "Sned" },
    ],
  },
  {
    code: "TN-32",
    nameFr: "Jendouba",
    delegations: [
      { code: "TN-32-AIN-DRAHAM", nameFr: "Aïn Draham" },
      { code: "TN-32-BALTA-BOU-AOUANE", nameFr: "Balta-Bou Aouane" },
      { code: "TN-32-BOU-SALEM", nameFr: "Bou Salem" },
      { code: "TN-32-FERNANA", nameFr: "Fernana" },
      { code: "TN-32-GHARDIMAOU", nameFr: "Ghardimaou" },
      { code: "TN-32-JENDOUBA-NORD", nameFr: "Jendouba Nord" },
      { code: "TN-32-JENDOUBA-SUD", nameFr: "Jendouba Sud" },
      { code: "TN-32-OUED-MELIZ", nameFr: "Oued Meliz" },
      { code: "TN-32-TABARKA", nameFr: "Tabarka" },
    ],
  },
  {
    code: "TN-41",
    nameFr: "Kairouan",
    delegations: [
      { code: "TN-41-ALAA", nameFr: "Alaâ" },
      { code: "TN-41-BOU-HAJLA", nameFr: "Bou Hajla" },
      { code: "TN-41-CHEBIKA", nameFr: "Chebika" },
      { code: "TN-41-ECHRARDA", nameFr: "Echrarda" },
      { code: "TN-41-HAFFOUZ", nameFr: "Haffouz" },
      { code: "TN-41-HAJEB-EL-AYOUN", nameFr: "Hajeb El Ayoun" },
      { code: "TN-41-KAIROUAN-NORD", nameFr: "Kairouan Nord" },
      { code: "TN-41-KAIROUAN-SUD", nameFr: "Kairouan Sud" },
      { code: "TN-41-NASRALLAH", nameFr: "Nasrallah" },
      { code: "TN-41-OUESLATIA", nameFr: "Oueslatia" },
      { code: "TN-41-SBIKHA", nameFr: "Sbikha" },
    ],
  },
  {
    code: "TN-42",
    nameFr: "Kasserine",
    delegations: [
      { code: "TN-42-EL-AYOUN", nameFr: "El Ayoun" },
      { code: "TN-42-EZZOUHOUR", nameFr: "Ezzouhour" },
      { code: "TN-42-FOUSSANA", nameFr: "Foussana" },
      { code: "TN-42-FERIANA", nameFr: "Fériana" },
      { code: "TN-42-HASSI-EL-FERID", nameFr: "Hassi El Ferid" },
      { code: "TN-42-HAIDRA", nameFr: "Haïdra" },
      { code: "TN-42-JEDELIENNE", nameFr: "Jedelienne" },
      { code: "TN-42-KASSERINE-NORD", nameFr: "Kasserine Nord" },
      { code: "TN-42-KASSERINE-SUD", nameFr: "Kasserine Sud" },
      { code: "TN-42-MAJEL-BEL-ABBES", nameFr: "Majel Bel Abbès" },
      { code: "TN-42-SBEITLA", nameFr: "Sbeïtla" },
      { code: "TN-42-SBIBA", nameFr: "Sbiba" },
      { code: "TN-42-THALA", nameFr: "Thala" },
    ],
  },
  {
    code: "TN-73",
    nameFr: "Kébili",
    delegations: [
      { code: "TN-73-DOUZ-NORTH", nameFr: "Douz North" },
      { code: "TN-73-DOUZ-SOUTH", nameFr: "Douz South" },
      { code: "TN-73-FAOUAR", nameFr: "Faouar" },
      { code: "TN-73-KEBILI-NORTH", nameFr: "Kebili North" },
      { code: "TN-73-KEBILI-SOUTH", nameFr: "Kebili South" },
      { code: "TN-73-SOUK-EL-AHED", nameFr: "Souk El Ahed" },
    ],
  },
  {
    code: "TN-33",
    nameFr: "Le Kef",
    delegations: [
      { code: "TN-33-DAHMANI", nameFr: "Dahmani" },
      { code: "TN-33-EL-KSOUR", nameFr: "El Ksour" },
      { code: "TN-33-JERISSA", nameFr: "Jérissa" },
      { code: "TN-33-KALAAT-SENAN", nameFr: "Kalaat Senan" },
      { code: "TN-33-KALAAT-KHASBA", nameFr: "Kalâat Khasba" },
      { code: "TN-33-KEF-EST", nameFr: "Kef Est" },
      { code: "TN-33-KEF-OUEST", nameFr: "Kef Ouest" },
      { code: "TN-33-NEBEUR", nameFr: "Nebeur" },
      { code: "TN-33-SAKIET-SIDI-YOUSSEF", nameFr: "Sakiet Sidi Youssef" },
      { code: "TN-33-SERS", nameFr: "Sers" },
      { code: "TN-33-TAJEROUINE", nameFr: "Tajerouine" },
    ],
  },
  {
    code: "TN-53",
    nameFr: "Mahdia",
    delegations: [
      { code: "TN-53-BOU-MERDES", nameFr: "Bou Merdès" },
      { code: "TN-53-CHEBBA", nameFr: "Chebba" },
      { code: "TN-53-CHORBANE", nameFr: "Chorbane" },
      { code: "TN-53-EL-DJEM", nameFr: "El Djem" },
      { code: "TN-53-ESSOUASSI", nameFr: "Essouassi" },
      { code: "TN-53-HEBIRA", nameFr: "Hebira" },
      { code: "TN-53-KSOUR-ESSEF", nameFr: "Ksour Essef" },
      { code: "TN-53-MAHDIA", nameFr: "Mahdia" },
      { code: "TN-53-MELLOULECHE", nameFr: "Melloulèche" },
      { code: "TN-53-OULED-CHAMEKH", nameFr: "Ouled Chamekh" },
      { code: "TN-53-SIDI-ALOUANE", nameFr: "Sidi Alouane" },
    ],
  },
  {
    code: "TN-14",
    nameFr: "La Manouba",
    delegations: [
      { code: "TN-14-BORJ-EL-AMRI", nameFr: "Borj El Amri" },
      { code: "TN-14-DJEDEIDA", nameFr: "Djedeida" },
      { code: "TN-14-DOUAR-HICHER", nameFr: "Douar Hicher" },
      { code: "TN-14-EL-BATTAN", nameFr: "El Battan" },
      { code: "TN-14-MANOUBA", nameFr: "Manouba" },
      { code: "TN-14-MORNAGUIA", nameFr: "Mornaguia" },
      { code: "TN-14-OUED-ELLIL", nameFr: "Oued Ellil" },
      { code: "TN-14-TEBOURBA", nameFr: "Tebourba" },
    ],
  },
  {
    code: "TN-82",
    nameFr: "Médenine",
    delegations: [
      { code: "TN-82-BEN-GUERDANE", nameFr: "Ben Guerdane" },
      { code: "TN-82-BENI-KHEDECH", nameFr: "Beni Khedech" },
      { code: "TN-82-DJERBA-AJIM", nameFr: "Djerba Ajim" },
      { code: "TN-82-DJERBA-HOUMET-SOUK", nameFr: "Djerba Houmet Souk" },
      { code: "TN-82-DJERBA-MIDOUN", nameFr: "Djerba Midoun" },
      { code: "TN-82-MEDENINE-NORD", nameFr: "Médenine Nord" },
      { code: "TN-82-MEDENINE-SUR", nameFr: "Médenine Sur" },
      { code: "TN-82-SIDI-MAKHLOULF", nameFr: "Sidi Makhloulf" },
      { code: "TN-82-ZARZIS", nameFr: "Zarzis" },
    ],
  },
  {
    code: "TN-52",
    nameFr: "Monastir",
    delegations: [
      { code: "TN-52-BEKALTA", nameFr: "Bekalta" },
      { code: "TN-52-BEMBLA", nameFr: "Bembla" },
      { code: "TN-52-BENI-HASSEN", nameFr: "Beni Hassen" },
      { code: "TN-52-JEMMAL", nameFr: "Jemmal" },
      { code: "TN-52-KSAR-HELLAL", nameFr: "Ksar Hellal" },
      { code: "TN-52-KSIBET-EL-MEDIOUNI", nameFr: "Ksibet el-Médiouni" },
      { code: "TN-52-MOKNINE", nameFr: "Moknine" },
      { code: "TN-52-MONASTIR", nameFr: "Monastir" },
      { code: "TN-52-OUERDANINE", nameFr: "Ouerdanine" },
      { code: "TN-52-SAHLINE", nameFr: "Sahline" },
      { code: "TN-52-SAYADA-LAMTA-BOU-HAJAR", nameFr: "Sayada-Lamta-Bou Hajar" },
      { code: "TN-52-TEBOULBA", nameFr: "Téboulba" },
      { code: "TN-52-ZERAMDINE", nameFr: "Zéramdine" },
    ],
  },
  {
    code: "TN-21",
    nameFr: "Nabeul",
    delegations: [
      { code: "TN-21-BOU-ARGOUB", nameFr: "Bou Argoub" },
      { code: "TN-21-BENI-KHALLED", nameFr: "Béni Khalled" },
      { code: "TN-21-BENI-KHIAR", nameFr: "Béni Khiar" },
      { code: "TN-21-DAR-CHAABANE-EL-FEHRI", nameFr: "Dar Châabane El Fehri" },
      { code: "TN-21-EL-HAOUARIA", nameFr: "El Haouaria" },
      { code: "TN-21-EL-MIDA", nameFr: "El Mida" },
      { code: "TN-21-GROMBALIA", nameFr: "Grombalia" },
      { code: "TN-21-HAMMAM-EL-GUEZAZ", nameFr: "Hammam El Guezaz" },
      { code: "TN-21-HAMMAMET", nameFr: "Hammamet" },
      { code: "TN-21-KORBA", nameFr: "Korba" },
      { code: "TN-21-KELIBIA", nameFr: "Kélibia" },
      { code: "TN-21-MENZEL-BOUZELFA", nameFr: "Menzel Bouzelfa" },
      { code: "TN-21-MENZEL-TEMIME", nameFr: "Menzel Temime" },
      { code: "TN-21-NABEUL", nameFr: "Nabeul" },
      { code: "TN-21-SOLIMAN", nameFr: "Soliman" },
      { code: "TN-21-TAKELSA", nameFr: "Takelsa" },
    ],
  },
  {
    code: "TN-61",
    nameFr: "Sfax",
    delegations: [
      { code: "TN-61-AGAREB", nameFr: "Agareb" },
      { code: "TN-61-BIR-ALI-BEN-KHALIFA", nameFr: "Bir Ali Ben Khalifa" },
      { code: "TN-61-EL-AMRA", nameFr: "El Amra" },
      { code: "TN-61-EL-HENCHA", nameFr: "El Hencha" },
      { code: "TN-61-GRAIBA", nameFr: "Graïba" },
      { code: "TN-61-JEBINIANA", nameFr: "Jebiniana" },
      { code: "TN-61-KERKENNAH", nameFr: "Kerkennah" },
      { code: "TN-61-MAHRES", nameFr: "Mahrès" },
      { code: "TN-61-MENZEL-CHAKER", nameFr: "Menzel Chaker" },
      { code: "TN-61-SAKIET-EDDAIER", nameFr: "Sakiet Eddaïer" },
      { code: "TN-61-SAKIET-EZZIT", nameFr: "Sakiet Ezzit" },
      { code: "TN-61-SFAX-OUEST", nameFr: "Sfax Ouest" },
      { code: "TN-61-SFAX-SUD", nameFr: "Sfax Sud" },
      { code: "TN-61-SFAX-VILLE", nameFr: "Sfax Ville" },
      { code: "TN-61-SKHIRA", nameFr: "Skhira" },
      { code: "TN-61-THYNA", nameFr: "Thyna" },
    ],
  },
  {
    code: "TN-43",
    nameFr: "Sidi Bouzid",
    delegations: [
      { code: "TN-43-BIR-EL-HAFEY", nameFr: "Bir El Hafey" },
      { code: "TN-43-CEBBALA-OULED-ASKER", nameFr: "Cebbala Ouled Asker" },
      { code: "TN-43-JILMA", nameFr: "Jilma" },
      { code: "TN-43-MEKNASSY", nameFr: "Meknassy" },
      { code: "TN-43-MENZEL-BOUZAIANE", nameFr: "Menzel Bouzaiane" },
      { code: "TN-43-MEZZOUNA", nameFr: "Mezzouna" },
      { code: "TN-43-OULED-HAFFOUZ", nameFr: "Ouled Haffouz" },
      { code: "TN-43-REGUEB", nameFr: "Regueb" },
      { code: "TN-43-SIDI-ALI-BEN-AOUN", nameFr: "Sidi Ali Ben Aoun" },
      { code: "TN-43-SIDI-BOUZID-EST", nameFr: "Sidi Bouzid Est" },
      { code: "TN-43-SIDI-BOUZID-OUEST", nameFr: "Sidi Bouzid Ouest" },
      { code: "TN-43-SOUK-JEDID", nameFr: "Souk Jedid" },
    ],
  },
  {
    code: "TN-34",
    nameFr: "Siliana",
    delegations: [
      { code: "TN-34-BARGOU", nameFr: "Bargou" },
      { code: "TN-34-BOU-ARADA", nameFr: "Bou Arada" },
      { code: "TN-34-EL-AROUSSA", nameFr: "El Aroussa" },
      { code: "TN-34-EL-KRIB", nameFr: "El Krib" },
      { code: "TN-34-GAAFOUR", nameFr: "Gaâfour" },
      { code: "TN-34-KESRA", nameFr: "Kesra" },
      { code: "TN-34-MAKTHAR", nameFr: "Makthar" },
      { code: "TN-34-ROUHIA", nameFr: "Rouhia" },
      { code: "TN-34-SIDI-BOU-ROUIS", nameFr: "Sidi Bou Rouis" },
      { code: "TN-34-SILIANA-NORD", nameFr: "Siliana Nord" },
      { code: "TN-34-SILIANA-SUD", nameFr: "Siliana Sud" },
    ],
  },
  {
    code: "TN-51",
    nameFr: "Sousse",
    delegations: [
      { code: "TN-51-AKOUDA", nameFr: "Akouda" },
      { code: "TN-51-BOUFICHA", nameFr: "Bouficha" },
      { code: "TN-51-ENFIDA", nameFr: "Enfida" },
      { code: "TN-51-HAMMAM-SOUSSE", nameFr: "Hammam Sousse" },
      { code: "TN-51-HERGLA", nameFr: "Hergla" },
      { code: "TN-51-KALAA-KEBIRA", nameFr: "Kalâa Kebira" },
      { code: "TN-51-KALAA-SEGHIRA", nameFr: "Kalâa Seghira" },
      { code: "TN-51-KONDAR", nameFr: "Kondar" },
      { code: "TN-51-M-SAKEN", nameFr: "M'saken" },
      { code: "TN-51-SIDI-BOU-ALI", nameFr: "Sidi Bou Ali" },
      { code: "TN-51-SIDI-EL-HANI", nameFr: "Sidi El Hani" },
      { code: "TN-51-SOUSSE-JAWHARA", nameFr: "Sousse Jawhara" },
      { code: "TN-51-SOUSSE-MEDINA", nameFr: "Sousse Médina" },
      { code: "TN-51-SOUSSE-RIADH", nameFr: "Sousse Riadh" },
      { code: "TN-51-SOUSSE-SIDI-ABDELHAMID", nameFr: "Sousse Sidi Abdelhamid" },
    ],
  },
  {
    code: "TN-83",
    nameFr: "Tataouine",
    delegations: [
      { code: "TN-83-BIR-LAHMAR", nameFr: "Bir Lahmar" },
      { code: "TN-83-DEHIBA", nameFr: "Dehiba" },
      { code: "TN-83-GHOMRASSEN", nameFr: "Ghomrassen" },
      { code: "TN-83-REMADA", nameFr: "Remada" },
      { code: "TN-83-SMAR", nameFr: "Smâr" },
      { code: "TN-83-TATAOUINE-NORD", nameFr: "Tataouine Nord" },
      { code: "TN-83-TATAOUINE-SUD", nameFr: "Tataouine Sud" },
    ],
  },
  {
    code: "TN-72",
    nameFr: "Tozeur",
    delegations: [
      { code: "TN-72-DEGACHE", nameFr: "Degache" },
      { code: "TN-72-HAZOUA", nameFr: "Hazoua" },
      { code: "TN-72-NEFTA", nameFr: "Nefta" },
      { code: "TN-72-TAMEGHZA", nameFr: "Tameghza" },
      { code: "TN-72-TOZEUR", nameFr: "Tozeur" },
    ],
  },
  {
    code: "TN-11",
    nameFr: "Tunis",
    delegations: [
      { code: "TN-11-BAB-EL-BHAR", nameFr: "Bab El Bhar" },
      { code: "TN-11-BAB-SOUIKA", nameFr: "Bab Souika" },
      { code: "TN-11-CARTHAGE", nameFr: "Carthage" },
      { code: "TN-11-CITE-EL-KHADRA", nameFr: "Cité El Khadra" },
      { code: "TN-11-DJEBEL-JELLOUD", nameFr: "Djebel Jelloud" },
      { code: "TN-11-EL-KABARIA", nameFr: "El Kabaria" },
      { code: "TN-11-EL-MENZAH", nameFr: "El Menzah" },
      { code: "TN-11-EL-OMRANE", nameFr: "El Omrane" },
      { code: "TN-11-EL-OMRANE-SUPERIEUR", nameFr: "El Omrane supérieur" },
      { code: "TN-11-EL-OUARDIA", nameFr: "El Ouardia" },
      { code: "TN-11-ETTAHRIR", nameFr: "Ettahrir" },
      { code: "TN-11-EZZOUHOUR", nameFr: "Ezzouhour" },
      { code: "TN-11-HRAIRIA", nameFr: "Hraïria" },
      { code: "TN-11-LA-GOULETTE", nameFr: "La Goulette" },
      { code: "TN-11-LA-MARSA", nameFr: "La Marsa" },
      { code: "TN-11-LE-BARDO", nameFr: "Le Bardo" },
      { code: "TN-11-LE-KRAM", nameFr: "Le Kram" },
      { code: "TN-11-MEDINA", nameFr: "Médina" },
      { code: "TN-11-SIDI-EL-BECHIR", nameFr: "Sidi El Béchir" },
      { code: "TN-11-SIDI-HASSINE", nameFr: "Sidi Hassine" },
      { code: "TN-11-SEJOUMI", nameFr: "Séjoumi" },
    ],
  },
  {
    code: "TN-22",
    nameFr: "Zaghouan",
    delegations: [
      { code: "TN-22-BIR-MCHERGA", nameFr: "Bir Mcherga" },
      { code: "TN-22-EL-FAHS", nameFr: "El Fahs" },
      { code: "TN-22-NADHOUR", nameFr: "Nadhour" },
      { code: "TN-22-SAOUAF", nameFr: "Saouaf" },
      { code: "TN-22-ZAGHOUAN", nameFr: "Zaghouan" },
      { code: "TN-22-ZRIBA", nameFr: "Zriba" },
    ],
  },
];

export const TUNISIA_GOVERNORATE_NAMES = TUNISIA_LOCATIONS.map((g) => g.nameFr);

const delegationsByGovernorate = new Map<string, TunisiaDelegation[]>(
  TUNISIA_LOCATIONS.map((g) => [g.nameFr, g.delegations]),
);

/** Delegations for a given governorate (by nameFr), or an empty array if the governorate is unknown/not yet selected. */
export function getDelegationsForGovernorate(governorateName: string): TunisiaDelegation[] {
  return delegationsByGovernorate.get(governorateName) ?? [];
}

/** Authoritative check that a governorate/delegation pair is a real administrative relationship - used both client-side and as the basis for server-side validation. */
export function isValidGovernorateDelegation(governorateName: string, delegationName: string): boolean {
  const delegations = delegationsByGovernorate.get(governorateName);
  if (!delegations) return false;
  return delegations.some((d) => d.nameFr === delegationName);
}
