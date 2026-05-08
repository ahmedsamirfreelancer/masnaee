import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const emptyLine = () => ({ account_id: '', debit: '', credit: '', description: '' });
const refTypes = [{ value: 'manual', label: 'يدوي' }, { value: 'sale', label: 'بيع' }, { value: 'purchase', label: 'شراء' }, { value: 'payment', label: 'دفعة' }, { value: 'salary', label: 'رواتب' }];

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', lines: [emptyLine(), emptyLine()] });
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', reference_type: '', is_posted: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadAccounts(); }, []);
  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.reference_type) params.append('reference_type', filters.reference_type);
    if (filters.is_posted) params.append('is_posted', filters.is_posted);
    try { const { data } = await api.get(`/journal-entries?${params}`); setEntries(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadAccounts() {
    try { const { data } = await api.get('/accounts?limit=500'); setAccounts((data.data || []).map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))); } catch {}
  }

  function openNew() { setForm({ date: new Date().toISOString().slice(0, 10), description: '', lines: [emptyLine(), emptyLine()] }); setModalOpen(true); }

  function updateLine(idx, field, val) {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: val };
    if (field === 'debit' && val) lines[idx].credit = '';
    if (field === 'credit' && val) lines[idx].debit = '';
    setForm({ ...form, lines });
  }
  function addLine() { setForm({ ...form, lines: [...form.lines, emptyLine()] }); }
  function removeLine(idx) { if (form.lines.length > 2) setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); }

  const lineTotals = useMemo(() => {
    let debit = 0, credit = 0;
    form.lines.forEach(l => { debit += Number(l.debit) || 0; credit += Number(l.credit) || 0; });
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
  }, [form.lines]);

  async function handleSave() {
    if (!form.description) return toast.error('الوصف مطلوب');
    if (form.lines.some(l => !l.account_id)) return toast.error('يرجى اختيار الحساب لكل سطر');
    if (!lineTotals.balanced) return toast.error('إجمالي المدين يجب أن يساوي إجمالي الدائن');
    if (lineTotals.debit === 0) return toast.error('يجب إدخال مبالغ');
    setSaving(true);
    try {
      await api.post('/journal-entries', form);
      toast.success('تم إنشاء القيد');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handlePost(row) {
    try { await api.put(`/journal-entries/${row.id}/post`); toast.success('تم ترحيل القيد'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل الترحيل'); }
  }

  const columns = [
    { key: 'entry_number', label: 'رقم القيد' },
    { key: 'date', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'description', label: 'الوصف' },
    { key: 'reference_type', label: 'النوع', render: v => refTypes.find(r => r.value === v)?.label || v },
    { key: 'total_debit', label: 'المدين', render: v => formatCurrency(v) },
    { key: 'total_credit', label: 'الدائن', render: v => formatCurrency(v) },
    { key: 'is_posted', label: 'الحالة', render: v => <Badge color={v ? 'success' : 'gray'}>{v ? 'مرحّل' : 'مسودة'}</Badge> },
    { key: 'actions', label: '', render: (_, row) => !row.is_posted && (
      <button onClick={() => handlePost(row)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500" title="ترحيل">
        <CheckCircleIcon className="h-4 w-4" />
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="القيود اليومية" description="كل العمليات المالية بتتسجل هنا تلقائي (بيع، شراء، مصروف، مرتب). تقدر كمان تضيف قيد يدوي. لازم المدين يساوي الدائن.">
        <Button icon={PlusIcon} onClick={openNew}>قيد جديد</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <Select options={refTypes} value={filters.reference_type} onChange={e => setFilters({...filters, reference_type: e.target.value})} placeholder="النوع" className="w-36" />
        <Select options={[{ value: '1', label: 'مرحّل' }, { value: '0', label: 'مسودة' }]} value={filters.is_posted} onChange={e => setFilters({...filters, is_posted: e.target.value})} placeholder="الحالة" className="w-32" />
        <Input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} className="w-40" />
        <Input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} className="w-40" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={entries} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="قيد يومي جديد" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input label="التاريخ *" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          <Input label="الوصف *" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">بنود القيد</h4>
            <Button size="sm" variant="ghost" icon={PlusIcon} onClick={addLine}>إضافة سطر</Button>
          </div>
          <div className="space-y-3">
            {form.lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-4">
                  <Select label="الحساب *" options={accounts} value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="مدين" type="number" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="دائن" type="number" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <Input label="بيان" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                  <button onClick={() => removeLine(idx)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg flex justify-between items-center">
          <div className="flex gap-6 text-sm">
            <span>إجمالي المدين: <strong className="text-slate-800 dark:text-white">{formatCurrency(lineTotals.debit)}</strong></span>
            <span>إجمالي الدائن: <strong className="text-slate-800 dark:text-white">{formatCurrency(lineTotals.credit)}</strong></span>
          </div>
          <Badge color={lineTotals.balanced && lineTotals.debit > 0 ? 'success' : 'danger'}>{lineTotals.balanced ? 'متوازن' : 'غير متوازن'}</Badge>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>حفظ القيد</Button>
        </div>
      </Modal>
    </div>
  );
}
