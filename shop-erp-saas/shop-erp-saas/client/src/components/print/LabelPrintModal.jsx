import { useState } from 'react';
import { Printer, X } from 'lucide-react';
import BarcodeLabelSheet from './BarcodeLabelSheet.jsx';

// Barcode label printing dialog: choose quantity + columns (label density),
// preview the A4 sheet live, then print. Controls are `no-print`; only the
// `.print-area` sheet reaches the printer.
export default function LabelPrintModal({ product, business, onClose }) {
  const [quantity, setQuantity] = useState(20);
  const [columns, setColumns] = useState(3);
  if (!product) return null;

  const preset = (n) => setQuantity(n);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-auto">
      <div className="min-h-full flex flex-col items-center py-6">
        <div className="no-print w-full max-w-[220mm] px-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Print Barcode Labels — {product.name}</h3>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="btn-primary"><Printer size={18} /> Print</button>
              <button onClick={onClose} className="btn-ghost"><X size={18} /> Close</button>
            </div>
          </div>
          <div className="card p-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Quantity</label>
              <input type="number" min="1" max="200" className="input !w-28" value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
            </div>
            <div className="flex gap-1">
              {[10, 20, 50, 100].map((n) => (
                <button key={n} className={`btn-ghost !py-1 ${quantity === n ? 'ring-2 ring-brand-500' : ''}`} onClick={() => preset(n)}>{n}</button>
              ))}
            </div>
            <div>
              <label className="label">Label Size (columns)</label>
              <select className="input !w-40" value={columns} onChange={(e) => setColumns(Number(e.target.value))}>
                <option value={2}>Large (2 / row)</option>
                <option value={3}>Medium (3 / row)</option>
                <option value={4}>Small (4 / row)</option>
                <option value={5}>Sticker (5 / row)</option>
              </select>
            </div>
            <p className="text-xs text-white/70">Barcode: <span className="font-mono">{product.barcode || '—'}</span></p>
          </div>
        </div>

        <div className="print-area shadow-2xl">
          <BarcodeLabelSheet product={product} quantity={quantity} columns={columns} business={business} />
        </div>
      </div>
    </div>
  );
}
