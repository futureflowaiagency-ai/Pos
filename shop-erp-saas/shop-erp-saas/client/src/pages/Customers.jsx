import { useEffect, useState } from 'react';
import { Plus, Trash2, History, HandCoins, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import DueReceipt from '../components/print/DueReceipt.jsx';
import InvoiceA4 from '../components/print/InvoiceA4.jsx';
import ThermalReceipt from '../components/print/ThermalReceipt.jsx';
import { taka, fmtDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

export default function Customers() {
  const { business } = useAuth();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', nid: '' });
  const [history, setHistory] = useState(null);
  const [dueModal, setDueModal] = useState(null);
  const [dueAmount, setDueAmount] = useState(0);
  const [printDue, setPrintDue] = useState(null);
  // reprint a past invoice from a customer's history (unlimited times)
  const [printSale, setPrintSale] = useState(null);
  const [printMode, setPrintMode] = useState(business?.type === 'pharmacy' ? 'thermal' : 'a4');

  const load = async () => { const { data } = await api.get('/customers'); setCustomers(data.data.customers); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await api.post('/customers', form); toast.success('Added'); setModal(false); setForm({ name: '', phone: '', address: '', nid: '' }); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };
  const del = async (c) => {
    const ok = await confirm({
      title: 'Delete customer?',
      message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
      confirmText: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    await api.delete(`/customers/${c._id}`); toast.success('Deleted'); load();
  };
  const viewHistory = async (c) => { const { data } = await api.get(`/customers/${c._id}/history`); setHistory(data.data); };
  const collectDue = async () => {
    const { data } = await api.post(`/customers/${dueModal._id}/collect-due`, { amount: Number(dueAmount) });
    toast.success('Due collected');
    setPrintDue({ customer: data.data.customer, amount: Number(dueAmount) });
    setDueModal(null); setDueAmount(0); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={18} /> Add Customer</button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'totalDue', label: 'Due', className: 'text-right', render: (r) => (
            <span className={r.totalDue > 0 ? 'text-red-500 font-semibold' : ''}>{taka(r.totalDue)}</span>
          )},
          { key: 'actions', label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => viewHistory(r)} className="btn-ghost p-1.5" title="History"><History size={15} /></button>
              <button onClick={() => setDueModal(r)} className="btn-ghost p-1.5 text-green-600" title="Collect due" disabled={r.totalDue <= 0}><HandCoins size={15} /></button>
              <button onClick={() => del(r)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={15} /></button>
            </div>
          )},
        ]}
        rows={customers}
      />

      {/* Add */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Customer"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">NID / Identity</label><input className="input" value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} placeholder="National ID (optional)" /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
      </Modal>

      {/* History */}
      <Modal open={!!history} onClose={() => setHistory(null)} title={`Purchase History — ${history?.customer?.name}`} size="lg">
        {history && (
          <DataTable
            columns={[
              { key: 'invoiceNo', label: 'Invoice' },
              { key: 'createdAt', label: 'Date', render: (r) => fmtDateTime(r.createdAt) },
              { key: 'total', label: 'Total', className: 'text-right', render: (r) => taka(r.total) },
              { key: 'due', label: 'Due', className: 'text-right', render: (r) => taka(r.due) },
              { key: 'print', label: '', className: 'text-right', render: (r) => (
                <button onClick={() => setPrintSale(r)} className="btn-ghost p-1.5" title="Print invoice"><Printer size={15} /></button>
              )},
            ]}
            rows={history.sales}
            empty="No purchases yet"
          />
        )}
      </Modal>

      {/* Collect due */}
      <Modal open={!!dueModal} onClose={() => setDueModal(null)} title={`Collect Due — ${dueModal?.name}`}
        footer={<><button className="btn-ghost" onClick={() => setDueModal(null)}>Cancel</button><button className="btn-primary" onClick={collectDue}>Collect</button></>}>
        <p className="text-sm mb-2">Current due: <strong className="text-red-500">{taka(dueModal?.totalDue)}</strong></p>
        <label className="label">Amount to collect</label>
        <input className="input" type="number" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} />
      </Modal>

      {/* Due receipt print */}
      <PrintWrapper open={!!printDue} onClose={() => setPrintDue(null)} title="Due Receipt">
        {printDue && <DueReceipt customer={printDue.customer} amount={printDue.amount} business={business} />}
      </PrintWrapper>

      {/* Invoice reprint from history */}
      <PrintWrapper open={!!printSale} onClose={() => setPrintSale(null)} title="Invoice">
        <div className="no-print bg-white p-2 flex gap-2 justify-center">
          <button className={`btn ${printMode === 'a4' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('a4')}>A4</button>
          <button className={`btn ${printMode === 'thermal' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('thermal')}>Thermal 80mm</button>
        </div>
        {printSale && (printMode === 'a4'
          ? <InvoiceA4 sale={printSale} business={business} />
          : <ThermalReceipt sale={printSale} business={business} />)}
      </PrintWrapper>
    </div>
  );
}
