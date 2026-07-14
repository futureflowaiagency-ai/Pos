import { taka, fmtDateTime } from '../../utils/format.js';

// A4 service / repair invoice — mobile shop job sheets
export default function ServiceInvoice({ job, business }) {
  if (!job) return null;
  const total = job.total ?? (job.serviceFee || 0); // customer bill = service charge only
  const due = Math.max(0, total - (job.paid || 0));
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
          <h2 style={{ margin: 0 }}>SERVICE INVOICE</h2>
          <p style={{ margin: '2px 0' }}>#{job.jobNo}</p>
          <p style={{ margin: '2px 0' }}>{fmtDateTime(job.createdAt)}</p>
        </div>
      </div>

      <table style={{ width: '100%', marginTop: 12, fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', width: '50%' }}>
              <strong>Customer:</strong> {job.customerName || 'Walk-in'}
              {job.customerPhone ? <div>Phone: {job.customerPhone}</div> : null}
            </td>
            <td style={{ verticalAlign: 'top', width: '50%' }}>
              <strong>Device:</strong> {job.deviceModel || '—'}
              {job.imei ? <div>IMEI / SN: {job.imei}</div> : null}
              {job.technician ? <div>Technician: {job.technician}</div> : null}
              <div>Status: <span style={{ textTransform: 'capitalize' }}>{job.status}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {job.problem ? (
        <p style={{ marginTop: 8 }}><strong>Problem / Fault:</strong> {job.problem}</p>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={th}>Description</th><th style={thR}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={td}>Service Charge</td><td style={tdR}>{taka(total)}</td></tr>
        </tbody>
      </table>

      <div style={{ marginTop: 12, marginLeft: 'auto', width: 240 }}>
        <Row label="Paid" value={taka(job.paid || 0)} />
        <Row label="Due" value={taka(due)} bold />
      </div>

      <p style={{ textAlign: 'center', marginTop: 30, fontSize: 11, color: '#555' }}>
        Thank you for choosing us!
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
