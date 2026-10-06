import { NextResponse } from "next/server";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getMarketingAudienceForExport } from "@/modules/admin/queries/admin-analytics";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET() {
  const session = await getAdminSessionFor("overview.read");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rows = await getMarketingAudienceForExport(10000);

  const headers = [
    "ID",
    "Nom",
    "Email",
    "Téléphone",
    "Téléphone vérifié",
    "Email vérifié",
    "Gouvernorat",
    "Ville",
    "Persona",
    "Niveau études",
    "Formations inscrites",
    "Certificats",
    "Code Parrain",
    "Date inscription",
    "Dernière activité",
    "Statut",
  ];

  const lines = [headers.map(escapeCsv).join(",")];

  for (const r of rows) {
    lines.push([
      escapeCsv(r.id),
      escapeCsv(r.name),
      escapeCsv(r.email),
      escapeCsv(r.phoneNumber || ""),
      escapeCsv(r.phoneVerified ? "OUI" : "NON"),
      escapeCsv(r.emailVerified ? "OUI" : "NON"),
      escapeCsv(r.governorate),
      escapeCsv(r.city || ""),
      escapeCsv(r.persona),
      escapeCsv(r.educationLevel),
      escapeCsv(r.enrollmentsCount),
      escapeCsv(r.certsCount),
      escapeCsv(r.referredByCode || "DIRECT"),
      escapeCsv(r.joinedAt.toISOString().slice(0, 10)),
      escapeCsv(r.lastActive ? r.lastActive.toISOString().slice(0, 10) : "Jamais"),
      escapeCsv(r.status),
    ].join(","));
  }

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const filename = `anei-marketing-audience-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
