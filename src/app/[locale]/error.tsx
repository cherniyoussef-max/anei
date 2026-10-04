"use client";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("LocaleError caught error:", error);
  return (
    <section className="status-page" role="alert">
      <div className="status-card failure">
        <div className="status-icon" aria-hidden="true">!</div>
        <h1>Une erreur est survenue</h1>
        <p>Le service n’a pas pu terminer cette action. Réessayez sans perdre votre session.</p>
        {process.env.NODE_ENV !== "production" && error?.message ? (
          <pre className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2 max-w-lg overflow-auto">
            {error.message}
            {error.stack ? `\n${error.stack}` : ""}
          </pre>
        ) : null}
        <button className="btn btn-primary" type="button" onClick={reset}>Réessayer</button>
      </div>
    </section>
  );
}
