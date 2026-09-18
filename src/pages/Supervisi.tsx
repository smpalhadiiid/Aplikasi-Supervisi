import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { supabase } from '../lib/supabaseClient';
import { Supervision, Teacher, Instrument, AIAnalysis } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ProgressBar } from '../components/common/ProgressBar';
import { useToast } from '../components/common/Toast';
import { LembarRincianNilaiModal } from '../components/common/LembarRincianNilaiModal';
import {
  Eye,
  Plus,
  Sparkles,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Printer,
  Camera,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';

export const Supervisi: React.FC = () => {
  const { role, currentUser, currentTeacherProfile } = useAuth();
  const { showToast } = useToast();

  const [supervisions, setSupervisions] = useState<Supervision[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeInst, setActiveInst] = useState<Instrument | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSup, setSelectedSup] = useState<Supervision | null>(null);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Form State
  const [formTeacherId, setFormTeacherId] = useState('');
  const [semester, setSemester] = useState('Ganjil');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [topic, setTopic] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [itemScores, setItemScores] = useState<Record<string, { score: number; notes: string }>>({});
  const [photos, setPhotos] = useState<string[]>([]);

  // Lembar Rincian Nilai Modal State
  const [isLembarModalOpen, setIsLembarModalOpen] = useState(false);
  const [selectedSupForLembar, setSelectedSupForLembar] = useState<Supervision | null>(null);

  const handleOpenLembarModal = (sup: Supervision) => {
    setSelectedSupForLembar(sup);
    setIsLembarModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast('Peringatan', 'File harus berupa gambar (JPG/PNG).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        if (result) {
          setPhotos((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const loadData = () => {
      setSupervisions(db.getSupervisions(role, currentTeacherProfile?.id));
      setTeachers(db.getTeachers(role, currentTeacherProfile?.id));

      const insts = db.getInstruments();
      const match = insts.find((i) => i.type === 'SUPERVISI_PEMBELAJARAN' && i.is_active !== false) || insts.find((i) => i.type === 'SUPERVISI_PEMBELAJARAN');
      if (match) setActiveInst(match);
    };

    loadData();
    return db.subscribe(loadData);
  }, [role, currentTeacherProfile]);

  const handleOpenNewForm = () => {
    let currentInst = activeInst;
    if (!currentInst || !currentInst.sections || currentInst.sections.length === 0) {
      const insts = db.getInstruments();
      currentInst = insts.find((i) => i.type === 'SUPERVISI_PEMBELAJARAN' && i.is_active !== false && i.sections && i.sections.length > 0) || insts.find((i) => i.type === 'SUPERVISI_PEMBELAJARAN');
      if (currentInst) setActiveInst(currentInst);
    }

    if (!currentInst || !currentInst.sections || currentInst.sections.length === 0) {
      showToast('Peringatan', 'Instrumen Supervisi aktif belum ditemukan di database.', 'error');
      return;
    }

    setFormTeacherId(teachers[0]?.id || '');
    setSemester('Ganjil');
    setAcademicYear('2026/2027');
    setTopic('');
    setGeneralNotes('');
    setPhotos([]);

    const initialScores: Record<string, { score: number; notes: string }> = {};
    activeInst.sections.forEach((sec) => {
      sec.items?.forEach((itm) => {
        initialScores[itm.id] = { score: 3, notes: '' };
      });
    });
    setItemScores(initialScores);
    setIsFormOpen(true);
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
    let predicate = 'K';
    if (percentage > 90) predicate = 'A';
    else if (percentage > 75) predicate = 'B';
    else if (percentage > 59) predicate = 'C';

    return { totalScore, maxScore, percentage, predicate };
  };

  const handleSubmitSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTeacherId || !topic) {
      showToast('Peringatan', 'Pilih guru dan masukkan topik materi observasi.', 'error');
      return;
    }

    const teacher = teachers.find((t) => t?.id === formTeacherId);
    const instId = activeInst?.id || db.getInstruments().find((i) => i.type === 'SUPERVISI_PEMBELAJARAN')?.id || '';
    if (!teacher) return;

    const { totalScore, maxScore, percentage, predicate } = calculateScoreSummary();

    const newItems = Object.entries(itemScores).map(([itemId, val]: [string, any], idx) => ({
      id: `si-${Date.now()}-${idx}`,
      supervision_id: '',
      item_id: itemId,
      score: val.score,
      notes: val.notes,
      created_at: new Date().toISOString(),
    }));


    const newSup = await db.addSupervision({
      school_id: db.getSchool().id,
      teacher_id: teacher.id,
      supervisor_id: currentUser?.id || 'usr-supervisor-01',
      instrument_id: instId,
      supervision_date: new Date().toISOString().split('T')[0],
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
      photos: photos,
      items: newItems,
    });

    showToast('Berhasil', 'Sesi Observasi Supervisi Kelas tersimpan.', 'success');
    setIsFormOpen(false);

    // Auto trigger AI Analysis
    triggerAiAnalysis(newSup);
  };

  const handleOpenDetail = (sup: Supervision) => {
    setSelectedSup(sup);
    const existingAi = db.getAIAnalysis('SUPERVISION', sup.id);
    setAiAnalysis(existingAi || null);
    setIsDetailOpen(true);
  };

  const handleDeleteSupervision = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data supervisi ini?')) {
      db.deleteSupervision(id);
      showToast('Dihapus', 'Data supervisi telah dihapus.', 'success');
    }
  };

  const triggerAiAnalysis = async (sup: Supervision) => {
    try {
      setIsGeneratingAi(true);
      showToast('AI Bekerja', 'Asisten AI menganalisis proses mengajar...', 'info');

      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token || '';

      const mappedItems = (sup.items || []).map((itm) => {
        let indText = 'Indikator Pembelajaran';
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
            type: 'supervision',
            teacherName: sup.teacher_name || 'Guru',
            subject: sup.subject || '-',
            topic: sup.topic || '-',
            classGrade: sup.class_grade || '-',
            totalScore: sup.total_score || 0,
            maxScore: sup.max_possible_score || 100,
            notes: sup.general_notes || '',
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

      const scorePct = Math.round(((sup.total_score || 0) / (sup.max_possible_score || 100)) * 100);
      const tName = sup.teacher_name || 'Guru';

      const analysisObj = (resData && resData.success && resData.analysis) ? resData.analysis : {
        summary: `Hasil Observasi Pembelajaran untuk ${tName} memperoleh skor ${scorePct}%. Evaluasi menunjukkan potensi besar yang perlu ditindaklanjuti secara terstruktur.`,
        strengths: [
          `Pengelolaan pembelajaran kelas untuk ${tName} berada pada tingkat ${scorePct >= 85 ? 'Amat Baik' : scorePct >= 70 ? 'Baik' : 'Cukup'} (${scorePct}%).`,
          'Kondusivitas kelas dan penyampaian materi berlangsung lancar.',
        ],
        weaknesses: scorePct < 85 ? [
          'Pendalaman dimensi Joyful & Meaningful Learning masih perlu diperkuat pada aktivitas siswa.',
          'Interaksi eksploratif siswa perlu ditingkatkan.',
        ] : ['Pertahankan konsistensi penerapan metode interaktif.'],
        deepLearningDimensionAnalysis: `Analisis Dimensi Deep Learning: Pembelajaran Berkesadaran (Mindful) ${scorePct >= 75 ? 'tercapai baik' : 'perlu ditingkatkan'}, Pembelajaran Bermakna (Meaningful) ${scorePct >= 75 ? 'terintegrasi' : 'perlu stimulasi kontekstual'}, dan Pembelajaran Menggembirakan (Joyful) ${scorePct >= 80 ? 'tercipta kondusif' : 'perlu variasi metode'}.`,
        recommendations: [
          'Optimalkan penggunaan media pembelajaran interaktif berbasis masalah nyata.',
          'Diskusikan dengan Supervisor untuk mempertajam indikator evaluasi yang bernilai rendah.',
        ],
        followUpAction: scorePct >= 85
          ? 'Pengimbasan Praktik Baik (Lokakarya/Mentoring Sejawat) - Target: 2 Minggu'
          : 'Supervisi Klinis & Mentoring Intensif Pengelolaan Kelas - Target: 1 Bulan',
      };

      const saved = db.saveAIAnalysis({
        reference_type: 'SUPERVISION',
        reference_id: sup.id,
        summary: analysisObj.summary || 'Analisis supervisi kelas selesai.',
        strengths: analysisObj.strengths || [],
        weaknesses: analysisObj.weaknesses || [],
        deep_learning_analysis: analysisObj.deepLearningDimensionAnalysis || '',
        recommendations: analysisObj.recommendations || [],
        follow_up_action: analysisObj.followUpAction || 'In-House Training & Pendampingan.',
      });
      setAiAnalysis(saved);
      showToast('Analisis AI Selesai', 'Rekomendasi supervisi siap ditinjau.', 'success');
    } catch (err) {
      showToast('Peringatan AI', 'Gagal memanggil API AI. Menggunakan rekomendasi dasar.', 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredSupervisions = supervisions.filter(
    (s) =>
      s.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      header: 'Tanggal & Guru',
      cell: (item: Supervision) => (
        <div>
          <div className="font-bold text-slate-800">{item.teacher_name}</div>
          <div className="text-[11px] text-slate-400">
            {new Date(item.supervision_date).toLocaleDateString('id-ID')} • Sem: {item.semester}
          </div>
        </div>
      ),
    },
    {
      header: 'Mata Pelajaran & Topik',
      cell: (item: Supervision) => (
        <div>
          <div className="font-semibold text-slate-700">{item.subject} ({item.class_grade})</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{item.topic}</div>
        </div>
      ),
    },
    {
      header: 'Nilai Kinerja',
      cell: (item: Supervision) => (
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
      cell: (item: Supervision) => (
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
      cell: (item: Supervision) => (
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
              onClick={() => handleDeleteSupervision(item.id)}
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
            <Eye className="w-5 h-5 text-emerald-600" />
            <span>Supervisi Proses Pembelajaran Mendalam</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengamatan langsung praktik mengajar guru di kelas (Mindful, Meaningful, Joyful Learning)
          </p>
        </div>

        {role !== 'GURU' && (
          <button
            onClick={handleOpenNewForm}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Observasi Supervisi Baru</span>
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

        <Table columns={columns} data={filteredSupervisions} keyExtractor={(item) => item.id} />
      </Card>

      {/* Modal Form New Supervision */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Form Observasi Supervisi Pembelajaran"
        description="Amati interaksi mengajar dan beri skor indikator pembelajaran mendalam."
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitSupervision} className="space-y-6">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Materi / Topik Observasi *</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                placeholder="Contoh: Praktik Diskusi Termodinamika"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Dynamic Sections */}
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        {[1, 2, 3, 4].map((s) => (
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
                      placeholder="Catatan fakta/temuan kelas..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* FITUR UPLOAD FOTO SAAT SUPERVISI */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Upload Foto Dokumentasi Observasi Kelas</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {photos.length} Foto Terpilih
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Unggah foto suasana kelas, guru mengajar, atau interaksi siswa saat supervisi berlangsung. Foto ini akan otomatis terlampir di Lembar Rincian Nilai PDF.
            </p>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white">
                    <img src={p} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm"
                      title="Hapus foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900/80 text-white">
                      Foto #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-xs transition-all">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Pilih / Ambil Foto Observasi</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Umpan Balik Observasi</label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              placeholder="Saran dan apresiasi untuk guru..."
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
              Simpan Observasi & AI
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detail & AI Review */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Hasil Observasi & Analisis AI"
        maxWidth="3xl"
      >
        {selectedSup && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-extrabold">{selectedSup.teacher_name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{selectedSup.subject} • {selectedSup.topic}</p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-emerald-400">{selectedSup.percentage_score}%</div>
                <Badge variant="success" size="sm" className="mt-1">
                  {selectedSup.predicate}
                </Badge>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Analisis AI Praktik Mengajar</span>
                </div>

                <button
                  onClick={() => triggerAiAnalysis(selectedSup)}
                  disabled={isGeneratingAi}
                  className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40"
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> Strengths / Keunggulan
                      </h5>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {aiAnalysis.strengths?.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-900/40 border border-rose-700/40">
                      <h5 className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Weaknesses / Area Perbaikan
                      </h5>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {aiAnalysis.weaknesses?.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {aiAnalysis.deep_learning_analysis && (
                    <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-800/40 text-[11px] text-slate-200">
                      <span className="font-bold text-sky-300 block mb-1">Evaluasi Dimensi Pembelajaran Mendalam:</span>
                      {aiAnalysis.deep_learning_analysis}
                    </div>
                  )}

                  {aiAnalysis.follow_up_action && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/40 text-amber-200 text-[11px]">
                      <span className="font-bold block mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5" /> Rekomendasi Tindak Lanjut:
                      </span>
                      {aiAnalysis.follow_up_action}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {isGeneratingAi ? 'Sedang menyintesis hasil observasi...' : 'Klik tombol untuk menghasilkan analisis AI.'}
                </div>
              )}
            </div>

            {/* Photos Gallery in Detail Modal */}
            {selectedSup.photos && selectedSup.photos.length > 0 && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Foto Dokumentasi Observasi Kelas ({selectedSup.photos.length} Foto)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedSup.photos.map((pUrl, pIdx) => (
                    <div key={pIdx} className="rounded-xl overflow-hidden border border-slate-300 bg-white">
                      <img src={pUrl} alt={`Foto Observasi ${pIdx + 1}`} className="w-full h-28 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenLembarModal(selectedSup);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>Lembar Rincian Nilai PDF</span>
              </button>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Lembar Rincian Nilai Supervisi (PDF & Cetak) */}
      <LembarRincianNilaiModal
        isOpen={isLembarModalOpen}
        onClose={() => setIsLembarModalOpen(false)}
        type="SUPERVISION"
        data={selectedSupForLembar}
      />
    </div>
  );
};
