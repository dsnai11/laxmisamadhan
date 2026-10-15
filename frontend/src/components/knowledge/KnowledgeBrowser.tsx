import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatDate } from '@utils/helpers';
import { EmptyState, ErrorState, getErrorMessage, Modal, PageHeader, PageLoader, Pagination } from '@components/common/ui';

export default function KnowledgeBrowser({ title = 'Knowledge Base', subtitle = 'Find answers without raising a ticket' }: { title?: string; subtitle?: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('');
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: bases } = useQuery({ queryKey: ['kb-bases'], queryFn: () => api.getKnowledgeBases() });
  const { data: categories } = useQuery<string[]>({ queryKey: ['kb-categories'], queryFn: () => api.getCategories() as any });

  const params = { page, limit: 9, status: 'PUBLISHED', sortBy: 'updatedAt', sortOrder: 'desc', ...(search && { search }), ...(knowledgeBaseId && { knowledgeBaseId }), ...(category && { category }) };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['kb-articles', params], queryFn: () => api.getArticles(params), placeholderData: keepPreviousData });
  const articles: any[] = data?.data || [];

  const { data: article, isLoading: articleLoading } = useQuery<any>({
    queryKey: ['kb-article', openId],
    queryFn: () => api.getArticleById(openId!),
    enabled: !!openId,
  });

  const vote = async (helpful: boolean) => {
    if (!openId) return;
    try {
      await api.reviewArticle(openId, helpful ? 5 : 1);
      setVoted((v) => ({ ...v, [openId]: true }));
      toast.success('Thanks for your feedback');
      qc.invalidateQueries({ queryKey: ['kb-articles'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="input" placeholder="Search articles" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search articles" />
        <select className="input" value={knowledgeBaseId} onChange={(e) => { setKnowledgeBaseId(e.target.value); setPage(1); }} aria-label="Knowledge base">
          <option value="">All knowledge bases</option>
          {(bases || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={() => refetch()} /> : articles.length === 0 ? (
        <div className="card"><EmptyState title="No articles found" message="Try different words or clear the filters. If you cannot find an answer, raise a ticket." /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => (
              <button key={a.id} className="card-hover text-left p-5 flex flex-col" onClick={() => setOpenId(a.id)}>
                <span className="text-xs text-primary-600 font-medium">{a.knowledgeBase?.name}{a.category ? ` · ${a.category}` : ''}</span>
                <span className="mt-1 font-semibold text-gray-900">{a.title}</span>
                <span className="mt-2 text-sm text-gray-600 line-clamp-3">{a.excerpt || (a.content || '').slice(0, 160)}</span>
                <span className="mt-auto pt-4 text-xs text-gray-400">{a.viewCount ?? 0} views · {a.helpfulCount ?? 0} found helpful</span>
              </button>
            ))}
          </div>
          <div className="card"><Pagination page={data?.page || page} totalPages={data?.totalPages || 1} total={data?.total || 0} onPageChange={setPage} /></div>
        </>
      )}

      <Modal open={!!openId} onClose={() => setOpenId(null)} title={article?.title || 'Article'} wide footer={<button className="btn-secondary" onClick={() => setOpenId(null)}>Close</button>}>
        {articleLoading || !article ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              {article.knowledgeBase?.name}{article.category ? ` · ${article.category}` : ''} · updated {formatDate(article.updatedAt)}
              {article.author ? ` · by ${article.author.firstName} ${article.author.lastName}` : ''}
            </p>
            <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{article.content}</div>
            {article.tags?.length > 0 && <div className="flex flex-wrap gap-1">{article.tags.map((t: string) => <span key={t} className="badge badge-gray">{t}</span>)}</div>}
            <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
              <span className="text-sm text-gray-600">Was this helpful?</span>
              {voted[article.id] ? (
                <span className="text-sm text-success-700">Thanks for the feedback</span>
              ) : (
                <>
                  <button className="btn-secondary btn-sm" onClick={() => vote(true)}>Yes</button>
                  <button className="btn-secondary btn-sm" onClick={() => vote(false)}>No</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
