import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' | 'datetime' = 'short'): string {
  const d = new Date(date);
  
  if (format === 'relative') {
    return formatRelativeTime(d);
  }
  
  if (format === 'datetime') {
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
}

const ACRONYMS = new Set(['sla', 'ai', 'it', 'id', 'vpn', 'ip']);

export function humanize(value?: string | null): string {
  if (!value) return '';
  if (value === 'DEPENDENCY_ON_CLIENT') return 'Dependency on User';
  if (value === 'DEPENDENCY_ON_VENDOR') return 'Dependency on Vendor';
  const words = value.split('_').map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.toLowerCase()));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDuration(mins?: number | null): string {
  if (mins === undefined || mins === null) return '-';
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
    MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/60',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 dark:border dark:border-orange-800/60',
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/60',
    URGENT: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:border dark:border-purple-800/60',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/60',
    DEPENDENCY_ON_CLIENT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-800/60',
    DEPENDENCY_ON_VENDOR: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:border dark:border-purple-800/60',
    RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 dark:border dark:border-green-800/60',
    REOPENED: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/60',
    // Fallbacks
    ASSIGNED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/60',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border dark:border-yellow-800/60',
    ON_HOLD: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
    PENDING_APPROVAL: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:border dark:border-purple-800/60',
    PENDING_USER: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 dark:border dark:border-orange-800/60',
    CLOSED: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
    CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
}

export function getSLABadgeColor(status: string): string {
  const colors: Record<string, string> = {
    WITHIN_SLA: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 dark:border dark:border-green-800/60',
    APPROACHING_BREACH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border dark:border-yellow-800/60',
    BREACHED: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/60',
    PAUSED: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    INCIDENT: '🚨',
    SERVICE_REQUEST: '🔧',
    CHANGE_REQUEST: '🔄',
    PROBLEM: '🔍',
    ACCESS_REQUEST: '🔐',
    HARDWARE_REQUEST: '💻',
    SOFTWARE_REQUEST: '💾',
    SECURITY_INCIDENT: '🛡️',
    AI_MODEL_REQUEST: '🤖',
    DATA_REQUEST: '📊',
  };
  return icons[category] || '📋';
}

export function getDepartmentColor(type: string): string {
  const colors: Record<string, string> = {
    IT_HARDWARE: '#3B82F6',
    IT_SOFTWARE: '#8B5CF6',
    DIGITAL_SECURITY: '#EF4444',
    AI: '#F59E0B',
  };
  return colors[type] || '#6B7280';
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPDFFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function isAudioFile(mimeType?: string, fileName?: string): boolean {
  if (!mimeType && !fileName) return false;
  if (mimeType && mimeType.toLowerCase().startsWith('audio/')) return true;
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) return true;
  }
  return false;
}

export function getFileIcon(mimeType: string, fileName?: string): string {
  if (isAudioFile(mimeType, fileName)) return '🎙️';
  if (isImageFile(mimeType)) return '🖼️';
  if (isPDFFile(mimeType)) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  return '📎';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}