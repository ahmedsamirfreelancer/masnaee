import { useState, useEffect } from 'react';
import {
  ChartBarIcon, ShoppingCartIcon, CubeIcon, BanknotesIcon,
  BuildingStorefrontIcon, CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import StatsCard from '../components/ui/StatsCard';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';

const sections = [
  { key: 'sales', label: 'تقرير المبيعات', icon: ShoppingCartIcon, color: 'blue' },
  { key: 'purchases', label: 'تقرير المشتريات', icon: BuildingStorefrontIcon, color: 'amber' },
  { key: 'production', label: 'ملخص الإنتاج', icon: CubeIcon, color: 'green' },
  { key: 'inventory', label: 'تقييم المخزون', icon: CubeIcon, color: 'purple' },
  { key: 'pnl', label: 'الأرباح والخسائر', icon: CurrencyDollarIcon, color: 'sky' },
  { key: 'cashflow', label: 'التدفق النقدي', icon: BanknotesIcon, color: 'red' },
];

export default function ReportsPage() {
  const [active, setActive] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (active) loadReport(); }, [active, dateFrom, dateTo]);

  async function loadReport() {
    setLoading(true);
    setData(null);
    try {
      const { data: res } = await api.get(`/reports/${active}?date_from=${dateFrom}&date_to=${dateTo}`);
      setData(res.data || res);
    } catch {} finally { setLoading(false); }
  }

  function renderBar(value, max, color = 'bg-primary-500') {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  function renderReport() {
    if (loading) return (
      <div className="space-y-4 p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>
    );
    if (!data) return <p className="p-6 text-center text-slate-400">لا توجد بيانات</p>;

    if (active === 'sales') {
      const items = data.items || data.details || [];
      const maxVal = Math.max(...items.map(i => Number(i.total) || 0), 1);
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard icon={ShoppingCartIcon} label="عدد الطلبات" value={formatNumber(data.total_orders || data.count || 0)} color="blue" />
            <StatsCard icon={BanknotesIcon} label="إجمالي المبيعات" value={formatCurrency(data.total_amount || data.total || 0)} color="green" />
            <StatsCard icon={BanknotesIcon} label="متوسط الطلب" value={formatCurrency(data.avg_order || 0)} color="amber" />
            <StatsCard icon={ShoppingCartIcon} label="مدفوع" value={formatCurrency(data.total_paid || 0)} color="sky" />
          </div>
          {items.length > 0 && (
            <Card title="تفاصيل المبيعات" noPadding>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    {['المنتج', 'الكمية', 'الإجمالي', ''].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium">{it.product_name || it.name}</td>
                        <td className="px-4 py-3 text-sm">{formatNumber(it.quantity || it.qty)}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(it.total || it.amount)}</td>
                        <td className="px-4 py-3 w-48">{renderBar(Number(it.total || it.amount), maxVal, 'bg-primary-500')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      );
    }

    if (active === 'purchases') {
      const items = data.items || data.details || [];
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatsCard icon={BuildingStorefrontIcon} label="عدد أوامر الشراء" value={formatNumber(data.total_orders || data.count || 0)} color="amber" />
            <StatsCard icon={BanknotesIcon} label="إجمالي المشتريات" value={formatCurrency(data.total_amount || data.total || 0)} color="red" />
            <StatsCard icon={BanknotesIcon} label="مدفوع" value={formatCurrency(data.total_paid || 0)} color="green" />
          </div>
          {items.length > 0 && (
            <Card title="تفاصيل المشتريات" noPadding>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    {['المادة', 'الكمية', 'الإجمالي'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium">{it.material_name || it.name}</td>
                        <td className="px-4 py-3 text-sm">{formatNumber(it.quantity || it.qty)}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(it.total || it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      );
    }

    if (active === 'production') {
      const items = data.items || data.orders || [];
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard icon={CubeIcon} label="إجمالي الأوامر" value={formatNumber(data.total_orders || items.length)} color="blue" />
            <StatsCard icon={CubeIcon} label="مكتمل" value={formatNumber(data.completed || 0)} color="green" />
            <StatsCard icon={CubeIcon} label="قيد التنفيذ" value={formatNumber(data.in_progress || 0)} color="amber" />
            <StatsCard icon={CubeIcon} label="الكمية المنتجة" value={formatNumber(data.total_produced || 0)} color="purple" />
          </div>
          {items.length > 0 && (
            <Card title="أوامر الإنتاج" noPadding>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    {['المنتج', 'الكمية المخططة', 'الكمية الفعلية', 'الحالة'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium">{it.product_name || it.name}</td>
                        <td className="px-4 py-3 text-sm">{formatNumber(it.planned_qty)}</td>
                        <td className="px-4 py-3 text-sm">{formatNumber(it.actual_qty)}</td>
                        <td className="px-4 py-3"><Badge color={it.status === 'completed' ? 'success' : it.status === 'in_progress' ? 'warning' : 'gray'}>{it.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      );
    }

    if (active === 'inventory') {
      const items = data.items || data.stock || [];
      const totalValue = items.reduce((s, i) => s + (Number(i.value || i.total_value) || 0), 0);
      const maxVal = Math.max(...items.map(i => Number(i.value || i.total_value) || 0), 1);
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatsCard icon={CubeIcon} label="عدد الأصناف" value={items.length} color="blue" />
            <StatsCard icon={BanknotesIcon} label="إجمالي قيمة المخزون" value={formatCurrency(totalValue)} color="green" />
          </div>
          <Card title="تقييم المخزون" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                  {['الصنف', 'الكمية', 'سعر الوحدة', 'القيمة', ''].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-sm font-medium">{it.name}</td>
                      <td className="px-4 py-3 text-sm">{formatNumber(it.quantity || it.current_stock)}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(it.unit_cost || it.cost_price)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(it.value || it.total_value)}</td>
                      <td className="px-4 py-3 w-40">{renderBar(Number(it.value || it.total_value), maxVal, 'bg-purple-500')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );
    }

    if (active === 'pnl') {
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard icon={CurrencyDollarIcon} label="الإيرادات" value={formatCurrency(data.revenue || 0)} color="green" />
            <StatsCard icon={CurrencyDollarIcon} label="تكلفة المبيعات" value={formatCurrency(data.cogs || 0)} color="amber" />
            <StatsCard icon={CurrencyDollarIcon} label="المصروفات" value={formatCurrency(data.expenses || 0)} color="red" />
            <StatsCard icon={CurrencyDollarIcon} label="صافي الربح" value={formatCurrency(data.net_profit || 0)} color={(data.net_profit || 0) >= 0 ? 'green' : 'red'} />
          </div>
          <Card title="قائمة الدخل">
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700"><span className="font-medium">إجمالي الإيرادات</span><span className="font-bold text-emerald-600">{formatCurrency(data.revenue || 0)}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700"><span className="font-medium">تكلفة المبيعات</span><span className="font-bold text-amber-600">({formatCurrency(data.cogs || 0)})</span></div>
              <div className="flex justify-between py-2 border-b-2 border-slate-300 dark:border-slate-600"><span className="font-bold">مجمل الربح</span><span className="font-bold">{formatCurrency(data.gross_profit || 0)}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700"><span className="font-medium">المصروفات التشغيلية</span><span className="font-bold text-red-500">({formatCurrency(data.expenses || 0)})</span></div>
              {(data.expense_details || []).map((exp, i) => (
                <div key={i} className="flex justify-between py-1 pr-6 text-sm text-slate-500"><span>{exp.name || exp.category}</span><span>{formatCurrency(exp.amount || exp.total)}</span></div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-slate-400 dark:border-slate-500"><span className="text-lg font-bold">صافي الربح</span><span className={`text-lg font-bold ${(data.net_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(data.net_profit || 0)}</span></div>
            </div>
          </Card>
        </div>
      );
    }

    if (active === 'cashflow') {
      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard icon={BanknotesIcon} label="الرصيد الافتتاحي" value={formatCurrency(data.opening_balance || 0)} color="blue" />
            <StatsCard icon={BanknotesIcon} label="التدفقات الداخلة" value={formatCurrency(data.inflows || 0)} color="green" />
            <StatsCard icon={BanknotesIcon} label="التدفقات الخارجة" value={formatCurrency(data.outflows || 0)} color="red" />
            <StatsCard icon={BanknotesIcon} label="الرصيد الختامي" value={formatCurrency(data.closing_balance || 0)} color="purple" />
          </div>
          <Card title="تفاصيل التدفقات">
            <div className="space-y-3">
              {(data.details || []).map((item, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm">{item.description || item.name}</span>
                  <span className={`text-sm font-semibold ${(Number(item.amount) || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {(!data.details || data.details.length === 0) && <p className="text-center text-slate-400 py-4">لا توجد تفاصيل</p>}
            </div>
          </Card>
        </div>
      );
    }

    return <p className="p-6 text-center text-slate-400">اختر تقرير</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="التقارير" description="تقارير شاملة عن المبيعات والمشتريات والإنتاج والمخزون والأرباح. اختار الفترة الزمنية وشوف النتائج." />

      {!active && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(sec => (
            <button key={sec.key} onClick={() => setActive(sec.key)}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-right hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all group">
              <div className={`inline-flex p-3 rounded-xl bg-${sec.color === 'blue' ? 'primary' : sec.color}-50 dark:bg-${sec.color === 'blue' ? 'primary' : sec.color}-900/30 mb-4`}>
                <sec.icon className={`h-6 w-6 text-${sec.color === 'blue' ? 'primary' : sec.color}-600 dark:text-${sec.color === 'blue' ? 'primary' : sec.color}-400`} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary-600 transition-colors">{sec.label}</h3>
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" onClick={() => setActive(null)} size="sm">العودة للتقارير</Button>
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">{sections.find(s => s.key === active)?.label}</h2>
            <div className="flex-1" />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            <span className="text-slate-400">إلى</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          </div>
          <Card noPadding>{renderReport()}</Card>
        </>
      )}
    </div>
  );
}
