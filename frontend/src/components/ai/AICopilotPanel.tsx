import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { SparklesIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, HeartIcon, BoltIcon, BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AICopilotPanelProps {
  ticketId: string;
  onApplyReply?: (text: string) => void;
}

export default function AICopilotPanel({ ticketId, onApplyReply }: AICopilotPanelProps) {
  const [tone, setTone] = useState<'professional' | 'empathetic' | 'concise'>('professional');
  const [summaryData, setSummaryData] = useState<{ summary: string[]; actionItems: string[]; statusOverview: string } | null>(null);
  const [replyData, setReplyData] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  const [activeArticle, setActiveArticle] = useState<any | null>(null);

  // Auto-analyze sentiment & articles
  const { data: sentiment } = useQuery({
    queryKey: ['ai-sentiment', ticketId],
    queryFn: () => api.analyzeSentiment(ticketId),
    enabled: !!ticketId,
  });

  const { data: articles } = useQuery({
    queryKey: ['ai-articles', ticketId],
    queryFn: () => api.suggestArticles(ticketId),
    enabled: !!ticketId,
  });

  const handleSummarize = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.summarizeTicket(ticketId);
      setSummaryData(res);
      toast.success('AI summary generated');
    } catch {
      toast.error('Failed to generate summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateReply = async (selectedTone?: 'professional' | 'empathetic' | 'concise') => {
    const t = selectedTone || tone;
    setLoadingReply(true);
    try {
      const res = await api.suggestReply(ticketId, t);
      setReplyData(res.suggestedReply);
      toast.success(`Drafted ${t} reply`);
    } catch {
      toast.error('Failed to generate reply draft');
    } finally {
      setLoadingReply(false);
    }
  };

  const handleUseReply = () => {
    if (replyData && onApplyReply) {
      onApplyReply(replyData);
      toast.success('Copied draft into comment field');
    }
  };

  return (
    <div className="card overflow-hidden border border-purple-200 dark:border-purple-900/50 bg-gradient-to-b from-purple-50/40 dark:from-purple-950/20 to-white dark:to-slate-900 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-purple-100 dark:border-purple-900/40 flex items-center justify-between bg-purple-50/80 dark:bg-purple-950/40">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-purple-600 animate-pulse" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-wide">Enterprise AI Copilot</h3>
        </div>
        {sentiment && (
          <span
            className={`badge text-xs font-semibold px-2.5 py-1 ${
              sentiment.sentiment === 'URGENT'
                ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                : sentiment.sentiment === 'FRUSTRATED'
                ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                : 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800'
            }`}
          >
            {sentiment.sentiment === 'URGENT' ? '⚡ Urgent Action' : sentiment.sentiment === 'FRUSTRATED' ? '😠 High Concern' : '🟢 Normal'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4 text-xs">
        {/* Sentiment Analysis Bar */}
        {sentiment && (
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-purple-100 dark:border-purple-900/40 shadow-2xs space-y-2">
            <div className="flex justify-between text-gray-600 dark:text-slate-400">
              <span className="font-medium">Sentiment: <span className="text-gray-900 dark:text-white font-bold">{sentiment.emotion}</span></span>
              <span>Urgency: <strong className="text-purple-700 dark:text-purple-400">{sentiment.urgencyScore}/10</strong></span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 transition-all duration-500"
                style={{ width: `${(sentiment.urgencyScore / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* AI Ticket Summarizer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <DocumentTextIcon className="h-4 w-4 text-purple-600" /> Executive Summary
            </span>
            <button
              onClick={handleSummarize}
              disabled={loadingSummary}
              className="btn-secondary btn-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950"
            >
              {loadingSummary ? 'Summarizing...' : '✨ Generate Summary'}
            </button>
          </div>

          {summaryData && (
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-purple-100 dark:border-purple-900/40 space-y-2">
              <ul className="space-y-1 text-gray-700 dark:text-slate-300 list-disc list-inside">
                {summaryData.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              {summaryData.actionItems.length > 0 && (
                <div className="pt-2 border-t border-purple-50 dark:border-purple-900/40 font-medium text-purple-900 dark:text-purple-300">
                  <span className="text-purple-700 dark:text-purple-400 font-bold">Suggested Action:</span> {summaryData.actionItems.join(' ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Reply Drafter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-600" /> Smart AI Reply Drafter
            </span>
            <div className="flex gap-1">
              {(['professional', 'empathetic', 'concise'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTone(t); handleGenerateReply(t); }}
                  className={`px-2 py-0.5 rounded capitalize ${tone === t ? 'bg-purple-600 text-white font-semibold' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {replyData && (
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-purple-100 dark:border-purple-900/40 space-y-2">
              <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-gray-50 dark:bg-slate-950 p-2.5 rounded border border-gray-200 dark:border-slate-800">
                {replyData}
              </p>
              {onApplyReply && (
                <button
                  onClick={handleUseReply}
                  className="btn-primary btn-xs w-full bg-purple-600 hover:bg-purple-700"
                >
                  Use This Reply Draft
                </button>
              )}
            </div>
          )}
        </div>

        {/* Suggested KB Articles */}
        {articles && articles.length > 0 && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-slate-200 mb-2 block flex items-center gap-1.5">
              <BookOpenIcon className="h-4 w-4 text-purple-600" /> Matching KB Articles
            </span>
            <div className="space-y-1.5">
              {articles.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setActiveArticle(activeArticle?.id === art.id ? null : art)}
                  className="w-full text-left bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/40 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs transition-all text-purple-800 dark:text-purple-300 font-medium truncate flex items-center justify-between group"
                >
                  <span className="truncate">📄 {art.title}</span>
                  <span className="text-[10px] bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded font-semibold group-hover:bg-purple-600 group-hover:text-white transition-colors ml-2 shrink-0">
                    {activeArticle?.id === art.id ? 'Viewing' : 'View Tile'}
                  </span>
                </button>
              ))}
            </div>

            {/* KB Article Preview Tile */}
            {activeArticle && (
              <div className="mt-3 bg-purple-50/90 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-800/80 rounded-xl p-3.5 space-y-2.5 relative shadow-md transition-all">
                <div className="flex items-start justify-between gap-2 border-b border-purple-200 dark:border-purple-800/60 pb-2">
                  <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 font-bold text-xs">
                    <BookOpenIcon className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="truncate">{activeArticle.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveArticle(null)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                    title="Close KB Tile"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                {activeArticle.excerpt && (
                  <p className="text-gray-700 dark:text-slate-300 italic text-[11px] bg-white/80 dark:bg-slate-900 p-2 rounded border border-purple-100 dark:border-purple-900/40">
                    "{activeArticle.excerpt}"
                  </p>
                )}

                {activeArticle.content && (
                  <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-900 p-2.5 rounded border border-purple-100 dark:border-purple-900/40 text-gray-800 dark:text-slate-200 text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                    {activeArticle.content}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 gap-2">
                  {onApplyReply && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyReply(`Reference KB Article: "${activeArticle.title}"\n${activeArticle.excerpt || activeArticle.content || ''}`);
                        toast.success('KB solution inserted into reply draft');
                      }}
                      className="btn-primary btn-xs bg-purple-600 hover:bg-purple-700 text-[11px] py-1 px-2.5"
                    >
                      Insert KB into Reply
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveArticle(null)}
                    className="btn-secondary btn-xs text-gray-600 hover:bg-gray-200 text-[11px] ml-auto flex items-center gap-1"
                  >
                    <XMarkIcon className="h-3 w-3" /> Cancel / Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
