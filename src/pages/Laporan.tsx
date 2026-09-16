import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { RppReview, Supervision, Teacher } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  BarChart3,
  Printer,
  Award,
  TrendingUp,
  FileCheck2,
  Eye,
} from 'lucide-react';

export const Laporan: React.FC = () => {
  const { role } = useAuth();
  const [reviews, setReviews] = useState<RppReview[]>([]);
  const [supervisions, setSupervisions] = useState<Supervision[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    const loadData = () => {
      setReviews(db.getRppReviews(role));
      setSupervisions(db.getSupervisions(role));
      setTeachers(db.getTeachers(role));
    };
    loadData();
    return db.subscribe(loadData);
  }, [role]);

  const isTeacherMatch = (recordTeacherId?: string, recordTeacherName?: string, teacherObj?: any) => {
    if (!teacherObj) return false;
    const tId = teacherObj.id;
    const tUserId = teacherObj.user_id;
    const tNip = teacherObj.nip;
    const tName = teacherObj.full_name?.trim().toLowerCase();

    if (recordTeacherId) {
      if (recordTeacherId === tId) return true;
      if (tUserId && recordTeacherId === tUserId) return true;
      if (tNip && recordTeacherId === tNip) return true;
      const resolvedId = db.resolveTeacherId(recordTeacherId);
      if (resolvedId && (resolvedId === tId || resolvedId === tUserId)) return true;
    }

    if (recordTeacherName && tName) {
      if (recordTeacherName.trim().toLowerCase() === tName) return true;
    }

    return false;
  };

  // Group stats per teacher
  const teacherReport = teachers.filter(Boolean).map((t) => {
    const teacherRpps = reviews.filter((r) => isTeacherMatch(r?.teacher_id, r?.teacher_name, t));
    const teacherSups = supervisions.filter((s) => isTeacherMatch(s?.teacher_id, s?.teacher_name, t));

    const avgRpp =
      teacherRpps.length > 0
        ? Math.round(
            (teacherRpps.reduce((acc, curr) => acc + curr.percentage_score, 0) /
              teacherRpps.length) *
              10
          ) / 10
        : 0;

    const avgSup =
      teacherSups.length > 0
        ? Math.round(
            (teacherSups.reduce((acc, curr) => acc + curr.percentage_score, 0) /
              teacherSups.length) *
              10
          ) / 10
        : 0;

    const overallAvg =
      avgRpp > 0 && avgSup > 0
        ? Math.round(((avgRpp + avgSup) / 2) * 10) / 10
        : avgRpp || avgSup || 0;

    let predicate = 'Kurang';
    if (overallAvg >= 85) predicate = 'Amat Baik';
    else if (overallAvg >= 75) predicate = 'Baik';
    else if (overallAvg >= 60) predicate = 'Cukup';

    return {
      teacher: t,
      rppCount: teacherRpps.length,
      supCount: teacherSups.length,
      avgRpp,
      avgSup,
      overallAvg,
      predicate,
    };
  });

  const columns = [
    {
      header: 'Nama Guru',
      cell: (item: typeof teacherReport[0]) => (
        <div>
          <div className="font-bold text-slate-800">{item.teacher.full_name}</div>
          <div className="text-[11px] text-slate-400">NIP: {item.teacher.nip}</div>
        </div>
      ),
    },
    {
      header: 'Mata Pelajaran',
      cell: (item: typeof teacherReport[0]) => (
        <span className="text-slate-700 font-medium">{item.teacher.subject}</span>
      ),
    },
    {
      header: 'Rerata RPP',
      cell: (item: typeof teacherReport[0]) => (
        <div className="w-24">
          <div className="font-bold text-slate-800 text-xs mb-0.5">{item.avgRpp}%</div>
          <ProgressBar value={item.avgRpp} size="sm" showPercentage={false} />
        </div>
      ),
    },
    {
      header: 'Rerata Supervisi',
      cell: (item: typeof teacherReport[0]) => (
        <div className="w-24">
          <div className="font-bold text-slate-800 text-xs mb-0.5">{item.avgSup}%</div>
          <ProgressBar value={item.avgSup} size="sm" showPercentage={false} />
        </div>
      ),
    },
    {
      header: 'Nilai Gabungan',
      cell: (item: typeof teacherReport[0]) => (
        <span className="text-sm font-extrabold text-emerald-600">{item.overallAvg}%</span>
      ),
    },
    {
      header: 'Predikat',
      cell: (item: typeof teacherReport[0]) => (
        <Badge
          variant={
            item.predicate === 'Amat Baik'
              ? 'success'
              : item.predicate === 'Baik'
              ? 'info'
              : item.predicate === 'Cukup'
              ? 'warning'
              : 'error'
          }
          size="sm"
        >
          {item.predicate}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Laporan Rekapitulasi & Perkembangan Mutu</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi gabungan nilai telaah RPPM dan supervisi proses pembelajaran sekolah
          </p>
        </div>

        <button
          onClick={() => triggerPrint()}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan (PDF)</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Total Telaah RPPM</div>
            <div className="text-2xl font-black text-slate-800">{reviews.length} Dokumen</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-sky-100 text-sky-800">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Total Supervisi Kelas</div>
            <div className="text-2xl font-black text-slate-800">{supervisions.length} Sesi</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-800">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Tingkat Ketuntasan</div>
            <div className="text-2xl font-black text-emerald-600">85.4% Baik</div>
          </div>
        </Card>
      </div>

      {/* Main Table */}
      <Card title="Rekapitulasi Nilai Per Guru Pengajar">
        <Table columns={columns} data={teacherReport} keyExtractor={(item) => item?.teacher?.id || Math.random().toString()} />
      </Card>
    </div>
  );
};
