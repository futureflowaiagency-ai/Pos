import { Moon, Sun, Menu, LogOut, Bell, Languages } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LanguageContext.jsx';

export default function Topbar({ onMenu }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLang();
  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-slate-200 dark:border-slate-700">
      <button onClick={onMenu} className="lg:hidden btn-ghost p-2"><Menu size={20} /></button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button className="btn-ghost p-2 relative" title={t('Notifications')}><Bell size={18} /></button>
        <button onClick={toggleLang} className="btn-ghost p-2 flex items-center gap-1" title={t('Toggle language')}>
          <Languages size={18} />
          <span className="text-xs font-semibold">{lang === 'en' ? 'বাং' : 'EN'}</span>
        </button>
        <button onClick={toggleTheme} className="btn-ghost p-2" title={t('Toggle theme')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="hidden sm:flex flex-col items-end mr-1">
          <span className="text-sm font-medium">{user?.name}</span>
          <span className="text-xs text-slate-400 capitalize">{user?.role}</span>
        </div>
        <button onClick={logout} className="btn-ghost p-2" title={t('Logout')}><LogOut size={18} /></button>
      </div>
    </header>
  );
}
