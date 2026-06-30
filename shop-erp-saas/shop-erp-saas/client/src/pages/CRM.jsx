import { useEffect, useState } from 'react';
import {
  Contact2, LayoutGrid, UserPlus, Briefcase, Users, Building2,
  CheckSquare, CalendarClock, StickyNote, Plus, Pencil, Trash2, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import { taka, fmtDate } from '../utils/format.js';
import { useConfirm } from '../context/ConfirmContext.jsx';

const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];
const LEAD_STATUS = ['new', 'contacted', 'qualified', 'won', 'lost'];
const PRIORITY = ['low', 'medium', 'high'];
const TASK_STATUS = ['pending', 'done'];

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
const opts = (arr) => arr.map((v) => ({ value: v, label: cap(v) }));

const TONE = {
  new: 'slate', contacted: 'blue', qualified: 'indigo', proposal: 'indigo',
  negotiation: 'amber', won: 'green', lost: 'red',
  pending: 'amber', done: 'green', high: 'red', medium: 'amber', low: 'slate',
};
const TONE_CLS = {
  slate: 'bg-slate-200 text-slate-700', blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700', amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
};
const Badge = ({ v }) => v ? (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TONE_CLS[TONE[v] || 'slate']}`}>{v}</span>
) : '—';

const TABS = [
  { id: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
  { id: 'leads', label: 'Leads', icon: UserPlus },
  { id: 'deals', label: 'Deals', icon: Briefcase },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'followups', label: 'Follow Ups', icon: CalendarClock },
  { id: 'notes', label: 'Notes', icon: StickyNote },
];

export default function CRM() {
  const [tab, setTab] = useState('pipeline');
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Keep dropdown sources fresh whenever the active tab changes.
  useEffect(() => {
    api.get('/crm/companies').then(({ data }) => setCompanies(data.data.items)).catch(() => {});
    api.get('/crm/contacts').then(({ data }) => setContacts(data.data.items)).catch(() => {});
  }, [tab]);

  const companyOptions = companies.map((c) => ({ value: c._id, label: c.name }));
  const contactOptions = contacts.map((c) => ({ value: c._id, label: c.name }));

  const configs = {
    companies: {
      endpoint: 'companies',
      defaults: { name: '', industry: '', phone: '', email: '', website: '', address: '' },
      columns: [
        { key: 'name', label: 'Company' },
        { key: 'industry', label: 'Industry' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
      ],
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'industry', label: 'Industry' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'website', label: 'Website' },
        { key: 'address', label: 'Address', type: 'textarea' },
      ],
    },
    contacts: {
      endpoint: 'contacts',
      defaults: { name: '', email: '', phone: '', designation: '', company: '' },
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'designation', label: 'Role' },
        { key: 'company', label: 'Company', render: (r) => r.company?.name || '—' },
      ],
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'designation', label: 'Designation' },
        { key: 'company', label: 'Company', type: 'select', ref: true, options: companyOptions },
      ],
    },
    leads: {
      endpoint: 'leads',
      defaults: { name: '', email: '', phone: '', source: '', status: 'new', notes: '' },
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status', render: (r) => <Badge v={r.status} /> },
      ],
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'source', label: 'Source (FB, Walk-in…)' },
        { key: 'status', label: 'Status', type: 'select', required: true, options: opts(LEAD_STATUS) },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    deals: {
      endpoint: 'deals',
      defaults: { title: '', value: 0, stage: 'new', contact: '', company: '', expectedCloseDate: '', notes: '' },
      columns: [
        { key: 'title', label: 'Deal' },
        { key: 'value', label: 'Value', className: 'text-right', render: (r) => taka(r.value) },
        { key: 'stage', label: 'Stage', render: (r) => <Badge v={r.stage} /> },
        { key: 'company', label: 'Company', render: (r) => r.company?.name || '—' },
        { key: 'expectedCloseDate', label: 'Close by', render: (r) => fmtDate(r.expectedCloseDate) },
      ],
      fields: [
        { key: 'title', label: 'Title', required: true },
        { key: 'value', label: 'Value', type: 'number' },
        { key: 'stage', label: 'Stage', type: 'select', required: true, options: opts(STAGES) },
        { key: 'contact', label: 'Contact', type: 'select', ref: true, options: contactOptions },
        { key: 'company', label: 'Company', type: 'select', ref: true, options: companyOptions },
        { key: 'expectedCloseDate', label: 'Expected close', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    tasks: {
      endpoint: 'tasks', query: { kind: 'task' },
      defaults: { kind: 'task', title: '', relatedLabel: '', dueDate: '', priority: 'medium', status: 'pending', notes: '' },
      columns: [
        { key: 'title', label: 'Task' },
        { key: 'relatedLabel', label: 'Related to' },
        { key: 'dueDate', label: 'Due', render: (r) => fmtDate(r.dueDate) },
        { key: 'priority', label: 'Priority', render: (r) => <Badge v={r.priority} /> },
        { key: 'status', label: 'Status', render: (r) => <Badge v={r.status} /> },
      ],
      fields: [
        { key: 'title', label: 'Title', required: true },
        { key: 'relatedLabel', label: 'Related to (e.g. Deal: X)' },
        { key: 'dueDate', label: 'Due date', type: 'date' },
        { key: 'priority', label: 'Priority', type: 'select', required: true, options: opts(PRIORITY) },
        { key: 'status', label: 'Status', type: 'select', required: true, options: opts(TASK_STATUS) },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    followups: {
      endpoint: 'tasks', query: { kind: 'followup' },
      defaults: { kind: 'followup', title: '', relatedLabel: '', dueDate: '', priority: 'medium', status: 'pending', notes: '' },
      columns: [
        { key: 'title', label: 'Follow Up' },
        { key: 'relatedLabel', label: 'With / about' },
        { key: 'dueDate', label: 'When', render: (r) => fmtDate(r.dueDate) },
        { key: 'priority', label: 'Priority', render: (r) => <Badge v={r.priority} /> },
        { key: 'status', label: 'Status', render: (r) => <Badge v={r.status} /> },
      ],
      fields: [
        { key: 'title', label: 'Title', required: true },
        { key: 'relatedLabel', label: 'With / about (e.g. Lead: Karim)' },
        { key: 'dueDate', label: 'Follow-up date', type: 'date' },
        { key: 'priority', label: 'Priority', type: 'select', required: true, options: opts(PRIORITY) },
        { key: 'status', label: 'Status', type: 'select', required: true, options: opts(TASK_STATUS) },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    notes: {
      endpoint: 'notes',
      defaults: { body: '', relatedLabel: '' },
      columns: [
        { key: 'body', label: 'Note', render: (r) => (r.body.length > 70 ? r.body.slice(0, 70) + '…' : r.body) },
        { key: 'relatedLabel', label: 'Related to' },
        { key: 'createdAt', label: 'Added', render: (r) => fmtDate(r.createdAt) },
      ],
      fields: [
        { key: 'body', label: 'Note', type: 'textarea', required: true },
        { key: 'relatedLabel', label: 'Related to (optional)' },
      ],
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Contact2 size={22} className="text-brand-600" />
        <h1 className="text-2xl font-bold">CRM</h1>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t.id ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pipeline' ? <Pipeline /> : <EntityTab key={tab} cfg={configs[tab]} />}
    </div>
  );
}

// ---------- Generic CRUD tab ----------

function EntityTab({ cfg }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(cfg.defaults);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/crm/${cfg.endpoint}`, { params: cfg.query || {} });
    setRows(data.data.items);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => { setEditing(null); setForm({ ...cfg.defaults }); setModal(true); };
  const openEdit = (r) => {
    const f = { ...cfg.defaults };
    cfg.fields.forEach((fl) => {
      let v = r[fl.key];
      if (fl.ref && v && typeof v === 'object') v = v._id;
      if (fl.type === 'date' && v) v = new Date(v).toISOString().slice(0, 10);
      if (v !== undefined && v !== null) f[fl.key] = v;
    });
    setEditing(r); setForm(f); setModal(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...(cfg.query || {}), ...form };
      if (editing) await api.put(`/crm/${cfg.endpoint}/${editing._id}`, payload);
      else await api.post(`/crm/${cfg.endpoint}`, payload);
      toast.success('Saved'); setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };
  const del = async (r) => {
    if (!await confirm({ title: 'Delete?', message: 'This cannot be undone.', confirmText: 'Delete', tone: 'danger' })) return;
    await api.delete(`/crm/${cfg.endpoint}/${r._id}`); toast.success('Deleted'); load();
  };

  const filtered = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : rows;

  const cols = [
    ...cfg.columns,
    { key: '_act', label: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1">
        <button onClick={() => openEdit(r)} className="btn-ghost p-1.5" title="Edit"><Pencil size={14} /></button>
        <button onClick={() => del(r)} className="btn-ghost p-1.5 text-red-500" title="Delete"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  const renderField = (fl) => {
    const val = form[fl.key] ?? '';
    const set = (v) => setForm({ ...form, [fl.key]: v });
    if (fl.type === 'select') return (
      <select className="input" value={val} onChange={(e) => set(e.target.value)}>
        {!fl.required && <option value="">—</option>}
        {fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
    if (fl.type === 'textarea') return <textarea className="input" rows={3} value={val} onChange={(e) => set(e.target.value)} />;
    return (
      <input className="input" type={fl.type || 'text'} value={val}
        onChange={(e) => set(fl.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={18} /> Add</button>
      </div>

      <DataTable columns={cols} rows={filtered} empty="Nothing here yet" />

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit' : 'Add new'} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cfg.fields.map((fl) => (
            <div key={fl.key} className={fl.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="label">{fl.label}{fl.required ? ' *' : ''}</label>
              {renderField(fl)}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ---------- Pipeline board ----------

function Pipeline() {
  const [deals, setDeals] = useState([]);
  const load = async () => { const { data } = await api.get('/crm/deals'); setDeals(data.data.items); };
  useEffect(() => { load(); }, []);

  const move = async (d, stage) => {
    try { await api.put(`/crm/deals/${d._id}`, { stage }); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((st) => {
        const col = deals.filter((d) => d.stage === st);
        const sum = col.reduce((a, d) => a + (d.value || 0), 0);
        return (
          <div key={st} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 w-60 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold capitalize text-sm">{st}</span>
              <span className="text-xs text-slate-400">{col.length}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{taka(sum)}</p>
            <div className="space-y-2">
              {col.map((d) => (
                <div key={d._id} className="card p-2.5">
                  <p className="text-sm font-medium leading-tight">{d.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{taka(d.value)}{d.company?.name ? ` · ${d.company.name}` : ''}</p>
                  <select className="input mt-2 !py-1 !text-xs" value={d.stage} onChange={(e) => move(d, e.target.value)}>
                    {STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </div>
              ))}
              {col.length === 0 && <p className="text-xs text-slate-400 text-center py-2">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
