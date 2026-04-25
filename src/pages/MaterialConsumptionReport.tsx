import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMaterialConsumptionSummary } from '../material-usage/api';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Download } from 'lucide-react';

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

export default function MaterialConsumptionReport({ projectId, organisationId }: ProjectProps) {
  if (!organisationId) {
    return <div className="p-6 text-center text-red-600">Organisation ID is required</div>;
  }

  const { data: consumptionData = [], isLoading } = useQuery({
    queryKey: ['materialConsumptionSummary', projectId],
    queryFn: () => getMaterialConsumptionSummary(projectId),
    enabled: !!projectId
  });

  const getVarianceStatus = (variance: number) => {
    if (variance > 0) return { color: 'text-red-600 bg-red-50', icon: TrendingUp, label: 'Over' };
    if (variance < 0) return { color: 'text-green-600 bg-green-50', icon: TrendingDown, label: 'Under' };
    return { color: 'text-gray-600 bg-gray-50', icon: CheckCircle, label: 'On Track' };
  };

  const getRemainingStatus = (remaining: number) => {
    if (remaining < 0) return { color: 'text-red-600 bg-red-50', icon: AlertTriangle, label: 'Shortage' };
    if (remaining === 0) return { color: 'text-yellow-600 bg-yellow-50', icon: AlertTriangle, label: 'Exhausted' };
    return { color: 'text-green-600 bg-green-50', icon: CheckCircle, label: 'Available' };
  };

  const totalPlannedCost = consumptionData.reduce((sum, item: any) => sum + (item.planned_cost || 0), 0);
  const totalActualCost = consumptionData.reduce((sum, item: any) => sum + (item.actual_cost || 0), 0);
  const totalCostVariance = totalActualCost - totalPlannedCost;

  if (isLoading) {
    return <div className="p-6 text-center">Loading consumption report...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Material Consumption Report</h2>
          <p className="text-sm text-gray-600">Compare planned vs actual material usage with cost analysis</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Planned Cost</div>
          <div className="text-2xl font-semibold">₹{totalPlannedCost.toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Actual Cost</div>
          <div className="text-2xl font-semibold">₹{totalActualCost.toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Cost Variance</div>
          <div className={`text-2xl font-semibold ${totalCostVariance > 0 ? 'text-red-600' : totalCostVariance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            {totalCostVariance > 0 ? '+' : ''}₹{totalCostVariance.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Materials Tracked</div>
          <div className="text-2xl font-semibold">{consumptionData.length}</div>
        </div>
      </div>

      {consumptionData.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">No consumption data available. Add materials to the project list and log usage to see the report.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Material</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Variant</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Planned</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Received</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Used</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Remaining</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Variance</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Planned Cost</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actual Cost</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Cost Variance</th>
              </tr>
            </thead>
            <tbody>
              {consumptionData.map((item: any) => {
                const varianceStatus = getVarianceStatus(item.variance_qty);
                const remainingStatus = getVarianceStatus(item.remaining_qty);
                const VarianceIcon = varianceStatus.icon;
                const RemainingIcon = remainingStatus.icon;

                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {item.materials?.display_name || item.materials?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.company_variants?.variant_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">{item.planned_qty} {item.unit}</td>
                    <td className="px-4 py-3 text-right">{item.received_qty} {item.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.used_qty} {item.unit}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${remainingStatus.color}`}>
                        <RemainingIcon size={12} />
                        {item.remaining_qty} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${varianceStatus.color}`}>
                        <VarianceIcon size={12} />
                        {item.variance_qty > 0 ? '+' : ''}{item.variance_qty} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">₹{item.planned_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{item.actual_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${item.cost_variance > 0 ? 'text-red-600' : item.cost_variance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {item.cost_variance > 0 ? '+' : ''}₹{item.cost_variance.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg border">
        <h4 className="font-medium mb-3">Status Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>Under budget / Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>On track / Exhausted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Over budget / Shortage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-500"></span>
            <span>No variance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
