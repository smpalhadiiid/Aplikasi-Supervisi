import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import {
  UserCheck,
  Shield,
  Edit3,
  UserPlus,
  Mail,
  CreditCard,
  User as UserIcon,
  CheckCircle2,
  Sparkles,
  Trash2,
} from 'lucide-react';

export const AdminSupervisorProfileManager: React.FC = () => {
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    nip: '',
    email: '',
    role: 'SUPERVISOR' as UserRole,
    avatar_url: '',
  });

  const loadUsers = () => {
    const allUsers = db.getUsers();
    // Filter Admin & Supervisors
    const filtered = allUsers.filter((u) => u.role === 'ADMIN' || u.role === 'SUPERVISOR');
    setUsers(filtered);
  };

  useEffect(() => {
    loadUsers();
    const unsubscribe = db.subscribe(loadUsers);
    return () => unsubscribe();
  }, []);

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      nip: user.nip || '',
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url || '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      full_name: '',
      nip: '',
      email: '',
      role: 'SUPERVISOR',
      avatar_url: '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    db.updateUser(selectedUser.id, {
      full_name: formData.full_name,
      nip: formData.nip,
      email: formData.email,
      role: formData.role,
      avatar_url: formData.avatar_url || undefined,
    });

    showToast(
      'Profil Diperbarui',
      `Data profil ${formData.full_name} telah berhasil disimpan.`,
      'success'
    );
    setIsEditModalOpen(false);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      showToast('Form Belum Lengkap', 'Nama lengkap dan email wajib diisi.', 'warning');
      return;
    }

    db.addUser({
      email: formData.email,
      full_name: formData.full_name,
      nip: formData.nip || undefined,
      role: formData.role,
      school_id: db.getSchool().id,
      avatar_url: formData.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    });

    showToast(
      'Supervisor Ditambahkan',
      `Profil ${formData.full_name} berhasil didaftarkan sebagai ${formData.role}.`,
      'success'
    );
    setIsAddModalOpen(false);
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus akun supervisor ${name}?`)) {
      db.deleteUser(id);
      showToast('Berhasil', `Akun supervisor ${name} telah dihapus.`, 'success');
    }
  };

  return (
    <Card
      title="Kelola & Ubah Profil Admin dan Supervisor"
      subtitle="Manajemen profil resmi Admin Sekolah & Tim Pengawas Supervisor (Herman Jayusman & Suwarno)"
      action={
        role === 'ADMIN' ? (
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Supervisor Baru</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 pt-1">
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-slate-700">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-slate-800 block mb-0.5">
              Supervisor Pembelajaran Terdaftar Resmi
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Dua supervisor utama yang ditentukan secara baku adalah <strong>Herman Jayusman, S.Pd.</strong> dan <strong>Suwarno, M.Pd.</strong> Anda dapat mengubah nama, NIP, email, dan foto profil masing-masing pejabat melalui tombol ubah di bawah.
            </p>
          </div>
        </div>

        {/* List of Admin & Supervisor Profiles */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            const isAdminRole = u.role === 'ADMIN';

            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  isAdminRole
                    ? 'bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-emerald-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 shadow-xs">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-sm">
                            {u.full_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm leading-tight">
                          {u.full_name}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={isAdminRole ? 'success' : 'indigo'}
                            size="sm"
                          >
                            {isAdminRole ? (
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Admin Sekolah
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Supervisor
                              </span>
                            )}
                          </Badge>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Akun Anda
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-700">
                        NIP: {u.nip || 'Belum diatur'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">{u.email}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Aktif
                  </span>
                  <div className="flex items-center gap-2">
                    {role === 'ADMIN' && !isSelf && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Hapus Supervisor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah Profil</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Ubah Profil - ${selectedUser?.full_name}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap & Gelar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              placeholder="Contoh: Herman Jayusman, M.Pd."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">NIP (Nomor Induk Pegawai)</label>
              <input
                type="text"
                value={formData.nip}
                onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                placeholder="197803152002121004"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Peran Akses</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="SUPERVISOR">SUPERVISOR (Pengawas)</option>
                <option value="ADMIN">ADMIN (Sekolah)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Resmi <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="herman.jayusman@sekolah.sch.id"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">URL Foto Avatar (Foto Profil)</label>
            <input
              type="text"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Simpan Profil
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Supervisor Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Supervisor Baru"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap & Gelar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              placeholder=""
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">NIP</label>
              <input
                type="text"
                value={formData.nip}
                onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                placeholder="198204122008011005"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Peran</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="SUPERVISOR">SUPERVISOR (Pengawas)</option>
                <option value="ADMIN">ADMIN (Sekolah)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="supervisor.baru@sekolah.sch.id"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Tambah Supervisor
            </button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};
