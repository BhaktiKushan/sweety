import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

// Bonus (charts): line chart of the daily average glucose over one month.
export default function GlucoseChart({ days }) {
  if (!days || days.length === 0) {
    return <p className="empty">No readings this month to chart yet.</p>;
  }

  const data = days.map((d) => ({
    date: d.date.slice(8), // day of month
    average: d.average,
    lowest: d.lowest,
    highest: d.highest,
  }));

  return (
    <div className="chart-wrap" role="img" aria-label="Line chart of average daily glucose this month">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[40, 'auto']} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v} mg/dl`} labelFormatter={(d) => `Day ${d}`} />
          <ReferenceLine y={140} stroke="#d97706" strokeDasharray="4 4" label={{ value: '140', fontSize: 11, fill: '#d97706' }} />
          <ReferenceLine y={90} stroke="#059669" strokeDasharray="4 4" label={{ value: '90', fontSize: 11, fill: '#059669' }} />
          <Line type="monotone" dataKey="average" stroke="#6d28d9" strokeWidth={2} dot={{ r: 2 }} name="Daily average" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
