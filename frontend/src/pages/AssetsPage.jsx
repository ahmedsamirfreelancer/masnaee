import { useState, useEffect } from 'react';
import { PlusIcon, CalculatorIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
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
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const categoryOpts = [{ value: 'machinery', label: 'آلات' }, { value: 'vehicle', label: 'مركبات' }, { value: 'equipment', label: 'معدات' }, { value: 'furniture', label: 'أثاث' }, { value: 'other', label: 'أخرى' }];
const depMethods = [{ value: 'straight_line', label: 'القسط الثابت' }, { value: 'declining_balance', label: 'القسط المتناقص' }];
const categoryColors = { machinery: 'info', vehicle: 'success', equipment: 'warning', furniture: 'gray', other: 'gray' };

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'machinery', purchase_date: '', purchase_cost: '', useful_life_months: '', salvage_value: '0', depreciation_method: 'straight_line', notes: '' });
  const [saving, setSaving] = useState(false);
  const [depRunning, setDepRunning] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/assets?limit=100'); setAssets(data.data || []); } catch {} finally { setLoading(false); }
  }

  function openNew() { setEditItem(null); setForm({ name: '', category: 'machinery', purchase_date: '', purchase_cost: '', useful_life_months: '', salvage_value: '0', depreciation_method: 'straight_line', notes: '' }); setModalOpen(true); }
  function openEdit(row) {
    setEditItem(row);
    setForm({ name: row.name, category: row.category || 'machinery', purchase_date: row.purchase_date?.slice(0, 10) || '', purchase_cost: row.purchase_cost || '', useful_life_months: row.useful_life_months || '', salvage_value: row.salvage_value || '0', depreciation_method: row.depreciation_method || 'straight_line', notes: row.notes || '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.purchase_cost) return toast.error('الاسم وتكلفة الشراء مطلوبين');
    setSaving(true);
    try {
      if (editItem) await api.put(`/assets/${editItem.id}`, form);
      else await api.post('/assets', form);
      toast.success(editItem ? 'تم التحديث' : 'تم إضافة الأصل');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/assets/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  async function runDepreciation() {
    if (!confirm('هل تريد تشغيل الإهلاك الشهري لجميع الأصول؟')) return;
    setDepRunning(true);
    try { await api.post('/assets/depreciation/run'); toast.success('تم تشغيل الإهلاك'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل تشغيل الإهلاك'); } finally { setDepRunning(false); }
  }

  const totalCost = assets.reduce((s, a) => s + (Number(a.purchase_cost) || 0), 0);
  const totalCurrent = assets.reduce((s, a) => s + (Number(a.current_value) || 0), 0);
  const totalDep = assets.reduce((s, a) => s + (Number(a.accumulated_depreciation) || 0), 0);

  const columns = [
    { key: 'name', label: 'اسم الأصل' },
    { key: 'category', label: 'التصنيف', render: v => <Badge color={categoryColors[v] || 'gray'}>{categoryOpts.find(c => c.value === v)?.label || v}</Badge> },
    { key: 'purchase_date', label: 'تاريخ الشراء', render: v => formatDate(v) },
    { key: 'purchase_cost', label: 'تكلفة الشراء', render: v => formatCurrency(v) },
    { key: 'accumulated_depreciation', label: 'الإهلاك المتراكم', render: v => formatCurrency(v) },
    { key: 'current_value', label: 'القيمة الحالية', render: v => formatCurrency(v) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="الأصول" description="أصول المصنع الثابتة (ماكينات، سيارات، معدات). النظام بيحسب الإهلاك الشهري تلقائي ويسجل القيود.">
        <Button variant="outline" icon={CalculatorIcon} loading={depRunning} onClick={runDepreciation}>تشغيل الإهلاك</Button>
        <Button icon={PlusIcon} onClick={openNew}>إضافة أصل</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={BuildingOffice2Icon} label="إجمالي تكلفة الأصول" value={formatCurrency(totalCost)} color="blue" />
        <StatsCard icon={BuildingOffice2Icon} label="القيمة الحالية" value={formatCurrency(totalCurrent)} color="green" />
        <StatsCard icon={BuildingOffice2Icon} label="الإهلاك المتراكم" value={formatCurrency(totalDep)} color="amber" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={assets} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل الأصل' : 'إضافة أصل جديد'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم الأصل *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="التصنيف" options={categoryOpts} value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
          <Input label="تاريخ الشراء" type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
          <Input label="تكلفة الشراء *" type="number" value={form.purchase_cost} onChange={e => setForm({...form, purchase_cost: e.target.value})} />
          <Input label="العمر الإنتاجي (شهور)" type="number" value={form.useful_life_months} onChange={e => setForm({...form, useful_life_months: e.target.value})} />
          <Input label="القيمة التخريدية" type="number" value={form.salvage_value} onChange={e => setForm({...form, salvage_value: e.target.value})} />
          <Select label="طريقة الإهلاك" options={depMethods} value={form.depreciation_method} onChange={e => setForm({...form, depreciation_method: e.target.value})} />
          <Input label="ملاحظات" textarea className="md:col-span-2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
