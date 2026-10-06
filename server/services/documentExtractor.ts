import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ExtractedPage {
  page_number: number;
  text: string;
}

export interface DocumentExtractionResult {
  fullText: string;
  pages: ExtractedPage[];
  totalPages: number;
  wordCount: number;
  isUnreadable: boolean;
  unreadableReason?: string;
  fileType: 'pdf' | 'docx' | 'txt';
}

export function validateFileMagicBytes(buffer: Buffer, fileType: string): { isValid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'File kosong atau tidak memiliki data.' };
  }

  // Max 20MB check
  if (buffer.length > 20 * 1024 * 1024) {
    return { isValid: false, error: 'Ukuran file melebihi batas maksimum 20MB.' };
  }

  // Check legacy .doc (OLE Compound header 0xD0CF11E0)
  if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return {
      isValid: false,
      error: 'Format file .doc (legacy) tidak didukung karena risiko keamanan. Harap simpan file sebagai .docx atau .pdf.',
    };
  }

  if (fileType === 'pdf') {
    // Check %PDF-
    if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
      return { isValid: true };
    }
    return { isValid: false, error: 'File yang diunggah bukan file PDF yang valid.' };
  }

  if (fileType === 'docx') {
    // Check PK.. (ZIP header 0x50 0x4B 0x03 0x04)
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return { isValid: true };
    }
    return { isValid: false, error: 'File yang diunggah bukan file DOCX yang valid.' };
  }

  return { isValid: true };
}

export async function extractDocumentContent(
  buffer: Buffer,
  fileType: 'pdf' | 'docx' | 'txt'
): Promise<DocumentExtractionResult> {
  const magicValidation = validateFileMagicBytes(buffer, fileType);
  if (!magicValidation.isValid) {
    return {
      fullText: '',
      pages: [],
      totalPages: 0,
      wordCount: 0,
      isUnreadable: true,
      unreadableReason: magicValidation.error,
      fileType,
    };
  }

  try {
    if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value.trim();

      const words = rawText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (wordCount < 10) {
        return {
          fullText: rawText,
          pages: [{ page_number: 1, text: rawText }],
          totalPages: 1,
          wordCount,
          isUnreadable: true,
          unreadableReason: 'Dokumen DOCX berisi terlalu sedikit teks atau kosong (< 10 kata). Mohon periksa kembali dokumen Anda.',
          fileType,
        };
      }

      return {
        fullText: rawText,
        pages: [{ page_number: 1, text: rawText }],
        totalPages: 1,
        wordCount,
        isUnreadable: false,
        fileType,
      };
    }

    if (fileType === 'pdf') {
      const pageTexts: ExtractedPage[] = [];
      let fullText = '';
      let totalPages = 1;

      try {
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        await parser.destroy();

        if (textResult) {
          fullText = (textResult.text || '').trim();
          totalPages = textResult.total || (Array.isArray(textResult.pages) ? textResult.pages.length : 1);
          if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
            textResult.pages.forEach((p: any, idx: number) => {
              pageTexts.push({
                page_number: p.num || idx + 1,
                text: (p.text || '').trim(),
              });
            });
          }
        }
      } catch (parseErr: any) {
        console.warn('[PDFParse warning, will rely on visual AI analysis]:', parseErr?.message || parseErr);
      }

      // Bersihkan pemisah halaman bawaan pdf-parse jika ada
      fullText = fullText.replace(/-- \d+ of \d+ --/g, '').trim();

      const words = fullText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // Jika teks sangat sedikit (misalnya PDF scan), tandai tetapi jangan gagalkan
      // agar multimodal Gemini dapat memproses visual PDF langsung
      const isUnreadable = wordCount === 0 && fullText.length === 0;

      return {
        fullText: fullText || '(Dokumen PDF berbasis visual/tata-letak kompleks. Teks dianalisis langsung oleh AI)',
        pages: pageTexts.length > 0 ? pageTexts : [{ page_number: 1, text: fullText }],
        totalPages: totalPages || 1,
        wordCount: wordCount || 1,
        isUnreadable,
        unreadableReason: isUnreadable ? 'Dokumen PDF kosong atau tidak berisi konten yang dapat dibaca.' : undefined,
        fileType,
      };
    }

    // Default TXT
    const textContent = buffer.toString('utf-8').trim();
    const words = textContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 10) {
      return {
        fullText: textContent,
        pages: [{ page_number: 1, text: textContent }],
        totalPages: 1,
        wordCount,
        isUnreadable: true,
        unreadableReason: 'Teks dokumen terlalu pendek (< 10 kata).',
        fileType: 'txt',
      };
    }

    return {
      fullText: textContent,
      pages: [{ page_number: 1, text: textContent }],
      totalPages: 1,
      wordCount,
      isUnreadable: false,
      fileType: 'txt',
    };
  } catch (err: any) {
    console.error('[Document Extraction Error]:', err);
    return {
      fullText: '',
      pages: [],
      totalPages: 0,
      wordCount: 0,
      isUnreadable: true,
      unreadableReason: 'Gagal mengekstrak teks dari dokumen: ' + (err.message || 'Format atau file rusak.'),
      fileType,
    };
  }
}
