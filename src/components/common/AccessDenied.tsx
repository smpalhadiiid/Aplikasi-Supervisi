import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccessDeniedProps {
  onNavigate?: (path: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ onNavigate }) => {
  const { role, logout } = useAuth();

  const getRoleDashboard = () => {
    switch (role) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'SUPERVISOR':
        return '/supervisor/dashboard';
      case 'GURU':
        return '/guru/dashboard';
      default:
        return '/dashboard';
    }
  };

  const handleReturn = () => {
    const target = getRoleDashboard();
    if (onNavigate) {
      onNavigate(target);
    } else {
      window.history.pushState({}, '', target);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-6 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Akses Ditolak</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
        Anda tidak memiliki izin untuk mengakses halaman ini. Peran Anda saat ini adalah{' '}
        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {role}
        </span>
        .
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleReturn}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard Saya</span>
        </button>

        <button
          onClick={() => logout()}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>Keluar Akun</span>
        </button>
      </div>
    </div>
  );
};
