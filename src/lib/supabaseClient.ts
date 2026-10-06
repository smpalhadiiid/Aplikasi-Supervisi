import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ambil variabel lingkungan khusus frontend Vite
const env = (import.meta as any).env || {};

const getStoredUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('spm_custom_supabase_url');
    if (custom && custom.trim().startsWith('http')) return custom.trim();
  }
  return (env.VITE_SUPABASE_URL || '').trim();
};

const getStoredAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('spm_custom_supabase_anon_key');
    if (custom && custom.trim()) return custom.trim();
  }
  return (env.VITE_SUPABASE_ANON_KEY || '').trim();
};

export let SUPABASE_URL: string = getStoredUrl();
export let SUPABASE_ANON_KEY: string = getStoredAnonKey();

/**
 * Memeriksa apakah konfigurasi Supabase tersedia lengkap dan memiliki format valid.
 */
export let isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  (SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://'))
);

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  missingVariables: string[];
  message: string;
}

/**
 * Memberikan status konfigurasi environment variable Supabase secara transparan.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingVariables: string[] = [];
  if (!SUPABASE_URL) missingVariables.push('VITE_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingVariables.push('VITE_SUPABASE_ANON_KEY');

  if (missingVariables.length > 0) {
    return {
      isConfigured: false,
      hasUrl: Boolean(SUPABASE_URL),
      hasAnonKey: Boolean(SUPABASE_ANON_KEY),
      missingVariables,
      message: `Konfigurasi Supabase tidak lengkap. Variabel belum tersedia: ${missingVariables.join(', ')}.`,
    };
  }

  return {
    isConfigured: true,
    hasUrl: true,
    hasAnonKey: true,
    missingVariables: [],
    message: 'Variabel lingkungan Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) terpasang dengan baik.',
  };
}

/**
 * Satu-satunya pembuatan Supabase browser client di seluruh bundle frontend.
 * Mempertahankan persistSession, autoRefreshToken, dan detectSessionInUrl.
 */
export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Memperbarui kredensial Supabase secara dinamis dari antarmuka pengguna
 * dan menyimpannya ke penyimpanan lokal serta server backend.
 */
export async function updateSupabaseConfig(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (!cleanUrl || !cleanKey) {
    return { success: false, message: 'URL Supabase dan Public Anon Key wajib diisi.' };
  }

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return { success: false, message: 'URL Supabase harus diawali dengan https://' };
  }

  try {
    const newClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    supabase = newClient;
    SUPABASE_URL = cleanUrl;
    SUPABASE_ANON_KEY = cleanKey;
    isSupabaseConfigured = true;

    if (typeof window !== 'undefined') {
      localStorage.setItem('spm_custom_supabase_url', cleanUrl);
      localStorage.setItem('spm_custom_supabase_anon_key', cleanKey);
    }

    // Beritahukan server backend agar memperbarui koneksinya juga
    try {
      await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: cleanUrl,
          supabaseAnonKey: cleanKey,
        }),
      });
    } catch (e) {
      console.warn('[Supabase Config] Server backend update notice:', e);
    }

    return { success: true, message: 'Koneksi Supabase berhasil diperbarui!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menginisialisasi Supabase client.' };
  }
}

/**
 * Helper khusus pengujian (test isolation)
 */
export function __setSupabaseClientForTesting(client: any, configured = true) {
  supabase = client;
  isSupabaseConfigured = configured;
}

export type SupabaseConnectionCategory =
  | 'MISSING_CONFIG'     // A: Supabase URL/key tidak tersedia
  | 'TABLE_NOT_FOUND'    // B: koneksi Supabase berhasil tetapi tabel belum tersedia (e.g. Error 42P01)
  | 'RLS_DENIED'         // C: koneksi berhasil tetapi RLS menolak akses (e.g. Error 42501)
  | 'TABLE_READABLE'     // D: koneksi berhasil dan tabel dapat dibaca
  | 'NETWORK_ERROR'      // E: network error (fetch failed, offline, unreachable host)
  | 'QUERY_ERROR';       // Kesalahan query PostgREST lainnya

export interface TestConnectionResult {
  success: boolean;
  category: SupabaseConnectionCategory;
  message: string;
  code?: string;
  details?: string;
}

/**
 * Menguji konektivitas nyata ke Supabase dengan query aktual ke tabel 'schools'.
 * Membedakan secara akurat:
 * A. URL/Key tidak tersedia (MISSING_CONFIG)
 * B. Tabel belum dibuat (TABLE_NOT_FOUND - 42P01)
 * C. Ditolak oleh RLS (RLS_DENIED - 42501)
 * D. Berhasil & dapat dibaca (TABLE_READABLE)
 * E. Gangguan jaringan (NETWORK_ERROR)
 */
export async function testSupabaseConnection(): Promise<TestConnectionResult> {
  // A. Supabase URL/key tidak tersedia
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      category: 'MISSING_CONFIG',
      message: 'Variabel lingkungan VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum dikonfigurasi.',
    };
  }

  try {
    const { error } = await supabase.from('schools').select('id').limit(1);

    if (error) {
      const errorCode = String(error.code || '').toUpperCase();
      const errorMsg = String(error.message || '');

      // B. Koneksi berhasil tetapi tabel belum tersedia (PostgreSQL 42P01)
      if (errorCode === '42P01' || errorMsg.toLowerCase().includes('does not exist')) {
        return {
          success: false,
          category: 'TABLE_NOT_FOUND',
          code: error.code,
          message:
            'Koneksi API URL & Key berhasil, TETAPI TABEL "schools" BELUM DIBUAT (Error 42P01: relation "schools" does not exist). Anda WAJIB menyalin "Script SQL Schema" dan menjalankannya di SQL Editor Supabase!',
          details: error.message,
        };
      }

      // C. Koneksi berhasil tetapi RLS menolak akses (PostgreSQL 42501 / 401 / 403)
      if (
        errorCode === '42501' ||
        errorMsg.toLowerCase().includes('permission denied') ||
        errorMsg.toLowerCase().includes('row-level security') ||
        errorMsg.toLowerCase().includes('violates row-level security') ||
        (error as any).status === 401 ||
        (error as any).status === 403
      ) {
        return {
          success: false,
          category: 'RLS_DENIED',
          code: error.code,
          message:
            'Koneksi ke Supabase berhasil, TETAPI AKSES DITOLAK OLEH ROW LEVEL SECURITY (RLS) (Error 42501: Permission Denied). Pastikan kebijakan RLS tabel "schools" mengizinkan pembacaan oleh pengguna anon/authenticated.',
          details: error.message,
        };
      }

      // Query error lainnya
      return {
        success: false,
        category: 'QUERY_ERROR',
        code: error.code,
        message: `Koneksi Supabase terhubung, namun query gagal: ${error.message} (Kode: ${error.code || '-'})`,
        details: error.details || error.hint || error.message,
      };
    }

    // D. Koneksi berhasil dan tabel dapat dibaca
    return {
      success: true,
      category: 'TABLE_READABLE',
      message: 'Koneksi ke database Supabase PostgreSQL terhubung & aktif! Tabel "schools" berhasil diakses dan dibaca.',
    };
  } catch (err: any) {
    const errMsg = String(err?.message || '').toLowerCase();
    const errName = String(err?.name || '').toLowerCase();

    // E. Network error
    if (
      errName === 'typeerror' ||
      errMsg.includes('failed to fetch') ||
      errMsg.includes('network') ||
      errMsg.includes('enotfound') ||
      errMsg.includes('econnrefused') ||
      errMsg.includes('load failed') ||
      errMsg.includes('timeout') ||
      err?.name === 'AbortError'
    ) {
      return {
        success: false,
        category: 'NETWORK_ERROR',
        message: `Gagal terhubung ke host Supabase (Network Error): ${err?.message || 'Periksa koneksi internet Anda atau pastikan URL project dapat diakses.'}`,
        details: err?.stack || String(err),
      };
    }

    return {
      success: false,
      category: 'QUERY_ERROR',
      message: `Terjadi kendala saat menguji koneksi Supabase: ${err?.message || 'Error tidak diketahui.'}`,
      details: String(err),
    };
  }
}

export interface TableHealthVerification {
  tableName: 'schools' | 'users' | 'teachers';
  healthy: boolean;
  category: SupabaseConnectionCategory;
  message: string;
  code?: string;
  rowCount?: number;
}

export interface DatabaseHealthCheckResult {
  healthy: boolean;
  overallCategory: SupabaseConnectionCategory;
  message: string;
  checkedAt: string;
  tables: {
    schools: TableHealthVerification;
    users: TableHealthVerification;
    teachers: TableHealthVerification;
  };
}

/**
 * Health check database komprehensif yang memverifikasi minimal tabel:
 * - schools
 * - users
 * - teachers
 *
 * Menguji apakah masing-masing tabel benar-benar ada di Supabase dan dapat di-query.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheckResult> {
  const timestamp = new Date().toISOString();

  // A. Jika env belum terpasang
  if (!isSupabaseConfigured || !supabase) {
    const configStatus = getSupabaseConfigStatus();
    const makeMissing = (tableName: 'schools' | 'users' | 'teachers'): TableHealthVerification => ({
      tableName,
      healthy: false,
      category: 'MISSING_CONFIG',
      message: 'Variabel lingkungan Supabase belum dikonfigurasi.',
    });

    return {
      healthy: false,
      overallCategory: 'MISSING_CONFIG',
      message: configStatus.message || 'Variabel lingkungan VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum dikonfigurasi.',
      checkedAt: timestamp,
      tables: {
        schools: makeMissing('schools'),
        users: makeMissing('users'),
        teachers: makeMissing('teachers'),
      },
    };
  }

  const targetTables: Array<'schools' | 'users' | 'teachers'> = ['schools', 'users', 'teachers'];
  const tableResults: Partial<Record<'schools' | 'users' | 'teachers', TableHealthVerification>> = {};

  for (const tableName of targetTables) {
    try {
      const { data, count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact' })
        .limit(1);

      if (error) {
        const errorCode = String(error.code || '').toUpperCase();
        const errorMsg = String(error.message || '');

        if (errorCode === '42P01' || errorMsg.toLowerCase().includes('does not exist')) {
          tableResults[tableName] = {
            tableName,
            healthy: false,
            category: 'TABLE_NOT_FOUND',
            code: error.code,
            message: `Tabel "${tableName}" belum tersedia di database (Error 42P01: relation does not exist).`,
          };
        } else if (
          errorCode === '42501' ||
          errorMsg.toLowerCase().includes('permission denied') ||
          errorMsg.toLowerCase().includes('row-level security') ||
          errorMsg.toLowerCase().includes('violates row-level security') ||
          (error as any).status === 401 ||
          (error as any).status === 403
        ) {
          tableResults[tableName] = {
            tableName,
            healthy: false,
            category: 'RLS_DENIED',
            code: error.code,
            message: `Akses ke tabel "${tableName}" ditolak oleh kebijakan RLS (Error 42501: Permission Denied).`,
          };
        } else {
          tableResults[tableName] = {
            tableName,
            healthy: false,
            category: 'QUERY_ERROR',
            code: error.code,
            message: `Gagal membaca tabel "${tableName}": ${error.message} (Kode: ${error.code || '-'})`,
          };
        }
      } else {
        tableResults[tableName] = {
          tableName,
          healthy: true,
          category: 'TABLE_READABLE',
          rowCount: count ?? (data ? data.length : 0),
          message: `Tabel "${tableName}" dapat diakses dan dibaca dengan sukses.`,
        };
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '').toLowerCase();
      const isNetwork =
        errMsg.includes('fetch') ||
        errMsg.includes('network') ||
        errMsg.includes('enotfound') ||
        errMsg.includes('econnrefused');

      tableResults[tableName] = {
        tableName,
        healthy: false,
        category: isNetwork ? 'NETWORK_ERROR' : 'QUERY_ERROR',
        message: isNetwork
          ? `Gagal menghubungi server database saat memeriksa tabel "${tableName}" (Network Error).`
          : `Gagal memeriksa tabel "${tableName}": ${err?.message || String(err)}`,
      };
    }
  }

  const tables = tableResults as {
    schools: TableHealthVerification;
    users: TableHealthVerification;
    teachers: TableHealthVerification;
  };

  const allHealthy = tables.schools.healthy && tables.users.healthy && tables.teachers.healthy;

  let overallCategory: SupabaseConnectionCategory = 'TABLE_READABLE';
  let message = 'Seluruh tabel inti (schools, users, teachers) terhubung, aktif, dan dapat dibaca.';

  if (!allHealthy) {
    const hasNetwork = Object.values(tables).some((t) => t.category === 'NETWORK_ERROR');
    const hasMissing = Object.values(tables).some((t) => t.category === 'TABLE_NOT_FOUND');
    const hasRls = Object.values(tables).some((t) => t.category === 'RLS_DENIED');

    if (hasNetwork) {
      overallCategory = 'NETWORK_ERROR';
      message = 'Koneksi jaringan ke Supabase bermasalah.';
    } else if (hasMissing) {
      overallCategory = 'TABLE_NOT_FOUND';
      message = 'Satu atau lebih tabel inti (schools, users, teachers) belum dibuat di database Supabase.';
    } else if (hasRls) {
      overallCategory = 'RLS_DENIED';
      message = 'Kebijakan RLS membatasi pembacaan pada satu atau lebih tabel inti.';
    } else {
      overallCategory = 'QUERY_ERROR';
      message = 'Gagal memverifikasi satu atau lebih tabel inti database.';
    }
  }

  return {
    healthy: allHealthy,
    overallCategory,
    message,
    checkedAt: timestamp,
    tables,
  };
}

