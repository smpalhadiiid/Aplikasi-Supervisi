import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'GURU';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  school_id: string;
  teacher_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const clientRole = (req.headers['x-user-role'] as string || '').toUpperCase();
  const clientUserId = (req.headers['x-user-id'] as string || '');
  const clientEmail = (req.headers['x-user-email'] as string || '');

  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';

  if (token && token !== 'null' && token !== 'undefined' && supabase) {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authData?.user) {
        const authUser = authData.user;
        const { data: profile } = await supabase
          .from('users')
          .select('id, email, role, school_id')
          .eq('id', authUser.id)
          .maybeSingle();

        const role = (profile?.role || clientRole || 'SUPERVISOR').toUpperCase() as UserRole;
        const school_id = profile?.school_id || 'sch-001';

        req.user = {
          id: authUser.id,
          email: authUser.email || profile?.email || clientEmail || '',
          role,
          school_id,
        };
        return next();
      }
    } catch (err) {
      console.warn('[Auth Middleware] Supabase JWT error, falling back to app session:', err);
    }
  }

  // Fallback for active application sessions (demo accounts, local auth, or app users)
  const fallbackRole = (clientRole || 'SUPERVISOR').toUpperCase() as UserRole;
  req.user = {
    id: clientUserId || 'usr-supervisor-01',
    email: clientEmail || 'supervisor@sekolah.sch.id',
    role: fallbackRole === 'GURU' ? 'GURU' : (fallbackRole === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR'),
    school_id: 'sch-001',
  };

  return next();
}

export function authorizeRoles(...allowedRoles: ('ADMIN' | 'SUPERVISOR' | 'GURU')[]) {
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
