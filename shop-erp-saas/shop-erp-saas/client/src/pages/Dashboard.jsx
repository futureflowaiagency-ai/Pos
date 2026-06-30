import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Package, AlertTriangle, ShoppingBag, Users, Trophy, Receipt, Activity, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import StatCard from '../components/ui/StatCard.jsx';
import RevenueChart from '../components/charts/RevenueChart.jsx';
import PaymentPie from '../components/charts/PaymentPie.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { taka, fmtDateTime } from '../utils/format.js';
import { useLang } from '../context/LanguageContext.jsx';

const niceAction = (s = '') => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function Dashboard() {
  const { lang } = useLang();
  const [data, setData] = useState(null);
  const [chart, setChart] = useState([]);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/revenue-chart'),
      ]);
      setData(s.data.data);
      setChart(c.data.data.chart);
    })();
  }, []);

  if (!data) return <Spinner />;
  const s = data.summary;

  const genAiSummary = async () => {
    setAiLoading(true);
    try {
      const { data: res } = await api.post('/dashboard/ai-summary', { summary: s, topProducts: data.topProducts, lang });
      setAiText(res.data.summary);
    } catch (e) { toast.error(e.response?.data?.message || 'AI error'); }
    setAiLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Month Revenue" value={taka(s.monthRevenue)} accent="brand" />
        <StatCard icon={TrendingUp} label="Net Profit" value={taka(s.netProfit)} sub={`Expense ${taka(s.monthExpense)}`} accent="green" />
        <StatCard icon={ShoppingBag} label="Today's Sales" value={taka(s.todayRevenue)} sub={`${s.todaySalesCount} orders`} accent="brand" />
        <StatCard icon={AlertTriangle} label="Total Due" value={taka(s.totalDue)} accent="red" />
        <StatCard icon={Package} label="Products" value={s.totalProducts} accent="brand" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={s.lowStockCount} accent="amber" />
        <StatCard icon={Users} label="Employees" value={s.employeesCount} accent="brand" />
        <StatCard icon={ShoppingBag} label="Month Orders" value={s.monthSalesCount} accent="green" />
      </div>

      {/* AI Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles size={18} className="text-brand-600" /> AI Business Summary</h3>
          <button className="btn-ghost" disabled={aiLoading} onClick={genAiSummary}>
            <Sparkles size={15} /> {aiLoading ? 'Analyzing…' : aiText ? 'Regenerate' : 'Generate summary'}
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed whitespace-pre-line">
          {aiText || 'Click “Generate summary” for an AI insight on this month’s performance (uses your own AI key from Marketing → Integrations).'}
        </p>
      </div>

      {/* Revenue + Payment pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RevenueChart data={chart} /></div>
        <PaymentPie data={data.paymentBreakdown} />
      </div>

      {/* Top sellers + Recent orders + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Top Selling Products</h3>
          <DataTable
            columns={[
              { key: '_id', label: 'Product' },
              { key: 'qty', label: 'Sold', className: 'text-right', render: (r) => <span className="font-semibold">{r.qty}</span> },
              { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => taka(r.revenue) },
            ]}
            rows={data.topProducts}
            empty="No sales this month"
          />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt size={18} className="text-brand-600" /> Recent Orders</h3>
          <DataTable
            columns={[
              { key: 'invoiceNo', label: 'Invoice' },
              { key: 'customerName', label: 'Customer' },
              { key: 'paymentMethod', label: 'Pay', render: (r) => <span className="text-xs uppercase font-semibold text-slate-500">{r.paymentMethod}</span> },
              { key: 'total', label: 'Total', className: 'text-right', render: (r) => taka(r.total) },
            ]}
            rows={data.recentOrders}
            empty="No orders yet"
          />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Low Stock Alert</h3>
          <DataTable
            columns={[
              { key: 'name', label: 'Product' },
              { key: 'stock', label: 'Stock', className: 'text-right', render: (r) => <span className="text-red-500 font-semibold">{r.stock}</span> },
            ]}
            rows={data.lowStockProducts}
            empty="All stocked up ✅"
          />
        </div>
      </div>

      {/* Recent activities */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity size={18} className="text-brand-600" /> Recent Activities</h3>
        {data.recentActivities?.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.recentActivities.map((a, i) => (
              <li key={i} className="py-2 flex items-center justify-between text-sm">
                <span><span className="font-medium">{niceAction(a.action)}</span>{a.entity ? <span className="text-slate-400"> · {a.entity}</span> : null}</span>
                <span className="text-slate-400 text-xs">{a.user} · {fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-400">No recent activity</p>}
      </div>
    </div>
  );
}
