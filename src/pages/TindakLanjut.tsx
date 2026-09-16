import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { FollowUpPlan, Teacher } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import {
  ListTodo,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lightbulb,
  Printer,
} from 'lucide-react';

export const TindakLanjut: React.FC = () => {
  const { role, currentUser, currentTeacherProfile } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState<FollowUpPlan[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FollowUpPlan | null>(null);

  const [formData, setFormData] = useState({
    teacher_id: '',
    activity_name: '',
    action_type: 'MENTORING' as FollowUpPlan['action_type'],
    target_date: '',
    status: 'BELUM_DIMULAI' as FollowUpPlan['status'],
    outcome_notes: '',
  });

  useEffect(() => {
    const loadData = () => {
      setPlans(db.getFollowUpPlans(role, currentTeacherProfile?.id));
      setTeachers(db.getTeachers(role, currentTeacherProfile?.id));
    };
    loadData();
    return db.subscribe(loadData);
  }, [role, currentTeacherProfile]);

  const handleOpenAdd = () => {
    setEditingPlan(null);
    setFormData({
      teacher_id: teachers[0]?.id || '',
      activity_name: '',
      action_type: 'MENTORING',
      target_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'BELUM_DIMULAI',
      outcome_notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: FollowUpPlan) => {
    setEditingPlan(plan);
    setFormData({
      teacher_id: plan.teacher_id,
      activity_name: plan.activity_name,
      action_type: plan.action_type,
      target_date: plan.target_date,
      status: plan.status,
      outcome_notes: plan.outcome_notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus rencana tindak lanjut ini?')) {
      db.deleteFollowUpPlan(id);
      showToast('Dihapus', 'Rencana tindak lanjut dihapus.', 'success');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.activity_name || !formData.target_date) {
      showToast('Peringatan', 'Harap isi seluruh field bertanda bintang.', 'error');
      return;
    }

    const teacher = teachers.find((t) => t.id === formData.teacher_id);

    if (editingPlan) {
      db.updateFollowUpPlan(editingPlan.id, {
        ...formData,
        teacher_name: teacher?.full_name || editingPlan.teacher_name,
      });
      showToast('Berhasil', 'Rencana tindak lanjut diperbarui.', 'success');
    } else {
      db.addFollowUpPlan({
        school_id: db.getSchool().id,
        supervisor_id: currentUser?.id || 'usr-supervisor-01',
        reference_type: 'SUPERVISION',
        reference_id: `ref-${Date.now()}`,
        teacher_id: formData.teacher_id,
        activity_name: formData.activity_name,
        action_type: formData.action_type,
        target_date: formData.target_date,
        status: formData.status,
        outcome_notes: formData.outcome_notes,
        teacher_name: teacher?.full_name,
        supervisor_name: currentUser?.full_name,
      });
      showToast('Berhasil', 'Rencana tindak lanjut baru ditambahkan.', 'success');
    }

    setIsModalOpen(false);
  };

  const statusBadges: Record<FollowUpPlan['status'], { label: string; variant: 'warning' | 'info' | 'success' }> = {
    BELUM_DIMULAI: { label: 'Belum Dimulai', variant: 'warning' },
    SEDANG_PROSES: { label: 'Sedang Proses', variant: 'info' },
    SELESAI: { label: 'Selesai', variant: 'success' },
  };

  const columns = [
    {
      header: 'Guru Terkait',
      cell: (item: FollowUpPlan) => (
        <div>
          <div className="font-bold text-slate-800">{item.teacher_name}</div>
          <div className="text-[11px] text-slate-400">Pembimbing: {item.supervisor_name}</div>
        </div>
      ),
    },
    {
      header: 'Nama Kegiatan Tindak Lanjut',
      cell: (item: FollowUpPlan) => (
        <div>
          <div className="font-semibold text-slate-800">{item.activity_name}</div>
          <div className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">{item.action_type}</div>
        </div>
      ),
    },
    {
      header: 'Target Tanggal',
      cell: (item: FollowUpPlan) => (
        <div className="flex items-center gap-1.5 text-slate-600 font-medium text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date(item.target_date).toLocaleDateString('id-ID')}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (item: FollowUpPlan) => (
        <Badge variant={statusBadges[item.status].variant} size="sm">
          {statusBadges[item.status].label}
        </Badge>
      ),
    },
    {
      header: 'Catatan Hasil / Realisasi',
      cell: (item: FollowUpPlan) => (
        <p className="text-slate-600 text-[11px] truncate max-w-[200px]">
          {item.outcome_notes || 'Belum ada catatan realisasi'}
        </p>
      ),
    },
    {
      header: 'Aksi',
      cell: (item: FollowUpPlan) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Edit / Update Status"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {role !== 'GURU' && (
            <button
              onClick={() => handleDelete(item.id)}
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
            <ListTodo className="w-5 h-5 text-emerald-600" />
            <span>Rencana & Realisasi Tindak Lanjut</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Program pendampingan, mentoring, dan in-house training pasca supervisi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerPrint()}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Cetak Program (PDF)</span>
          </button>

          {role !== 'GURU' && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Program Tindak Lanjut</span>
            </button>
          )}
        </div>
      </div>

      <Card>
        <Table columns={columns} data={plans} keyExtractor={(item) => item.id} />
      </Card>

      {/* Modal Form Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'Update Program Tindak Lanjut' : 'Tambah Program Tindak Lanjut'}
        description="Atur jenis kegiatan pendampingan dan target tanggal ketercapaian."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Guru Sasaran *</label>
            <select
              value={formData.teacher_id}
              onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kegiatan *</label>
            <input
              type="text"
              value={formData.activity_name}
              onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
              required
              placeholder="Contoh: Mentoring Penyusunan Modul Ajar Berkesadaran"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bentuk Tindak Lanjut</label>
              <select
                value={formData.action_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    action_type: e.target.value as FollowUpPlan['action_type'],
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              >
                <option value="MENTORING">Mentoring</option>
                <option value="IN_HOUSE_TRAINING">In-House Training (IHT)</option>
                <option value="LOKAKARYA">Lokakarya</option>
                <option value="SUPERVISI_KLINIS">Supervisi Klinis</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Tanggal Selesai *</label>
              <input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status Ketercapaian</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as FollowUpPlan['status'] })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            >
              <option value="BELUM_DIMULAI">Belum Dimulai</option>
              <option value="SEDANG_PROSES">Sedang Proses</option>
              <option value="SELESAI">Selesai</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Realisasi & Hasil</label>
            <textarea
              rows={3}
              value={formData.outcome_notes}
              onChange={(e) => setFormData({ ...formData, outcome_notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              placeholder="Perkembangan kemampuan guru setelah mendapatkan tindak lanjut..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
