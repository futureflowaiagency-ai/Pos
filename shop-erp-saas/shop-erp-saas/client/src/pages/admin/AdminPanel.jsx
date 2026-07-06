import { useEffect, useState } from 'react';
import { Building2, Users, Clock, BadgeCheck, Check, X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios.js';
import StatCard from '../../components/ui/StatCard.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { taka, fmtDate, fmtDateTime } from '../../utils/format.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

const PLAN_LABELS = { monthly: 'Monthly', half_yearly: 'Half-Yearly', yearly: 'Yearly', custom: 'Custom' };
const planLabel = (p) => PLAN_LABELS[p] || p;
const emptyOwner = { name: '', email: '', phone: '', password: '', businessName: '', businessType: 'general' };
const emptyPlan = { enabled: false, label: 'Custom Plan', price: '', days: 30 };

export default function AdminPanel() {
  const confirm = useConfirm();
  const [overview, setOverview] = useState(null);
  const [payments, setPayments] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [tab, setTab] = useState('payments');
  const [ownerModal, setOwnerModal] = useState(false);
  const [ownerForm, setOwnerForm] = useState(emptyOwner);
  const [saving, setSaving] = useState(false);
  const [planBiz, setPlanBiz] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [savingPlan, setSavingPlan] = useState(false);

  const load = async () => {
    const [o, p, b] = await Promise.all([
      api.get('/admin/overview'),
      api.get('/admin/payments?status=pending'),
      api.get('/admin/businesses'),
    ]);
    setOverview(o.data.data.overview);
    setPayments(p.data.data.payments);
    setBusinesses(b.data.data.businesses);
  };
  useEffect(() => { load(); }, []);

  const review = async (r, action) => {
    const ok = await confirm({
      title: action === 'approve' ? 'Approve this payment?' : 'Reject this payment?',
      message: action === 'approve'
        ? `Approve the ${planLabel(r.plan)} payment of ${taka(r.amount)} for ${r.business?.name || 'this business'}? The subscription will be extended.`
        : `Reject the payment of ${taka(r.amount)} for ${r.business?.name || 'this business'}?`,
      confirmText: action === 'approve' ? 'Approve' : 'Reject',
      tone: action === 'approve' ? 'success' : 'danger',
    });
    if (!ok) return;
    let note = '';
    if (action === 'reject') { note = prompt('Reject reason (optional):') || ''; }
    try {
      await api.patch(`/admin/payments/${r._id}`, { action, note });
      toast.success(`Payment ${action}d`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const toggleOwner = async (r) => {
    const isActive = r.owner?.isActive !== false;
    const ok = await confirm({
      title: isActive ? 'Deactivate this owner account?' : 'Activate this owner account?',
      message: isActive
        ? `Do you want to deactivate ${r.owner?.name || 'this owner'}? They will not be able to log in until reactivated.`
        : `Do you want to activate ${r.owner?.name || 'this owner'}? They will be able to log in again.`,
      confirmText: isActive ? 'Deactivate' : 'Activate',
      tone: isActive ? 'deactivate' : 'success',
    });
    if (!ok) return;
    try { await api.patch(`/admin/businesses/${r._id}/toggle`); toast.success('Owner status updated'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const createOwner = async () => {
    if (!ownerForm.name || !ownerForm.email || !ownerForm.password || !ownerForm.businessName)
      return toast.error('Name, email, password and shop name are required');
    setSaving(true);
    try {
      await api.post('/admin/owners', ownerForm);
      toast.success('Owner account created');
      setOwnerModal(false); setOwnerForm(emptyOwner); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const openPlan = (r) => {
    const cp = r.customPlan || {};
    setPlanBiz(r);
    setPlanForm({
      enabled: !!cp.enabled,
      label: cp.label || 'Custom Plan',
      price: cp.enabled ? cp.price ?? '' : '',
      days: cp.enabled ? cp.days ?? 30 : 30,
    });
  };

  const savePlan = async () => {
    if (planForm.enabled) {
      if (planForm.price === '' || Number(planForm.price) < 0) return toast.error('Valid price required');
      if (!(Number(planForm.days) > 0)) return toast.error('Valid duration (days) required');
    }
    setSavingPlan(true);
    try {
      await api.patch(`/admin/businesses/${planBiz._id}/plan`, {
        enabled: planForm.enabled,
        label: planForm.label,
        price: Number(planForm.price) || 0,
        days: Number(planForm.days) || 30,
      });
      toast.success('Custom price updated');
      setPlanBiz(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSavingPlan(false);
  };

  const setO = (k) => (e) => setOwnerForm({ ...ownerForm, [k]: e.target.value });
  const setP = (k) => (e) => setPlanForm({ ...planForm, [k]: e.target.value });

  if (!overview) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BadgeCheck size={24} /> Admin Panel</h1>
        <button className="btn-primary" onClick={() => { setOwnerForm(emptyOwner); setOwnerModal(true); }}><UserPlus size={18} /> Create Owner</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Businesses" value={overview.businesses} accent="brand" />
        <StatCard icon={Users} label="Owners" value={overview.owners} accent="green" />
        <StatCard icon={Clock} label="Pending Payments" value={overview.pendingPayments} accent="amber" />
        <StatCard icon={BadgeCheck} label="Active Subscriptions" value={overview.activeSubs} accent="green" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button className={`px-4 py-2 -mb-px border-b-2 ${tab === 'payments' ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-slate-500'}`} onClick={() => setTab('payments')}>Pending Payments</button>
        <button className={`px-4 py-2 -mb-px border-b-2 ${tab === 'businesses' ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-slate-500'}`} onClick={() => setTab('businesses')}>Businesses</button>
      </div>

      {tab === 'payments' ? (
        <div className="card p-4">
          <DataTable
            columns={[
              { key: 'createdAt', label: 'Date', render: (r) => fmtDateTime(r.createdAt) },
              { key: 'business', label: 'Business', render: (r) => r.business?.name || '—' },
              { key: 'submittedBy', label: 'By', render: (r) => r.submittedBy?.name || '—' },
              { key: 'plan', label: 'Plan', render: (r) => planLabel(r.plan) },
              { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => taka(r.amount) },
              { key: 'method', label: 'Method', className: 'capitalize' },
              { key: 'trxId', label: 'TRX ID' },
              { key: 'actions', label: '', className: 'text-right', render: (r) => (
                <div className="flex justify-end gap-1">
                  <button onClick={() => review(r, 'approve')} className="btn-ghost p-1.5 text-green-600" title="Approve"><Check size={16} /></button>
                  <button onClick={() => review(r, 'reject')} className="btn-ghost p-1.5 text-red-500" title="Reject"><X size={16} /></button>
                </div>
              )},
            ]}
            rows={payments}
            empty="No pending payments 🎉"
          />
        </div>
      ) : (
        <div className="card p-4">
          <DataTable
            columns={[
              { key: 'name', label: 'Business' },
              { key: 'type', label: 'Type', className: 'capitalize' },
              { key: 'owner', label: 'Owner', render: (r) => r.owner?.name || '—' },
              { key: 'owner_email', label: 'Email', render: (r) => r.owner?.email || '—' },
              { key: 'owner_status', label: 'Owner', render: (r) => (
                <span className={`badge ${r.owner?.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.owner?.isActive !== false ? 'active' : 'inactive'}</span>
              )},
              { key: 'subscriptionStatus', label: 'Subscription', render: (r) => (
                <span className={`badge ${r.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : r.subscriptionStatus === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.subscriptionStatus}</span>
              )},
              { key: 'subscriptionExpiry', label: 'Expiry', render: (r) => fmtDate(r.subscriptionExpiry) },
              { key: 'price', label: 'Price', render: (r) => (
                r.customPlan?.enabled
                  ? <span title={`${r.customPlan.label} • ${r.customPlan.days} days`}>{taka(r.customPlan.price)} <span className="text-slate-400">/ {r.customPlan.days}d</span></span>
                  : <span className="text-slate-400">Default</span>
              )},
              { key: 'actions', label: '', className: 'text-right', render: (r) => (
                <div className="flex justify-end gap-1">
                  <button onClick={() => openPlan(r)} className="btn-ghost text-xs">Set Price</button>
                  <button onClick={() => toggleOwner(r)} className="btn-ghost text-xs">{r.owner?.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                </div>
              )},
            ]}
            rows={businesses}
            empty="No businesses yet"
          />
        </div>
      )}

      {/* Create Owner */}
      <Modal open={ownerModal} onClose={() => setOwnerModal(false)} title="Create Owner Account"
        footer={<><button className="btn-ghost" onClick={() => setOwnerModal(false)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={createOwner}>{saving ? 'Creating...' : 'Create Owner'}</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Owner Name</label><input className="input" value={ownerForm.name} onChange={setO('name')} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={ownerForm.email} onChange={setO('email')} /></div>
          <div><label className="label">Phone</label><input className="input" value={ownerForm.phone} onChange={setO('phone')} /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={ownerForm.password} onChange={setO('password')} /></div>
          <div><label className="label">Shop / Business Name</label><input className="input" value={ownerForm.businessName} onChange={setO('businessName')} /></div>
          <div className="col-span-2">
            <label className="label">Business Type</label>
            <select className="input" value={ownerForm.businessType} onChange={setO('businessType')}>
              <option value="general">General Shop</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="mobile">Mobile Shop Management</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Set Custom Price */}
      <Modal open={!!planBiz} onClose={() => setPlanBiz(null)} title={`Custom Price — ${planBiz?.name || ''}`}
        footer={<><button className="btn-ghost" onClick={() => setPlanBiz(null)}>Cancel</button><button className="btn-primary" disabled={savingPlan} onClick={savePlan}>{savingPlan ? 'Saving...' : 'Save'}</button></>}>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={planForm.enabled} onChange={(e) => setPlanForm({ ...planForm, enabled: e.target.checked })} />
            <span className="text-sm">Enable custom price for this shop</span>
          </label>
          {planForm.enabled ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Plan Name</label><input className="input" value={planForm.label} onChange={setP('label')} placeholder="e.g. Yearly" /></div>
              <div><label className="label">Price (৳)</label><input className="input" type="number" min="0" value={planForm.price} onChange={setP('price')} placeholder="e.g. 3000" /></div>
              <div><label className="label">Duration (days)</label><input className="input" type="number" min="1" value={planForm.days} onChange={setP('days')} placeholder="e.g. 365" /></div>
              <p className="col-span-2 text-xs text-slate-500">This shop will see only this plan on its Subscription page.</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Custom price off — this shop sees the default plans (৳500 / ৳2,500 / ৳4,500).</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
