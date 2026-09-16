import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
  Sparkles,
  User,
  Shield,
  GraduationCap,
  ChevronDown,
  LogOut,
  Building2,
  Menu,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { currentUser, currentSchool, role, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const roleLabels: Record<UserRole, { title: string; color: string; icon: React.ReactNode }> = {
    ADMIN: { title: 'Admin Sekolah', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: <Shield className="w-3.5 h-3.5" /> },
    SUPERVISOR: { title: 'Supervisor / Kepala Sekolah', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: <User className="w-3.5 h-3.5" /> },
    GURU: { title: 'Guru Pengajar', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-none">
              SUPERVISI PEMBELAJARAN MENDALAM <span className="text-emerald-600 font-black">AI</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-slate-400" />
              {currentSchool?.name || 'Sekolah Penggerak'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        <div className="hidden sm:flex items-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleLabels[role]?.color || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
            {roleLabels[role]?.icon}
            {roleLabels[role]?.title || role}
          </span>
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-200">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
              ) : (
                currentUser?.full_name?.substring(0, 2).toUpperCase() || 'US'
              )}
            </div>

            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser?.full_name || 'Pengguna'}
              </div>
              <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {currentUser?.email}
              </div>
            </div>

            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800">{currentUser?.full_name}</p>
                <p className="text-xs text-slate-500">{currentUser?.email}</p>
                <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleLabels[role].color}`}>
                  {roleLabels[role].icon}
                  {roleLabels[role].title}
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Keluar Aplikasi
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
