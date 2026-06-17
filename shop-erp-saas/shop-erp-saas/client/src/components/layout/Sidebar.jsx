import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users, UserCog,
  Wallet, CreditCard, Settings, ScrollText, ShieldCheck, X,
  Truck, ShieldQuestion, CalendarClock, Wrench,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Links shown to every shop owner. Mobile-specific links are spliced in below.
const baseLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/pos', label: 'POS / Sales', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/employees', label: 'Employees', icon: UserCog },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/activity', label: 'Activity Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Extra modules enabled only for Mobile Shop Management businesses.
const mobileLinks = [
  { to: '/warranty', label: 'Warranty Check', icon: ShieldQuestion },
  { to: '/installments', label: 'EMI / Installments', icon: CalendarClock },
  { to: '/services', label: 'Service / Repair', icon: Wrench },
];

export default function Sidebar({ open, onClose }) {
  const { user, business } = useAuth();
  const isAdmin = user?.role === 'superadmin';
  const isMobile = business?.type === 'mobile';

  // insert mobile module links right after "Suppliers" for mobile shops
  const ownerLinks = isMobile
    ? (() => {
        const idx = baseLinks.findIndex((l) => l.to === '/suppliers');
        return [...baseLinks.slice(0, idx + 1), ...mobileLinks, ...baseLinks.slice(idx + 1)];
      })()
    : baseLinks;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`no-print fixed lg:static z-50 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h1 className="font-bold text-brand-600">Shop ERP</h1>
            <p className="text-xs text-slate-400 truncate max-w-[150px]">{business?.name || 'Workspace'}</p>
          </div>
          <button onClick={onClose} className="lg:hidden btn-ghost p-1"><X size={18} /></button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <NavLink to="/admin" className={navClass}><ShieldCheck size={18} /> Admin Panel</NavLink>
          ) : (
            ownerLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass} onClick={onClose}>
                <l.icon size={18} /> {l.label}
              </NavLink>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}

const navClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
  }`;
