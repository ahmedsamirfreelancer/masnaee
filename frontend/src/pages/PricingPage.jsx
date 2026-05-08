import { useState } from 'react';
import { CalculatorIcon, BeakerIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/ui/PageHeader';
import OilPricingTab from './pricing/OilPricingTab';

const tabs = [
  { key: 'oil', label: 'الزيت', icon: BeakerIcon },
  // منتجات مستقبلية:
  // { key: 'rice', label: 'الأرز', icon: CubeIcon },
  // { key: 'pasta', label: 'المكرونة', icon: CubeIcon },
];

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState('oil');

  return (
    <div className="space-y-6">
      <PageHeader title="حاسبة التسعير" description="احسب تكلفة وسعر بيع كل منتج. اختار المنتج من التابات واكتب سعر الخامة اليوم والباقي بيتحسب لوحده." />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-800 text-primary-600 border border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-800 -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'oil' && <OilPricingTab />}
    </div>
  );
}
