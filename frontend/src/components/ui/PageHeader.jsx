import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function PageHeader({ title, description, children }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="page-title">{title}</h1>
          {description && (
            <button onClick={() => setShowHelp(!showHelp)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-500 transition-colors">
              <InformationCircleIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {showHelp && description && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
    </div>
  );
}
