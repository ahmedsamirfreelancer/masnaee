import { useState, useEffect, useMemo } from 'react';
import { CurrencyDollarIcon, CalculatorIcon, ArrowTrendingUpIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import StatsCard from '../components/ui/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import api from '../utils/api';
import { formatCurrency, formatNumber } from '../utils/formatters';
import toast from 'react-hot-toast';

// تكلفة التعبئة الثابتة لكل أزازة
const DEFAULT_PACKAGING = {
  bottle: 3.25,       // الأزازة
  cap: 0.70,          // الغطاء
  sticker: 0.33,      // الاستيكر
  shrink: 0.16,       // الشرينك
  adhesive: 0.33,     // اللزق
  glue: 0.05,         // الغراء
  carton: 10,         // الكرتونة (لـ 12 أزازة)
  bottles_per_carton: 12,
};

// المنتجات الثلاثة
const DEFAULT_SIZES = [
  { id: '650', label: '650 مل', oil_weight_kg: 0.65, color: 'from-amber-400 to-amber-600' },
  { id: '700', label: '700 مل', oil_weight_kg: 0.70, color: 'from-yellow-400 to-yellow-600' },
  { id: '900', label: '900 مل', oil_weight_kg: 0.90, color: 'from-orange-400 to-orange-600' },
];

// مصاريف شهرية افتراضية
const DEFAULT_MONTHLY = {
  accountant: 10000,
  factory_manager: 15000,
  machine_operator: 5000,
  driver: 13000,
  workers: 60000,       // 10 عمال
  rent: 20000,
  fuel: 20000,
  // الأصول (إهلاك شهري تقريبي: 1,170,000 / 60 شهر)
  depreciation: 19500,
};

export default function OilPricingPage() {
  const [tonPrice, setTonPrice] = useState('');
  const [packaging, setPackaging] = useState(DEFAULT_PACKAGING);
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [monthly, setMonthly] = useState(DEFAULT_MONTHLY);
  const [profitMargin, setProfitMargin] = useState(15); // نسبة الربح %
  const [workDays, setWorkDays] = useState(24); // أيام العمل في الشهر
  const [settingsModal, setSettingsModal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const { data } = await api.get('/pricing/oil-settings');
      if (data.data) {
        if (data.data.ton_price) setTonPrice(data.data.ton_price);
        if (data.data.packaging) setPackaging(p => ({ ...p, ...data.data.packaging }));
        if (data.data.monthly) setMonthly(m => ({ ...m, ...data.data.monthly }));
        if (data.data.profit_margin) setProfitMargin(Number(data.data.profit_margin));
        if (data.data.work_days) setWorkDays(Number(data.data.work_days));
        if (data.data.sizes) setSizes(s => s.map((sz, i) => ({ ...sz, ...data.data.sizes[i] })));
      }
    } catch {} finally { setLoaded(true); }
  }

  async function saveSettings() {
    try {
      await api.put('/pricing/oil-settings', { ton_price: tonPrice, packaging, monthly, profit_margin: profitMargin, work_days: workDays, sizes });
      toast.success('تم الحفظ');
      setSettingsModal(false);
    } catch { toast.error('فشل الحفظ'); }
  }

  const pricePerKg = tonPrice ? Number(tonPrice) / 1000 : 0;
  const totalMonthly = Object.values(monthly).reduce((s, v) => s + Number(v || 0), 0);
  const packagingPerBottle = Number(packaging.bottle) + Number(packaging.cap) + Number(packaging.sticker) + Number(packaging.shrink) + Number(packaging.adhesive) + Number(packaging.glue) + (Number(packaging.carton) / Number(packaging.bottles_per_carton));

  // حساب كل حجم
  const calculations = useMemo(() => {
    return sizes.map(size => {
      const oilCost = size.oil_weight_kg * pricePerKg;
      const totalCostPerBottle = oilCost + packagingPerBottle;
      const sellingPrice = totalCostPerBottle * (1 + profitMargin / 100);
      const profitPerBottle = sellingPrice - totalCostPerBottle;
      const profitPerCarton = profitPerBottle * Number(packaging.bottles_per_carton);
      const costPerCarton = totalCostPerBottle * Number(packaging.bottles_per_carton);
      const sellPerCarton = sellingPrice * Number(packaging.bottles_per_carton);

      // كام أزازة/كرتونة لازم تبيع عشان تغطي المصاريف
      const bottlesPerMonth = profitPerBottle > 0 ? Math.ceil(totalMonthly / profitPerBottle) : 0;
      const bottlesPerDay = workDays > 0 ? Math.ceil(bottlesPerMonth / workDays) : 0;
      const bottlesPerWeek = Math.ceil(bottlesPerMonth / (workDays / 6)); // 6 أيام في الأسبوع
      const cartonsPerMonth = Math.ceil(bottlesPerMonth / Number(packaging.bottles_per_carton));
      const cartonsPerDay = Math.ceil(bottlesPerDay / Number(packaging.bottles_per_carton));

      return {
        ...size,
        oilCost,
        packagingCost: packagingPerBottle,
        totalCostPerBottle,
        sellingPrice,
        profitPerBottle,
        profitPerCarton,
        costPerCarton,
        sellPerCarton,
        bottlesPerMonth,
        bottlesPerDay,
        bottlesPerWeek,
        cartonsPerMonth,
        cartonsPerDay,
      };
    });
  }, [sizes, pricePerKg, packagingPerBottle, profitMargin, totalMonthly, workDays, packaging.bottles_per_carton]);

  if (!loaded) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="تسعير الزيت" description="غيّر سعر الطن وكل الأسعار تتحدث لحظياً. شايف تكلفة كل أزازة + سعر البيع + كام أزازة لازم تبيع يومي عشان تغطي مصاريفك.">
        <Button variant="ghost" icon={Cog6ToothIcon} onClick={() => setSettingsModal(true)}>الإعدادات</Button>
      </PageHeader>

      {/* سعر الطن + ملخص */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">سعر طن الزيت اليوم (ج.م)</label>
            <input
              type="number" value={tonPrice}
              onChange={e => setTonPrice(e.target.value)}
              placeholder="مثلاً 80000"
              className="w-full px-4 py-4 rounded-xl border-2 border-primary-300 dark:border-primary-600 bg-white dark:bg-slate-800 text-2xl font-bold text-primary-700 dark:text-primary-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
            />
            <p className="text-xs text-slate-400 mt-1 text-center">سعر الكيلو: {pricePerKg > 0 ? formatCurrency(pricePerKg) : '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">نسبة الربح %</label>
            <input type="number" value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))}
              className="w-full px-3 py-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xl font-bold text-center text-emerald-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">المصاريف الشهرية</label>
            <div className="px-3 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-center">
              <span className="text-xl font-bold text-red-600">{formatCurrency(totalMonthly)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* كروت الأحجام */}
      {tonPrice > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {calculations.map(calc => (
            <div key={calc.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className={`bg-gradient-to-l ${calc.color} px-6 py-4`}>
                <h3 className="text-2xl font-bold text-white">أزازة {calc.label}</h3>
                <p className="text-white/80 text-sm">وزن الزيت: {calc.oil_weight_kg} كجم</p>
              </div>

              <div className="p-5 space-y-4">
                {/* تفصيل التكلفة */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">تكلفة الزيت</span>
                    <span className="font-semibold">{formatCurrency(calc.oilCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">تكلفة التعبئة</span>
                    <span className="font-semibold">{formatCurrency(calc.packagingCost)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between">
                    <span className="font-bold text-red-600">تكلفة الأزازة</span>
                    <span className="font-bold text-red-600 text-lg">{formatCurrency(calc.totalCostPerBottle)}</span>
                  </div>
                </div>

                {/* سعر البيع */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-600 mb-1">سعر البيع المقترح</p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(calc.sellingPrice)}</p>
                  <p className="text-sm text-emerald-500 mt-1">ربح: {formatCurrency(calc.profitPerBottle)} / أزازة</p>
                </div>

                {/* سعر الكرتونة */}
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">تكلفة الكرتونة ({packaging.bottles_per_carton} أزازة)</span>
                    <span className="font-bold">{formatCurrency(calc.costPerCarton)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">سعر بيع الكرتونة</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(calc.sellPerCarton)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">ربح الكرتونة</span>
                    <span className="font-bold text-primary-600">{formatCurrency(calc.profitPerCarton)}</span>
                  </div>
                </div>

                {/* حد أدنى مبيعات */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">عشان تغطي مصاريفك ({formatCurrency(totalMonthly)}/شهر)</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.bottlesPerDay)}</p>
                      <p className="text-[10px] text-amber-600">أزازة/يوم</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.bottlesPerWeek)}</p>
                      <p className="text-[10px] text-amber-600">أزازة/أسبوع</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.bottlesPerMonth)}</p>
                      <p className="text-[10px] text-amber-600">أزازة/شهر</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.cartonsPerDay)}</p>
                      <p className="text-[10px] text-amber-600">كرتونة/يوم</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.cartonsPerMonth)}</p>
                      <p className="text-[10px] text-amber-600">كرتونة/شهر</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!tonPrice && (
        <div className="text-center py-16 text-slate-400">
          <CalculatorIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">أدخل سعر طن الزيت اليوم عشان تشوف الأسعار</p>
        </div>
      )}

      {/* الإعدادات */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="إعدادات التسعير" size="lg">
        <div className="space-y-6">
          {/* تكاليف التعبئة */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">تكاليف التعبئة (لكل أزازة)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="الأزازة" type="number" step="0.01" value={packaging.bottle} onChange={e => setPackaging({...packaging, bottle: e.target.value})} />
              <Input label="الغطاء" type="number" step="0.01" value={packaging.cap} onChange={e => setPackaging({...packaging, cap: e.target.value})} />
              <Input label="الاستيكر" type="number" step="0.01" value={packaging.sticker} onChange={e => setPackaging({...packaging, sticker: e.target.value})} />
              <Input label="الشرينك" type="number" step="0.01" value={packaging.shrink} onChange={e => setPackaging({...packaging, shrink: e.target.value})} />
              <Input label="اللزق" type="number" step="0.01" value={packaging.adhesive} onChange={e => setPackaging({...packaging, adhesive: e.target.value})} />
              <Input label="الغراء" type="number" step="0.01" value={packaging.glue} onChange={e => setPackaging({...packaging, glue: e.target.value})} />
              <Input label="الكرتونة" type="number" step="0.01" value={packaging.carton} onChange={e => setPackaging({...packaging, carton: e.target.value})} />
              <Input label="أزازات/كرتونة" type="number" value={packaging.bottles_per_carton} onChange={e => setPackaging({...packaging, bottles_per_carton: e.target.value})} />
            </div>
          </div>

          {/* المصاريف الشهرية */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">المصاريف الشهرية</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input label="محاسب" type="number" value={monthly.accountant} onChange={e => setMonthly({...monthly, accountant: e.target.value})} />
              <Input label="مدير مصنع" type="number" value={monthly.factory_manager} onChange={e => setMonthly({...monthly, factory_manager: e.target.value})} />
              <Input label="عامل مكنة" type="number" value={monthly.machine_operator} onChange={e => setMonthly({...monthly, machine_operator: e.target.value})} />
              <Input label="سواق" type="number" value={monthly.driver} onChange={e => setMonthly({...monthly, driver: e.target.value})} />
              <Input label="عمال" type="number" value={monthly.workers} onChange={e => setMonthly({...monthly, workers: e.target.value})} />
              <Input label="إيجار" type="number" value={monthly.rent} onChange={e => setMonthly({...monthly, rent: e.target.value})} />
              <Input label="بنزين" type="number" value={monthly.fuel} onChange={e => setMonthly({...monthly, fuel: e.target.value})} />
              <Input label="إهلاك أصول" type="number" value={monthly.depreciation} onChange={e => setMonthly({...monthly, depreciation: e.target.value})} />
            </div>
          </div>

          {/* عام */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">عام</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="أيام العمل في الشهر" type="number" value={workDays} onChange={e => setWorkDays(e.target.value)} />
              <Input label="نسبة الربح %" type="number" value={profitMargin} onChange={e => setProfitMargin(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setSettingsModal(false)}>إلغاء</Button>
          <Button onClick={saveSettings}>حفظ الإعدادات</Button>
        </div>
      </Modal>
    </div>
  );
}
