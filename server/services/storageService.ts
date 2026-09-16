import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const BUCKET_NAME = 'rpp_documents';

export async function createShortLivedSignedUrl(
  filePath: string,
  expiresInSeconds: number = 1800 // 30 minutes
): Promise<{ signedUrl: string | null; error?: string }> {
  if (!supabase) {
    return { signedUrl: null, error: 'Layanan penyimpanan Supabase belum dikonfigurasi.' };
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { signedUrl: null, error: error?.message || 'Gagal membuat signed URL dokumen.' };
    }

    return { signedUrl: data.signedUrl };
  } catch (err: any) {
    return { signedUrl: null, error: err.message || 'Kesalahan penyimpanan.' };
  }
}

export async function uploadPrivateDocument(
  schoolId: string,
  userId: string,
  fileId: string,
  fileExtension: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ filePath: string | null; error?: string }> {
  if (!supabase) {
    return { filePath: null, error: 'Layanan penyimpanan Supabase belum dikonfigurasi.' };
  }

  // Isolated private path structure: school_id/user_id/file_id.ext
  const safeExt = fileExtension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const filePath = `${schoolId}/${userId}/${fileId}.${safeExt}`;

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      return { filePath: null, error: error.message };
    }

    return { filePath };
  } catch (err: any) {
    return { filePath: null, error: err.message };
  }
}
