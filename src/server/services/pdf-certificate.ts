/**
 * ANEI Platform — High-Resolution Vector PDF Certificate Generator
 * Produces byte-perfect, print-ready PDF 1.4 documents for certified learners.
 * Zero external runtime dependencies, instantaneous generation, 100% serverless/Node safe.
 */

export type CertificatePdfData = {
  studentName: string;
  courseTitle: string;
  courseCategory?: string;
  certificateCode: string;
  issuedAt: Date;
  locale?: string;
  verificationUrl?: string;
};

function sanitizePdfText(str: string): string {
  // Transliterate common accented/special characters to ASCII-safe glyphs for Standard PDF Type1 fonts
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .trim();
}

/**
 * Builds an official A4 Landscape (842 x 595 pt) ANEI Certificate PDF.
 */
export function generateCertificatePdf(data: CertificatePdfData): Buffer {
  const width = 842;
  const height = 595;

  const studentName = sanitizePdfText(data.studentName || "Apprenant ANEI");
  const courseTitle = sanitizePdfText(data.courseTitle || "Formation Professionnelle Inclusive");
  const code = sanitizePdfText(data.certificateCode);
  const dateStr = data.issuedAt.toLocaleDateString("fr-TN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sanitizedDate = sanitizePdfText(dateStr);
  const verifyUrl = sanitizePdfText(
    data.verificationUrl || `https://platform.anei.tn/fr/certificats/${data.certificateCode}`
  );

  // Helper to approximate text width for centering (average char width ~ 0.52 * fontSize)
  function textX(text: string, fontSize: number, centerTarget: number = width / 2): number {
    const approxWidth = text.length * fontSize * 0.52;
    return Math.max(40, Math.round(centerTarget - approxWidth / 2));
  }

  const streamLines: string[] = [
    "q",
    // 1. Background Cream Surface (#FCFBF8)
    "0.988 0.984 0.973 rg",
    `0 0 ${width} ${height} re f`,

    // 2. Outer Deep Navy Border (#082D55)
    "0.031 0.176 0.333 RG",
    "3.5 w",
    "24 24 794 547 re S",

    // 3. Inner Gold Accent Border (#C9913F)
    "0.788 0.569 0.247 RG",
    "1.5 w",
    "32 32 778 531 re S",

    // 4. Subtle Thin Guilloche Framing (#E7E0D3)
    "0.906 0.878 0.827 RG",
    "0.75 w",
    "37 37 768 521 re S",

    // Corner decorative rosettes (L-brackets)
    "0.788 0.569 0.247 RG",
    "2 w",
    // Top-Left corner flourish
    "30 550 m 55 550 l 55 525 l S",
    // Top-Right corner flourish
    "812 550 m 787 550 l 787 525 l S",
    // Bottom-Left corner flourish
    "30 45 m 55 45 l 55 70 l S",
    // Bottom-Right corner flourish
    "812 45 m 787 45 l 787 70 l S",

    // 5. Central Watermark Seal Accent (Concentric Circles)
    "0.95 0.92 0.86 RG",
    "0.5 w",
    `421 297 140 0 360 arc S`,
    `421 297 125 0 360 arc S`,

    // 6. Typography & Text Content
    "BT",

    // Country Header
    `/F1 10 Tf 0.45 0.40 0.32 rg ${textX("REPUBLIQUE TUNISIENNE", 10)} 528 Td (REPUBLIQUE TUNISIENNE) Tj ET`,

    // Academy Institutional Name
    `BT /F2 19 Tf 0.031 0.176 0.333 rg ${textX("ACADEMIE NATIONALE DE L'EDUCATION INCLUSIVE", 19)} 502 Td (ACADEMIE NATIONALE DE L'EDUCATION INCLUSIVE) Tj ET`,

    // Gold Institutional Sub-Rule
    "0.788 0.569 0.247 RG 1 w 320 488 m 522 488 l S",

    // Main Certificate Header
    `BT /F2 13 Tf 0.788 0.569 0.247 rg ${textX("CERTIFICAT DE REUSSITE & ATTESTATION OFFICIELLE", 13)} 466 Td (CERTIFICAT DE REUSSITE & ATTESTATION OFFICIELLE) Tj ET`,

    // Preamble
    `BT /F1 11 Tf 0.35 0.32 0.26 rg ${textX("Le conseil pedagogique de l'Academie certifie solennellement que :", 11)} 434 Td (Le conseil pedagogique de l'Academie certifie solennellement que :) Tj ET`,

    // Student Recipient Name (Prominent Navy Heading)
    `BT /F2 26 Tf 0.031 0.176 0.333 rg ${textX(studentName, 26)} 394 Td (${studentName}) Tj ET`,

    // Supporting Context Text
    `BT /F1 11 Tf 0.35 0.32 0.26 rg ${textX("a valide l'ensemble des modules, travaux pratiques et evaluations du parcours de formation :", 11)} 358 Td (a valide l'ensemble des modules, travaux pratiques et evaluations du parcours de formation :) Tj ET`,

    // Course Title (Highlighted in Warm Gold / Deep Navy)
    `BT /F2 17 Tf 0.788 0.569 0.247 rg ${textX(courseTitle, 17)} 326 Td (${courseTitle}) Tj ET`,

    // Divider Line
    "0.88 0.85 0.78 RG 0.5 w 180 298 m 662 298 l S",

    // Competencies / Level Summary
    `BT /F1 10 Tf 0.45 0.40 0.32 rg ${textX("Formation certifiante professionnelle conforme aux standards d'inclusion et d'accessibilite ANEI", 10)} 280 Td (Formation certifiante professionnelle conforme aux standards d'inclusion et d'accessibilite ANEI) Tj ET`,

    // Bottom Metadata Card (Left: Issue Date, Right: Unique Code)
    `BT /F1 10 Tf 0.3 0.3 0.3 rg 90 195 Td (Date de delivrance :) Tj ET`,
    `BT /F2 10 Tf 0.031 0.176 0.333 rg 195 195 Td (${sanitizedDate}) Tj ET`,

    `BT /F1 10 Tf 0.3 0.3 0.3 rg 90 178 Td (Numero d'enregistrement :) Tj ET`,
    `BT /F2 10 Tf 0.788 0.569 0.247 rg 220 178 Td (${code}) Tj ET`,

    `BT /F1 9 Tf 0.48 0.48 0.48 rg 90 160 Td (Verification publique en ligne :) Tj ET`,
    `BT /F1 8.5 Tf 0.031 0.176 0.333 rg 90 146 Td (${verifyUrl}) Tj ET`,

    // Signatures Section (Two Pillars with Seals)
    // Left: Pedagogical Director
    "0.031 0.176 0.333 RG 0.75 w 490 172 m 625 172 l S",
    `BT /F2 9.5 Tf 0.031 0.176 0.333 rg 495 158 Td (Direction Pedagogique) Tj ET`,
    `BT /F1 8.5 Tf 0.45 0.42 0.35 rg 505 144 Td (Dr. Hadia Cherif) Tj ET`,

    // Right: Academy President
    "0.031 0.176 0.333 RG 0.75 w 665 172 m 800 172 l S",
    `BT /F2 9.5 Tf 0.031 0.176 0.333 rg 670 158 Td (Presidence de l'Academie) Tj ET`,
    `BT /F1 8.5 Tf 0.45 0.42 0.35 rg 680 144 Td (Dr. Anis Ben Salem) Tj ET`,

    // Institutional Seal Stamp Emblem Vector
    "0.788 0.569 0.247 RG 1 w 732 102 24 0 360 arc S",
    `BT /F2 6 Tf 0.788 0.569 0.247 rg 720 100 Td (ANEI SCEAU) Tj ET`,

    // Security Footer Legal Notice
    `BT /F1 7.5 Tf 0.55 0.55 0.55 rg ${textX("Ce document numerique fait foi de certification professionnelle conformement aux registres d'habilitation ANEI.", 7.5)} 55 Td (Ce document numerique fait foi de certification professionnelle conformement aux registres d'habilitation ANEI.) Tj ET`,

    "Q",
  ];

  const contentStream = streamLines.join("\n");
  const streamLength = Buffer.byteLength(contentStream);

  const objects: string[] = [];
  function add(obj: string): number {
    objects.push(obj);
    return objects.length;
  }

  // 1: Catalog
  add("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages Root
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // 3: Single Page (Landscape A4: 842 x 595)
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`
  );
  // 4: Content Stream
  add(`<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`);
  // 5: Font F1 (Helvetica Normal)
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  // 6: Font F2 (Helvetica Bold)
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  let pdfString = "%PDF-1.4\n";
  const xrefTable: number[] = [0];
  let currentOffset = Buffer.byteLength(pdfString);

  for (let i = 0; i < objects.length; i++) {
    xrefTable.push(currentOffset);
    const objBlock = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    pdfString += objBlock;
    currentOffset += Buffer.byteLength(objBlock);
  }

  const startXref = currentOffset;
  pdfString += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfString += `${String(xrefTable[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return Buffer.from(pdfString);
}
