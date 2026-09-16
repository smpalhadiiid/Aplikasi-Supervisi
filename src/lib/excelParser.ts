import * as XLSX from 'xlsx';
import { InstrumentItem } from '../types';

export interface ImportedSectionGroup {
  sectionTitle: string;
  weight: number;
  items: {
    code: string;
    indicator: string;
    description: string;
    minScore: number;
    maxScore: number;
  }[];
}

export async function parseExcelInstrument(file: File): Promise<ImportedSectionGroup[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json rows
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
          throw new Error('File Excel kosong atau format tidak sesuai.');
        }

        // Expected Columns: [Seksi/Kategori, Kode, Indikator, Deskripsi/Rubrik, Skor Min, Skor Maks]
        const sectionsMap: Map<string, ImportedSectionGroup> = new Map();

        // Skip header (row 0)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const sectionTitle = String(row[0] || 'Umum').trim();
          const code = String(row[1] || `IND-${i}`).trim();
          const indicator = String(row[2] || '').trim();
          const description = String(row[3] || '').trim();
          const minScore = Number(row[4]) || 1;
          const maxScore = Number(row[5]) || 4;

          if (!indicator) continue; // Skip empty indicators

          if (!sectionsMap.has(sectionTitle)) {
            sectionsMap.set(sectionTitle, {
              sectionTitle,
              weight: 100,
              items: [],
            });
          }

          sectionsMap.get(sectionTitle)!.items.push({
            code,
            indicator,
            description,
            minScore,
            maxScore,
          });
        }

        const result = Array.from(sectionsMap.values());
        if (result.length === 0) {
          throw new Error('Tidak ditemukan indikator yang valid dalam file Excel.');
        }

        resolve(result);
      } catch (err: any) {
        reject(new Error(err.message || 'Gagal membaca file Excel. Pastikan format kolom sesuai.'));
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsArrayBuffer(file);
  });
}
