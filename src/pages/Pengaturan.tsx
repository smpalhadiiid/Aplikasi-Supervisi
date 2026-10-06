import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { SUPABASE_SQL_SCHEMA, getActivationSql } from '../lib/sqlSchema';
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  updateSupabaseConfig,
  testSupabaseConnection,
  checkDatabaseHealth,
  TestConnectionResult,
  DatabaseHealthCheckResult,
} from '../lib/supabaseClient';
import { Card } from '../components/common/Card';
import { useToast } from '../components/common/Toast';
import { AdminSupervisorProfileManager } from '../components/admin/AdminSupervisorProfileManager';
import {
  Settings,
  Building2,
  Database,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  Code2,
  Trash2,
  ExternalLink,
  Save,
  Key,
  Globe,
  HelpCircle,
} from 'lucide-react';

export const Pengaturan: React.FC = () => {
  const { currentSchool, currentUser } = useAuth();
  const { showToast } = useToast();

  const [schoolForm, setSchoolForm] = useState({
    name: currentSchool?.name || '',
    npsn: currentSchool?.npsn || '',
    address: currentSchool?.address || '',
    headmaster_name: currentSchool?.headmaster_name || '',
  });

  const [supabaseUrlInput, setSupabaseUrlInput] = useState(SUPABASE_URL || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(SUPABASE_ANON_KEY || '');
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);

  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedActivationSql, setCopiedActivationSql] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [connMessage, setConnMessage] = useState<TestConnectionResult | null>(null);
  const [healthResult, setHealthResult] = useState<DatabaseHealthCheckResult | null>(null);

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnMessage(null);
    setHealthResult(null);
    const res = await testSupabaseConnection();
    const health = await checkDatabaseHealth();
    setTestingConn(false);
    setConnMessage(res);
    setHealthResult(health);
    if (res.success && health.healthy) {
      showToast('Koneksi Sukses', res.message, 'success');
    } else {
      showToast('Perhatian Supabase', res.message, 'error');
    }
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      showToast('Input Belum Lengkap', 'Project URL dan Anon Key wajib diisi.', 'error');
      return;
    }

    setIsSavingSupabase(true);
    try {
      const res = await updateSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      if (res.success) {
        showToast('Koneksi Disimpan', res.message, 'success');
        // Langsung uji konektivitas
        await handleTestConnection();
        try {
          await db.refreshFromSupabase();
        } catch {}
      } else {
        showToast('Gagal Menghubungkan', res.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal Konfigurasi', err?.message || 'Gagal menyimpan kredensial Supabase.', 'error');
    } finally {
      setIsSavingSupabase(false);
    }
  };

  const handleRefreshSupabase = async () => {
    setSyncingData(true);
    try {
      await db.refreshFromSupabase();
      showToast('Sinkronisasi Sukses', 'Data berhasil disinkronkan langsung dari Supabase.', 'success');
    } catch (err: any) {
      showToast('Sinkronisasi Gagal', err.message || 'Gagal memuat data dari Supabase.', 'error');
    } finally {
      setSyncingData(false);
    }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.updateSchool(schoolForm);
      showToast('Berhasil', 'Informasi profil sekolah telah disimpan ke Supabase.', 'success');
    } catch (err: any) {
      showToast('Gagal Menyimpan', err.message || 'Gagal menyimpan profil sekolah.', 'error');
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    showToast('Disalin', 'Skema Database & RLS disalin ke clipboard.', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyActivationSql = () => {
    const email = currentUser?.email || 'smpalhadiid@gmail.com';
    const sql = getActivationSql(email);
    navigator.clipboard.writeText(sql);
    setCopiedActivationSql(true);
    showToast('Disalin', 'Script Perbaikan RLS & Aktivasi Guru disalin ke clipboard.', 'success');
    setTimeout(() => setCopiedActivationSql(false), 3000);
  };

  const handleResetData = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan seluruh data aplikasi ke kondisi awal?')) {
      db.resetToDefaults();
      showToast('Reset Berhasil', 'Data aplikasi dikembalikan ke kondisi awal.', 'info');
      window.location.reload();
    }
  };

  const handleClearDummyData = () => {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data dummy / riwayat transaksi (Telaah RPPM, Supervisi, Analisis AI, & Tindak Lanjut)?')) {
      db.clearAllTransactionalData();
      showToast('Data Dummy Dihapus', 'Seluruh data riwayat telaah dan supervisi dummy berhasil dikosongkan.', 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          <span>Pengaturan Sekolah & Database Supabase</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Kelola profil sekolah, konfigurasi skema Supabase PostgreSQL, RLS, serta panduan import instrumen Excel.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* School Profile Card */}
        <Card title="Profil Sekolah" subtitle="Data identitas resmi sekolah">
          <form onSubmit={handleUpdateSchool} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Sekolah</label>
              <input
                type="text"
                value={schoolForm.name}
                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={schoolForm.npsn}
                  onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kepala Sekolah</label>
                <input
                  type="text"
                  value={schoolForm.headmaster_name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, headmaster_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Sekolah</label>
              <textarea
                rows={2}
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
              >
                Simpan Profil Sekolah
              </button>
            </div>
          </form>
        </Card>

        {/* Database & RLS Export Card */}
        <Card
          title="Kredensial API & Link Database Supabase PostgreSQL"
          subtitle="Data terhubung secara terpusat & dinamis untuk semua perangkat (Multi-Device Sync)"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshSupabase}
                disabled={syncingData}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingData ? 'animate-spin' : ''}`} />
                <span>{syncingData ? 'Menyingkronkan...' : 'Sinkronkan Data Dari Supabase'}</span>
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConn}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin' : ''}`} />
                <span>{testingConn ? 'Menguji...' : 'Uji Koneksi DB'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyActivationSql}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Salin SQL aktivasi untuk mengatasi error RLS dan menautkan profil admin/guru"
              >
                {copiedActivationSql ? <Check className="w-4 h-4 text-white" /> : <ShieldCheck className="w-4 h-4 text-white" />}
                <span>{copiedActivationSql ? 'Tersalin' : 'Perbaikan RLS & Aktivasi'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Tersalin' : 'Salin SQL Schema'}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Form Input Kredensial Supabase Baru / Ubah Koneksi */}
            <form onSubmit={handleSaveSupabaseConfig} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Hubungkan Database Supabase PostgreSQL</span>
                </div>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                >
                  <span>Buka Supabase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* 4 Panduan Langkah Singkat */}
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Panduan Menghubungkan Supabase:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-indigo-900/90 leading-relaxed text-[10.5px]">
                  <li>Buka proyek Anda di <strong>supabase.com</strong>, pilih menu <strong>SQL Editor</strong>.</li>
                  <li>Klik tombol <strong>Salin SQL Schema</strong> di atas, tempel di SQL Editor, lalu klik <strong>Run</strong> untuk membuat seluruh tabel.</li>
                  <li>Buka menu <strong>Project Settings &gt; API</strong>, lalu salin <strong>Project URL</strong> dan <strong>anon public API Key</strong>.</li>
                  <li>Tempelkan ke formulir di bawah ini dan klik <strong>Simpan & Hubungkan Database</strong>.</li>
                </ol>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supabase Project URL (API Endpoint)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      required
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Public Anon API Key
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Key className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-500">
                  Tersimpan di browser lokal dan sinkron ke server.
                </span>
                <button
                  type="submit"
                  disabled={isSavingSupabase}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isSavingSupabase ? 'Menyimpan & Menghubungkan...' : 'Simpan & Hubungkan Database'}</span>
                </button>
              </div>
            </form>

            {/* Supabase Connection Status Banner */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <div>
                    <span className={`font-extrabold text-sm block ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Status Database: {isSupabaseConfigured ? 'Terkonfigurasi (Env Active)' : 'Belum Dikonfigurasi'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isSupabaseConfigured
                        ? 'Supabase PostgreSQL Single Source of Truth'
                        : 'Variabel lingkungan VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum tersedia'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-lg">
                  Supabase PostgreSQL
                </span>
              </div>

              {/* API Credentials Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Project URL / API Endpoint</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!SUPABASE_URL) {
                          showToast('Peringatan', 'Project URL belum dikonfigurasi.', 'error');
                          return;
                        }
                        navigator.clipboard.writeText(SUPABASE_URL);
                        showToast('Tersalin', 'Project URL berhasil disalin.', 'success');
                      }}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Salin
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-emerald-300 truncate">
                    {SUPABASE_URL || '(Belum dikonfigurasi)'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Public Anon API Key</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!SUPABASE_ANON_KEY) {
                          showToast('Peringatan', 'Anon Key belum dikonfigurasi.', 'error');
                          return;
                        }
                        navigator.clipboard.writeText(SUPABASE_ANON_KEY);
                        showToast('Tersalin', 'Anon Key berhasil disalin.', 'success');
                      }}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Salin
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    {SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 32)}...` : '(Belum dikonfigurasi)'}
                  </p>
                </div>
              </div>

              {connMessage && (
                <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                  connMessage.success
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-800 text-rose-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {connMessage.success ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Code2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold">
                          {connMessage.success ? 'Koneksi Berhasil' : 'Pemberitahuan Database Supabase'}
                        </p>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10">
                          {connMessage.category}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{connMessage.message}</p>

                      {/* Tabel Verifikasi Health Check */}
                      {healthResult && (
                        <div className="pt-2 mt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {(['schools', 'users', 'teachers'] as const).map((tName) => {
                            const tInfo = healthResult.tables[tName];
                            return (
                              <div
                                key={tName}
                                className={`p-2 rounded border text-[11px] font-mono ${
                                  tInfo?.healthy
                                    ? 'bg-emerald-900/40 border-emerald-700/60 text-emerald-300'
                                    : 'bg-rose-900/40 border-rose-700/60 text-rose-300'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <span>{tName}</span>
                                  <span>{tInfo?.healthy ? '✓ OK' : '✕ FAIL'}</span>
                                </div>
                                <div className="text-[10px] opacity-80 mt-0.5 truncate">
                                  {tInfo?.category}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-xl p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 border border-slate-800">
              <pre>{SUPABASE_SQL_SCHEMA.substring(0, 1000)}...</pre>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Fitur Sinkronisasi Lintas Perangkat (Multi-Device Sync):
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                <li>Setiap perubahan data (Guru, Telaah RPPM, Supervisi) otomatis tersimpan ke Cloud PostgreSQL Supabase.</li>
                <li>Akses dari HP, Tablet, Laptop, maupun Komputer Sekolah akan secara otomatis menampilkan data yang sama & selalu diperbarui secara real-time.</li>
                <li>Masing-masing pengguna login sesuai akun email/NIP untuk mendapatkan akses data yang terisolasi aman dengan RLS.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Guide Card: How to Import Excel Instruments */}
      <Card
        title="Panduan Memasukkan Indikator Instrumen Dari Dua File Excel"
        subtitle="Langkah mudah import instrumen dari file Excel (.xlsx)"
      >
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>1. Format Kolom File Excel</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pastikan kedua file Excel memiliki struktur baris pertama sebagai Header dengan 6 kolom berikut:
            </p>
            <div className="p-2.5 rounded-xl bg-white border border-emerald-200 font-mono text-[11px] text-slate-700">
              [Seksi/Kategori] | [Kode] | [Indikator] | [Deskripsi/Rubrik] | [Skor Min] | [Skor Maks]
            </div>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              <li>File 1: <strong className="text-slate-800">Instrumen Telaah RPPM.xlsx</strong></li>
              <li>File 2: <strong className="text-slate-800">Instrumen Supervisi Pembelajaran.xlsx</strong></li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-800 uppercase tracking-wider">
              <Code2 className="w-4 h-4 text-sky-600" />
              <span>2. Langkah Eksekusi Di Aplikasi</span>
            </div>
            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <li>Buka menu <strong className="text-slate-800">Struktur Instrumen</strong> di sidebar.</li>
              <li>Pilih Tab: <strong>Instrumen Telaah RPPM</strong> atau <strong>Instrumen Supervisi Pembelajaran</strong>.</li>
              <li>Klik tombol <strong>Import Excel</strong> di pojok kanan atas.</li>
              <li>Pilih file Excel sesuai tab yang aktif dan klik <strong>Import Data</strong>.</li>
              <li>Aplikasi akan membaca seluruh bagian & indikator dan menyimpannya langsung ke database.</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Admin & Supervisor Profiles Management Section */}
      <AdminSupervisorProfileManager />

      {/* Reset Data Danger Zone */}
      <Card title="Zona Bahaya Data" subtitle="Manajemen pembersihan data lokal">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Kosongkan Riwayat & Data Dummy</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Menghapus seluruh catatan telaah RPPM, supervisi kelas, analisis AI, dan tindak lanjut simulasi.
              </p>
            </div>
            <button
              onClick={handleClearDummyData}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-4 h-4 text-amber-600" />
              <span>Hapus Data Dummy</span>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Reset Seluruh Data Aplikasi</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Mengembalikan seluruh data simulasi sekolah, guru, instrumen, dan supervisi ke kondisi awal.
              </p>
            </div>
            <button
              onClick={handleResetData}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Ke Default</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
