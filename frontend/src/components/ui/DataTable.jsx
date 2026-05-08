import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export default function DataTable({ columns, data: rawData = [], loading, searchable = true, onEdit, onDelete, onView, pagination, onPageChange }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const safeData = Array.isArray(rawData) ? rawData : [];

  const filtered = useMemo(() => {
    let rows = safeData;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(row => columns.some(col => String(row[col.key] || '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [safeData, search, sortKey, sortDir, columns]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const hasActions = onEdit || onDelete || onView;

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {searchable && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative max-w-sm">
            <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث..."
              className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {columns.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 select-none">
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                  </div>
                </th>
              ))}
              {hasActions && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">
                <p className="text-lg">لا توجد بيانات</p>
              </td></tr>
            ) : filtered.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {onView && <button onClick={() => onView(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-600"><EyeIcon className="h-4 w-4" /></button>}
                      {onEdit && <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500"><PencilSquareIcon className="h-4 w-4" /></button>}
                      {onDelete && <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
        {filtered.map((row, i) => (
          <div key={row.id || i} className="p-4 space-y-2">
            {columns.map(col => (
              <div key={col.key} className="flex justify-between text-sm">
                <span className="text-slate-500">{col.label}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{col.render ? col.render(row[col.key], row) : row[col.key]}</span>
              </div>
            ))}
            {hasActions && (
              <div className="flex items-center gap-2 pt-2">
                {onView && <button onClick={() => onView(row)} className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium text-center">عرض</button>}
                {onEdit && <button onClick={() => onEdit(row)} className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium text-center">تعديل</button>}
                {onDelete && <button onClick={() => onDelete(row)} className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium text-center">حذف</button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-500">إجمالي: {pagination.total}</span>
          <div className="flex gap-1">
            <button onClick={() => onPageChange?.(pagination.page - 1)} disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50">السابق</button>
            <span className="px-3 py-1.5 text-sm font-medium">{pagination.page}</span>
            <button onClick={() => onPageChange?.(pagination.page + 1)} disabled={pagination.page * pagination.limit >= pagination.total}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50">التالي</button>
          </div>
        </div>
      )}
    </div>
  );
}
