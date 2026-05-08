import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import StatsCard from '../components/ui/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import api from '../utils/api';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const typeOpts = [{ value: 'incoming', label: 'وارد' }, { value: 'outgoing', label: 'صادر' }, { value: 'in_process', label: 'أثناء الإنتاج' }];
const resultOpts = [{ value: 'pass', label: 'ناجح' }, { value: 'fail', label: 'فاشل' }, { value: 'conditional', label: 'مشروط' }];
const resultColors = { pass: 'success', fail: 'danger', conditional: 'warning' };
const emptyCheckItem = () => ({ standard: '', measured_value: '', result: 'pass', notes: '' });

export default function QualityPage() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: 'incoming', reference_type: '', reference_id: '', item_name: '', check_date: new Date().toISOString().slice(0, 10), result: 'pass', notes: '', items: [emptyCheckItem()] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/quality-checks?limit=100'); setChecks(data.data || []); } catch {} finally { setLoading(false); }
  }

  function openNew() {
    setForm({ type: 'incoming', reference_type: '', reference_id: '', item_name: '', check_date: new Date().toISOString().slice(0, 10), result: 'pass', notes: '', items: [emptyCheckItem()] });
    setModalOpen(true);
  }

  function updateItem(idx, field, val) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    setForm({ ...form, items });
  }
  function addItem() { setForm({ ...form, items: [...form.items, emptyCheckItem()] }); }
  function removeItem(idx) { if (form.items.length > 1) setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); }

  async function handleSave() {
    if (!form.item_name) return toast.error('اسم الصنف مطلوب');
    setSaving(true);
    try {
      await api.post('/quality-checks', form);
      toast.success('تم إنشاء فحص الجودة');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  const passCount = checks.filter(c => c.result === 'pass').length;
  const failCount = checks.filter(c => c.result === 'fail').length;

  const columns = [
    { key: 'check_number', label: 'رقم الفحص' },
    { key: 'type', label: 'النوع', render: v => typeOpts.find(t => t.value === v)?.label || v },
    { key: 'item_name', label: 'الصنف' },
    { key: 'check_date', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'result', label: 'النتيجة', render: v => <Badge color={resultColors[v] || 'gray'}>{resultOpts.find(r => r.value === v)?.label || v}</Badge> },
    { key: 'notes', label: 'ملاحظات' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="فحص الجودة" description="سجل فحوصات الجودة للخامات الواردة والمنتجات التامة. حدد معايير الفحص والنتيجة (ناجح/فاشل).">
        <Button icon={PlusIcon} onClick={openNew}>فحص جديد</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={ClipboardDocumentCheckIcon} label="إجمالي الفحوصات" value={checks.length} color="blue" />
        <StatsCard icon={ClipboardDocumentCheckIcon} label="ناجح" value={passCount} color="green" />
        <StatsCard icon={ClipboardDocumentCheckIcon} label="فاشل" value={failCount} color="red" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={checks} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="فحص جودة جديد" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Select label="نوع الفحص" options={typeOpts} value={form.type} onChange={e => setForm({...form, type: e.target.value})} />
          <Input label="اسم الصنف *" value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})} />
          <Select label="مرجع" options={[{ value: 'purchase', label: 'أمر شراء' }, { value: 'production', label: 'أمر إنتاج' }, { value: 'sale', label: 'طلب بيع' }]} value={form.reference_type} onChange={e => setForm({...form, reference_type: e.target.value})} />
          <Input label="رقم المرجع" value={form.reference_id} onChange={e => setForm({...form, reference_id: e.target.value})} />
          <Input label="تاريخ الفحص" type="date" value={form.check_date} onChange={e => setForm({...form, check_date: e.target.value})} />
          <Select label="النتيجة العامة" options={resultOpts} value={form.result} onChange={e => setForm({...form, result: e.target.value})} />
          <Input label="ملاحظات" textarea className="md:col-span-2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">بنود الفحص</h4>
            <Button size="sm" variant="ghost" icon={PlusIcon} onClick={addItem}>إضافة بند</Button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-4">
                  <Input label="المعيار" value={item.standard} onChange={e => updateItem(idx, 'standard', e.target.value)} />
                </div>
                <div className="col-span-5 md:col-span-3">
                  <Input label="القيمة المقاسة" value={item.measured_value} onChange={e => updateItem(idx, 'measured_value', e.target.value)} />
                </div>
                <div className="col-span-5 md:col-span-3">
                  <Select label="النتيجة" options={resultOpts} value={item.result} onChange={e => updateItem(idx, 'result', e.target.value)} />
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-center pb-1">
                  <button onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>حفظ</Button>
        </div>
      </Modal>
    </div>
  );
}
