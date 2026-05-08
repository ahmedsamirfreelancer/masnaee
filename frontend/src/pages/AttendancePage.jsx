import { useState, useEffect } from 'react';
import { CalendarDaysIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import api from '../utils/api';
import toast from 'react-hot-toast';

const statusOpts = [
  { value: 'present', label: 'حاضر' }, { value: 'absent', label: 'غائب' },
  { value: 'late', label: 'متأخر' }, { value: 'leave', label: 'إجازة' }, { value: 'holiday', label: 'عطلة' },
];
const statusColors = { present: 'success', absent: 'danger', late: 'warning', leave: 'info', holiday: 'gray' };

export default function AttendancePage() {
  const [view, setView] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => { if (view === 'daily') loadDaily(); else loadSummary(); }, [date, month, view]);

  async function loadEmployees() {
    try { const { data } = await api.get('/employees?limit=500&is_active=1'); setEmployees(data.data || []); } catch {}
  }

  async function loadDaily() {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance?date=${date}`);
      const existing = data.data || [];
      const merged = employees.map(emp => {
        const rec = existing.find(r => r.employee_id === emp.id);
        return { employee_id: emp.id, employee_name: emp.name, check_in: rec?.check_in || '', check_out: rec?.check_out || '', status: rec?.status || 'present', overtime_hours: rec?.overtime_hours || '', notes: rec?.notes || '', id: rec?.id };
      });
      setRecords(merged);
    } catch {} finally { setLoading(false); }
  }

  async function loadSummary() {
    setLoading(true);
    try { const { data } = await api.get(`/attendance/summary?month=${month}`); setSummary(data.data || []); } catch {} finally { setLoading(false); }
  }

  function updateRecord(idx, field, val) {
    const updated = [...records];
    updated[idx] = { ...updated[idx], [field]: val };
    setRecords(updated);
  }

  async function handleBulkSave() {
    setSaving(true);
    try {
      await api.post('/attendance/bulk', { date, records: records.map(r => ({ employee_id: r.employee_id, check_in: r.check_in, check_out: r.check_out, status: r.status, overtime_hours: r.overtime_hours || 0, notes: r.notes })) });
      toast.success('تم حفظ الحضور');
    } catch (err) { toast.error(err.response?.data?.message || 'فشل الحفظ'); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">الحضور والانصراف</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('daily')}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'daily' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            <CalendarDaysIcon className="h-4 w-4" />يومي
          </button>
          <button onClick={() => setView('monthly')}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'monthly' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            <TableCellsIcon className="h-4 w-4" />شهري
          </button>
        </div>
      </div>

      {view === 'daily' && (
        <>
          <div className="flex items-center gap-4">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-48" />
            <Button loading={saving} onClick={handleBulkSave}>حفظ الحضور</Button>
          </div>

          <Card noPadding>
            {loading ? (
              <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">الموظف</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">وقت الحضور</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">وقت الانصراف</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">الحالة</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">إضافي</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {records.map((rec, idx) => (
                      <tr key={rec.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{rec.employee_name}</td>
                        <td className="px-4 py-2"><input type="time" value={rec.check_in} onChange={e => updateRecord(idx, 'check_in', e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm w-32" /></td>
                        <td className="px-4 py-2"><input type="time" value={rec.check_out} onChange={e => updateRecord(idx, 'check_out', e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm w-32" /></td>
                        <td className="px-4 py-2">
                          <select value={rec.status} onChange={e => updateRecord(idx, 'status', e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm w-28">
                            {statusOpts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input type="number" value={rec.overtime_hours} onChange={e => updateRecord(idx, 'overtime_hours', e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm w-20" placeholder="0" /></td>
                        <td className="px-4 py-2"><input value={rec.notes} onChange={e => updateRecord(idx, 'notes', e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm w-40" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {view === 'monthly' && (
        <>
          <div className="flex items-center gap-4">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
          </div>

          <Card noPadding>
            {loading ? (
              <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">الموظف</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">أيام الحضور</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">أيام الغياب</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">التأخير</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">الإجازات</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ساعات إضافية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {summary.map(row => (
                      <tr key={row.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{row.employee_name}</td>
                        <td className="px-4 py-3 text-sm"><Badge color="success">{row.present_days || 0}</Badge></td>
                        <td className="px-4 py-3 text-sm"><Badge color="danger">{row.absent_days || 0}</Badge></td>
                        <td className="px-4 py-3 text-sm"><Badge color="warning">{row.late_days || 0}</Badge></td>
                        <td className="px-4 py-3 text-sm"><Badge color="info">{row.leave_days || 0}</Badge></td>
                        <td className="px-4 py-3 text-sm font-semibold">{row.total_overtime || 0}</td>
                      </tr>
                    ))}
                    {summary.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-lg">لا توجد بيانات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
