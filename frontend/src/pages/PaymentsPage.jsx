import { useState, useEffect } from 'react';
import { PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const paymentMethods = [{ value: 'cash', label: 'نقدي' }, { value: 'bank', label: 'تحويل بنكي' }, { value: 'check', label: 'شيك' }];

export default function PaymentsPage() {
  const [tab, setTab] = useState('received');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: 'received', entity_type: 'customer', entity_id: '', amount: '', payment_method: 'cash', date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try { const res = await api.get(`/payments?type=${tab}&limit=100`); setPayments(safeArray(res)); } catch {} finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [c, s] = await Promise.all([api.get('/customers?limit=500'), api.get('/suppliers?limit=500')]);
      setCustomers(safeArray(c).map(x => ({ value: x.id, label: x.name })));
      setSuppliers(safeArray(s).map(x => ({ value: x.id, label: x.name })));
    } catch {}
  }

  function openNew(type) {
    setForm({ type, entity_type: type === 'received' ? 'customer' : 'supplier', entity_id: '', amount: '', payment_method: 'cash', date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.entity_id || !form.amount) return toast.error('يرجى تعبئة الحقول المطلوبة');
    setSaving(true);
    try {
      await api.post('/payments', form);
      toast.success('تم تسجيل الدفعة');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  const columns = [
    { key: 'payment_number', label: 'رقم الدفعة' },
    { key: 'entity_name', label: tab === 'received' ? 'العميل' : 'المورد' },
    { key: 'amount', label: 'المبلغ', render: v => formatCurrency(v) },
    { key: 'payment_method', label: 'طريقة الدفع', render: v => paymentMethods.find(m => m.value === v)?.label || v },
    { key: 'date', label: 'التاريخ', render: v => formatDate(v) },
    { key: 'reference', label: 'المرجع' },
    { key: 'notes', label: 'ملاحظات' },
  ];

  const tabs = [
    { key: 'received', label: 'مدفوعات واردة', icon: ArrowDownTrayIcon },
    { key: 'made', label: 'مدفوعات صادرة', icon: ArrowUpTrayIcon },
  ];

  const entityOpts = form.entity_type === 'customer' ? customers : suppliers;

  return (
    <div className="space-y-6">
      <PageHeader title="المدفوعات" description="تسجيل المدفوعات الواردة من العملاء والصادرة للموردين. كل دفعة بتحدث رصيد العميل/المورد وبتسجل قيد.">
        <Button icon={PlusIcon} onClick={() => openNew(tab)}>تسجيل دفعة</Button>
      </PageHeader>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={payments} loading={loading} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.type === 'received' ? 'تسجيل دفعة واردة' : 'تسجيل دفعة صادرة'}>
        <div className="space-y-4">
          {form.type === 'received' ? (
            <Select label="العميل *" options={customers} value={form.entity_id} onChange={e => setForm({...form, entity_id: e.target.value})} />
          ) : (
            <Select label="المورد *" options={suppliers} value={form.entity_id} onChange={e => setForm({...form, entity_id: e.target.value})} />
          )}
          <Input label="المبلغ *" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          <Select label="طريقة الدفع" options={paymentMethods} value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} />
          <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          <Input label="المرجع" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
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
