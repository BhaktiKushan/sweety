import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { SLOTS, todayString } from '../slots';
import ReadingForm from '../components/ReadingForm';

export default function DashboardPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(todayString());
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/readings?date=${date}&limit=10`, { token });
      setReadings(data.readings);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, token]);

  useEffect(() => {
    load();
  }, [load]);

  const bySlot = Object.fromEntries(readings.map((r) => [r.slot, r]));
  const takenSlots = readings.map((r) => r.slot);
  const editing = readings.find((r) => r.id === editingId) || null;

  async function createReading(payload) {
    await api('/readings', { method: 'POST', body: payload, token });
    setAdding(false);
    await load();
  }

  async function updateReading(payload) {
    await api(`/readings/${editing.id}`, { method: 'PUT', body: payload, token });
    setEditingId(null);
    await load();
  }

  async function deleteReading(id) {
    if (!window.confirm('Delete this reading?')) return;
    try {
      await api(`/readings/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Your readings</h1>
        <label className="date-picker">
          Date
          <input type="date" value={date} max={todayString()} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Loading readings...</p>
      ) : (
        <div className="slot-list">
          {SLOTS.map((s) => {
            const reading = bySlot[s.key];
            return (
              <section key={s.key} className="card slot-card">
                <div className="slot-head">
                  <h3>{s.label}</h3>
                  {reading && (
                    <div className="slot-actions">
                      <button className="link-btn" onClick={() => { setAdding(false); setEditingId(reading.id); }}>
                        Edit
                      </button>
                      <button className="link-btn danger" onClick={() => deleteReading(reading.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === reading?.id ? (
                  <ReadingForm date={date} takenSlots={takenSlots} editing={editing} onSave={updateReading} onCancel={() => setEditingId(null)} />
                ) : reading ? (
                  <>
                    <p className="reading-value">
                      {reading.value} <span className="unit">mg/dl</span>
                    </p>
                    {reading.notes && <p className="muted">{reading.notes}</p>}
                  </>
                ) : (
                  <p className="empty">No reading yet for this slot.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!adding ? (
        <button className="add-btn" onClick={() => { setEditingId(null); setAdding(true); }} disabled={takenSlots.length >= 4}>
          + Add a reading
        </button>
      ) : (
        <section className="card">
          <h3>New reading for {date}</h3>
          <ReadingForm date={date} takenSlots={takenSlots} onSave={createReading} onCancel={() => setAdding(false)} />
        </section>
      )}
      {takenSlots.length >= 4 && !adding && <p className="muted">All 4 slots are filled for {date}. That is the maximum for one day.</p>}
    </div>
  );
}
