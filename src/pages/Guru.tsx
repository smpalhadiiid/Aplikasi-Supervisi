import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { triggerPrint } from '../lib/print';
import { Teacher } from '../types';
import { Card } from '../components/common/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import { ImportGuruModal } from '../components/admin/ImportGuruModal';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  GraduationCap,
  Mail,
  Phone,
  FileSpreadsheet,
  KeyRound,
  Printer,
  Copy,
  Check,
  Lock,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export const Guru: React.FC = () => {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nip: '',
    full_name: '',
    email: '',
    username: '',
    password: '',
    subject: '',
    class_grade: '',
    phone: '',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF',
  });

  useEffect(() => {
    const loadData = () => {
      setTeachers(db.getTeachers());
    };
    loadData();
    return db.subscribe(loadData);
  }, []);

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setFormData({
      nip: '',
      full_name: '',
      email: '',
      username: '',
      password: 'Guru123!',
      subject: '',
      class_grade: 'Fase F / Kelas XI',
      phone: '',
      status: 'AKTIF',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      nip: teacher.nip,
      full_name: teacher.full_name,
      email: teacher.email,
      username: teacher.username || teacher.email.split('@')[0],
      password: teacher.password || 'Guru123!',
      subject: teacher.subject,
      class_grade: teacher.class_grade,
      phone: teacher.phone || '',
      status: teacher.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data guru ${name}?`)) {
      db.deleteTeacher(id);
      showToast('Berhasil', `Data guru ${name} telah dihapus.`, 'success');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.nip || !formData.email) {
      showToast('Peringatan', 'Harap isi seluruh field bertanda bintang.', 'error');
      return;
    }

    const username = formData.username.trim() || formData.email.split('@')[0];
    const password = formData.password.trim() || 'Guru123!';

    try {
      if (editingTeacher) {
        db.updateTeacher(editingTeacher.id, {
          ...formData,
          username,
          password,
        });
        showToast('Berhasil', 'Data dan akun login guru diperbarui.', 'success');
      } else {
        const existingNip = teachers.find((t) => t.nip && t.nip.trim() === formData.nip.trim());
        if (existingNip) {
          showToast('Data Ganda', `Guru dengan NIP ${formData.nip} sudah terdaftar.`, 'error');
          return;
        }
        const existingEmail = teachers.find((t) => t.email && t.email.trim().toLowerCase() === formData.email.trim().toLowerCase());
        if (existingEmail) {
          showToast('Data Ganda', `Guru dengan email ${formData.email} sudah terdaftar.`, 'error');
          return;
        }

        await db.addTeacher({
          school_id: db.getSchool().id,
          ...formData,
          username,
          password,
        });
        showToast('Berhasil', 'Guru baru dan akun login berhasil dibuat.', 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal', err?.message || 'Data guru gagal disimpan ke Supabase.', 'error');
    }
  };

  const handleCopyCredentials = (teacher: Teacher) => {
    const username = teacher.username || teacher.email.split('@')[0];
    const password = teacher.password || 'Guru123!';
    const text = `AKUN LOGIN SUPERVISI GURU\nNama: ${teacher.full_name}\nUsername/NIP: ${username}\nPassword: ${password}\nPortal: ${window.location.origin}`;

    navigator.clipboard.writeText(text);
    setCopiedId(teacher.id);
    showToast('Tersalin', `Kredensial akun ${teacher.full_name} berhasil disalin.`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nip.includes(searchTerm) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.username && t.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns = [
    {
      header: 'Nama & NIP Guru',
      cell: (item: Teacher) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
            {item.full_name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-800">{item.full_name}</div>
            <div className="text-[11px] text-slate-400 font-mono">NIP: {item.nip}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Akun Login Guru',
      cell: (item: Teacher) => {
        const username = item.username || item.email.split('@')[0];
        const pass = item.password || 'Guru123!';
        return (
          <div className="space-y-0.5 text-[11px]">
            <div className="flex items-center gap-1 font-mono text-emerald-800 font-bold">
              <UserCheck className="w-3 h-3 text-emerald-600" />
              <span>{username}</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-slate-500">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>{pass}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Mata Pelajaran',
      cell: (item: Teacher) => {
        const list = (item.subject || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
        if (list.length > 1) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {list.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold"
                >
                  {s}
                </span>
              ))}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{item.subject || '-'}</span>
          </div>
        );
      },
    },
    {
      header: 'Kelas / Fase',
      cell: (item: Teacher) => {
        const list = (item.class_grade || '').split(/[,;]+/).map((c) => c.trim()).filter(Boolean);
        if (list.length > 1) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[180px]">
              {list.map((c, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] font-bold"
                >
                  {c}
                </span>
              ))}
            </div>
          );
        }
        return <span className="text-slate-700 font-medium">{item.class_grade || '-'}</span>;
      },
    },
    {
      header: 'Status',
      cell: (item: Teacher) => (
        <Badge variant={item.status === 'AKTIF' ? 'success' : 'neutral'} size="sm">
          {item.status}
        </Badge>
      ),
    },
    ...(role === 'ADMIN' || role === 'SUPERVISOR'
      ? [
          {
            header: 'Aksi',
            cell: (item: Teacher) => (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyCredentials(item)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Salin Username & Password Guru"
                >
                  {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Edit Data Guru & Password"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {role === 'ADMIN' && (
                  <button
                    onClick={() => handleDelete(item.id, item.full_name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Hapus Guru"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Daftar Guru & Akun Supervisi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data guru pengajar beserta username dan password login supervisi masing-masing
          </p>
        </div>

        {(role === 'ADMIN' || role === 'SUPERVISOR') && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setIsAccountsModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              title="Lihat & cetak seluruh username & password guru"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Daftar Akun Guru</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
              title="Import data guru dari file Excel atau CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Data Guru</span>
            </button>

            {role === 'ADMIN' && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Guru Baru</span>
              </button>
            )}
          </div>
        )}
      </div>

      <Card>
        {/* Search Bar */}
        <div className="mb-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama, NIP, username, atau mata pelajaran..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Teachers Table */}
        <Table columns={columns} data={filteredTeachers} keyExtractor={(item) => item.id} />
      </Card>

      {/* Modal Add / Edit Teacher */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Data Guru & Akun Login' : 'Tambah Guru Baru & Akun Login'}
        description="Lengkapi data guru beserta username & password untuk akses login supervisi guru."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">NIY / NIP *</label>
              <input
                type="text"
                value={formData.nip}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    nip: val,
                    username: prev.username || val || prev.email.split('@')[0],
                  }));
                }}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="1985xxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="Nama beserta gelar"
              />
            </div>
          </div>

          {/* KREDENSIAL AKUN LOGIN */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Pengaturan Akun Login Guru</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Username Login *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500"
                  placeholder="siti.rahma / NIP"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Password Login *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500"
                  placeholder="Guru123!"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="guru@sekolah.sch.id"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">No. HP / WhatsApp</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="0812xxxxxxxx"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="Matematika, Fisika (bisa lebih dari satu, pisahkan koma)"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kelas / Fase *</label>
              <input
                type="text"
                value={formData.class_grade}
                onChange={(e) => setFormData({ ...formData, class_grade: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="Kelas X-1, Kelas XI-2 (bisa lebih dari satu, pisahkan koma)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status Keaktifan</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NONAKTIF' })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            >
              <option value="AKTIF">AKTIF</option>
              <option value="NONAKTIF">NONAKTIF</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Simpan Data & Akun
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Daftar Akun Guru & Cetak Kartu Login */}
      <Modal
        isOpen={isAccountsModalOpen}
        onClose={() => setIsAccountsModalOpen(false)}
        title="Daftar Akun Login Guru yang Disupervisi"
        description="Gunakan daftar ini untuk mendistribusikan username dan password login kepada masing-masing guru."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-slate-100 p-3 rounded-2xl">
            <div className="text-xs text-slate-700">
              <span className="font-bold">Total Akun Guru:</span> {teachers.length} Akun • <span className="font-bold text-emerald-700">Default Password:</span> Guru123!
            </div>
            <button
              type="button"
              onClick={() => triggerPrint()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Cetak Kartu Login PDF</span>
            </button>
          </div>

          {/* Printable Account Slips Table */}
          <div className="printable-area space-y-3">
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-3 mb-4">
              <h1 className="text-lg font-black uppercase tracking-wide">{db.getSchool().name}</h1>
              <p className="text-xs text-slate-600">Daftar Akun Login & Kredensial Guru Supervisi Pembelajaran Mendalam AI</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto print:max-h-none print:overflow-visible p-1">
              {teachers.map((t) => {
                const username = t.username || t.email.split('@')[0];
                const password = t.password || 'Guru123!';
                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2 card-print"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-800 text-xs">{t.full_name}</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {t.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      <div>Mapel: <span className="font-medium text-slate-700">{t.subject}</span></div>
                      <div>NIP: <span className="font-mono text-slate-600">{t.nip}</span></div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Username / NIP:</span>
                        <span className="font-mono font-bold text-emerald-800">{username}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Password:</span>
                        <span className="font-mono font-bold text-slate-900">{password}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(t)}
                      className="no-print w-full py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kredensial Login</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setIsAccountsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Import Data Guru */}
      <ImportGuruModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setTeachers(db.getTeachers());
        }}
      />
    </div>
  );
};
