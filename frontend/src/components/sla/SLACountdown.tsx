import { useEffect, useState } from 'react';
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

interface SLACountdownProps {
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  respondedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  slaStatus: 'WITHIN_SLA' | 'APPROACHING_BREACH' | 'BREACHED' | string;
  slaPolicy?: any;
}

export default function SLACountdown({
  responseDueAt,
  resolutionDueAt,
  respondedAt,
  resolvedAt,
  createdAt,
  slaStatus,
  slaPolicy,
}: SLACountdownProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!resolutionDueAt && !responseDueAt) return null;

  const targetDueStr = resolutionDueAt || responseDueAt;
  if (!targetDueStr) return null;

  const dueMs = new Date(targetDueStr).getTime();
  const createdMs = new Date(createdAt).getTime();
  const totalMs = Math.max(1, dueMs - createdMs);
  const elapsedMs = Math.max(0, now - createdMs);

  const isResolved = !!resolvedAt;
  const isResponded = !!respondedAt;
  const isOverdue = !isResolved && now > dueMs;

  const diffMs = Math.abs(dueMs - now);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const formattedCountdown = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  // Calculate SLA percentage progress (0 to 100%)
  const percentage = isResolved ? 100 : Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  // Determine progress bar color
  let progressColor = 'bg-emerald-500';
  if (isOverdue || slaStatus === 'BREACHED') progressColor = 'bg-red-500';
  else if (percentage >= 80 || slaStatus === 'APPROACHING_BREACH') progressColor = 'bg-amber-500 animate-pulse';

  return (
    <div className="card p-4 space-y-3 bg-gradient-to-br from-white to-gray-50/50 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverdue || slaStatus === 'BREACHED' ? (
            <ShieldExclamationIcon className="h-5 w-5 text-red-600 animate-bounce" />
          ) : percentage >= 80 ? (
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
          ) : (
            <ClockIcon className="h-5 w-5 text-emerald-600" />
          )}
          <span className="font-bold text-xs uppercase tracking-wider text-gray-800">
            SLA Countdown ({slaPolicy?.name || 'Standard SLA'})
          </span>
        </div>

        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isResolved
              ? 'bg-emerald-100 text-emerald-800'
              : isOverdue
              ? 'bg-red-100 text-red-800'
              : percentage >= 80
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {isResolved
            ? 'Met'
            : isOverdue
            ? 'SLA Breached'
            : percentage >= 80
            ? 'Breach Warning'
            : 'Within SLA'}
        </span>
      </div>

      {/* Timer Display */}
      {!isResolved && (
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-xs text-gray-500 font-medium">
            {isOverdue ? 'Overdue by:' : 'Time remaining:'}
          </span>
          <span
            className={`font-mono text-base font-bold ${
              isOverdue ? 'text-red-600' : percentage >= 80 ? 'text-amber-600' : 'text-gray-900'
            }`}
          >
            {isOverdue ? `+${formattedCountdown}` : formattedCountdown}
          </span>
        </div>
      )}

      {/* SLA Progress Bar */}
      <div className="space-y-1">
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-medium">
          <span>Target: {slaPolicy?.resolutionTimeMins ? `${slaPolicy.resolutionTimeMins} mins` : 'Default'}</span>
          <span>{percentage}% SLA Elapsed</span>
        </div>
      </div>

      {/* Business Hours Indicator */}
      {slaPolicy && (
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>Schedule:</span>
          <span className="font-semibold text-gray-700">
            {slaPolicy.businessHoursOnly ? '🏢 Business Hours (Excl. Sundays & 2nd Saturdays)' : '🌐 24/7 Support'}
          </span>
        </div>
      )}
    </div>
  );
}
