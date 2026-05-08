export default function Select({ label, error, options = [], placeholder = 'اختر...', className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <select
        className={`w-full rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 text-sm
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow
          ${error ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
