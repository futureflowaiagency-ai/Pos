import { taka, fmtDateTime } from '../../utils/format.js';

// A4 purchase report — printed when stock is bought from a supplier
export default function PurchaseReceipt({ purchase, supplier, business }) {
  if (!purchase) return null;
  const items = purchase.items || [];
  return (
    <div className="print-a4">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {business?.logoUrl ? (
            <img src={business.logoUrl} alt="Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
          ) : null}
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{business?.name || 'My Shop'}</h1>
            <p style={{ margin: '2px 0' }}>{business?.address}</p>
            <p style={{ margin: '2px 0' }}>Phone: {business?.phone}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0 }}>PURCHASE</h2>
          {purchase.reference ? <p style={{ margin: '2px 0' }}>Ref: {purchase.reference}</p> : null}
          <p style={{ margin: '2px 0' }}>{fmtDateTime(purchase.createdAt)}</p>
        </div>
      </div>

      <p style={{ marginTop: 12 }}><strong>Supplier:</strong> {supplier?.name}
        {supplier?.phone ? <span> &nbsp;|&nbsp; <strong>Phone:</strong> {supplier.phone}</span> : null}
      </p>
      {purchase.note ? <p style={{ margin: '2px 0' }}><strong>Note:</strong> {purchase.note}</p> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={th}>#</th><th style={th}>Item</th><th style={thR}>Qty</th><th style={thR}>Unit Cost</th><th style={thR}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>{it.name}</td>
              <td style={tdR}>{it.qty}</td>
              <td style={tdR}>{taka(it.unitCost)}</td>
              <td style={tdR}>{taka(it.unitCost * it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, marginLeft: 'auto', width: 240 }}>
        <Row label="Total" value={taka(purchase.total)} bold />
        <Row label="Paid" value={taka(purchase.paid)} />
        <Row label="Due" value={taka(purchase.due)} bold />
      </div>

      <div style={{ textAlign: 'center', marginTop: 30, fontSize: 11, color: '#333', borderTop: '1px solid #ddd', paddingTop: 8 }}>
        <strong>{business?.name || 'My Shop'}</strong>
        {business?.address ? <div>{business.address}</div> : null}
        <div>
          {business?.phone ? <span>Phone: {business.phone}</span> : null}
          {business?.phone && business?.email ? ' • ' : null}
          {business?.email ? <span>Email: {business.email}</span> : null}
        </div>
      </div>
    </div>
  );
}

const th = { border: '1px solid #ccc', padding: '6px', textAlign: 'left' };
const thR = { ...th, textAlign: 'right' };
const td = { border: '1px solid #ccc', padding: '6px' };
const tdR = { ...td, textAlign: 'right' };
const Row = ({ label, value, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid #000' : 'none' }}>
    <span>{label}</span><span>{value}</span>
  </div>
);
