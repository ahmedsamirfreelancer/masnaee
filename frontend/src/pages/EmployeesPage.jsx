import { useState, useEffect } from 'react';
import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
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

const salaryTypes = [{ value: 'monthly', label: 'شهري' }, { value: 'daily', label: 'يومي' }, { value: 'hourly', label: 'بالساعة' }];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', department_id: '', position: '', phone: '', address: '', national_id: '', hire_date: '', base_salary: '', salary_type: 'monthly', bank_account: '', emergency_contact: '', is_active: true });
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadDepartments(); }, []);

  async function load() {
    setLoading(true);
    try { const res = await api.get('/employees?limit=100'); setEmployees(safeArray(res)); } catch {} finally { setLoading(false); }
  }

  async function loadDepartments() {
    try { const res = await api.get('/employees/meta/departments'); setDepartments(safeArray(res).map(d => ({ value: d.id, label: d.name }))); } catch {}
  }

  function openNew() {
    setEditItem(null);
    setForm({ name: '', department_id: '', position: '', phone: '', address: '', national_id: '', hire_date: '', base_salary: '', salary_type: 'monthly', bank_account: '', emergency_contact: '', is_active: true });
    setModalOpen(true);
  }
  function openEdit(row) {
    setEditItem(row);
    setForm({ name: row.name, department_id: row.department_id || '', position: row.position || '', phone: row.phone || '', address: row.address || '', national_id: row.national_id || '', hire_date: row.hire_date?.slice(0, 10) || '', base_salary: row.base_salary || '', salary_type: row.salary_type || 'monthly', bank_account: row.bank_account || '', emergency_contact: row.emergency_contact || '', is_active: row.is_active ?? true });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name) return toast.error('اسم الموظف مطلوب');
    setSaving(true);
    try {
      if (editItem) await api.put(`/employees/${editItem.id}`, form);
      else await api.post('/employees', form);
      toast.success(editItem ? 'تم التحديث' : 'تم إضافة الموظف');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`هل تريد حذف "${row.name}"؟`)) return;
    try { await api.delete(`/employees/${row.id}`); toast.success('تم الحذف'); load(); } catch { toast.error('فشل الحذف'); }
  }

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'department_name', label: 'القسم' },
    { key: 'position', label: 'المنصب' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'base_salary', label: 'الراتب الأساسي', render: v => formatCurrency(v) },
    { key: 'salary_type', label: 'نوع الراتب', render: v => salaryTypes.find(s => s.value === v)?.label || v },
    { key: 'hire_date', label: 'تاريخ التعيين', render: v => formatDate(v) },
    { key: 'is_active', label: 'الحالة', render: v => <Badge color={v ? 'success' : 'gray'}>{v ? 'نشط' : 'غير نشط'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="الموظفين" description="بيانات كل موظفي المصنع. حدد القسم والوظيفة والمرتب الأساسي.">
        <Button icon={PlusIcon} onClick={openNew}>إضافة موظف</Button>
      </PageHeader>

      <Card noPadding>
        <DataTable columns={columns} data={employees} loading={loading} onEdit={openEdit} onDelete={handleDelete} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل الموظف' : 'إضافة موظف جديد'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم الموظف *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="القسم" options={departments} value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})} />
          <Input label="المنصب" value={form.position} onChange={e => setForm({...form, position: e.target.value})} />
          <Input label="الهاتف" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <Input label="العنوان" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <Input label="الرقم القومي" value={form.national_id} onChange={e => setForm({...form, national_id: e.target.value})} />
          <Input label="تاريخ التعيين" type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})} />
          <Input label="الراتب الأساسي" type="number" value={form.base_salary} onChange={e => setForm({...form, base_salary: e.target.value})} />
          <Select label="نوع الراتب" options={salaryTypes} value={form.salary_type} onChange={e => setForm({...form, salary_type: e.target.value})} />
          <Input label="الحساب البنكي" value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} />
          <Input label="جهة اتصال طوارئ" value={form.emergency_contact} onChange={e => setForm({...form, emergency_contact: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
