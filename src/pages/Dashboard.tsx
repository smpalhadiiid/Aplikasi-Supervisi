import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { DashboardStats } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import { AdminSupervisorProfileManager } from '../components/admin/AdminSupervisorProfileManager';
import {
  Users,
  FileCheck2,
  Eye,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowRight,
  Sparkles,
  Award,
  CheckCircle2,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { role, currentUser, currentTeacherProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const loadStats = () => {
      setStats(db.getDashboardStats(role, currentTeacherProfile?.id || currentUser?.id));
    };

    loadStats();
    const unsubscribe = db.subscribe(loadStats);
    return () => unsubscribe();
  }, [role, currentTeacherProfile, currentUser]);

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Welcome Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deep Learning Pedagogy Supervisor AI</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Selamat Datang, {currentUser?.full_name}
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-2 leading-relaxed">
              {role === 'ADMIN' && 'Kelola seluruh data sekolah, instrumen dinamis, dan supervisi terstruktur.'}
              {role === 'SUPERVISOR' && 'Lakukan telaah RPPM, observasi kelas, dan analisis rekomendasi AI untuk peningkatan mutu guru.'}
              {role === 'GURU' && 'Pantau hasil telaah RPPM, rekomendasi supervisi, serta rencana tindak lanjut pengembangan diri.'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('/nilai-guru')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-900/30 transition-all flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-slate-950" />
              <span>Data Nilai Guru</span>
            </button>
            {role !== 'GURU' && (
              <>
                <button
                  onClick={() => onNavigate('/telaah-rppm')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Telaah RPP Baru</span>
                </button>
                <button
                  onClick={() => onNavigate('/supervisi')}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs backdrop-blur-md transition-all flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Supervisi Kelas</span>
                </button>
              </>
            )}
            {role === 'GURU' && (
              <button
                onClick={() => onNavigate('/tindak-lanjut')}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lihat Rekomendasi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Guru / Profil Guru */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {role === 'GURU' ? 'Profil Guru' : 'Jumlah Guru'}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">
              {role === 'GURU' ? (currentTeacherProfile?.subject || 'Guru') : stats.totalTeachers}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {role === 'GURU' ? (currentTeacherProfile?.class_grade || 'Aktif') : 'Guru terdaftar'}
            </p>
          </div>
        </Card>

        {/* Card 2: Total Telaah RPP */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {role === 'GURU' ? 'Telaah RPPM Saya' : 'Telaah RPPM'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.totalRppReviews}</div>
            <p className="text-[11px] text-slate-500 mt-1">Dokumen dianalisis</p>
          </div>
        </Card>

        {/* Card 3: Total Supervisi */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {role === 'GURU' ? 'Supervisi Saya' : 'Supervisi'}
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.totalSupervisions}</div>
            <p className="text-[11px] text-slate-500 mt-1">Sesi observasi kelas</p>
          </div>
        </Card>

        {/* Card 4: Rata-Rata Nilai Telaah */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {role === 'GURU' ? 'Skor RPPM Saya' : 'Rerata RPP'}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.avgRppScore}%</div>
            <div className="mt-1">
              <ProgressBar value={stats.avgRppScore} size="sm" showPercentage={false} />
            </div>
          </div>
        </Card>

        {/* Card 5: Rata-Rata Nilai Supervisi */}
        <Card className="flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {role === 'GURU' ? 'Skor Observasi Saya' : 'Rerata Supervisi'}
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.avgSupervisionScore}%</div>
            <div className="mt-1">
              <ProgressBar value={stats.avgSupervisionScore} size="sm" showPercentage={false} />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid: Chart & Teachers Needing Follow Up */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Score Progress Chart */}
        <Card
          title="Grafik Perkembangan Nilai RPP & Supervisi"
          subtitle="Tren rata-rata skor bulanan sekolah"
          className="lg:col-span-7"
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-6 text-xs font-semibold mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md bg-emerald-500" />
                <span className="text-slate-700">Telaah RPPM</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md bg-sky-500" />
                <span className="text-slate-700">Supervisi Pembelajaran</span>
              </div>
            </div>

            {/* Custom CSS Bar Chart */}
            <div className="h-56 flex items-end justify-between gap-4 pt-6 border-b border-slate-100 px-2">
              {stats.monthlyProgress.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* RPP Bar */}
                    <div
                      className="w-1/2 max-w-[20px] bg-emerald-500 rounded-t-md transition-all duration-500 relative group"
                      style={{ height: `${item.rppAvg}%` }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none transition-opacity">
                        {item.rppAvg}%
                      </div>
                    </div>
                    {/* Supervisi Bar */}
                    <div
                      className="w-1/2 max-w-[20px] bg-sky-500 rounded-t-md transition-all duration-500 relative group"
                      style={{ height: `${item.supervisionAvg}%` }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none transition-opacity">
                        {item.supervisionAvg}%
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{item.month}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              *Skor berdasarkan evaluasi instrumen skala 100
            </p>
          </div>
        </Card>

        {/* Teachers Needing Follow Up */}
        <Card
          title={role === 'GURU' ? 'Status Tindak Lanjut Saya' : 'Guru Membutuhkan Tindak Lanjut'}
          subtitle={role === 'GURU' ? 'Rencana pengembangan diri dan hasil evaluasi pembelajaran' : 'Daftar guru yang memerlukan pendampingan khusus'}
          className="lg:col-span-5"
          action={
            <button
              onClick={() => onNavigate('/tindak-lanjut')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {stats.teachersNeedingFollowUp.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {role === 'GURU'
                ? 'Target kompetensi pembelajaran telah tercapai dengan baik (>75%).'
                : 'Seluruh guru telah mencapai nilai standar minimun (>75%).'}
            </div>
          ) : (
            <div className="space-y-3">
              {stats.teachersNeedingFollowUp.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{role === 'GURU' ? 'Program Bimbingan Anda' : teacher.full_name}</div>
                      <div className="text-[11px] text-slate-500">{teacher.subject} • {teacher.class_grade}</div>
                    </div>
                  </div>
                  <Badge variant="warning" size="sm">
                    {role === 'GURU' ? 'Perlu Dilengkapi' : 'Perlu Pendampingan'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Admin & Supervisor Profile Management Section */}
      {(role === 'ADMIN' || role === 'SUPERVISOR') && (
        <div className="pt-2">
          <AdminSupervisorProfileManager />
        </div>
      )}
    </div>
  );
};
