import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const BUCKET_NAME = 'rpp_documents';
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: 'pdf' | 'docx' | 'txt';
  error?: string;
}

/**
 * Validasi magic bytes dan karakteristik keamanan file dokumen
 */
export function validateDocumentFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'File kosong (0 bytes).' };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { isValid: false, error: `Ukuran file melebihi batas maksimal 20MB (${Math.round(buffer.length / (1024 * 1024))}MB).` };
  }

  const ext = originalFilename.split('.').pop()?.toLowerCase() || '';

  // 1. Cek Magic Bytes PDF: %PDF (0x25 0x50 0x44 0x46)
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    if (ext !== 'pdf') {
      return { isValid: false, error: 'Isi file terdeteksi PDF namun ekstensi bukan .pdf.' };
    }
    return { isValid: true, detectedType: 'pdf' };
  }

  // 2. Cek Magic Bytes DOCX: ZIP archive header PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    if (ext !== 'docx') {
      return { isValid: false, error: 'Isi file terdeteksi arsip dokumen Microsoft Word (.docx) namun ekstensi berbeda.' };
    }
    return { isValid: true, detectedType: 'docx' };
  }

  // 3. Deteksi file lama binary .doc (OLE Compound File: 0xD0 0xCF 0x11 0xE0)
  if (buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return {
      isValid: false,
      error: 'Format dokumen lama Microsoft Word (.doc binary OLE) tidak didukung. Mohon simpan ulang sebagai .docx atau .pdf.',
    };
  }

  // 4. Cek Plain Text
  if (ext === 'txt') {
    return { isValid: true, detectedType: 'txt' };
  }

  return {
    isValid: false,
    error: 'Format file tidak diizinkan. Hanya file .pdf dan .docx asli yang didukung.',
  };
}

/**
 * Format standar path penyimpanan privat:
 * schools/{school_id}/teachers/{teacher_id}/{uuid}_{filename}
 */
export function buildDocumentStoragePath(
  schoolId: string,
  teacherId: string,
  originalFilename: string
): string {
  const safeSchoolId = (schoolId || 'sch-default').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeTeacherId = (teacherId || 't-default').replace(/[^a-zA-Z0-9_-]/g, '');

  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'pdf';
  const rawBase = originalFilename.replace(/\.[^/.]+$/, '');
  const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

  const uuid = crypto.randomUUID();
  return `schools/${safeSchoolId}/teachers/${safeTeacherId}/${uuid}_${safeBase}.${ext}`;
}

export async function createShortLivedSignedUrl(
  filePath: string,
  expiresInSeconds: number = 1800 // 30 minutes
): Promise<{ signedUrl: string | null; error?: string }> {
  if (!supabase) {
    return { signedUrl: null, error: 'Layanan penyimpanan Supabase belum dikonfigurasi di server.' };
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { signedUrl: null, error: error?.message || 'Gagal membuat signed URL dokumen privat.' };
    }

    return { signedUrl: data.signedUrl };
  } catch (err: any) {
    return { signedUrl: null, error: err.message || 'Kesalahan pada layanan penyimpanan.' };
  }
}

export async function uploadPrivateDocument(
  schoolId: string,
  teacherId: string,
  originalFilename: string,
  fileBuffer: Buffer,
  mimeType?: string
): Promise<{ filePath: string | null; error?: string; detectedType?: string }> {
  if (!supabase) {
    return { filePath: null, error: 'Layanan penyimpanan Supabase belum dikonfigurasi.' };
  }

  const validation = validateDocumentFile(fileBuffer, originalFilename, mimeType);
  if (!validation.isValid) {
    return { filePath: null, error: validation.error };
  }

  const filePath = buildDocumentStoragePath(schoolId, teacherId, originalFilename);

  try {
    const actualMimeType =
      validation.detectedType === 'pdf'
        ? 'application/pdf'
        : validation.detectedType === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'text/plain';

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: actualMimeType,
        upsert: false,
      });

    if (error) {
      return { filePath: null, error: error.message };
    }

    return { filePath, detectedType: validation.detectedType };
  } catch (err: any) {
    return { filePath: null, error: err.message || 'Gagal mengunggah dokumen.' };
  }
}

