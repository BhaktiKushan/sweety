import React from 'react';

// One report card: highest / lowest / average / count, or a friendly empty state.
export default function ReportCard({ title, range, report }) {
  return (
    <section className="card report-card">
      <h3>{title}</h3>
      <p className="muted">{range}</p>
      {!report || report.count === 0 ? (
        <p className="empty">No readings in this period yet.</p>
      ) : (
        <dl className="stats">
          <div>
            <dt>Highest</dt>
            <dd>{report.highest} mg/dl</dd>
          </div>
          <div>
            <dt>Lowest</dt>
            <dd>{report.lowest} mg/dl</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{report.average} mg/dl</dd>
          </div>
          <div>
            <dt>Readings</dt>
            <dd>{report.count}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
