export default function Input({ label, error, icon: Icon, textarea, className = '', ...props }) {
  const Component = textarea ? 'textarea' : 'input';
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div className="relative">
        {Icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <Component
          className={`w-full rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow
            ${Icon ? 'pr-10 pl-4' : 'px-4'} ${textarea ? 'py-3 min-h-[100px]' : 'py-2.5'}
            ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 dark:border-slate-600'}
            text-sm`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
