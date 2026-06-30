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
  const [unitResults, setUnitResults] = useState([]); // IMEI/serial matches (mobile)
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  // customer (walk-in removed — phone + name are required, matched to a record)
  const [custPhone, setCustPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [customerNid, setCustomerNid] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // past-invoice lookup / reprint
  const [pastOpen, setPastOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [pastCustomer, setPastCustomer] = useState(null);
  const [pastSales, setPastSales] = useState([]);
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
    // For mobile shops, also match in-stock devices by IMEI / serial.
    if (isMobile && search.trim()) {
      try {
        const u = await api.get('/units', { params: { status: 'in_stock', search: search.trim() } });
        setUnitResults(u.data.data.units);
      } catch { setUnitResults([]); }
    } else {
      setUnitResults([]);
    }
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setHolds(readHolds(heldKey)); }, [heldKey]);

  // As the phone is typed, suggest matching customers (so dues attach to a real
  // record). Clicking a suggestion fills both phone + name.
  useEffect(() => {
    const term = custPhone.trim();
    if (term.length < 2) { setMatchedCustomer(null); setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: term } });
        const list = data.data.customers || [];
        setSuggestions(list);
        const norm = (s) => (s || '').replace(/\s/g, '');
        const exact = list.find((c) => norm(c.phone) === norm(term)) || null;
        setMatchedCustomer(exact);
        if (exact) setCustName((n) => n || exact.name);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [custPhone]);

  const pickCustomer = (c) => {
    setCustPhone(c.phone || '');
    setCustName(c.name || '');
    setMatchedCustomer(c);
    setSuggestOpen(false);
    setSuggestions([]);
  };

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

  // Add one specific serial-tracked device (by IMEI/serial) to the cart.
  const pushUnit = (u) => {
    const p = u.product;
    setCart((c) => {
      if (c.some((i) => i.unitId === u._id)) { toast.error('Device already in cart'); return c; }
      return [...c, {
        _id: p._id, name: p.name, sellingPrice: p.sellingPrice, discountPercent: p.discountPercent || 0,
        qty: 1, unitId: u._id, imei1: u.imei1, imei2: u.imei2, serial: u.serial,
      }];
    });
  };

  const addByImei = async () => {
    const term = imei.trim();
    if (!term) return;
    try {
      const { data } = await api.get('/units/lookup', { params: { imei: term } });
      pushUnit(data.data.unit);
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
  const resetSale = () => { setCart([]); setDiscount(0); setPaid(0); setCustPhone(''); setCustName(''); setMatchedCustomer(null); setCustomerNid(''); };

  const subTotal = cart.reduce((s, i) => s + unitPrice(i) * Number(i.qty || 0), 0);
  const total = Math.max(0, subTotal - Number(discount || 0));
  const due = Math.max(0, total - Number(paid || 0));

  // ---------- hold / resume ----------
  const holdCart = () => {
    if (!cart.length) return toast.error('Cart is empty');
    const entry = {
      id: Date.now().toString(),
      heldAt: new Date().toISOString(),
      customerName: custName || custPhone || 'No customer',
      custPhone, custName, customerNid, discount, paid, method,
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
    setCart(h.cart); setCustPhone(h.custPhone || ''); setCustName(h.custName || ''); setCustomerNid(h.customerNid || '');
    setDiscount(h.discount || 0); setPaid(h.paid || 0); setMethod(h.method || 'cash');
    const next = holds.filter((x) => x.id !== h.id);
    setHolds(next); writeHolds(heldKey, next);
    setHoldsOpen(false);
    toast.success('Cart resumed');
  };

  // ---------- past invoices (search by phone/name, reprint) ----------
  const findCustomers = async () => {
    if (!findTerm.trim()) return;
    const { data } = await api.get('/customers', { params: { search: findTerm.trim() } });
    setFoundCustomers(data.data.customers);
    setPastCustomer(null); setPastSales([]);
  };
  const openHistory = async (c) => {
    const { data } = await api.get(`/customers/${c._id}/history`);
    setPastCustomer(data.data.customer);
    setPastSales(data.data.sales);
  };
  const reprint = (sale) => { setLastSale(sale); setPastOpen(false); setShowPrint(true); };

  const deleteHold = (id) => {
    const next = holds.filter((x) => x.id !== id);
    setHolds(next); writeHolds(heldKey, next);
  };

  // ---------- checkout ----------
  const checkout = async () => {
    if (!cart.length) return toast.error('Cart is empty');
    if (cart.some((i) => !i.unitId && Number(i.qty) <= 0)) return toast.error('Enter a valid quantity');
    if (!custPhone.trim() || !custName.trim()) return toast.error('Customer name and phone are required');
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((i) => i.unitId ? { product: i._id, qty: 1, unit: i.unitId } : { product: i._id, qty: Number(i.qty) }),
        discount: Number(discount || 0),
        paid: Number(paid || 0) || total,
        paymentMethod: method,
        customer: matchedCustomer?._id || null,
        customerName: custName.trim(),
        customerPhone: custPhone.trim(),
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
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setPastOpen(true)}>
              <Printer size={16} /> Past Invoices
            </button>
            <button className="btn-ghost" onClick={() => setHoldsOpen(true)}>
              <ListChecks size={16} /> Held Bills {holds.length > 0 && <span className="badge bg-amber-100 text-amber-700">{holds.length}</span>}
            </button>
          </div>
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
          <input className="input pl-10" placeholder={isMobile ? 'Search products or IMEI / serial...' : 'Search products to add...'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isMobile && unitResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400">Matching devices (IMEI / serial)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {unitResults.map((u) => (
                <button key={u._id} onClick={() => pushUnit(u)} className="card p-3 text-left hover:ring-2 hover:ring-brand-500 transition">
                  <p className="font-medium text-sm truncate">{u.product?.name || 'Device'}</p>
                  <p className="text-brand-600 font-bold">{taka(unitPrice({ sellingPrice: u.product?.sellingPrice || 0, discountPercent: u.product?.discountPercent || 0 }))}</p>
                  <p className="text-xs text-brand-500 truncate">IMEI: {u.imei1 || u.serial}</p>
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label className="label">Customer Phone</label>
              <input
                className="input"
                value={custPhone}
                onChange={(e) => { setCustPhone(e.target.value); setSuggestOpen(true); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                placeholder="01XXXXXXXXX"
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute z-30 mt-1 w-[200%] max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                  {suggestions.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-slate-400 ml-1">{c.phone}</span>
                      </span>
                      {c.totalDue > 0 && <span className="text-xs text-red-500 shrink-0">Due {taka(c.totalDue)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Customer Name</label>
              <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name" />
            </div>
          </div>
          {matchedCustomer && (
            <p className="text-xs text-green-600">
              ✓ Existing customer{matchedCustomer.totalDue > 0 ? ` • current due ${taka(matchedCustomer.totalDue)}` : ''}
            </p>
          )}
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

      {/* Past invoices — search by phone/name and reprint */}
      <Modal open={pastOpen} onClose={() => setPastOpen(false)} title="Past Invoices" size="lg">
        <div className="flex gap-2 mb-3">
          <input
            className="input"
            placeholder="Search by phone or name…"
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') findCustomers(); }}
          />
          <button className="btn-primary shrink-0" onClick={findCustomers}><Search size={16} /> Search</button>
        </div>

        {!pastCustomer ? (
          foundCustomers.length === 0 ? (
            <p className="text-slate-400 text-center py-6 text-sm">Search a customer by phone number or name.</p>
          ) : (
            <div className="space-y-2">
              {foundCustomers.map((c) => (
                <button key={c._id} onClick={() => openHistory(c)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-brand-500 text-left">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.phone || 'No phone'}</p>
                  </div>
                  {c.totalDue > 0 && <span className="text-xs text-red-500">Due {taka(c.totalDue)}</span>}
                </button>
              ))}
            </div>
          )
        ) : (
          <div>
            <button className="btn-ghost mb-2" onClick={() => setPastCustomer(null)}>← Back</button>
            <div className="mb-2">
              <p className="font-semibold">{pastCustomer.name}</p>
              <p className="text-xs text-slate-400">{pastCustomer.phone}{pastCustomer.totalDue > 0 ? ` • Due ${taka(pastCustomer.totalDue)}` : ''}</p>
            </div>
            {pastSales.length === 0 ? (
              <p className="text-slate-400 text-center py-6 text-sm">No invoices yet</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {pastSales.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-sm">{s.invoiceNo}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(s.createdAt)} • {taka(s.total)}{s.due > 0 ? ` • due ${taka(s.due)}` : ''}</p>
                    </div>
                    <button className="btn-ghost" onClick={() => reprint(s)}><Printer size={15} /> Reprint</button>
                  </div>
                ))}
              </div>
            )}
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
