import { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', unit: '', cost_price: '', min_stock: '', current_stock: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  useEffect(() => { load(); loadMeta(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/materials?limit=100'); setMaterials(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [u, c] = await Promise.all([api.get('/settings/units'), api.get('/materials/meta/categories')]);
      setUnits((u.data.data || []).map(x => ({ value: x.id, label: x.name })));
      setCategories((c.data.data || []).map(x => ({ value: x.id, label: x.name })));
    } catch {}
  }

  function openNew() { setEditItem(null); setForm({ name: '', category: '', unit: '', cost_price: '', min_stock: '', current_stock: '', description: '' }); setModalOpen(true); }
  function openEdit(row) { setEditItem(row); setForm({ name: row.name, category: row.category || '', unit: row.unit || '', cost_price: row.cost_price || '', min_stock: row.min_stock || '', current_stock: row.current_stock || '', description: row.description || '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name) return toast.error('اسم المادة مطلوب');
    setSaving(true);
    try {
      if (editItem) await api.put(`/materials/${editItem.id}`, form);
      else await api.post('/materials', form);
      toast.success(editItem ? 'تم تحديث المادة' : 'تم إضافة المادة');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/materials/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'اسم المادة' },
    { key: 'category_name', label: 'التصنيف' },
    { key: 'unit_name', label: 'الوحدة' },
    { key: 'cost_price', label: 'سعر التكلفة', render: v => formatCurrency(v) },
    { key: 'current_stock', label: 'المخزون الحالي', render: (v, row) => (
      <span className={v <= row.min_stock ? 'text-red-500 font-bold' : ''}>{v ?? 0}</span>
    )},
    { key: 'min_stock', label: 'الحد الأدنى' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="الخامات" description="المواد الخام اللي بتستخدمها في التصنيع (زيت خام، عبوات، كراتين...). حدد الحد الأدنى لكل خامة عشان تتنبه قبل ما تخلص.">
        <Button icon={PlusIcon} onClick={openNew}>إضافة مادة</Button>
      </PageHeader>

      <Card noPadding>
        <DataTable columns={columns} data={materials} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل المادة' : 'إضافة مادة جديدة'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم المادة *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="التصنيف" options={categories} value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
          <Select label="الوحدة" options={units} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
          <Input label="سعر التكلفة" type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} />
          <Input label="الحد الأدنى للمخزون" type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} />
          <Input label="المخزون الحالي" type="number" value={form.current_stock} onChange={e => setForm({...form, current_stock: e.target.value})} />
          <Input label="الوصف" textarea className="md:col-span-2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
