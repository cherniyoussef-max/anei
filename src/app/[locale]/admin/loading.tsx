export default function AdminLoading() {
  return (
    <div className="admin-page-skeleton" aria-busy="true" aria-label="Chargement">
      <span className="admin-page-skeleton-header" />
      <div className="admin-page-skeleton-kpis"><span /><span /><span /><span /></div>
      <span className="admin-page-skeleton-block" />
    </div>
  );
}
