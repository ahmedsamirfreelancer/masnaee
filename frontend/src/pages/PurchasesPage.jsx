import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const statusOpts = [{ value: 'draft', label: 'مسودة' }, { value: 'confirmed', label: 'مؤكد' }, { value: 'received', label: 'تم الاستلام' }, { value: 'cancelled', label: 'ملغي' }];
const statusColors = { draft: 'gray', confirmed: 'info', received: 'success', cancelled: 'danger' };
const emptyLine = () => ({ material_id: '', quantity: '1', unit_price: '', discount_percent: '0' });

export default function PurchasesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', notes: '', items: [emptyLine()] });
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadMeta(); }, []);
  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filters.status) params.append('status', filters.status);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    try { const { data } = await api.get(`/purchases?${params}`); setOrders(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [s, m] = await Promise.all([api.get('/suppliers?limit=500'), api.get('/materials?limit=500')]);
      setSuppliers((s.data.data || []).map(x => ({ value: x.id, label: x.name })));
      setMaterials((m.data.data || []).map(x => ({ value: x.id, label: x.name, price: x.cost_price })));
    } catch {}
  }

  function openNew() { setForm({ supplier_id: '', notes: '', items: [emptyLine()] }); setModalOpen(true); }

  function updateLine(idx, field, val) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === 'material_id') {
      const mat = materials.find(m => m.value == val);
      if (mat) items[idx].unit_price = mat.price || '';
    }
    setForm({ ...form, items });
  }
  function addLine() { setForm({ ...form, items: [...form.items, emptyLine()] }); }
  function removeLine(idx) { if (form.items.length > 1) setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); }

  const totals = useMemo(() => {
    let subtotal = 0;
    form.items.forEach(it => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      const disc = Number(it.discount_percent) || 0;
      subtotal += qty * price * (1 - disc / 100);
    });
    const tax = subtotal * 0.14;
    return { subtotal, tax, total: subtotal + tax };
  }, [form.items]);

  async function handleSave() {
    if (!form.supplier_id) return toast.error('يرجى اختيار المورد');
    if (form.items.some(it => !it.material_id || !it.quantity)) return toast.error('يرجى تعبئة بيانات المواد');
    setSaving(true);
    try {
      await api.post('/purchases', form);
      toast.success('تم إنشاء أمر الشراء');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function updateStatus(row, status) {
    try { await api.put(`/purchases/${row.id}/status`, { status }); toast.success('تم التحديث'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل التحديث'); }
  }

  const columns = [
    { key: 'order_number', label: 'رقم الأمر' },
    { key: 'supplier_name', label: 'المورد' },
    { key: 'total', label: 'الإجمالي', render: v => formatCurrency(v) },
    { key: 'status', label: 'الحالة', render: v => <Badge color={statusColors[v] || 'gray'}>{statusOpts.find(s => s.value === v)?.label || v}</Badge> },
    { key: 'created_at', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'actions', label: 'إجراءات', render: (_, row) => (
      <div className="flex items-center gap-1 flex-wrap">
        {row.status === 'draft' && <button onClick={() => updateStatus(row, 'confirmed')} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100">تأكيد</button>}
        {row.status === 'confirmed' && <button onClick={() => updateStatus(row, 'received')} className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">استلام</button>}
        {(row.status === 'draft' || row.status === 'confirmed') && <button onClick={() => updateStatus(row, 'cancelled')} className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100">إلغاء</button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">المشتريات</h1>
        <Button icon={PlusIcon} onClick={openNew}>أمر شراء جديد</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select options={statusOpts} value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} placeholder="الحالة" className="w-40" />
        <Input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} className="w-40" />
        <Input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} className="w-40" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={orders} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="أمر شراء جديد" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Select label="المورد *" options={suppliers} value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} />
          <Input label="ملاحظات" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">المواد</h4>
            <Button size="sm" variant="ghost" icon={PlusIcon} onClick={addLine}>إضافة مادة</Button>
          </div>
          <div className="space-y-3">
            {form.items.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-4">
                  <Select label="المادة *" options={materials} value={line.material_id} onChange={e => updateLine(idx, 'material_id', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="الكمية *" type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <Input label="السعر" type="number" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <Input label="خصم %" type="number" value={line.discount_percent} onChange={e => updateLine(idx, 'discount_percent', e.target.value)} />
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

        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span className="font-semibold">{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">الضريبة (14%)</span><span className="font-semibold">{formatCurrency(totals.tax)}</span></div>
          <div className="flex justify-between text-lg border-t border-slate-200 dark:border-slate-600 pt-2"><span className="font-bold">الإجمالي</span><span className="font-bold text-primary-600">{formatCurrency(totals.total)}</span></div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>إنشاء الأمر</Button>
        </div>
      </Modal>
    </div>
  );
}
