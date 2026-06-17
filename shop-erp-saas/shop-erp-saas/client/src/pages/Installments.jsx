import { useEffect, useState } from 'react';
import { Plus, CalendarClock, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import { taka, fmtDate } from '../utils/format.js';
import { useConfirm } from '../context/ConfirmContext.jsx';

const balance = (p) => {
  const paid = (p.schedule || []).filter((s) => s.paid).reduce((a, s) => a + s.amount, 0);
  return Math.max(0, (p.totalAmount || 0) - (p.downPayment || 0) - paid);
};

export default function Installments() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ customer: '', productName: '', totalAmount: '', downPayment: 0, months: 3, firstDueDate: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => { const { data } = await api.get('/installments'); setPlans(data.data.installments); };
  useEffect(() => { load(); api.get('/customers').then(({ data }) => setCustomers(data.data.customers)); }, []);

  const create = async () => {
    if (Number(form.totalAmount) <= 0) return toast.error('Enter a valid total amount');
    if (Number(form.months) < 1) return toast.error('Months must be at least 1');
    setSaving(true);
    try {
      await api.post('/installments', {
        ...form,
        totalAmount: Number(form.totalAmount),
        downPayment: Number(form.downPayment || 0),
        months: Number(form.months),
        customer: form.customer || null,
      });
      toast.success('EMI plan created'); setModal(false);
      setForm({ customer: '', productName: '', totalAmount: '', downPayment: 0, months: 3, firstDueDate: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const pay = async (plan, no) => {
    try {
      const { data } = await api.patch(`/installments/${plan._id}/pay`, { no });
      setDetail(data.data.installment); load();
      toast.success('Instalment paid');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const del = async (plan) => {
    const ok = await confirm({ title: 'Delete EMI plan?', message: 'This will remove the instalment plan permanently.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    await api.delete(`/installments/${plan._id}`); toast.success('Deleted'); load();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock size={24} /> EMI / Installments</h1>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={18} /> New EMI Plan</button>
      </div>

      <DataTable
        columns={[
          { key: 'customerName', label: 'Customer', render: (r) => r.customerName || 'Walk-in' },
          { key: 'productName', label: 'Item', render: (r) => r.productName || '—' },
          { key: 'totalAmount', label: 'Total', className: 'text-right', render: (r) => taka(r.totalAmount) },
          { key: 'downPayment', label: 'Down', className: 'text-right', render: (r) => taka(r.downPayment) },
          { key: 'months', label: 'Months', className: 'text-right' },
          { key: 'balance', label: 'Balance', className: 'text-right', render: (r) => (
            <span className={balance(r) > 0 ? 'text-red-500 font-semibold' : 'text-green-600'}>{taka(balance(r))}</span>
          )},
          { key: 'status', label: 'Status', render: (r) => (
            <span className={`badge ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
          )},
          { key: 'actions', label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button className="btn-ghost text-xs" onClick={() => setDetail(r)}>View / Pay</button>
              <button className="btn-ghost p-1.5 text-red-500" onClick={() => del(r)}><Trash2 size={15} /></button>
            </div>
          )},
        ]}
        rows={plans}
        empty="No EMI plans yet"
      />

      {/* Create */}
      <Modal open={modal} onClose={() => setModal(false)} title="New EMI Plan" size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={create}>Create Plan</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Customer</label>
            <select className="input" value={form.customer} onChange={set('customer')}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label">Item / Description</label><input className="input" value={form.productName} onChange={set('productName')} placeholder="e.g. iPhone 15 Pro 128GB" /></div>
          <div><label className="label">Total Amount</label><input className="input" type="number" value={form.totalAmount} onChange={set('totalAmount')} /></div>
          <div><label className="label">Down Payment</label><input className="input" type="number" value={form.downPayment} onChange={set('downPayment')} /></div>
          <div><label className="label">Number of Months</label><input className="input" type="number" min="1" value={form.months} onChange={set('months')} /></div>
          <div><label className="label">First Due Date</label><input className="input" type="date" value={form.firstDueDate} onChange={set('firstDueDate')} /></div>
          <p className="col-span-2 text-xs text-slate-500">
            Financed amount {taka(Math.max(0, Number(form.totalAmount || 0) - Number(form.downPayment || 0)))} will be split into {form.months || 0} monthly instalments.
          </p>
        </div>
      </Modal>

      {/* Detail / schedule */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`EMI — ${detail.customerName || 'Walk-in'}`} size="lg" footer={<button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>}>
          <div className="grid grid-cols-4 gap-3 mb-3 text-center text-sm">
            <div className="card p-2"><p className="text-xs text-slate-400">Total</p><p className="font-bold">{taka(detail.totalAmount)}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Down</p><p className="font-bold">{taka(detail.downPayment)}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Balance</p><p className="font-bold text-red-500">{taka(balance(detail))}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Months</p><p className="font-bold">{detail.months}</p></div>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th><th></th></tr>
              </thead>
              <tbody>
                {detail.schedule.map((s) => (
                  <tr key={s.no} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2">{s.no}</td>
                    <td className="px-3 py-2">{fmtDate(s.dueDate)}</td>
                    <td className="px-3 py-2 text-right">{taka(s.amount)}</td>
                    <td className="px-3 py-2">
                      {s.paid
                        ? <span className="badge bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Paid</span>
                        : <span className="badge bg-amber-100 text-amber-700">Unpaid</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!s.paid && <button className="btn-primary text-xs py-1" onClick={() => pay(detail, s.no)}>Mark Paid</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
