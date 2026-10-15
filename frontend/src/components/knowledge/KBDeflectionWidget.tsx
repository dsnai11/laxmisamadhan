import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import { LightBulbIcon, BookOpenIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Modal } from '@components/common/ui';

interface KBDeflectionWidgetProps {
  title: string;
  category?: string;
  departmentId?: string;
}

export default function KBDeflectionWidget({ title, category, departmentId }: KBDeflectionWidgetProps) {
  const navigate = useNavigate();
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeArticle, setActiveArticle] = useState<any | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (title && title.trim().length >= 4) {
        setDebouncedSearch(title.trim());
      } else {
        setDebouncedSearch('');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [title]);

  const { data } = useQuery<any>({
    queryKey: ['kb-deflection', debouncedSearch, category, departmentId],
    queryFn: () => api.getArticles({ search: debouncedSearch, ...(departmentId && { departmentId }), limit: 3 }),
    enabled: debouncedSearch.length >= 4,
  });

  const articles: any[] = data?.data || [];

  if (!debouncedSearch || articles.length === 0) return null;

  const handleDeflected = async (article: any) => {
    try {
      await api.reviewArticle(article.id, 5, 'Resolved issue via pre-ticket deflection');
      toast.success('🎉 Great! We are glad the article helped solve your problem.');
      navigate('/raiser/dashboard');
    } catch {
      toast.success('Glad the article helped!');
      navigate('/raiser/dashboard');
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 transition-all animate-fadeIn">
      <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
        <LightBulbIcon className="h-5 w-5 text-amber-600 shrink-0" />
        <span>Self-Service Helper: Did one of these solutions fix your issue?</span>
      </div>
      <p className="text-xs text-amber-800">
        Review these relevant Knowledge Base guides before submitting a support ticket to get immediate resolution:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {articles.map((art) => (
          <div key={art.id} className="bg-white p-3 rounded-lg border border-amber-200/80 shadow-2xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="badge badge-gray text-[10px]">{art.category || 'General'}</span>
                <span className="text-[10px] text-gray-400">👍 {art.helpfulCount || 0} helpful</span>
              </div>
              <h4 className="font-semibold text-xs text-gray-900 line-clamp-2">{art.title}</h4>
              {art.excerpt && <p className="text-[11px] text-gray-600 line-clamp-2 mt-1">{art.excerpt}</p>}
            </div>

            <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5">
              <button
                type="button"
                className="btn-secondary btn-sm text-xs w-full justify-center flex items-center gap-1"
                onClick={() => setActiveArticle(art)}
              >
                <BookOpenIcon className="h-3.5 w-3.5" /> Read Article
              </button>
              <button
                type="button"
                className="btn-success btn-sm text-xs w-full justify-center flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => handleDeflected(art)}
              >
                <CheckCircleIcon className="h-3.5 w-3.5" /> Resolved My Issue
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Article Reader Modal */}
      <Modal
        open={!!activeArticle}
        onClose={() => setActiveArticle(null)}
        title={activeArticle?.title || 'Knowledge Base Article'}
        wide
        footer={
          <div className="flex justify-between w-full">
            <button type="button" className="btn-secondary" onClick={() => setActiveArticle(null)}>
              Close & Continue Ticket
            </button>
            <button
              type="button"
              className="btn-success bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                const target = activeArticle;
                setActiveArticle(null);
                if (target) handleDeflected(target);
              }}
            >
              ✅ This Solved My Problem
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-100 pb-2">
            <span>Category: {activeArticle?.category || 'General'}</span>
            <span>·</span>
            <span>Views: {activeArticle?.viewCount || 0}</span>
          </div>
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
            {activeArticle?.content || activeArticle?.excerpt || 'No detailed content available.'}
          </div>
        </div>
      </Modal>
    </div>
  );
}
