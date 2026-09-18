import { getAuthToken } from './api';

export interface ExtractedDocument {
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx' | 'txt';
  text: string;
  base64?: string;
  storagePath?: string;
  publicUrl?: string;
}

export async function uploadAndExtractDocument(
  file: File,
  teacherId?: string
): Promise<ExtractedDocument> {
  const fileName = file.name;
  const fileSize = file.size;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (fileSize > 20 * 1024 * 1024) {
    throw new Error('Ukuran file melebihi batas maksimum 20MB.');
  }

  if (extension === 'doc') {
    throw new Error(
      'Format file .doc legacy tidak didukung. Mohon simpan file ke format .docx atau .pdf.'
    );
  }

  let fileType: 'pdf' | 'docx' | 'txt' = 'txt';
  if (extension === 'pdf') fileType = 'pdf';
  else if (extension === 'docx') fileType = 'docx';

  // Read base64
  const base64 = await readAsBase64(file);

  let storagePath = '';
  // Try uploading via secure backend endpoint with authentication
  try {
    const token = await getAuthToken();
    if (token) {
      const response = await fetch('/api/document-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName,
          fileBase64: base64,
          teacherId,
          mimeType: file.type || (fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.filePath) {
          storagePath = result.filePath;
        }
      }
    }
  } catch (err) {
    console.warn('Backend storage upload notification:', err);
  }

  if (fileType === 'pdf') {
    return {
      fileName,
      fileSize,
      fileType,
      text: `[Dokumen PDF disiapkan: ${fileName} (${Math.round(fileSize / 1024)} KB)]`,
      base64,
      storagePath,
    };
  } else if (fileType === 'docx') {
    return {
      fileName,
      fileSize,
      fileType,
      text: `[Dokumen Word DOCX: ${fileName} (${Math.round(fileSize / 1024)} KB)]`,
      base64,
      storagePath,
    };
  } else {
    const text = await readAsText(file);
    return {
      fileName,
      fileSize,
      fileType,
      text,
      base64,
      storagePath,
    };
  }
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

