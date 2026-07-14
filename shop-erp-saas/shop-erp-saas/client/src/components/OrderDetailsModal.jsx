import { useEffect, useState } from 'react';
import { Printer, Pencil, HandCoins, Undo2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import Modal from './ui/Modal.jsx';
import PrintWrapper from './print/PrintWrapper.jsx';
import ThermalReceipt from './print/ThermalReceipt.jsx';
import DuePaymentInvoice from './print/DuePaymentInvoice.jsx';
import ReturnExchangeModal from './ReturnExchangeModal.jsx';
import { taka, fmtDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

const TENDERS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'];

// View a single order/invoice with full details, then reprint, edit, or collect
// its due. Used from the dashboard Recent Orders (req 3) and reusable elsewhere.
export default function OrderDetailsModal({ saleId, onClose, onChanged }) {
  const { business } = useAuth();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('view'); // view | edit | due
  const [edit, setEdit] = useState({ discount: 0, paid: 0, paymentMethod: 'cash', customerName: '' });
  const [dueForm, setDueForm] = useState({ amount: 0, method: 'cash' });
  const [reprint, setReprint] = useState(false);
  const [dueInvoice, setDueInvoice] = useState(null); // { sale, duePayment }
  const [showReturn, setShowReturn] = useState(false);

  const fetchSale = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sales/${saleId}`);
      const s = data.data.sale;
      setSale(s);
      setEdit({ discount: s.discount, paid: s.paid, paymentMethod: TENDERS.includes(s.paidVia) ? s.paidVia : 'cash', customerName: s.customerName });
      setDueForm({ amount: s.due, method: 'cash' });
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to load order'); }
    setLoading(false);
  };
  useEffect(() => { if (saleId) fetchSale(); }, [saleId]);

  const saveEdit = async () => {
    try {
      await api.patch(`/sales/${saleId}`, {
        discount: Number(edit.discount) || 0,
        paid: Number(edit.paid) || 0,
        paymentMethod: edit.paymentMethod,
        customerName: edit.customerName,
      });
      toast.success('Invoice updated');
      setMode('view'); await fetchSale(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
  };

  const collect = async () => {
    const amt = Number(dueForm.amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    try {
      const { data } = await api.post(`/sales/${saleId}/collect-due`, { amount: amt, method: dueForm.method });
      toast.success('Due collected');
      setDueInvoice({ sale: data.data.sale, duePayment: data.data.duePayment });
      setMode('view'); await fetchSale(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.message || 'Collection failed'); }
  };

  const paidTotal = sale ? (sale.total - sale.due) : 0;
  const hasReturnable = sale ? sale.items.some((it) => (it.qty - (it.returnedQty || 0)) > 0) : false;

  return (
    <>
      <Modal open onClose={onClose} title={sale ? `Invoice ${sale.invoiceNo}` : 'Order'} size="lg"
        footer={sale && mode === 'view' ? (
          <>
            <button className="btn-ghost" onClick={() => setReprint(true)}><Printer size={16} /> Reprint</button>
            <button className="btn-ghost" onClick={() => setMode('edit')}><Pencil size={16} /> Edit</button>
            {hasReturnable && <button className="btn-ghost" onClick={() => setShowReturn(true)}><Undo2 size={16} /> Return / Exchange</button>}
            {sale.due > 0 && <button className="btn-primary" onClick={() => setMode('due')}><HandCoins size={16} /> Collect Due</button>}
          </>
        ) : (
          <button className="btn-ghost" onClick={() => (mode === 'view' ? onClose() : setMode('view'))}>{mode === 'view' ? 'Close' : 'Back'}</button>
        )}>
        {loading || !sale ? (
          <p className="text-center py-8 text-slate-400">Loading…</p>
        ) : mode === 'edit' ? (
          <div className="space-y-3">
            <div><label className="label">Customer Name</label><input className="input" value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Discount (flat)</label><input className="input" type="number" value={edit.discount} onChange={(e) => setEdit({ ...edit, discount: e.target.value })} /></div>
              <div><label className="label">Paid (at sale)</label><input className="input" type="number" value={edit.paid} onChange={(e) => setEdit({ ...edit, paid: e.target.value })} /></div>
            </div>
            <div><label className="label">Payment Method</label>
              <select className="input" value={edit.paymentMethod} onChange={(e) => setEdit({ ...edit, paymentMethod: e.target.value })}>
                <option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option>
                <option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="card">Card</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">Editing amounts recomputes total, due and profit. To add/remove items, use Return &amp; Exchange.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setMode('view')}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        ) : mode === 'due' ? (
          <div className="space-y-3">
            <p className="text-sm">Current due: <strong className="text-red-500">{taka(sale.due)}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount to collect</label><input className="input" type="number" value={dueForm.amount} onChange={(e) => setDueForm({ ...dueForm, amount: e.target.value })} /></div>
              <div><label className="label">Method</label>
                <select className="input" value={dueForm.method} onChange={(e) => setDueForm({ ...dueForm, method: e.target.value })}>
                  <option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="card">Card</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setMode('view')}>Cancel</button>
              <button className="btn-primary" onClick={collect}>Collect &amp; print</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <div>
                <p className="font-medium">{sale.customerName}</p>
                {sale.customerNid && <p className="text-xs text-slate-400">NID: {sale.customerNid}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">{fmtDateTime(sale.createdAt)}</p>
                <span className={`badge ${sale.due > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {sale.due > 0 ? 'DUE' : 'PAID'} · {(sale.paymentMethod || '').toUpperCase()}
                </span>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Price</th></tr>
                </thead>
                <tbody>
                  {sale.items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2">
                        {it.name}
                        {it.imei1 && <div className="text-xs text-slate-400">IMEI: {it.imei1}</div>}
                        {it.serial && <div className="text-xs text-slate-400">SN: {it.serial}</div>}
                        {it.returnedQty > 0 && <div className="text-xs text-amber-600">{it.returnedQty} returned</div>}
                      </td>
                      <td className="px-3 py-2 text-center">{it.qty}</td>
                      <td className="px-3 py-2 text-right">{taka(it.sellingPrice * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 text-sm">
              <Row l="Subtotal" r={taka(sale.subTotal)} />
              <Row l="Discount" r={`-${taka(sale.discount)}`} />
              <Row l="Total" r={taka(sale.total)} bold />
              <Row l="Paid" r={taka(paidTotal)} />
              <Row l="Due" r={taka(sale.due)} red={sale.due > 0} />
            </div>
          </div>
        )}
      </Modal>

      <PrintWrapper open={reprint} onClose={() => setReprint(false)} title="Invoice">
        <ThermalReceipt sale={sale} business={business} />
      </PrintWrapper>
      <PrintWrapper open={!!dueInvoice} onClose={() => setDueInvoice(null)} title="Due Payment Invoice">
        {dueInvoice && <DuePaymentInvoice sale={dueInvoice.sale} duePayment={dueInvoice.duePayment} business={business} />}
      </PrintWrapper>
      {showReturn && sale && (
        <ReturnExchangeModal
          sale={sale}
          onClose={() => setShowReturn(false)}
          onDone={async () => { await fetchSale(); onChanged?.(); }}
        />
      )}
    </>
  );
}

const Row = ({ l, r, bold, red }) => (
  <div className={`flex justify-between ${bold ? 'font-bold text-base' : ''} ${red ? 'text-red-500' : ''}`}>
    <span>{l}</span><span>{r}</span>
  </div>
);
