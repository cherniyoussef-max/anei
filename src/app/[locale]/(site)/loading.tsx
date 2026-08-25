export default function PublicRouteLoading() {
  return (
    <div className="public-route-loading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="public-route-loading-bar" aria-hidden="true" />
      <div className="v5-container public-route-loading-shell" aria-hidden="true">
        <span />
        <strong />
        <p />
      </div>
    </div>
  );
}
