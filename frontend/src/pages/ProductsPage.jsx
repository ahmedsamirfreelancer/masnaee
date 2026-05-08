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

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', category_id: '', unit_id: '', cost_price: '', selling_price: '', min_stock: '', barcode: '', description: '' });
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadMeta(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/products?limit=100'); setProducts(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [u, c] = await Promise.all([api.get('/settings/units'), api.get('/products/meta/categories')]);
      setUnits((u.data.data || []).map(x => ({ value: x.id, label: x.name })));
      setCategories((c.data.data || []).map(x => ({ value: x.id, label: x.name })));
    } catch {}
  }

  function openNew() { setEditItem(null); setForm({ name: '', sku: '', category_id: '', unit_id: '', cost_price: '', selling_price: '', min_stock: '', barcode: '', description: '' }); setModalOpen(true); }
  function openEdit(row) { setEditItem(row); setForm({ name: row.name, sku: row.sku || '', category_id: row.category_id || '', unit_id: row.unit_id, cost_price: row.cost_price, selling_price: row.selling_price, min_stock: row.min_stock, barcode: row.barcode || '', description: row.description || '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name || !form.unit_id) return toast.error('الاسم والوحدة مطلوبين');
    setSaving(true);
    try {
      if (editItem) await api.put(`/products/${editItem.id}`, { ...form, is_active: true });
      else await api.post('/products', form);
      toast.success(editItem ? 'تم تحديث المنتج' : 'تم إضافة المنتج');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/products/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'المنتج' },
    { key: 'sku', label: 'الكود' },
    { key: 'category_name', label: 'التصنيف' },
    { key: 'cost_price', label: 'سعر التكلفة', render: v => formatCurrency(v) },
    { key: 'selling_price', label: 'سعر البيع', render: v => formatCurrency(v) },
    { key: 'current_stock', label: 'المخزون', render: (v, row) => (
      <span className={v <= row.min_stock ? 'text-red-500 font-bold' : ''}>{v} {row.unit_name}</span>
    )},
    { key: 'is_active', label: 'الحالة', render: v => <Badge color={v ? 'success' : 'gray'}>{v ? 'نشط' : 'معطل'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="المنتجات" description="كل المنتجات التامة اللي بتبيعها. أضف منتج جديد، حدد سعر التكلفة وسعر البيع والحد الأدنى للمخزون. لما المخزون ينزل عن الحد الأدنى هيظهر تنبيه.">
        <Button icon={PlusIcon} onClick={openNew}>إضافة منتج</Button>
      </PageHeader>

      <Card noPadding>
        <DataTable columns={columns} data={products} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل المنتج' : 'إضافة منتج جديد'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم المنتج *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Input label="الكود (SKU)" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} />
          <Select label="التصنيف" options={categories} value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} />
          <Select label="الوحدة *" options={units} value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})} />
          <Input label="سعر التكلفة" type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} />
          <Input label="سعر البيع" type="number" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} />
          <Input label="الحد الأدنى للمخزون" type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} />
          <Input label="الباركود" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
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
