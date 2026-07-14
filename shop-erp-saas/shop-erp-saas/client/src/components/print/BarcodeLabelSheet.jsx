import Barcode from './Barcode.jsx';
import { taka } from '../../utils/format.js';

// An A4 sheet filled with `quantity` identical barcode labels, laid out
// left→right, top→bottom in `columns` columns. Each label shows the product
// name, colour, barcode and selling price (+ SKU if present).
export default function BarcodeLabelSheet({ product, quantity = 20, columns = 3, business }) {
  if (!product) return null;
  const count = Math.max(1, Math.min(200, Number(quantity) || 1));
  const labels = Array.from({ length: count });
  const price = product.discountPercent > 0
    ? Math.round(product.sellingPrice * (1 - product.discountPercent / 100))
    : product.sellingPrice;
  const variant = [product.brand, product.storage, product.color].filter(Boolean).join(' / ');
  // narrower barcode modules for denser columns
  const moduleWidth = columns >= 5 ? 1 : columns >= 4 ? 1.2 : 1.5;

  return (
    <div className="print-a4" style={{ padding: '10mm' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '3mm' }}>
        {labels.map((_, i) => (
          <div
            key={i}
            style={{
              border: '1px dashed #bbb',
              borderRadius: 4,
              padding: '4px 6px',
              textAlign: 'center',
              breakInside: 'avoid',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {business?.name && (
              <div style={{ fontSize: 8, fontWeight: 600, color: '#333', lineHeight: 1.1 }}>{business.name}</div>
            )}
            <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.15, marginTop: 1 }}>{product.name}</div>
            {variant && <div style={{ fontSize: 8, color: '#555' }}>{variant}</div>}
            <Barcode value={product.barcode} height={34} moduleWidth={moduleWidth} showText />
            <div style={{ fontSize: 11, fontWeight: 700 }}>{taka(price)}</div>
            {product.sku && <div style={{ fontSize: 8, color: '#555' }}>SKU: {product.sku}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
