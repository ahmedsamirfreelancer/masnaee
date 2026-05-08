import { useState, useEffect } from 'react';
import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
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

const typeOpts = [{ value: 'wholesale', label: 'جملة' }, { value: 'retail', label: 'تجزئة' }, { value: 'distributor', label: 'موزع' }];
const typeColors = { wholesale: 'info', retail: 'gray', distributor: 'success' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ordersModal, setOrdersModal] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'retail', company_name: '', phone: '', phone2: '', email: '', address: '', city: '', tax_number: '', credit_limit: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/customers?limit=100'); setCustomers(data.data || []); } catch {} finally { setLoading(false); }
  }

  function openNew() { setEditItem(null); setForm({ name: '', type: 'retail', company_name: '', phone: '', phone2: '', email: '', address: '', city: '', tax_number: '', credit_limit: '', notes: '' }); setModalOpen(true); }
  function openEdit(row) {
    setEditItem(row);
    setForm({ name: row.name, type: row.type || 'retail', company_name: row.company_name || '', phone: row.phone || '', phone2: row.phone2 || '', email: row.email || '', address: row.address || '', city: row.city || '', tax_number: row.tax_number || '', credit_limit: row.credit_limit || '', notes: row.notes || '' });
    setModalOpen(true);
  }

  async function viewOrders(row) {
    setOrdersModal(row);
    try { const { data } = await api.get(`/customers/${row.id}/orders`); setCustomerOrders(data.data || []); } catch { setCustomerOrders([]); }
  }

  async function handleSave() {
    if (!form.name) return toast.error('اسم العميل مطلوب');
    setSaving(true);
    try {
      if (editItem) await api.put(`/customers/${editItem.id}`, form);
      else await api.post('/customers', form);
      toast.success(editItem ? 'تم تحديث العميل' : 'تم إضافة العميل');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/customers/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'type', label: 'النوع', render: v => <Badge color={typeColors[v] || 'gray'}>{typeOpts.find(t => t.value === v)?.label || v}</Badge> },
    { key: 'company_name', label: 'الشركة' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'city', label: 'المدينة' },
    { key: 'balance', label: 'الرصيد', render: v => <span className={v < 0 ? 'text-red-500 font-bold' : ''}>{formatCurrency(v)}</span> },
  ];

  const orderColumns = [
    { key: 'order_number', label: 'رقم الطلب' },
    { key: 'total', label: 'الإجمالي', render: v => formatCurrency(v) },
    { key: 'status', label: 'الحالة' },
    { key: 'created_at', label: 'التاريخ', render: v => formatDate(v) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">العملاء</h1>
        <Button icon={PlusIcon} onClick={openNew}>إضافة عميل</Button>
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={customers} loading={loading} onEdit={openEdit} onDelete={handleDelete} onView={viewOrders} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل العميل' : 'إضافة عميل جديد'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم العميل *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="النوع" options={typeOpts} value={form.type} onChange={e => setForm({...form, type: e.target.value})} />
          <Input label="اسم الشركة" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} />
          <Input label="الهاتف" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <Input label="هاتف 2" value={form.phone2} onChange={e => setForm({...form, phone2: e.target.value})} />
          <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="العنوان" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <Input label="المدينة" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
          <Input label="الرقم الضريبي" value={form.tax_number} onChange={e => setForm({...form, tax_number: e.target.value})} />
          <Input label="حد الائتمان" type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} />
          <Input label="ملاحظات" textarea className="md:col-span-2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>

      <Modal open={!!ordersModal} onClose={() => setOrdersModal(null)} title={`طلبات ${ordersModal?.name || ''}`} size="lg">
        <DataTable columns={orderColumns} data={customerOrders} searchable={false} />
      </Modal>
    </div>
  );
}
