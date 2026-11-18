import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { todayString } from '../slots';
import ReportCard from '../components/ReportCard';
import GlucoseChart from '../components/GlucoseChart';

function fmt(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(todayString());
  const [daily, setDaily] = useState(null);
  const [mtd, setMtd] = useState(null);
  const [prevMonth, setPrevMonth] = useState(null);
  const [dailyReadings, setDailyReadings] = useState([]);
  const [chartDays, setChartDays] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const month = date.slice(0, 7);
        const [d, m, p, s] = await Promise.all([
          api(`/reports/daily?date=${date}`, { token }),
          api(`/reports/month-to-date?date=${date}`, { token }),
          api(`/reports/previous-month?date=${date}`, { token }),
          api(`/reports/series?month=${month}`, { token }),
        ]);
        if (cancelled) return;
        setDaily(d.report);
        setDailyReadings(d.readings);
        setMtd(m.report);
        setPrevMonth(p.report);
        setChartDays(s.days);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [date, token]);

  return (
    <div>
      <div className="page-head">
        <h1>Reports</h1>
        <label className="date-picker">
          Selected date
          <input type="date" value={date} max={todayString()} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Loading reports...</p>
      ) : (
        <>
          <div className="report-grid">
            <ReportCard title="Daily" range={fmt(daily.from)} report={daily} />
            <ReportCard title="Month-to-date" range={`${fmt(mtd.from)} - ${fmt(mtd.to)}`} report={mtd} />
            <ReportCard title="Previous month" range={`${fmt(prevMonth.from)} - ${fmt(prevMonth.to)}`} report={prevMonth} />
          </div>

          <section className="card">
            <h3>Daily detail - {fmt(daily.from)}</h3>
            {dailyReadings.length === 0 ? (
              <p className="empty">No readings on this day yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Value</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReadings.map((r) => (
                    <tr key={r.id}>
                      <td>{r.slot_label}</td>
                      <td>{r.value} mg/dl</td>
                      <td className="muted">{r.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h3>This month at a glance</h3>
            <GlucoseChart days={chartDays} />
          </section>
        </>
      )}
    </div>
  );
}
