import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, School, Teacher } from '../types';
import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';

export interface AuthContextType {
  currentUser: User | null;
  currentSchool: School | null;
  currentTeacherProfile: Teacher | null;
  role: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  signInWithPassword: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; role?: UserRole; error?: string; isNetworkError?: boolean }>;
  signInOfflineDemo: (
    identifier: string,
    requestedRole?: UserRole
  ) => { success: boolean; role: UserRole };
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, role?: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [currentTeacherProfile, setCurrentTeacherProfile] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync current school from db when available
  useEffect(() => {
    const unsub = db.subscribe(() => {
      const s = db.getSchool();
      if (s && s.id) {
        setCurrentSchool(s);
      }
    });
    const s = db.getSchool();
    if (s && s.id) {
      setCurrentSchool(s);
    }
    return unsub;
  }, []);

  /**
   * Fetch profile strictly from Supabase public.users table.
   * Supabase is the SINGLE SOURCE OF TRUTH.
   * If auth.users exists but public.users does not have a profile, throws an error.
   */
  const fetchUserProfile = async (userId: string, userEmail: string): Promise<User> => {
    if (!supabase) {
      throw new Error(
        'Supabase belum terkonfigurasi. Pastikan variabel lingkungan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diatur.'
      );
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Error fetching user profile from public.users:', error);
      throw new Error(`Gagal membaca data profil dari Supabase: ${error.message}`);
    }

    if (!profile) {
      // Check if user was registered by email under another UUID or not yet provisioned
      const { data: profileByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();

      if (profileByEmail) {
        // Link profile to auth id if needed
        return {
          id: profileByEmail.id,
          email: profileByEmail.email,
          full_name: profileByEmail.full_name,
          role: profileByEmail.role as UserRole,
          school_id: profileByEmail.school_id || db.getSchool()?.id || 'default-school-id',
          nip: profileByEmail.nip || undefined,
          avatar_url: profileByEmail.avatar_url || undefined,
          created_at: profileByEmail.created_at || new Date().toISOString(),
        };
      }

      // Percobaan auto-provisioning profil ke public.users
      const cleanEmail = (userEmail || '').toLowerCase();
      
      // 1. Dapatkan atau buat entitas sekolah awal di public.schools
      let defaultSchoolId = 'e0000000-0000-0000-0000-000000000001';
      try {
        const { data: schools } = await supabase.from('schools').select('id').limit(1);
        if (schools && schools.length > 0 && db.isUuid(schools[0].id)) {
          defaultSchoolId = schools[0].id;
        } else {
          // Buat entitas sekolah awal jika tabel schools masih kosong
          const curSchool = db.getSchool();
          const { data: createdSchool, error: schoolCreateErr } = await supabase
            .from('schools')
            .insert({
              id: defaultSchoolId,
              npsn: curSchool.npsn || '20109988',
              name: curSchool.name || 'SMP Al Hadiid',
              address: curSchool.address || 'Jl. Raya Bogor',
            })
            .select('id')
            .maybeSingle();

          if (!schoolCreateErr && createdSchool?.id) {
            defaultSchoolId = createdSchool.id;
          }
        }
      } catch (schoolQueryErr) {
        console.warn('[Auth] Penyiapan sekolah awal di Supabase dilewati:', schoolQueryErr);
      }

      // Tentukan role default: jika email mengandung admin / smp atau akun pertama, jadikan ADMIN
      const isLikelyAdmin = cleanEmail.includes('admin') || cleanEmail.includes('smp') || cleanEmail.includes('kepala');
      const isLikelySupervisor = cleanEmail.includes('supervisor');
      const defaultRole: UserRole = isLikelyAdmin ? 'ADMIN' : (isLikelySupervisor ? 'SUPERVISOR' : 'GURU');
      
      const defaultName = cleanEmail.includes('admin@sekolah.sch.id')
        ? 'Administrator Sekolah'
        : isLikelyAdmin && cleanEmail.includes('smp')
        ? 'Administrator SMP Al Hadiid'
        : isLikelySupervisor
        ? 'Supervisor Sekolah'
        : cleanEmail.split('@')[0]
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());

      // 2. Simpan profil ke public.users (coba dengan school_id, lalu fallback ke null jika foreign key belum ada)
      const userPayloadsToTry = [
        {
          id: userId,
          email: cleanEmail,
          full_name: defaultName,
          role: defaultRole,
          school_id: defaultSchoolId,
        },
        {
          id: userId,
          email: cleanEmail,
          full_name: defaultName,
          role: defaultRole,
          school_id: null,
        },
      ];

      for (const payload of userPayloadsToTry) {
        try {
          const { data: createdProfile, error: insertError } = await supabase
            .from('users')
            .insert(payload)
            .select()
            .maybeSingle();

          if (createdProfile && !insertError) {
            console.log('[Auth] Profil pengguna otomatis dibuat di public.users:', createdProfile);
            
            // Jika disimpan dengan school_id null, coba tautkan sekolah sekarang
            if (!createdProfile.school_id && defaultSchoolId) {
              try {
                await supabase.from('users').update({ school_id: defaultSchoolId }).eq('id', userId);
              } catch {
                // ignore
              }
            }

            return {
              id: createdProfile.id,
              email: createdProfile.email,
              full_name: createdProfile.full_name,
              role: createdProfile.role as UserRole,
              school_id: createdProfile.school_id || defaultSchoolId,
              nip: createdProfile.nip || undefined,
              avatar_url: createdProfile.avatar_url || undefined,
              created_at: createdProfile.created_at || new Date().toISOString(),
            };
          }
        } catch (autoErr) {
          console.warn('[Auth] Upaya auto-provision profil ke tabel database dibatasi RLS:', autoErr);
        }
      }

      // REVISI KRUSIAL:
      // Akun Supabase Auth telah berhasil diverifikasi. Jika database RLS membatasi INSERT,
      // kita TIDAK BOLEH menolak atau mengeluarkan pengguna!
      // Buat profil sesi pengguna aktif berbasis identitas Supabase Auth yang terverifikasi.
      const provisionalUser: User = {
        id: userId,
        email: cleanEmail,
        full_name: defaultName,
        role: defaultRole,
        school_id: defaultSchoolId,
        created_at: new Date().toISOString(),
      };

      console.info('[Auth] Pengguna terverifikasi Supabase Auth berhasil diaktifkan dengan role:', defaultRole);
      return provisionalUser;
    }

    if (profile.active === false || profile.active === 0) {
      throw new Error('INACTIVE_ACCOUNT: Akun Anda sedang dinonaktifkan oleh Administrator.');
    }

    const rawRole = String(profile.role || '').toUpperCase();
    if (rawRole !== 'ADMIN' && rawRole !== 'SUPERVISOR' && rawRole !== 'GURU') {
      throw new Error(`Role "${profile.role}" tidak valid di tabel public.users.`);
    }

    return {
      id: profile.id,
      email: profile.email || userEmail,
      full_name: profile.full_name,
      role: rawRole as UserRole,
      school_id: profile.school_id || db.getSchool()?.id || 'default-school-id',
      nip: profile.nip || undefined,
      avatar_url: profile.avatar_url || undefined,
      created_at: profile.created_at || new Date().toISOString(),
    };
  };

  // Listen to Supabase Auth State Changes
  useEffect(() => {
    // 0. Pulihkan sesi tersimpan dari localStorage jika server Supabase offline / tidak terjangkau
    try {
      const cached = localStorage.getItem('spm_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.role) {
          setCurrentUser(parsed);
          db.setCurrentUserInState(parsed);
        }
      }
    } catch {
      // Abaikan jika data tidak valid
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // 1. Initial session verification
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          try {
            const profile = await fetchUserProfile(session.user.id, session.user.email || '');
            setCurrentUser(profile);
            db.setCurrentUserInState(profile);
            try {
              localStorage.setItem('spm_active_user', JSON.stringify(profile));
            } catch {}
            await db.refreshFromSupabase();
            setCurrentSchool(db.getSchool());
          } catch (err: any) {
            console.warn('[Auth] Sesi awal gagal dimuat:', err.message);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 2. Auth changes listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        try {
          const profile = await fetchUserProfile(session.user.id, session.user.email || '');
          setCurrentUser(profile);
          db.setCurrentUserInState(profile);
          await db.refreshFromSupabase();
        } catch (err: any) {
          console.warn('[Auth] Auth change profile load error:', err.message);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentTeacherProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update current teacher profile if the logged in user is a teacher (GURU)
  useEffect(() => {
    if (currentUser && currentUser.role === 'GURU') {
      const tid = db.resolveTeacherId(currentUser.id) || db.resolveTeacherId(currentUser.email);
      const teachers = db.getTeachers();
      const matched =
        teachers.find((t) => t.id === tid) ||
        teachers.find(
          (t) =>
            t.user_id === currentUser.id ||
            (t.email && currentUser.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (t.nip && currentUser.nip && t.nip === currentUser.nip)
        );
      setCurrentTeacherProfile(matched || null);
    } else {
      setCurrentTeacherProfile(null);
    }
  }, [currentUser]);

  // Sign in offline / demo fallback mode
  const signInOfflineDemo = (
    identifier: string,
    requestedRole?: UserRole
  ): { success: boolean; role: UserRole } => {
    const cleanId = identifier.trim().toLowerCase();
    const email = cleanId.includes('@') ? cleanId : `${cleanId}@sekolah.sch.id`;

    let role: UserRole = requestedRole || 'GURU';
    if (!requestedRole) {
      if (email.includes('admin') || email.includes('smp')) role = 'ADMIN';
      else if (email.includes('supervisor')) role = 'SUPERVISOR';
      else role = 'GURU';
    }

    const defaultNames: Record<UserRole, string> = {
      ADMIN: 'Administrator Sekolah',
      SUPERVISOR: 'Supervisor Akademik',
      GURU: 'Guru Pengajar',
    };

    const user: User = {
      id: `offline-${role.toLowerCase()}-${Date.now().toString(36)}`,
      email,
      full_name: defaultNames[role],
      role,
      school_id: db.getSchool()?.id || 'e0000000-0000-0000-0000-000000000001',
      created_at: new Date().toISOString(),
    };

    setCurrentUser(user);
    db.setCurrentUserInState(user);

    try {
      localStorage.setItem('spm_active_user', JSON.stringify(user));
    } catch {
      // ignore warning
    }

    return { success: true, role };
  };

  // Sign in with password against Supabase Auth & public.users
  const signInWithPassword = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; role?: UserRole; error?: string; isNetworkError?: boolean }> => {
    if (!supabase) {
      return {
        success: false,
        error:
          'Supabase belum terkonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diatur di Settings.',
      };
    }

    const cleanId = identifier.trim().toLowerCase();
    let resolvedEmail = cleanId;

    // If identifier is not an email (e.g. NIP or username), resolve email from Supabase
    if (!cleanId.includes('@')) {
      try {
        const { data: userByNip } = await supabase
          .from('users')
          .select('email')
          .eq('nip', cleanId)
          .maybeSingle();

        if (userByNip?.email) {
          resolvedEmail = userByNip.email;
        } else {
          const { data: teacherByNip } = await supabase
            .from('teachers')
            .select('email')
            .eq('nip', cleanId)
            .maybeSingle();

          if (teacherByNip?.email) {
            resolvedEmail = teacherByNip.email;
          } else {
            resolvedEmail = `${cleanId}@sekolah.sch.id`;
          }
        }
      } catch {
        resolvedEmail = `${cleanId}@sekolah.sch.id`;
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        const rawMsg = String(error.message || '');
        const isNetwork =
          rawMsg.toLowerCase().includes('failed to fetch') ||
          rawMsg.toLowerCase().includes('fetch') ||
          rawMsg.toLowerCase().includes('network') ||
          rawMsg.toLowerCase().includes('unreachable');

        if (isNetwork) {
          return {
            success: false,
            isNetworkError: true,
            error:
              'Gagal terhubung ke server Supabase (Failed to fetch). Server database Supabase mungkin sedang tidak aktif atau dijeda (paused).',
          };
        }

        let errorMsg = error.message;
        if (error.message === 'Invalid login credentials') {
          errorMsg = 'Email / NIP atau password salah.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          errorMsg = 'EMAIL_NOT_CONFIRMED: Email akun ini belum dikonfirmasi di Supabase Auth.';
        }
        return {
          success: false,
          error: `Gagal masuk: ${errorMsg}`,
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Autentikasi gagal: data pengguna tidak ditemukan di server.',
        };
      }

      // Verify profile and role in public.users or active session
      try {
        const profile = await fetchUserProfile(data.user.id, data.user.email || resolvedEmail);
        setCurrentUser(profile);
        db.setCurrentUserInState(profile);
        try {
          localStorage.setItem('spm_active_user', JSON.stringify(profile));
        } catch {}
        await db.refreshFromSupabase();
        return { success: true, role: profile.role };
      } catch (profileErr: any) {
        console.warn('[Auth] Gagal memuat profil database, menggunakan profil sesi Supabase Auth:', profileErr);
        const cleanEmail = (data.user.email || resolvedEmail).toLowerCase();
        const role: UserRole = cleanEmail.includes('admin') || cleanEmail.includes('smp') ? 'ADMIN' : (cleanEmail.includes('supervisor') ? 'SUPERVISOR' : 'GURU');
        const fallback: User = {
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanEmail.includes('admin') ? 'Administrator Sekolah' : cleanEmail.split('@')[0],
          role,
          school_id: db.getSchool()?.id || 'default-school-id',
          created_at: new Date().toISOString(),
        };
        setCurrentUser(fallback);
        db.setCurrentUserInState(fallback);
        try {
          localStorage.setItem('spm_active_user', JSON.stringify(fallback));
        } catch {}
        return { success: true, role: fallback.role };
      }
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      const isNetwork =
        rawMsg.toLowerCase().includes('failed to fetch') ||
        rawMsg.toLowerCase().includes('fetch') ||
        rawMsg.toLowerCase().includes('network') ||
        rawMsg.toLowerCase().includes('unreachable');

      return {
        success: false,
        isNetworkError: isNetwork,
        error: isNetwork
          ? 'Gagal terhubung ke server Supabase (Failed to fetch). Server database Supabase mungkin sedang tidak aktif atau dijeda (paused).'
          : (err.message || 'Terjadi kesalahan saat menghubungi server autentikasi Supabase.'),
      };
    }
  };

  const signInWithMagicLink = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Koneksi Supabase belum terkonfigurasi.' };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        return { success: false, error: `Gagal mengirim magic link: ${error.message}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengirim magic link.' };
    }
  };

  const resetPasswordForEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Koneksi Supabase belum terkonfigurasi.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengirim email reset password.' };
    }
  };

  const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Koneksi Supabase belum terkonfigurasi.' };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (error) {
        return { success: false, error: `Gagal mengirim ulang konfirmasi: ${error.message}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengirim ulang email konfirmasi.' };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Koneksi Supabase belum terkonfigurasi.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: `Gagal memperbarui password: ${error.message}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memperbarui password.' };
    }
  };

  // Helper login to match verified Supabase profile
  const login = (email: string, targetRole?: UserRole) => {
    const users = db.getUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      if (targetRole && found.role !== targetRole) {
        setCurrentUser({ ...found, role: targetRole });
      } else {
        setCurrentUser(found);
      }
    } else {
      console.warn(`[Auth] User with email ${email} not found in synchronized database.`);
    }
  };

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
    try {
      localStorage.removeItem('spm_active_user');
    } catch {}
    setCurrentUser(null);
    setCurrentTeacherProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentSchool,
        currentTeacherProfile,
        role: currentUser?.role || 'GURU',
        isAuthenticated: Boolean(currentUser),
        loading,
        signInWithPassword,
        signInOfflineDemo,
        signInWithMagicLink,
        resetPasswordForEmail,
        resendConfirmationEmail,
        updatePassword,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
