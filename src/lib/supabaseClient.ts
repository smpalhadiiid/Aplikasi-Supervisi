import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

const DEFAULT_SUPABASE_URL = 'https://bbkrbzfpsvlkldiwmpsp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJia3JiemZwc3Zsa2xkaXdtcHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMTA0MTgsImV4cCI6MjEwNDU4NjQxOH0.ouYlB25AsqVIx1SJfZuf3rIHNAYVbicgtUernkFzDgM';

export const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'URL atau Anon Key Supabase belum terkonfigurasi.' };
  }
  try {
    const { data, error } = await supabase.from('schools').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Koneksi API URL & Key berhasil, TETAPI TABEL DATABASE BELUM DIBUAT (Eror 42P01: relation "schools" does not exist). Anda WAJIB menyalin "Script SQL Schema" dan menjalankannya di SQL Editor Supabase!',
        };
      }
      return {
        success: false,
        message: `Koneksi Supabase terhubung tetapi gagal membaca tabel: ${error.message} (Kode: ${error.code || '-'})`,
      };
    }
    return { success: true, message: 'Koneksi ke database Supabase terhubung & aktif! Tabel "schools" ditemukan.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke Supabase.' };
  }
}
