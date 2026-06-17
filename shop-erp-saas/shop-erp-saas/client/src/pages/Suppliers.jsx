import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Wallet, PackagePlus, ScrollText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import PurchaseReceipt from '../components/print/PurchaseReceipt.jsx';
import { taka, fmtDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

const empty = { name: '', phone: '', address: '', note: '' };
const due = (s) => Math.max(0, (s.totalPurchase || 0) - (s.totalPaid || 0));

export default function Suppliers() {
  const confirm = useConfirm();
  const { business } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  // purchase report to print/reprint: { purchase, supplier }
  const [printPurchase, setPrintPurchase] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  // purchase / payment / ledger sub-modals
  const [purchaseFor, setPurchaseFor] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [ledgerFor, setLedgerFor] = useState(null);

  const load = async () => {
    const { data } = await api.get('/suppliers', { params: { search } });
    setSuppliers(data.data.suppliers);
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = (s) => { setForm({ name: s.name, phone: s.phone || '', address: s.address || '', note: s.note || '' }); setEditId(s._id); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post('/suppliers', form);
      toast.success('Saved'); setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const del = async (s) => {
    const ok = await confirm({ title: 'Delete supplier?', message: `Delete "${s.name}"?`, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    await api.delete(`/suppliers/${s._id}`); toast.success('Deleted'); load();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <button className="btn-primary" onClick={openNew}><Plus size={18} /> Add Supplier</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
        <input className="input pl-10" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
          { key: 'totalPurchase', label: 'Total Purchase', className: 'text-right', render: (r) => taka(r.totalPurchase) },
          { key: 'totalPaid', label: 'Paid', className: 'text-right', render: (r) => taka(r.totalPaid) },
          { key: 'due', label: 'Due', className: 'text-right', render: (r) => (
            <span className={due(r) > 0 ? 'text-red-500 font-semibold' : 'text-green-600'}>{taka(due(r))}</span>
          )},
          { key: 'actions', label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => setPurchaseFor(r)} className="btn-ghost p-1.5" title="Record purchase"><PackagePlus size={15} /></button>
              <button onClick={() => setPayFor(r)} className="btn-ghost p-1.5" title="Pay due"><Wallet size={15} /></button>
              <button onClick={() => setLedgerFor(r)} className="btn-ghost p-1.5" title="Ledger"><ScrollText size={15} /></button>
              <button onClick={() => openEdit(r)} className="btn-ghost p-1.5"><Pencil size={15} /></button>
              <button onClick={() => del(r)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={15} /></button>
            </div>
          )},
        ]}
        rows={suppliers}
        empty="No suppliers yet"
      />

      {/* Add / Edit */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Supplier' : 'Add Supplier'}
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
          <div className="col-span-2"><label className="label">Note</label><input className="input" value={form.note} onChange={set('note')} /></div>
        </div>
      </Modal>

      {purchaseFor && <PurchaseModal supplier={purchaseFor} onClose={() => setPurchaseFor(null)} onDone={load} onPrint={setPrintPurchase} />}
      {payFor && <PayModal supplier={payFor} onClose={() => setPayFor(null)} onDone={load} />}
      {ledgerFor && <LedgerModal supplier={ledgerFor} onClose={() => setLedgerFor(null)} onPrint={setPrintPurchase} />}

      {/* Purchase report print / reprint */}
      <PrintWrapper open={!!printPurchase} onClose={() => setPrintPurchase(null)} title="Purchase Report">
        {printPurchase && <PurchaseReceipt purchase={printPurchase.purchase} supplier={printPurchase.supplier} business={business} />}
      </PrintWrapper>
    </div>
  );
}

function PurchaseModal({ supplier, onClose, onDone, onPrint }) {
  const [items, setItems] = useState([{ name: '', qty: 1, unitCost: 0 }]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState(0);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((s, it) => s + Number(it.unitCost || 0) * Number(it.qty || 0), 0);
  const setItem = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addRow = () => setItems([...items, { name: '', qty: 1, unitCost: 0 }]);
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const submit = async () => {
    const clean = items.filter((it) => it.name.trim() && Number(it.qty) > 0 && Number(it.unitCost) >= 0);
    if (!clean.length) return toast.error('Add at least one item');
    setSaving(true);
    try {
      const { data } = await api.post(`/suppliers/${supplier._id}/purchase`, { items: clean, reference, note, paid: Number(paid || 0) });
      toast.success('Purchase recorded'); onDone(); onClose();
      onPrint?.({ purchase: data.data.purchase, supplier: data.data.supplier || supplier });
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={`Record Purchase — ${supplier.name}`} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving} onClick={submit}>Save Purchase</button></>}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="label">Reference / Memo No</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <label className="label">Items</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className="input col-span-6" placeholder="Item name" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
            <input className="input col-span-2" type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
            <input className="input col-span-3" type="number" placeholder="Unit cost" value={it.unitCost} onChange={(e) => setItem(i, 'unitCost', e.target.value)} />
            <button className="text-red-500 col-span-1" onClick={() => removeRow(i)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button className="btn-ghost mt-2" onClick={addRow}><Plus size={15} /> Add Item</button>

      <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between col-span-2 font-semibold"><span>Total</span><span>{taka(total)}</span></div>
        <div><label className="label">Paid now</label><input className="input" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" /></div>
        <div className="flex flex-col justify-end">
          <span className="label">Due added</span>
          <div className="input bg-slate-50 dark:bg-slate-800 flex items-center font-semibold text-red-500">{taka(Math.max(0, total - Number(paid || 0)))}</div>
        </div>
      </div>
    </Modal>
  );
}

function PayModal({ supplier, onClose, onDone }) {
  const confirm = useConfirm();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const due = Math.max(0, (supplier.totalPurchase || 0) - (supplier.totalPaid || 0));

  const submit = async () => {
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) return toast.error('Enter a valid amount');
    const ok = await confirm({
      title: 'Record payment?',
      message: `Are you sure you want to record this payment of ${taka(Number(amount))}?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      tone: 'success',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.post(`/suppliers/${supplier._id}/pay`, { amount: Number(amount), note });
      toast.success('Payment recorded'); onDone(); onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={`Pay — ${supplier.name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving} onClick={submit}>Record Payment</button></>}>
      <p className="text-sm mb-3">Current due: <strong className="text-red-500">{taka(due)}</strong></p>
      <div className="space-y-3">
        <div><label className="label">Amount</label><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function LedgerModal({ supplier, onClose, onPrint }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/suppliers/${supplier._id}`).then(({ data }) => setData(data.data)); }, [supplier._id]);

  return (
    <Modal open onClose={onClose} title={`Ledger — ${supplier.name}`} size="lg" footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
      {!data ? <p className="text-slate-400 text-center py-6">Loading...</p> : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-3 text-center">
            <div className="card p-3"><p className="text-xs text-slate-400">Total Purchase</p><p className="font-bold">{taka(data.supplier.totalPurchase)}</p></div>
            <div className="card p-3"><p className="text-xs text-slate-400">Paid</p><p className="font-bold">{taka(data.supplier.totalPaid)}</p></div>
            <div className="card p-3"><p className="text-xs text-slate-400">Due</p><p className="font-bold text-red-500">{taka(due(data.supplier))}</p></div>
          </div>
          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Ref</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {data.entries.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No entries</td></tr>}
                {data.entries.map((e) => (
                  <tr key={e._id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2">{fmtDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2 capitalize">{e.kind}</td>
                    <td className="px-3 py-2">{e.reference || e.note || '—'}</td>
                    <td className="px-3 py-2 text-right">{taka(e.total)}</td>
                    <td className="px-3 py-2 text-right">{taka(e.paid)}</td>
                    <td className="px-3 py-2 text-right">
                      {e.kind === 'purchase' && (
                        <button onClick={() => onPrint?.({ purchase: e, supplier: data.supplier })} className="btn-ghost p-1" title="Print purchase report"><Printer size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
