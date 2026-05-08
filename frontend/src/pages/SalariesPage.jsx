import { useState, useEffect } from 'react';
import { CalculatorIcon, BanknotesIcon, PlusIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import StatsCard from '../components/ui/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function SalariesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salaries, setSalaries] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(null);
  const [advanceModal, setAdvanceModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ bonuses: '', deductions: '', notes: '' });
  const [advanceForm, setAdvanceForm] = useState({ employee_id: '', amount: '', date: now.toISOString().slice(0, 10), notes: '' });
  const [employees, setEmployees] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadEmployees(); }, []);
  useEffect(() => { load(); }, [month, year]);

  async function load() {
    setLoading(true);
    try {
      const [sal, adv] = await Promise.all([
        api.get(`/salaries?month=${month}&year=${year}`),
        api.get(`/salaries/advances?month=${month}&year=${year}`).catch(() => ({ data: { data: [] } }))
      ]);
      setSalaries(safeArray(sal));
      setAdvances(safeArray(adv));
    } catch {} finally { setLoading(false); }
  }

  async function loadEmployees() {
    try { const res = await api.get('/employees?limit=500&is_active=1'); setEmployees(safeArray(res).map(e => ({ value: e.id, label: e.name }))); } catch {}
  }

  async function handleCalculate() {
    setCalculating(true);
    try { await api.post('/salaries/calculate', { month, year }); toast.success('تم حساب الرواتب'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل حساب الرواتب'); } finally { setCalculating(false); }
  }

  async function handlePayAll() {
    if (!confirm('هل تريد صرف جميع الرواتب؟')) return;
    setPaying(true);
    try { await api.post('/salaries/pay', { month, year }); toast.success('تم صرف الرواتب'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل صرف الرواتب'); } finally { setPaying(false); }
  }

  function openAdjust(row) {
    setAdjustModal(row);
    setAdjustForm({ bonuses: row.bonuses || '', deductions: row.deductions || '', notes: '' });
  }

  async function handleAdjust() {
    setSaving(true);
    try {
      await api.put(`/salaries/${adjustModal.id}/adjust`, adjustForm);
      toast.success('تم التعديل');
      setAdjustModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'فشل التعديل'); } finally { setSaving(false); }
  }

  async function handleAdvance() {
    if (!advanceForm.employee_id || !advanceForm.amount) return toast.error('يرجى تعبئة الحقول المطلوبة');
    setSaving(true);
    try {
      await api.post('/salaries/advances', advanceForm);
      toast.success('تم تسجيل السلفة');
      setAdvanceModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  const totalNet = salaries.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
  const totalBase = salaries.reduce((s, r) => s + (Number(r.base_salary) || 0), 0);

  const monthOpts = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }));
  const yearOpts = Array.from({ length: 5 }, (_, i) => ({ value: year - 2 + i, label: `${year - 2 + i}` }));

  return (
    <div className="space-y-6">
      <PageHeader title="المرتبات" description="احسب وصرف مرتبات الموظفين شهرياً. النظام بيحسب: المرتب الأساسي + الإضافي - الخصومات - السلف = صافي المرتب.">
        <Button variant="outline" icon={PlusIcon} onClick={() => { setAdvanceForm({ employee_id: '', amount: '', date: now.toISOString().slice(0, 10), notes: '' }); setAdvanceModal(true); }}>سلفة</Button>
        <Button variant="outline" icon={CalculatorIcon} loading={calculating} onClick={handleCalculate}>حساب الرواتب</Button>
        <Button icon={BanknotesIcon} loading={paying} onClick={handlePayAll}>صرف الكل</Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Select options={monthOpts} value={month} onChange={e => setMonth(Number(e.target.value))} className="w-24" />
        <Select options={yearOpts} value={year} onChange={e => setYear(Number(e.target.value))} className="w-28" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={BanknotesIcon} label="إجمالي الرواتب الأساسية" value={formatCurrency(totalBase)} color="blue" />
        <StatsCard icon={BanknotesIcon} label="صافي الرواتب" value={formatCurrency(totalNet)} color="green" />
        <StatsCard icon={BanknotesIcon} label="عدد الموظفين" value={salaries.length} color="purple" />
      </div>

      <Card title="كشف الرواتب" noPadding>
        {loading ? (
          <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  {['الموظف', 'الراتب الأساسي', 'إضافي', 'مكافآت', 'خصومات', 'سلف', 'الصافي', 'الحالة', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {salaries.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-lg">لا توجد بيانات - اضغط "حساب الرواتب"</td></tr>
                ) : salaries.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{row.employee_name}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(row.base_salary)}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(row.overtime_amount)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{formatCurrency(row.bonuses)}</td>
                    <td className="px-4 py-3 text-sm text-red-500">{formatCurrency(row.deductions)}</td>
                    <td className="px-4 py-3 text-sm text-amber-600">{formatCurrency(row.advances)}</td>
                    <td className="px-4 py-3 text-sm font-bold">{formatCurrency(row.net_salary)}</td>
                    <td className="px-4 py-3"><Badge color={row.is_paid ? 'success' : 'gray'}>{row.is_paid ? 'مصروف' : 'معلق'}</Badge></td>
                    <td className="px-4 py-3">
                      <button onClick={() => openAdjust(row)} className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 hover:bg-amber-100">تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {advances.length > 0 && (
        <Card title="السلف" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  {['الموظف', 'المبلغ', 'التاريخ', 'ملاحظات'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {advances.map(adv => (
                  <tr key={adv.id}>
                    <td className="px-4 py-3 text-sm">{adv.employee_name}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(adv.amount)}</td>
                    <td className="px-4 py-3 text-sm">{adv.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{adv.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`تعديل راتب ${adjustModal?.employee_name || ''}`}>
        <div className="space-y-4">
          <Input label="مكافآت" type="number" value={adjustForm.bonuses} onChange={e => setAdjustForm({...adjustForm, bonuses: e.target.value})} />
          <Input label="خصومات" type="number" value={adjustForm.deductions} onChange={e => setAdjustForm({...adjustForm, deductions: e.target.value})} />
          <Input label="ملاحظات" textarea value={adjustForm.notes} onChange={e => setAdjustForm({...adjustForm, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setAdjustModal(null)}>إلغاء</Button>
          <Button loading={saving} onClick={handleAdjust}>حفظ</Button>
        </div>
      </Modal>

      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title="تسجيل سلفة">
        <div className="space-y-4">
          <Select label="الموظف *" options={employees} value={advanceForm.employee_id} onChange={e => setAdvanceForm({...advanceForm, employee_id: e.target.value})} />
          <Input label="المبلغ *" type="number" value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm, amount: e.target.value})} />
          <Input label="التاريخ" type="date" value={advanceForm.date} onChange={e => setAdvanceForm({...advanceForm, date: e.target.value})} />
          <Input label="ملاحظات" textarea value={advanceForm.notes} onChange={e => setAdvanceForm({...advanceForm, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setAdvanceModal(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleAdvance}>حفظ</Button>
        </div>
      </Modal>
    </div>
  );
}
