import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { UserRole } from '../types';
import {
  BookOpen,
  Cpu,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Wand2,
} from 'lucide-react';

interface LoginProps {
  onNavigate?: (path: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { signInWithPassword, signInWithMagicLink, login: fallbackLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRedirectByRole = (role: UserRole) => {
    let targetPath = '/dashboard';
    if (role === 'ADMIN') targetPath = '/admin/dashboard';
    else if (role === 'SUPERVISOR') targetPath = '/supervisor/dashboard';
    else if (role === 'GURU') targetPath = '/guru/dashboard';

    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Harap isi email dan password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await signInWithPassword(email, password);

      if (res.success && res.role) {
        handleRedirectByRole(res.role);
      } else {
        setErrorMessage(res.error || 'Tidak dapat masuk. Periksa kembali email dan password Anda.');
      }
    } catch {
      setErrorMessage('Koneksi bermasalah. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage('Masukkan email Anda untuk menggunakan Magic Link.');
      return;
    }

    setIsMagicLoading(true);

    try {
      const res = await signInWithMagicLink(email);
      if (res.success) {
        setSuccessMessage('Tautan masuk instan (Magic Link) telah dikirim ke email Anda. Silakan periksa inbox.');
      } else {
        setErrorMessage(res.error || 'Koneksi bermasalah. Silakan coba lagi.');
      }
    } catch {
      setErrorMessage('Koneksi bermasalah. Silakan coba lagi.');
    } finally {
      setIsMagicLoading(false);
    }
  };

  // Preset demo account login helper
  const handleQuickDemo = (demoEmail: string, role: UserRole) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setErrorMessage(null);
    setSuccessMessage(null);

    // Attempt Supabase Auth, or fall back to demo session
    signInWithPassword(demoEmail, 'Password123!').then((res) => {
      if (res.success && res.role) {
        handleRedirectByRole(res.role);
      } else {
        // Fallback demo login for easy app exploration
        fallbackLogin(demoEmail, role);
        handleRedirectByRole(role);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans antialiased text-slate-800">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
        {/* PANEL KIRI: Branding & Keunggulan (Hidden on mobile or compact top banner) */}
        <div className="md:col-span-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-emerald-950 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

          {/* Header & Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <div className="flex items-center gap-1">
                  <BookOpen className="w-5 h-5" />
                  <Cpu className="w-3.5 h-3.5 -ml-1 text-teal-300" />
                </div>
              </div>
              <div>
                <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">Aplikasi Resmi</span>
                <div className="text-sm font-extrabold tracking-tight text-white">SPM-AI</div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-white mb-3">
              Supervisi Pembelajaran Mendalam <span className="text-emerald-400">AI</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-normal mb-8">
              Supervisi, telaah, dan pengembangan pembelajaran berbantuan AI untuk menciptakan budaya mengajar yang otentik, reflektif, dan berdampak.
            </p>

            {/* Visual Badge / Feature Card */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 backdrop-blur-sm mb-8 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Teknologi Deep Learning Pedagogy</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Membantu sekolah mengevaluasi RPPM & pelaksanaan supervisi kelas berdasarkan prinsip <span className="text-white font-medium">Mindful, Meaningful, & Joyful Learning</span>.
              </p>
            </div>

            {/* 3 Keunggulan Utama */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Keunggulan Utama Platform:
              </div>

              <div className="flex items-start gap-3 text-xs text-slate-200">
                <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="font-medium leading-tight">Telaah RPPM berbantuan AI secara presisi</span>
              </div>

              <div className="flex items-start gap-3 text-xs text-slate-200">
                <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="font-medium leading-tight">Supervisi pembelajaran terstruktur & transparan</span>
              </div>

              <div className="flex items-start gap-3 text-xs text-slate-200">
                <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="font-medium leading-tight">Rekomendasi tindak lanjut berbasis data otentik</span>
              </div>
            </div>
          </div>

          {/* Footer Branding Left */}
          <div className="relative z-10 pt-8 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Versi 3.5 • Terintegrasi Supabase</span>
            <span>Target: Kepala Sekolah, Supervisor, Guru</span>
          </div>
        </div>

        {/* PANEL KANAN: Form Login Card */}
        <div className="md:col-span-6 p-6 sm:p-8 md:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Header Form & Logo Placeholder */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                  SPM
                </div>
                <span className="text-xs font-extrabold text-slate-900 tracking-tight">SPM-AI</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Portal Masuk
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang</h2>
              <p className="text-xs text-slate-500 mt-1">Masuk untuk melanjutkan ke dashboard.</p>
            </div>

            {/* Error & Success Alert Banners */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{successMessage}</span>
              </div>
            )}

            {/* FORM LOGIN */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Username / Email / NIP Guru</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: siti.rahma atau 198504122010012005"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) onNavigate('/forgot-password');
                      else {
                        window.history.pushState({}, '', '/forgot-password');
                        window.dispatchEvent(new Event('popstate'));
                      }
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition-all"
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Checkbox Ingat Saya */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium text-slate-600">Ingat saya</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider Atau */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold">atau</span>
              </div>
            </div>

            {/* Button Magic Link */}
            <button
              type="button"
              onClick={handleMagicLinkSubmit}
              disabled={isMagicLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isMagicLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim Tautan...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-emerald-600" />
                  <span>Masuk dengan Magic Link</span>
                </>
              )}
            </button>

            {/* Quick Demo Accounts Helper */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Uji Coba Cepat (Pilih Akun Role):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin@sekolah.sch.id', 'ADMIN')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] group-hover:text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Admin</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Suwarno</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('supervisor@sekolah.sch.id', 'SUPERVISOR')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] group-hover:text-indigo-700">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Supervisor 1</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Herman Jayusman</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('suwarno@sekolah.sch.id', 'SUPERVISOR')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] group-hover:text-indigo-700">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Supervisor 2</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Suwarno</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const activeTeachers = db.getTeachers();
                    if (activeTeachers.length > 0) {
                      handleQuickDemo(activeTeachers[0].email, 'GURU');
                    } else {
                      alert('Belum ada data guru terdaftar. Silakan masuk sebagai Admin untuk menambahkan data guru.');
                    }
                  }}
                  className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] group-hover:text-amber-700">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Guru</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {db.getTeachers().length > 0 ? db.getTeachers()[0].full_name.split(' ')[0] : 'Role Guru'}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Kecil */}
          <div className="pt-6 text-center text-[11px] text-slate-400">
            © 2026 Supervisi Pembelajaran Mendalam AI
          </div>
        </div>
      </div>
    </div>
  );
};
