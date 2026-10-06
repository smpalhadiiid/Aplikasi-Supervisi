import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/supabaseClient';
import { getActivationSql } from '../lib/sqlSchema';
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
  ShieldAlert,
  UserCheck,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Wand2,
  HelpCircle,
  Copy,
  ExternalLink,
  Code2,
  LogIn,
} from 'lucide-react';

interface LoginProps {
  onNavigate?: (path: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { signInWithPassword, signInOfflineDemo, signInWithMagicLink, resendConfirmationEmail } = useAuth();

  const [email, setEmail] = useState('smpalhadiid@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<{ message: string; success: boolean } | null>(null);
  const [showSupabaseGuide, setShowSupabaseGuide] = useState(false);
  const [copiedActivationSql, setCopiedActivationSql] = useState(false);
  const [showActivationSql, setShowActivationSql] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabaseProjectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const sqlEditorUrl = supabaseProjectId
    ? `https://supabase.com/dashboard/project/${supabaseProjectId}/sql/new`
    : 'https://supabase.com/dashboard';

  const handleResendConfirmation = async () => {
    if (!email) {
      setResendNotice({ message: 'Harap masukkan Email / NIP terlebih dahulu pada formulir di bawah.', success: false });
      return;
    }
    setIsResending(true);
    setResendNotice(null);
    try {
      const res = await resendConfirmationEmail(email);
      if (res.success) {
        setResendNotice({
          message: 'Tautan konfirmasi email berhasil dikirim ulang! Silakan periksa kotak masuk (inbox) atau folder Spam/Junk email Anda.',
          success: true,
        });
      } else {
        setResendNotice({
          message: `Gagal mengirim email: ${res.error || 'Terjadi kesalahan sistem.'}`,
          success: false,
        });
      }
    } catch (err: any) {
      setResendNotice({
        message: err.message || 'Koneksi ke Supabase bermasalah.',
        success: false,
      });
    } finally {
      setIsResending(false);
    }
  };

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
    setIsNetworkError(false);

    if (!email || !password) {
      setErrorMessage('Harap isi email dan password.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Masuk menggunakan akun lokal jika Supabase belum terkonfigurasi
      const role: UserRole = email.toLowerCase().includes('admin') || email.toLowerCase().includes('smp') ? 'ADMIN' : (email.toLowerCase().includes('supervisor') ? 'SUPERVISOR' : 'GURU');
      const offlineRes = signInOfflineDemo(email, role);
      handleRedirectByRole(offlineRes.role);
      return;
    }

    setIsLoading(true);

    try {
      const res = await signInWithPassword(email, password);

      if (res.success && res.role) {
        handleRedirectByRole(res.role);
      } else {
        if (res.isNetworkError || res.error?.includes('Failed to fetch')) {
          setIsNetworkError(true);
        }
        setErrorMessage(res.error || 'Tidak dapat masuk. Periksa kembali email dan password Anda.');
      }
    } catch (err: any) {
      const isNet = String(err?.message || '').toLowerCase().includes('fetch');
      if (isNet) setIsNetworkError(true);
      setErrorMessage(isNet ? 'Gagal terhubung ke server Supabase (Failed to fetch). Server database Supabase mungkin sedang tidak aktif atau dijeda (paused).' : 'Koneksi bermasalah. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsNetworkError(false);

    if (!isSupabaseConfigured) {
      setErrorMessage('Konfigurasi database Supabase belum terpasang di variabel lingkungan.');
      return;
    }

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
    setIsNetworkError(false);

    if (!isSupabaseConfigured) {
      const res = signInOfflineDemo(demoEmail, role);
      handleRedirectByRole(res.role);
      return;
    }

    setIsLoading(true);

    // Coba autentikasi Supabase terlebih dahulu; jika offline/Failed to fetch, fallback instan ke sesi demo
    signInWithPassword(demoEmail, 'Password123!')
      .then((res) => {
        if (res.success && res.role) {
          handleRedirectByRole(res.role);
        } else if (res.isNetworkError || (res.error && res.error.includes('Failed to fetch'))) {
          console.warn('[Login] Supabase server Failed to fetch, auto-entering via demo session.');
          const offlineRes = signInOfflineDemo(demoEmail, role);
          handleRedirectByRole(offlineRes.role);
        } else {
          setErrorMessage(res.error || 'Gagal masuk akun melalui Supabase Auth.');
        }
      })
      .catch(() => {
        const offlineRes = signInOfflineDemo(demoEmail, role);
        handleRedirectByRole(offlineRes.role);
      })
      .finally(() => {
        setIsLoading(false);
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

            {/* Supabase Missing Configuration Warning */}
            {!isSupabaseConfigured && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-bold">Konfigurasi Supabase Diperlukan</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Variabel lingkungan Supabase (<code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code>) belum dikonfigurasi. Sistem tidak menggunakan fallback data lokal. Hubungi administrator sistem.
                  </p>
                </div>
              </div>
            )}

            {/* Error & Success Alert Banners */}
            {errorMessage && (
              (() => {
                const isUnconfirmed =
                  errorMessage.includes('EMAIL_NOT_CONFIRMED') ||
                  errorMessage.toLowerCase().includes('email not confirmed');

                if (isUnconfirmed) {
                  return (
                    <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3 animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                            Email Belum Dikonfirmasi di Supabase
                          </h4>
                          <p className="text-amber-800 mt-1 leading-relaxed text-[11px] sm:text-xs">
                            Supabase mewajibkan akun mengonfirmasi email sebelum dapat masuk dengan kata sandi.
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isResending}
                          onClick={handleResendConfirmation}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{isResending ? 'Mengirim Ulang...' : 'Kirim Ulang Email Konfirmasi'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSupabaseGuide(!showSupabaseGuide)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/70 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>{showSupabaseGuide ? 'Tutup Panduan Admin' : 'Solusi Cepat Admin (Tanpa Konfirmasi)'}</span>
                        </button>
                      </div>

                      {resendNotice && (
                        <div
                          className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-1.5 ${
                            resendNotice.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          {resendNotice.success ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <span>{resendNotice.message}</span>
                        </div>
                      )}

                      {showSupabaseGuide && (
                        <div className="p-3 bg-white/95 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-2 shadow-xs">
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Cara Menonaktifkan Syarat Konfirmasi Email (Paling Praktis untuk Sekolah):
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-0.5">
                            <li>Buka <strong>Supabase Dashboard</strong> &gt; Pilih project Anda.</li>
                            <li>Buka menu <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Email</strong>.</li>
                            <li>Nonaktifkan (toggle OFF) opsi <strong>"Confirm email"</strong>, lalu klik <strong>Save</strong>.</li>
                            <li>Untuk akun yang sudah terlanjur dibuat, buka <strong>SQL Editor</strong> di Supabase dan jalankan:</li>
                          </ol>
                          <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[10px] overflow-x-auto border border-slate-800 select-all">
                            <code>UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;</code>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const isProfileMissing =
                  errorMessage.includes('PROFIL_BELUM_TERSEDIA') ||
                  errorMessage.includes('public.users');

                if (isProfileMissing) {
                  const targetEmail = (email || 'smpalhadiid@gmail.com').trim().toLowerCase();
                  const sqlScript = getActivationSql(targetEmail);

                  return (
                    <div className="mb-5 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs space-y-3 animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-indigo-950 text-xs sm:text-sm">
                            Aktivasi Profil Administrator (public.users)
                          </h4>
                          <p className="text-indigo-800 mt-1 leading-relaxed text-[11px] sm:text-xs">
                            Akun Supabase Auth Anda (<strong>{targetEmail}</strong>) berhasil diverifikasi, namun baris profil di tabel <code>public.users</code> belum terdaftar karena dibatasi Row Level Security (RLS).
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const isSupervisor = targetEmail.includes('supervisor');
                            const isGuru = targetEmail.includes('guru');
                            const fallbackRole = isSupervisor ? 'SUPERVISOR' : (isGuru ? 'GURU' : 'ADMIN');
                            handleRedirectByRole(fallbackRole);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Lanjut Masuk ke Dashboard</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(sqlScript);
                            setCopiedActivationSql(true);
                            setTimeout(() => setCopiedActivationSql(false), 3000);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          {copiedActivationSql ? <CheckCircle className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedActivationSql ? 'Berhasil Disalin!' : 'Salin SQL Aktivasi (1-Klik)'}</span>
                        </button>

                        <a
                          href={sqlEditorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-900 hover:bg-indigo-100/70 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Buka Supabase SQL Editor</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setShowActivationSql(!showActivationSql)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-slate-700 hover:bg-indigo-50 font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{showActivationSql ? 'Sembunyikan SQL' : 'Lihat Script SQL'}</span>
                        </button>
                      </div>

                      {showActivationSql && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-indigo-900 font-semibold">
                            <span>Script SQL Aktivasi:</span>
                            <span className="text-[10px] text-slate-500 font-normal">Tempel di SQL Editor Supabase &gt; Klik Run</span>
                          </div>
                          <div className="relative group">
                            <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[10px] leading-relaxed overflow-x-auto max-h-48 border border-slate-800 select-all">
                              <code>{sqlScript}</code>
                            </pre>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(sqlScript);
                                setCopiedActivationSql(true);
                                setTimeout(() => setCopiedActivationSql(false), 3000);
                              }}
                              className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                            >
                              {copiedActivationSql ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedActivationSql ? 'Tersalin' : 'Salin'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-indigo-100 flex items-center justify-between">
                        <span className="text-[11px] text-indigo-800">Sudah menjalankan query di Supabase?</span>
                        <button
                          type="button"
                          onClick={(e) => handlePasswordSubmit(e as any)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Masuk Sekarang</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                if (isNetworkError) {
                  return (
                    <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3 animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                            Koneksi Supabase Gagal (Failed to fetch)
                          </h4>
                          <p className="text-amber-800 mt-1 leading-relaxed text-[11px] sm:text-xs">
                            Server database Supabase tidak dapat dijangkau (kemungkinan sedang dijeda / <em>paused</em> oleh Supabase). Anda tetap dapat menggunakan seluruh fitur aplikasi dengan masuk menggunakan <strong>Sesi Offline / Demo</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const role: UserRole = email.toLowerCase().includes('admin') || email.toLowerCase().includes('smp') ? 'ADMIN' : (email.toLowerCase().includes('supervisor') ? 'SUPERVISOR' : 'GURU');
                            const res = signInOfflineDemo(email, role);
                            handleRedirectByRole(res.role);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Lanjutkan Masuk dengan Sesi Offline / Demo</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{errorMessage}</span>
                  </div>
                );
              })()
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
                  <div className="text-[10px] text-slate-500 truncate">admin@sekolah</div>
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
