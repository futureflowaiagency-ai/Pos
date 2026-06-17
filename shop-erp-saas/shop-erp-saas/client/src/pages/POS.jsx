import { useEffect, useState } from 'react';
import { Plus, Minus, Trash2, Search, Printer, Receipt, PauseCircle, ListChecks, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import { taka, fmtDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/ui/Modal.jsx';
import PrintWrapper from '../components/print/PrintWrapper.jsx';
import InvoiceA4 from '../components/print/InvoiceA4.jsx';
import ThermalReceipt from '../components/print/ThermalReceipt.jsx';

// effective unit price after the product's percentage discount
const unitPrice = (p) => Math.round((p.sellingPrice * (1 - (p.discountPercent || 0) / 100)) * 100) / 100;
// keep a typed quantity within [0, stock]; supports decimals (e.g. kg)
const clampQty = (q, stock) => {
  let n = Number(q);
  if (Number.isNaN(n) || n < 0) n = 0;
  if (stock != null && n > stock) n = stock;
  return n;
};
// stable per-line key: serial-tracked units are unique, products stack by id.
// NOTE: `unitId` is the phone-unit (IMEI) id — kept separate from the product's
// measurement `unit` field ('pcs'/'kg') so normal products never look serial-tracked.
const lineKey = (i) => (i.unitId ? `u:${i.unitId}` : `p:${i._id}`);

export default function POS() {
  const { business } = useAuth();
  const isMobile = business?.type === 'mobile';
  const heldKey = `pos_holds_${business?._id || business?.id || 'default'}`;

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState('');
  const [customerNid, setCustomerNid] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState('cash');
  const [lastSale, setLastSale] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printMode, setPrintMode] = useState(business?.type === 'pharmacy' ? 'thermal' : 'a4');
  // hold-cart state
  const [holds, setHolds] = useState([]);
  const [holdsOpen, setHoldsOpen] = useState(false);
  // mobile IMEI scan
  const [imei, setImei] = useState('');

  const load = async () => {
    const { data } = await api.get('/products', { params: { search } });
    setProducts(data.data.products);
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { api.get('/customers').then(({ data }) => setCustomers(data.data.customers)); }, []);
  useEffect(() => { setHolds(readHolds(heldKey)); }, [heldKey]);

  // ---------- cart ops ----------
  const addToCart = (p) => {
    if (p.trackSerial) { toast.error('Scan the IMEI / serial to add this device'); return; }
    setCart((c) => {
      const ex = c.find((i) => !i.unitId && i._id === p._id);
      if (ex) {
        if (ex.qty >= p.stock) { toast.error('Not enough stock'); return c; }
        return c.map((i) => (!i.unitId && i._id === p._id) ? { ...i, qty: i.qty + 1 } : i);
      }
      if (p.stock < 1) { toast.error('Out of stock'); return c; }
      return [...c, { ...p, qty: 1 }];
    });
  };

  const addByImei = async () => {
    const term = imei.trim();
    if (!term) return;
    try {
      const { data } = await api.get('/units/lookup', { params: { imei: term } });
      const u = data.data.unit;
      const p = u.product;
      setCart((c) => {
        if (c.some((i) => i.unitId === u._id)) { toast.error('Device already in cart'); return c; }
        return [...c, {
          _id: p._id, name: p.name, sellingPrice: p.sellingPrice, discountPercent: p.discountPercent || 0,
          qty: 1, unitId: u._id, imei1: u.imei1, imei2: u.imei2, serial: u.serial,
        }];
      });
      setImei('');
    } catch (e) { toast.error(e.response?.data?.message || 'Device not found'); }
  };

  const changeQty = (key, d) => setCart((c) => c.map((i) => (lineKey(i) === key && !i.unitId) ? { ...i, qty: clampQty(i.qty + d, i.stock) } : i));
  // direct quantity entry (supports decimals, e.g. 1.5 kg); empty string allowed while typing
  const setQty = (key, val) => setCart((c) => c.map((i) => {
    if (lineKey(i) !== key || i.unitId) return i;
    if (val === '') return { ...i, qty: '' };
    const q = clampQty(Number(val), i.stock);
    if (i.stock != null && Number(val) > i.stock) toast.error('Not enough stock');
    return { ...i, qty: q };
  }));
  const removeItem = (key) => setCart((c) => c.filter((i) => lineKey(i) !== key));
  const resetSale = () => { setCart([]); setDiscount(0); setPaid(0); setCustomer(''); setCustomerNid(''); };

  const subTotal = cart.reduce((s, i) => s + unitPrice(i) * Number(i.qty || 0), 0);
  const total = Math.max(0, subTotal - Number(discount || 0));
  const due = Math.max(0, total - Number(paid || 0));

  // ---------- hold / resume ----------
  const holdCart = () => {
    if (!cart.length) return toast.error('Cart is empty');
    const cName = customers.find((c) => c._id === customer)?.name || 'Walk-in';
    const entry = {
      id: Date.now().toString(),
      heldAt: new Date().toISOString(),
      customerName: cName,
      customer, customerNid, discount, paid, method,
      itemCount: cart.reduce((s, i) => s + i.qty, 0),
      cart,
    };
    const next = [entry, ...holds];
    setHolds(next); writeHolds(heldKey, next);
    resetSale();
    toast.success('Cart held');
  };

  const resumeHold = (h) => {
    if (cart.length && !confirm('Resuming will replace the current cart. Continue?')) return;
    setCart(h.cart); setCustomer(h.customer || ''); setCustomerNid(h.customerNid || '');
    setDiscount(h.discount || 0); setPaid(h.paid || 0); setMethod(h.method || 'cash');
    const next = holds.filter((x) => x.id !== h.id);
    setHolds(next); writeHolds(heldKey, next);
    setHoldsOpen(false);
    toast.success('Cart resumed');
  };

  const deleteHold = (id) => {
    const next = holds.filter((x) => x.id !== id);
    setHolds(next); writeHolds(heldKey, next);
  };

  // ---------- checkout ----------
  const checkout = async () => {
    if (!cart.length) return toast.error('Cart is empty');
    if (cart.some((i) => !i.unitId && Number(i.qty) <= 0)) return toast.error('Enter a valid quantity');
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((i) => i.unitId ? { product: i._id, qty: 1, unit: i.unitId } : { product: i._id, qty: Number(i.qty) }),
        discount: Number(discount || 0),
        paid: Number(paid || 0) || total,
        paymentMethod: method,
        customer: customer || null,
        customerNid: isMobile ? customerNid : '',
      });
      setLastSale(data.data.sale);
      toast.success('Sale completed!');
      resetSale();
      load();
      setShowPrint(true);
    } catch (e) { toast.error(e.response?.data?.message || 'Checkout failed'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Product picker */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">POS / New Sale</h1>
          <button className="btn-ghost" onClick={() => setHoldsOpen(true)}>
            <ListChecks size={16} /> Held Bills {holds.length > 0 && <span className="badge bg-amber-100 text-amber-700">{holds.length}</span>}
          </button>
        </div>

        {isMobile && (
          <div className="card p-3 flex items-center gap-2">
            <ScanLine size={18} className="text-brand-500 shrink-0" />
            <input
              className="input"
              placeholder="Scan or type IMEI / Serial to add a device..."
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addByImei(); }}
            />
            <button className="btn-primary shrink-0" onClick={addByImei}>Add</button>
          </div>
        )}

        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-10" placeholder="Search products to add..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {products.map((p) => (
            <button key={p._id} onClick={() => addToCart(p)} className="card p-3 text-left hover:ring-2 hover:ring-brand-500 transition">
              <p className="font-medium text-sm truncate">{p.name}</p>
              {p.discountPercent > 0 ? (
                <p className="font-bold">
                  <span className="text-xs line-through text-slate-400 mr-1">{taka(p.sellingPrice)}</span>
                  <span className="text-brand-600">{taka(unitPrice(p))}</span>
                  <span className="badge bg-green-100 text-green-700 ml-1">-{p.discountPercent}%</span>
                </p>
              ) : (
                <p className="text-brand-600 font-bold">{taka(p.sellingPrice)}</p>
              )}
              <p className="text-xs text-slate-400">Stock: {p.stock}{p.trackSerial ? ' (scan IMEI)' : ''}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="card p-4 flex flex-col h-fit lg:sticky lg:top-20">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Receipt size={18} /> Cart</h2>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {cart.length === 0 && <p className="text-slate-400 text-sm py-6 text-center">No items added</p>}
          {cart.map((i) => (
            <div key={lineKey(i)} className="flex items-center gap-2 text-sm">
              <div className="flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-slate-400">
                  {taka(unitPrice(i))} × {i.qty}{i.discountPercent > 0 ? ` (-${i.discountPercent}%)` : ''}
                </p>
                {i.unitId && <p className="text-xs text-brand-500">IMEI: {i.imei1 || i.serial}</p>}
              </div>
              {!i.unitId && <button onClick={() => changeQty(lineKey(i), -1)} className="btn-ghost p-1"><Minus size={14} /></button>}
              {!i.unitId && (
                <input
                  type="number" min="0" step="any"
                  className="input w-16 text-center px-1 py-1"
                  value={i.qty}
                  onChange={(e) => setQty(lineKey(i), e.target.value)}
                  onBlur={(e) => { if (e.target.value === '' || Number(e.target.value) <= 0) setQty(lineKey(i), '1'); }}
                />
              )}
              {!i.unitId && <button onClick={() => changeQty(lineKey(i), 1)} className="btn-ghost p-1"><Plus size={14} /></button>}
              <button onClick={() => removeItem(lineKey(i))} className="text-red-500 p-1"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-3 space-y-2 text-sm">
          <div>
            <label className="label">Customer (optional)</label>
            <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          {isMobile && (
            <div>
              <label className="label">Customer NID / Identity</label>
              <input className="input" value={customerNid} onChange={(e) => setCustomerNid(e.target.value)} placeholder="NID number (for warranty / records)" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Discount</label><input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div><label className="label">Paid</label><input className="input" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={total} /></div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="bkash">bKash</option>
              <option value="nagad">Nagad</option><option value="card">Card</option>
              {isMobile && <option value="emi">EMI / Installment</option>}
            </select>
          </div>
          <div className="flex justify-between"><span>Subtotal</span><span>{taka(subTotal)}</span></div>
          <div className="flex justify-between"><span>Discount (flat)</span><span>-{taka(Number(discount || 0))}</span></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{taka(total)}</span></div>
          <div className="flex justify-between text-red-500"><span>Due</span><span>{taka(due)}</span></div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="btn-ghost" onClick={holdCart}><PauseCircle size={16} /> Hold</button>
            <button className="btn-primary" onClick={checkout}>Complete Sale</button>
          </div>
          {lastSale && (
            <button className="btn-ghost w-full" onClick={() => setShowPrint(true)}><Printer size={16} /> Reprint last invoice</button>
          )}
        </div>
      </div>

      {/* Held bills */}
      <Modal open={holdsOpen} onClose={() => setHoldsOpen(false)} title="Held Bills" size="lg">
        {holds.length === 0 ? (
          <p className="text-slate-400 text-center py-6">No held bills</p>
        ) : (
          <div className="space-y-2">
            {holds.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium">{h.customerName}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(h.heldAt)} • {h.itemCount} item(s)</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => resumeHold(h)}>Resume</button>
                  <button className="btn-ghost text-red-500" onClick={() => deleteHold(h.id)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Print preview */}
      <PrintWrapper open={showPrint} onClose={() => setShowPrint(false)} title="Invoice">
        <div className="no-print bg-white p-2 flex gap-2 justify-center">
          <button className={`btn ${printMode === 'a4' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('a4')}>A4</button>
          <button className={`btn ${printMode === 'thermal' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintMode('thermal')}>Thermal 80mm</button>
        </div>
        {printMode === 'a4'
          ? <InvoiceA4 sale={lastSale} business={business} />
          : <ThermalReceipt sale={lastSale} business={business} />}
      </PrintWrapper>
    </div>
  );
}

// localStorage helpers for held carts (scoped per business)
function readHolds(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeHolds(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore quota */ }
}
