"use client";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="status-page" role="alert">
      <div className="status-card failure">
        <div className="status-icon" aria-hidden="true">!</div>
        <h1>Une erreur est survenue</h1>
        <p>Le service n’a pas pu terminer cette action. Réessayez sans perdre votre session.</p>
        <button className="btn btn-primary" type="button" onClick={reset}>Réessayer</button>
      </div>
    </section>
  );
}
