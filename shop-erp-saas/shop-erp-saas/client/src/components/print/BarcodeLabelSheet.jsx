import Barcode from './Barcode.jsx';
import { taka } from '../../utils/format.js';

// An A4 sheet of barcode labels laid out left→right, top→bottom in `columns`
// columns. Each label shows the product name, colour, barcode and price (+ SKU).
//
// `codes` (optional) is a list of per-label barcode values — pass it to give each
// label a UNIQUE code (e.g. one IMEI/serial per in-stock device). When omitted,
// the sheet falls back to `quantity` copies of the shared product barcode.
export default function BarcodeLabelSheet({ product, quantity = 20, columns = 3, business, codes }) {
  if (!product) return null;
  // codes provided (even if empty) → print exactly those; a provided-but-empty
  // list prints nothing. codes omitted entirely → product barcode × quantity.
  const list = codes !== undefined
    ? codes.slice(0, 200)
    : Array.from({ length: Math.max(1, Math.min(200, Number(quantity) || 1)) }, () => product.barcode);
  const price = product.discountPercent > 0
    ? Math.round(product.sellingPrice * (1 - product.discountPercent / 100))
    : product.sellingPrice;
  const variant = [product.brand, product.storage, product.color].filter(Boolean).join(' / ');
  // narrower barcode modules for denser columns
  const moduleWidth = columns >= 5 ? 1 : columns >= 4 ? 1.2 : 1.5;

  return (
    <div className="print-a4" style={{ padding: '10mm' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '3mm' }}>
        {list.map((code, i) => (
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
            <Barcode value={code} height={34} moduleWidth={moduleWidth} showText />
            <div style={{ fontSize: 11, fontWeight: 700 }}>{taka(price)}</div>
            {product.sku && <div style={{ fontSize: 8, color: '#555' }}>SKU: {product.sku}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
