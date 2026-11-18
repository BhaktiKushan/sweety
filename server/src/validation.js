// The four daily slots, in display order. Labels match the assignment wording.
const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

const MIN_VALUE = 40;
const MAX_VALUE = 600;

// Error messages are the exact strings from the assignment.
const MESSAGES = {
  valueRequired: 'Please enter a glucose value.',
  valueRange: 'Value must be between 40 and 600 mg/dl.',
  duplicateSlot: (label) => `You already have an ${label} reading for this date.`,
  maxPerDay: 'You can add only 4 readings per day.',
  futureDate: 'Date cannot be in the future.',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(date) {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Today's date in the server's local timezone, as YYYY-MM-DD.
function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Validate the fields of a reading create/update payload.
// Returns an array of error messages (empty when valid).
function validateReading({ date, slot, value }) {
  const errors = [];

  if (!date || !isValidDateString(date)) {
    errors.push('Please enter a valid date (YYYY-MM-DD).');
  } else if (date > todayString()) {
    errors.push(MESSAGES.futureDate);
  }

  if (!slot || !SLOTS.includes(slot)) {
    errors.push('Please choose a valid time slot.');
  }

  if (value === undefined || value === null || value === '') {
    errors.push(MESSAGES.valueRequired);
  } else if (!Number.isInteger(Number(value)) || Number(value) < MIN_VALUE || Number(value) > MAX_VALUE) {
    errors.push(MESSAGES.valueRange);
  }

  return errors;
}

module.exports = { SLOTS, SLOT_LABELS, MIN_VALUE, MAX_VALUE, MESSAGES, isValidDateString, todayString, validateReading };
