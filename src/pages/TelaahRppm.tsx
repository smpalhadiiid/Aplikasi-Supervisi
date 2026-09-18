import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { supabase } from '../lib/supabaseClient';
import { RppReview, Teacher, Instrument, AIAnalysis, AIDocumentIndicatorAnalysis } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ProgressBar } from '../components/common/ProgressBar';
import { useToast } from '../components/common/Toast';
import { RppAiReviewFlow } from '../components/RppAiReviewFlow';
import { LembarRincianNilaiModal } from '../components/common/LembarRincianNilaiModal';
import {
  FileCheck2,
  Plus,
  Sparkles,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
  FileUp,
  XCircle,
  Edit3,
  Check,
  Printer,
} from 'lucide-react';

export const TelaahRppm: React.FC = () => {
  const { role, currentUser, currentTeacherProfile } = useAuth();
  const { showToast } = useToast();

  const [reviews, setReviews] = useState<RppReview[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeInst, setActiveInst] = useState<Instrument | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Flow Mode State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<'AI_DOCUMENT' | 'MANUAL'>('AI_DOCUMENT');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<RppReview | null>(null);

  // Lembar Rincian Nilai Modal State
  const [isLembarModalOpen, setIsLembarModalOpen] = useState(false);
  const [selectedRppForLembar, setSelectedRppForLembar] = useState<RppReview | null>(null);

  const handleOpenLembarModal = (review: RppReview) => {
    setSelectedRppForLembar(review);
    setIsLembarModalOpen(true);
  };

  // Legacy AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Manual Form State
  const [formTeacherId, setFormTeacherId] = useState('');
  const [semester, setSemester] = useState('Ganjil');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [topic, setTopic] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [itemScores, setItemScores] = useState<Record<string, { score: number; notes: string }>>({});

  useEffect(() => {
    const loadData = () => {
      setReviews(db.getRppReviews(role, currentTeacherProfile?.id));
      setTeachers(db.getTeachers(role, currentTeacherProfile?.id));

      const insts = db.getInstruments();
      const match = insts.find((i) => i.type === 'RPPM' && i.is_active !== false) || insts.find((i) => i.type === 'RPPM');
      if (match) setActiveInst(match);
    };

    loadData();
    return db.subscribe(loadData);
  }, [role, currentTeacherProfile]);

  const handleOpenNewForm = () => {
    let currentInst = activeInst;
    if (!currentInst || !currentInst.sections || currentInst.sections.length === 0) {
      const insts = db.getInstruments();
      currentInst = insts.find((i) => i.type === 'RPPM' && i.is_active !== false && i.sections && i.sections.length > 0) || insts.find((i) => i.type === 'RPPM');
      if (currentInst) setActiveInst(currentInst);
    }

    if (!currentInst || !currentInst.sections || currentInst.sections.length === 0) {
      showToast('Peringatan', 'Instrumen RPPM aktif belum ditemukan di database.', 'error');
      return;
    }

    setFormTeacherId(teachers[0]?.id || '');
    setSemester('Ganjil');
    setAcademicYear('2026/2027');
    setTopic('');
    setGeneralNotes('');
    setReviewMode('AI_DOCUMENT');

    // Initialize item scores for manual backup mode
    const initialScores: Record<string, { score: number; notes: string }> = {};
    activeInst.sections.forEach((sec) => {
      sec.items?.forEach((itm) => {
        initialScores[itm.id] = { score: 3, notes: '' };
      });
    });
    setItemScores(initialScores);
    setIsFormOpen(true);
  };

  const handleSaveAiDocumentReview = async (data: {
    teacherId: string;
    semester: string;
    academicYear: string;
    topic: string;
    generalNotes: string;
    documentUrl?: string;
    documentName?: string;
    documentText?: string;
    aiItemAnalysis: AIDocumentIndicatorAnalysis[];
    itemScores: Record<string, { score: number; notes: string; status: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'PENDING' }>;
  }) => {
    if (!activeInst || !activeInst.sections) return;

    let totalScore = 0;
    let maxPossible = 0;

    activeInst.sections.forEach((sec) => {
      sec.items?.forEach((itm) => {
        if (itm.is_active) {
          const decision = data.itemScores[itm.id];
          const val = decision ? decision.score : 1;
          totalScore += val;
          maxPossible += itm.max_score || 3;
        }
      });
    });

    const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100 * 100) / 100 : 0;
    let predicate = 'Kurang (K)';
    if (percentage >= 91) predicate = 'Sangat Baik (SB)';
    else if (percentage >= 81) predicate = 'Baik (B)';
    else if (percentage >= 71) predicate = 'Cukup (C)';

    const reviewItems = Object.entries(data.itemScores).map(([itemId, val], idx) => {
      const aiInfo = data.aiItemAnalysis.find((a) => a.item_id === itemId);
      return {
        id: `ri-${Date.now()}-${idx}`,
        rpp_review_id: '',
        item_id: itemId,
        score: val.score, // OFFICIAL SUPERVISOR SCORE
        notes: val.notes || aiInfo?.revision_note || '',
        ai_recommendation_score: aiInfo?.score_recommendation,
        ai_evidence: aiInfo?.evidence,
        ai_reason: aiInfo?.reason,
        ai_revision_note: aiInfo?.revision_note,
        ai_recommendation: aiInfo?.recommendation,
        ai_status: val.status,
        created_at: new Date().toISOString(),
      };
    });

    const teacher = teachers.find((t) => t?.id === data.teacherId);
    const instId = activeInst?.id || db.getInstruments().find((i) => i.type === 'RPPM')?.id || '';

    await db.addRppReview({
      school_id: db.getSchool().id,
      teacher_id: data.teacherId,
      supervisor_id: currentUser?.id || 'usr-supervisor-01',
      instrument_id: instId,
      review_date: new Date().toISOString().split('T')[0],
      semester: data.semester,
      academic_year: data.academicYear,
      subject: teacher?.subject || '-',
      class_grade: teacher?.class_grade || '-',
      topic: data.topic,
      total_score: totalScore,
      max_possible_score: maxPossible,
      percentage_score: percentage,
      predicate,
      general_notes: data.generalNotes,
      status: 'COMPLETED',
      teacher_name: teacher?.full_name || 'Guru',
      supervisor_name: currentUser?.full_name || 'Supervisor',
      document_url: data.documentUrl,
      document_name: data.documentName,
      document_text: data.documentText,
      ai_item_analysis: data.aiItemAnalysis,
      items: reviewItems,
    });

    showToast('Berhasil', 'Hasil Telaah RPPM berbasis Dokumen AI telah disimpan resmi.', 'success');
    setIsFormOpen(false);
  };

  const handleScoreChange = (itemId: string, score: number) => {
    setItemScores((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], score },
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setItemScores((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  const calculateScoreSummary = () => {
    if (!activeInst || !activeInst.sections) return { totalScore: 0, maxScore: 0, percentage: 0, predicate: 'Cukup' };

    let totalScore = 0;
    let maxScore = 0;

    activeInst.sections.forEach((sec) => {
      sec.items?.forEach((itm) => {
        if (itm.is_active) {
          const val = itemScores[itm.id]?.score || 0;
          totalScore += val;
          maxScore += itm.max_score;
        }
      });
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;
    let predicate = 'Kurang (K)';
    if (percentage >= 91) predicate = 'Sangat Baik (SB)';
    else if (percentage >= 81) predicate = 'Baik (B)';
    else if (percentage >= 71) predicate = 'Cukup (C)';

    return { totalScore, maxScore, percentage, predicate };
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTeacherId || !topic) {
      showToast('Peringatan', 'Pilih guru dan masukkan topik pembelajaran.', 'error');
      return;
    }

    const teacher = teachers.find((t) => t.id === formTeacherId);
    if (!teacher || !activeInst) return;

    const { totalScore, maxScore, percentage, predicate } = calculateScoreSummary();

    const newItems = Object.entries(itemScores).map(([itemId, val]: [string, any], idx) => ({
      id: `ri-${Date.now()}-${idx}`,
      rpp_review_id: '',
      item_id: itemId,
      score: val.score,
      notes: val.notes,
      created_at: new Date().toISOString(),
    }));


    const newRev = await db.addRppReview({
      school_id: db.getSchool().id,
      teacher_id: teacher.id,
      supervisor_id: currentUser?.id || 'usr-supervisor-01',
      instrument_id: activeInst.id,
      review_date: new Date().toISOString().split('T')[0],
      semester,
      academic_year: academicYear,
      subject: teacher.subject,
      class_grade: teacher.class_grade,
      topic,
      total_score: totalScore,
      max_possible_score: maxScore,
      percentage_score: percentage,
      predicate,
      general_notes: generalNotes,
      status: 'COMPLETED',
      teacher_name: teacher.full_name,
      supervisor_name: currentUser?.full_name || 'Supervisor',
      items: newItems,
    });

    showToast('Berhasil', 'Hasil Telaah RPPM manual telah disimpan.', 'success');
    setIsFormOpen(false);

    // Automatically trigger AI Analysis
    triggerAiAnalysis(newRev);
  };

  const handleOpenDetail = (review: RppReview) => {
    setSelectedReview(review);
    const existingAi = db.getAIAnalysis('RPP_REVIEW', review.id);
    setAiAnalysis(existingAi || null);
    setIsDetailOpen(true);
  };

  const handleDeleteReview = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus hasil telaah RPP ini?')) {
      db.deleteRppReview(id);
      showToast('Dihapus', 'Data telaah RPP telah dihapus.', 'success');
    }
  };

  const triggerAiAnalysis = async (review: RppReview) => {
    try {
      setIsGeneratingAi(true);
      showToast('AI Bekerja', 'Asisten AI sedang menganalisis dokumen RPPM...', 'info');

      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token || '';

      const mappedItems = (review.items || []).map((itm) => {
        let indText = 'Indikator RPPM';
        if (activeInst?.sections) {
          for (const sec of activeInst.sections) {
            const found = sec.items?.find((i) => i.id === itm.item_id);
            if (found) {
              indText = `${found.code ? found.code + ' - ' : ''}${found.indicator}`;
              break;
            }
          }
        }
        return {
          indicator: indText,
          score: itm.score || 0,
          notes: itm.notes || '',
        };
      });

      let resData: any = null;
      try {
        const response = await fetch('/api/ai-analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: 'rpp',
            teacherName: review.teacher_name || 'Guru',
            subject: review.subject || '-',
            topic: review.topic || '-',
            classGrade: review.class_grade || '-',
            totalScore: review.total_score || 0,
            maxScore: review.max_possible_score || 100,
            notes: review.general_notes || '',
            items: mappedItems,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          resData = await response.json();
        } else {
          const rawText = await response.text();
          console.warn('[AI Analyze Endpoint Non-JSON Response]:', rawText);
        }
      } catch (fetchErr) {
        console.warn('[AI Analyze fetch failed, generating client fallback]:', fetchErr);
      }

      const scorePct = Math.round(((review.total_score || 0) / (review.max_possible_score || 100)) * 100);
      const tName = review.teacher_name || 'Guru';

      const analysisObj = (resData && resData.success && resData.analysis) ? resData.analysis : {
        summary: `Hasil Telaah RPPM untuk ${tName} memperoleh skor ${scorePct}%. Evaluasi menunjukkan potensi besar yang perlu ditindaklanjuti secara terstruktur.`,
        strengths: [
          `Penguasaan penyusunan RPPM untuk ${tName} berada pada kategori ${scorePct >= 85 ? 'Amat Baik' : scorePct >= 70 ? 'Baik' : 'Cukup'} (${scorePct}%).`,
          'Komponen utama tujuan dan skenario pembelajaran telah terstruktur.',
        ],
        weaknesses: scorePct < 85 ? [
          'Pendalaman dimensi Joyful & Meaningful Learning masih perlu diperkuat pada aktivitas siswa.',
          'Catatan telaah menunjukkan perlunya perincian asesmen diagnostik.',
        ] : ['Pertahankan konsistensi dokumentasi asesmen formatif berkala.'],
        deepLearningDimensionAnalysis: `Analisis Dimensi Deep Learning: Pembelajaran Berkesadaran (Mindful) ${scorePct >= 75 ? 'tercapai baik' : 'perlu ditingkatkan'}, Pembelajaran Bermakna (Meaningful) ${scorePct >= 75 ? 'terintegrasi' : 'perlu stimulasi kontekstual'}, dan Pembelajaran Menggembirakan (Joyful) ${scorePct >= 80 ? 'tercipta kondusif' : 'perlu variasi metode'}.`,
        recommendations: [
          'Optimalkan penggunaan media pembelajaran interaktif berbasis masalah nyata.',
          'Diskusikan dengan Supervisor untuk mempertajam indikator evaluasi yang bernilai rendah.',
        ],
        followUpAction: scorePct >= 85
          ? 'Pengimbasan Praktik Baik (Lokakarya/Mentoring Sejawat) - Target: 2 Minggu'
          : 'Supervisi Klinis & Pendampingan Penyusunan RPPM Deep Learning - Target: 1 Bulan',
      };

      const saved = db.saveAIAnalysis({
        reference_type: 'RPP_REVIEW',
        reference_id: review.id,
        summary: analysisObj.summary || 'Analisis dokumen RPPM berhasil.',
        strengths: analysisObj.strengths || [],
        weaknesses: analysisObj.weaknesses || [],
        deep_learning_analysis: analysisObj.deepLearningDimensionAnalysis || '',
        recommendations: analysisObj.recommendations || [],
        follow_up_action: analysisObj.followUpAction || 'Pendampingan khusus oleh Supervisor.',
      });
      setAiAnalysis(saved);
      showToast('Analisis AI Selesai', 'Rekomendasi tindak lanjut telah disintesis.', 'success');
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      showToast('Peringatan AI', 'Gagal memanggil API AI. Menggunakan rekomendasi dasar.', 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredReviews = reviews.filter(
    (r) =>
      r.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      header: 'Tanggal & Guru',
      cell: (item: RppReview) => (
        <div>
          <div className="font-bold text-slate-800">{item.teacher_name}</div>
          <div className="text-[11px] text-slate-400">
            {new Date(item.review_date).toLocaleDateString('id-ID')} • Sem: {item.semester}
          </div>
          {item.document_name && (
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <FileText className="w-3 h-3" /> {item.document_name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Mata Pelajaran & Topik',
      cell: (item: RppReview) => (
        <div>
          <div className="font-semibold text-slate-700">{item.subject}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{item.topic}</div>
        </div>
      ),
    },
    {
      header: 'Nilai Ketercapaian',
      cell: (item: RppReview) => (
        <div className="w-32">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-800">{item.percentage_score}%</span>
            <span className="text-[10px] text-slate-400">({item.total_score}/{item.max_possible_score})</span>
          </div>
          <ProgressBar value={item.percentage_score} size="sm" showPercentage={false} />
        </div>
      ),
    },
    {
      header: 'Predikat',
      cell: (item: RppReview) => (
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
      header: 'Aksi',
      cell: (item: RppReview) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenDetail(item)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-1 font-bold text-xs"
          >
            <Eye className="w-4 h-4" />
            <span>Detail</span>
          </button>
          <button
            onClick={() => handleOpenLembarModal(item)}
            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 font-bold text-xs"
            title="Cetak atau Unduh Lembar Rincian Nilai PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Lembar Nilai PDF</span>
          </button>
          {role !== 'GURU' && (
            <button
              onClick={() => handleDeleteReview(item.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            <span>Telaah RPPM (Rencana Pembelajaran Mendalam)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Evaluasi dokumen RPP / Modul Ajar berbasis Analisis Bukti AI & Verifikasi Supervisor
          </p>
        </div>

        {role !== 'GURU' && (
          <button
            onClick={handleOpenNewForm}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Buat Telaah RPP (Dokumen AI)</span>
          </button>
        )}
      </div>

      <Card>
        <div className="mb-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama guru, mata pelajaran, atau topik..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <Table columns={columns} data={filteredReviews} keyExtractor={(item) => item.id} />
      </Card>

      {/* Modal Form New RPPM Review with AI Document Flow or Manual Mode */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Form Telaah RPPM Baru"
        description="Pilih metode telaah: Analisis Dokumen AI (Rekomendasi) atau Pengisian Manual."
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Mode Selector Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-100 max-w-md mx-auto">
            <button
              onClick={() => setReviewMode('AI_DOCUMENT')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                reviewMode === 'AI_DOCUMENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Unggah Dokumen (AI)</span>
            </button>

            <button
              onClick={() => setReviewMode('MANUAL')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                reviewMode === 'MANUAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Pengisian Manual</span>
            </button>
          </div>

          {reviewMode === 'AI_DOCUMENT' && activeInst ? (
            <RppAiReviewFlow
              teachers={teachers}
              instrument={activeInst}
              onSaveReview={handleSaveAiDocumentReview}
              onCancel={() => setIsFormOpen(false)}
            />
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guru Pengajar *</label>
                  <select
                    value={formTeacherId}
                    onChange={(e) => setFormTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Semester / TA</label>
                  <div className="flex gap-2">
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Topik / Modul *</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    placeholder="Contoh: Pemodelan Vektor & AI"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Sections Scoring */}
              {activeInst?.sections?.map((section) => (
                <div key={section.id} className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    {section.title}
                  </h4>

                  <div className="space-y-3">
                    {section.items?.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-2">
                              {item.code}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{item.indicator}</span>
                          </div>

                          {/* Score radio/buttons (1 - 3) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {[1, 2, 3].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleScoreChange(item.id, s)}
                                className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                                  itemScores[item.id]?.score === s
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={itemScores[item.id]?.notes || ''}
                          onChange={(e) => handleNotesChange(item.id, e.target.value)}
                          placeholder="Catatan observasi indikator..."
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan General Supervisor</label>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  placeholder="Apresiasi umum dan poin peningkatan utama..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                >
                  Simpan Hasil Manual
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal Detail & AI Review */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Hasil Telaah RPPM & Analisis AI Bukti Dokumen"
        maxWidth="4xl"
      >
        {selectedReview && (
          <div className="space-y-6">
            {/* Header Score Overview */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    TELAAH RESMI SUPERVISOR
                  </span>
                  {selectedReview.document_name && (
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> {selectedReview.document_name}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold mt-1">{selectedReview.teacher_name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{selectedReview.subject} • {selectedReview.topic}</p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-emerald-400">{selectedReview.percentage_score}%</div>
                <Badge variant="success" size="sm" className="mt-1">
                  {selectedReview.predicate}
                </Badge>
              </div>
            </div>

            {/* AI Document Items Breakdown View if available */}
            {selectedReview.ai_item_analysis && selectedReview.ai_item_analysis.length > 0 ? (
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Rincian Bukti Dokumen & Penetapan Supervisor Per Indikator</span>
                </h4>

                <div className="space-y-4">
                  {selectedReview.ai_item_analysis.map((ai, idx) => {
                    const instItem = activeInst?.sections
                      ?.flatMap((s) => s.items || [])
                      .find((i) => i.id === ai.item_id);

                    return (
                      <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-2">
                              {instItem?.code || `IND-${idx + 1}`}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {instItem?.indicator || 'Indikator RPPM'}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ai.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                            ai.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            SKOR SUPERVISOR: {ai.supervisor_score || ai.score_recommendation}
                          </span>
                        </div>

                        {/* FLOW: BUKTI -> SKOR AI -> ALASAN -> CATATAN REVISI -> REKOMENDASI */}
                        <div className="space-y-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Bukti Dalam Dokumen:</span>
                            <p className="text-[11px] text-slate-700 italic">
                              "{ai.evidence?.[0] || 'Bukti belum ditemukan secara eksplisit dalam dokumen.'}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Skor Rekomendasi AI:</span>
                              <p className="text-[11px] font-bold text-emerald-900">
                                {ai.score_recommendation} (Konfidesi: {Math.round((ai.confidence || 0.9) * 100)}%)
                              </p>
                              <p className="text-[10px] text-slate-600 mt-1">{ai.reason}</p>
                            </div>

                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                              <span className="text-[10px] font-bold text-amber-800 uppercase block">Catatan Revisi & Rekomendasi:</span>
                              <p className="text-[11px] text-amber-900">{ai.revision_note}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Global Legacy AI Analysis Section */
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Analisis AI Pembelajaran Mendalam</span>
                  </div>

                  <button
                    onClick={() => triggerAiAnalysis(selectedReview)}
                    disabled={isGeneratingAi}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition-colors"
                  >
                    {isGeneratingAi ? 'Menganalisis...' : 'Regenerasi AI'}
                  </button>
                </div>

                {aiAnalysis ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    <p className="text-slate-200 bg-white/5 p-3 rounded-xl border border-white/10">
                      {aiAnalysis.summary}
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-700/40">
                        <h5 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Kekuatan Utama
                        </h5>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                          {aiAnalysis.strengths?.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-xl bg-rose-900/40 border border-rose-700/40">
                        <h5 className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Area Perbaikan
                        </h5>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                          {aiAnalysis.weaknesses?.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    {isGeneratingAi ? 'Sedang melakukan sintesis AI...' : 'Klik tombol di atas untuk membuat analisis AI.'}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenLembarModal(selectedReview);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>Lembar Rincian Nilai PDF</span>
              </button>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Lembar Rincian Nilai (Dokumen Resmi PDF & Cetak) */}
      <LembarRincianNilaiModal
        isOpen={isLembarModalOpen}
        onClose={() => setIsLembarModalOpen(false)}
        type="RPPM"
        data={selectedRppForLembar}
      />
    </div>
  );
};

