import { useState, useEffect } from 'react';
import { PlusIcon, PlayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api from '../utils/api';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const statusMap = { planned: { label: 'مخطط', color: 'gray' }, in_progress: { label: 'قيد التنفيذ', color: 'warning' }, completed: { label: 'مكتمل', color: 'success' }, cancelled: { label: 'ملغي', color: 'danger' } };

export default function ProductionPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [completeModal, setCompleteModal] = useState(null);
  const [actualQty, setActualQty] = useState('');
  const [form, setForm] = useState({ recipe_id: '', planned_qty: '', planned_date: '' });
  const [recipes, setRecipes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadMeta(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/production?limit=100'); setOrders(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try { const { data } = await api.get('/recipes?limit=500'); setRecipes((data.data || []).map(x => ({ value: x.id, label: x.name }))); } catch {}
  }

  function openNew() { setForm({ recipe_id: '', planned_qty: '', planned_date: '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.recipe_id || !form.planned_qty) return toast.error('الوصفة والكمية مطلوبين');
    setSaving(true);
    try {
      await api.post('/production', form);
      toast.success('تم إنشاء أمر الإنتاج');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleStart(row) {
    try { await api.put(`/production/${row.id}/start`); toast.success('تم بدء الإنتاج'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل بدء الإنتاج'); }
  }

  async function handleComplete() {
    if (!actualQty) return toast.error('أدخل الكمية الفعلية');
    try {
      await api.put(`/production/${completeModal.id}/complete`, { actual_qty: actualQty });
      toast.success('تم إكمال أمر الإنتاج');
      setCompleteModal(null); setActualQty(''); load();
    } catch (err) { toast.error(err.response?.data?.message || 'فشل إكمال الإنتاج'); }
  }

  async function handleCancel(row) {
    if (!confirm('هل تريد إلغاء أمر الإنتاج؟')) return;
    try { await api.put(`/production/${row.id}/cancel`); toast.success('تم الإلغاء'); load(); } catch { toast.error('فشل الإلغاء'); }
  }

  const columns = [
    { key: 'order_number', label: 'رقم الأمر' },
    { key: 'product_name', label: 'المنتج' },
    { key: 'recipe_name', label: 'الوصفة' },
    { key: 'planned_qty', label: 'الكمية المخططة' },
    { key: 'actual_qty', label: 'الكمية الفعلية', render: v => v || '-' },
    { key: 'status', label: 'الحالة', render: v => { const s = statusMap[v] || statusMap.planned; return <Badge color={s.color}>{s.label}</Badge>; } },
    { key: 'planned_date', label: 'تاريخ التنفيذ', render: v => formatDate(v) },
    { key: 'actions', label: 'إجراءات', render: (_, row) => (
      <div className="flex items-center gap-1">
        {row.status === 'planned' && (
          <button onClick={() => handleStart(row)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500" title="بدء الإنتاج">
            <PlayIcon className="h-4 w-4" />
          </button>
        )}
        {row.status === 'in_progress' && (
          <button onClick={() => { setCompleteModal(row); setActualQty(row.planned_qty); }} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500" title="إكمال">
            <CheckCircleIcon className="h-4 w-4" />
          </button>
        )}
        {(row.status === 'planned' || row.status === 'in_progress') && (
          <button onClick={() => handleCancel(row)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="إلغاء">
            <XCircleIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="أوامر الإنتاج" description="أنشئ أمر إنتاج جديد، اختار التركيبة والكمية. لما تبدأ الإنتاج النظام بيخصم الخامات من المخزون. لما تكمل بيضيف المنتجات التامة.">
        <Button icon={PlusIcon} onClick={openNew}>أمر إنتاج جديد</Button>
      </PageHeader>

      <Card noPadding>
        <DataTable columns={columns} data={orders} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="أمر إنتاج جديد">
        <div className="space-y-4">
          <Select label="الوصفة *" options={recipes} value={form.recipe_id} onChange={e => setForm({...form, recipe_id: e.target.value})} />
          <Input label="الكمية المخططة *" type="number" value={form.planned_qty} onChange={e => setForm({...form, planned_qty: e.target.value})} />
          <Input label="تاريخ التنفيذ" type="date" value={form.planned_date} onChange={e => setForm({...form, planned_date: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>إنشاء</Button>
        </div>
      </Modal>

      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="إكمال أمر الإنتاج">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">أمر رقم: {completeModal?.order_number}</p>
          <Input label="الكمية الفعلية المنتجة *" type="number" value={actualQty} onChange={e => setActualQty(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCompleteModal(null)}>إلغاء</Button>
          <Button onClick={handleComplete}>تأكيد الإكمال</Button>
        </div>
      </Modal>
    </div>
  );
}
