export default function LocaleLoading() {
  return (
    <section className="section" aria-busy="true" aria-label="Chargement">
      <div className="container skeleton-stack">
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-copy" />
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => <div className="skeleton skeleton-card" key={index} />)}
        </div>
      </div>
    </section>
  );
}
