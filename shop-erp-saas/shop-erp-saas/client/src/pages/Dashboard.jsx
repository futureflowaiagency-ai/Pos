import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Package, AlertTriangle, ShoppingBag, Users } from 'lucide-react';
import api from '../api/axios.js';
import StatCard from '../components/ui/StatCard.jsx';
import RevenueChart from '../components/charts/RevenueChart.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { taka } from '../utils/format.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [chart, setChart] = useState([]);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RevenueChart data={chart} /></div>
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
    </div>
  );
}
