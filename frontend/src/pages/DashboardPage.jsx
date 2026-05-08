import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BanknotesIcon, ShoppingCartIcon, CurrencyDollarIcon, CubeIcon,
  ExclamationTriangleIcon, ClockIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '../components/ui/StatsCard';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function DashboardPage() {
  const [stats, setStats] = useState({});
  const [salesChart, setSalesChart] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, sc, tp, ro, ls] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: { data: {} } })),
        api.get('/dashboard/sales-chart').catch(() => ({ data: { data: [] } })),
        api.get('/dashboard/top-products').catch(() => ({ data: { data: [] } })),
        api.get('/dashboard/recent-orders').catch(() => ({ data: { data: [] } })),
        api.get('/dashboard/low-stock').catch(() => ({ data: { data: [] } })),
      ]);
      setStats(s.data.data || {});
      setSalesChart(safeArray(sc));
      setTopProducts(safeArray(tp));
      setRecentOrders(safeArray(ro));
      setLowStock(safeArray(ls));
    } catch {} finally { setLoading(false); }
  }

  const quickActions = [
    { label: 'طلب بيع جديد', icon: ShoppingCartIcon, to: '/sales', color: 'bg-primary-600' },
    { label: 'أمر إنتاج', icon: CubeIcon, to: '/production', color: 'bg-emerald-600' },
    { label: 'إضافة مصروف', icon: CurrencyDollarIcon, to: '/expenses', color: 'bg-amber-600' },
    { label: 'تسجيل حضور', icon: ClockIcon, to: '/hr/attendance', color: 'bg-purple-600' },
  ];

  const statusMap = { draft: { label: 'مسودة', color: 'gray' }, confirmed: { label: 'مؤكد', color: 'info' }, processing: { label: 'قيد التنفيذ', color: 'warning' }, shipped: { label: 'تم الشحن', color: 'info' }, delivered: { label: 'تم التسليم', color: 'success' }, cancelled: { label: 'ملغي', color: 'danger' } };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => <div key={i} className="h-80 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="لوحة التحكم" description="ملخص شامل لنشاط المصنع. الأرقام تتحدث تلقائياً مع كل عملية بيع أو إنتاج أو مصروف.">
        <p className="text-sm text-slate-500">{formatDate(new Date())}</p>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard icon={BanknotesIcon} label="مبيعات اليوم" value={formatCurrency(stats.total_sales_today || 0)} color="blue" />
        <StatsCard icon={ShoppingCartIcon} label="مبيعات الشهر" value={formatCurrency(stats.total_sales_month || 0)} color="green" />
        <StatsCard icon={CurrencyDollarIcon} label="مصروفات الشهر" value={formatCurrency(stats.total_expenses_month || 0)} color="red" />
        <StatsCard icon={CubeIcon} label="عدد المنتجات" value={stats.products_count || 0} color="purple" />
        <StatsCard icon={ExclamationTriangleIcon} label="نقص المخزون" value={stats.low_stock_count || 0} color="amber" />
        <StatsCard icon={ClockIcon} label="طلبات قيد التنفيذ" value={stats.pending_orders || 0} color="sky" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="المبيعات - آخر 30 يوم">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={salesChart}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} labelStyle={{ fontFamily: 'Cairo' }} />
              <Area type="monotone" dataKey="total" stroke="#2563EB" fillOpacity={1} fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="أكثر المنتجات مبيعاً">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v} labelStyle={{ fontFamily: 'Cairo' }} />
              <Bar dataKey="quantity" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card title="آخر الطلبات" className="lg:col-span-2" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">رقم الطلب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">العميل</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">لا توجد طلبات بعد</td></tr>
                ) : recentOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">{o.order_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{o.customer_name}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-3"><Badge color={statusMap[o.status]?.color}>{statusMap[o.status]?.label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Actions + Low Stock */}
        <div className="space-y-6">
          <Card title="إجراءات سريعة">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => navigate(a.to)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                  <div className={`p-2.5 rounded-xl ${a.color} text-white`}><a.icon className="h-5 w-5" /></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="تنبيهات المخزون" noPadding>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
              {lowStock.length === 0 ? (
                <p className="p-4 text-sm text-slate-400 text-center">المخزون بحالة جيدة</p>
              ) : lowStock.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{item.name}</span>
                  <Badge color="danger">{item.current_stock} / {item.min_stock}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
