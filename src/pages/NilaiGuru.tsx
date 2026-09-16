import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { RppReview, Supervision, Teacher, FollowUpPlan } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ProgressBar } from '../components/common/ProgressBar';
import { useToast } from '../components/common/Toast';
import { LembarRincianNilaiModal } from '../components/common/LembarRincianNilaiModal';
import {
  Award,
  Search,
  Download,
  Printer,
  FileCheck2,
  Eye,
  GraduationCap,
  Sparkles,
  Layers,
  CheckCircle2,
  FileText,
  Sliders,
  Building2,
  UserCheck,
  TrendingUp,
} from 'lucide-react';

interface TeacherScoreSummary {
  teacher: Teacher;
  latestRpp?: RppReview;
  latestSup?: Supervision;
  rppScore: number;
  supScore: number;
  compositeScore: number;
  predicate: 'Amat Baik' | 'Baik' | 'Cukup' | 'Perlu Pembinaan';
  followUpStatus: string;
  totalSupervisionsCount: number;
}

export const NilaiGuru: React.FC = () => {
  const { role, currentSchool, currentUser, currentTeacherProfile } = useAuth();
  const { showToast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [reviews, setReviews] = useState<RppReview[]>([]);
  const [supervisions, setSupervisions] = useState<Supervision[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpPlan[]>([]);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPredicate, setSelectedPredicate] = useState<string>('ALL');
  const [rppWeight, setRppWeight] = useState<number>(40); // 40% RPPM : 60% Supervisi
  const [selectedTeacherScore, setSelectedTeacherScore] = useState<TeacherScoreSummary | null>(null);
  const [isTranskripOpen, setIsTranskripOpen] = useState(false);
  const [lembarModalConfig, setLembarModalConfig] = useState<{
    isOpen: boolean;
    type: 'RPPM' | 'SUPERVISION';
    data: any;
  }>({ isOpen: false, type: 'RPPM', data: null });

  useEffect(() => {
    const loadData = () => {
      setTeachers(db.getTeachers(role, currentTeacherProfile?.id || currentUser?.id));
      setReviews(db.getRppReviews(role, currentTeacherProfile?.id || currentUser?.id));
      setSupervisions(db.getSupervisions(role, currentTeacherProfile?.id || currentUser?.id));
      setFollowUps(db.getFollowUpPlans(role, currentTeacherProfile?.id || currentUser?.id));
    };
    loadData();
    return db.subscribe(loadData);
  }, [role, currentTeacherProfile, currentUser]);

  const supWeight = 100 - rppWeight;

  // Helper matching function for teachers
  const isTeacherMatch = (recordTeacherId?: string, recordTeacherName?: string, teacherObj?: Teacher) => {
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

  // Compute teacher score summaries
  const scoreSummaries: TeacherScoreSummary[] = teachers.filter(Boolean).map((teacher) => {
    const teacherRpps = reviews.filter((r) => isTeacherMatch(r?.teacher_id, r?.teacher_name, teacher));
    const teacherSups = supervisions.filter((s) => isTeacherMatch(s?.teacher_id, s?.teacher_name, teacher));
    const teacherFollows = followUps.filter((f) => isTeacherMatch(f?.teacher_id, undefined, teacher));

    // Latest or highest score
    const latestRpp = teacherRpps[0];
    const latestSup = teacherSups[0];

    const rppScore = latestRpp ? Number(latestRpp.percentage_score) || 0 : 0;
    const supScore = latestSup ? Number(latestSup.percentage_score) || 0 : 0;

    let compositeScore = 0;
    if (rppScore > 0 && supScore > 0) {
      compositeScore = Math.round(((rppScore * rppWeight + supScore * supWeight) / 100) * 10) / 10;
    } else if (rppScore > 0) {
      compositeScore = rppScore;
    } else if (supScore > 0) {
      compositeScore = supScore;
    }

    let predicate: TeacherScoreSummary['predicate'] = 'Perlu Pembinaan';
    if (compositeScore >= 85) predicate = 'Amat Baik';
    else if (compositeScore >= 75) predicate = 'Baik';
    else if (compositeScore >= 60) predicate = 'Cukup';

    let followUpStatus = 'Belum Ada';
    if (teacherFollows.length > 0) {
      const active = teacherFollows[0];
      followUpStatus = `${active.action_type.replace('_', ' ')} (${active.status.replace('_', ' ')})`;
    }

    return {
      teacher,
      latestRpp,
      latestSup,
      rppScore,
      supScore,
      compositeScore,
      predicate,
      followUpStatus,
      totalSupervisionsCount: teacherRpps.length + teacherSups.length,
    };
  });

  // Filter list
  const filteredScores = scoreSummaries.filter((item) => {
    const matchSearch =
      item.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.teacher.nip.includes(searchTerm) ||
      item.teacher.subject.toLowerCase().includes(searchTerm.toLowerCase());

    const matchPredicate =
      selectedPredicate === 'ALL' || item.predicate === selectedPredicate;

    return matchSearch && matchPredicate;
  });

  // Stats
  const totalSupervised = scoreSummaries.filter((s) => s.totalSupervisionsCount > 0).length;
  const avgSchoolScore =
    totalSupervised > 0
      ? Math.round(
          (scoreSummaries
            .filter((s) => s.totalSupervisionsCount > 0)
            .reduce((acc, curr) => acc + curr.compositeScore, 0) /
            totalSupervised) *
            10
        ) / 10
      : 0;

  const countAmatBaik = scoreSummaries.filter((s) => s.predicate === 'Amat Baik' && s.totalSupervisionsCount > 0).length;
  const countBaik = scoreSummaries.filter((s) => s.predicate === 'Baik' && s.totalSupervisionsCount > 0).length;
  const countCukup = scoreSummaries.filter((s) => s.predicate === 'Cukup' && s.totalSupervisionsCount > 0).length;
  const countPerluPembinaan = scoreSummaries.filter((s) => s.predicate === 'Perlu Pembinaan' && s.totalSupervisionsCount > 0).length;

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredScores.map((item) => ({
      NIY_NIP: item.teacher.nip,
      Nama_Guru: item.teacher.full_name,
      Mata_Pelajaran: item.teacher.subject,
      Kelas: item.teacher.class_grade,
      Nilai_RPPM: item.rppScore ? `${item.rppScore}%` : 'Belum Evaluasi',
      Nilai_Supervisi_Kelas: item.supScore ? `${item.supScore}%` : 'Belum Evaluasi',
      Nilai_Komposit_Akhir: item.compositeScore ? `${item.compositeScore}%` : '-',
      Predikat: item.predicate,
      Status_Tindak_Lanjut: item.followUpStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Nilai Guru');
    XLSX.writeFile(wb, `Rekap_Nilai_Supervisi_Guru_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Export Berhasil', 'Data nilai guru berhasil didownload dalam format Excel.', 'success');
  };

  const handleOpenTranskrip = (item: TeacherScoreSummary) => {
    setSelectedTeacherScore(item);
    setIsTranskripOpen(true);
  };

  const handlePrintTranskrip = () => {
    document.body.classList.add('print-transkrip-only');
    triggerPrint();
    setTimeout(() => {
      document.body.classList.remove('print-transkrip-only');
    }, 1000);
  };

  const columns = [
    {
      header: 'Guru & NIP',
      cell: (item: TeacherScoreSummary) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
            {item.teacher.full_name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-800">{item.teacher.full_name}</div>
            <div className="text-[11px] text-slate-400 font-mono">NIY: {item.teacher.nip}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Mata Pelajaran & Kelas',
      cell: (item: TeacherScoreSummary) => {
        const mapels = item.teacher.subject.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
        const kelass = item.teacher.class_grade.split(/[,;]+/).map((c) => c.trim()).filter(Boolean);
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {mapels.map((m, idx) => (
                <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {m}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {kelass.join(', ')}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Nilai Telaah RPPM',
      cell: (item: TeacherScoreSummary) => (
        <div className="w-28">
          {item.rppScore > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-0.5">
                <span>{item.rppScore}%</span>
                <span className="text-[10px] text-emerald-600">RPPM</span>
              </div>
              <ProgressBar value={item.rppScore} size="sm" showPercentage={false} />
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Belum Evaluasi</span>
          )}
        </div>
      ),
    },
    {
      header: 'Nilai Supervisi Kelas',
      cell: (item: TeacherScoreSummary) => (
        <div className="w-28">
          {item.supScore > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-0.5">
                <span>{item.supScore}%</span>
                <span className="text-[10px] text-emerald-600">Kelas</span>
              </div>
              <ProgressBar value={item.supScore} size="sm" showPercentage={false} />
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Belum Evaluasi</span>
          )}
        </div>
      ),
    },
    {
      header: 'Nilai Komposit Akhir',
      cell: (item: TeacherScoreSummary) => (
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black text-emerald-700">
            {item.compositeScore > 0 ? `${item.compositeScore}%` : '-'}
          </span>
        </div>
      ),
    },
    {
      header: 'Predikat Evaluasi',
      cell: (item: TeacherScoreSummary) => (
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
    {
      header: 'Aksi Transkrip',
      cell: (item: TeacherScoreSummary) => (
        <button
          onClick={() => handleOpenTranskrip(item)}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Rapor Transkrip</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-6 no-print-transkrip">
        {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>{role === 'GURU' ? 'Hasil Nilai & Transkrip Supervisi Saya' : 'Data Nilai & Transkrip Evaluasi Guru Ter-supervisi'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {role === 'GURU'
              ? `Rekapitulasi resmi skor evaluasi RPPM dan observasi kelas untuk ${currentTeacherProfile?.full_name || currentUser?.full_name}`
              : 'Rekapitulasi resmi skor evaluasi telaah RPPM dan supervisi proses pembelajaran mendalam'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'GURU' && scoreSummaries.length > 0 && (
            <button
              onClick={() => {
                setSelectedTeacherScore(scoreSummaries[0]);
                setIsTranskripOpen(true);
                setTimeout(() => handlePrintTranskrip(), 200);
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-900/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Cetak Hasil Nilai Supervisi (PDF)</span>
            </button>
          )}

          {role !== 'GURU' && (
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel Rekap Nilai</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {role === 'GURU' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Akun Guru</div>
              <div className="text-sm font-extrabold text-slate-800 truncate max-w-[140px]">
                {currentTeacherProfile?.full_name || currentUser?.full_name}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Skor Telaah RPPM</div>
              <div className="text-xl font-extrabold text-slate-800">
                {scoreSummaries[0]?.rppScore ? `${scoreSummaries[0].rppScore}%` : '-'}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Skor Supervisi Kelas</div>
              <div className="text-xl font-extrabold text-slate-800">
                {scoreSummaries[0]?.supScore ? `${scoreSummaries[0].supScore}%` : '-'}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Nilai Komposit & Predikat</div>
              <div className="text-xl font-extrabold text-emerald-600">
                {scoreSummaries[0]?.compositeScore ? `${scoreSummaries[0].compositeScore}%` : '-'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Guru Disupervisi</div>
              <div className="text-xl font-extrabold text-slate-800">{totalSupervised} / {teachers.length} Guru</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Rerata Nilai Sekolah</div>
              <div className="text-xl font-extrabold text-slate-800">{avgSchoolScore}%</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Predikat Amat Baik</div>
              <div className="text-xl font-extrabold text-slate-800">{countAmatBaik} Guru</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Perlu Pembinaan</div>
              <div className="text-xl font-extrabold text-slate-800">{countPerluPembinaan} Guru</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        {/* Filters bar */}
        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama guru, NIP, atau mata pelajaran..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Predikat */}
            <select
              value={selectedPredicate}
              onChange={(e) => setSelectedPredicate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">Semua Predikat</option>
              <option value="Amat Baik">Amat Baik (≥85%)</option>
              <option value="Baik">Baik (75-84%)</option>
              <option value="Cukup">Cukup (60-74%)</option>
              <option value="Perlu Pembinaan">Perlu Pembinaan (&lt;60%)</option>
            </select>

            {/* Weight Adjustment */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <span>Bobot Komposit:</span>
              <button
                onClick={() => setRppWeight(rppWeight === 40 ? 50 : 40)}
                className="px-2 py-0.5 rounded bg-white font-bold text-emerald-700 border border-slate-200 shadow-2xs hover:bg-emerald-50"
              >
                RPPM {rppWeight}% : Supervisi {supWeight}%
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <Table columns={columns} data={filteredScores} keyExtractor={(item) => item?.teacher?.id || Math.random().toString()} />
      </Card>
      </div>

      {/* Modal Rapor Transkrip Nilai Guru */}
      {selectedTeacherScore && (
        <Modal
          isOpen={isTranskripOpen}
          onClose={() => setIsTranskripOpen(false)}
          title={`Rapor Transkrip Nilai Supervisi - ${selectedTeacherScore.teacher?.full_name || 'Guru'}`}
          description="Dokumen transkrip resmi hasil evaluasi telaah RPPM dan supervisi proses pembelajaran."
        >
          <div id="rapor-transkrip-print-content" className="space-y-6 print:space-y-4 print:p-0">
            {/* Kop Surat Sekolah */}
            <div className="border-b-2 border-slate-800 pb-4 text-center space-y-1">
              <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                {currentSchool.name}
              </h3>
              <p className="text-xs text-slate-600">{currentSchool.address || 'Alamat Sekolah Utama'}</p>
              <p className="text-[11px] font-mono text-slate-500">NPSN: {currentSchool.npsn}</p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                RAPOR EVALUASI & SUPERVISI PEMBELAJARAN MENDALAM
              </div>
            </div>

            {/* Identitas Guru & Evaluasi */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-bold block mb-0.5">IDENTITAS GURU</span>
                <div className="font-extrabold text-slate-800 text-sm">{selectedTeacherScore.teacher.full_name}</div>
                <div className="text-slate-600 font-mono">NIY / NIP: {selectedTeacherScore.teacher.nip}</div>
                <div className="text-slate-600 mt-1">Mata Pelajaran: <strong>{selectedTeacherScore.teacher.subject}</strong></div>
                <div className="text-slate-600">Kelas / Fase: <strong>{selectedTeacherScore.teacher.class_grade}</strong></div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block mb-0.5">HASIL EVALUASI KOMPOSIT</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-emerald-600">{selectedTeacherScore.compositeScore}%</span>
                  <Badge variant={selectedTeacherScore.predicate === 'Amat Baik' ? 'success' : 'info'}>
                    {selectedTeacherScore.predicate}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500">
                  Formulasi Bobot: <strong>{rppWeight}% RPPM</strong> + <strong>{supWeight}% Supervisi Kelas</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status Pembimbingan: <strong className="text-slate-800">{selectedTeacherScore.followUpStatus}</strong>
                </div>
              </div>
            </div>

            {/* Rincian Komponen Nilai */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-emerald-600" />
                Rincian Skor Komponen Pembelajaran
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {/* RPPM Score Box */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-1">
                      <FileCheck2 className="w-4 h-4 text-indigo-600" />
                      1. Telaah RPPM
                    </span>
                    <span className="text-sm font-black">{selectedTeacherScore.rppScore}%</span>
                  </div>
                  <ProgressBar value={selectedTeacherScore.rppScore} size="sm" showPercentage={false} />
                  {selectedTeacherScore.latestRpp ? (
                    <div>
                      <p className="text-[11px] text-slate-600 italic">
                        Topik: &ldquo;{selectedTeacherScore.latestRpp.topic}&rdquo; ({selectedTeacherScore.latestRpp.semester})
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setLembarModalConfig({
                            isOpen: true,
                            type: 'RPPM',
                            data: selectedTeacherScore.latestRpp,
                          })
                        }
                        className="mt-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Printer className="w-3.5 h-3.5" /> Cetak Lembar Rincian Nilai PDF
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Belum ada dokumen RPPM terfasilitasi.</p>
                  )}
                </div>

                {/* Supervisi Kelas Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      2. Observasi Supervisi Kelas
                    </span>
                    <span className="text-sm font-black">{selectedTeacherScore.supScore}%</span>
                  </div>
                  <ProgressBar value={selectedTeacherScore.supScore} size="sm" showPercentage={false} />
                  {selectedTeacherScore.latestSup ? (
                    <div>
                      <p className="text-[11px] text-slate-600 italic">
                        Tanggal Observasi: {selectedTeacherScore.latestSup.supervision_date}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setLembarModalConfig({
                            isOpen: true,
                            type: 'SUPERVISION',
                            data: selectedTeacherScore.latestSup,
                          })
                        }
                        className="mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Printer className="w-3.5 h-3.5" /> Cetak Lembar Rincian Nilai PDF
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Belum ada observasi supervisi kelas.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Catatan Supervisor & Rekomendasi */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Catatan umum & Rekomendasi Supervisor:
              </span>
              <p className="text-slate-600 leading-relaxed italic">
                {selectedTeacherScore.latestSup?.general_notes ||
                  selectedTeacherScore.latestRpp?.general_notes ||
                  'Guru menunjukkan kompetensi pengajaran yang baik. Disarankan untuk terus memperkaya strategi pembelajaran mendalam (Mindful, Meaningful, Joyful).'}
              </p>
            </div>

            {/* Tanda Tangan Formal (Untuk Print) */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <p className="text-slate-500 mb-12">Supervisor Evaluator,</p>
                <p className="font-extrabold text-slate-800 border-b border-slate-300 pb-1 inline-block min-w-[160px]">
                  {selectedTeacherScore.latestSup?.supervisor_name || selectedTeacherScore.latestRpp?.supervisor_name || 'Tim Supervisor Sekolah'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-12">Kepala Sekolah,</p>
                <p className="font-extrabold text-slate-800 border-b border-slate-300 pb-1 inline-block min-w-[160px]">
                  {currentSchool.headmaster_name || 'Kepala Sekolah'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setIsTranskripOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handlePrintTranskrip}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Rapor Nilai (PDF)</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Lembar Rincian Nilai */}
      <LembarRincianNilaiModal
        isOpen={lembarModalConfig.isOpen}
        onClose={() => setLembarModalConfig((prev) => ({ ...prev, isOpen: false }))}
        type={lembarModalConfig.type}
        data={lembarModalConfig.data}
      />
    </div>
  );
};
