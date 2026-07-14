import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle, Barcode, ScanLine, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import LabelPrintModal from '../components/print/LabelPrintModal.jsx';
import { taka, fmtDate, expiryStatus, daysUntil } from '../utils/format.js';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const empty = {
  name: '', sku: '', category: 'General', unit: 'pcs', purchasePrice: 0, sellingPrice: 0,
  discountPercent: 0, stock: 0, lowStockAlert: 5, expiryDate: '', batchNo: '', returnable: true,
  // mobile-shop fields
  trackSerial: false, brand: '', color: '', storage: '', warrantyBrandMonths: 0, warrantyShopMonths: 0,
};

const isMedicineCat = (cat) => /medicine|medicin|drug|pharma/i.test(cat || '');
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const discounted = (p) => Math.round((p.sellingPrice * (1 - (p.discountPercent || 0) / 100)) * 100) / 100;

export default function Products() {
  const confirm = useConfirm();
  const { business } = useAuth();
  const isMobile = business?.type === 'mobile';
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [unitsFor, setUnitsFor] = useState(null); // product whose IMEIs are being managed
  const [labelFor, setLabelFor] = useState(null); // product whose barcode labels are being printed
  const [scanCode, setScanCode] = useState('');

  const load = async () => {
    const { data } = await api.get('/products', { params: { search } });
    setProducts(data.data.products);
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  // Scan/enter a barcode: if it matches an existing product, don't create a new
  // one — for IMEI-tracked products jump straight to adding a new device (req 1),
  // otherwise open the product for a stock edit.
  const onScan = async () => {
    const code = scanCode.trim();
    if (!code) return;
    try {
      const { data } = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      const p = data.data.product;
      setScanCode('');
      if (p.trackSerial) { setUnitsFor(p); toast.success(`${p.name} — add a new IMEI/serial`); }
      else { openEdit(p); toast.success(`${p.name} found`); }
    } catch (e) {
      if (e.response?.status === 404) {
        // unknown barcode → start a new product prefilled with this barcode
        setForm({ ...empty, category: isMobile ? 'Mobile' : (business?.type === 'pharmacy' ? 'Medicine' : 'General'), trackSerial: isMobile, barcode: code });
        setEditId(null); setModal(true); setScanCode('');
        toast('New barcode — create the product', { icon: '🆕' });
      } else {
        toast.error(e.response?.data?.message || 'Lookup failed');
      }
    }
  };

  const openNew = () => {
    setForm({ ...empty, category: isMobile ? 'Mobile' : (business?.type === 'pharmacy' ? 'Medicine' : 'General'), trackSerial: isMobile });
    setEditId(null); setModal(true);
  };
  const openEdit = (p) => { setForm({ ...empty, ...p, expiryDate: toDateInput(p.expiryDate) }); setEditId(p._id); setModal(true); };

  const requiresExpiry = isMedicineCat(form.category);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (requiresExpiry && !form.expiryDate) return toast.error('Expiry date is required for medicines');
    if (Number(form.discountPercent) < 0 || Number(form.discountPercent) > 100) return toast.error('Discount must be between 0 and 100%');
    try {
      const payload = {
        ...form,
        purchasePrice: +form.purchasePrice,
        sellingPrice: +form.sellingPrice,
        discountPercent: +form.discountPercent || 0,
        stock: form.trackSerial ? undefined : +form.stock, // serial stock is driven by units
        lowStockAlert: +form.lowStockAlert,
        warrantyBrandMonths: +form.warrantyBrandMonths || 0,
        warrantyShopMonths: +form.warrantyShopMonths || 0,
        expiryDate: form.expiryDate || undefined,
      };
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post('/products', payload);
      toast.success('Saved'); setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const del = async (p) => {
    const ok = await confirm({
      title: 'Delete product?',
      message: `Are you sure you want to delete "${p.name}"? This action cannot be undone.`,
      confirmText: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    await api.delete(`/products/${p._id}`); toast.success('Deleted'); load();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setChk = (k) => (e) => setForm({ ...form, [k]: e.target.checked });

  const ExpiryCell = ({ p }) => {
    const st = expiryStatus(p.expiryDate);
    if (!p.expiryDate) return <span className="text-slate-400">—</span>;
    if (st === 'expired') return <span className="badge bg-red-100 text-red-700">Expired</span>;
    if (st === 'soon') return (
      <span className="badge bg-red-100 text-red-700 inline-flex items-center gap-1">
        <AlertTriangle size={12} /> {daysUntil(p.expiryDate)}d left
      </span>
    );
    return <span className="text-slate-500">{fmtDate(p.expiryDate)}</span>;
  };

  const variantLabel = (p) => [p.brand, p.storage, p.color].filter(Boolean).join(' – ');

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div>
        <span className="font-medium">{r.name}</span>
        {isMobile && variantLabel(r) && <div className="text-xs text-slate-400">{variantLabel(r)}</div>}
      </div>
    )},
    { key: 'category', label: 'Category' },
    { key: 'purchasePrice', label: 'Buy', className: 'text-right', render: (r) => taka(r.purchasePrice) },
    { key: 'sellingPrice', label: 'Sell', className: 'text-right', render: (r) => (
      (r.discountPercent > 0)
        ? <span><span className="line-through text-slate-400">{taka(r.sellingPrice)}</span> <span className="font-semibold">{taka(discounted(r))}</span></span>
        : taka(r.sellingPrice)
    )},
    { key: 'discountPercent', label: 'Disc %', className: 'text-right', render: (r) => (r.discountPercent > 0 ? `${r.discountPercent}%` : '—') },
    ...(!isMobile ? [{ key: 'expiry', label: 'Expiry', render: (r) => <ExpiryCell p={r} /> }] : []),
    ...(isMobile ? [{ key: 'warranty', label: 'Warranty', render: (r) => {
      const m = Math.max(r.warrantyBrandMonths || 0, r.warrantyShopMonths || 0);
      return m > 0 ? `${m} mo` : '—';
    }}] : []),
    { key: 'stock', label: 'Stock', className: 'text-right', render: (r) => (
      <span className={r.stock <= r.lowStockAlert ? 'text-red-500 font-semibold' : ''}>{r.stock} {r.unit}</span>
    )},
    { key: 'actions', label: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-2">
        <button onClick={() => setLabelFor(r)} className="btn-ghost p-1.5" title="Print barcode label"><Tag size={15} /></button>
        {isMobile && r.trackSerial && (
          <button onClick={() => setUnitsFor(r)} className="btn-ghost p-1.5" title="Manage IMEIs"><Barcode size={15} /></button>
        )}
        <button onClick={() => openEdit(r)} className="btn-ghost p-1.5"><Pencil size={15} /></button>
        <button onClick={() => del(r)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={15} /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <button className="btn-primary" onClick={openNew}><Plus size={18} /> Add Product</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-10" placeholder="Search name / SKU / barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="relative flex-1 max-w-sm">
          <ScanLine size={18} className="absolute left-3 top-2.5 text-brand-500" />
          <input
            className="input pl-10"
            placeholder="Scan barcode to add stock / IMEI..."
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onScan(); }}
          />
        </div>
      </div>

      <DataTable columns={columns} rows={products} />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Product' : 'Add Product'} size="lg"
        footer={<>
          {editId && form.barcode && <button className="btn-ghost mr-auto" onClick={() => setLabelFor(form)}><Tag size={16} /> Print Label</button>}
          <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} placeholder={isMobile ? 'e.g. iPhone 15 Pro' : ''} /></div>
          <div>
            <label className="label">Barcode</label>
            <input className="input font-mono" value={form.barcode || ''} onChange={set('barcode')} placeholder="Auto-generated on save" />
          </div>
          <div><label className="label">SKU / Product Code</label><input className="input" value={form.sku || ''} onChange={set('sku')} placeholder="Optional" /></div>
          <div><label className="label">Category</label><input className="input" value={form.category} onChange={set('category')} /></div>
          <div><label className="label">Unit</label><input className="input" value={form.unit} onChange={set('unit')} /></div>

          {isMobile && (
            <>
              <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={set('brand')} placeholder="Apple, Samsung..." /></div>
              <div><label className="label">Storage (RAM/ROM)</label><input className="input" value={form.storage} onChange={set('storage')} placeholder="8GB/128GB" /></div>
              <div><label className="label">Color</label><input className="input" value={form.color} onChange={set('color')} placeholder="Black" /></div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.trackSerial} onChange={setChk('trackSerial')} />
                  Track by IMEI / Serial
                </label>
              </div>
              <div><label className="label">Brand Warranty (months)</label><input className="input" type="number" min="0" value={form.warrantyBrandMonths} onChange={set('warrantyBrandMonths')} /></div>
              <div><label className="label">Shop Warranty (months)</label><input className="input" type="number" min="0" value={form.warrantyShopMonths} onChange={set('warrantyShopMonths')} /></div>
            </>
          )}

          <div><label className="label">Purchase Price</label><input className="input" type="number" value={form.purchasePrice} onChange={set('purchasePrice')} /></div>
          <div><label className="label">Selling Price</label><input className="input" type="number" value={form.sellingPrice} onChange={set('sellingPrice')} /></div>
          <div>
            <label className="label">Discount (%)</label>
            <input className="input" type="number" min="0" max="100" value={form.discountPercent} onChange={set('discountPercent')} />
          </div>
          <div className="flex flex-col justify-end">
            <span className="label">Discounted Price</span>
            <div className="input bg-slate-50 dark:bg-slate-800 flex items-center font-semibold">{taka(discounted({ sellingPrice: +form.sellingPrice || 0, discountPercent: +form.discountPercent || 0 }))}</div>
          </div>

          {form.trackSerial ? (
            <div className="col-span-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
              Stock is managed automatically from the IMEI/serial units. {editId ? 'Use the IMEI button (▥) in the list to add devices.' : 'Save first, then add IMEIs from the list.'}
            </div>
          ) : (
            <div><label className="label">Stock</label><input className="input" type="number" value={form.stock} onChange={set('stock')} /></div>
          )}
          <div><label className="label">Low Stock Alert</label><input className="input" type="number" value={form.lowStockAlert} onChange={set('lowStockAlert')} /></div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.returnable !== false} onChange={setChk('returnable')} />
              Eligible for Return / Exchange
            </label>
          </div>

          {!isMobile && (
            <>
              <div>
                <label className="label">Expiry Date {requiresExpiry && <span className="text-red-500">*</span>}</label>
                <input className="input" type="date" value={form.expiryDate} onChange={set('expiryDate')} />
              </div>
              <div><label className="label">Batch No</label><input className="input" value={form.batchNo} onChange={set('batchNo')} /></div>
              {requiresExpiry && !form.expiryDate && (
                <p className="col-span-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={13} /> Expiry date is mandatory for medicines.</p>
              )}
            </>
          )}
        </div>
      </Modal>

      {unitsFor && <UnitsModal product={unitsFor} onClose={() => setUnitsFor(null)} onChanged={load} />}
      {labelFor && <LabelPrintModal product={labelFor} business={business} onClose={() => setLabelFor(null)} />}
    </div>
  );
}

// ---- IMEI / Serial unit manager (mobile shops) ----
function UnitsModal({ product, onClose, onChanged }) {
  const [units, setUnits] = useState([]);
  const [row, setRow] = useState({ imei1: '', imei2: '', serial: '' });
  const [bulk, setBulk] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get('/units', { params: { product: product._id } });
    setUnits(data.data.units);
  };
  useEffect(() => { load(); }, [product._id]);

  const submit = async (payloadUnits) => {
    if (!payloadUnits.length) return;
    setLoading(true);
    try {
      await api.post('/units', { product: product._id, units: payloadUnits });
      toast.success('Device(s) added');
      setRow({ imei1: '', imei2: '', serial: '' }); setBulk('');
      await load(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.message || 'Error adding units'); }
    setLoading(false);
  };

  const addOne = () => {
    if (!row.imei1.trim() && !row.serial.trim()) return toast.error('Enter an IMEI or serial');
    submit([row]);
  };
  const addBulk = () => {
    const raw = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!raw.length) return toast.error('Paste at least one IMEI/serial');
    const unique = [...new Set(raw)]; // drop repeated lines instead of erroring
    if (unique.length < raw.length) toast(`Skipped ${raw.length - unique.length} duplicate line(s)`, { icon: '⚠️' });
    submit(unique.map((imei1) => ({ imei1 })));
  };
  // For items with no real IMEI (accessories, etc.): auto-create N unique serials
  // so each unit gets its own scannable barcode label.
  const generateSerials = () => {
    const n = Math.max(1, Math.min(200, Number(genCount) || 1));
    const base = Date.now();
    const list = Array.from({ length: n }, (_, i) => ({ serial: `${base}${String(i).padStart(3, '0')}` }));
    submit(list);
  };
  const remove = async (u) => {
    try { await api.delete(`/units/${u._id}`); await load(); onChanged?.(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const inStock = units.filter((u) => u.status === 'in_stock').length;

  return (
    <Modal open onClose={onClose} title={`IMEIs — ${product.name}`} size="lg"
      footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
      <p className="text-sm text-slate-500 mb-3">In stock: <strong>{inStock}</strong> • Total units: {units.length}</p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end mb-3">
        <div><label className="label">IMEI 1</label><input className="input" value={row.imei1} onChange={(e) => setRow({ ...row, imei1: e.target.value })} /></div>
        <div><label className="label">IMEI 2</label><input className="input" value={row.imei2} onChange={(e) => setRow({ ...row, imei2: e.target.value })} /></div>
        <div><label className="label">Serial</label><input className="input" value={row.serial} onChange={(e) => setRow({ ...row, serial: e.target.value })} /></div>
        <button className="btn-primary" disabled={loading} onClick={addOne}><Plus size={16} /> Add</button>
      </div>

      <div className="mb-4">
        <label className="label">Bulk add (one IMEI per line)</label>
        <textarea className="input h-20" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="356789...&#10;356790..." />
        <button className="btn-ghost mt-2" disabled={loading} onClick={addBulk}>Add All</button>
      </div>

      <div className="mb-4 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
        <label className="label">No IMEI? Generate unique serials</label>
        <p className="text-xs text-slate-400 mb-2">Creates unique auto-serial numbers so each item gets its own scannable barcode (useful for accessories without an IMEI).</p>
        <div className="flex items-end gap-2">
          <div><label className="label">How many</label><input className="input !w-28" type="number" min="1" max="200" value={genCount} onChange={(e) => setGenCount(e.target.value)} /></div>
          <button className="btn-primary" disabled={loading} onClick={generateSerials}><Plus size={16} /> Generate &amp; Add</button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
            <tr><th className="px-3 py-2">IMEI 1</th><th className="px-3 py-2">IMEI 2</th><th className="px-3 py-2">Serial</th><th className="px-3 py-2">Status</th><th></th></tr>
          </thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No units yet</td></tr>}
            {units.map((u) => (
              <tr key={u._id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-3 py-2">{u.imei1 || '—'}</td>
                <td className="px-3 py-2">{u.imei2 || '—'}</td>
                <td className="px-3 py-2">{u.serial || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`badge ${u.status === 'in_stock' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{u.status === 'in_stock' ? 'In-Stock' : 'Sold'}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {u.status === 'in_stock' && <button className="text-red-500" onClick={() => remove(u)}><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
