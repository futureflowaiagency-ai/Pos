import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTheme } from '../../context/ThemeContext.jsx';
import { taka } from '../../utils/format.js';

// Brand-ish colours per payment method.
const COLORS = {
  cash: '#16a34a',
  bank: '#0d9488',
  bkash: '#db2777',
  nagad: '#ea580c',
  rocket: '#7c3aed',
  card: '#4f46e5',
  due: '#ef4444',
  emi: '#0891b2',
  split: '#64748b',
};

export default function PaymentPie({ data = [] }) {
  const { theme } = useTheme();
  const text = theme === 'dark' ? '#94a3b8' : '#64748b';
  const chartData = data
    .filter((d) => d._id)
    .map((d) => ({ name: d._id, value: d.total, count: d.count }));

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Payment Methods (this month)</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-400 py-10 text-center">No sales yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}>
              {chartData.map((e) => <Cell key={e.name} fill={COLORS[e.name] || '#94a3b8'} />)}
            </Pie>
            <Tooltip
              formatter={(v, n, p) => [`${taka(v)} (${p.payload.count})`, n]}
              contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, color: text, textTransform: 'capitalize' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, textTransform: 'capitalize' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
