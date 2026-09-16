import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  Eye,
  BarChart3,
  ListTodo,
  Settings,
  X,
  SlidersHorizontal,
  Award,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpen,
  onClose,
}) => {
  const { role } = useAuth();

  const menuItems = [
    {
      id: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR', 'GURU'],
    },
    {
      id: '/guru',
      label: 'Daftar Guru',
      icon: <Users className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR'],
    },
    {
      id: '/instrumen',
      label: 'Struktur Instrumen',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      allowedRoles: ['ADMIN'],
    },
    {
      id: '/telaah-rppm',
      label: 'Telaah RPPM',
      icon: <FileCheck2 className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR', 'GURU'],
    },
    {
      id: '/supervisi',
      label: 'Supervisi Pembelajaran',
      icon: <Eye className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR', 'GURU'],
    },
    {
      id: '/nilai-guru',
      label: 'Data Nilai Guru',
      icon: <Award className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR', 'GURU'],
    },
    {
      id: '/laporan',
      label: 'Laporan & Perkembangan',
      icon: <BarChart3 className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR'],
    },
    {
      id: '/tindak-lanjut',
      label: 'Rencana Tindak Lanjut',
      icon: <ListTodo className="w-4 h-4" />,
      allowedRoles: ['ADMIN', 'SUPERVISOR', 'GURU'],
    },
    {
      id: '/pengaturan',
      label: 'Pengaturan & DB',
      icon: <Settings className="w-4 h-4" />,
      allowedRoles: ['ADMIN'],
    },
  ];

  const filteredItems = menuItems.filter((item) => item.allowedRoles.includes(role));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-40 w-64 h-screen bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Mobile close button */}
          <div className="flex items-center justify-between p-4 md:hidden border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400">Navigasi Utama</span>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-6">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-3">
              Menu Utama ({role})
            </div>

            <nav className="space-y-1">
              {filteredItems.map((item) => {
                const isActive = currentPath === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1">Deep Learning Pedagogy</p>
            <p className="leading-snug">Pendekatan Pembelajaran Berkesadaran, Bermakna & Menggembirakan</p>
          </div>
        </div>
      </aside>
    </>
  );
};
