import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { BoltIcon, PlayIcon, ShieldExclamationIcon, KeyIcon, ComputerDesktopIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

interface MacroSelectorProps {
  ticketId: string;
  onApplied?: () => void;
}

export default function MacroSelector({ ticketId, onApplied }: MacroSelectorProps) {
  const qc = useQueryClient();
  const [selectedMacroId, setSelectedMacroId] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { data: macros } = useQuery({
    queryKey: ['agent-macros'],
    queryFn: () => api.getMacros(),
  });

  const applyMutation = useMutation({
    mutationFn: (macroId: string) => api.applyMacro(ticketId, macroId, resolutionText || undefined),
    onSuccess: (data) => {
      toast.success(data.message || 'Macro executed successfully');
      setShowConfirmModal(false);
      setSelectedMacroId('');
      setResolutionText('');
      qc.invalidateQueries();
      if (onApplied) onApplied();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to execute macro');
    },
  });

  const selectedMacro = (macros || []).find((m: any) => m.id === selectedMacroId);

  const handleSelectMacro = (id: string) => {
    if (!id) return;
    setSelectedMacroId(id);
    setShowConfirmModal(true);
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-xs tracking-wide">
          <BoltIcon className="h-4 w-4 text-amber-500" />
          <span>Agent Canned Macros</span>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">1-Click Canned Actions</span>
      </div>

      {/* Select Macro Bar */}
      <div className="flex gap-2">
        <select
          className="input text-xs py-1.5 flex-1 font-medium bg-gray-50/50 dark:bg-slate-900"
          value={selectedMacroId}
          onChange={(e) => handleSelectMacro(e.target.value)}
        >
          <option value="">⚡ Select Quick Macro Action...</option>
          {(macros || []).map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.category})
            </option>
          ))}
        </select>
      </div>

      {/* Quick Action Badges */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(macros || []).map((m: any) => (
          <button
            key={m.id}
            onClick={() => handleSelectMacro(m.id)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-900 dark:hover:text-amber-300 border border-gray-200 dark:border-slate-700 transition-all flex items-center gap-1.5"
          >
            <PlayIcon className="h-3 w-3 text-amber-600" />
            {m.name}
          </button>
        ))}
      </div>

      {/* Confirmation & Canned Preview Modal */}
      {showConfirmModal && selectedMacro && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BoltIcon className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Execute Macro: {selectedMacro.name}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">{selectedMacro.description}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs space-y-2">
              <p className="font-bold text-gray-700 dark:text-slate-300">Actions to be executed:</p>
              <ul className="list-disc list-inside text-gray-600 dark:text-slate-400 space-y-1">
                {selectedMacro.newStatus && <li>Set ticket status to <strong>{selectedMacro.newStatus}</strong></li>}
                {selectedMacro.newPriority && <li>Upgrade priority to <strong>{selectedMacro.newPriority}</strong></li>}
                {selectedMacro.addTags && <li>Add tags: <span className="font-mono">{selectedMacro.addTags.join(', ')}</span></li>}
                {selectedMacro.comment && <li>Post canned comment ({selectedMacro.isInternalComment ? 'Internal Note' : 'Public Reply'})</li>}
              </ul>
            </div>

            {selectedMacro.requiresResolutionNote && (
              <div>
                <label className="label text-xs">Resolution Note</label>
                <textarea
                  className="input text-xs w-full min-h-[60px]"
                  placeholder="Describe resolution details..."
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                className="btn-secondary btn-sm"
                onClick={() => { setShowConfirmModal(false); setSelectedMacroId(''); }}
                disabled={applyMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700"
                onClick={() => applyMutation.mutate(selectedMacro.id)}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? 'Executing...' : '⚡ Run Macro Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
