import { taka, fmtDateTime } from '../../utils/format.js';

export default function DueReceipt({ customer, amount, business }) {
  if (!customer) return null;
  return (
    <div className="print-thermal">
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontWeight: 700 }}>{business?.name}</h1>
        <div>DUE PAYMENT RECEIPT</div>
      </div>
      <div className="thermal-divider" />
      <div>{fmtDateTime(new Date())}</div>
      <div>Customer: {customer.name}</div>
      <div>Phone: {customer.phone || '-'}</div>
      <div className="thermal-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>Paid Now</span><span>{taka(amount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Remaining Due</span><span>{taka(customer.totalDue)}</span>
      </div>
      <div className="thermal-divider" />
      <div style={{ textAlign: 'center' }}>
        <strong>{business?.name || 'My Shop'}</strong>
        {business?.phone ? <><br />Tel: {business.phone}</> : null}
        {business?.email ? <><br />{business.email}</> : null}
      </div>
      <div style={{ height: '14mm' }} />
    </div>
  );
}
