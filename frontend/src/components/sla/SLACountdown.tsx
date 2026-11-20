import { useEffect, useState } from 'react';
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { isWorkingTime, nextWorkingStart, workingMinutesBetween } from '@utils/workingHours';

interface SLACountdownProps {
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  respondedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  slaStatus: 'WITHIN_SLA' | 'APPROACHING_BREACH' | 'BREACHED' | 'PAUSED' | string;
  slaPolicy?: any;
  /** When the SLA was paused (ticket waiting on client/vendor). */
  slaPausedAt?: string | null;
  /** Ticket status, used to say what it's waiting on. */
  status?: string;
}

export default function SLACountdown({
  responseDueAt,
  resolutionDueAt,
  respondedAt,
  resolvedAt,
  createdAt,
  slaStatus,
  slaPolicy,
  slaPausedAt,
  status,
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

  // Paused while waiting on the client/vendor: the clock is frozen; the deadline moves later by the
  // waiting time when the ticket resumes (backend slaPauseTransition).
  if (slaStatus === 'PAUSED' && !isResolved) {
    const pausedAtMs = slaPausedAt ? new Date(slaPausedAt).getTime() : now;
    const leftMs = Math.max(0, dueMs - pausedAtMs);
    const lh = Math.floor(leftMs / 3600000);
    const lm = Math.floor((leftMs % 3600000) / 60000);
    const waitingOn = status === 'DEPENDENCY_ON_VENDOR' ? 'vendor' : 'client';
    return (
      <div className="card p-4 space-y-2 border border-gray-200 bg-gray-50/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-gray-800">
              SLA Countdown ({slaPolicy?.name || 'Standard SLA'})
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">Paused</span>
        </div>
        <p className="text-sm text-gray-700">
          Waiting on the {waitingOn}{slaPausedAt ? ` since ${new Date(slaPausedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}.
          The SLA clock is stopped.
        </p>
        <p className="text-xs text-gray-500">
          Time left when paused: <span className="font-semibold text-gray-700 tabular-nums">{lh}h {String(lm).padStart(2, '0')}m</span>. It continues from there when the ticket is set back to Open.
        </p>
      </div>
    );
  }

  const isOverdue = !isResolved && now > dueMs;

  // Working-time countdown (09:45–18:45 IST, Mon–Sat, no Sundays / 2nd Saturdays): the SLA clock
  // doesn't run at night or on off days, so neither does this display.
  const nowDate = new Date(now);
  const clockRunning = isWorkingTime(nowDate);
  const resumesAt = clockRunning ? null : nextWorkingStart(nowDate);
  const workMs = isOverdue
    ? workingMinutesBetween(new Date(dueMs), nowDate) * 60000
    : workingMinutesBetween(nowDate, new Date(dueMs)) * 60000 - (clockRunning ? (now % 60000) : 0);
  const diffMs = Math.max(0, workMs);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = clockRunning ? Math.floor((diffMs % (1000 * 60)) / 1000) : 0;

  const formattedCountdown = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  // SLA progress in working time (0 to 100%)
  const totalWork = Math.max(1, workingMinutesBetween(new Date(createdMs), new Date(dueMs)));
  const elapsedWork = workingMinutesBetween(new Date(createdMs), nowDate);
  const percentage = isResolved ? 100 : Math.min(100, Math.round((elapsedWork / totalWork) * 100));
  void totalMs; void elapsedMs;

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
      {!isResolved && resumesAt && (
        <p className="text-[11px] text-gray-500">
          ⏸ Clock stopped — outside working hours. Resumes {resumesAt.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.
        </p>
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
            🏢 Mon–Sat 9:45 AM–6:45 PM (excl. Sundays & 2nd Saturdays)
          </span>
        </div>
      )}
    </div>
  );
}
