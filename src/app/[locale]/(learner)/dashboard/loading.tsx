export default function StudentDashboardLoading() {
  return (
    <div className="student-dashboard-skeleton" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="student-skeleton student-skeleton-heading" />
      <div className="student-skeleton student-skeleton-continue" />
      <div className="student-skeleton-grid"><div className="student-skeleton student-skeleton-panel" /><div className="student-skeleton student-skeleton-panel" /></div>
      <div className="student-skeleton student-skeleton-list" />
    </div>
  );
}
