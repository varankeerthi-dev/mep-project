import { useState } from 'react';
import DateWiseConsolidation from './DateWiseConsolidation';
import MaterialWiseConsolidation from './MaterialWiseConsolidation';

export default function DCConsolidation() {
  const [activeTab, setActiveTab] = useState('date-wise');

  return (
    <div className="p-6">
      <div className="my-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">DC Consolidation</h1>
        </div>
        <div className="border-b border-zinc-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('date-wise')}
              className={`w-[250px] h-[40px] border-b-2 font-medium text-[16px] ${
                activeTab === 'date-wise'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 bg-zinc-50'
              }`}
            >
              Date-wise Consolidation
            </button>
            <button
              onClick={() => setActiveTab('material-wise')}
              className={`w-[250px] h-[40px] border-b-2 font-medium text-[16px] ${
                activeTab === 'material-wise'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 bg-zinc-50'
              }`}
            >
              Material-wise Consolidation
            </button>
          </nav>
        </div>
      </div>

      <div className="my-6">
        {activeTab === 'date-wise' && <DateWiseConsolidation />}
        {activeTab === 'material-wise' && <MaterialWiseConsolidation />}
      </div>
    </div>
  );
}
