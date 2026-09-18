import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseServer: SupabaseClient | null = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'GURU';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  school_id: string;
  teacher_id?: string;
  full_name?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Middleware: Verifikasi ketat Supabase JWT Token.
 * - Menolak request tanpa token (401)
 * - Menolak token invalid/expired (401)
 * - Menolak jika profil public.users tidak ditemukan (403)
 * - Menolak header x-user-* sebagai penentu identitas
 * - Tidak ada fallback user atau demo user di level backend
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Akses ditolak. Token otentikasi (Bearer token) wajib disertakan.',
    });
  }

  const token = authHeader.split(' ')[1]?.trim();

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token otentikasi kosong atau tidak valid.',
    });
  }

  if (!supabaseServer) {
    console.error('[Auth Middleware] Supabase client is not configured on server.');
    return res.status(500).json({
      success: false,
      error: 'SERVER_CONFIGURATION_ERROR',
      message: 'Konfigurasi database server belum lengkap.',
    });
  }

  try {
    // 1. Verifikasi token ke Supabase Auth
    const { data: authData, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Sesi otentikasi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
      });
    }

    const authUser = authData.user;

    // 2. Ambil profil pengguna dari public.users (single source of truth)
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('id, email, full_name, role, school_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Auth Middleware] Error querying public.users:', profileError.message);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Gagal memuat profil pengguna dari database.',
      });
    }

    // 3. Jika profil tidak ditemukan di public.users, tolak dengan 403
    if (!profile) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_PROFILE_NOT_FOUND',
        message: 'Profil pengguna tidak ditemukan di sistem sekolah. Hubungi Administrator sekolah.',
      });
    }

    // 4. Validasi role dan school_id
    const rawRole = String(profile.role || '').toUpperCase();
    if (rawRole !== 'ADMIN' && rawRole !== 'SUPERVISOR' && rawRole !== 'GURU') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_INVALID_ROLE',
        message: 'Peran pengguna tidak valid.',
      });
    }

    if (!profile.school_id) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_NO_SCHOOL',
        message: 'Akun Anda belum terhubung dengan sekolah manapun.',
      });
    }

    let teacherId: string | undefined = undefined;

    // 5. Jika role GURU, cari relasi teacher_id terverifikasi
    if (rawRole === 'GURU') {
      const { data: teacherData } = await supabaseServer
        .from('teachers')
        .select('id')
        .eq('school_id', profile.school_id)
        .or(`user_id.eq.${authUser.id},email.eq.${profile.email || authUser.email}`)
        .maybeSingle();

      if (teacherData) {
        teacherId = teacherData.id;
      }
    }

    req.user = {
      id: authUser.id,
      email: profile.email || authUser.email || '',
      full_name: profile.full_name || '',
      role: rawRole as UserRole,
      school_id: profile.school_id,
      teacher_id: teacherId,
    };

    return next();
  } catch (err: any) {
    console.error('[Auth Middleware] Unexpected error during authentication:', err);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_AUTH_ERROR',
      message: 'Terjadi kesalahan sistem saat memverifikasi identitas pengguna.',
    });
  }
}

/** Alias untuk authenticateToken */
export const requireAuth = authenticateToken;

/**
 * Middleware Otorisasi Berdasarkan Role (RBAC)
 */
export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Akses ditolak. Pengguna belum terautentikasi.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Akses ditolak. Peran '${req.user.role}' tidak memiliki izin untuk tindakan ini.`,
      });
    }

    return next();
  };
}

/** Alias untuk authorizeRoles */
export const requireRole = authorizeRoles;

/**
 * Helper: Validasi Isolasi Multi-Tenant Sekolah
 */
export function requireSchoolAccess(
  req: AuthenticatedRequest,
  targetSchoolId: string
): boolean {
  if (!req.user) return false;
  // Admin hanya berhak pada sekolahnya sendiri (atau jika superadmin khusus)
  return req.user.school_id === targetSchoolId;
}

/**
 * Helper: Validasi Kepemilikan Data Guru (Guru hanya melihat miliknya sendiri)
 */
export function requireTeacherOwnership(
  req: AuthenticatedRequest,
  targetTeacherId: string
): boolean {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN' || req.user.role === 'SUPERVISOR') {
    return true;
  }
  return req.user.teacher_id === targetTeacherId || req.user.id === targetTeacherId;
}

