import { useState, useEffect } from 'react';
import { PlusIcon, PencilSquareIcon, ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import api from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

const typeOpts = [
  { value: 'asset', label: 'أصول' }, { value: 'liability', label: 'خصوم' },
  { value: 'equity', label: 'حقوق ملكية' }, { value: 'revenue', label: 'إيرادات' },
  { value: 'expense', label: 'مصروفات' }, { value: 'cogs', label: 'تكلفة المبيعات' },
];
const typeColors = { asset: 'info', liability: 'danger', equity: 'success', revenue: 'success', expense: 'warning', cogs: 'gray' };

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [parentId, setParentId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'asset', parent_id: '', description: '' });
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/accounts?limit=500'); setAccounts(data.data || []); } catch {} finally { setLoading(false); }
  }

  function buildTree(items, parentId = null) {
    return items.filter(i => (i.parent_id || null) === parentId).map(item => ({
      ...item,
      children: buildTree(items, item.id)
    }));
  }

  function openNew(pId = null) {
    setEditItem(null);
    setParentId(pId);
    const parent = accounts.find(a => a.id === pId);
    setForm({ code: '', name: '', type: parent?.type || 'asset', parent_id: pId || '', description: '' });
    setModalOpen(true);
  }

  function openEdit(acc) {
    setEditItem(acc);
    setParentId(null);
    setForm({ code: acc.code || '', name: acc.name, type: acc.type, parent_id: acc.parent_id || '', description: acc.description || '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.code) return toast.error('الاسم والكود مطلوبين');
    setSaving(true);
    try {
      if (editItem) await api.put(`/accounts/${editItem.id}`, form);
      else await api.post('/accounts', form);
      toast.success(editItem ? 'تم التحديث' : 'تم الإضافة');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); } finally { setSaving(false); }
  }

  function toggleCollapse(id) { setCollapsed(prev => ({ ...prev, [id]: !prev[id] })); }

  function renderAccount(acc, level = 0) {
    const hasChildren = acc.children && acc.children.length > 0;
    const isCollapsed = collapsed[acc.id];
    return (
      <div key={acc.id}>
        <div className={`flex items-center justify-between py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 transition-colors`}
          style={{ paddingRight: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button onClick={() => toggleCollapse(acc.id)} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                {isCollapsed ? <ChevronLeftIcon className="h-4 w-4 text-slate-400" /> : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
              </button>
            ) : <span className="w-5" />}
            <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{acc.code}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{acc.name}</span>
            <Badge color={typeColors[acc.type] || 'gray'} className="text-[10px]">{typeOpts.find(t => t.value === acc.type)?.label || acc.type}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{formatCurrency(acc.balance)}</span>
            <div className="flex items-center gap-1">
              {!acc.is_system && (
                <button onClick={() => openEdit(acc)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500">
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => openNew(acc.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-600">
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {hasChildren && !isCollapsed && acc.children.map(child => renderAccount(child, level + 1))}
      </div>
    );
  }

  const tree = buildTree(accounts);
  const parentOpts = accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">شجرة الحسابات</h1>
        <Button icon={PlusIcon} onClick={() => openNew()}>إضافة حساب</Button>
      </div>

      <Card noPadding>
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}
          </div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400"><p className="text-lg">لا توجد حسابات</p></div>
        ) : (
          <div>{tree.map(acc => renderAccount(acc))}</div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'تعديل الحساب' : 'إضافة حساب جديد'}>
        <div className="space-y-4">
          <Input label="كود الحساب *" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
          <Input label="اسم الحساب *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Select label="النوع" options={typeOpts} value={form.type} onChange={e => setForm({...form, type: e.target.value})} />
          <Select label="الحساب الأب" options={parentOpts} value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})} placeholder="حساب رئيسي" />
          <Input label="الوصف" textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
          <Button loading={saving} onClick={handleSave}>{editItem ? 'تحديث' : 'إضافة'}</Button>
        </div>
      </Modal>
    </div>
  );
}
