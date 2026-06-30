import { useEffect, useState } from 'react';
import { Save, Moon, Sun, ImagePlus, Trash2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.js';
import { uploadImage } from '../api/upload.js';
import Spinner from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Settings() {
  const { business, refresh, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // ---- Change password (email 6-digit code) ----
  const [pwEmail, setPwEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => { if (user?.email) setPwEmail(user.email); }, [user]);

  const sendCode = async () => {
    if (!pwEmail) return toast.error('Enter your account email');
    setPwBusy(true);
    try {
      await api.post('/auth/password/request-code', { email: pwEmail });
      toast.success('Verification code sent to your email');
      setCodeSent(true);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setPwBusy(false);
  };

  const changePw = async () => {
    if (code.length !== 6) return toast.error('Enter the 6-digit code');
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters');
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    setPwBusy(true);
    try {
      await api.post('/auth/password/change', { code, newPassword: newPw });
      toast.success('Password changed successfully');
      setCodeSent(false); setCode(''); setNewPw(''); setConfirmPw('');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setPwBusy(false);
  };

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        address: business.address || '',
        phone: business.phone || '',
        email: business.email || '',
        currency: business.currency || 'BDT',
        footerWebsite: business.footerWebsite || '',
        logoUrl: business.logoUrl || '',
        settings: {
          lowStockThreshold: business.settings?.lowStockThreshold ?? 5,
          printMode: business.settings?.printMode || 'a4',
        },
      });
    }
  }, [business]);

  if (!form) return <Spinner />;

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/business', { ...form, settings: { ...form.settings, lowStockThreshold: +form.settings.lowStockThreshold } });
      await refresh();
      toast.success('Settings saved');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const setS = (k, v) => setForm({ ...form, settings: { ...form.settings, [k]: v } });

  const onLogoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (file.size > 3 * 1024 * 1024) return toast.error('Logo must be under 3 MB');
    const t = toast.loading('Uploading logo...');
    try {
      const url = await uploadImage(file, 'logo'); // stored on Cloudinary
      set('logoUrl', url);
      toast.success('Logo uploaded', { id: t });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: t });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Business Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Business Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="shop@example.com" /></div>
          <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="sm:col-span-2">
            <label className="label">Shop Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <ImagePlus size={24} className="text-slate-400" />}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-ghost cursor-pointer">
                  <ImagePlus size={16} /> {form.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoPick} />
                </label>
                {form.logoUrl && (
                  <button type="button" className="btn-ghost text-red-500" onClick={() => set('logoUrl', '')}>
                    <Trash2 size={16} /> Remove
                  </button>
                )}
                <p className="text-xs text-slate-400">PNG/JPG, shown on invoices & receipts. Max 3 MB.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Low Stock Threshold</label><input className="input" type="number" value={form.settings.lowStockThreshold} onChange={(e) => setS('lowStockThreshold', e.target.value)} /></div>
          <div><label className="label">Default Print Mode</label>
            <select className="input" value={form.settings.printMode} onChange={(e) => setS('printMode', e.target.value)}>
              <option value="a4">A4</option>
              <option value="thermal">Thermal (80mm)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="label !mb-0">Theme</span>
          <button className="btn-ghost" onClick={toggleTheme}>
            {theme === 'dark' ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
          </button>
        </div>
      </div>

      <button className="btn-primary" disabled={saving} onClick={save}><Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}</button>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><KeyRound size={16} /> Change Password</h3>
        <p className="text-xs text-slate-400">We'll email a 6-digit code to your account email to confirm it's you, then you can set a new password.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">Account Email</label>
              <input className="input" type="email" value={pwEmail} onChange={(e) => setPwEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn-ghost whitespace-nowrap" disabled={pwBusy} onClick={sendCode}>{codeSent ? 'Resend Code' : 'Send Code'}</button>
          </div>

          {codeSent && (
            <>
              <div className="sm:col-span-2">
                <label className="label">Verification Code</label>
                <input className="input tracking-[0.4em] font-semibold" inputMode="numeric" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" />
              </div>
              <div><label className="label">New Password</label><input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
              <div><label className="label">Confirm Password</label><input className="input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></div>
              <div className="sm:col-span-2">
                <button className="btn-primary" disabled={pwBusy} onClick={changePw}><KeyRound size={16} /> {pwBusy ? 'Saving…' : 'Change Password'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
