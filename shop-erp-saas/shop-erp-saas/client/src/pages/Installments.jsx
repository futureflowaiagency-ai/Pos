import { useEffect, useState } from 'react';
import { Plus, CalendarClock, Trash2, CheckCircle2, ScanLine, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import EmiPaymentInvoice from '../components/print/EmiPaymentInvoice.jsx';
import { taka, fmtDate } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

const balance = (p) => {
  const paid = (p.schedule || []).filter((s) => s.paid).reduce((a, s) => a + s.amount, 0);
  return Math.max(0, (p.totalAmount || 0) - (p.downPayment || 0) - paid);
};

const emptyForm = {
  customer: '', productName: '', totalAmount: '', downPayment: 0, downPaymentMethod: 'cash', months: 3, firstDueDate: '',
  product: null, unit: null, imei1: '', imei2: '', serial: '', trackSerial: false,
  customerPhone: '', customerNid: '', presentAddress: '', permanentAddress: '',
  fatherName: '', fatherNid: '', fatherPhone: '', motherName: '', motherNid: '', motherPhone: '',
  guarantorName: '', guarantorPhone: '', guarantorNid: '', guarantorAddress: '',
};

export default function Installments() {
  const confirm = useConfirm();
  const { business } = useAuth();
  const [plans, setPlans] = useState([]);
  const [emiReceivable, setEmiReceivable] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [imeiScan, setImeiScan] = useState('');
  // pay flow
  const [payRow, setPayRow] = useState(null); // { plan, no }
  const [payMethod, setPayMethod] = useState('cash');
  const [receipt, setReceipt] = useState(null); // { installment, row }

  const load = async () => {
    const { data } = await api.get('/installments');
    setPlans(data.data.installments);
    setEmiReceivable(data.data.emiReceivable || 0);
  };
  useEffect(() => { load(); api.get('/customers').then(({ data }) => setCustomers(data.data.customers)); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickCustomer = (id) => {
    const c = customers.find((x) => x._id === id);
    setForm({ ...form, customer: id, customerPhone: c?.phone || form.customerPhone, customerNid: c?.nid || form.customerNid });
  };

  const scanBarcode = async () => {
    const code = barcode.trim();
    if (!code) return;
    try {
      const { data } = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      const p = data.data.product;
      const price = p.discountPercent > 0 ? Math.round(p.sellingPrice * (1 - p.discountPercent / 100)) : p.sellingPrice;
      setForm((f) => ({ ...f, product: p._id, productName: p.name, totalAmount: price, trackSerial: !!p.trackSerial, unit: null, imei1: '', imei2: '', serial: '' }));
      setBarcode('');
      toast.success(p.trackSerial ? `${p.name} — now scan the device IMEI` : `${p.name} added`);
    } catch (e) { toast.error(e.response?.data?.message || 'Barcode not found'); }
  };

  const scanImei = async () => {
    const term = imeiScan.trim();
    if (!term) return;
    try {
      const { data } = await api.get('/units/lookup', { params: { imei: term } });
      const u = data.data.unit;
      if (form.product && String(u.product?._id || u.product) !== String(form.product)) {
        return toast.error('This device does not match the selected product');
      }
      setForm((f) => ({ ...f, unit: u._id, imei1: u.imei1, imei2: u.imei2, serial: u.serial }));
      setImeiScan('');
      toast.success('Device linked');
    } catch (e) { toast.error(e.response?.data?.message || 'Device not found'); }
  };

  const create = async () => {
    if (!form.customer) return toast.error('Please select a customer');
    if (Number(form.totalAmount) <= 0) return toast.error('Enter a valid total amount');
    if (Number(form.months) < 1) return toast.error('Months must be at least 1');
    if (form.trackSerial && !form.unit) return toast.error('Scan the device IMEI/serial');
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
      setForm(emptyForm); setBarcode(''); setImeiScan('');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const openPay = (plan, no) => { setPayRow({ plan, no }); setPayMethod('cash'); };
  const confirmPay = async () => {
    try {
      const { data } = await api.patch(`/installments/${payRow.plan._id}/pay`, { no: payRow.no, method: payMethod });
      setDetail(data.data.installment);
      setReceipt({ installment: data.data.installment, row: data.data.paidRow });
      setPayRow(null);
      load();
      toast.success('Instalment paid');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const del = async (plan) => {
    const ok = await confirm({ title: 'Delete EMI plan?', message: 'This will remove the instalment plan permanently.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    await api.delete(`/installments/${plan._id}`); toast.success('Deleted'); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock size={24} /> EMI / Installments</h1>
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}><Plus size={18} /> New EMI Plan</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CalendarClock} label="Total EMI Receivable" value={taka(emiReceivable)} accent="red" />
        <StatCard icon={CheckCircle2} label="Active Plans" value={plans.filter((p) => p.status === 'active').length} accent="amber" />
        <StatCard icon={CheckCircle2} label="Completed Plans" value={plans.filter((p) => p.status === 'completed').length} accent="green" />
      </div>

      <DataTable
        columns={[
          { key: 'customerName', label: 'Customer', render: (r) => r.customerName || '—' },
          { key: 'productName', label: 'Item', render: (r) => (
            <div>{r.productName || '—'}{r.imei1 && <div className="text-xs text-slate-400">IMEI: {r.imei1}</div>}</div>
          )},
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
      <Modal open={modal} onClose={() => setModal(false)} title="New EMI Plan" size="xl"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={create}>Create Plan</button></>}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Item</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="label">Scan Product Barcode</label>
                <div className="flex gap-2">
                  <ScanLine size={18} className="mt-2.5 text-brand-500 shrink-0" />
                  <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') scanBarcode(); }} placeholder="Scan or type barcode..." />
                </div>
              </div>
              {form.trackSerial && (
                <div>
                  <label className="label">Scan Device IMEI / Serial</label>
                  <div className="flex gap-2">
                    <ScanLine size={18} className="mt-2.5 text-brand-500 shrink-0" />
                    <input className="input" value={imeiScan} onChange={(e) => setImeiScan(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') scanImei(); }} placeholder="Scan IMEI..." />
                  </div>
                  {form.imei1 && <p className="text-xs text-green-600 mt-1">✓ Linked: {form.imei1}</p>}
                </div>
              )}
              <div className="col-span-2"><label className="label">Item / Description</label><input className="input" value={form.productName} onChange={set('productName')} placeholder="e.g. iPhone 15 Pro 128GB" /></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Customer</label>
                <select className="input" value={form.customer} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                </select>
              </div>
              <div><label className="label">Customer Mobile</label><input className="input" value={form.customerPhone} onChange={set('customerPhone')} /></div>
              <div><label className="label">Customer NID</label><input className="input" value={form.customerNid} onChange={set('customerNid')} /></div>
              <div><label className="label">Present Address</label><input className="input" value={form.presentAddress} onChange={set('presentAddress')} /></div>
              <div><label className="label">Permanent Address</label><input className="input" value={form.permanentAddress} onChange={set('permanentAddress')} /></div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Parents' Info</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Father's Name</label><input className="input" value={form.fatherName} onChange={set('fatherName')} /></div>
              <div><label className="label">Father's NID</label><input className="input" value={form.fatherNid} onChange={set('fatherNid')} /></div>
              <div><label className="label">Father's Mobile</label><input className="input" value={form.fatherPhone} onChange={set('fatherPhone')} /></div>
              <div><label className="label">Mother's Name</label><input className="input" value={form.motherName} onChange={set('motherName')} /></div>
              <div><label className="label">Mother's NID</label><input className="input" value={form.motherNid} onChange={set('motherNid')} /></div>
              <div><label className="label">Mother's Mobile</label><input className="input" value={form.motherPhone} onChange={set('motherPhone')} /></div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Guarantor</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Guarantor Name</label><input className="input" value={form.guarantorName} onChange={set('guarantorName')} /></div>
              <div><label className="label">Guarantor Mobile</label><input className="input" value={form.guarantorPhone} onChange={set('guarantorPhone')} /></div>
              <div><label className="label">Guarantor NID</label><input className="input" value={form.guarantorNid} onChange={set('guarantorNid')} /></div>
              <div><label className="label">Guarantor Address</label><input className="input" value={form.guarantorAddress} onChange={set('guarantorAddress')} /></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Payment Plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Total Amount</label><input className="input" type="number" value={form.totalAmount} onChange={set('totalAmount')} /></div>
              <div><label className="label">Number of Months</label><input className="input" type="number" min="1" value={form.months} onChange={set('months')} /></div>
              <div><label className="label">Down Payment</label><input className="input" type="number" value={form.downPayment} onChange={set('downPayment')} /></div>
              <div><label className="label">Down Payment Method</label>
                <select className="input" value={form.downPaymentMethod} onChange={set('downPaymentMethod')}>
                  <option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="card">Card</option>
                </select>
              </div>
              <div><label className="label">First Due Date</label><input className="input" type="date" value={form.firstDueDate} onChange={set('firstDueDate')} /></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Financed amount {taka(Math.max(0, Number(form.totalAmount || 0) - Number(form.downPayment || 0)))} will be split into {form.months || 0} monthly instalments.
            </p>
          </div>
        </div>
      </Modal>

      {/* Detail / schedule */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`EMI — ${detail.customerName || '—'}`} size="lg" footer={<button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>}>
          <div className="grid grid-cols-4 gap-3 mb-3 text-center text-sm">
            <div className="card p-2"><p className="text-xs text-slate-400">Total</p><p className="font-bold">{taka(detail.totalAmount)}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Down</p><p className="font-bold">{taka(detail.downPayment)}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Balance</p><p className="font-bold text-red-500">{taka(balance(detail))}</p></div>
            <div className="card p-2"><p className="text-xs text-slate-400">Months</p><p className="font-bold">{detail.months}</p></div>
          </div>
          {detail.imei1 && <p className="text-xs text-slate-500 mb-2">Device IMEI: {detail.imei1}{detail.imei2 ? ` / ${detail.imei2}` : ''}</p>}
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
                        ? <span className="badge bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Paid ({s.method || 'cash'})</span>
                        : <span className="badge bg-amber-100 text-amber-700">Unpaid</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!s.paid && <button className="btn-primary text-xs py-1" onClick={() => openPay(detail, s.no)}>Mark Paid</button>}
                      {s.paid && <button className="btn-ghost p-1" title="Print receipt" onClick={() => setReceipt({ installment: detail, row: s })}><Printer size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Pay — choose method */}
      <Modal open={!!payRow} onClose={() => setPayRow(null)} title="Collect Instalment Payment"
        footer={<><button className="btn-ghost" onClick={() => setPayRow(null)}>Cancel</button><button className="btn-primary" onClick={confirmPay}>Confirm &amp; print</button></>}>
        {payRow && (
          <div className="space-y-3">
            <p className="text-sm">Instalment #{payRow.no} — <strong>{taka(payRow.plan.schedule.find((s) => s.no === payRow.no)?.amount)}</strong></p>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option>
                <option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="card">Card</option>
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Per-instalment payment receipt */}
      <PrintWrapper open={!!receipt} onClose={() => setReceipt(null)} title="EMI Payment Receipt">
        {receipt && <EmiPaymentInvoice installment={receipt.installment} row={receipt.row} business={business} />}
      </PrintWrapper>
    </div>
  );
}
