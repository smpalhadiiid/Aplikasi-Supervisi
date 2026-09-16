import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface ExtractedDocument {
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx' | 'txt';
  text: string;
  base64?: string;
  publicUrl?: string;
}

export async function uploadAndExtractDocument(file: File): Promise<ExtractedDocument> {
  const fileName = file.name;
  const fileSize = file.size;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  let fileType: 'pdf' | 'docx' | 'txt' = 'txt';
  if (extension === 'pdf') fileType = 'pdf';
  else if (extension === 'docx' || extension === 'doc') fileType = 'docx';

  let publicUrl = '';

  // 1. Upload to Supabase Storage if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const filePath = `rppm-documents/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('rpp-documents')
        .upload(filePath, file, { upsert: true });

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('rpp-documents')
          .getPublicUrl(data.path);
        publicUrl = urlData.publicUrl || '';
      }
    } catch (err) {
      console.warn('Supabase storage upload skipped or failed:', err);
    }
  }

  // Fallback URL if Supabase Storage is not set up
  if (!publicUrl) {
    publicUrl = URL.createObjectURL(file);
  }

  // 2. Read File content
  if (fileType === 'pdf') {
    const base64 = await readAsBase64(file);
    return {
      fileName,
      fileSize,
      fileType,
      text: `[Dokumen PDF disiapkan: ${fileName} (${Math.round(fileSize / 1024)} KB)]`,
      base64,
      publicUrl,
    };
  } else if (fileType === 'docx') {
    // Attempt DOCX text extraction via raw string / XML regex
    const extractedText = await extractDocxText(file);
    return {
      fileName,
      fileSize,
      fileType,
      text: extractedText || `[Dokumen Word DOCX: ${fileName}]`,
      publicUrl,
    };
  } else {
    // Plain Text file
    const text = await readAsText(file);
    return {
      fileName,
      fileSize,
      fileType,
      text,
      publicUrl,
    };
  }
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string || '');
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function extractDocxText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const rawContent = decoder.decode(buffer);

    // Filter printable text from binary/xml buffer
    const textMatches = rawContent.match(/[\w\s,.:;!?'"()\-–—áéíóúA-Za-z0-9–]{4,}/g);
    if (textMatches && textMatches.length > 0) {
      const filtered = textMatches
        .filter((t) => !t.includes('schemas.openxmlformats') && !t.includes('Microsoft') && t.length > 5)
        .join(' ');
      if (filtered.length > 50) return filtered;
    }

    return `[Teks Dokumen Modul Ajar Word: ${file.name}]`;
  } catch (err) {
    console.warn('DOCX text extraction fallback:', err);
    return `[Modul Ajar Word: ${file.name}]`;
  }
}
