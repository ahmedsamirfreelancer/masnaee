import { useState, useEffect } from 'react';
import { PlusIcon, CubeIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
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
import { formatDate, formatNumber } from '../utils/formatters';
import toast from 'react-hot-toast';

const movementTypes = [
  { value: 'in', label: 'إدخال' }, { value: 'out', label: 'إخراج' },
  { value: 'adjustment', label: 'تعديل' }, { value: 'transfer', label: 'تحويل' },
];

export default function InventoryPage() {
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_id: '', item_type: 'product', quantity: '', type: 'adjustment', notes: '' });
  const [filters, setFilters] = useState({ type: '', date_from: '', date_to: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadStock(); }, []);
  useEffect(() => { if (tab === 'movements') loadMovements(); }, [tab, filters]);

  async function loadStock() {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory/stock');
      setStock(data.data || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadMovements() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filters.type) params.append('type', filters.type);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    try {
      const { data } = await api.get(`/inventory/movements?${params}`);
      setMovements(data.data || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadItems() {
    try {
      const [p, m] = await Promise.all([api.get('/products?limit=500'), api.get('/materials?limit=500')]);
      setItems([
        ...(p.data.data || []).map(x => ({ value: `product_${x.id}`, label: `[منتج] ${x.name}` })),
        ...(m.data.data || []).map(x => ({ value: `material_${x.id}`, label: `[مادة] ${x.name}` })),
      ]);
    } catch {}
  }

  function openAdjust() {
    setForm({ item_id: '', item_type: 'product', quantity: '', type: 'adjustment', notes: '' });
    loadItems();
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.item_id || !form.quantity) return toast.error('يرجى تعبئة جميع الحقول المطلوبة');
    const [itemType, itemId] = form.item_id.split('_');
    setSaving(true);
    try {
      await api.post('/inventory/adjustments', { item_type: itemType, item_id: itemId, quantity: form.quantity, type: form.type, notes: form.notes });
      toast.success('تم تعديل المخزون');
      setModalOpen(false); loadStock(); if (tab === 'movements') loadMovements();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  const lowStock = stock.filter(s => s.current_stock <= s.min_stock).length;
  const totalItems = stock.length;

  const stockColumns = [
    { key: 'name', label: 'الصنف' },
    { key: 'item_type', label: 'النوع', render: v => <Badge color={v === 'product' ? 'info' : 'gray'}>{v === 'product' ? 'منتج' : 'مادة خام'}</Badge> },
    { key: 'current_stock', label: 'الرصيد الحالي', render: (v, row) => `${formatNumber(v)} ${row.unit_name || ''}` },
    { key: 'min_stock', label: 'الحد الأدنى' },
    { key: 'status', label: 'الحالة', render: (_, row) => {
      if (row.current_stock <= 0) return <Badge color="danger">نفد</Badge>;
      if (row.current_stock <= row.min_stock) return <Badge color="warning">منخفض</Badge>;
      return <Badge color="success">متوفر</Badge>;
    }},
  ];

  const movementColumns = [
    { key: 'item_name', label: 'الصنف' },
    { key: 'type', label: 'نوع الحركة', render: v => {
      const map = { in: { l: 'إدخال', c: 'success' }, out: { l: 'إخراج', c: 'danger' }, adjustment: { l: 'تعديل', c: 'warning' }, transfer: { l: 'تحويل', c: 'info' } };
      const m = map[v] || map.adjustment;
      return <Badge color={m.c}>{m.l}</Badge>;
    }},
    { key: 'quantity', label: 'الكمية', render: v => formatNumber(v) },
    { key: 'reference', label: 'المرجع' },
    { key: 'notes', label: 'ملاحظات' },
    { key: 'created_at', label: 'التاريخ', render: v => formatDate(v) },
  ];

  const tabs = [
    { key: 'stock', label: 'أرصدة المخزون', icon: CubeIcon },
    { key: 'movements', label: 'حركات المخزون', icon: ArrowsRightLeftIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="المخزون" description="تتبع أرصدة الخامات والمنتجات وحركات المخزون (دخول/خروج/تحويل). تقدر تعمل تعديل يدوي لو في فرق بين الفعلي والنظام.">
        <Button icon={PlusIcon} onClick={openAdjust}>تعديل يدوي</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={CubeIcon} label="إجمالي الأصناف" value={totalItems} color="blue" />
        <StatsCard icon={CubeIcon} label="مخزون منخفض" value={lowStock} color="red" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <Card noPadding>
          <DataTable columns={stockColumns} data={stock} loading={loading} />
        </Card>
      )}

      {tab === 'movements' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Select options={movementTypes} value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} placeholder="نوع الحركة" className="w-40" />
            <Input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} className="w-40" />
            <Input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} className="w-40" />
          </div>
          <Card noPadding>
            <DataTable columns={movementColumns} data={movements} loading={loading} />
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تعديل مخزون يدوي">
        <div className="space-y-4">
          <Select label="الصنف *" options={items} value={form.item_id} onChange={e => setForm({...form, item_id: e.target.value})} />
          <Input label="الكمية *" type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
          <Select label="نوع التعديل" options={movementTypes} value={form.type} onChange={e => setForm({...form, type: e.target.value})} />
          <Input label="ملاحظات" textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>حفظ</Button>
        </div>
      </Modal>
    </div>
  );
}
