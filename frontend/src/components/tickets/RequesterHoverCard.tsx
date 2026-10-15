import { useState } from 'react';
import { UserCircleIcon, PhoneIcon, EnvelopeIcon, ChevronUpIcon, ChevronDownIcon, CubeIcon, DocumentTextIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface RequesterHoverCardProps {
  user: any;
  departmentName?: string;
  triggerElement?: React.ReactNode;
  showInlineCard?: boolean;
}

export default function RequesterHoverCard({ user, departmentName, triggerElement, showInlineCard = false }: RequesterHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(true);

  if (!user) return <span className="text-gray-400">Unassigned</span>;

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Requester';
  const email = user.email || 'N/A';
  const employeeId = user.employeeId || '530276';
  const phone = user.phone || '9773310304';
  const mobile = user.mobile || user.phone || '9773310304';
  const jobTitle = user.jobTitle || 'DISBURSEMENT OFFICER';
  const site = user.site || 'DURG-2212131';
  const dept = user.department?.name || departmentName || 'CREDIT-1901';
  const reportingManager = user.reportingManagerName || 'KARAN KUMAR';

  const cardContent = (
    <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 w-80 text-xs space-y-3 z-50 text-gray-800 animate-fadeIn">
      {/* Header Profile */}
      <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-200">
          {user.avatar ? (
            <img src={user.avatar} alt={fullName} className="w-full h-full rounded-full object-cover" />
          ) : (
            <UserCircleIcon className="w-10 h-10 text-blue-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{fullName}</h4>
          <a href={`mailto:${email}`} className="text-blue-600 hover:underline block text-[11px] truncate">
            {email}
          </a>
          <button
            type="button"
            onClick={() => setShowFullDetails(!showFullDetails)}
            className="text-blue-700 font-semibold hover:text-blue-900 text-[11px] mt-1 flex items-center gap-0.5"
          >
            {showFullDetails ? (
              <>
                Hide Full details <ChevronUpIcon className="w-3 h-3" />
              </>
            ) : (
              <>
                Show Full details <ChevronDownIcon className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Profile Details List */}
      {showFullDetails && (
        <div className="space-y-1.5 text-[11px] bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Employee ID</span>
            <span className="font-semibold text-gray-900 col-span-3">{employeeId}</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Phone</span>
            <a href={`tel:${phone}`} className="font-semibold text-blue-700 hover:underline col-span-3">
              {phone}
            </a>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Mobile</span>
            <a href={`tel:${mobile}`} className="font-semibold text-blue-700 hover:underline col-span-3">
              {mobile}
            </a>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Job Title</span>
            <span className="font-semibold text-gray-900 uppercase col-span-3">{jobTitle}</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Site</span>
            <span className="font-semibold text-gray-900 uppercase col-span-3">{site}</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Department</span>
            <span className="font-semibold text-gray-900 uppercase col-span-3">{dept}</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            <span className="text-gray-500 col-span-2">Reporting Manager</span>
            <span className="font-semibold text-gray-900 uppercase col-span-3">{reportingManager}</span>
          </div>
        </div>
      )}

      {/* Bottom Action Cards */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => toast.success(`Viewing assets owned by ${fullName}`)}
          className="bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 rounded-xl p-2 text-center transition-all group"
        >
          <CubeIcon className="w-5 h-5 mx-auto text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium text-gray-700 block leading-tight">Assets Owned</span>
        </button>

        <button
          type="button"
          onClick={() => toast.success(`Viewing previous requests by ${fullName}`)}
          className="bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 rounded-xl p-2 text-center transition-all group"
        >
          <DocumentTextIcon className="w-5 h-5 mx-auto text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium text-gray-700 block leading-tight">Previous Requests</span>
        </button>

        <button
          type="button"
          onClick={() => toast.success(`Initiating remote connection to ${fullName}'s machine (${site})`)}
          className="bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 rounded-xl p-2 text-center transition-all group"
        >
          <ComputerDesktopIcon className="w-5 h-5 mx-auto text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium text-gray-700 block leading-tight">Remote Connection</span>
        </button>
      </div>
    </div>
  );

  if (showInlineCard) {
    return cardContent;
  }

  return (
    <div className="relative inline-block" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline uppercase text-xs"
      >
        {triggerElement || fullName}
      </button>

      {isOpen && <div className="absolute left-0 top-full mt-1 z-50">{cardContent}</div>}
    </div>
  );
}
