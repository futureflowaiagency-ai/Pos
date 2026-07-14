import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import api from '../../api/axios.js';
import BarcodeLabelSheet from './BarcodeLabelSheet.jsx';

// Barcode label printing dialog. For IMEI/serial-tracked products it prints one
// UNIQUE label per in-stock device (barcode = that device's IMEI/serial), so no
// two labels share a number. For plain products it prints `quantity` copies of
// the shared product barcode. Controls are `no-print`; only the `.print-area`
// sheet reaches the printer.
export default function LabelPrintModal({ product, business, onClose }) {
  const isSerial = !!product?.trackSerial;
  const [quantity, setQuantity] = useState(20);
  const [columns, setColumns] = useState(3);
  const [mode, setMode] = useState(isSerial ? 'unit' : 'product'); // 'unit' | 'product'
  const [units, setUnits] = useState([]);

  useEffect(() => {
    if (!isSerial || !product?._id) return;
    api.get('/units', { params: { product: product._id, status: 'in_stock' } })
      .then(({ data }) => setUnits(data.data.units))
      .catch(() => setUnits([]));
  }, [product?._id, isSerial]);

  if (!product) return null;

  // one code per in-stock device (unique), or the product barcode repeated
  const unitCodes = units.map((u) => u.imei1 || u.serial).filter(Boolean);
  const codes = mode === 'unit'
    ? unitCodes
    : Array.from({ length: quantity }, () => product.barcode);
  const nothingToPrint = mode === 'unit' && unitCodes.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-auto">
      <div className="min-h-full flex flex-col items-center py-6">
        <div className="no-print w-full max-w-[220mm] px-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Print Barcode Labels — {product.name}</h3>
            <div className="flex gap-2">
              <button onClick={() => window.print()} disabled={nothingToPrint} className="btn-primary"><Printer size={18} /> Print</button>
              <button onClick={onClose} className="btn-ghost"><X size={18} /> Close</button>
            </div>
          </div>
          <div className="card p-3 flex flex-wrap items-end gap-3">
            {isSerial && (
              <div>
                <label className="label">Label Content</label>
                <select className="input !w-56" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="unit">Per device — unique IMEI/Serial</option>
                  <option value="product">Product barcode (same on all)</option>
                </select>
              </div>
            )}

            {mode === 'product' && (
              <>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" min="1" max="200" className="input !w-28" value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
                </div>
                <div className="flex gap-1">
                  {[10, 20, 50, 100].map((n) => (
                    <button key={n} className={`btn-ghost !py-1 ${quantity === n ? 'ring-2 ring-brand-500' : ''}`} onClick={() => setQuantity(n)}>{n}</button>
                  ))}
                </div>
              </>
            )}

            <div>
              <label className="label">Label Size (columns)</label>
              <select className="input !w-40" value={columns} onChange={(e) => setColumns(Number(e.target.value))}>
                <option value={2}>Large (2 / row)</option>
                <option value={3}>Medium (3 / row)</option>
                <option value={4}>Small (4 / row)</option>
                <option value={5}>Sticker (5 / row)</option>
              </select>
            </div>

            {mode === 'unit'
              ? <p className="text-xs text-white/70">{unitCodes.length} in-stock device(s) — one unique label each.</p>
              : <p className="text-xs text-white/70">Barcode: <span className="font-mono">{product.barcode || '—'}</span></p>}
          </div>

          {nothingToPrint && (
            <p className="text-amber-300 text-sm mt-2">
              No in-stock devices for this product. Add IMEIs/serials first (or use “Generate serials” in the IMEI manager), or switch to “Product barcode”.
            </p>
          )}
        </div>

        <div className="print-area shadow-2xl">
          <BarcodeLabelSheet product={product} columns={columns} business={business} codes={codes} quantity={quantity} />
        </div>
      </div>
    </div>
  );
}
