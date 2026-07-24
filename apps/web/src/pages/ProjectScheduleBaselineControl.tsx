import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import { Calendar, TrendingUp, TrendingDown, Clock, AlertTriangle, Plus, CheckCircle2, ShieldCheck, Edit3 } from 'lucide-react';
import { toast } from '@/lib/logger';

export interface ScheduleBaseline {
  id: string;
  project_id: string;
  milestone_name: string;
  planned_start_date: string;
  planned_finish_date: string;
  baseline_version: number;
  pm_approved_progress_percent: number;
  empirical_calculated_percent: number;
  last_adjusted_reason?: string;
  created_at: string;
}

export const ProjectScheduleBaselineControl: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { user } = useAuth();
  const [baselines, setBaselines] = useState<ScheduleBaseline[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [selectedBaseline, setSelectedBaseline] = useState<ScheduleBaseline | null>(null);
  const [newProgress, setNewProgress] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  useEffect(() => {
    fetchBaselines();
  }, [projectId]);

  const fetchBaselines = async () => {
    try {
      setLoading(true);
      let query = supabase.from('project_schedule_baselines').select('*');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query.order('planned_finish_date', { ascending: true });

      if (error) throw error;
      setBaselines(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load project schedule baselines');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjustModal = (item: ScheduleBaseline) => {
    setSelectedBaseline(item);
    setNewProgress(item.pm_approved_progress_percent || item.empirical_calculated_percent || 0);
  };

  const handleConfirmAdjustment = async () => {
    if (!selectedBaseline || !adjustReason.trim()) {
      toast.error('Adjust reason is required for PM schedule baseline updates.');
      return;
    }

    try {
      const { error } = await supabase
        .from('project_schedule_baselines')
        .update({
          pm_approved_progress_percent: newProgress,
          baseline_version: (selectedBaseline.baseline_version || 1) + 1,
          last_adjusted_by: user?.id,
          last_adjusted_reason: adjustReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBaseline.id);

      if (error) throw error;
      toast.success('PM Baseline Schedule Progress updated');
      setShowAdjustModal(false);
      setSelectedBaseline(null);
      setAdjustReason('');
      fetchBaselines();
    } catch (err: any) {
      toast.error(`Failed to update baseline schedule: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            PM Baseline Schedule vs. Empirical Progress Control
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Empirical progress calculates from Daily Reports & BOQ usage, but PM retains 100% baseline schedule approval control.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Loading PM Schedule Baselines...</div>
      ) : baselines.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No Milestone Schedule Baselines Set</p>
          <p className="text-xs text-gray-500">Project Manager baseline milestones will appear here as site reports log output.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Milestone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Planned Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Empirical Site %</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PM Approved %</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Schedule Variance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {baselines.map((row) => {
                const diff = (row.empirical_calculated_percent || 0) - (row.pm_approved_progress_percent || 0);
                return (
                  <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.milestone_name}
                      <div className="text-[10px] text-gray-400 font-mono">v{row.baseline_version}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                      {row.planned_start_date} → {row.planned_finish_date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-700">
                      {row.empirical_calculated_percent || 0}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-indigo-900">
                      {row.pm_approved_progress_percent || 0}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold">
                      {diff < -5 ? (
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          <TrendingDown className="w-3.5 h-3.5 mr-1" /> {diff}% Lagging
                        </span>
                      ) : diff > 5 ? (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <TrendingUp className="w-3.5 h-3.5 mr-1" /> +{diff}% Ahead
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> On Track
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                      <button
                        onClick={() => handleOpenAdjustModal(row)}
                        className="inline-flex items-center px-2.5 py-1 border border-indigo-300 text-xs font-medium rounded text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                      >
                        <Edit3 className="w-3 h-3 mr-1" /> Adjust Baseline
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedBaseline && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              Adjust PM Baseline Progress: {selectedBaseline.milestone_name}
            </h3>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Approved Baseline Progress %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newProgress}
                onChange={(e) => setNewProgress(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">Empirical calculated progress from site: {selectedBaseline.empirical_calculated_percent || 0}%</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Audit Adjustment Reason *</label>
              <textarea
                rows={3}
                required
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Client Granted 7-Day Extension of Time (EOT) for site access delay"
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjustment}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium"
              >
                Update Schedule Baseline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
