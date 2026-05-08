import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilSquareIcon, Cog6ToothIcon, UserGroupIcon, ScaleIcon, TagIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import api, { safeArray } from '../utils/api';
import toast from 'react-hot-toast';

const tabs = [
  { key: 'general', label: 'عام', icon: Cog6ToothIcon },
  { key: 'users', label: 'المستخدمين', icon: UserGroupIcon },
  { key: 'units', label: 'الوحدات', icon: ScaleIcon },
  { key: 'categories', label: 'التصنيفات', icon: TagIcon },
];

const roleOpts = [{ value: 'admin', label: 'مدير' }, { value: 'manager', label: 'مشرف' }, { value: 'accountant', label: 'محاسب' }, { value: 'warehouse', label: 'مستودع' }, { value: 'production', label: 'إنتاج' }, { value: 'sales', label: 'مبيعات' }, { value: 'viewer', label: 'عارض' }];

export default function SettingsPage() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({ factory_name: '', currency: 'EGP', tax_rate: '14', phone: '', address: '' });
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', full_name: '', email: '', password: '', role_id: '1' });
  const [roles, setRoles] = useState([]);

  const [unitModal, setUnitModal] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: '', abbreviation: '' });

  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'product' });

  useEffect(() => { loadTab(); }, [tab]);

  async function loadTab() {
    setLoading(true);
    try {
      if (tab === 'general') {
        const { data } = await api.get('/settings');
        const s = {};
        (data.data?.settings || []).forEach(r => { s[r.key] = r.value; });
        setSettings(prev => ({ ...prev, ...s }));
      }
      if (tab === 'users') {
        const [u, r] = await Promise.all([api.get('/users'), api.get('/users/roles').catch(() => ({ data: { data: [] } }))]);
        setUsers(safeArray(u));
        setRoles(safeArray(r).map(x => ({ value: String(x.id), label: x.display_name || x.name })));
      }
      if (tab === 'units') { const res = await api.get('/settings/units'); setUnits(safeArray(res)); }
      if (tab === 'categories') {
        const [p, m] = await Promise.all([
          api.get('/products/meta/categories').catch(() => ({ data: { data: [] } })),
          api.get('/materials').then(r => ({ data: { data: [] } })).catch(() => ({ data: { data: [] } })),
        ]);
        setCategories(safeArray(p));
      }
    } catch {} finally { setLoading(false); }
  }

  // General
  async function saveGeneral() {
    setSaving(true);
    try { await api.put('/settings', { settings }); toast.success('تم حفظ الإعدادات'); } catch (err) { toast.error(err.response?.data?.message || 'فشل الحفظ'); } finally { setSaving(false); }
  }

  // Users
  function openNewUser() { setEditUser(null); setUserForm({ username: '', full_name: '', email: '', password: '', role_id: '1' }); setUserModal(true); }
  function openEditUser(u) { setEditUser(u); setUserForm({ username: u.username, full_name: u.full_name, email: u.email || '', password: '', role_id: String(u.role_id || 1) }); setUserModal(true); }
  async function saveUser() {
    if (!userForm.username || !userForm.full_name) return toast.error('الاسم واسم المستخدم مطلوبين');
    if (!editUser && !userForm.password) return toast.error('كلمة المرور مطلوبة');
    setSaving(true);
    try {
      const payload = { ...userForm };
      if (!payload.password) delete payload.password;
      if (editUser) await api.put(`/users/${editUser.id}`, payload);
      else await api.post('/users', payload);
      toast.success(editUser ? 'تم التحديث' : 'تم إضافة المستخدم');
      setUserModal(false); loadTab();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }
  async function deleteUser(u) {
    if (!confirm(`هل تريد حذف "${u.full_name}"؟`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success('تم الحذف'); loadTab(); } catch { toast.error('فشل الحذف'); }
  }

  // Units
  function openNewUnit() { setEditUnit(null); setUnitForm({ name: '', abbreviation: '' }); setUnitModal(true); }
  function openEditUnit(u) { setEditUnit(u); setUnitForm({ name: u.name, abbreviation: u.abbreviation || '' }); setUnitModal(true); }
  async function saveUnit() {
    if (!unitForm.name) return toast.error('اسم الوحدة مطلوب');
    setSaving(true);
    try {
      if (editUnit) await api.put(`/settings/units/${editUnit.id}`, unitForm);
      else await api.post('/settings/units', unitForm);
      toast.success(editUnit ? 'تم التحديث' : 'تم الإضافة');
      setUnitModal(false); loadTab();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }
  async function deleteUnit(u) {
    if (!confirm(`هل تريد حذف "${u.name}"؟`)) return;
    try { await api.delete(`/settings/units/${u.id}`); toast.success('تم الحذف'); loadTab(); } catch { toast.error('فشل الحذف'); }
  }

  // Categories
  function openNewCat() { setEditCat(null); setCatForm({ name: '', type: 'product' }); setCatModal(true); }
  function openEditCat(c) { setEditCat(c); setCatForm({ name: c.name, type: c.type || 'product' }); setCatModal(true); }
  async function saveCat() {
    if (!catForm.name) return toast.error('اسم التصنيف مطلوب');
    setSaving(true);
    try {
      if (editCat) await api.put(`/settings/categories/${editCat.id}`, catForm);
      else await api.post('/settings/categories', catForm);
      toast.success(editCat ? 'تم التحديث' : 'تم الإضافة');
      setCatModal(false); loadTab();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }
  async function deleteCat(c) {
    if (!confirm(`هل تريد حذف "${c.name}"؟`)) return;
    try { await api.delete(`/settings/categories/${c.id}`); toast.success('تم الحذف'); loadTab(); } catch { toast.error('فشل الحذف'); }
  }

  function renderListItem(item, onEdit, onDelete) {
    return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-700 dark:text-slate-300">{item.full_name || item.name}</span>
          {item.abbreviation && <span className="text-xs text-slate-400">({item.abbreviation})</span>}
          {item.username && <span className="text-xs text-slate-400">@{item.username}</span>}
          {item.role_display && <Badge color="info">{item.role_display}</Badge>}
          {item.type && <Badge color="gray">{item.type === 'product' ? 'منتج' : item.type === 'material' ? 'مادة' : item.type}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500"><PencilSquareIcon className="h-4 w-4" /></button>
          <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="إعدادات النظام" description="إعدادات المصنع الأساسية، إدارة المستخدمين والصلاحيات، الوحدات والتصنيفات." />

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {loading && <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>}

      {!loading && tab === 'general' && (
        <Card title="الإعدادات العامة">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="اسم المصنع" value={settings.factory_name} onChange={e => setSettings({...settings, factory_name: e.target.value})} />
            <Input label="العملة" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} />
            <Input label="نسبة الضريبة (%)" type="number" value={settings.tax_rate} onChange={e => setSettings({...settings, tax_rate: e.target.value})} />
            <Input label="الهاتف" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
            <Input label="العنوان" textarea className="md:col-span-2" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
          </div>
          <div className="flex justify-end mt-6">
            <Button loading={saving} onClick={saveGeneral}>حفظ الإعدادات</Button>
          </div>
        </Card>
      )}

      {!loading && tab === 'users' && (
        <Card title="المستخدمين" action={<Button size="sm" icon={PlusIcon} onClick={openNewUser}>إضافة مستخدم</Button>} noPadding>
          {users.length === 0 ? <p className="p-6 text-center text-slate-400">لا يوجد مستخدمين</p> : users.map(u => renderListItem(u, openEditUser, deleteUser))}
        </Card>
      )}

      {!loading && tab === 'units' && (
        <Card title="الوحدات" action={<Button size="sm" icon={PlusIcon} onClick={openNewUnit}>إضافة وحدة</Button>} noPadding>
          {units.length === 0 ? <p className="p-6 text-center text-slate-400">لا توجد وحدات</p> : units.map(u => renderListItem(u, openEditUnit, deleteUnit))}
        </Card>
      )}

      {!loading && tab === 'categories' && (
        <Card title="التصنيفات" action={<Button size="sm" icon={PlusIcon} onClick={openNewCat}>إضافة تصنيف</Button>} noPadding>
          {categories.length === 0 ? <p className="p-6 text-center text-slate-400">لا توجد تصنيفات</p> : categories.map(c => renderListItem(c, openEditCat, deleteCat))}
        </Card>
      )}

      {/* User Modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={editUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}>
        <div className="space-y-4">
          <Input label="اسم المستخدم *" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} />
          <Input label="الاسم الكامل *" value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} />
          <Input label="البريد الإلكتروني" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
          <Input label={editUser ? 'كلمة المرور (اتركها فارغة للإبقاء)' : 'كلمة المرور *'} type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
          <Select label="الدور" options={roles.length ? roles : [{value:'1',label:'مدير النظام'}]} value={userForm.role_id} onChange={e => setUserForm({...userForm, role_id: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setUserModal(false)}>إلغاء</Button>
          <Button loading={saving} onClick={saveUser}>{editUser ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>

      {/* Unit Modal */}
      <Modal open={unitModal} onClose={() => setUnitModal(false)} title={editUnit ? 'تعديل الوحدة' : 'إضافة وحدة جديدة'} size="sm">
        <div className="space-y-4">
          <Input label="اسم الوحدة *" value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} />
          <Input label="الاختصار" value={unitForm.abbreviation} onChange={e => setUnitForm({...unitForm, abbreviation: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setUnitModal(false)}>إلغاء</Button>
          <Button loading={saving} onClick={saveUnit}>{editUnit ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={editCat ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'} size="sm">
        <div className="space-y-4">
          <Input label="اسم التصنيف *" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} />
          <Select label="النوع" options={[{ value: 'product', label: 'منتج' }, { value: 'material', label: 'مادة خام' }, { value: 'expense', label: 'مصروف' }]} value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCatModal(false)}>إلغاء</Button>
          <Button loading={saving} onClick={saveCat}>{editCat ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
