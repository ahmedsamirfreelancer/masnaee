import { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', company_name: '', phone: '', phone2: '', email: '', address: '', city: '', tax_number: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/suppliers?limit=100'); setSuppliers(data.data || []); } catch {} finally { setLoading(false); }
  }

  function openNew() { setEditItem(null); setForm({ name: '', company_name: '', phone: '', phone2: '', email: '', address: '', city: '', tax_number: '', notes: '' }); setModalOpen(true); }
  function openEdit(row) {
    setEditItem(row);
    setForm({ name: row.name, company_name: row.company_name || '', phone: row.phone || '', phone2: row.phone2 || '', email: row.email || '', address: row.address || '', city: row.city || '', tax_number: row.tax_number || '', notes: row.notes || '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name) return toast.error('اسم المورد مطلوب');
    setSaving(true);
    try {
      if (editItem) await api.put(`/suppliers/${editItem.id}`, form);
      else await api.post('/suppliers', form);
      toast.success(editItem ? 'تم تحديث المورد' : 'تم إضافة المورد');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/suppliers/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'company_name', label: 'الشركة' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد الإلكتروني' },
    { key: 'city', label: 'المدينة' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">الموردون</h1>
        <Button icon={PlusIcon} onClick={openNew}>إضافة مورد</Button>
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={suppliers} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل المورد' : 'إضافة مورد جديد'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم المورد *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Input label="اسم الشركة" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} />
          <Input label="الهاتف" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <Input label="هاتف 2" value={form.phone2} onChange={e => setForm({...form, phone2: e.target.value})} />
          <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="العنوان" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <Input label="المدينة" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
          <Input label="الرقم الضريبي" value={form.tax_number} onChange={e => setForm({...form, tax_number: e.target.value})} />
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
