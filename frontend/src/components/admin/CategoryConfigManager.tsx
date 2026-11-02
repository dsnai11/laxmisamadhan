import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { humanize } from '@utils/helpers';
import { CATEGORY_OPTIONS, ConfirmModal, EmptyState, ErrorState, Field, getErrorMessage, Modal, PageLoader } from '@components/common/ui';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CategoryConfigManagerProps {
  departmentId: string;
  canManage: boolean;
}

export const HARDWARE_PRESET_SUB_CATEGORIES: string[] = [
  'Desktop',
  'Laptop',
  'Peripheral',
  'Printer',
  'Network Hardware',
  'Power / UPS',
  'Hardware Procurement & Installation',
  'Hardware Replacement',
  'Warranty & OEM Support',
  'Asset Management',
];

export const HARDWARE_PRESET_ITEMS: Record<string, string[]> = {
  Desktop: [
    'Desktop / PC not working',
    'Monitor / Display issue',
    'Hardware overheating / Fan noise',
    'RAM / HDD / SSD failure',
    'Blue screen / Hardware crash',
  ],
  Laptop: [
    'Laptop not starting',
    'Laptop battery issue',
    'Physical damage to device',
  ],
  Peripheral: [
    'Keyboard / Mouse not working',
    'Docking station / Adapter issue',
    'Webcam / Microphone hardware issue',
    'Peripheral / USB port issue',
  ],
  Printer: [
    'Printer not working – critical department',
    'Printer not working – normal user',
  ],
  'Network Hardware': [
    'Network cable / LAN port hardware issue',
  ],
  'Power / UPS': [
    'UPS / Power backup issue',
  ],
  'Hardware Procurement & Installation': [
    'New hardware installation',
  ],
  'Hardware Replacement': [
    'Hardware replacement request',
  ],
  'Warranty & OEM Support': [
    'Warranty / OEM service coordination',
  ],
  'Asset Management': [
    'Hardware inventory / Asset tagging',
  ],
};

export const SOFTWARE_PRESET_SUB_CATEGORIES: string[] = [
  'LOS (Loan Origination System)',
  'LMS (Loan Management System)',
  'CLU-collection',
  'Core Applications',
  'CRM',
  'Operating System & Drivers',
  'Productivity Software',
  'Browser & Portals',
  'Security Software',
  'Software Licenses',
  'User Permissions',
  'Reports & MIS',
  'Data Management',
  'Software Installation',
];

export const SOFTWARE_PRESET_ITEMS: Record<string, string[]> = {
  'LOS (Loan Origination System)': ['LOS Application Down / Critical Error'],
  'LMS (Loan Management System)': ['LMS Repayment / Disbursal Posting Error'],
  'CLU-collection': ['CLU Collection App / Receipt Sync Issue'],
  'Core Applications': ['Core Banking / Payment Gateway Sync Failure'],
  'CRM': ['CRM Customer Lead / KYC Processing Error'],
  'Operating System & Drivers': ['Operating System / Blue Screen / Corrupted OS'],
  'Productivity Software': ['Email / Outlook Access / Exchange Connection Issue'],
  'Browser & Portals': ['Digital Signature (DSC) / Java / Browser Certificate Error'],
  'Security Software': ['Antivirus / Security Patch Installation Failure'],
  'Software Licenses': ['Software License Allocation (MS Office, Adobe, etc.)'],
  'User Permissions': ['User Role / Permission Update Request'],
  'Reports & MIS': ['Custom Report / MIS Export Issue'],
  'Data Management': ['Data Correction / Rectification Request'],
  'Software Installation': ['New Software Installation Request'],
};

const DEFAULT_SUB_CATEGORIES: string[] = HARDWARE_PRESET_SUB_CATEGORIES;
const DEFAULT_ITEM_PROBLEMS: Record<string, string[]> = HARDWARE_PRESET_ITEMS;

export default function CategoryConfigManager({ departmentId, canManage }: CategoryConfigManagerProps) {
  const qc = useQueryClient();
  const { data: configs, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['category-configs', departmentId],
    queryFn: () => api.getCategoryConfigs(departmentId),
    enabled: !!departmentId,
  });

  const { data: teams } = useQuery<any[]>({
    queryKey: ['teams', departmentId],
    queryFn: () => api.getTeams(departmentId),
    enabled: !!departmentId,
  });

  const [editingCategory, setEditingCategory] = useState<any | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State - Fully visual (no JSON strings)
  const [category, setCategory] = useState('INCIDENT');
  const [defaultPriority, setDefaultPriority] = useState('MEDIUM');
  const [defaultGroup, setDefaultGroup] = useState('Vendor Support-FMS');
  const [isActive, setIsActive] = useState(true);
  const [subCategories, setSubCategories] = useState<string[]>(DEFAULT_SUB_CATEGORIES);
  const [subCategoryTeams, setSubCategoryTeams] = useState<Record<string, string>>({});
  const [itemsMapping, setItemsMapping] = useState<Record<string, string[]>>(DEFAULT_ITEM_PROBLEMS);

  // Helper inputs for adding new sub-categories and item problems
  const [newSubCategoryInput, setNewSubCategoryInput] = useState('');
  const [newSubCategoryTeam, setNewSubCategoryTeam] = useState('');
  const [selectedSubCatForItems, setSelectedSubCatForItems] = useState('Software');
  const [newItemInput, setNewItemInput] = useState('');

  const openNew = () => {
    setCategory('INCIDENT');
    setDefaultPriority('MEDIUM');
    setDefaultGroup(teams && teams.length > 0 ? teams[0].name : 'Vendor Support-FMS');
    setIsActive(true);
    setSubCategories(DEFAULT_SUB_CATEGORIES);
    setSubCategoryTeams({});
    setItemsMapping(DEFAULT_ITEM_PROBLEMS);
    setSelectedSubCatForItems('Software');
    setNewSubCategoryInput('');
    setNewSubCategoryTeam('');
    setNewItemInput('');
    setEditingCategory('new');
  };

  const openEdit = (cfg: any) => {
    const ff = cfg.formFields || {};
    const subCats = Array.isArray(ff.subCategories) && ff.subCategories.length > 0
      ? ff.subCategories
      : DEFAULT_SUB_CATEGORIES;
    const subIssuesMap = (ff.subIssues && typeof ff.subIssues === 'object')
      ? ff.subIssues
      : ((ff.items && typeof ff.items === 'object') ? ff.items : DEFAULT_ITEM_PROBLEMS);
    const teamsMap = (ff.subCategoryTeams && typeof ff.subCategoryTeams === 'object') ? ff.subCategoryTeams : {};

    setCategory(cfg.category);
    setDefaultPriority(cfg.defaultPriority || 'MEDIUM');
    setDefaultGroup(ff.defaultGroup || 'Vendor Support-FMS');
    setIsActive(cfg.isActive !== false);
    setSubCategories(subCats);
    setSubCategoryTeams(teamsMap);
    setItemsMapping(subIssuesMap);
    setSelectedSubCatForItems(subCats[0] || 'Software');
    setNewSubCategoryInput('');
    setNewSubCategoryTeam('');
    setNewItemInput('');
    setEditingCategory(cfg);
  };

  // GUI Handlers for Sub-Categories
  const handleAddSubCategory = () => {
    const val = newSubCategoryInput.trim();
    if (!val) return;
    if (subCategories.includes(val)) {
      toast.error(`"${val}" already exists in sub-categories.`);
      return;
    }
    setSubCategories((prev) => [...prev, val]);
    setItemsMapping((prev) => ({ ...prev, [val]: prev[val] || [] }));
    if (newSubCategoryTeam) {
      setSubCategoryTeams((prev) => ({ ...prev, [val]: newSubCategoryTeam }));
    }
    setNewSubCategoryInput('');
    setNewSubCategoryTeam('');
    setSelectedSubCatForItems(val);
  };

  const handleRemoveSubCategory = (subCat: string) => {
    setSubCategories((prev) => prev.filter((s) => s !== subCat));
    setItemsMapping((prev) => {
      const copy = { ...prev };
      delete copy[subCat];
      return copy;
    });
    setSubCategoryTeams((prev) => {
      const copy = { ...prev };
      delete copy[subCat];
      return copy;
    });
    if (selectedSubCatForItems === subCat) {
      const remaining = subCategories.filter((s) => s !== subCat);
      setSelectedSubCatForItems(remaining[0] || '');
    }
  };

  // GUI Handlers for Sub-Issues
  const handleAddItemProblem = () => {
    const val = newItemInput.trim();
    if (!selectedSubCatForItems) return toast.error('Please select a Sub-Category first.');
    if (!val) return;
    const currentList = itemsMapping[selectedSubCatForItems] || [];
    if (currentList.includes(val)) {
      toast.error(`"${val}" is already added under ${selectedSubCatForItems}.`);
      return;
    }
    setItemsMapping((prev) => ({
      ...prev,
      [selectedSubCatForItems]: [...(prev[selectedSubCatForItems] || []), val],
    }));
    setNewItemInput('');
  };

  const handleRemoveItemProblem = (subCat: string, itemToRemove: string) => {
    setItemsMapping((prev) => ({
      ...prev,
      [subCat]: (prev[subCat] || []).filter((item) => item !== itemToRemove),
    }));
  };

  const loadHardwarePreset = () => {
    setSubCategories(HARDWARE_PRESET_SUB_CATEGORIES);
    setItemsMapping(HARDWARE_PRESET_ITEMS);
    setSelectedSubCatForItems('Desktop');
    setDefaultGroup('Vendor Support-FMS');
    toast.success('Loaded IT Hardware 20-Issue Standard Matrix');
  };

  const loadSoftwarePreset = () => {
    setSubCategories(SOFTWARE_PRESET_SUB_CATEGORIES);
    setItemsMapping(SOFTWARE_PRESET_ITEMS);
    setSelectedSubCatForItems('LOS (Loan Origination System)');
    setDefaultGroup('Internal IT Support');
    toast.success('Loaded IT Software Enterprise Matrix');
  };

  const save = async () => {
    setSaving(true);
    try {
      const formFields = {
        subCategories,
        subIssues: itemsMapping,
        items: itemsMapping,
        subCategoryTeams,
        defaultGroup,
      };

      const payload = {
        isActive,
        defaultPriority,
        formFields,
      };

      if (editingCategory === 'new') {
        await api.createCategoryConfig(departmentId, category, payload);
        toast.success('Category configuration created');
      } else {
        await api.updateCategoryConfig(departmentId, category, payload);
        toast.success('Category configuration updated');
      }

      setEditingCategory(null);
      qc.invalidateQueries({ queryKey: ['category-configs', departmentId] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setDeleting(true);
    try {
      await api.deleteCategoryConfig(departmentId, deletingCategory.category);
      toast.success(`Category requirement for "${humanize(deletingCategory.category)}" deleted.`);
      setDeletingCategory(null);
      setEditingCategory(null);
      qc.invalidateQueries({ queryKey: ['category-configs', departmentId] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const list = configs || [];

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Category & Item Requirements</h2>
          <p className="text-xs text-gray-500">Configure Sub-Categories, Item Problems, and Support Groups visually for this department</p>
        </div>
        {canManage && (
          <button className="btn-primary btn-sm w-full sm:w-auto" onClick={openNew}>
            Add / Configure Category
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No custom category rules configured"
          message={canManage ? 'Click "Add / Configure Category" to set up department-specific sub-categories, items, and support groups.' : 'Default category requirements will be used.'}
        />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Sub-Categories & Assigned Teams</th>
                <th>Default Support Group</th>
                <th>Priority</th>
                <th>Status</th>
                {canManage && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const ff = c.formFields || {};
                const subCats: string[] = Array.isArray(ff.subCategories) && ff.subCategories.length > 0
                  ? ff.subCategories
                  : DEFAULT_SUB_CATEGORIES;
                return (
                  <tr key={c.id || c.category}>
                    <td className="font-medium text-gray-900">{humanize(c.category)}</td>
                    <td className="text-sm">
                      <div className="flex flex-wrap gap-1.5">
                        {subCats.map((sc) => {
                          const teamId = (ff.subCategoryTeams || {})[sc];
                          const assignedTeam = (teams || []).find((t: any) => t.id === teamId);
                          return (
                            <span key={sc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xs">
                              <span className="font-semibold text-gray-800 dark:text-slate-200">{sc}</span>
                              {assignedTeam ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  Team: {assignedTeam.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 italic">
                                  (General Dept)
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">{ff.defaultGroup || 'Vendor Support-FMS'}</td>
                    <td className="text-sm font-medium">{c.defaultPriority}</td>
                    <td>
                      <span className={`badge ${c.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {c.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="text-right whitespace-nowrap space-x-2">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                          Edit Config
                        </button>
                        <button className="btn-ghost btn-sm text-danger-600 hover:text-danger-800" onClick={() => setDeletingCategory(c)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pure GUI Modal for Category Configuration */}
      <Modal
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title={editingCategory === 'new' ? 'Configure Category Requirements' : `Edit ${humanize(category)} Requirements`}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditingCategory(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </>
        }
      >
        <div className="space-y-5 text-sm">
          {editingCategory === 'new' && (
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="INCIDENT">Incident</option>
                <option value="HARDWARE_REQUEST">Hardware Request</option>
                <option value="SOFTWARE_REQUEST">Software Request</option>
                <option value="SERVICE_REQUEST">Service Request</option>
                <option value="ACCESS_REQUEST">Access Request</option>
                <option value="SECURITY_INCIDENT">Security Incident</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Default Priority">
              <select className="input" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="URGENT">URGENT</option>
              </select>
            </Field>

            <Field label="Default Support Group (Team)">
              <select className="input" value={defaultGroup} onChange={(e) => setDefaultGroup(e.target.value)}>
                <option value="Vendor Support-FMS">Vendor Support-FMS</option>
                <option value="Vendor Support-AMC">Vendor Support-AMC</option>
                <option value="Internal IT Support">Internal IT Support</option>
                {(teams || []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Quick Preset Matrix Loaders */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-blue-50/70 dark:bg-slate-800/80 rounded-lg border border-blue-200 dark:border-slate-700">
            <div>
              <span className="text-xs font-semibold text-blue-900 dark:text-blue-300 block">
                ⚡ Quick Presets
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Load predefined SLA categories and sub-issues directly
              </span>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                type="button"
                className="btn-secondary btn-sm text-xs border border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                onClick={loadHardwarePreset}
              >
                🖥️ Load IT Hardware (20 Issues)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm text-xs border border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                onClick={loadSoftwarePreset}
              >
                💻 Load IT Software (14 Systems)
              </button>
            </div>
          </div>

          {/* 1. GUI Sub-Categories & Team Assignment Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                1. Sub-Categories & Respective Assigned Teams
              </label>
              <span className="text-[11px] text-gray-500">
                Tickets for a sub-category will route exclusively to its assigned team
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="input text-sm flex-1"
                placeholder="New Sub-Category name (e.g. LOS, LMS, Desktop, Network...)"
                value={newSubCategoryInput}
                onChange={(e) => setNewSubCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubCategory();
                  }
                }}
              />
              <select
                className="input text-sm sm:w-56"
                value={newSubCategoryTeam}
                onChange={(e) => setNewSubCategoryTeam(e.target.value)}
              >
                <option value="">Default (General Dept)</option>
                {(teams || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    Team: {t.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-secondary btn-sm flex items-center justify-center gap-1 shrink-0" onClick={handleAddSubCategory}>
                <PlusIcon className="w-4 h-4" /> Add Sub-Category
              </button>
            </div>

            <div className="space-y-2 pt-1 max-h-60 overflow-y-auto pr-1">
              {subCategories.map((sc) => (
                <div key={sc} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg shadow-2xs">
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{sc}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">Assigned Team:</span>
                    <select
                      className="input input-sm text-xs py-1 w-full sm:w-52"
                      value={subCategoryTeams[sc] || ''}
                      onChange={(e) => setSubCategoryTeams({ ...subCategoryTeams, [sc]: e.target.value })}
                    >
                      <option value="">General Dept (No Specific Team)</option>
                      {(teams || []).map((t) => (
                        <option key={t.id} value={t.id}>
                          Team: {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-danger-600 rounded p-1 transition-colors shrink-0"
                      onClick={() => handleRemoveSubCategory(sc)}
                      title={`Remove ${sc}`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. GUI Sub-Issues Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                2. Sub-Issues for Sub-Categories
              </label>
              <span className="text-[11px] text-gray-500">
                Sub-Issues depend directly on the selected Sub-Category
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Select Sub-Category:</span>
              <select
                className="input input-sm max-w-xs font-medium text-primary-700"
                value={selectedSubCatForItems}
                onChange={(e) => setSelectedSubCatForItems(e.target.value)}
              >
                {subCategories.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </div>

            {selectedSubCatForItems ? (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    placeholder={`Add Sub-Issue under "${selectedSubCatForItems}" (e.g. Login Issue, Display Damage, Document Upload...)`}
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemProblem();
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary btn-sm flex items-center gap-1 shrink-0" onClick={handleAddItemProblem}>
                    <PlusIcon className="w-4 h-4" /> Add Sub-Issue
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 min-h-[60px]">
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                    Sub-Issues configured for <span className="font-semibold text-gray-900 dark:text-white">"{selectedSubCatForItems}"</span>:
                  </p>
                  {(!itemsMapping[selectedSubCatForItems] || itemsMapping[selectedSubCatForItems].length === 0) ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 italic">No sub-issues added for this sub-category yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {itemsMapping[selectedSubCatForItems].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 bg-primary-50 dark:bg-primary-950/60 text-primary-900 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-xs px-2.5 py-1 rounded-md">
                          {item}
                          <button
                            type="button"
                            className="text-primary-400 hover:text-danger-600 rounded"
                            onClick={() => handleRemoveItemProblem(selectedSubCatForItems, item)}
                            title={`Remove ${item}`}
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Add a sub-category above to start adding sub-issues.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Enable this category for ticket creation in this department
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category Configuration"
        message={`Are you sure you want to delete the category configuration for "${deletingCategory ? humanize(deletingCategory.category) : ''}"? End-users will fallback to default system options.`}
        confirmLabel="Delete Config"
        danger
        busy={deleting}
      />
    </div>
  );
}

