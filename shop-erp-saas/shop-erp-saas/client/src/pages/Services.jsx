import { useEffect, useState } from 'react';
import { Plus, Wrench, Trash2, Search, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import ServiceInvoice from '../components/print/ServiceInvoice.jsx';
import ServiceThermal from '../components/print/ServiceThermal.jsx';
import { taka, fmtDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

const STATUSES = ['pending', 'repairing', 'completed', 'delivered'];
const STATUS_BADGE = {
  pending: 'bg-slate-200 text-slate-700',
  repairing: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
};
const empty = { customerName: '', customerPhone: '', deviceModel: '', imei: '', problem: '', budget: 0, technician: '', serviceFee: 0, partsCost: 0, paid: 0 };

export default function Services() {
  const confirm = useConfirm();
  const { business } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  // customer service invoice to print / reprint (unlimited times)
  const [printJob, setPrintJob] = useState(null);
  const [printMode, setPrintMode] = useState('a4'); // 'a4' | 'thermal'

  const load = async () => {
    const { data } = await api.get('/services', { params: { search, status: statusFilter || undefined } });
    setJobs(data.data.jobs);
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, statusFilter]);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = (j) => {
    setForm({
      customerName: j.customerName, customerPhone: j.customerPhone || '', deviceModel: j.deviceModel || '',
      imei: j.imei || '', problem: j.problem || '', budget: j.budget || 0, technician: j.technician || '',
      serviceFee: j.serviceFee || 0, partsCost: j.partsCost || 0, paid: j.paid || 0,
    });
    setEditId(j._id); setModal(true);
  };

  const save = async () => {
    if (!form.customerName.trim()) return toast.error('Customer name is required');
    if (!form.deviceModel.trim()) return toast.error('Device model is required');
    const payload = {
      ...form,
      budget: +form.budget || 0, serviceFee: +form.serviceFee || 0, partsCost: +form.partsCost || 0, paid: +form.paid || 0,
    };
    try {
      const { data } = editId
        ? await api.put(`/services/${editId}`, payload)
        : await api.post('/services', payload);
      toast.success('Saved'); setModal(false); load();
      if (data?.data?.job) setPrintJob(data.data.job);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const changeStatus = async (j, status) => {
    try { await api.patch(`/services/${j._id}/status`, { status }); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const del = async (j) => {
    const ok = await confirm({ title: 'Delete job sheet?', message: `Delete job ${j.jobNo}?`, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    await api.delete(`/services/${j._id}`); toast.success('Deleted'); load();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const total = (+form.serviceFee || 0) + (+form.partsCost || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench size={24} /> Service / Repair</h1>
        <button className="btn-primary" onClick={openNew}><Plus size={18} /> New Job Sheet</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-10" placeholder="Search by job no, customer, device..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'jobNo', label: 'Job No' },
          { key: 'customerName', label: 'Customer', render: (r) => (
            <div><span className="font-medium">{r.customerName}</span>{r.customerPhone && <div className="text-xs text-slate-400">{r.customerPhone}</div>}</div>
          )},
          { key: 'deviceModel', label: 'Device', render: (r) => (
            <div>{r.deviceModel}{r.problem && <div className="text-xs text-slate-400 truncate max-w-[180px]">{r.problem}</div>}</div>
          )},
          { key: 'technician', label: 'Technician', render: (r) => r.technician || '—' },
          { key: 'total', label: 'Bill', className: 'text-right', render: (r) => taka(r.total) },
          { key: 'status', label: 'Status', render: (r) => (
            <select className={`badge border-0 ${STATUS_BADGE[r.status]} capitalize cursor-pointer`} value={r.status} onChange={(e) => changeStatus(r, e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )},
          { key: 'actions', label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button className="btn-ghost p-1.5" title="Print invoice" onClick={() => setPrintJob(r)}><Printer size={15} /></button>
              <button className="btn-ghost text-xs" onClick={() => openEdit(r)}>Edit</button>
              <button className="btn-ghost p-1.5 text-red-500" onClick={() => del(r)}><Trash2 size={15} /></button>
            </div>
          )},
        ]}
        rows={jobs}
        empty="No service jobs yet"
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Job Sheet' : 'New Job Sheet'} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Customer Name</label><input className="input" value={form.customerName} onChange={set('customerName')} /></div>
          <div><label className="label">Customer Phone</label><input className="input" value={form.customerPhone} onChange={set('customerPhone')} /></div>
          <div><label className="label">Device Model</label><input className="input" value={form.deviceModel} onChange={set('deviceModel')} /></div>
          <div><label className="label">IMEI / Serial</label><input className="input" value={form.imei} onChange={set('imei')} /></div>
          <div className="col-span-2"><label className="label">Problem / Fault</label><input className="input" value={form.problem} onChange={set('problem')} /></div>
          <div><label className="label">Customer Budget</label><input className="input" type="number" value={form.budget} onChange={set('budget')} /></div>
          <div><label className="label">Technician</label><input className="input" value={form.technician} onChange={set('technician')} /></div>
          <div><label className="label">Service Fee</label><input className="input" type="number" value={form.serviceFee} onChange={set('serviceFee')} /></div>
          <div><label className="label">Parts Cost</label><input className="input" type="number" value={form.partsCost} onChange={set('partsCost')} /></div>
          <div><label className="label">Paid</label><input className="input" type="number" value={form.paid} onChange={set('paid')} /></div>
          <div className="flex flex-col justify-end">
            <span className="label">Total Bill</span>
            <div className="input bg-slate-50 dark:bg-slate-800 flex items-center font-semibold">{taka(total)}</div>
          </div>
        </div>
      </Modal>

      {/* Customer service invoice — print / reprint */}
      <PrintWrapper open={!!printJob} onClose={() => setPrintJob(null)} title="Service Invoice">
        <div className="no-print bg-white p-2 flex gap-2 justify-center">
          <button className={`btn ${printMode === 'a4' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('a4')}>A4</button>
          <button className={`btn ${printMode === 'thermal' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('thermal')}>Thermal 80mm</button>
        </div>
        {printJob && (printMode === 'a4'
          ? <ServiceInvoice job={printJob} business={business} />
          : <ServiceThermal job={printJob} business={business} />)}
      </PrintWrapper>
    </div>
  );
}
