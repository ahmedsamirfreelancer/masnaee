import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  HomeIcon, CubeIcon, BeakerIcon, ClipboardDocumentListIcon, CogIcon,
  BuildingStorefrontIcon, TruckIcon, BanknotesIcon, UsersIcon, ShieldCheckIcon,
  ChartBarIcon, Bars3Icon, XMarkIcon, ChevronDownIcon, ArrowRightOnRectangleIcon,
  SunIcon, MoonIcon, BellIcon, WrenchScrewdriverIcon, ArchiveBoxIcon,
  DocumentTextIcon, CurrencyDollarIcon, UserGroupIcon, ClockIcon, CreditCardIcon,
  BuildingOfficeIcon, ChartPieIcon, ScaleIcon,
} from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';

const navGroups = [
  { label: 'الرئيسية', items: [
    { to: '/', icon: HomeIcon, label: 'لوحة التحكم' },
  ]},
  { label: 'المنتجات والخامات', items: [
    { to: '/products', icon: CubeIcon, label: 'المنتجات' },
    { to: '/materials', icon: BeakerIcon, label: 'الخامات' },
    { to: '/recipes', icon: ClipboardDocumentListIcon, label: 'التركيبات' },
  ]},
  { label: 'الإنتاج والمخزون', items: [
    { to: '/production', icon: WrenchScrewdriverIcon, label: 'أوامر الإنتاج' },
    { to: '/inventory', icon: ArchiveBoxIcon, label: 'المخزون' },
  ]},
  { label: 'المبيعات', items: [
    { to: '/sales', icon: BuildingStorefrontIcon, label: 'طلبات البيع' },
    { to: '/customers', icon: UserGroupIcon, label: 'العملاء' },
  ]},
  { label: 'المشتريات', items: [
    { to: '/purchases', icon: TruckIcon, label: 'أوامر الشراء' },
    { to: '/suppliers', icon: BuildingOfficeIcon, label: 'الموردين' },
  ]},
  { label: 'المالية والحسابات', items: [
    { to: '/accounting/chart', icon: ScaleIcon, label: 'شجرة الحسابات' },
    { to: '/accounting/journal', icon: DocumentTextIcon, label: 'القيود اليومية' },
    { to: '/expenses', icon: CurrencyDollarIcon, label: 'المصروفات' },
    { to: '/payments', icon: CreditCardIcon, label: 'المدفوعات' },
    { to: '/assets', icon: BanknotesIcon, label: 'الأصول' },
  ]},
  { label: 'الموارد البشرية', items: [
    { to: '/hr/employees', icon: UsersIcon, label: 'الموظفين' },
    { to: '/hr/attendance', icon: ClockIcon, label: 'الحضور والانصراف' },
    { to: '/hr/salaries', icon: BanknotesIcon, label: 'المرتبات' },
  ]},
  { label: 'الجودة', items: [
    { to: '/quality', icon: ShieldCheckIcon, label: 'فحص الجودة' },
  ]},
  { label: 'التقارير', items: [
    { to: '/reports', icon: ChartBarIcon, label: 'التقارير' },
  ]},
  { label: 'الإعدادات', items: [
    { to: '/settings', icon: CogIcon, label: 'إعدادات النظام' },
  ]},
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [dark, setDark] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle('dark');
  };

  const toggleGroup = (label) => setCollapsed(p => ({ ...p, [label]: !p[label] }));

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <img src="/logo-icon.svg" alt="مصنعي" className="h-9 w-9" />
        {sidebarOpen && <span className="text-xl font-bold text-white">مصنعي</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navGroups.map(group => (
          <div key={group.label} className="mb-2">
            {sidebarOpen && (
              <button onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200">
                {group.label}
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${collapsed[group.label] ? '-rotate-90' : ''}`} />
              </button>
            )}
            {!collapsed[group.label] && group.items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-2' : ''}`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
            {user?.full_name?.[0] || 'م'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role_display}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-sidebar ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex-shrink-0`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 right-0 w-72 bg-sidebar z-50 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (window.innerWidth < 1024) setMobileOpen(true); else setSidebarOpen(!sidebarOpen); }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 relative">
              <BellIcon className="h-5 w-5" />
              <span className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="تسجيل الخروج">
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
