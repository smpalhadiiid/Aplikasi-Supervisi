import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../../lib/db';
import { Teacher } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  HelpCircle,
  BookOpen,
  Layers,
} from 'lucide-react';

interface ImportGuruModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedTeacherRow {
  id: string;
  nip: string; // NIY / NIP
  full_name: string;
  subjects: string[]; // Multi mata pelajaran
  subjectFormatted: string;
  classes: string[]; // Multi kelas
  classGradeFormatted: string;
  email: string;
  phone: string;
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  errorMessage?: string;
}

export const ImportGuruModal: React.FC<ImportGuruModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Clean and parse multiple subjects / classes
  const parseList = (raw: string | undefined): string[] => {
    if (!raw) return [];
    return raw
      .toString()
      .split(/[,;\n|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const existingTeachers = db.getTeachers();

  const processRawData = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      setParsedRows([]);
      return;
    }

    // Attempt to detect header row or assume row 0 is header
    let headerIndex = -1;
    let colNiy = -1;
    let colName = -1;
    let colSubject = -1;
    let colClass = -1;
    let colEmail = -1;
    let colPhone = -1;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const rowStr = rows[r].map((c) => String(c || '').toLowerCase()).join(' ');
      if (
        rowStr.includes('nama') ||
        rowStr.includes('niy') ||
        rowStr.includes('nip') ||
        rowStr.includes('mapel') ||
        rowStr.includes('guru')
      ) {
        headerIndex = r;
        rows[r].forEach((cell: any, cIdx: number) => {
          const val = String(cell || '').toLowerCase().trim();
          if (val.includes('niy') || val.includes('nip') || val.includes('induk')) colNiy = cIdx;
          else if (val.includes('nama')) colName = cIdx;
          else if (val.includes('mapel') || val.includes('mata pelajaran') || val.includes('subject') || val.includes('pelajaran')) colSubject = cIdx;
          else if (val.includes('kelas') || val.includes('fase') || val.includes('class') || val.includes('grade')) colClass = cIdx;
          else if (val.includes('email')) colEmail = cIdx;
          else if (val.includes('hp') || val.includes('phone') || val.includes('wa') || val.includes('telp')) colPhone = cIdx;
        });
        break;
      }
    }

    // Fallback if no explicit header line found
    if (colNiy === -1) colNiy = 0;
    if (colName === -1) colName = 1;
    if (colSubject === -1) colSubject = 2;
    if (colClass === -1) colClass = 3;
    if (colEmail === -1) colEmail = 4;
    if (colPhone === -1) colPhone = 5;

    const dataStartRow = headerIndex !== -1 ? headerIndex + 1 : 0;
    const parsed: ParsedTeacherRow[] = [];

    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((cell) => !cell || String(cell).trim() === '')) {
        continue;
      }

      const rawNiy = String(row[colNiy] || '').trim();
      const rawName = String(row[colName] || '').trim();
      const rawSubject = String(row[colSubject] || '').trim();
      const rawClass = String(row[colClass] || '').trim();
      const rawEmail = String(row[colEmail] || '').trim();
      const rawPhone = String(row[colPhone] || '').trim();

      const subjects = parseList(rawSubject);
      const classes = parseList(rawClass);

      const subjectFormatted = subjects.length > 0 ? subjects.join(', ') : 'Umum';
      const classGradeFormatted = classes.length > 0 ? classes.join(', ') : 'Semua Kelas';

      // Auto generate email if empty
      let email = rawEmail;
      if (!email && rawNiy) {
        email = `guru.${rawNiy.replace(/[^a-zA-Z0-9]/g, '')}@sekolah.sch.id`;
      } else if (!email && rawName) {
        const cleanName = rawName
          .toLowerCase()
          .replace(/[^a-z]/g, '.')
          .replace(/\.+/g, '.');
        email = `${cleanName}@sekolah.sch.id`;
      }

      let status: 'VALID' | 'DUPLICATE' | 'INVALID' = 'VALID';
      let errorMessage = '';

      if (!rawNiy || !rawName) {
        status = 'INVALID';
        errorMessage = 'NIY dan Nama Guru wajib diisi';
      } else {
        const isDup = existingTeachers.some(
          (t) => t.nip.toLowerCase() === rawNiy.toLowerCase()
        );
        if (isDup) {
          status = 'DUPLICATE';
          errorMessage = 'NIY sudah terdaftar di database';
        }
      }

      parsed.push({
        id: `row-${i}-${Date.now()}`,
        nip: rawNiy,
        full_name: rawName,
        subjects,
        subjectFormatted,
        classes,
        classGradeFormatted,
        email,
        phone: rawPhone,
        status,
        errorMessage,
      });
    }

    setParsedRows(parsed);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        processRawData(data);
      } catch (err) {
        showToast('Gagal Membaca File', 'Pastikan format file CSV atau Excel valid.', 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Paste Parse
  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = pasteText.split('\n');
    const rows = lines
      .map((line) => {
        if (line.includes('\t')) return line.split('\t');
        if (line.includes(';')) return line.split(';');
        if (line.includes(',')) return line.split(',');
        return [line];
      })
      .filter((r) => r.length > 0);

    processRawData(rows);
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      ['NIY', 'Nama Guru', 'Mata Pelajaran', 'Kelas', 'Email', 'No HP'],
      [
        '198501152010011001',
        'Hj. Siti Rahmawati, S.Pd.',
        'Matematika, Fisika',
        'Kelas X-1, Kelas XI-2',
        'siti.rahmawati@sekolah.sch.id',
        '081234567890',
      ],
      [
        '198803202012012003',
        'Hendra Wijaya, S.Si.',
        'Fisika; Kimia; Informatika',
        'Kelas XI-IPA 1; Kelas XII-IPA 2',
        'hendra.wijaya@sekolah.sch.id',
        '081298765432',
      ],
      [
        '199205102015022004',
        'Dewi Lestari, M.Pd.',
        'Bahasa Indonesia',
        'Kelas X-1, Kelas X-2, Kelas X-3',
        'dewi.lestari@sekolah.sch.id',
        '085678901234',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
    XLSX.writeFile(wb, 'Template_Import_Guru_Multi_Subject.xlsx');
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.status === 'VALID');
    if (validRows.length === 0) {
      showToast('Peringatan', 'Tidak ada data guru yang valid untuk diimport.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const teachersToImport = validRows.map((r) => {
        const username = r.email ? r.email.split('@')[0] : (r.nip || `guru.${Date.now()}`);
        return {
          school_id: db.getSchool().id,
          nip: r.nip,
          full_name: r.full_name,
          email: r.email,
          username,
          password: 'Guru123!',
          subject: r.subjectFormatted,
          class_grade: r.classGradeFormatted,
          phone: r.phone,
          status: 'AKTIF' as const,
        };
      });

      await db.importTeachers(teachersToImport);

      showToast(
        'Import Berhasil',
        `Sebanyak ${validRows.length} data guru telah berhasil dimasukkan ke sistem.`,
        'success'
      );

      setParsedRows([]);
      setPasteText('');
      setSelectedFileName('');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Gagal Import', err?.message || 'Terjadi kesalahan saat menyimpan data.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.status === 'VALID').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'INVALID').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'DUPLICATE').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Data Guru (Multi Mapel & Kelas)"
      description="Unggah file Excel/CSV atau paste tabel data guru. NIY, Nama Guru, Multiple Mata Pelajaran, dan Multiple Kelas didukung secara otomatis."
    >
      <div className="space-y-4">
        {/* Top Info & Download Template Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-slate-800 block mb-0.5">
                Panduan Format Multi Mata Pelajaran & Kelas
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Untuk memasukkan lebih dari 1 mata pelajaran atau kelas pada seorang guru, pisahkan dengan koma (<code>,</code>) atau titik koma (<code>;</code>).
                <br />
                Contoh Mapel: <code className="bg-emerald-100/70 px-1 rounded text-emerald-800">Matematika, Fisika</code> • Contoh Kelas: <code className="bg-emerald-100/70 px-1 rounded text-emerald-800">Kelas X-1; Kelas XI-2</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100/50 shadow-xs flex items-center gap-1.5 shrink-0 transition-all text-[11px]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Template</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('FILE')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
              activeTab === 'FILE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload File Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PASTE')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
              activeTab === 'PASTE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Tabel Data</span>
          </button>
        </div>

        {/* TAB 1: FILE UPLOAD */}
        {activeTab === 'FILE' && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv, .xlsx, .xls, .txt"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-xs block">
                  Klik untuk Memilih File Excel atau CSV
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Mendukung format .xlsx, .xls, .csv, atau .txt
                </span>
              </div>
              {selectedFileName && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{selectedFileName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PASTE TEXT AREA */}
        {activeTab === 'PASTE' && (
          <div className="space-y-2">
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Salin (copy) baris tabel dari Excel / Google Sheets dan paste di sini...\nFormat per baris: NIY [Tab] Nama Guru [Tab] Mata Pelajaran [Tab] Kelas [Tab] Email\nContoh:\n198501152010011001\tHj. Siti Rahmawati, S.Pd.\tMatematika, Fisika\tKelas X-1, Kelas XI-2\tsiti@sekolah.sch.id`}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePasteParse}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Proses Teks Hasil Paste</span>
              </button>
            </div>
          </div>
        )}

        {/* PARSED PREVIEW TABLE */}
        {parsedRows.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            {/* Metrics Header */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                Pratinjau Hasil Import ({parsedRows.length} Baris)
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px]">
                  {validCount} Siap Import
                </span>
                {duplicateCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px]">
                    {duplicateCount} Duplikat NIY
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px]">
                    {invalidCount} Perlu Perbaikan
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold sticky top-0 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 pl-3">Status</th>
                    <th className="p-2.5">NIY / NIP</th>
                    <th className="p-2.5">Nama Guru</th>
                    <th className="p-2.5">Mata Pelajaran (Multi)</th>
                    <th className="p-2.5">Kelas / Fase (Multi)</th>
                    <th className="p-2.5 pr-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r) => (
                    <tr
                      key={r.id}
                      className={
                        r.status === 'INVALID'
                          ? 'bg-rose-50/50'
                          : r.status === 'DUPLICATE'
                          ? 'bg-amber-50/50'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="p-2.5 pl-3 whitespace-nowrap">
                        {r.status === 'VALID' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Siap
                          </span>
                        )}
                        {r.status === 'DUPLICATE' && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"
                            title={r.errorMessage}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Duplikat
                          </span>
                        )}
                        {r.status === 'INVALID' && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"
                            title={r.errorMessage}
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Kurang Data
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        {r.nip || '-'}
                      </td>
                      <td className="p-2.5 font-bold text-slate-800">
                        {r.full_name || '-'}
                        <div className="text-[10px] text-slate-400 font-normal">{r.email}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.subjects.length > 0 ? (
                            r.subjects.map((sub, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold whitespace-nowrap"
                              >
                                {sub}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              {r.subjectFormatted}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.classes.length > 0 ? (
                            r.classes.map((cls, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold whitespace-nowrap"
                              >
                                {cls}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              {r.classGradeFormatted}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                          title="Hapus baris ini"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0 || isProcessing}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'Memproses Import...'
                : `Import ${validCount} Data Guru Valid`}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
