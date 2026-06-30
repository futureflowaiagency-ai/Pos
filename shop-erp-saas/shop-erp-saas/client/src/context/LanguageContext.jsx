import { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext();
export const useLang = () => useContext(LanguageContext);

// Translation dictionary. Add keys here as more of the UI is translated.
// Any key that is missing simply falls back to the English string.
const dict = {
  en: {
    // Sidebar / nav
    'Shop ERP': 'Shop ERP',
    Workspace: 'Workspace',
    Dashboard: 'Dashboard',
    Products: 'Products',
    'POS / Sales': 'POS / Sales',
    Customers: 'Customers',
    Suppliers: 'Suppliers',
    Employees: 'Employees',
    Finance: 'Finance',
    Marketing: 'Marketing',
    CRM: 'CRM',
    Subscription: 'Subscription',
    'Activity Logs': 'Activity Logs',
    Settings: 'Settings',
    'Warranty Check': 'Warranty Check',
    'EMI / Installments': 'EMI / Installments',
    'Service / Repair': 'Service / Repair',
    'Admin Panel': 'Admin Panel',
    // Topbar
    Notifications: 'Notifications',
    'Toggle theme': 'Toggle theme',
    'Toggle language': 'Toggle language',
    Logout: 'Logout',
  },
  bn: {
    // Sidebar / nav
    'Shop ERP': 'শপ ইআরপি',
    Workspace: 'ওয়ার্কস্পেস',
    Dashboard: 'ড্যাশবোর্ড',
    Products: 'পণ্য',
    'POS / Sales': 'পিওএস / বিক্রয়',
    Customers: 'গ্রাহক',
    Suppliers: 'সরবরাহকারী',
    Employees: 'কর্মচারী',
    Finance: 'অর্থ',
    Marketing: 'মার্কেটিং',
    CRM: 'সিআরএম',
    Subscription: 'সাবস্ক্রিপশন',
    'Activity Logs': 'কার্যকলাপ লগ',
    Settings: 'সেটিংস',
    'Warranty Check': 'ওয়ারেন্টি চেক',
    'EMI / Installments': 'ইএমআই / কিস্তি',
    'Service / Repair': 'সার্ভিস / মেরামত',
    'Admin Panel': 'অ্যাডমিন প্যানেল',
    // Topbar
    Notifications: 'নোটিফিকেশন',
    'Toggle theme': 'থিম পরিবর্তন',
    'Toggle language': 'ভাষা পরিবর্তন',
    Logout: 'লগ আউট',
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const toggleLang = () => setLang((l) => (l === 'en' ? 'bn' : 'en'));

  // t('Dashboard') -> translated string, falling back to the key itself.
  const t = (key) => dict[lang]?.[key] ?? dict.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
