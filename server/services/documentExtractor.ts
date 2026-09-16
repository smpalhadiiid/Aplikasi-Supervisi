import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

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

      const paragraphs = rawText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const words = rawText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (wordCount < 20) {
        return {
          fullText: rawText,
          pages: [{ page_number: 1, text: rawText }],
          totalPages: 1,
          wordCount,
          isUnreadable: true,
          unreadableReason: 'Dokumen DOCX berisi terlalu sedikit teks atau kosong (< 20 kata). Mohon periksa kembali dokumen Anda.',
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
      const pdfData = await pdfParse(buffer, {
        pagerender: (pageData: any) => {
          return pageData.getTextContent().then((textContent: any) => {
            let lastY, text = '';
            for (const item of textContent.items) {
              if (lastY == item.transform[5] || !lastY) {
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            pageTexts.push({
              page_number: pageData.pageIndex + 1,
              text: text.trim(),
            });
            return text;
          });
        },
      });

      const fullText = pdfData.text ? pdfData.text.trim() : '';
      const words = fullText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (wordCount < 20) {
        return {
          fullText,
          pages: pageTexts.length > 0 ? pageTexts : [{ page_number: 1, text: fullText }],
          totalPages: pdfData.numpages || 1,
          wordCount,
          isUnreadable: true,
          unreadableReason: 'Dokumen PDF tidak terbaca atau berupa hasil pemindaian (scan) tanpa teks terproses (OCR). Minimum 20 kata diperlukan.',
          fileType,
        };
      }

      return {
        fullText,
        pages: pageTexts.length > 0 ? pageTexts : [{ page_number: 1, text: fullText }],
        totalPages: pdfData.numpages || 1,
        wordCount,
        isUnreadable: false,
        fileType,
      };
    }

    // Default TXT
    const textContent = buffer.toString('utf-8').trim();
    const words = textContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 20) {
      return {
        fullText: textContent,
        pages: [{ page_number: 1, text: textContent }],
        totalPages: 1,
        wordCount,
        isUnreadable: true,
        unreadableReason: 'Teks dokumen terlalu pendek (< 20 kata).',
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
