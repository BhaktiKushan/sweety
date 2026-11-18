import React, { useState } from 'react';
import { SLOTS, todayString } from '../slots';

// Form to add or edit one reading. Shared by the dashboard's add and edit flows.
// Client validation mirrors the server rules; the server has the final say and
// its exact error message is shown when one comes back.
export default function ReadingForm({ date, takenSlots, editing, onSave, onCancel }) {
  const [slot, setSlot] = useState(editing?.slot || '');
  const [value, setValue] = useState(editing ? String(editing.value) : '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const availableSlots = editing ? SLOTS : SLOTS.filter((s) => !takenSlots.includes(s.key));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (value === '') {
      setError('Please enter a glucose value.');
      return;
    }
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 40 || numeric > 600) {
      setError('Value must be between 40 and 600 mg/dl.');
      return;
    }
    if (!slot) {
      setError('Please choose a time slot.');
      return;
    }
    if (date > todayString()) {
      setError('Date cannot be in the future.');
      return;
    }

    setBusy(true);
    try {
      await onSave({ date, slot, value: numeric, notes: notes || undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="reading-form" onSubmit={onSubmit} noValidate aria-label={editing ? 'Edit reading' : 'Add reading'}>
      <div className="form-row">
        <label>
          Time slot
          <select value={slot} onChange={(e) => setSlot(e.target.value)} required>
            <option value="" disabled>
              Choose a slot
            </option>
            {availableSlots.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Value (mg/dl)
          <input
            type="number"
            inputMode="numeric"
            min="40"
            max="600"
            step="1"
            placeholder="e.g. 110"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      </div>
      <label>
        Notes (optional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. morning walk done" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Add reading'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
