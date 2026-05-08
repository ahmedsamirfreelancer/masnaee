import { useState, useEffect } from 'react';
import { CalculatorIcon, CurrencyDollarIcon, CubeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import StatsCard from '../components/ui/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import api, { safeArray } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function PricingPage() {
  const [products, setProducts] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productId, setProductId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // إعدادات التسعير
  const [settingsModal, setSettingsModal] = useState(false);
  const [pSettings, setPSettings] = useState({ estimated_monthly_production: '3000', monthly_rent: '20000', monthly_fuel: '20000', monthly_utilities: '5000' });

  useEffect(() => { loadProducts(); loadSettings(); }, []);

  async function loadProducts() {
    try { const res = await api.get('/products?limit=500'); setProducts(safeArray(res).map(p => ({ value: p.id, label: p.name, sizes: [] }))); } catch {}
  }

  async function loadSettings() {
    try { const { data } = await api.get('/pricing/settings'); if (data.data) setPSettings(prev => ({ ...prev, ...data.data })); } catch {}
  }

  async function onProductChange(id) {
    setProductId(id);
    setSizeId('');
    setSizes([]);
    setResult(null);
    if (!id) return;
    try {
      const { data } = await api.get(`/products/${id}`);
      const s = data.data?.sizes || [];
      setSizes(s.map(x => ({ value: x.id, label: `${x.size_label} - ${formatCurrency(x.selling_price)}` })));
    } catch {}
  }

  async function calculate() {
    if (!productId || !quantity) return toast.error('اختار المنتج وحدد الكمية');
    setLoading(true);
    try {
      const { data } = await api.post('/pricing/calculate', {
        product_id: productId,
        product_size_id: sizeId || undefined,
        quantity: Number(quantity),
      });
      setResult(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الحساب');
    } finally { setLoading(false); }
  }

  async function saveSettings() {
    try { await api.put('/pricing/settings', pSettings); toast.success('تم الحفظ'); setSettingsModal(false); } catch { toast.error('فشل الحفظ'); }
  }

  const r = result;

  return (
    <div className="space-y-6">
      <PageHeader title="حاسبة التسعير" description="أدخل المنتج والكمية والنظام هيحسبلك التكلفة الفعلية وسعر البيع المقترح. التكلفة بتشمل: خامات + عمالة + تشغيل + إهلاك أصول.">
        <Button variant="ghost" icon={Cog6ToothIcon} onClick={() => setSettingsModal(true)}>إعدادات التسعير</Button>
      </PageHeader>

      {/* Form */}
      <Card title="حساب السعر">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <Select label="المنتج *" options={products} value={productId} onChange={e => onProductChange(e.target.value)} />
          {sizes.length > 0 && (
            <Select label="الحجم" options={sizes} value={sizeId} onChange={e => setSizeId(e.target.value)} placeholder="كل الأحجام" />
          )}
          <Input label="الكمية *" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
          <Button icon={CalculatorIcon} loading={loading} onClick={calculate} className="h-[42px]">احسب</Button>
        </div>
      </Card>

      {r && (
        <>
          {/* ملخص */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={CubeIcon} label="المنتج" value={r.product.name} color="blue" />
            <StatsCard icon={CurrencyDollarIcon} label="تكلفة الوحدة" value={formatCurrency(r.cost_per_unit)} color="red" />
            <StatsCard icon={CurrencyDollarIcon} label={`إجمالي التكلفة (${r.quantity} وحدة)`} value={formatCurrency(r.total_cost)} color="amber" />
            <StatsCard icon={CurrencyDollarIcon} label="السعر الحالي" value={formatCurrency(r.product.current_selling_price)} color="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* تفصيل التكاليف */}
            <Card title="تفصيل التكلفة لكل وحدة">
              <div className="space-y-4">
                {/* خامات */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">تكلفة الخامات</h4>
                    <span className="font-bold text-primary-600">{formatCurrency(r.cost_breakdown.materials.total)}</span>
                  </div>
                  {r.cost_breakdown.materials.items.length > 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 space-y-1.5">
                      {r.cost_breakdown.materials.items.map((m, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">
                            {m.name} ({m.quantity} {m.unit})
                            {m.waste_percent > 0 && <span className="text-xs text-amber-500 mr-1">+{m.waste_percent}% هالك</span>}
                          </span>
                          <span className="font-medium">{formatCurrency(m.total_cost)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">مفيش تركيبة محددة لهذا المنتج</p>
                  )}
                </div>

                {/* التكاليف غير المباشرة */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                  <CostRow label="تكلفة العمالة" perUnit={r.cost_breakdown.labor.per_unit} monthly={r.cost_breakdown.labor.monthly_total} />
                  <CostRow label="تكلفة التشغيل" perUnit={r.cost_breakdown.operating.per_unit} monthly={r.cost_breakdown.operating.monthly_total} />
                  <CostRow label="إهلاك الأصول" perUnit={r.cost_breakdown.depreciation.per_unit} monthly={r.cost_breakdown.depreciation.monthly_total} />
                </div>

                {/* المجموع */}
                <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-slate-800 dark:text-white">إجمالي تكلفة الوحدة</span>
                    <span className="font-bold text-lg text-red-600">{formatCurrency(r.cost_per_unit)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">الطاقة الإنتاجية الشهرية: {r.monthly_production} وحدة</p>
                </div>
              </div>
            </Card>

            {/* هوامش الربح */}
            <Card title="سعر البيع المقترح">
              <div className="space-y-3">
                {r.suggested_margins.map(m => {
                  const isCurrent = Math.abs(m.price_per_unit - r.product.current_selling_price) < 1;
                  return (
                    <div key={m.percent}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isCurrent
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <Badge color={m.percent <= 15 ? 'warning' : m.percent <= 20 ? 'info' : 'success'}>
                          {m.percent}%
                        </Badge>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(m.price_per_unit)} <span className="text-xs font-normal text-slate-400">/ وحدة</span></p>
                          <p className="text-xs text-slate-500">ربح: {formatCurrency(m.profit_per_unit)} / وحدة</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-emerald-600">{formatCurrency(m.total)}</p>
                        <p className="text-xs text-slate-400">{r.quantity} وحدة</p>
                      </div>
                      {isCurrent && <Badge color="success">السعر الحالي</Badge>}
                    </div>
                  );
                })}
              </div>

              {/* مقارنة مع السعر الحالي */}
              {r.product.current_selling_price > 0 && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    السعر الحالي: <span className="font-bold">{formatCurrency(r.product.current_selling_price)}</span>
                    {' — '}هامش الربح الفعلي:{' '}
                    <span className={`font-bold ${(r.product.current_selling_price - r.cost_per_unit) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {r.cost_per_unit > 0 ? (((r.product.current_selling_price - r.cost_per_unit) / r.cost_per_unit) * 100).toFixed(1) : 0}%
                    </span>
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* إعدادات التسعير */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="إعدادات التسعير">
        <p className="text-sm text-slate-500 mb-4">القيم دي بتستخدم لو مفيش بيانات فعلية في النظام</p>
        <div className="space-y-4">
          <Input label="الطاقة الإنتاجية الشهرية (وحدة)" type="number" value={pSettings.estimated_monthly_production} onChange={e => setPSettings({...pSettings, estimated_monthly_production: e.target.value})} />
          <Input label="الإيجار الشهري" type="number" value={pSettings.monthly_rent} onChange={e => setPSettings({...pSettings, monthly_rent: e.target.value})} />
          <Input label="البنزين/المواصلات الشهري" type="number" value={pSettings.monthly_fuel} onChange={e => setPSettings({...pSettings, monthly_fuel: e.target.value})} />
          <Input label="الكهرباء والمياه الشهري" type="number" value={pSettings.monthly_utilities} onChange={e => setPSettings({...pSettings, monthly_utilities: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setSettingsModal(false)}>إلغاء</Button>
          <Button onClick={saveSettings}>حفظ</Button>
        </div>
      </Modal>
    </div>
  );
}

function CostRow({ label, perUnit, monthly }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <div>
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs text-slate-400 mr-2">({formatCurrency(monthly)}/شهر)</span>
      </div>
      <span className="font-semibold">{formatCurrency(perUnit)}</span>
    </div>
  );
}
