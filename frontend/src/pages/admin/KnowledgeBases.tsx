import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDate, humanize } from '@utils/helpers';
import {
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  getErrorMessage,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
} from '@components/common/ui';

const articleBlank = { knowledgeBaseId: '', title: '', content: '', excerpt: '', category: '', tags: '', status: 'DRAFT' };
const baseBlank = { name: '', description: '', departmentId: '', isPublic: true };
const statusBadge: Record<string, string> = { PUBLISHED: 'badge-success', DRAFT: 'badge-warning', ARCHIVED: 'badge-gray' };

export default function AdminKnowledgeBases() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManageBases = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(user?.role || '');
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const { data: bases, isLoading, error, refetch } = useQuery<any[]>({ queryKey: ['kb-bases'], queryFn: () => api.getKnowledgeBases() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [baseFilter, setBaseFilter] = useState('');
  const params = { page, limit: 10, sortBy: 'updatedAt', sortOrder: 'desc', ...(statusFilter && { status: statusFilter }), ...(baseFilter && { knowledgeBaseId: baseFilter }) };
  const { data: articleData } = useQuery({ queryKey: ['kb-admin-articles', params], queryFn: () => api.getArticles(params), placeholderData: keepPreviousData });
  const articles: any[] = articleData?.data || [];

  const [baseEditing, setBaseEditing] = useState<any | 'new' | null>(null);
  const [baseForm, setBaseForm] = useState(baseBlank);
  const [articleEditing, setArticleEditing] = useState<any | 'new' | null>(null);
  const [articleForm, setArticleForm] = useState(articleBlank);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: 'base' | 'article'; item: any } | null>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['kb-bases'] }), qc.invalidateQueries({ queryKey: ['kb-admin-articles'] }), qc.invalidateQueries({ queryKey: ['kb-articles'] })]);

  const openBase = (b: any | 'new') => {
    setBaseForm(b === 'new' ? { ...baseBlank, departmentId: user?.departmentId || '' } : { name: b.name, description: b.description || '', departmentId: b.departmentId, isPublic: !!b.isPublic });
    setBaseEditing(b);
  };
  const openArticle = async (a: any | 'new') => {
    if (a === 'new') {
      setArticleForm({ ...articleBlank, knowledgeBaseId: baseFilter || bases?.[0]?.id || '' });
      setArticleEditing('new');
      return;
    }
    try {
      const full: any = await api.getArticleById(a.id);
      setArticleForm({
        knowledgeBaseId: full.knowledgeBaseId,
        title: full.title,
        content: full.content,
        excerpt: full.excerpt || '',
        category: full.category || '',
        tags: (full.tags || []).join(', '),
        status: full.status,
      });
      setArticleEditing(full);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const saveBase = async () => {
    if (!baseForm.name.trim() || !baseForm.departmentId) return toast.error('Name and department are required');
    setSaving(true);
    try {
      const body: any = { name: baseForm.name.trim(), description: baseForm.description.trim() || undefined, departmentId: baseForm.departmentId, isPublic: baseForm.isPublic };
      if (baseEditing === 'new') await api.createKnowledgeBase(body);
      else await api.updateKnowledgeBase(baseEditing.id, body);
      toast.success('Knowledge base saved');
      setBaseEditing(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveArticle = async () => {
    if (!articleForm.knowledgeBaseId) return toast.error('Choose a knowledge base');
    if (!articleForm.title.trim() || !articleForm.content.trim()) return toast.error('Title and content are required');
    setSaving(true);
    try {
      const body: any = {
        knowledgeBaseId: articleForm.knowledgeBaseId,
        title: articleForm.title.trim(),
        content: articleForm.content,
        excerpt: articleForm.excerpt.trim() || undefined,
        category: articleForm.category.trim() || undefined,
        tags: articleForm.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
        status: articleForm.status,
      };
      if (articleEditing === 'new') await api.createArticle(body);
      else await api.updateArticle(articleEditing.id, body);
      toast.success('Article saved');
      setArticleEditing(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      if (deleting.kind === 'base') await api.deleteKnowledgeBase(deleting.item.id);
      else await api.deleteArticle(deleting.item.id);
      toast.success('Deleted');
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge Base" subtitle="Publish answers so people can help themselves" actions={<button className="btn-primary" onClick={() => openArticle('new')}>New article</button>} />

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Knowledge bases</h2>
          {canManageBases && <button className="btn-secondary btn-sm" onClick={() => openBase('new')}>New knowledge base</button>}
        </div>
        {(bases || []).length === 0 ? <EmptyState title="No knowledge bases" /> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Name</th><th>Department</th><th>Visibility</th><th>Articles</th>{canManageBases && <th />}</tr></thead>
              <tbody>
                {(bases || []).map((b) => (
                  <tr key={b.id}>
                    <td><p className="font-medium text-gray-900">{b.name}</p>{b.description && <p className="text-xs text-gray-500">{b.description}</p>}</td>
                    <td className="text-sm">{b.department?.name}</td>
                    <td><span className={`badge ${b.isPublic ? 'badge-primary' : 'badge-gray'}`}>{b.isPublic ? 'Everyone' : 'Staff only'}</span></td>
                    <td className="text-sm">{b._count?.articles ?? 0}</td>
                    {canManageBases && (
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost btn-sm" onClick={() => openBase(b)}>Edit</button>
                        {isAdmin && <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting({ kind: 'base', item: b })}>Delete</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <h2 className="font-semibold text-gray-900">Articles</h2>
          <select className="input" value={baseFilter} onChange={(e) => { setBaseFilter(e.target.value); setPage(1); }} aria-label="Knowledge base filter">
            <option value="">All knowledge bases</option>
            {(bases || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Status filter">
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        {articles.length === 0 ? <EmptyState title="No articles" message="Create the first one with the New article button." /> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Title</th><th>Knowledge base</th><th>Status</th><th>Views</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-gray-900 max-w-sm truncate">{a.title}</td>
                      <td className="text-sm">{a.knowledgeBase?.name}</td>
                      <td><span className={`badge ${statusBadge[a.status] || 'badge-gray'}`}>{humanize(a.status)}</span></td>
                      <td className="text-sm">{a.viewCount ?? 0}</td>
                      <td className="text-sm text-gray-500">{formatDate(a.updatedAt)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost btn-sm" onClick={() => openArticle(a)}>Edit</button>
                        {(isAdmin || a.authorId === user?.id) && <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting({ kind: 'article', item: a })}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={articleData?.page || page} totalPages={articleData?.totalPages || 1} total={articleData?.total || 0} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!baseEditing} onClose={() => setBaseEditing(null)} title={baseEditing === 'new' ? 'New knowledge base' : 'Edit knowledge base'}
        footer={<><button className="btn-secondary" onClick={() => setBaseEditing(null)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={saveBase}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <div className="space-y-4">
          <Field label="Name"><input className="input" value={baseForm.name} onChange={(e) => setBaseForm({ ...baseForm, name: e.target.value })} /></Field>
          <Field label="Description"><input className="input" value={baseForm.description} onChange={(e) => setBaseForm({ ...baseForm, description: e.target.value })} /></Field>
          <Field label="Department">
            <select className="input" value={baseForm.departmentId} onChange={(e) => setBaseForm({ ...baseForm, departmentId: e.target.value })}>
              <option value="">Select...</option>
              {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={baseForm.isPublic} onChange={(e) => setBaseForm({ ...baseForm, isPublic: e.target.checked })} /> Visible to everyone (otherwise staff only)</label>
        </div>
      </Modal>

      <Modal open={!!articleEditing} onClose={() => setArticleEditing(null)} title={articleEditing === 'new' ? 'New article' : 'Edit article'} wide
        footer={<><button className="btn-secondary" onClick={() => setArticleEditing(null)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={saveArticle}>{saving ? 'Saving...' : 'Save article'}</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Knowledge base">
              <select className="input" value={articleForm.knowledgeBaseId} onChange={(e) => setArticleForm({ ...articleForm, knowledgeBaseId: e.target.value })}>
                <option value="">Select...</option>
                {(bases || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={articleForm.status} onChange={(e) => setArticleForm({ ...articleForm, status: e.target.value })}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
          </div>
          <Field label="Title"><input className="input" value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} /></Field>
          <Field label="Content"><textarea className="input min-h-[200px]" value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Category (optional)"><input className="input" value={articleForm.category} onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })} /></Field>
            <Field label="Tags (comma separated)"><input className="input" value={articleForm.tags} onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })} /></Field>
          </div>
          <Field label="Short summary (optional)"><input className="input" maxLength={500} value={articleForm.excerpt} onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmModal open={!!deleting} title="Delete" message={deleting?.kind === 'base' ? `Delete the knowledge base "${deleting.item.name}" and its articles?` : `Delete the article "${deleting?.item.title}"?`} confirmLabel="Delete" danger onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </div>
  );
}
