import { useEffect, useState } from 'react';
import { Megaphone, Plus, Send, Trash2, Save, Sparkles, KeyRound, MessageSquare, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { fmtDateTime } from '../utils/format.js';
import { useConfirm } from '../context/ConfirmContext.jsx';

const emptyCampaign = { name: '', channel: 'sms', audience: 'all', subject: '', body: '' };

export default function Marketing() {
  const confirm = useConfirm();
  const [tab, setTab] = useState('campaigns');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone size={22} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Marketing</h1>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabBtn active={tab === 'campaigns'} onClick={() => setTab('campaigns')}>Campaigns</TabBtn>
        <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>Integrations & Keys</TabBtn>
      </div>

      {tab === 'campaigns' ? <Campaigns confirm={confirm} /> : <Settings />}
    </div>
  );
}

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${active
      ? 'border-brand-600 text-brand-600'
      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
    {children}
  </button>
);

// ---------------- Campaigns ----------------

function Campaigns({ confirm }) {
  const [campaigns, setCampaigns] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyCampaign);
  const [count, setCount] = useState(null);
  const [aiBrief, setAiBrief] = useState('');
  const [aiTone, setAiTone] = useState('friendly');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const load = async () => { const { data } = await api.get('/marketing/campaigns'); setCampaigns(data.data.campaigns); };
  useEffect(() => { load(); }, []);

  // Live audience size preview.
  useEffect(() => {
    if (!modal) return;
    setCount(null);
    api.get('/marketing/audience', { params: { channel: form.channel, audience: form.audience } })
      .then(({ data }) => setCount(data.data.count)).catch(() => setCount(null));
  }, [modal, form.channel, form.audience]);

  const open = () => { setForm(emptyCampaign); setAiBrief(''); setModal(true); };

  const save = async () => {
    if (!form.name || !form.body) return toast.error('Name and message are required');
    setSaving(true);
    try { await api.post('/marketing/campaigns', form); toast.success('Campaign saved'); setModal(false); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const aiDraft = async () => {
    if (!aiBrief) return toast.error('Describe the campaign first');
    setAiLoading(true);
    try {
      const { data } = await api.post('/marketing/ai/generate', { channel: form.channel, instructions: aiBrief, tone: aiTone });
      setForm((f) => ({ ...f, body: data.data.text }));
      toast.success('Draft generated');
    } catch (e) { toast.error(e.response?.data?.message || 'AI error'); }
    setAiLoading(false);
  };

  const send = async (c) => {
    const okGo = await confirm({ title: 'Send campaign?', message: `Send "${c.name}" to all matching customers using your own gateway? This costs you per message.`, confirmText: 'Send' });
    if (!okGo) return;
    setSendingId(c._id);
    try { const { data } = await api.post(`/marketing/campaigns/${c._id}/send`); toast.success(data.message || 'Sent'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Send failed'); }
    setSendingId(null);
  };

  const del = async (c) => {
    const okGo = await confirm({ title: 'Delete campaign?', message: `Delete "${c.name}"?`, confirmText: 'Delete', tone: 'danger' });
    if (!okGo) return;
    await api.delete(`/marketing/campaigns/${c._id}`); toast.success('Deleted'); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={open}><Plus size={18} /> New Campaign</button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Campaign' },
          { key: 'channel', label: 'Channel', render: (r) => <span className="uppercase text-xs font-semibold">{r.channel}</span> },
          { key: 'audience', label: 'Audience' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'stats', label: 'Sent', render: (r) => r.status === 'draft' ? '—' : `${r.stats.sent}/${r.stats.total}` },
          { key: 'sentAt', label: 'Date', render: (r) => r.sentAt ? fmtDateTime(r.sentAt) : '—' },
          { key: 'actions', label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => send(r)} disabled={sendingId === r._id || r.status === 'sending'} className="btn-ghost p-1.5 text-green-600" title="Send"><Send size={15} /></button>
              <button onClick={() => del(r)} className="btn-ghost p-1.5 text-red-500" title="Delete"><Trash2 size={15} /></button>
            </div>
          )},
        ]}
        rows={campaigns}
        empty="No campaigns yet"
      />

      <Modal open={modal} onClose={() => setModal(false)} title="New Campaign" size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Campaign'}</button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Eid offer blast" /></div>
            <div><label className="label">Channel</label>
              <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="sms">SMS</option><option value="email">Email</option>
              </select></div>
          </div>

          <div><label className="label">Audience</label>
            <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">All customers</option>
              <option value="due">Customers with due</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">{count === null ? 'Counting reachable customers…' : `${count} customer(s) reachable on ${form.channel.toUpperCase()}.`}</p>
          </div>

          {form.channel === 'email' && (
            <div><label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          )}

          {/* AI assistant */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={15} className="text-brand-600" /> AI draft (uses your own key)</div>
            <textarea className="input" rows={2} value={aiBrief} onChange={(e) => setAiBrief(e.target.value)} placeholder="e.g. 20% off all phone accessories this weekend" />
            <div className="flex gap-2">
              <select className="input flex-1" value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                <option value="friendly">Friendly</option><option value="professional">Professional</option><option value="urgent">Urgent</option><option value="festive">Festive</option>
              </select>
              <button type="button" className="btn-ghost" disabled={aiLoading} onClick={aiDraft}>
                <Sparkles size={15} /> {aiLoading ? 'Drafting…' : 'Generate'}
              </button>
            </div>
          </div>

          <div><label className="label">Message <span className="text-xs text-slate-400">— use {'{{name}}'} for the customer's name</span></label>
            <textarea className="input" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{name}}, ..." /></div>
        </div>
      </Modal>
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const map = { draft: 'bg-slate-200 text-slate-700', sending: 'bg-amber-100 text-amber-700', sent: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || ''}`}>{status}</span>;
};

// ---------------- Settings (bring your own keys) ----------------

function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  // Secret inputs are write-only; blank = keep existing.
  const [secrets, setSecrets] = useState({ smsApiKey: '', smsTwilioAuthToken: '', emailPass: '', aiApiKey: '' });
  const [testSms, setTestSms] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const load = async () => { const { data } = await api.get('/marketing/settings'); setS(data.data.settings); };
  useEffect(() => { load(); }, []);
  if (!s) return <Spinner />;

  const setSms = (k, v) => setS({ ...s, sms: { ...s.sms, [k]: v } });
  const setEmail = (k, v) => setS({ ...s, email: { ...s.email, [k]: v } });
  const setAi = (k, v) => setS({ ...s, ai: { ...s.ai, [k]: v } });
  const secretPh = (isSet) => (isSet ? '•••••••• (saved — leave blank to keep)' : 'Not set');

  const save = async () => {
    setSaving(true);
    const payload = {
      sms: { ...s.sms, ...(secrets.smsApiKey ? { apiKey: secrets.smsApiKey } : {}), ...(secrets.smsTwilioAuthToken ? { twilioAuthToken: secrets.smsTwilioAuthToken } : {}) },
      email: { ...s.email, ...(secrets.emailPass ? { pass: secrets.emailPass } : {}) },
      ai: { ...s.ai, ...(secrets.aiApiKey ? { apiKey: secrets.aiApiKey } : {}) },
    };
    try {
      const { data } = await api.put('/marketing/settings', payload);
      setS(data.data.settings);
      setSecrets({ smsApiKey: '', smsTwilioAuthToken: '', emailPass: '', aiApiKey: '' });
      toast.success('Saved');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const doTest = async (path, body, label) => {
    const t = toast.loading(`Sending ${label}…`);
    try { await api.post(path, body); toast.success(`${label} sent — check it arrived`, { id: t }); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed', { id: t }); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <p className="text-sm text-slate-500">Configure your own SMS gateway, email (SMTP) and AI keys. Messages are sent at your own cost using these credentials. Keys are stored encrypted and never shown again.</p>

      {/* SMS */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><MessageSquare size={16} /> SMS Gateway</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.sms.enabled} onChange={(e) => setSms('enabled', e.target.checked)} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Provider</label>
            <select className="input" value={s.sms.provider} onChange={(e) => setSms('provider', e.target.value)}>
              <option value="http">Generic HTTP API</option><option value="twilio">Twilio</option>
            </select></div>
          {s.sms.provider === 'twilio' ? (
            <>
              <div><label className="label">Account SID</label><input className="input" value={s.sms.twilioAccountSid} onChange={(e) => setSms('twilioAccountSid', e.target.value)} /></div>
              <div><label className="label">Auth Token</label><input className="input" type="password" placeholder={secretPh(s.sms.twilioAuthTokenSet)} value={secrets.smsTwilioAuthToken} onChange={(e) => setSecrets({ ...secrets, smsTwilioAuthToken: e.target.value })} /></div>
              <div><label className="label">From number</label><input className="input" value={s.sms.twilioFrom} onChange={(e) => setSms('twilioFrom', e.target.value)} placeholder="+1..." /></div>
            </>
          ) : (
            <>
              <div><label className="label">Method</label>
                <select className="input" value={s.sms.method} onChange={(e) => setSms('method', e.target.value)}><option>GET</option><option>POST</option></select></div>
              <div className="sm:col-span-2"><label className="label">API URL</label><input className="input" value={s.sms.apiUrl} onChange={(e) => setSms('apiUrl', e.target.value)} placeholder="https://api.sms-provider.com/send" /></div>
              <div><label className="label">API Key</label><input className="input" type="password" placeholder={secretPh(s.sms.apiKeySet)} value={secrets.smsApiKey} onChange={(e) => setSecrets({ ...secrets, smsApiKey: e.target.value })} /></div>
              <div><label className="label">Sender ID / Mask</label><input className="input" value={s.sms.senderId} onChange={(e) => setSms('senderId', e.target.value)} /></div>
              <div><label className="label">Param: api key</label><input className="input" value={s.sms.paramApiKey} onChange={(e) => setSms('paramApiKey', e.target.value)} /></div>
              <div><label className="label">Param: recipient</label><input className="input" value={s.sms.paramTo} onChange={(e) => setSms('paramTo', e.target.value)} /></div>
              <div><label className="label">Param: message</label><input className="input" value={s.sms.paramMessage} onChange={(e) => setSms('paramMessage', e.target.value)} /></div>
              <div><label className="label">Param: sender</label><input className="input" value={s.sms.paramSender} onChange={(e) => setSms('paramSender', e.target.value)} /></div>
            </>
          )}
        </div>
        <div className="flex gap-2 items-end pt-1">
          <div className="flex-1"><label className="label">Test phone</label><input className="input" value={testSms} onChange={(e) => setTestSms(e.target.value)} placeholder="01XXXXXXXXX" /></div>
          <button className="btn-ghost" onClick={() => doTest('/marketing/settings/test-sms', { to: testSms }, 'test SMS')}>Send test</button>
        </div>
      </div>

      {/* Email */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Mail size={16} /> Email (SMTP)</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.email.enabled} onChange={(e) => setEmail('enabled', e.target.checked)} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">SMTP Host</label><input className="input" value={s.email.host} onChange={(e) => setEmail('host', e.target.value)} placeholder="smtp.gmail.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Port</label><input className="input" type="number" value={s.email.port} onChange={(e) => setEmail('port', +e.target.value)} /></div>
            <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.email.secure} onChange={(e) => setEmail('secure', e.target.checked)} /> SSL (465)</label></div>
          </div>
          <div><label className="label">Username</label><input className="input" value={s.email.user} onChange={(e) => setEmail('user', e.target.value)} /></div>
          <div><label className="label">Password / App password</label><input className="input" type="password" placeholder={secretPh(s.email.passSet)} value={secrets.emailPass} onChange={(e) => setSecrets({ ...secrets, emailPass: e.target.value })} /></div>
          <div><label className="label">From name</label><input className="input" value={s.email.fromName} onChange={(e) => setEmail('fromName', e.target.value)} /></div>
          <div><label className="label">From email</label><input className="input" value={s.email.fromEmail} onChange={(e) => setEmail('fromEmail', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 items-end pt-1">
          <div className="flex-1"><label className="label">Test email to</label><input className="input" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" /></div>
          <button className="btn-ghost" onClick={() => doTest('/marketing/settings/test-email', { to: testEmail }, 'test email')}>Send test</button>
        </div>
      </div>

      {/* AI */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><KeyRound size={16} /> AI Assistant</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.ai.enabled} onChange={(e) => setAi('enabled', e.target.checked)} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Provider</label>
            <select className="input" value={s.ai.provider} onChange={(e) => setAi('provider', e.target.value)}>
              <option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option>
            </select></div>
          <div><label className="label">Model</label><input className="input" value={s.ai.model} onChange={(e) => setAi('model', e.target.value)} placeholder={s.ai.provider === 'openai' ? 'gpt-4o-mini' : 'claude-opus-4-8'} /></div>
          <div className="sm:col-span-2"><label className="label">API Key</label><input className="input" type="password" placeholder={secretPh(s.ai.apiKeySet)} value={secrets.aiApiKey} onChange={(e) => setSecrets({ ...secrets, aiApiKey: e.target.value })} /></div>
        </div>
      </div>

      <button className="btn-primary" disabled={saving} onClick={save}><Save size={18} /> {saving ? 'Saving…' : 'Save Settings'}</button>
    </div>
  );
}
