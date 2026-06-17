import { useEffect, useState } from 'react';
import { Check, Clock, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import Spinner from '../components/ui/Spinner.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { taka, fmtDate, fmtDateTime } from '../utils/format.js';

const PLAN_LABELS = { monthly: 'Monthly', half_yearly: 'Half-Yearly', yearly: 'Yearly' };

export default function Subscription() {
  const [plans, setPlans] = useState({});
  const [sub, setSub] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({ plan: 'monthly', method: 'bkash', senderNumber: '', trxId: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [p, s, m] = await Promise.all([
      api.get('/payments/plans'),
      api.get('/payments/subscription'),
      api.get('/payments/mine'),
    ]);
    setPlans(p.data.data.plans);
    setSub(s.data.data);
    setPayments(m.data.data.payments);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.trxId) return toast.error('Transaction ID lagbe');
    setSubmitting(true);
    try {
      await api.post('/payments', form);
      toast.success('Payment submitted — admin approve korle active hobe');
      setForm({ plan: 'monthly', method: 'bkash', senderNumber: '', trxId: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSubmitting(false);
  };

  if (loading) return <Spinner />;

  const statusColor = { trial: 'bg-amber-100 text-amber-700', active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription</h1>

      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Current Status</p>
          <span className={`badge ${statusColor[sub.status]} mt-1 inline-block`}>{sub.status}</span>
        </div>
        <div>
          <p className="text-sm text-slate-500">Valid Until</p>
          <p className="font-semibold">{sub.expiry ? fmtDate(sub.expiry) : '—'}</p>
        </div>
        {sub.subscription && (
          <div>
            <p className="text-sm text-slate-500">Active Plan</p>
            <p className="font-semibold">{PLAN_LABELS[sub.subscription.plan]}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(plans).map(([key, p]) => (
          <div key={key} className={`card p-5 cursor-pointer transition ring-2 ${form.plan === key ? 'ring-brand-500' : 'ring-transparent'}`}
            onClick={() => setForm({ ...form, plan: key })}>
            <h3 className="font-semibold text-lg">{p.label || PLAN_LABELS[key]}</h3>
            <p className="text-3xl font-bold mt-2">{taka(p.price)}</p>
            <p className="text-sm text-slate-500 mt-1">{p.days} days</p>
            {form.plan === key && <p className="text-brand-600 text-sm mt-3 flex items-center gap-1"><Check size={16} /> Selected</p>}
          </div>
        ))}
      </div>

      <div className="card p-5 max-w-lg">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard size={18} /> Submit Payment</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Payment Method</label>
            <div className="flex gap-2">
              {['bkash', 'nagad', 'manual'].map((m) => (
                <button key={m} onClick={() => setForm({ ...form, method: m })}
                  className={`btn-ghost flex-1 capitalize ${form.method === m ? '!bg-brand-50 !text-brand-600 dark:!bg-brand-600/20' : ''}`}>{m}</button>
              ))}
            </div>
          </div>
          <div><label className="label">Sender Number</label><input className="input" value={form.senderNumber} onChange={(e) => setForm({ ...form, senderNumber: e.target.value })} placeholder="01XXXXXXXXX" /></div>
          <div><label className="label">Transaction ID (TRX)</label><input className="input" value={form.trxId} onChange={(e) => setForm({ ...form, trxId: e.target.value })} placeholder="e.g. 9AB7CD2EF1" /></div>
          <p className="text-xs text-slate-500">Amount: <b>{taka(plans[form.plan]?.price)}</b> for {PLAN_LABELS[form.plan]} plan</p>
          <button className="btn-primary w-full" disabled={submitting} onClick={submit}>{submitting ? 'Submitting...' : 'Submit Payment'}</button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock size={18} /> Payment History</h3>
        <DataTable
          columns={[
            { key: 'createdAt', label: 'Date', render: (r) => fmtDateTime(r.createdAt) },
            { key: 'plan', label: 'Plan', render: (r) => PLAN_LABELS[r.plan] },
            { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => taka(r.amount) },
            { key: 'method', label: 'Method', className: 'capitalize' },
            { key: 'trxId', label: 'TRX ID' },
            { key: 'status', label: 'Status', render: (r) => (
              <span className={`badge ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
            )},
          ]}
          rows={payments}
          empty="No payments yet"
        />
      </div>
    </div>
  );
}
