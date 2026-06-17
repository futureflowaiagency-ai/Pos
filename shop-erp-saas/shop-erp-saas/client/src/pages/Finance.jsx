import { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import StatCard from '../components/ui/StatCard.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import { taka, fmtDate } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Finance() {
  const { business } = useAuth();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [report, setReport] = useState([]);
  const [period, setPeriod] = useState('daily');
  const [modal, setModal] = useState(false);
  const [printReport, setPrintReport] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', amount: 0, note: '' });

  const load = async () => {
    const [s, e, r] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/expenses'),
      api.get(`/sales/report?period=${period}`),
    ]);
    setSummary(s.data.data.summary);
    setExpenses(e.data.data.expenses);
    setReport(r.data.data.report);
  };
  useEffect(() => { load(); }, [period]);

  const save = async () => {
    try {
      await api.post('/expenses', { ...form, amount: +form.amount });
      toast.success('Expense added');
      setModal(false);
      setForm({ title: '', category: 'General', amount: 0, note: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };
  const del = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/expenses/${id}`); load(); };

  if (!summary) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Finance</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setPrintReport(true)}><Printer size={18} /> Print Report</button>
          <button className="btn-primary" onClick={() => setModal(true)}><Plus size={18} /> Add Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Month Revenue" value={taka(summary.monthRevenue)} accent="brand" />
        <StatCard icon={TrendingUp} label="Gross Profit" value={taka(summary.monthProfit)} accent="green" />
        <StatCard icon={TrendingDown} label="Total Expense" value={taka(summary.monthExpense)} accent="red" />
        <StatCard icon={TrendingUp} label="Net Profit" value={taka(summary.netProfit)} accent={summary.netProfit >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Sales Report</h3>
            <select className="input !w-auto !py-1" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <DataTable
            columns={[
              { key: '_id', label: 'Period' },
              { key: 'count', label: 'Orders', className: 'text-right' },
              { key: 'totalSales', label: 'Sales', className: 'text-right', render: (r) => taka(r.totalSales) },
              { key: 'totalProfit', label: 'Profit', className: 'text-right', render: (r) => <span className="text-green-600">{taka(r.totalProfit)}</span> },
            ]}
            rows={report}
            empty="No sales yet"
          />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3">Expenses</h3>
          <DataTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'category', label: 'Category' },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => <span className="text-red-500">{taka(r.amount)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (r) => (
                <button onClick={() => del(r._id)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={15} /></button>
              )},
            ]}
            rows={expenses}
            empty="No expenses recorded"
          />
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Expense"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        <div className="space-y-3">
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>General</option><option>Rent</option><option>Utility</option><option>Salary</option><option>Purchase</option><option>Marketing</option><option>Other</option>
            </select>
          </div>
          <div><label className="label">Amount</label><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="label">Note</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </div>
      </Modal>

      <PrintWrapper open={printReport} onClose={() => setPrintReport(false)} title="Sales Report">
        <div className="print-a4">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{business?.name}</h1>
            <p className="text-sm">{business?.address}</p>
            <h2 className="text-lg font-semibold mt-2">Sales Report ({period})</h2>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-1">Period</th>
                <th className="text-right py-1">Orders</th>
                <th className="text-right py-1">Sales</th>
                <th className="text-right py-1">Profit</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r._id} className="border-b border-gray-300">
                  <td className="py-1">{r._id}</td>
                  <td className="text-right py-1">{r.count}</td>
                  <td className="text-right py-1">{taka(r.totalSales)}</td>
                  <td className="text-right py-1">{taka(r.totalProfit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-bold">
                <td className="py-1">Total</td>
                <td className="text-right py-1">{report.reduce((a, r) => a + r.count, 0)}</td>
                <td className="text-right py-1">{taka(report.reduce((a, r) => a + r.totalSales, 0))}</td>
                <td className="text-right py-1">{taka(report.reduce((a, r) => a + r.totalProfit, 0))}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-center text-xs mt-6 text-gray-500">{business?.name}{business?.phone ? ` • ${business.phone}` : ''}</p>
        </div>
      </PrintWrapper>
    </div>
  );
}
