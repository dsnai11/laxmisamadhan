import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <Link to="/login" className="inline-block">
            <img src="/logo.jpg" alt="Laxmi India Finance Ltd" className="mx-auto h-16 w-16 rounded-xl object-cover border border-gray-200 shadow-sm" />
          </Link>
          <p className="mt-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">Laxmi India Finance Ltd</p>
          <h2 className="mt-1 text-3xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-white p-6 shadow-card border border-gray-100">{children}</div>
        {footer && <div className="text-center text-sm text-gray-600">{footer}</div>}
      </div>
    </div>
  );
}
