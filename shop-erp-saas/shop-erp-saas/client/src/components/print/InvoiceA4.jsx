import { taka, fmtDate, fmtDateTime } from '../../utils/format.js';

// A4 invoice — general shops
export default function InvoiceA4({ sale, business }) {
  if (!sale) return null;
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
          <h2 style={{ margin: 0 }}>INVOICE</h2>
          <p style={{ margin: '2px 0' }}>#{sale.invoiceNo}</p>
          <p style={{ margin: '2px 0' }}>{fmtDateTime(sale.createdAt)}</p>
        </div>
      </div>

      <p style={{ marginTop: 12 }}><strong>Customer:</strong> {sale.customerName}
        {sale.customerNid ? <span> &nbsp;|&nbsp; <strong>NID:</strong> {sale.customerNid}</span> : null}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={th}>#</th><th style={th}>Item</th><th style={thR}>Qty</th><th style={thR}>Price</th><th style={thR}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>
                {it.name}
                {(it.imei1 || it.serial) ? (
                  <div style={{ fontSize: 10, color: '#555' }}>
                    {it.imei1 ? <div>IMEI 1: {it.imei1}</div> : null}
                    {it.imei2 ? <div>IMEI 2: {it.imei2}</div> : null}
                    {it.serial ? <div>SN: {it.serial}</div> : null}
                    {it.warrantyMonths > 0 ? <div>Warranty: {it.warrantyMonths} mo{it.warrantyExpiry ? ` (till ${fmtDate(it.warrantyExpiry)})` : ''}</div> : null}
                  </div>
                ) : null}
              </td>
              <td style={tdR}>{it.qty}</td>
              <td style={tdR}>{taka(it.sellingPrice)}</td>
              <td style={tdR}>{taka(it.sellingPrice * it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, marginLeft: 'auto', width: 240 }}>
        <Row label="Subtotal" value={taka(sale.subTotal)} />
        <Row label="Discount" value={taka(sale.discount)} />
        <Row label="Total" value={taka(sale.total)} bold />
        <Row label="Paid" value={taka(sale.paid)} />
        <Row label="Due" value={taka(sale.due)} bold />
      </div>

      <p style={{ textAlign: 'center', marginTop: 30, fontSize: 11, color: '#555' }}>
        Thank you for your purchase!
      </p>
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: '#333', borderTop: '1px solid #ddd', paddingTop: 8 }}>
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
