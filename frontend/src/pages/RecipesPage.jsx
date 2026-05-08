import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import toast from 'react-hot-toast';

const emptyItem = () => ({ material_id: '', quantity: '', unit: '', waste_percentage: '0' });

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ product_id: '', name: '', output_quantity: '', output_unit: '', items: [emptyItem()] });
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadMeta(); }, []);

  async function load() {
    setLoading(true);
    try { const res = await api.get('/recipes?limit=100'); setRecipes(safeArray(res)); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [p, m, u] = await Promise.all([api.get('/products?limit=500'), api.get('/materials?limit=500'), api.get('/settings/units')]);
      setProducts(safeArray(p).map(x => ({ value: x.id, label: x.name })));
      setMaterials(safeArray(m).map(x => ({ value: x.id, label: x.name })));
      setUnits(safeArray(u).map(x => ({ value: x.id, label: x.name })));
    } catch {}
  }

  function openNew() {
    setEditItem(null);
    setForm({ product_id: '', name: '', output_quantity: '', output_unit: '', items: [emptyItem()] });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditItem(row);
    setForm({
      product_id: row.product_id || '',
      name: row.name || '',
      output_quantity: row.output_quantity || '',
      output_unit: row.output_unit || '',
      items: row.items?.length ? row.items.map(it => ({ material_id: it.material_id, quantity: it.quantity, unit: it.unit || '', waste_percentage: it.waste_percentage || '0' })) : [emptyItem()]
    });
    setModalOpen(true);
  }

  function updateItem(idx, field, val) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    setForm({ ...form, items });
  }
  function addItem() { setForm({ ...form, items: [...form.items, emptyItem()] }); }
  function removeItem(idx) { if (form.items.length > 1) setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); }

  async function handleSave() {
    if (!form.name || !form.product_id) return toast.error('اسم الوصفة والمنتج مطلوبين');
    if (form.items.some(it => !it.material_id || !it.quantity)) return toast.error('يرجى تعبئة بيانات جميع المواد');
    setSaving(true);
    try {
      if (editItem) await api.put(`/recipes/${editItem.id}`, form);
      else await api.post('/recipes', form);
      toast.success(editItem ? 'تم تحديث الوصفة' : 'تم إضافة الوصفة');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/recipes/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'اسم الوصفة' },
    { key: 'product_name', label: 'المنتج' },
    { key: 'output_quantity', label: 'كمية الإنتاج' },
    { key: 'output_unit_name', label: 'الوحدة' },
    { key: 'items_count', label: 'عدد المواد', render: (v, row) => row.items?.length || v || 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="التركيبات" description="وصفات الإنتاج - كل منتج محتاج إيه خامات وبأي كمية. مثلاً: عبوة زيت 1 لتر = 1 لتر زيت خام + 1 عبوة + 1 غطاء. النظام بيخصم الخامات تلقائياً لما تبدأ الإنتاج.">
        <Button icon={PlusIcon} onClick={openNew}>إضافة وصفة</Button>
      </PageHeader>

      <Card noPadding>
        <DataTable columns={columns} data={recipes} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل الوصفة' : 'إضافة وصفة جديدة'} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input label="اسم الوصفة *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="المنتج *" options={products} value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} />
          <Input label="كمية الإنتاج" type="number" value={form.output_quantity} onChange={e => setForm({...form, output_quantity: e.target.value})} />
          <Select label="وحدة الإنتاج" options={units} value={form.output_unit} onChange={e => setForm({...form, output_unit: e.target.value})} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">المواد المطلوبة</h4>
            <Button size="sm" variant="ghost" icon={PlusIcon} onClick={addItem}>إضافة مادة</Button>
          </div>

          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-4">
                  <Select label="المادة *" options={materials} value={item.material_id} onChange={e => updateItem(idx, 'material_id', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="الكمية *" type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <Select label="الوحدة" options={units} value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <Input label="الهدر %" type="number" value={item.waste_percentage} onChange={e => updateItem(idx, 'waste_percentage', e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
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
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
