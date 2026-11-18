import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import ReadingForm from '../src/components/ReadingForm';

// A past date so the "future date" rule never interferes.
const DATE = '2026-10-15';

function setup(overrides = {}) {
  const onSave = vi.fn();
  render(<ReadingForm date={DATE} takenSlots={[]} onSave={onSave} {...overrides} />);
  return { onSave };
}

async function fillValidForm(user) {
  await user.selectOptions(screen.getByLabelText(/time slot/i), 'morning');
  await user.type(screen.getByLabelText(/value/i), '110');
}

describe('ReadingForm', () => {
  test('submits a valid reading', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(onSave).toHaveBeenCalledWith({ date: DATE, slot: 'morning', value: 110, notes: undefined });
  });

  test('empty value shows "Please enter a glucose value." and does not save', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.selectOptions(screen.getByLabelText(/time slot/i), 'morning');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a glucose value.');
    expect(onSave).not.toHaveBeenCalled();
  });

  test.each([
    ['39', 'below range'],
    ['601', 'above range'],
    ['100.5', 'not a whole number'],
  ])('value %s (%s) shows the range error', async (bad) => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.selectOptions(screen.getByLabelText(/time slot/i), 'morning');
    await user.type(screen.getByLabelText(/value/i), bad);
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Value must be between 40 and 600 mg/dl.');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('shows the server error message when saving fails (e.g. duplicate slot)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('You already have an After lunch reading for this date.'));
    render(<ReadingForm date={DATE} takenSlots={[]} onSave={onSave} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You already have an After lunch reading for this date.');
  });

  test('hides slots that already have a reading for the day', () => {
    setup({ takenSlots: ['morning', 'after_lunch'] });
    const select = screen.getByLabelText(/time slot/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).not.toContain('Morning (fasting)');
    expect(options).not.toContain('After lunch');
    expect(options).toContain('After breakfast');
    expect(options).toContain('After dinner');
  });

  test('edit mode pre-fills the existing reading', () => {
    setup({ editing: { slot: 'after_dinner', value: 145, notes: 'late dinner' } });
    expect(screen.getByLabelText(/time slot/i)).toHaveValue('after_dinner');
    expect(screen.getByLabelText(/value/i)).toHaveValue(145);
    expect(screen.getByLabelText(/notes/i)).toHaveValue('late dinner');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});
