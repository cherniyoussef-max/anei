import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <strong style={{ color: "#1368e8" }}>404</strong>
        <h1>Page introuvable</h1>
        <p style={{ color: "#617089" }}>La page demandée n’existe pas ou a été déplacée.</p>
        <Link className="btn btn-primary" href="/fr">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
