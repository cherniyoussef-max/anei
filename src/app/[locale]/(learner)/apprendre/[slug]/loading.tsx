import "./course-room.css";

export default function CourseRoomLoading() {
  return (
    <div className="course-room course-room-loading" aria-busy="true" aria-label="Loading course">
      <div className="course-room-loading-hero" />
      <div className="course-room-loading-tabs" />
      <div className="course-room-loading-body">
        <div className="course-room-loading-programme" />
        <div className="course-room-loading-lesson" />
      </div>
    </div>
  );
}
