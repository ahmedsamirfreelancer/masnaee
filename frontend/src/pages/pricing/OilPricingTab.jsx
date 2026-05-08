import { useState, useEffect, useMemo } from 'react';
import { CurrencyDollarIcon, CalculatorIcon, Cog6ToothIcon, PrinterIcon, PlusIcon } from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import api from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import toast from 'react-hot-toast';

// بنود تعبئة افتراضية لكل حجم
const DEFAULT_PACK_ITEMS = [
  { name: 'الأزازة', cost: 3.25, per: 'bottle' },
  { name: 'الغطاء', cost: 0.70, per: 'bottle' },
  { name: 'الاستيكر', cost: 0.33, per: 'bottle' },
  { name: 'الشرينك', cost: 0.16, per: 'bottle' },
  { name: 'اللزق', cost: 0.33, per: 'bottle' },
  { name: 'الغراء', cost: 0.05, per: 'bottle' },
  { name: 'الكرتونة', cost: 10, per: 'carton' },
];

const COLORS = ['from-amber-400 to-amber-600', 'from-yellow-400 to-yellow-600', 'from-orange-400 to-orange-600', 'from-red-400 to-red-600', 'from-emerald-400 to-emerald-600'];

const DEFAULT_SIZES = [
  { id: '650', label: '650 مل', oil_weight_kg: 0.65, packItems: [...DEFAULT_PACK_ITEMS.map(p => ({...p, cost: p.name === 'الأزازة' ? 3.00 : p.cost}))], bottlesPerCarton: 12 },
  { id: '700', label: '700 مل', oil_weight_kg: 0.70, packItems: [...DEFAULT_PACK_ITEMS.map(p => ({...p}))], bottlesPerCarton: 12 },
  { id: '900', label: '900 مل', oil_weight_kg: 0.90, packItems: [...DEFAULT_PACK_ITEMS.map(p => ({...p, cost: p.name === 'الأزازة' ? 3.50 : p.cost}))], bottlesPerCarton: 12 },
];

const DEFAULT_MONTHLY = { salaries: 103000, rent: 20000, fuel: 20000, utilities: 0, depreciation: 19500, other: 0 };

// أسعار حسب نوع العميل
const CUSTOMER_TYPES = [
  { key: 'wholesale', label: 'جملة', margin: 10 },
  { key: 'retail', label: 'تجزئة', margin: 20 },
  { key: 'distributor', label: 'موزع', margin: 15 },
];

export default function OilPricingTab() {
  const [tonPrice, setTonPrice] = useState('');
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [monthly, setMonthly] = useState(DEFAULT_MONTHLY);
  const [margins, setMargins] = useState(CUSTOMER_TYPES);
  const [workDays, setWorkDays] = useState(24);
  const [settingsModal, setSettingsModal] = useState(false);
  const [editSizeIdx, setEditSizeIdx] = useState(null); // index of size being edited
  const [priceHistory, setPriceHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadSettings(); loadHistory(); }, []);

  async function loadSettings() {
    try {
      const { data } = await api.get('/pricing/oil-settings');
      if (data.data) {
        if (data.data.ton_price) setTonPrice(data.data.ton_price);
        if (data.data.sizes) setSizes(data.data.sizes);
        if (data.data.monthly) setMonthly(m => ({ ...m, ...data.data.monthly }));
        if (data.data.margins) setMargins(data.data.margins);
        if (data.data.work_days) setWorkDays(Number(data.data.work_days));
      }
    } catch {} finally { setLoaded(true); }
  }

  async function loadHistory() {
    try { const { data } = await api.get('/pricing/ton-price-log'); setPriceHistory(data.data || []); } catch {}
  }

  async function saveAll() {
    try {
      await api.put('/pricing/oil-settings', { ton_price: tonPrice, sizes, monthly, margins, work_days: workDays });
      toast.success('تم الحفظ');
      setSettingsModal(false);
      setEditSizeIdx(null);
    } catch { toast.error('فشل الحفظ'); }
  }

  // حفظ سعر الطن تلقائي + سجل
  useEffect(() => {
    if (!loaded || !tonPrice) return;
    const timer = setTimeout(() => {
      api.put('/pricing/oil-settings', { ton_price: tonPrice, sizes, monthly, margins, work_days: workDays }).catch(() => {});
      api.post('/pricing/ton-price-log', { price: tonPrice }).then(() => loadHistory()).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [tonPrice]);

  const pricePerKg = tonPrice ? Number(tonPrice) / 1000 : 0;
  const totalMonthly = Object.values(monthly).reduce((s, v) => s + Number(v || 0), 0);

  // حساب كل حجم
  const calculations = useMemo(() => {
    return sizes.map((size, i) => {
      const items = size.packItems || DEFAULT_PACK_ITEMS;
      const bpc = size.bottlesPerCarton || 12;
      const packagingPerBottle = items.reduce((sum, item) => {
        const cost = Number(item.cost) || 0;
        return sum + (item.per === 'carton' ? cost / (bpc || 1) : cost);
      }, 0);
      const oilCost = (size.oil_weight_kg || 0) * pricePerKg;
      const totalCostPerBottle = oilCost + packagingPerBottle;

      // أسعار حسب نوع العميل
      const customerPrices = margins.map(m => {
        const margin = Number(m.margin) || 0;
        const sellingPrice = totalCostPerBottle * (1 + margin / 100);
        const profitPerBottle = sellingPrice - totalCostPerBottle;
        return {
          ...m,
          sellingPrice,
          profitPerBottle,
          profitPerCarton: profitPerBottle * bpc,
          sellPerCarton: sellingPrice * bpc,
          // break-even
          bottlesPerMonth: profitPerBottle > 0 ? Math.ceil(totalMonthly / profitPerBottle) : 0,
          bottlesPerDay: profitPerBottle > 0 ? Math.ceil(totalMonthly / profitPerBottle / (workDays || 24)) : 0,
          cartonsPerDay: profitPerBottle > 0 ? Math.ceil(totalMonthly / profitPerBottle / (workDays || 24) / bpc) : 0,
        };
      });

      return { ...size, color: COLORS[i % COLORS.length], oilCost, packagingPerBottle, totalCostPerBottle, costPerCarton: totalCostPerBottle * bpc, customerPrices, bpc };
    });
  }, [sizes, pricePerKg, margins, totalMonthly, workDays]);

  // طباعة قائمة أسعار
  function printPriceList() {
    const w = window.open('', '_blank');
    const date = new Date().toLocaleDateString('ar-EG');
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>قائمة أسعار - مصنعي</title>
      <style>*{font-family:Cairo,Arial,sans-serif;margin:0;padding:0;box-sizing:border-box}
      body{padding:30px;color:#1e293b}h1{text-align:center;margin-bottom:5px;font-size:24px}
      .date{text-align:center;color:#64748b;margin-bottom:20px;font-size:14px}
      .ton{text-align:center;background:#f0f9ff;padding:10px;border-radius:8px;margin-bottom:20px;font-size:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#2563eb;color:white;padding:10px;font-size:13px}
      td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center}
      tr:nth-child(even){background:#f8fafc}
      .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:30px}
      @media print{body{padding:15px}}</style></head><body>
      <h1>مصنعي — قائمة الأسعار</h1>
      <p class="date">${date}</p>
      <div class="ton">سعر طن الزيت: ${formatCurrency(Number(tonPrice))}</div>
      <table><tr><th>المنتج</th>${margins.map(m => `<th>سعر ${m.label}</th>`).join('')}<th>التكلفة</th></tr>
      ${calculations.map(c => `<tr><td style="font-weight:bold">أزازة ${c.label}</td>${c.customerPrices.map(p => `<td>${formatCurrency(p.sellingPrice)}</td>`).join('')}<td style="color:#ef4444">${formatCurrency(c.totalCostPerBottle)}</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#f0f9ff"><td>الكرتونة (${calculations[0]?.bpc || 12} أزازة)</td>${calculations[0]?.customerPrices.map((p, pi) => `<td>${calculations.map(c => formatCurrency(c.customerPrices[pi].sellPerCarton)).join(' / ')}</td>`).join('')}<td></td></tr>
      </table>
      <p class="footer">مصنعي — نظام إدارة المصانع</p>
      <script>window.print();</script></body></html>`);
  }

  if (!loaded) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      {/* سعر الطن */}
      <Card title="تسعير الزيت" action={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={PrinterIcon} onClick={printPriceList}>طباعة قائمة أسعار</Button>
          <Button variant="ghost" size="sm" icon={Cog6ToothIcon} onClick={() => setSettingsModal(true)}>الإعدادات</Button>
        </div>
      }>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">سعر طن الزيت اليوم (ج.م)</label>
            <input type="number" value={tonPrice} onChange={e => setTonPrice(e.target.value)} placeholder="مثلاً 80000"
              className="w-full px-4 py-4 rounded-xl border-2 border-primary-300 dark:border-primary-600 bg-white dark:bg-slate-800 text-2xl font-bold text-primary-700 dark:text-primary-400 focus:ring-2 focus:ring-primary-500 text-center" />
            <p className="text-xs text-slate-400 mt-1 text-center">سعر الكيلو: {pricePerKg > 0 ? formatCurrency(pricePerKg) : '—'}</p>
          </div>
          <div className="px-3 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-center">
            <p className="text-xs text-red-500 mb-1">المصاريف الشهرية</p>
            <span className="text-xl font-bold text-red-600">{formatCurrency(totalMonthly)}</span>
          </div>
          <div className="px-3 py-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center">
            <p className="text-xs text-slate-400 mb-1">هوامش الربح</p>
            <span className="text-sm font-bold">{margins.map(m => `${m.label}: ${m.margin}%`).join(' · ')}</span>
          </div>
        </div>
      </Card>

      {/* سجل أسعار الطن */}
      {priceHistory.length > 1 && (
        <Card title="سجل سعر الطن">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={priceHistory}>
              <defs><linearGradient id="tonGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} labelStyle={{ fontFamily: 'Cairo' }} />
              <Area type="monotone" dataKey="price" stroke="#2563EB" fillOpacity={1} fill="url(#tonGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* كروت الأحجام */}
      {tonPrice > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {calculations.map((calc, idx) => (
            <div key={calc.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className={`bg-gradient-to-l ${calc.color} px-5 py-3 flex items-center justify-between`}>
                <div>
                  <h3 className="text-xl font-bold text-white">أزازة {calc.label}</h3>
                  <p className="text-white/80 text-xs">وزن الزيت: {calc.oil_weight_kg} كجم</p>
                </div>
                <button onClick={() => setEditSizeIdx(idx)} className="text-white/70 hover:text-white text-xs bg-white/20 px-2 py-1 rounded-lg">تعديل البنود</button>
              </div>

              <div className="p-4 space-y-3">
                {/* تكلفة */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">الزيت ({calc.oil_weight_kg} كجم)</span><span className="font-semibold">{formatCurrency(calc.oilCost)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">التعبئة ({(calc.packItems || []).length} بند)</span><span className="font-semibold">{formatCurrency(calc.packagingPerBottle)}</span></div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between">
                    <span className="font-bold text-red-600 text-sm">تكلفة الأزازة</span>
                    <span className="font-bold text-red-600">{formatCurrency(calc.totalCostPerBottle)}</span>
                  </div>
                </div>

                {/* أسعار حسب نوع العميل */}
                <div className="space-y-2">
                  {calc.customerPrices.map(cp => (
                    <div key={cp.key} className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">{cp.label} ({cp.margin}%)</span>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(cp.sellingPrice)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-400">ربح: {formatCurrency(cp.profitPerBottle)}</p>
                        <p className="text-xs text-slate-400">كرتونة: {formatCurrency(cp.sellPerCarton)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* break-even أول نوع عميل */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1">حد أدنى مبيعات ({calc.customerPrices[0]?.label})</p>
                  <div className="flex justify-around text-center">
                    <div><p className="text-base font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.customerPrices[0]?.bottlesPerDay || 0)}</p><p className="text-[9px] text-amber-600">أزازة/يوم</p></div>
                    <div><p className="text-base font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.customerPrices[0]?.cartonsPerDay || 0)}</p><p className="text-[9px] text-amber-600">كرتونة/يوم</p></div>
                    <div><p className="text-base font-bold text-amber-800 dark:text-amber-300">{formatNumber(calc.customerPrices[0]?.bottlesPerMonth || 0)}</p><p className="text-[9px] text-amber-600">أزازة/شهر</p></div>
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

      {/* === Modal: تعديل بنود حجم معين === */}
      <Modal open={editSizeIdx !== null} onClose={() => setEditSizeIdx(null)} title={editSizeIdx !== null ? `بنود تعبئة — أزازة ${sizes[editSizeIdx]?.label}` : ''} size="lg">
        {editSizeIdx !== null && (() => {
          const size = sizes[editSizeIdx];
          const items = size.packItems || DEFAULT_PACK_ITEMS;
          const updateItems = (newItems) => { const u = [...sizes]; u[editSizeIdx] = { ...u[editSizeIdx], packItems: newItems }; setSizes(u); };
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="وزن الزيت (كجم)" type="number" step="0.01" value={size.oil_weight_kg} onChange={e => { const u = [...sizes]; u[editSizeIdx].oil_weight_kg = Number(e.target.value); setSizes(u); }} />
                <Input label="أزازات/كرتونة" type="number" value={size.bottlesPerCarton} onChange={e => { const u = [...sizes]; u[editSizeIdx].bottlesPerCarton = Number(e.target.value); setSizes(u); }} />
              </div>
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">بنود التعبئة</h4>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={item.name} onChange={e => { const u = [...items]; u[i] = {...u[i], name: e.target.value}; updateItems(u); }}
                      placeholder="اسم البند" className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
                    <input type="number" step="0.01" value={item.cost} onChange={e => { const u = [...items]; u[i] = {...u[i], cost: e.target.value}; updateItems(u); }}
                      placeholder="السعر" className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-center" />
                    <select value={item.per} onChange={e => { const u = [...items]; u[i] = {...u[i], per: e.target.value}; updateItems(u); }}
                      className="w-28 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs">
                      <option value="bottle">لكل أزازة</option>
                      <option value="carton">لكل كرتونة</option>
                    </select>
                    <button onClick={() => updateItems(items.filter((_, j) => j !== i))}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <button onClick={() => updateItems([...items, { name: '', cost: 0, per: 'bottle' }])}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-400 hover:text-primary-600 hover:border-primary-400">+ إضافة بند</button>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={() => setEditSizeIdx(null)}>إلغاء</Button>
                <Button onClick={saveAll}>حفظ</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* === Modal: الإعدادات العامة === */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="إعدادات التسعير" size="lg">
        <div className="space-y-6">
          {/* المصاريف الشهرية */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">المصاريف الشهرية</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input label="إجمالي المرتبات" type="number" value={monthly.salaries} onChange={e => setMonthly({...monthly, salaries: e.target.value})} />
              <Input label="إيجار" type="number" value={monthly.rent} onChange={e => setMonthly({...monthly, rent: e.target.value})} />
              <Input label="بنزين/مواصلات" type="number" value={monthly.fuel} onChange={e => setMonthly({...monthly, fuel: e.target.value})} />
              <Input label="كهرباء ومياه" type="number" value={monthly.utilities} onChange={e => setMonthly({...monthly, utilities: e.target.value})} />
              <Input label="إهلاك أصول" type="number" value={monthly.depreciation} onChange={e => setMonthly({...monthly, depreciation: e.target.value})} />
              <Input label="مصاريف أخرى" type="number" value={monthly.other} onChange={e => setMonthly({...monthly, other: e.target.value})} />
            </div>
          </div>

          {/* هوامش الربح حسب نوع العميل */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">هوامش الربح حسب نوع العميل</h4>
            <div className="space-y-2">
              {margins.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={m.label} onChange={e => { const u = [...margins]; u[i] = {...u[i], label: e.target.value}; setMargins(u); }}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
                  <div className="flex items-center gap-1">
                    <input type="number" value={m.margin} onChange={e => { const u = [...margins]; u[i] = {...u[i], margin: e.target.value}; setMargins(u); }}
                      className="w-20 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-center" />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                  {margins.length > 1 && <button onClick={() => setMargins(margins.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600">✕</button>}
                </div>
              ))}
              <button onClick={() => setMargins([...margins, { key: `custom_${Date.now()}`, label: '', margin: 10 }])}
                className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-400 hover:text-primary-600 hover:border-primary-400">+ إضافة نوع عميل</button>
            </div>
          </div>

          {/* عام */}
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">عام</h4>
            <Input label="أيام العمل في الشهر" type="number" value={workDays} onChange={e => setWorkDays(e.target.value)} className="max-w-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setSettingsModal(false)}>إلغاء</Button>
          <Button onClick={saveAll}>حفظ الإعدادات</Button>
        </div>
      </Modal>
    </div>
  );
}
