import { useState, useEffect } from 'react';
import { PlusIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatsCard from '../components/ui/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const paymentMethods = [{ value: 'cash', label: 'نقدي' }, { value: 'bank', label: 'تحويل بنكي' }, { value: 'check', label: 'شيك' }];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ category_id: '', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', notes: '' });
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadCategories(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [exp, sum] = await Promise.all([api.get('/expenses?limit=100'), api.get('/expenses/summary').catch(() => ({ data: { data: [] } }))]);
      setExpenses(exp.data.data || []);
      setSummary(sum.data.data || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadCategories() {
    try { const { data } = await api.get('/expenses/categories'); setCategories((data.data || []).map(c => ({ value: c.id, label: c.name }))); } catch {}
  }

  function openNew() { setEditItem(null); setForm({ category_id: '', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', notes: '' }); setModalOpen(true); }
  function openEdit(row) {
    setEditItem(row);
    setForm({ category_id: row.category_id || '', description: row.description || '', amount: row.amount || '', expense_date: row.expense_date?.slice(0, 10) || '', payment_method: row.payment_method || 'cash', notes: row.notes || '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.amount || !form.description) return toast.error('المبلغ والوصف مطلوبين');
    setSaving(true);
    try {
      if (editItem) await api.put(`/expenses/${editItem.id}`, form);
      else await api.post('/expenses', form);
      toast.success(editItem ? 'تم التحديث' : 'تم إضافة المصروف');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return;
    try { await api.delete(`/expenses/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const colors = ['blue', 'green', 'red', 'amber', 'purple', 'sky'];
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const columns = [
    { key: 'description', label: 'الوصف' },
    { key: 'category_name', label: 'التصنيف' },
    { key: 'amount', label: 'المبلغ', render: v => formatCurrency(v) },
    { key: 'expense_date', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'payment_method', label: 'طريقة الدفع', render: v => paymentMethods.find(m => m.value === v)?.label || v },
    { key: 'notes', label: 'ملاحظات' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="المصروفات" description="سجل كل مصروفات المصنع (إيجار، كهرباء، بنزين، صيانة...). كل مصروف بيتسجل قيد محاسبي تلقائي.">
        <Button icon={PlusIcon} onClick={openNew}>إضافة مصروف</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={BanknotesIcon} label="إجمالي المصروفات" value={formatCurrency(totalExpenses)} color="red" />
        {summary.slice(0, 3).map((cat, i) => (
          <StatsCard key={cat.category_id || i} icon={BanknotesIcon} label={cat.category_name || 'أخرى'} value={formatCurrency(cat.total)} color={colors[i + 1] || 'blue'} />
        ))}
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={expenses} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل المصروف' : 'إضافة مصروف جديد'}>
        <div className="space-y-4">
          <Select label="التصنيف" options={categories} value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} />
          <Input label="الوصف *" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <Input label="المبلغ *" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          <Input label="التاريخ" type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
          <Select label="طريقة الدفع" options={paymentMethods} value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} />
          <Input label="ملاحظات" textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
