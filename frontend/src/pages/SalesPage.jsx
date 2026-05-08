import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
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

const statusOpts = [{ value: 'draft', label: 'مسودة' }, { value: 'confirmed', label: 'مؤكد' }, { value: 'shipped', label: 'تم الشحن' }, { value: 'delivered', label: 'تم التسليم' }, { value: 'cancelled', label: 'ملغي' }];
const paymentOpts = [{ value: 'unpaid', label: 'غير مدفوع' }, { value: 'partial', label: 'جزئي' }, { value: 'paid', label: 'مدفوع' }];
const statusColors = { draft: 'gray', confirmed: 'info', shipped: 'warning', delivered: 'success', cancelled: 'danger' };
const paymentColors = { unpaid: 'danger', partial: 'warning', paid: 'success' };
const emptyLine = () => ({ product_id: '', size: '', quantity: '1', unit_price: '', discount_percent: '0' });

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ customer_id: '', notes: '', items: [emptyLine()] });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ status: '', payment_status: '', date_from: '', date_to: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadMeta(); }, []);
  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filters.status) params.append('status', filters.status);
    if (filters.payment_status) params.append('payment_status', filters.payment_status);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    try { const { data } = await api.get(`/sales?${params}`); setOrders(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [c, p] = await Promise.all([api.get('/customers?limit=500'), api.get('/products?limit=500')]);
      setCustomers((c.data.data || []).map(x => ({ value: x.id, label: x.name })));
      setProducts((p.data.data || []).map(x => ({ value: x.id, label: x.name, price: x.selling_price })));
    } catch {}
  }

  function openNew() { setEditItem(null); setForm({ customer_id: '', notes: '', items: [emptyLine()] }); setModalOpen(true); }

  function updateLine(idx, field, val) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === 'product_id') {
      const prod = products.find(p => p.value == val);
      if (prod) items[idx].unit_price = prod.price || '';
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
    return { subtotal, discount: 0, tax, total: subtotal + tax };
  }, [form.items]);

  async function handleSave() {
    if (!form.customer_id) return toast.error('يرجى اختيار العميل');
    if (form.items.some(it => !it.product_id || !it.quantity)) return toast.error('يرجى تعبئة بيانات المنتجات');
    setSaving(true);
    try {
      if (editItem) await api.put(`/sales/${editItem.id}`, form);
      else await api.post('/sales', form);
      toast.success(editItem ? 'تم التحديث' : 'تم إنشاء الطلب');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function updateStatus(row, status) {
    try { await api.put(`/sales/${row.id}/status`, { status }); toast.success('تم التحديث'); load(); } catch (err) { toast.error(err.response?.data?.message || 'فشل التحديث'); }
  }

  const columns = [
    { key: 'order_number', label: 'رقم الطلب' },
    { key: 'customer_name', label: 'العميل' },
    { key: 'total', label: 'الإجمالي', render: v => formatCurrency(v) },
    { key: 'status', label: 'الحالة', render: v => <Badge color={statusColors[v] || 'gray'}>{statusOpts.find(s => s.value === v)?.label || v}</Badge> },
    { key: 'payment_status', label: 'الدفع', render: v => <Badge color={paymentColors[v] || 'gray'}>{paymentOpts.find(s => s.value === v)?.label || v}</Badge> },
    { key: 'created_at', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'actions', label: 'إجراءات', render: (_, row) => (
      <div className="flex items-center gap-1 flex-wrap">
        {row.status === 'draft' && <button onClick={() => updateStatus(row, 'confirmed')} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100">تأكيد</button>}
        {row.status === 'confirmed' && <button onClick={() => updateStatus(row, 'shipped')} className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 hover:bg-amber-100">شحن</button>}
        {row.status === 'shipped' && <button onClick={() => updateStatus(row, 'delivered')} className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">تسليم</button>}
        {(row.status === 'draft' || row.status === 'confirmed') && <button onClick={() => updateStatus(row, 'cancelled')} className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100">إلغاء</button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="طلبات البيع" description="أنشئ طلب بيع للعميل، أضف المنتجات والكميات. الطلب بيمر بمراحل: مسودة ← تأكيد ← شحن ← تسليم. عند التسليم بيتخصم من المخزون وبيتسجل قيد محاسبي تلقائي.">
        <Button icon={PlusIcon} onClick={openNew}>طلب بيع جديد</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <Select options={statusOpts} value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} placeholder="حالة الطلب" className="w-40" />
        <Select options={paymentOpts} value={filters.payment_status} onChange={e => setFilters({...filters, payment_status: e.target.value})} placeholder="حالة الدفع" className="w-40" />
        <Input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} className="w-40" />
        <Input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} className="w-40" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={orders} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="طلب بيع جديد" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Select label="العميل *" options={customers} value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} />
          <Input label="ملاحظات" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">المنتجات</h4>
            <Button size="sm" variant="ghost" icon={PlusIcon} onClick={addLine}>إضافة منتج</Button>
          </div>
          <div className="space-y-3">
            {form.items.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-3">
                  <Select label="المنتج *" options={products} value={line.product_id} onChange={e => updateLine(idx, 'product_id', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="المقاس" value={line.size} onChange={e => updateLine(idx, 'size', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="الكمية *" type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input label="السعر" type="number" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                </div>
                <div className="col-span-11 md:col-span-2">
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
          <Button loading={saving} onClick={handleSave}>إنشاء الطلب</Button>
        </div>
      </Modal>
    </div>
  );
}
