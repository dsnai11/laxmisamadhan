import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDuration, formatFileSize, humanize } from '@utils/helpers';
import { CATEGORY_OPTIONS, Field, getErrorMessage, PageHeader, PageLoader, PriorityBadge } from '@components/common/ui';
import {
  HARDWARE_PRESET_SUB_CATEGORIES,
  HARDWARE_PRESET_ITEMS,
  SOFTWARE_PRESET_SUB_CATEGORIES,
  SOFTWARE_PRESET_ITEMS,
} from '@components/admin/CategoryConfigManager';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const schema = z.object({
  departmentId: z.string().trim().min(1, 'Please select a department'),
  category: z.string().trim().min(1, 'Please select a category'),
  subCategory: z.string().trim().min(1, 'Please select a System / Module (Sub Category)'),
  subIssue: z.string().trim().min(1, 'Please select or enter a Sub-Issue (Specific Problem)'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
  description: z.string().trim().min(5, 'Please enter a description (at least 5 characters)').max(10000),
});

type FormValues = z.infer<typeof schema>;

export default function CreateTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: departments, isLoading } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { departmentId: user?.departmentId || '', category: '', subCategory: '', subIssue: '', title: '', description: '' },
  });

  const watchedDept = watch('departmentId');
  const watchedCategory = watch('category');
  const watchedSubCategory = watch('subCategory');
  const watchedSubIssue = watch('subIssue');

  useEffect(() => {
    setValue('subCategory', '');
    setValue('subIssue', '');
  }, [watchedDept, watchedCategory, setValue]);

  useEffect(() => {
    setValue('subIssue', '');
  }, [watchedSubCategory, setValue]);

  const { data: deptCategoryConfigs } = useQuery<any[]>({
    queryKey: ['category-configs', watchedDept],
    queryFn: () => api.getCategoryConfigs(watchedDept),
    enabled: !!watchedDept,
  });

  const { data: deptTeams } = useQuery<any[]>({
    queryKey: ['teams', watchedDept],
    queryFn: () => api.getTeams(watchedDept),
    enabled: !!watchedDept,
  });

  const { data: slaPolicies } = useQuery<any[]>({
    queryKey: ['sla-policies'],
    queryFn: () => api.getSLAPolicies(),
  });

  // Compute dynamic sub-categories / systems set up by Department Head
  const activeConfigs = (deptCategoryConfigs || []).filter((c) => c.isActive !== false);
  const currentCategoryConfig = activeConfigs.find((c) => c.category === watchedCategory);
  const categoryFormFields = currentCategoryConfig?.formFields || {};
  const subCategoryTeams: Record<string, string> = categoryFormFields.subCategoryTeams || {};
  const mappedTeamId = watchedSubCategory ? subCategoryTeams[watchedSubCategory] : undefined;
  const assignedTeam = (deptTeams || []).find((t: any) => t.id === mappedTeamId);

  const selectedDeptObj = (departments || []).find((d: any) => d.id === watchedDept);
  const isHwDept = selectedDeptObj?.name?.toLowerCase().includes('hardware') || watchedCategory === 'HARDWARE_REQUEST';
  const isSwDept = selectedDeptObj?.name?.toLowerCase().includes('software') || watchedCategory === 'SOFTWARE_REQUEST';

  const fallbackSubCats = isSwDept
    ? SOFTWARE_PRESET_SUB_CATEGORIES
    : isHwDept
    ? HARDWARE_PRESET_SUB_CATEGORIES
    : ['LOS', 'LMS', 'CRM', 'CLU-collection', 'Desktop', 'Laptop', 'Peripheral', 'Software', 'Network'];

  const dynamicSubCategories: string[] = Array.isArray(categoryFormFields.subCategories) && categoryFormFields.subCategories.length > 0
    ? categoryFormFields.subCategories
    : fallbackSubCats;

  const fallbackSubIssuesMap = isSwDept
    ? SOFTWARE_PRESET_ITEMS
    : isHwDept
    ? HARDWARE_PRESET_ITEMS
    : {};

  const dynamicSubIssues: string[] = watchedSubCategory
    ? (categoryFormFields.subIssues?.[watchedSubCategory] || categoryFormFields.items?.[watchedSubCategory] || fallbackSubIssuesMap[watchedSubCategory] || [])
    : [];

  const matchingSLA = (slaPolicies || []).find((p: any) => {
    if (!p.isActive) return false;
    const matchesDept = !p.departmentId || p.departmentId === watchedDept;
    if (!matchesDept) return false;
    const sub = p.subCategory?.toLowerCase();
    if (watchedSubIssue && sub === watchedSubIssue.toLowerCase()) return true;
    if (watchedSubCategory && sub === watchedSubCategory.toLowerCase()) return true;
    return false;
  });

  const onFilesSelected = (list: FileList | null) => {
    if (!list) return;
    const accepted: File[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) toast.error(`${f.name} is larger than ${formatFileSize(MAX_FILE_SIZE)}`);
      else accepted.push(f);
    });
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const ticket: any = await api.createTicket({
        departmentId: values.departmentId,
        category: values.category as any,
        subCategory: values.subCategory,
        subIssue: values.subIssue,
        item: values.subIssue,
        title: values.title,
        description: values.description,
        priority: 'MEDIUM',
      } as any);

      const failed: string[] = [];
      for (const file of files) {
        try {
          await api.uploadAttachment(ticket.id, file);
        } catch {
          failed.push(file.name);
        }
      }

      toast.success(`Ticket ${ticket.ticketNumber} created successfully!`);
      if (failed.length) toast.error(`Could not upload: ${failed.join(', ')}.`);
      navigate(`/raiser/tickets/${ticket.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Create a Ticket" subtitle="Fill in the simple form below to submit a support request." />

      <form onSubmit={handleSubmit(onSubmit)} className="card p-4 sm:p-6 space-y-4 sm:space-y-5" noValidate>
        {/* 1. Department */}
        <Field label="Department" required error={errors.departmentId?.message}>
          <select className="input" {...register('departmentId')}>
            <option value="">Select Department...</option>
            {(departments || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        {/* 2. Category & Sub Category / System (LOS, LMS, CRM, CLU-collection...) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Category" required error={errors.category?.message}>
            <select className="input" {...register('category')}>
              <option value="">Select Category...</option>
              {activeConfigs.length > 0 ? (
                activeConfigs.map((c) => (
                  <option key={c.category} value={c.category}>
                    {humanize(c.category)}
                  </option>
                ))
              ) : (
                <>
                  <option value="INCIDENT">Incident</option>
                  <option value="SOFTWARE_REQUEST">Software Request</option>
                  <option value="HARDWARE_REQUEST">Hardware Request</option>
                  <option value="SERVICE_REQUEST">Service Request</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </Field>

          <Field
            label="System / Module (Sub Category)"
            required
            error={errors.subCategory?.message}
            hint={assignedTeam ? `Assigned to: ${assignedTeam.name}` : undefined}
          >
            <select className="input" {...register('subCategory')}>
              <option value="">Select System / Module...</option>
              {dynamicSubCategories.map((sc) => {
                const teamId = subCategoryTeams[sc];
                const team = (deptTeams || []).find((t: any) => t.id === teamId);
                return (
                  <option key={sc} value={sc}>
                    {sc}{team ? ` (Team: ${team.name})` : ''}
                  </option>
                );
              })}
            </select>
          </Field>
        </div>

        {/* Sub-Issue (Specific Problem) */}
        <Field
          label="Sub-Issue (Specific Problem)"
          required
          error={errors.subIssue?.message}
          hint={
            !watchedSubCategory
              ? 'Please select a System / Module above first.'
              : dynamicSubIssues.length > 0
              ? `Select specific problem related to "${watchedSubCategory}"`
              : `Enter specific problem under "${watchedSubCategory}"`
          }
        >
          {!watchedSubCategory ? (
            <select className="input cursor-not-allowed opacity-60" disabled>
              <option value="">— Select a System / Module above first —</option>
            </select>
          ) : dynamicSubIssues.length > 0 ? (
            <select className="input" {...register('subIssue')}>
              <option value="">Select Sub-Issue / Specific Problem...</option>
              {dynamicSubIssues.map((si) => (
                <option key={si} value={si}>
                  {si}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder={`Enter specific issue under "${watchedSubCategory}"...`}
              {...register('subIssue')}
            />
          )}
        </Field>

        {/* Dynamic SLA Guarantee Banner */}
        {matchingSLA && (
          <div className="rounded-xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200/80 dark:border-blue-900/40 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-xs">
                ⏱️
              </span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>SLA Guarantee: {matchingSLA.name}</span>
                  <PriorityBadge priority={matchingSLA.priority} />
                </div>
                <div className="text-gray-600 dark:text-gray-300 mt-0.5">
                  Initial Response: <strong className="text-gray-900 dark:text-white">{formatDuration(matchingSLA.responseTimeMins)}</strong> · Target Resolution: <strong className="text-gray-900 dark:text-white">{formatDuration(matchingSLA.resolutionTimeMins)}</strong>
                  {matchingSLA.businessHoursOnly && ' (Business hours)'}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 font-medium">
              Escalation: L1 Support → L2 Expert → L3 Mgr (75%) → L4 OEM
            </div>
          </div>
        )}

        {/* 3. Title / Subject */}
        <Field label="Title / Subject" required error={errors.title?.message}>
          <input className="input" placeholder="e.g. Issue in LOS login or AFC4719 - MOUSE ISSUE" {...register('title')} />
        </Field>

        {/* 4. Description */}
        <Field label="Description" required error={errors.description?.message} hint="What happened, what you expected, and any error messages you saw.">
          <textarea className="input min-h-[140px]" placeholder="Enter ticket description..." {...register('description')} />
        </Field>

        {/* 5. Attachments (Optional) */}
        <Field label="Attachments (Optional)" hint={`Optional. Up to 10 files, ${formatFileSize(MAX_FILE_SIZE)} each. Images, PDF, Word or text.`}>
          <input
            type="file"
            multiple
            className="block w-full text-xs sm:text-sm text-gray-600 file:mr-3 file:btn file:btn-secondary file:btn-sm file:border-0 cursor-pointer"
            onChange={(e) => {
              onFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between text-xs sm:text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <span className="truncate font-medium text-gray-700">
                    {f.name} <span className="text-gray-400 font-normal">· {formatFileSize(f.size)}</span>
                  </span>
                  <button type="button" className="text-danger-600 hover:underline text-xs font-semibold shrink-0 ml-2" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
